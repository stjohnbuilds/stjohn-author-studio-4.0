// Audio path guard for any cloud upload.
//
// CLAUDE.md says it three times: audio files NEVER touch Supabase.
// Only the file *name* may travel up (so the phone can match a local
// audio file by name). Anything that looks like a path, blob, or URL
// gets stripped before the payload reaches the network.
//
// NOTE: this only deals with audio bytes/paths. To also trim per-cloud
// duplicate data (flags + whisper alignment that's already in dedicated
// tables), use slimBookForCloud / slimProjectForCloud in `cloud-slim.js`.

const AUDIO_PATH_KEYS = new Set([
  'audioPath',
  'audioPaths',
  'audioUrl',
  'audioBlob',
  'audioDataUrl',
  'audioBuffer',
  'audioBytes',
  'audioBase64',
  'sourceAudioPath',
  'sourceAudioBytes',
  'audio',
]);

// Keys that *do* carry useful filename-only metadata. We keep them.
const AUDIO_FILENAME_KEYS = new Set([
  'audioFileName',
  'audioName',
]);

const AUDIO_EXT_RE = /\.(mp3|m4a|m4b|wav|flac|opus|ogg|aac)(\?|$)/i;

function looksLikeAudioPath(value) {
  if (typeof value !== 'string') return false;
  if (!AUDIO_EXT_RE.test(value)) return false;
  // Allow plain filenames (no separators). Strip anything that looks
  // like a path or URL.
  if (/^[^/\\\\]+$/.test(value)) return false;
  return true;
}

export function stripAudioPaths(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(stripAudioPaths);
  if (typeof value !== 'object') {
    if (looksLikeAudioPath(value)) return '';
    return value;
  }
  // ArrayBuffer / typed array — drop entirely.
  if (value instanceof ArrayBuffer) return undefined;
  if (ArrayBuffer.isView?.(value)) return undefined;

  const next = {};
  for (const [k, v] of Object.entries(value)) {
    if (AUDIO_PATH_KEYS.has(k)) continue;
    if (AUDIO_FILENAME_KEYS.has(k)) {
      // Keep just the base name (no path separators).
      next[k] = typeof v === 'string' ? v.replace(/^.*[\\/]/, '') : v;
      continue;
    }
    const cleaned = stripAudioPaths(v);
    if (cleaned !== undefined) next[k] = cleaned;
  }
  return next;
}
