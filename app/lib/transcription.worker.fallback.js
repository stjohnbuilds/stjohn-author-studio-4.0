// Main-thread fallback — used only when the Web Worker fails to load.
// Will block the UI during inference but at least produces results.

let pipeline = null;
let isLoading = false;
let loadedModelId = null;

async function initTranscriber(preferredModel, onProgress) {
  if (pipeline) return pipeline;
  if (isLoading) {
    return new Promise((resolve) => {
      const id = setInterval(() => { if (pipeline) { clearInterval(id); resolve(pipeline); } }, 100);
    });
  }
  try {
    isLoading = true;
    if (onProgress) onProgress({ progress: 6, stage: 'model', message: 'Loading Whisper model…' });
    const { pipeline: createPipeline, env } = await import('@xenova/transformers');
    env.backends.onnx.wasm.proxy = false;
    env.allowLocalModels = false;
    const modelCandidates = [];
    if (preferredModel) modelCandidates.push(preferredModel);
    modelCandidates.push('Xenova/whisper-small.en', 'Xenova/whisper-base.en');
    let lastError = null;
    for (const modelId of modelCandidates) {
      try {
        pipeline = await createPipeline('automatic-speech-recognition', modelId, { quantized: true });
        loadedModelId = modelId;
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Fallback: failed to load ${modelId}`, err);
      }
    }
    if (!pipeline) throw lastError || new Error('No Whisper model could be loaded');
    isLoading = false;
    return pipeline;
  } catch (err) {
    isLoading = false;
    throw err;
  }
}

function normWord(w) { return String(w || '').toLowerCase().replace(/[^a-z0-9']+/g, '').trim(); }

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

function splitWords(text) { return String(text || '').match(/[A-Za-z0-9']+/g) || []; }

function parseChunkTimestamp(ts) {
  if (Array.isArray(ts) && ts.length >= 2) {
    const s = Number(ts[0]), e = Number(ts[1]);
    return { start: Number.isFinite(s) ? s : null, end: Number.isFinite(e) ? e : null };
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
    if (start == null && end == null) { words.forEach(w => out.push({ word: w.toLowerCase(), start: null, end: null })); continue; }
    const safeStart = Math.max(0, start != null ? start : Math.max(0, (end || 0) - 0.14 * words.length));
    const safeEnd = Math.max(safeStart + 0.04, end != null ? end : (safeStart + 0.14 * words.length));
    const dt = (safeEnd - safeStart) / Math.max(1, words.length);
    words.forEach((w, idx) => out.push({ word: w.toLowerCase(), start: chunkOffsetSec + safeStart + idx * dt, end: chunkOffsetSec + safeStart + (idx + 1) * dt }));
  }
  if (!out.length) return null;
  const fallbackDt = chunkDurationSec / Math.max(1, out.length);
  for (let i = 0; i < out.length; i++) {
    if (!Number.isFinite(out[i].start)) out[i].start = chunkOffsetSec + i * fallbackDt;
    if (!Number.isFinite(out[i].end)) out[i].end = Math.min(chunkOffsetSec + chunkDurationSec, out[i].start + fallbackDt);
  }
  return out;
}

export async function transcribeMainThread(float32Audio, decodedSampleRate, maxAmp, preferredModel, onProgress) {
  const p = (d) => { if (onProgress) onProgress(d); };
  p({ progress: 14, stage: 'model', message: 'Loading Whisper model…' });
  const transcriber = await initTranscriber(preferredModel, onProgress);
  if (!transcriber) throw new Error('Transcriber not available');

  const audioDurationSec = float32Audio.length / decodedSampleRate;
  const CHUNK_SEC = 28, STRIDE_SEC = 4;
  const STEP_SEC = Math.max(8, CHUNK_SEC - STRIDE_SEC);
  const CHUNK_SAMPLES = Math.floor(CHUNK_SEC * decodedSampleRate);
  const STEP_SAMPLES = Math.floor(STEP_SEC * decodedSampleRate);
  const numChunks = Math.max(1, Math.ceil(Math.max(1, float32Audio.length - CHUNK_SAMPLES) / STEP_SAMPLES) + 1);
  const words = [], fullTextWords = [];
  let chunksWithText = 0, chunksWithWordTimestamps = 0;
  p({ progress: 16, stage: 'transcribe', message: `Transcribing 0/${numChunks} chunks (main thread)…` });

  for (let i = 0; i < numChunks; i++) {
    const startSample = i * STEP_SAMPLES;
    const endSample = Math.min(startSample + CHUNK_SAMPLES, float32Audio.length);
    const chunkAudio = float32Audio.slice(startSample, endSample);
    const chunkOffsetSec = startSample / decodedSampleRate;

    let chunkResult;
    try {
      chunkResult = await transcriber(chunkAudio, { task: 'transcribe', language: 'en', return_timestamps: 'word' });
    } catch {
      try { chunkResult = await transcriber(chunkAudio, { task: 'transcribe', language: 'en' }); } catch { continue; }
    }

    const chunkText = chunkResult.text || '';
    const chunkDurationSec = chunkAudio.length / decodedSampleRate;
    const tsWords = extractChunkWordsFromTimestamps(chunkResult, chunkOffsetSec, chunkDurationSec);
    if ((tsWords && tsWords.length) || chunkText.trim()) chunksWithText++;
    if (tsWords?.length) chunksWithWordTimestamps++;

    if ((tsWords && tsWords.length) || chunkText.trim()) {
      const wordObjs = tsWords?.length ? tsWords : (() => {
        const tw = chunkText.trim().split(/\s+/).filter(Boolean);
        const dt = chunkDurationSec / Math.max(1, tw.length);
        return tw.map((word, wi) => ({ word: word.toLowerCase(), start: chunkOffsetSec + wi * dt, end: chunkOffsetSec + (wi + 1) * dt }));
      })();
      const overlapWords = words.length ? countWordOverlap(words.slice(-24).map(w => w.word), wordObjs.map(w => w.word), 10) : 0;
      const trimmedWords = wordObjs.slice(overlapWords);
      for (const obj of trimmedWords) {
        const nw = { word: String(obj.word || '').toLowerCase(), start: Number(obj.start) || 0, end: Number(obj.end) || ((Number(obj.start) || 0) + 0.12) };
        const prev = words[words.length - 1];
        if (prev && prev.word === nw.word && Math.abs((prev.start || 0) - (nw.start || 0)) < 0.22) continue;
        words.push(nw);
      }
      fullTextWords.push(...trimmedWords.map(w => w.word));
    }
    p({ progress: Math.round(16 + ((i + 1) / numChunks) * 84), stage: 'transcribe', message: `Transcribing ${i + 1}/${numChunks} chunks (main thread)…` });
    // Yield to event loop between chunks so UI can update
    await new Promise(r => setTimeout(r, 0));
  }

  return {
    text: fullTextWords.join(' ').trim(),
    words,
    chunks: [],
    diagnostics: { audioDurationSec: Math.round(audioDurationSec), decodedSampleRate, maxAmplitude: Math.round(maxAmp * 1000) / 1000, rawText: fullTextWords.join(' ').trim(), chunkCount: numChunks, overlapStrideSec: STRIDE_SEC, chunksWithText, chunksWithWordTimestamps, wordsFromFallback: chunksWithWordTimestamps < chunksWithText, modelId: loadedModelId },
  };
}
