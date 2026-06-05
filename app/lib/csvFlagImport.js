// CSV → flag/marker importer for the Check Errors popup and the
// "Make markers from CSV" button.
//
// POSITION-BASED, column names are ignored entirely.
// Marie's instruction (2026-06-04): the columns are always in the same
// order regardless of what the header labels say — even if a column
// were named "grgefkjuhfndjkhnf" the parser should still pull the
// right timestamp.
//
// Column slots (0-indexed) — the order the app's own CSV export and
// Marie's engineer-template spreadsheet both use:
//   0  Chapter title
//   1  Audio file name (informational only)
//   2  Page (informational only)
//   3  Timestamp                ← REQUIRED for a row to count
//   4  Narrator / Engineer
//   5  Type
//   6  "Column seven" — Misread Quote (app) or Note (engineer template)
//   7  "Column eight" — Should Say (app) or Should Say: (engineer template)
//
// A row counts as a data row when it has a non-empty chapter in slot 0
// AND a clock-style timestamp (M:SS or H:MM:SS) in slot 3. Every other
// row — project headers, author lines, "MANUSCRIPT LINK" rows, blank
// rows, "DONE" placeholder rows, rows with no timestamp — is naturally
// skipped.

// Parse one CSV line — handles quoted cells with escaped quotes ("").
export function parseCsvLine(line) {
  const out = [];
  let i = 0;
  let buf = '';
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { buf += '"'; i += 2; continue; }
        inQuotes = false;
        i += 1;
        continue;
      }
      buf += c;
      i += 1;
      continue;
    }
    if (c === '"') { inQuotes = true; i += 1; continue; }
    if (c === ',') { out.push(buf); buf = ''; i += 1; continue; }
    buf += c;
    i += 1;
  }
  out.push(buf);
  return out.map((s) => s.trim());
}

// "01:37" → 97, "1:02:30" → 3750, "" / junk / "DONE" / "#" → 0
export function parseTimestampToSeconds(input) {
  const raw = String(input || '').trim();
  if (!raw) return 0;
  // Must look like a clock time. Reject "DONE", "#", letters, etc.
  if (!/^\d{1,2}(:\d{1,2}){1,2}(\.\d+)?$/.test(raw)) return 0;
  const parts = raw.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return 0;
}

// CSVs sometimes have a multi-line cell (a newline inside a "..."
// quoted cell). A naive split('\n') would chop that cell into two
// rows. We merge follow-up lines back together when an opening
// quote hasn't been closed yet.
function joinMultilineRows(lines) {
  const out = [];
  let buf = '';
  for (const line of lines) {
    const candidate = buf ? buf + '\n' + line : line;
    // Count unescaped quotes — odd = still inside a quoted cell.
    let quoteCount = 0;
    for (let i = 0; i < candidate.length; i += 1) {
      if (candidate[i] === '"') quoteCount += 1;
    }
    if (quoteCount % 2 === 1) {
      buf = candidate;
    } else {
      out.push(candidate);
      buf = '';
    }
  }
  if (buf) out.push(buf);
  return out;
}

// Main entry. Walks every row, keeps only those with a valid chapter
// title in slot 0 AND a parseable timestamp in slot 3. Returns:
//   { rows, totalLinesScanned, skippedNoTimestamp }
// where each row is { chapterTitle, audioFileHint, page, ts, tsRaw,
// narrator, type, colSeven, colEight }.
export function parseFlagCsv(text) {
  const rawLines = String(text || '').split(/\r?\n/);
  const lines = joinMultilineRows(rawLines);
  const rows = [];
  let skippedNoTimestamp = 0;
  let scanned = 0;
  for (const line of lines) {
    if (!line || !line.trim()) continue;
    scanned += 1;
    const cells = parseCsvLine(line);
    if (cells.length < 4) continue;
    const chapterTitle = (cells[0] || '').trim();
    if (!chapterTitle) continue;
    const tsRaw = (cells[3] || '').trim();
    const ts = parseTimestampToSeconds(tsRaw);
    if (ts <= 0) {
      // Only count rows that LOOK like data candidates (have a
      // chapter that mentions "chapter" or starts with a digit).
      // That way the "Chapter" header row + Project/Author/etc.
      // don't get counted as skips.
      // Match data-like row patterns. The literal header row says
      // just "Chapter" (no space, no number), so we require a space-
      // or-number suffix to avoid double-counting it as a skip.
      if (/^(chapter\s|\d+(\s|$))/i.test(chapterTitle)) skippedNoTimestamp += 1;
      continue;
    }
    rows.push({
      chapterTitle,
      audioFileHint: cells[1] || '',
      page: cells[2] || '',
      ts,
      tsRaw,
      narrator: cells[4] || '',
      type: cells[5] || '',
      colSeven: cells[6] || '',
      colEight: cells[7] || '',
    });
  }
  return { rows, totalLinesScanned: scanned, skippedNoTimestamp };
}
