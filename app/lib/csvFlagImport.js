// CSV → flag list importer for the Check Errors popup.
//
// Accepts:
//   - The exact CSV the app already exports (Chapter | Audio File |
//     Page | Timestamp | Narrator/Engineer | Type | Misread Quote |
//     Should Say). See SessionsView.js / ProofingReader.js exporters.
//   - Marie's engineer-template spreadsheet which uses the same
//     columns under slightly different labels ("File name" for "Audio
//     File", "Note" for "Misread Quote"). Scans past the project /
//     author / MANUSCRIPT LINK pre-header rows automatically — starts
//     reading data the line AFTER the header row is found.
//
// Returns rows of the same shape the in-app "saved flag" walker uses,
// so the dialog body is identical for both sources.

const REQUIRED_HEADER_TOKEN = 'chapter';

// Column-name aliases. All lower-cased + trimmed for the match.
const COLUMN_ALIASES = {
  chapter:    ['chapter'],
  audio:      ['audio file', 'audio', 'file name', 'filename', 'file'],
  page:       ['page'],
  timestamp:  ['timestamp', 'time', 'time stamp'],
  narrator:   ['narrator/engineer', 'narrator', 'engineer', 'narrator / engineer'],
  type:       ['type'],
  quote:      ['misread quote', 'quote', 'note', 'misread'],
  should:     ['should say', 'should say:', 'correction', 'fix'],
};

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

function normaliseHeader(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findColumnIndices(cells) {
  const indices = {};
  cells.forEach((raw, i) => {
    const norm = normaliseHeader(raw);
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(norm)) {
        if (indices[key] == null) indices[key] = i;
        break;
      }
    }
  });
  return indices;
}

// "01:37" → 97, "1:02:30" → 3750, "" → 0
export function parseTimestampToSeconds(input) {
  const raw = String(input || '').trim();
  if (!raw) return 0;
  const parts = raw.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 1) return Math.max(0, parts[0]);
  if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return 0;
}

// Main entry. Returns { rows, headerLine, skippedLines }.
// `rows` is an array of { chapterTitle, ts, page, narrator, type, quote, should, audioFileHint }.
export function parseFlagCsv(text) {
  const lines = String(text || '').split(/\r?\n/);
  let headerIdx = -1;
  let headerCells = null;
  for (let i = 0; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const norm = cells.map(normaliseHeader);
    if (norm.includes(REQUIRED_HEADER_TOKEN)) {
      // Confirm at least one other recognisable column to avoid a
      // stray "Chapter" cell elsewhere triggering a false header.
      const ix = findColumnIndices(cells);
      if (ix.chapter != null && (ix.timestamp != null || ix.page != null)) {
        headerIdx = i;
        headerCells = cells;
        break;
      }
    }
  }
  if (headerIdx === -1) {
    return { rows: [], headerLine: -1, skippedLines: lines.length, error: 'No header row found. Looking for a row that contains "Chapter" plus "Timestamp" or "Page".' };
  }
  const ix = findColumnIndices(headerCells);
  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    const cells = parseCsvLine(raw);
    const chapterTitle = ix.chapter != null ? cells[ix.chapter] : '';
    if (!chapterTitle) continue;
    rows.push({
      chapterTitle,
      audioFileHint: ix.audio != null ? cells[ix.audio] : '',
      page: ix.page != null ? cells[ix.page] : '',
      ts: parseTimestampToSeconds(ix.timestamp != null ? cells[ix.timestamp] : ''),
      tsRaw: ix.timestamp != null ? cells[ix.timestamp] : '',
      narrator: ix.narrator != null ? cells[ix.narrator] : '',
      type: ix.type != null ? cells[ix.type] : '',
      quote: ix.quote != null ? cells[ix.quote] : '',
      should: ix.should != null ? cells[ix.should] : '',
    });
  }
  return { rows, headerLine: headerIdx, skippedLines: headerIdx };
}
