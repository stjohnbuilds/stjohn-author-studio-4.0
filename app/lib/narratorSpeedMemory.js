// Per-narrator playback-speed memory.
//
// Marie's ask (2026-06-04): "If you're on Narrator A and it's set to
// 1.45, then Narrator B at 1.5 — when it goes back to A it returns to
// 1.45." Bake in everywhere audio plays (Proof, Quill, phone).
//
// Storage: localStorage keys like `ap-narrator-speed:Mark` → "1.45".
// One entry per narrator-name. Falls back to a global default
// (1.5) when a narrator has never been set.
//
// Narrator key derivation reuses data the app already has — no new
// fields on book/section. Priority:
//   1. section.narratorName  (set by the parser when an H2 scene
//                              heading matches a known character)
//   2. dominant highlight character → narrator via book.narratorColors
//      (uses tallyCharacterWordCounts on section.html — same data the
//      breakdown popup and Proof's per-word detectNarrator already use)
//   3. 'default'

import { tallyCharacterWordCounts, NARRATOR_KEY as TALLY_NARRATOR_KEY } from '../../packages/manuscript-engine';

const STORAGE_PREFIX = 'ap-narrator-speed:';
export const DEFAULT_NARRATOR_SPEED = 1.5;
const SPEED_MIN = 0.5;
const SPEED_MAX = 4;

export function deriveNarratorKey(section, narratorColors) {
  const explicit = String(section?.narratorName || '').trim();
  if (explicit) return explicit;
  const tally = tallyCharacterWordCounts(section?.html || '', narratorColors);
  if (tally && tally.tallies) {
    let topChar = null;
    let topCount = 0;
    for (const [char, count] of Object.entries(tally.tallies)) {
      if (char === TALLY_NARRATOR_KEY) continue;
      if (count > topCount) { topCount = count; topChar = char; }
    }
    if (topChar) {
      const nc = (narratorColors || []).find((n) => n?.characterName === topChar);
      if (nc?.narratorName) return String(nc.narratorName).trim();
      if (nc?.characterName) return String(nc.characterName).trim();
    }
  }
  return 'default';
}

export function getNarratorSpeed(narratorKey, fallback = DEFAULT_NARRATOR_SPEED) {
  if (typeof window === 'undefined') return fallback;
  const key = STORAGE_PREFIX + (narratorKey || 'default');
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const v = Number(raw);
    if (Number.isFinite(v) && v >= SPEED_MIN && v <= SPEED_MAX) return v;
  } catch {}
  return fallback;
}

export function saveNarratorSpeed(narratorKey, speed) {
  if (typeof window === 'undefined') return;
  if (!Number.isFinite(speed)) return;
  const clamped = Math.max(SPEED_MIN, Math.min(SPEED_MAX, speed));
  const key = STORAGE_PREFIX + (narratorKey || 'default');
  try { window.localStorage.setItem(key, String(clamped)); } catch {}
}
