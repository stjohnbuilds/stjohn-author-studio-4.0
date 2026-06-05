// CSV → Audition marker files.
//
// Output is byte-for-byte identical to what SessionsView.exportAuditionMarkers
// produces for in-app flags: TAB-separated, header
//   Name<TAB>Start<TAB>Duration<TAB>Time Format<TAB>Type<TAB>Description
// and one .txt file per chapter, dropped in a "{title} audition markers" folder.
//
// Pulled per row (only these 4):
//   • Chapter title → which .txt file this marker goes in
//   • Timestamp     → Start time, formatted to M:SS.mmm
//   • Column 7      → Description (engineer-style note)
//   • Column 8      → Name        (the manuscript line / quote)
// The position-based parser already enforces "column names ignored".

import { formatAuditionTime } from '../../packages/audio-engine/audition-time.js';
import { parseFlagCsv } from './csvFlagImport.js';

const HEADER = ['Name', 'Start', 'Duration', 'Time Format', 'Type', 'Description'].join('\t');
const DURATION = '0:00.000';
const TIME_FORMAT = 'decimal';
const CUE_TYPE = 'Cue';

// Sanitize: strip newlines + collapse spaces so tabs/newlines in cell
// content don't break the TSV.
function cleanMarkerField(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

// Filesystem-safe filename — same rules SessionsView uses so the files
// land alongside the in-app exports cleanly. Allows letters / digits /
// space / dash / underscore / parens / dot.
export function markerFileName(label) {
  const base = String(label || 'Chapter').replace(/[^\w \-().]+/g, '_').trim() || 'Chapter';
  return `${base}.txt`;
}

// Build the marker list from the parsed CSV rows. Returns
//   { files, folderName, totalMarkers, skippedNoTimestamp, chapters }.
// `files` is an array of { name, content } ready for
// electron.exportMarkersFolder OR a zip download fallback.
// Accepts either a book title string (backward-compat) OR the full
// book object. When the book object is passed, this MERGES the CSV
// markers with the in-app saved flag markers — one file per chapter
// containing both, sorted by Start time. Duplicates at the same
// timestamp are LEFT IN (Marie 2026-06-04: "if there are duplicates
// in timestamp just leave them"), so the engineer sees both
// perspectives at the same moment.
export function buildMarkerFilesFromCsv(text, bookOrTitle) {
  const isBook = bookOrTitle && typeof bookOrTitle === 'object';
  const bookTitle = isBook ? (bookOrTitle?.title || 'book') : (bookOrTitle || 'book');
  const { rows, skippedNoTimestamp } = parseFlagCsv(text);
  const groups = new Map();
  function groupFor(label) {
    const groupKey = String(label || '').toLowerCase().trim() || 'chapter';
    const existing = groups.get(groupKey);
    if (existing) return existing;
    const fresh = { label, markers: [], csvCount: 0, savedCount: 0 };
    groups.set(groupKey, fresh);
    return fresh;
  }

  // 1) CSV-imported markers — same column-7/8 length-wins rule.
  rows.forEach((row) => {
    const startSeconds = Number(row.ts);
    const start = formatAuditionTime(startSeconds);
    if (!start) return; // ts ≤ 0 already filtered by parser, defence in depth
    const group = groupFor(row.chapterTitle);
    const a = cleanMarkerField(row.colSeven);
    const b = cleanMarkerField(row.colEight);
    let name = '';
    let description = '';
    if (a.length === 0 && b.length === 0) {
      name = `Marker ${group.markers.length + 1}`;
    } else if (a.length === 0) {
      name = b;
    } else if (b.length === 0) {
      name = a;
    } else if (b.length >= a.length) {
      name = b;
      description = a;
    } else {
      name = a;
      description = b;
    }
    group.markers.push({ startSeconds, start, name: name || `Marker ${group.markers.length + 1}`, description, source: 'csv' });
    group.csvCount += 1;
  });

  // 2) Saved in-app flag markers — merged into the same per-chapter
  //    buckets so the engineer gets ONE file per chapter that contains
  //    both sources. Same shape as exportAuditionMarkers builds.
  if (isBook && Array.isArray(bookOrTitle?.chapters)) {
    bookOrTitle.chapters.forEach((chapter) => {
      const group = groupFor(chapter?.title || 'Chapter');
      (chapter.sections || []).forEach((section) => {
        (section.flags || []).forEach((flag) => {
          const startSeconds = Number(flag?.ts);
          const start = formatAuditionTime(startSeconds);
          if (!start) return;
          group.markers.push({
            startSeconds,
            start,
            name: cleanMarkerField(flag?.sentPlain) || `Marker ${group.markers.length + 1}`,
            description: cleanMarkerField(flag?.note),
            source: 'saved',
          });
          group.savedCount += 1;
        });
      });
    });
  }

  // 3) Write per-chapter files. Sort by Start time. Duplicates at the
  //    same timestamp stay in (per Marie's instruction).
  const files = [];
  let csvMarkers = 0;
  let savedMarkers = 0;
  groups.forEach((group) => {
    if (!group.markers.length) return;
    group.markers.sort((m1, m2) => m1.startSeconds - m2.startSeconds);
    const lines = [HEADER];
    group.markers.forEach((m) => {
      lines.push([m.name, m.start, DURATION, TIME_FORMAT, CUE_TYPE, m.description].join('\t'));
    });
    files.push({ name: markerFileName(group.label), content: lines.join('\n') });
    csvMarkers += group.csvCount;
    savedMarkers += group.savedCount;
  });

  const folderBase = cleanMarkerField(bookTitle || 'book') || 'book';
  const folderName = `${folderBase} audition markers`;
  return {
    files,
    folderName,
    totalMarkers: files.reduce((n, f) => n + (f.content.split('\n').length - 1), 0),
    csvMarkers,
    savedMarkers,
    skippedNoTimestamp,
    chapters: files.length,
  };
}
