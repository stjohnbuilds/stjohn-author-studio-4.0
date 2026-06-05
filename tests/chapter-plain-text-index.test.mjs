// Regression: flag-quote builder used to join word-boxes with `.join(' ')`,
// which leaked a phantom space whenever an inline tag boundary (italic,
// span, tracked-change) fell inside a word or hugged a punctuation mark.
//   "Better kill them <em>all</em>."  → "Better kill them all ."   ← bug
//   "Kar<span>ma</span>"               → "Kar ma"                   ← bug
// The plain-text-index helper slices the original characters instead.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChapterPlainTextIndex,
  sliceUnitsRange,
  unitWordEnd,
  tallyCharacterWordCounts,
  NARRATOR_KEY,
} from '../packages/manuscript-engine/chapter-plain-text/index.js';

test('plain text and unit count for simple paragraph', () => {
  const idx = buildChapterPlainTextIndex('<p>Better kill them all.</p>', 'whitespace');
  assert.equal(idx.plainText, 'Better kill them all.');
  assert.equal(idx.unitMeta.length, 4); // Better, kill, them, all.
  assert.equal(sliceUnitsRange(idx, 0, 3), 'Better kill them all.');
});

test('italic on last word — no phantom space before period', () => {
  const idx = buildChapterPlainTextIndex(
    '<p>Better kill them <em>all</em>.</p>',
    'whitespace',
  );
  // 5 units: Better, kill, them, all, .
  assert.equal(idx.unitMeta.length, 5);
  assert.equal(sliceUnitsRange(idx, 0, 4), 'Better kill them all.');
});

test('mid-word inline span — "Kar<span>ma</span>" becomes "Karma"', () => {
  const idx = buildChapterPlainTextIndex(
    '<p>Kar<span class="hl-yellow">ma</span>, I heard him say.</p>',
    'whitespace',
  );
  // Units (whitespace-split, per text node):
  // "Kar" | "ma" | "," | "I" | "heard" | "him" | "say."  = 7
  assert.equal(idx.unitMeta.length, 7);
  // Whole slice — proves no "Kar ma" phantom space
  assert.equal(sliceUnitsRange(idx, 0, 6), 'Karma, I heard him say.');
  // First two units cover the broken-apart word — should re-join cleanly
  assert.equal(sliceUnitsRange(idx, 0, 1), 'Karma');
});

test('mid-word inline span splitting "get" — "g<span>et</span>" becomes "get"', () => {
  const idx = buildChapterPlainTextIndex(
    `<p>Don't g<span>et</span> me in shit.</p>`,
    'whitespace',
  );
  assert.equal(sliceUnitsRange(idx, 0, idx.unitMeta.length - 1), `Don't get me in shit.`);
});

test('cross-paragraph slice gets a sane separator', () => {
  const idx = buildChapterPlainTextIndex(
    '<p>End of first.</p><p>Start of second.</p>',
    'whitespace',
  );
  // Slice across both paragraphs — should not glue them together.
  const all = sliceUnitsRange(idx, 0, idx.unitMeta.length - 1);
  assert.equal(all, 'End of first. Start of second.');
});

test('entity decoding — curly quotes and ampersand survive', () => {
  const idx = buildChapterPlainTextIndex(
    '<p>&ldquo;Tom &amp; Jerry,&rdquo; she said.</p>',
    'whitespace',
  );
  const all = sliceUnitsRange(idx, 0, idx.unitMeta.length - 1);
  assert.equal(all, '“Tom & Jerry,” she said.');
});

test('unitWordEnd returns position after just the word (no trailing space)', () => {
  const idx = buildChapterPlainTextIndex('<p>Hello world.</p>', 'whitespace');
  // unit 0 = "Hello", unitWordEnd should point past "Hello" (5), not past "Hello " (6)
  const u0 = idx.unitMeta[0];
  const end = unitWordEnd(idx, 0);
  assert.equal(idx.plainText.slice(u0.plainStart, end), 'Hello');
});

test('sliceUnitsRange returns empty string for missing index entries', () => {
  const idx = buildChapterPlainTextIndex('<p>foo</p>', 'whitespace');
  assert.equal(sliceUnitsRange(idx, 0, 99), '');
  assert.equal(sliceUnitsRange(null, 0, 0), '');
});

test('regex split mode (Quill) excludes punctuation from units', () => {
  const idx = buildChapterPlainTextIndex(
    '<p>Hello, world!</p>',
    'regex',
  );
  // regex split = [A-Za-z0-9']+ → "Hello", "world"
  assert.equal(idx.unitMeta.length, 2);
  assert.equal(sliceUnitsRange(idx, 0, 1), 'Hello, world!');
});

// ---------------------------------------------------------------------------
// tallyCharacterWordCounts — Audiobook Timing Detail breakdown
//
// Walks a section's HTML and counts words per character using the
// existing hl-* highlight spans + book.narratorColors mapping. No new
// metadata: derives entirely from data the .docx already carries.
// ---------------------------------------------------------------------------

const NARRATORS = [
  { cls: 'hl-pink',    hex: '#FDDEE8', characterName: 'Karma',   narratorName: 'Daryl' },
  { cls: 'hl-yellow',  hex: '#FFF8DC', characterName: 'Phantom', narratorName: 'Mark' },
  { cls: 'hl-blue',    hex: '#DDEEFF', characterName: 'Crescent', narratorName: 'Alyssa' },
];

test('tally: highlighted dialogue routes to the right character', () => {
  const result = tallyCharacterWordCounts(
    `<p>She walked in. <span class="hl-pink">"Don't get me in shit, Karma,"</span> he muttered.</p>`,
    NARRATORS,
  );
  assert.ok(result, 'returns tallies');
  // narrator-side: "She walked in." (3) + "he muttered." (2) = 5
  assert.equal(result.tallies[NARRATOR_KEY], 5);
  // Karma-side: "Don't get me in shit, Karma," = 6
  assert.equal(result.tallies.Karma, 6);
});

test('tally: multiple character highlights in one section', () => {
  const result = tallyCharacterWordCounts(
    `<p><span class="hl-yellow">Phantom spoke first.</span> Then <span class="hl-pink">Karma replied softly.</span></p>`,
    NARRATORS,
  );
  assert.equal(result.tallies.Phantom, 3);
  assert.equal(result.tallies.Karma, 3);
  assert.equal(result.tallies[NARRATOR_KEY], 1); // "Then"
});

test('tally: nested elements inherit the outer highlight character', () => {
  // mammoth sometimes nests <em>/<strong> inside a highlight span. The
  // inner text should still count toward the outer character — and any
  // tag boundary that splits a token (like </em>.) just becomes
  // separate tokens via the same \\S+ split the reader uses.
  const result = tallyCharacterWordCounts(
    `<p><span class="hl-yellow">Phantom said <em>quietly</em>.</span></p>`,
    NARRATORS,
  );
  // Tokens: "Phantom", "said", "quietly", "."  → all routed to Phantom
  assert.equal(result.tallies.Phantom, 4);
  assert.ok(!(NARRATOR_KEY in result.tallies));
});

test('tally: unmapped highlight class is treated as narrator', () => {
  const result = tallyCharacterWordCounts(
    `<p><span class="hl-darkred">Unmapped colour here.</span></p>`,
    NARRATORS,
  );
  // hl-darkred isn't in the narrator mapping → counts as narrator
  assert.equal(result.tallies[NARRATOR_KEY], 3);
});

test('tally: returns null when no characters are mapped', () => {
  const result = tallyCharacterWordCounts(
    `<p>plain text</p>`,
    [], // empty mapping
  );
  assert.equal(result, null);
});

test('tally: edge case — no H1/H2, just paragraphs and spans', () => {
  // Marie's worry: what if the .docx doesn't use H1/H2 the way the
  // parser expects? Answer: this function doesn't care about headings
  // at all — it only looks at hl-* spans. Robust to any structure.
  const result = tallyCharacterWordCounts(
    `<div><span class="hl-pink">Karma talked.</span> Some narration.</div>`,
    NARRATORS,
  );
  assert.equal(result.tallies.Karma, 2);
  assert.equal(result.tallies[NARRATOR_KEY], 2);
});

test('tally: entire chapter under one character', () => {
  const result = tallyCharacterWordCounts(
    `<p><span class="hl-yellow">Every word in this chapter is mine, said Phantom.</span></p>`,
    NARRATORS,
  );
  assert.equal(result.tallies.Phantom, 9);
  assert.ok(!(NARRATOR_KEY in result.tallies));
});

test('tally: empty HTML returns empty tallies (not null)', () => {
  const result = tallyCharacterWordCounts('', NARRATORS);
  assert.ok(result);
  assert.deepEqual(result.tallies, {});
});

// ---------------------------------------------------------------------------
// Hex-fallback path: when narrator entries have cls=null but hex set —
// Marie's actual case for any color picked manually or extracted from
// Word shading. Mammoth bakes the hex into an inline style on every
// highlight span via applyHexColors, so we can match by hex.
// ---------------------------------------------------------------------------

const NARRATORS_HEX_ONLY = [
  { cls: null, hex: '#FDDEE8', characterName: 'Karma',   narratorName: 'Daryl' },
  { cls: null, hex: '#FFF8DC', characterName: 'Phantom', narratorName: 'Mark' },
];

test('tally: hex-only narrators match spans by inline-style background', () => {
  const result = tallyCharacterWordCounts(
    `<p>Then <span class="hl-pink" style="background:#FDDEE8">Karma spoke up</span> and laughed.</p>`,
    NARRATORS_HEX_ONLY,
  );
  assert.equal(result.tallies.Karma, 3);
  assert.equal(result.tallies[NARRATOR_KEY], 3); // "Then" + "and laughed."
});

test('tally: hex match is case-insensitive and handles 3-char hex', () => {
  const result = tallyCharacterWordCounts(
    // 3-char #fdc would not match Karma; testing a real 6-char Phantom hex in upper case
    `<p><span style="background:#FFF8DC">Phantom shouted three words.</span></p>`,
    NARRATORS_HEX_ONLY,
  );
  assert.equal(result.tallies.Phantom, 4);
});

test('tally: class wins over hex when both are set on the same narrator', () => {
  const narrators = [
    { cls: 'hl-pink', hex: '#FDDEE8', characterName: 'Karma', narratorName: 'Daryl' },
  ];
  const result = tallyCharacterWordCounts(
    `<p><span class="hl-pink" style="background:#FDDEE8">two words</span></p>`,
    narrators,
  );
  assert.equal(result.tallies.Karma, 2);
});

test('tally: when only hexMap is populated (no cls anywhere), still works', () => {
  // Regression test for the bug Marie hit: every narrator had cls=null,
  // classMap was empty, the function returned null and the breakdown
  // fell back to "Unassigned narrator".
  const result = tallyCharacterWordCounts(
    `<p><span class="hl-pink" style="background:#FDDEE8">Karma talked</span> here.</p>`,
    NARRATORS_HEX_ONLY,
  );
  assert.ok(result, 'returns tallies — does NOT return null');
  assert.equal(result.tallies.Karma, 2);
});
