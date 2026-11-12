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

// ── Replace manuscript ─────────────────────────────────────────────────────
// Rule is: replacing the manuscript keeps every assignment whose line still
// reads the same. These tests run the same pairing and carrying the screen
// runs when a corrected file is brought in.

import { pairPriorChapterSpans } from '../packages/manuscript-engine/merge-dialogue-assignments.js';

function chapter(id, title, spans) {
  return { id, title, sections: [{ id: `${id}-s`, dialogueSpans: spans }] };
}

test('replace: chapters are paired by title and unchanged lines keep their character', () => {
  const oldChapters = [
    chapter('o1', 'Chapter One', [{ text: 'Hi.', characterId: 'A' }, { text: 'Go on.', characterId: 'B', sideVoiceId: 'sv1' }]),
    chapter('o2', 'Chapter Two', [{ text: 'Hi.', characterId: 'C' }]),
  ];
  // The corrected file gained a prologue, so positions no longer line up.
  const newChapters = [
    chapter('n0', 'Prologue', []),
    chapter('n1', 'chapter  one', []),
    chapter('n2', 'Chapter Two', []),
  ];
  const pairs = pairPriorChapterSpans(oldChapters, newChapters);
  assert.equal(pairs.has('n0'), false, 'a brand-new chapter has nothing to carry');

  const rescannedOne = [{ text: 'Hi.' }, { text: 'Go on, then.' }, { text: 'Go on.' }];
  assert.deepEqual(mergeDialogueAssignmentsByOccurrence(pairs.get('n1'), rescannedOne), [
    { text: 'Hi.', characterId: 'A', sideVoiceId: null },
    { text: 'Go on, then.' },
    { text: 'Go on.', characterId: 'B', sideVoiceId: 'sv1' },
  ], 'same text keeps its character and side voice; a reworded line is left for assigning');

  assert.deepEqual(mergeDialogueAssignmentsByOccurrence(pairs.get('n2'), [{ text: 'Hi.' }]), [
    { text: 'Hi.', characterId: 'C', sideVoiceId: null },
  ], 'the same words in another chapter keep that chapter\'s character');
});

test('replace: two chapters with one title pair first with first, second with second', () => {
  const oldChapters = [
    chapter('o1', 'Interlude', [{ text: 'One.', characterId: 'A' }]),
    chapter('o2', 'Interlude', [{ text: 'One.', characterId: 'B' }]),
  ];
  const newChapters = [chapter('n1', 'Interlude', []), chapter('n2', 'Interlude', [])];
  const pairs = pairPriorChapterSpans(oldChapters, newChapters);
  assert.equal(pairs.get('n1')[0].characterId, 'A');
  assert.equal(pairs.get('n2')[0].characterId, 'B');
});

test('replace: renamed chapters fall back to position only when the chapter count is unchanged', () => {
  const oldChapters = [
    chapter('o1', 'One', [{ text: 'A line.', characterId: 'A' }]),
    chapter('o2', 'Two', [{ text: 'B line.', characterId: 'B' }]),
  ];
  const renamed = [chapter('n1', 'One', []), chapter('n2', 'The Second', [])];
  assert.equal(pairPriorChapterSpans(oldChapters, renamed).get('n2')[0].characterId, 'B', 'same count: pair what is left by position');

  const renamedAndAdded = [chapter('n1', 'One', []), chapter('n2', 'The Second', []), chapter('n3', 'Three', [])];
  assert.equal(pairPriorChapterSpans(oldChapters, renamedAndAdded).has('n2'), false, 'different count: position proves nothing, so nothing is guessed');
});
