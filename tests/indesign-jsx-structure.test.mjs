// Structural regression tests for the InDesign JSX exporter
// (Block 12 deep-dive findings, 2026-06-04). I cannot run real
// InDesign in CI, but these lock in the contract pieces that, if
// they regressed, would make the script fail to run OR silently
// mis-apply annotations.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInDesignJsx,
  buildWordSpans,
  buildSelectionTextContext,
  createAnnotation,
  resolveAnnotationSelection,
} from '../packages/quill-engine/index.js';

const plainText = [
  'Mara crossed the moonlit hall and touched the silver door.',
  'The repeated promise waited in the dark.',
  'Cassian laughed because the broken crown glittered anyway.',
  'The repeated promise waited in the dark.',
  'He paused (uncertain) before the cliff edge.',
  "Don't go yet [she said].",
].join(' ');

const projectOptions = [
  { id: 'sv-storm', classId: 'emotion', label: 'Storm dread', color: '#7d8fa6' },
  { id: 'ch-mara', classId: 'character', label: 'Mara', color: '#6d6663' },
];

const chapter = {
  id: 'ch1',
  title: 'Chapter 1: The Door',
  chapterNumber: 1,
  plainText,
};

function ann({ classId, optionId, ws, we, note = '' }) {
  const spans = buildWordSpans(plainText);
  const selection = resolveAnnotationSelection({ classId, optionId, projectOptions });
  return createAnnotation({
    selection,
    sectionId: chapter.id,
    sectionTitle: chapter.title,
    chapterNumber: chapter.chapterNumber,
    wordStart: ws,
    wordEnd: we,
    selectedText: spans.slice(ws, we + 1).map((s) => s.word).join(' '),
    textContext: buildSelectionTextContext(plainText, spans, ws, we),
    note,
  });
}

const project = {
  title: 'JSX Structure Probe',
  chapters: [chapter],
  annotationOptions: projectOptions,
  annotations: [
    ann({ classId: 'highlight', ws: 0, we: 2 }),
    ann({ classId: 'character', optionId: 'ch-mara', ws: 0, we: 0 }),
    ann({ classId: 'highlight', ws: 11, we: 16, note: 'dup 1' }),
    ann({ classId: 'highlight', ws: 27, we: 32, note: 'dup 2' }),
    ann({ classId: 'image', optionId: 'image-inline', ws: 18, we: 19 }),
    ann({ classId: 'image', optionId: 'image-full-spread', ws: 35, we: 36 }),
  ],
};

const jsx = buildInDesignJsx(project);

test('ExtendScript compatibility — no ES6+ tokens that the engine cannot parse', () => {
  // ExtendScript is ES3. let/const/arrow/class/async/await/for-of all fail.
  const banned = /(?:^|[^A-Za-z_])(let |const |=> |class |async |await |for \([^)]*\bof\s)/m;
  assert.ok(!banned.test(jsx), 'generated JSX must use only ES3-compatible constructs');
});

test('IIFE wrapper isolates state — no globals leak across reruns', () => {
  // Script must wrap in a (function(){ ... }()) so Marie can run it twice
  // without "already declared" errors.
  assert.match(jsx, /\(function \(\) \{[\s\S]*\}\(\)\);\s*$/);
});

test('Guards: alert + early-return when no document is open', () => {
  assert.match(jsx, /app\.documents\.length === 0/);
  assert.match(jsx, /Open the matching InDesign document/);
});

test('Guards: confirm() before applying — does not silently mutate document', () => {
  assert.match(jsx, /if \(!confirm\(/);
});

test('GREP preferences are cleared before AND after each search', () => {
  // Without clearFind() between searches, a previous findWhat persists
  // and pollutes the next search.
  assert.ok(jsx.split('clearFind()').length >= 5, 'clearFind should be called multiple times');
  assert.match(jsx, /app\.findGrepPreferences = NothingEnum\.NOTHING/);
});

test('GREP escape covers regex metacharacters AND collapses whitespace', () => {
  // Without these, parens / brackets / curly quotes around dialogue
  // would never match, and a paragraph-break in the source vs a single
  // space in InDesign would also miss.
  assert.match(jsx, /\.replace\(\/\[\\\\\^\$\.\*\+\?\(\)\[\\\]\{\}\|\]\/g/);
  assert.match(jsx, /\.replace\(\/\\s\+\/g, "\\\\s\+"\)/);
});

test('Duplicate-text disambiguation uses a used-key map so the same target is not re-applied', () => {
  assert.match(jsx, /var used = \{\}/);
  assert.match(jsx, /if \(used\[key\]\) continue/);
});

test('Image markers get a final defensive style pass', () => {
  // forceAllImageMarkerStyles runs at the end so inserted [INSERT IMG]
  // markers always carry the Image character style regardless of which
  // run inserted them.
  assert.match(jsx, /function forceAllImageMarkerStyles/);
  assert.match(jsx, /forceAllImageMarkerStyles\(\);/);
});

test('Inserted marker shapes are stable', () => {
  // The four marker shapes the InDesign side checks for.
  assert.match(jsx, /INSERT IMG/);
  assert.match(jsx, /INSERT FULL SPREAD/);
  assert.match(jsx, /sanitizeMarkerText\(annotation\.optionLabel \|\| annotation\.label \|\| "CHARACTER"\)/);
  assert.match(jsx, /"E > " \+ emotionLabel/);
});

test('Highlight applies underline (not fill) so the original text colour survives', () => {
  // If a highlight stamped fillColor, black manuscript text would turn
  // pink. The contract: highlight = underline style + preserved fill.
  assert.match(jsx, /annotation\.classId === "highlight"[\s\S]*?underline: true/);
  assert.match(jsx, /originalFillColor = target\.fillColor/);
});

test('Annotations are sorted by chapterNumber, then word start, then id', () => {
  // Stable order matters: highlight + character on the same range must
  // apply highlight first so character marker insert is appended cleanly.
  assert.match(jsx, /Number\(a\.chapterNumber \|\| 0\) - Number\(b\.chapterNumber \|\| 0\)/);
  assert.match(jsx, /Number\(a\.wordStart \|\| 0\) - Number\(b\.wordStart \|\| 0\)/);
});

test('Each placed annotation is tagged with its id for later lookup', () => {
  // insertLabel persists as XMP metadata on the text range — lets a
  // future tool reconcile InDesign output back to Quill annotation ids.
  assert.match(jsx, /insertLabel\("QuillAndInkAnnotationId"/);
});

test('Final alert reports applied / missing / duplicate counts', () => {
  // Marie needs visible feedback when annotations did not land.
  assert.match(jsx, /"Applied: " \+ placed/);
  assert.match(jsx, /"Missing: " \+ missing\.length/);
  assert.match(jsx, /"Duplicate text matches: " \+ ambiguous\.length/);
});

test('Annotation payload carries textContext locator on every annotation', () => {
  // Without textContext, duplicate-phrase resolution falls back to the
  // bare selectedText and picks the first match every time.
  const m = jsx.match(/var lovewornAnnotations = ([\s\S]*?);\n\n  if/);
  assert.ok(m, 'annotation payload must be in the script');
  const parsed = JSON.parse(m[1]);
  for (const a of parsed) {
    assert.ok(a.textContext?.phrase, `annotation ${a.id} missing textContext.phrase`);
    assert.ok(a.textContext?.target, `annotation ${a.id} missing textContext.target`);
  }
});
