// Regression tests for Block 6 (SAS-AUD-20260602-009).
// Audition marker exports must not produce ".1000" milliseconds at
// second boundaries — that's not a valid millisecond value and breaks
// Adobe Audition's import. Carry into the next second instead.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAuditionTime } from '../packages/audio-engine/audition-time.js';

test('rolls 999.6 ms into the next second instead of producing .1000', () => {
  assert.equal(formatAuditionTime(61.9996), '1:02.000');
  assert.equal(formatAuditionTime(59.9996), '1:00.000');
});

test('rolls minute boundary cleanly into hour boundary', () => {
  assert.equal(formatAuditionTime(3599.9996), '1:00:00.000');
});

test('exact whole-second inputs stay clean', () => {
  assert.equal(formatAuditionTime(0), '0:00.000');
  assert.equal(formatAuditionTime(1), '0:01.000');
  assert.equal(formatAuditionTime(60), '1:00.000');
  assert.equal(formatAuditionTime(3600), '1:00:00.000');
});

test('normal mid-second times format correctly', () => {
  assert.equal(formatAuditionTime(2.345), '0:02.345');
  assert.equal(formatAuditionTime(161.199), '2:41.199');
});

test('switches to H:MM:SS.mmm at or above one hour', () => {
  const r = formatAuditionTime(3661.5);
  assert.match(r, /^1:01:01\.500$/);
});

test('returns null for unusable inputs (negative, NaN, Infinity)', () => {
  assert.equal(formatAuditionTime(-5), null);
  assert.equal(formatAuditionTime(NaN), null);
  assert.equal(formatAuditionTime(Infinity), null);
});
