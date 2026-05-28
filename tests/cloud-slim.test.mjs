import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripAudioPaths } from '../packages/cloud-sync/audio-guard.js';
import { slimProjectForCloud } from '../packages/cloud-sync/cloud-slim.js';

test('slimProjectForCloud keeps Quill transcription metadata needed after pull', () => {
  const project = {
    id: 'project-1',
    title: 'Quill Project',
    annotations: [{ id: 'annotation-1' }],
    chapters: [
      {
        id: 'chapter-1',
        title: 'Chapter One',
        plainText: 'Hello world',
        textHtml: '<p>Hello world</p>',
        completed: true,
        audioPath: '/Users/marie/audio/chapter-one.mp3',
        audioFileName: '/Users/marie/audio/chapter-one.mp3',
        alignment: [{ word: 'Hello', start: 0, end: 0.4 }],
        whisperAlignment: [{ word: 'Hello', start: 0, end: 0.4 }],
        whisperWords: [{ word: 'Hello', start: 0, end: 0.4 }],
        whisperTranscript: 'Hello world',
        whisperAudioKey: 'path:/Users/marie/audio/chapter-one.mp3',
        whisperTextHash: 'hash-123',
        whisperMatchedCount: 2,
        whisperManuscriptWordCount: 2,
        whisperMatchQuality: 'good',
        whisperSourceUpdatedAt: '2026-05-27T08:00:00.000Z',
        transcribedAt: '2026-05-27T08:01:00.000Z',
      },
    ],
  };

  const clean = stripAudioPaths(project);
  const slim = slimProjectForCloud(clean);
  const chapter = slim.chapters[0];

  assert.equal(slim.annotations, undefined);
  assert.equal(chapter.audioPath, undefined);
  assert.equal(chapter.audioFileName, 'chapter-one.mp3');
  assert.equal(chapter.alignment, undefined);
  assert.equal(chapter.whisperAlignment, undefined);

  assert.equal(chapter.completed, true);
  assert.deepEqual(chapter.whisperWords, [{ word: 'Hello', start: 0, end: 0.4 }]);
  assert.equal(chapter.whisperTranscript, 'Hello world');
  assert.equal(chapter.whisperAudioKey, 'name:chapter one mp3');
  assert.equal(chapter.whisperTextHash, 'hash-123');
  assert.equal(chapter.whisperMatchedCount, 2);
  assert.equal(chapter.whisperManuscriptWordCount, 2);
  assert.equal(chapter.whisperMatchQuality, 'good');
  assert.equal(chapter.whisperSourceUpdatedAt, '2026-05-27T08:00:00.000Z');
  assert.equal(chapter.transcribedAt, '2026-05-27T08:01:00.000Z');
});
