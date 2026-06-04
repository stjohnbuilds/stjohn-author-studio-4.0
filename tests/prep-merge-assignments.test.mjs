// Regression tests for Block 5 (SAS-AUD-20260602-005).
// When Prep reruns dialogue detection after a Fix, character / side-
// voice assignments must carry to the new span list BY OCCURRENCE,
// not just by text. Otherwise three identical lines assigned to
// A/B/C all collapse to A.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDialogueAssignmentsByOccurrence } from '../packages/manuscript-engine/merge-dialogue-assignments.js';

test('three identical lines assigned A/B/C come back A/B/C in order', () => {
  const oldSpans = [
    { text: 'Hello.', characterId: 'A' },
    { text: 'Hello.', characterId: 'B' },
    { text: 'Hello.', characterId: 'C' },
  ];
  const newSpans = [
    { text: 'Hello.' },
    { text: 'Hello.' },
    { text: 'Hello.' },
  ];
  const merged = mergeDialogueAssignmentsByOccurrence(oldSpans, newSpans);
  assert.equal(merged[0].characterId, 'A');
  assert.equal(merged[1].characterId, 'B');
  assert.equal(merged[2].characterId, 'C');
});

test('side voices preserved by occurrence too', () => {
  const oldSpans = [
    { text: 'Whisper.', sideVoiceId: 'sv1' },
    { text: 'Whisper.', sideVoiceId: 'sv2' },
  ];
  const newSpans = [
    { text: 'Whisper.' },
    { text: 'Whisper.' },
  ];
  const merged = mergeDialogueAssignmentsByOccurrence(oldSpans, newSpans);
  assert.equal(merged[0].sideVoiceId, 'sv1');
  assert.equal(merged[1].sideVoiceId, 'sv2');
});

test('more new duplicates than old → extras get null (no over-binding)', () => {
  const oldSpans = [
    { text: 'Hi.', characterId: 'A' },
    { text: 'Hi.', characterId: 'B' },
  ];
  const newSpans = [{ text: 'Hi.' }, { text: 'Hi.' }, { text: 'Hi.' }];
  const merged = mergeDialogueAssignmentsByOccurrence(oldSpans, newSpans);
  assert.equal(merged[0].characterId, 'A');
  assert.equal(merged[1].characterId, 'B');
  assert.ok(!merged[2].characterId);
});

test('fewer new than old → first matches, extras dropped (no spill-back)', () => {
  const oldSpans = [
    { text: 'Hi.', characterId: 'A' },
    { text: 'Hi.', characterId: 'B' },
    { text: 'Hi.', characterId: 'C' },
  ];
  const newSpans = [{ text: 'Hi.' }, { text: 'Hi.' }];
  const merged = mergeDialogueAssignmentsByOccurrence(oldSpans, newSpans);
  assert.equal(merged[0].characterId, 'A');
  assert.equal(merged[1].characterId, 'B');
});

test('edited line falls out of the bucket and gets no prior', () => {
  const oldSpans = [
    { text: 'Hi.', characterId: 'A' },
    { text: 'Hi.', characterId: 'B' },
  ];
  const newSpans = [
    { text: 'Hi.' },
    { text: 'Hi, there.' }, // edited — different text
  ];
  const merged = mergeDialogueAssignmentsByOccurrence(oldSpans, newSpans);
  assert.equal(merged[0].characterId, 'A');
  assert.ok(!merged[1].characterId);
});

test('mixed assigned + unassigned duplicates preserve order', () => {
  const oldSpans = [
    { text: 'Hi.', characterId: 'A' },
    { text: 'Hi.' },           // unassigned
    { text: 'Hi.', characterId: 'C' },
  ];
  const newSpans = [{ text: 'Hi.' }, { text: 'Hi.' }, { text: 'Hi.' }];
  const merged = mergeDialogueAssignmentsByOccurrence(oldSpans, newSpans);
  assert.equal(merged[0].characterId, 'A');
  assert.ok(!merged[1].characterId);
  assert.equal(merged[2].characterId, 'C');
});

test('non-duplicate unique lines still match by text', () => {
  const oldSpans = [
    { text: 'Hello.', characterId: 'A' },
    { text: 'World.', characterId: 'B' },
  ];
  const newSpans = [{ text: 'World.' }, { text: 'Hello.' }];
  const merged = mergeDialogueAssignmentsByOccurrence(oldSpans, newSpans);
  assert.equal(merged[0].characterId, 'B');
  assert.equal(merged[1].characterId, 'A');
});

test('empty inputs are safe', () => {
  assert.deepEqual(mergeDialogueAssignmentsByOccurrence([{ text: 'X', characterId: 'A' }], []), []);
  assert.equal(mergeDialogueAssignmentsByOccurrence([], [{ text: 'X' }]).length, 1);
  assert.deepEqual(mergeDialogueAssignmentsByOccurrence(null, null), []);
});
