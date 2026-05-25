// Shared audio engine — pure helpers for mapping audio time to
// manuscript word index and back. Extracted from
// `app/components/ProofingReader.js` (lines 273-388, May 24) so the
// same sync math is available to Quill, Duet, and the phone Script
// mode without copy-pasting it. Marie's mandate: one engine, not
// four copies.
//
// What lives here:
//   buildSyncTable(alignment, minConfidence?)
//     Build a monotonic, outlier-cleaned (audioTime → msWordIdx)
//     lookup table from a Whisper alignment array.
//   getMsIdxAtTime(table, audioTime, fallbackIdx)
//     Binary-search the table for the manuscript word index that
//     should be highlighted at the given audio time.
//   getAudioTimeForMsIdx(table, targetMsIdx)
//     Inverse — given a manuscript word index, return the audio time
//     to seek to. Used for jump-to-word.
//
// These are pure functions — no React state, no DOM. The audio
// element handling (play, pause, scrub, RAF tick loop) lives in the
// mode that owns the audio dock for now; that becomes
// `<AudioDock>` in a follow-up extraction.

// Build a direct (audioTime → msWordIdx) lookup table from whisper
// alignment data. Uses alignment[i].wordObj.start directly — no
// intermediate whisper-word index needed.
export function buildSyncTable(alignment, minConfidence = 0.35) {
  const rows = [];
  (alignment || []).forEach((match, msIdx) => {
    if (!match?.wordObj || !Number.isFinite(match.wordObj.start)) return;
    if ((Number(match.confidence) || 0) < minConfidence) return;
    rows.push({ t: match.wordObj.start, msIdx, conf: match.confidence });
  });
  if (!rows.length) return [];
  rows.sort((a, b) => a.t - b.t);

  // Pass 1: enforce strictly monotonic (time, msIdx).
  const mono = [rows[0]];
  for (let i = 1; i < rows.length; i++) {
    const prev = mono[mono.length - 1];
    const cur = rows[i];
    if (cur.t <= prev.t + 0.01) continue;
    if (cur.msIdx <= prev.msIdx) continue;
    mono.push(cur);
  }

  // Pass 2: remove outlier jumps. Anchors whose local words-per-second
  // is wildly off the overall average are likely false matches.
  if (mono.length < 3) return mono;
  const totalTime = mono[mono.length - 1].t - mono[0].t;
  const totalWords = mono[mono.length - 1].msIdx - mono[0].msIdx;
  const avgWps = totalTime > 0 ? totalWords / totalTime : 3;
  const maxWps = Math.max(avgWps * 3, 10);

  const cleaned = [mono[0]];
  for (let i = 1; i < mono.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    const cur = mono[i];
    const dt = cur.t - prev.t;
    const dw = cur.msIdx - prev.msIdx;
    if (dt > 0.05) {
      const localWps = dw / dt;
      if (localWps > maxWps) continue;
    }
    cleaned.push(cur);
  }
  return cleaned;
}

// Binary search: returns the manuscript word index that should be
// active at the given audio time. Falls back to `fallbackIdx` if
// the table is too small to interpolate.
export function getMsIdxAtTime(syncTable, audioTime, fallbackIdx) {
  const tbl = Array.isArray(syncTable) ? syncTable : [];
  if (tbl.length < 2) return fallbackIdx;
  let lo = 0, hi = tbl.length - 1, left = null, right = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tbl[mid].t <= audioTime) { left = tbl[mid]; lo = mid + 1; }
    else { right = tbl[mid]; hi = mid - 1; }
  }
  if (left && right) {
    const alpha = (audioTime - left.t) / (right.t - left.t);
    return Math.round(left.msIdx + alpha * (right.msIdx - left.msIdx));
  }
  if (left) return left.msIdx;
  if (right) return right.msIdx;
  return fallbackIdx;
}

// Inverse of getMsIdxAtTime — given a manuscript word index, return
// the audio time to seek to. Used for "jump to this word" and for
// computing where the cursor should be when navigating chapters.
export function getAudioTimeForMsIdx(syncTable, targetMsIdx) {
  const tbl = Array.isArray(syncTable) ? syncTable : [];
  const target = Number(targetMsIdx);
  if (!tbl.length || !Number.isFinite(target)) return null;

  let lo = 0;
  let hi = tbl.length - 1;
  let left = null;
  let right = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tbl[mid].msIdx <= target) {
      left = tbl[mid];
      lo = mid + 1;
    } else {
      right = tbl[mid];
      hi = mid - 1;
    }
  }

  if (left && right && right.msIdx > left.msIdx) {
    const alpha = (target - left.msIdx) / (right.msIdx - left.msIdx);
    return left.t + alpha * (right.t - left.t);
  }

  if (!left && tbl.length >= 2) {
    const first = tbl[0];
    const next = tbl[1];
    if (next.msIdx > first.msIdx) {
      const slope = (next.t - first.t) / (next.msIdx - first.msIdx);
      return Math.max(0, first.t - (first.msIdx - target) * slope);
    }
    return Math.max(0, first.t);
  }

  if (!right && tbl.length >= 2) {
    const prev = tbl[tbl.length - 2];
    const last = tbl[tbl.length - 1];
    if (last.msIdx > prev.msIdx) {
      const slope = (last.t - prev.t) / (last.msIdx - prev.msIdx);
      return Math.max(0, last.t + (target - last.msIdx) * slope);
    }
    return Math.max(0, last.t);
  }

  return Math.max(0, Number(left?.t ?? right?.t) || 0);
}
