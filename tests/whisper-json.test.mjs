import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseWhisperJsonWords } = require('../packages/audio-engine/whisper-json.cjs');

test('parseWhisperJsonWords matches Script and Sync 3.0 token parsing', () => {
  const words = parseWhisperJsonWords({
    transcription: [
      {
        tokens: [
          { text: ' V', offsets: { from: 1000, to: 1100 } },
          { text: 'ex', offsets: { from: 1100, to: 1250 } },
          { text: ' don', offsets: { from: 1300, to: 1450 } },
          { text: "'", offsets: { from: 1450, to: 1460 } },
          { text: 't', offsets: { from: 1460, to: 1550 } },
          { text: ' want', offsets: { from: 1600, to: 1750 } },
          { text: ' Eb', offsets: { from: 1800, to: 1950 } },
          { text: 'ony', offsets: { from: 1950, to: 2120 } },
        ],
      },
    ],
  });

  assert.deepEqual(words.map((w) => w.word), ['v', 'ex', 'don', "'", 't', 'want', 'eb', 'ony']);
  assert.deepEqual(words.map((w) => w.start), [1, 1.1, 1.3, 1.45, 1.46, 1.6, 1.8, 1.95]);
  assert.deepEqual(words.map((w) => w.end), [1.1, 1.25, 1.45, 1.46, 1.55, 1.75, 1.95, 2.12]);
});

test('parseWhisperJsonWords accepts segments-shaped whisper JSON', () => {
  const words = parseWhisperJsonWords({
    segments: [
      {
        tokens: [
          { text: ' Hel', offsets: { from: 2000, to: 2100 } },
          { text: 'lo', offsets: { from: 2100, to: 2200 } },
          { text: ' world', offsets: { from: 2300, to: 2450 } },
        ],
      },
    ],
  });

  assert.deepEqual(words.map((w) => w.word), ['hel', 'lo', 'world']);
  assert.deepEqual(words.map((w) => w.start), [2, 2.1, 2.3]);
  assert.deepEqual(words.map((w) => w.end), [2.1, 2.2, 2.45]);
});
