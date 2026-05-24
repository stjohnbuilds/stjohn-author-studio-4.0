// Smoke test for the ported manuscript-engine (Phase 6 pass 1).
// Run with: node --test tests/manuscript-engine.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDialogueSpansInText,
  detectDialogueSpansInHtml,
  collectDialogueQuoteMarks,
} from '../packages/manuscript-engine/index.js';

test('detectDialogueSpansInText finds straight-quoted dialogue', () => {
  const result = detectDialogueSpansInText('She walked in. "Hello," she said quietly. Then she left.');
  assert.ok(Array.isArray(result.dialogueSpans), 'returns spans array');
  assert.ok(result.dialogueSpans.length >= 1, 'finds at least one span');
  assert.ok(result.dialogueSpans[0].text.includes('Hello'), 'span captures the dialogue text');
  assert.equal(result.totalQuoteMarks, 2, 'counts both quote marks');
  assert.equal(result.quoteMarksEven, true, 'marks are balanced');
});

test('detectDialogueSpansInText finds curly-quoted dialogue', () => {
  const result = detectDialogueSpansInText('He turned and said “I know what you mean.” Then he was gone.');
  assert.ok(result.dialogueSpans.length >= 1, 'finds curly-quote span');
  assert.ok(result.dialogueSpans[0].text.includes('I know'), 'captures the right text');
});

test('detectDialogueSpansInHtml handles paragraph wrappers', () => {
  const result = detectDialogueSpansInHtml('<p>The room was quiet. <em>"Quite a story,"</em> Lucien said.</p>');
  assert.ok(Array.isArray(result.dialogueSpans) || Array.isArray(result), 'returns spans');
  const spans = Array.isArray(result.dialogueSpans) ? result.dialogueSpans : result;
  assert.ok(spans.length >= 1, 'finds dialogue inside HTML');
});

test('collectDialogueQuoteMarks reports quote marks', () => {
  const marks = collectDialogueQuoteMarks('"open and close" but "missing close.');
  assert.ok(Array.isArray(marks), 'returns array of marks');
  assert.ok(marks.length >= 3, 'finds the three quote marks');
});
