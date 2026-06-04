// Adobe Audition decimal time formatter: M:SS.mmm (e.g. 2:41.199)
// or H:MM:SS.mmm if ≥1h.
//
// Normalize total milliseconds FIRST, then derive H/M/S/ms from that.
// The original shape computed ms via Math.round(fraction * 1000), which
// could return 1000 at second boundaries (seconds=61.9996 gave
// "1:01.1000" instead of "1:02.000"). (Block 6, audit fix
// SAS-AUD-20260602-009.)
//
// Lives here so it's importable from both the React Duet component
// and the regression tests.

export function formatAuditionTime(seconds) {
  if (!Number.isFinite(seconds)) return null;
  if (seconds < 0) return null;
  const totalMs = Math.round(seconds * 1000);
  const wholeSeconds = Math.floor(totalMs / 1000);
  const ms = totalMs - wholeSeconds * 1000;
  const h = Math.floor(wholeSeconds / 3600);
  const m = Math.floor((wholeSeconds % 3600) / 60);
  const s = wholeSeconds % 60;
  const msStr = String(ms).padStart(3, '0');
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${msStr}`;
  return `${m}:${String(s).padStart(2,'0')}.${msStr}`;
}
