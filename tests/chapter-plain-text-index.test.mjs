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
