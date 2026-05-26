// Cloud payload slimmers — strip data that's already stored in
// dedicated tables, so the desktop_book / desktop_project JSONB column
// doesn't carry duplicate copies.
//
// Without this:
//   • Proof's desktop_book holds chapters[].sections[].flags AND each
//     flag is also a row in script_sync_flags. ~25 flags per book today.
//   • Proof's desktop_book holds chapters[].sections[].whisperAlignment
//     AND each section's alignment is a row in
//     script_sync_section_transcriptions. ~1000+ word entries per book
//     once Marie transcribes a whole audiobook.
//   • Quill's desktop_project holds chapters[].alignment AND annotations
//     AND each is in a dedicated table.
//
// The dedicated tables ARE the source of truth on pull (proof-sync /
// quill-sync prefer the table over the embedded copy). Stripping the
// embedded copies from the JSONB before upload halves storage and
// shaves every push round-trip — particularly important once a book
// is fully transcribed.

'use client';

// Fields that live in script_sync_section_transcriptions and should
// never be inside desktop_book.chapters[].sections[].
const SECTION_TRANSCRIPTION_FIELDS = [
  'whisperWords',
  'whisperAlignment',
  'whisperTranscript',
  'whisperAudioKey',
  'whisperTextHash',
  'whisperMatchedCount',
  'whisperManuscriptWordCount',
  'whisperMatchQuality',
  'whisperSourceUpdatedAt',
  'transcribedAt',
];

// Fields that live in script_sync_flags and should never be inside
// desktop_book.chapters[].sections[].
const SECTION_FLAG_FIELDS = ['flags'];

function omit(obj, keys) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  const skip = new Set(keys);
  for (const [k, v] of Object.entries(obj)) {
    if (!skip.has(k)) out[k] = v;
  }
  return out;
}

// Slim a Proof book before it's stored as `desktop_book` JSONB.
// Keeps everything needed to reconstruct the book (title, chapter
// metadata, HTML, narrator colors, etc.) but drops fields that are
// already in dedicated tables.
export function slimBookForCloud(book) {
  if (!book || typeof book !== 'object') return book;
  return {
    ...book,
    chapters: (book.chapters || []).map((chapter) => ({
      ...chapter,
      sections: (chapter.sections || []).map((section) => (
        omit(section, [...SECTION_TRANSCRIPTION_FIELDS, ...SECTION_FLAG_FIELDS])
      )),
    })),
  };
}

// Slim a Quill project before it's stored as `desktop_project` JSONB.
// Keeps chapter HTML / plainText / title but drops alignment arrays
// (the chapters table has them) and the annotations array (annotations
// table has them).
export function slimProjectForCloud(project) {
  if (!project || typeof project !== 'object') return project;
  return {
    ...project,
    annotations: undefined, // annotations table is source of truth
    chapters: (project.chapters || []).map((chapter) => (
      omit(chapter, ['alignment', 'whisperAlignment', 'whisperWords'])
    )),
  };
}

// Approximate JSON byte size — used to log "we just shaved X KB" for
// visibility in DevTools when Marie is testing.
export function approxByteSize(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return 0;
  }
}
