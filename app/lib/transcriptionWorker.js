// Transcription wrapper — routes to whisper.cpp native binary (fast, GPU-accelerated)
// when running in Electron, with WASM Web Worker fallback for browser environments.

// ── Native whisper.cpp path (Electron) ───────────────────────────────────────

async function transcribeNative(audioPath, onProgress) {
  const electron = window.electron;
  if (onProgress) onProgress({ progress: 5, stage: 'prepare', message: 'Starting native transcription…' });

  // Listen for progress events from the main process
  let removeProgressListener = null;
  if (electron.onWhisperProgress) {
    removeProgressListener = electron.onWhisperProgress((data) => {
      if (onProgress && data?.progress != null) {
        onProgress({
          progress: Math.max(5, Math.min(95, data.progress)),
          stage: 'transcribe',
          message: `Transcribing… ${data.progress}%`,
        });
      }
    });
  }

  try {
    if (onProgress) onProgress({ progress: 10, stage: 'transcribe', message: 'Running whisper.cpp…' });
    const result = await electron.whisperTranscribe({ audioPath });
    if (onProgress) onProgress({ progress: 100, stage: 'done', message: 'Transcription complete.' });
    return result;
  } finally {
    if (removeProgressListener) removeProgressListener();
  }
}

// ── WASM Web Worker path (fallback) ──────────────────────────────────────────

let worker = null;
let workerBroken = false;

function getWorker() {
  if (workerBroken) return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('./transcription.worker.js', import.meta.url));
    } catch (e) {
      console.warn('Failed to create Web Worker, will use main-thread fallback:', e);
      workerBroken = true;
      return null;
    }
  }
  return worker;
}

// Decode any audio format (mp3, m4a, wav...) to Float32Array at 16000 Hz mono.
async function blobToFloat32At16k(blob) {
  const arrayBuffer = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) throw new Error('Web Audio API not available');
  const ctx = new AudioCtx({ sampleRate: 16000 });
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const mono = new Float32Array(decoded.length);
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < mono.length; i++) mono[i] += data[i];
    }
    if (decoded.numberOfChannels > 1) {
      for (let i = 0; i < mono.length; i++) mono[i] /= decoded.numberOfChannels;
    }
    ctx.close().catch(() => {});
    return { audio: mono, sampleRate: decoded.sampleRate };
  } catch (err) {
    ctx.close().catch(() => {});
    throw new Error('Could not decode audio: ' + err.message);
  }
}

// Public API — same signature as before so SessionsView.js needs no changes.
export async function transcribeAudio(audioBlob, onProgress, audioPath) {
  if (onProgress) onProgress({ progress: 2, stage: 'prepare', message: 'Preparing transcription…' });

  // Use native whisper.cpp when available (Electron + binary + model exist)
  const electron = typeof window !== 'undefined' && window.electron;
  if (electron?.whisperTranscribe && audioPath) {
    const info = await electron.whisperGetInfo();
    if (info.binaryExists && info.modelExists) {
      return await transcribeNative(audioPath, onProgress);
    }
    if (!audioBlob) {
      throw new Error('Native Whisper files are missing from the app package.');
    }
    console.warn('whisper.cpp binary or model not found, falling back to WASM');
  }

  // Fallback: WASM via Web Worker
  if (!audioBlob) {
    throw new Error('No audio data was available for browser transcription fallback.');
  }
  if (onProgress) onProgress({ progress: 10, stage: 'decode', message: 'Decoding audio…' });
  const { audio, sampleRate } = await blobToFloat32At16k(audioBlob);

  // Amplitude check
  let maxAmp = 0;
  for (let i = 0; i < Math.min(audio.length, 160000); i++) {
    const v = Math.abs(audio[i]);
    if (v > maxAmp) maxAmp = v;
  }

  // Read preferred model from localStorage (not available in Worker)
  let preferredModel = '';
  try { preferredModel = localStorage.getItem('ap.whisperModel') || ''; } catch {}

  // 2. Send to Worker for Whisper inference (UI stays responsive)
  const w = getWorker();
  if (!w) {
    // Fallback: run on main thread if Worker is unavailable
    if (onProgress) onProgress({ progress: 14, stage: 'model', message: 'Loading Whisper model (main thread)…' });
    const { transcribeMainThread } = await import('./transcription.worker.fallback.js');
    return transcribeMainThread(audio, sampleRate, maxAmp, preferredModel, onProgress);
  }

  return new Promise((resolve, reject) => {
    // Heartbeat timeout: resets every time the Worker sends any message.
    // Only fires if the Worker goes completely silent for 10 minutes.
    let heartbeat = setTimeout(onTimeout, 10 * 60 * 1000);
    function resetHeartbeat() {
      clearTimeout(heartbeat);
      heartbeat = setTimeout(onTimeout, 10 * 60 * 1000);
    }
    function onTimeout() {
      w.removeEventListener('message', handler);
      try { w.terminate(); } catch {}
      worker = null;
      reject(new Error('Transcription timed out — no response from Worker for 10 minutes.'));
    }

    const handler = (e) => {
      const msg = e.data;
      resetHeartbeat();
      if (msg.type === 'progress') {
        if (onProgress) onProgress(msg.data);
      } else if (msg.type === 'result') {
        clearTimeout(heartbeat);
        w.removeEventListener('message', handler);
        resolve(msg.result);
      } else if (msg.type === 'error') {
        clearTimeout(heartbeat);
        w.removeEventListener('message', handler);
        reject(new Error(msg.error));
      }
    };

    w.addEventListener('message', handler);
    w.onerror = (err) => {
      clearTimeout(heartbeat);
      w.removeEventListener('message', handler);
      // Worker crashed — discard it so we get a fresh one next time
      try { w.terminate(); } catch {}
      worker = null;
      reject(new Error('Transcription worker error: ' + (err.message || 'unknown')));
    };

    // Transfer the audio buffer (zero-copy to worker)
    w.postMessage(
      { type: 'transcribe', audio, sampleRate, maxAmp, preferredModel },
      [audio.buffer]
    );
  });
}

// Keep the old export name so nothing breaks if anything imports it
export async function initTranscriber() { /* no-op — Worker handles this */ }
