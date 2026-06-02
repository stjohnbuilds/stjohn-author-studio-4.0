// Phone audio matching helpers — ported from the v1 Studio phone
// (`phone-audio-library.js`). Used when Marie picks a folder of audio
// files on her phone: each chapter's `audioFileName` is matched against
// what's in the folder so the right audio loads when she opens that
// chapter. Exact-filename match first; stem match second; loose
// substring third.
//
// Audio files NEVER leave the phone. Only the filename travels (from
// the desktop, where it was set during import) so the matcher knows
// what to look for here.

'use client';

const AUDIO_FILE_PATTERN = /\.(mp3|m4a|m4b|wav|aac|flac|ogg|opus|aif|aiff)$/i;

function basename(value = '') {
  const clean = String(value || '').split(/[?#]/)[0];
  return clean.split(/[\\/]/).filter(Boolean).pop() || clean;
}

export function isAudioFile(file) {
  if (!file) return false;
  return (
    String(file.type || '').startsWith('audio/')
    || AUDIO_FILE_PATTERN.test(file.name || '')
  );
}

export function getAudioFiles(fileList) {
  return Array.from(fileList || []).filter(isAudioFile);
}

export function normalizeAudioName(value = '') {
  return basename(value).trim().toLowerCase();
}

export function audioStem(value = '') {
  return normalizeAudioName(value)
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueLabels(labels = []) {
  const seen = new Set();
  return labels
    .map((label) => String(label || '').trim())
    .filter(Boolean)
    .filter((label) => {
      const key = normalizeAudioName(label) || audioStem(label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// Split a normalized stem into word tokens ("chapter 11" -> ["chapter","11"]).
function stemTokens(value = '') {
  return audioStem(value).split(' ').filter(Boolean);
}

// True if `needle` tokens appear as a CONTIGUOUS run inside `haystack`
// tokens. Whole-token matching — so "chapter 1" does NOT match "chapter 11"
// (the old substring check did, and would auto-attach the wrong file).
function tokenRunContains(haystack, needle) {
  if (!needle.length || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    let hit = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) { hit = false; break; }
    }
    if (hit) return true;
  }
  return false;
}

// Pick one audio file out of `files` whose name (or stem) matches one
// of `labels`. Try strictest match first.
export function pickAudioFile(files = [], labels = []) {
  const audioFiles = files.filter(isAudioFile);
  if (!audioFiles.length) return null;

  const names = uniqueLabels(labels);
  if (!names.length) return audioFiles.length === 1 ? audioFiles[0] : null;

  for (const label of names) {
    const expected = normalizeAudioName(label);
    const exact = audioFiles.find((f) => normalizeAudioName(f.name) === expected);
    if (exact) return exact;
  }

  for (const label of names) {
    const expected = audioStem(label);
    if (!expected) continue;
    const sameStem = audioFiles.find((f) => audioStem(f.name) === expected);
    if (sameStem) return sameStem;
  }

  for (const label of names) {
    const expected = audioStem(label);
    if (expected.length < 5) continue;
    const loose = audioFiles.filter((f) => {
      const stem = audioStem(f.name);
      return stem.length >= 5 && (stem.includes(expected) || expected.includes(stem));
    });
    if (loose.length === 1) return loose[0];
  }

  return null;
}

// How many sections in the book got an audio match?
export function countSectionAudioMatches(files, book) {
  let matched = 0;
  (book?.chapters || []).forEach((ch) => {
    (ch.sections || []).forEach((sec) => {
      const labels = [sec.audioFileName, sec.title, ch.title].filter(Boolean);
      if (pickAudioFile(files, labels)) matched += 1;
    });
  });
  return matched;
}

export function countSectionTotals(book) {
  let total = 0;
  (book?.chapters || []).forEach((ch) => {
    (ch.sections || []).forEach(() => { total += 1; });
  });
  return total;
}
