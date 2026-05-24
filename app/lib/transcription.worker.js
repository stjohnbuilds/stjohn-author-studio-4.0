// Web Worker: runs Whisper transcription off the main thread.
// The main thread decodes audio (needs AudioContext), then sends the
// Float32Array here for Whisper inference.  Progress is posted back
// via self.postMessage so the UI stays responsive throughout.

let pipeline = null;
let isLoading = false;
let loadedModelId = null;

function progress(data) {
  self.postMessage({ type: 'progress', data });
}

async function initTranscriber(preferredModel) {
  if (pipeline) return pipeline;
  if (isLoading) {
    return new Promise((resolve) => {
      const id = setInterval(() => { if (pipeline) { clearInterval(id); resolve(pipeline); } }, 100);
    });
  }
  try {
    isLoading = true;
    progress({ progress: 6, stage: 'model', message: 'Loading Whisper model…' });
    const { pipeline: createPipeline, env } = await import('@xenova/transformers');
    env.backends.onnx.wasm.proxy = false;
    env.allowLocalModels = false;
    const modelCandidates = [];
    if (preferredModel) modelCandidates.push(preferredModel);
    modelCandidates.push('Xenova/whisper-small.en', 'Xenova/whisper-base.en');

    let lastError = null;
    for (const modelId of modelCandidates) {
      try {
        pipeline = await createPipeline('automatic-speech-recognition', modelId, {
          quantized: true,
        });
        loadedModelId = modelId;
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Failed to load ${modelId}, trying fallback model…`, err);
      }
    }
    if (!pipeline) throw lastError || new Error('No Whisper model could be loaded');
    isLoading = false;
    return pipeline;
  } catch (err) {
    console.error('Failed to initialize transcriber:', err);
    isLoading = false;
    throw err;
  }
}

// ── Helper functions (identical to previous implementation) ───────────────────

function normWord(w) {
  return String(w || '').toLowerCase().replace(/[^a-z0-9']+/g, '').trim();
}

function countWordOverlap(prevWords, nextWords, maxCheck = 24) {
  const prev = prevWords.map(normWord).filter(Boolean);
  const next = nextWords.map(normWord).filter(Boolean);
  const lim = Math.min(maxCheck, prev.length, next.length);
  for (let k = lim; k >= 1; k--) {
    let ok = true;
    for (let i = 0; i < k; i++) {
      if (prev[prev.length - k + i] !== next[i]) { ok = false; break; }
    }
    if (ok) return k;
  }
  return 0;
}

function splitWords(text) {
  return String(text || '').match(/[A-Za-z0-9']+/g) || [];
}

function parseChunkTimestamp(ts) {
  if (Array.isArray(ts) && ts.length >= 2) {
    const start = Number(ts[0]);
    const end = Number(ts[1]);
    return {
      start: Number.isFinite(start) ? start : null,
      end: Number.isFinite(end) ? end : null,
    };
  }
  return { start: null, end: null };
}

function extractChunkWordsFromTimestamps(chunkResult, chunkOffsetSec, chunkDurationSec) {
  const chunks = Array.isArray(chunkResult?.chunks) ? chunkResult.chunks : [];
  if (!chunks.length) return null;

  const out = [];
  for (const chunk of chunks) {
    const words = splitWords(chunk?.text);
    if (!words.length) continue;

    const { start, end } = parseChunkTimestamp(chunk?.timestamp);
    if (start == null && end == null) {
      words.forEach((w) => out.push({ word: w.toLowerCase(), start: null, end: null }));
      continue;
    }

    const safeStart = Math.max(0, start != null ? start : Math.max(0, (end || 0) - 0.14 * words.length));
    const safeEnd = Math.max(safeStart + 0.04, end != null ? end : (safeStart + 0.14 * words.length));
    const dt = (safeEnd - safeStart) / Math.max(1, words.length);

    words.forEach((w, idx) => {
      out.push({
        word: w.toLowerCase(),
        start: chunkOffsetSec + safeStart + idx * dt,
        end: chunkOffsetSec + safeStart + (idx + 1) * dt,
      });
    });
  }

  if (!out.length) return null;

  const fallbackDt = chunkDurationSec / Math.max(1, out.length);
  for (let i = 0; i < out.length; i++) {
    if (!Number.isFinite(out[i].start)) out[i].start = chunkOffsetSec + i * fallbackDt;
    if (!Number.isFinite(out[i].end)) out[i].end = Math.min(chunkOffsetSec + chunkDurationSec, out[i].start + fallbackDt);
  }
  return out;
}

// ── Main transcription logic ─────────────────────────────────────────────────

async function transcribe(float32Audio, decodedSampleRate, maxAmp, preferredModel) {
  progress({ progress: 14, stage: 'model', message: 'Loading Whisper model…' });
  const transcriber = await initTranscriber(preferredModel);
  if (!transcriber) throw new Error('Transcriber not available — model failed to load');

  const audioDurationSec = float32Audio.length / decodedSampleRate;

  const CHUNK_SEC = 28;
  const STRIDE_SEC = 4;
  const STEP_SEC = Math.max(8, CHUNK_SEC - STRIDE_SEC);
  const CHUNK_SAMPLES = Math.floor(CHUNK_SEC * decodedSampleRate);
  const STEP_SAMPLES = Math.floor(STEP_SEC * decodedSampleRate);
  const numChunks = Math.max(1, Math.ceil(Math.max(1, float32Audio.length - CHUNK_SAMPLES) / STEP_SAMPLES) + 1);

  const words = [];
  const fullTextWords = [];
  let chunksWithText = 0;
  let chunksWithWordTimestamps = 0;

  progress({ progress: 16, stage: 'transcribe', message: `Transcribing 0/${numChunks} chunks…` });

  for (let i = 0; i < numChunks; i++) {
    const startSample = i * STEP_SAMPLES;
    const endSample = Math.min(startSample + CHUNK_SAMPLES, float32Audio.length);
    const chunkAudio = float32Audio.slice(startSample, endSample);
    const chunkOffsetSec = startSample / decodedSampleRate;

    let chunkResult;
    try {
      chunkResult = await transcriber(chunkAudio, {
        task: 'transcribe',
        language: 'en',
        return_timestamps: 'word',
      });
    } catch (chunkErr) {
      try {
        chunkResult = await transcriber(chunkAudio, {
          task: 'transcribe',
          language: 'en',
        });
      } catch (fallbackErr) {
        console.warn(`Chunk ${i} transcription error:`, fallbackErr);
        progress({ progress: Math.round(16 + ((i + 1) / numChunks) * 84), stage: 'transcribe', message: `Transcribing ${i + 1}/${numChunks} chunks…` });
        continue;
      }
    }

    const chunkText = chunkResult.text || '';
    const chunkDurationSec = chunkAudio.length / decodedSampleRate;
    const tsWords = extractChunkWordsFromTimestamps(chunkResult, chunkOffsetSec, chunkDurationSec);

    if ((tsWords && tsWords.length) || chunkText.trim()) chunksWithText++;
    if (tsWords?.length) chunksWithWordTimestamps++;

    if ((tsWords && tsWords.length) || chunkText.trim()) {
      const wordObjs = tsWords?.length
        ? tsWords
        : (() => {
            const textWords = chunkText.trim().split(/\s+/).filter(Boolean);
            const dt = chunkDurationSec / Math.max(1, textWords.length);
            return textWords.map((word, wi) => ({
              word: word.toLowerCase(),
              start: chunkOffsetSec + wi * dt,
              end: chunkOffsetSec + (wi + 1) * dt,
            }));
          })();

      const overlapWords = words.length ? countWordOverlap(words.slice(-24).map(w => w.word), wordObjs.map(w => w.word), 10) : 0;
      const trimmedWords = wordObjs.slice(overlapWords);

      for (const obj of trimmedWords) {
        const nextWord = {
          word: String(obj.word || '').toLowerCase(),
          start: Number(obj.start) || 0,
          end: Number(obj.end) || ((Number(obj.start) || 0) + 0.12),
        };
        const prev = words[words.length - 1];
        if (
          prev &&
          prev.word === nextWord.word &&
          Math.abs((prev.start || 0) - (nextWord.start || 0)) < 0.22
        ) {
          continue;
        }
        words.push(nextWord);
      }

      fullTextWords.push(...trimmedWords.map(w => w.word));
    }

    progress({ progress: Math.round(16 + ((i + 1) / numChunks) * 84), stage: 'transcribe', message: `Transcribing ${i + 1}/${numChunks} chunks…` });
  }

  const fullText = fullTextWords.join(' ').trim();

  return {
    text: fullText,
    words,
    chunks: [],
    diagnostics: {
      audioDurationSec: Math.round(audioDurationSec),
      decodedSampleRate,
      maxAmplitude: Math.round(maxAmp * 1000) / 1000,
      rawText: fullText,
      chunkCount: numChunks,
      overlapStrideSec: STRIDE_SEC,
      chunksWithText,
      chunksWithWordTimestamps,
      wordsFromFallback: chunksWithWordTimestamps < chunksWithText,
      modelId: loadedModelId,
    },
  };
}

// ── Worker message handler ───────────────────────────────────────────────────

self.onmessage = async (e) => {
  if (e.data.type === 'transcribe') {
    try {
      const { audio, sampleRate, maxAmp, preferredModel } = e.data;
      const result = await transcribe(audio, sampleRate, maxAmp, preferredModel);
      self.postMessage({ type: 'result', result });
    } catch (err) {
      self.postMessage({ type: 'error', error: err.message || 'Unknown transcription error' });
    }
  }
};
