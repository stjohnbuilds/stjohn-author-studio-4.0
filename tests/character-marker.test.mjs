// Regression: Marie's manuscripts (exported from Vellum) mark each
// scene's POV character with a STANDALONE PARAGRAPH containing only
// the character name, not a heading element. Before the 2026-06-06
// fix, the Audiobook Breakdown popup walker only checked H1-H6, so
// the entire book attributed to "Unsure".
//
// classifyCharacterMarker is the shared per-element decision both
// Proof (tallyCharacterWordCountsDom in SessionsView.js) and Prep
// (analyzePrepChapterByCharacter in PrepManuscriptMode.js) call.
//
// Critical contract: plain P/DIV markers use STRICT equality (after
// normalisation) so a body paragraph that merely mentions the
// character's name is NOT treated as a scene break. Headings keep
// fuzzy substring matching so "Phantom — Day One" still resolves to
// Phantom (the long-standing Word habit).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCharacterMarker,
  fuzzyNameMatches,
  normCharName,
} from '../app/lib/characterMarker.js';

const MAPPING = [{ name: 'Vex' }, { name: 'Vandal' }, { name: 'Crescent' }];

test('plain <p>Vex</p> is a scene marker for Vex', () => {
  const out = classifyCharacterMarker('P', 'Vex', MAPPING);
  assert.deepEqual(out, { isHeading: false, char: 'Vex' });
});

test('plain <p>vex</p> matches case-insensitively', () => {
  const out = classifyCharacterMarker('P', 'vex', MAPPING);
  assert.deepEqual(out, { isHeading: false, char: 'Vex' });
});

test('plain <p>Vex.</p> with trailing period still matches', () => {
  const out = classifyCharacterMarker('P', 'Vex.', MAPPING);
  assert.deepEqual(out, { isHeading: false, char: 'Vex' });
});

test('body paragraph mentioning the character name is NOT a scene marker', () => {
  const out = classifyCharacterMarker('P', 'Vex looked at me with that smirk.', MAPPING);
  assert.equal(out, null);
});

test('body paragraph that contains the name mid-sentence is NOT a scene marker', () => {
  const out = classifyCharacterMarker('P', 'I broke a dozen laws because Vex told me to.', MAPPING);
  assert.equal(out, null);
});

test('<div>Vandal</div> as a scene marker', () => {
  const out = classifyCharacterMarker('DIV', 'Vandal', MAPPING);
  assert.deepEqual(out, { isHeading: false, char: 'Vandal' });
});

test('joined heading "Phantom — Day One" matches Phantom via fuzzy substring', () => {
  const out = classifyCharacterMarker('H2', 'Phantom — Day One', [{ name: 'Phantom' }]);
  assert.deepEqual(out, { isHeading: true, char: 'Phantom' });
});

test('heading "Chapter 9" with no character match is included as a non-character heading', () => {
  // Headings stay in the marker list with char=null so they don't
  // affect the previously-active character (walker treats null-char
  // headings as "skip, keep current attribution").
  const out = classifyCharacterMarker('H1', 'Chapter 9', MAPPING);
  assert.deepEqual(out, { isHeading: true, char: null });
});

test('empty text returns null', () => {
  assert.equal(classifyCharacterMarker('P', '', MAPPING), null);
  assert.equal(classifyCharacterMarker('H1', '', MAPPING), null);
});

test('empty mapping returns null', () => {
  assert.equal(classifyCharacterMarker('P', 'Vex', []), null);
  assert.equal(classifyCharacterMarker('P', 'Vex', null), null);
});

test('non-block tags (SPAN, EM, A) are never scene markers', () => {
  assert.equal(classifyCharacterMarker('SPAN', 'Vex', MAPPING), null);
  assert.equal(classifyCharacterMarker('EM', 'Vex', MAPPING), null);
  assert.equal(classifyCharacterMarker('A', 'Vex', MAPPING), null);
});

test('normCharName strips punctuation and whitespace', () => {
  assert.equal(normCharName('  Vex.  '), 'vex');
  assert.equal(normCharName('VEX!'), 'vex');
  assert.equal(normCharName('Vex—Phantom'), 'vex phantom');
});

test('fuzzyNameMatches is bidirectional substring', () => {
  assert.equal(fuzzyNameMatches('Phantom', 'Phantom — Day One'), true);
  assert.equal(fuzzyNameMatches('Phantom — Day One', 'Phantom'), true);
  assert.equal(fuzzyNameMatches('Chapter 9', 'Phantom'), false);
});
