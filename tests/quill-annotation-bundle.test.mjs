// Regression tests for Block 4 (SAS-AUD-20260602-006).
// Deleting a Quill annotation must sweep up its same-section,
// same-range character markers; deleting a character marker must
// only drop itself (no cascade to peers or the main it accompanies).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idsForAnnotationBundle } from '../packages/quill-engine/annotations.js';

function ann(id, { classId = 'highlight', markerOnly = false, sectionId = 'ch1', wordStart = 5, wordEnd = 8 } = {}) {
  return { id, classId, markerOnly, sectionId, wordStart, wordEnd };
}

test('main annotation drops itself + same-range character markers', () => {
  const main = ann('main1', { classId: 'highlight' });
  const charA = ann('charA', { classId: 'character' });
  const charB = ann('charB', { classId: 'character' });
  const drop = idsForAnnotationBundle(main, [main, charA, charB]);
  assert.equal(drop.size, 3);
  assert.ok(drop.has('main1'));
  assert.ok(drop.has('charA'));
  assert.ok(drop.has('charB'));
});

test('character markers in a different word range are NOT swept', () => {
  const main = ann('main1', { wordStart: 5, wordEnd: 8 });
  const offRange = ann('charOff', { classId: 'character', wordStart: 20, wordEnd: 22 });
  const drop = idsForAnnotationBundle(main, [main, offRange]);
  assert.equal(drop.size, 1);
  assert.ok(!drop.has('charOff'));
});

test('character markers in a different chapter are NOT swept', () => {
  const main = ann('main1', { sectionId: 'ch1' });
  const otherSection = ann('charOther', { classId: 'character', sectionId: 'ch2' });
  const drop = idsForAnnotationBundle(main, [main, otherSection]);
  assert.equal(drop.size, 1);
  assert.ok(!drop.has('charOther'));
});

test('deleting one character marker only drops itself (no peer cascade)', () => {
  const main = ann('main1', { classId: 'highlight' });
  const charA = ann('charA', { classId: 'character' });
  const charB = ann('charB', { classId: 'character' });
  const drop = idsForAnnotationBundle(charA, [main, charA, charB]);
  assert.equal(drop.size, 1);
  assert.ok(drop.has('charA'));
  assert.ok(!drop.has('main1'));
  assert.ok(!drop.has('charB'));
});

test('markerOnly flag is treated like a character marker', () => {
  const main = ann('main1', { classId: 'highlight' });
  const markerOnly = ann('mo1', { classId: 'highlight', markerOnly: true });
  const drop = idsForAnnotationBundle(main, [main, markerOnly]);
  assert.equal(drop.size, 2);
  assert.ok(drop.has('mo1'));
});

test('wordEnd defaults to wordStart for one-word ranges', () => {
  const main = { id: 'main1', classId: 'highlight', sectionId: 'ch1', wordStart: 5 };
  const charSameWord = { id: 'c1', classId: 'character', sectionId: 'ch1', wordStart: 5, wordEnd: 5 };
  const drop = idsForAnnotationBundle(main, [main, charSameWord]);
  assert.equal(drop.size, 2);
  assert.ok(drop.has('c1'));
});

test('null or id-less target returns an empty set', () => {
  assert.equal(idsForAnnotationBundle(null, []).size, 0);
  assert.equal(idsForAnnotationBundle({}, []).size, 0);
});
