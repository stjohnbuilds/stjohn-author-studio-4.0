// Regression tests for Block 3a (SAS-AUD-20260602-016 / -017).
// The path-boundary helpers must refuse every shape of escape attempt
// the audit and verifier found, while still accepting Marie's real
// numeric book ids and normal nested transfer audio paths.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { safeJoinInsideDir } = require('../packages/cloud-sync/path-safety.cjs');

const ROOT = '/test/Save Data/Manuscript Sources';
const TRANSFER_DIR = '/test/transfer-12345';

const ATTACKS = [
  '../../etc/passwd.docx',
  '/etc/passwd.docx',
  'C:\\Windows\\evil.docx',
  '..\\..\\Windows\\evil.docx',
  'file:///etc/passwd',
  'good\0bad.docx',
  '',
  '////',
  '..',
  '.',
  'foo/../../bar.mp3',
  '../../../private/etc/passwd',
];

for (const input of ATTACKS) {
  test(`refuses unsafe input: ${JSON.stringify(input)}`, () => {
    assert.throws(() => safeJoinInsideDir(ROOT, input));
  });
}

const LEGITIMATE_MANUSCRIPT_IDS = [
  '1777428389536.docx',  // Marie's actual id shape (Date.now())
  '1776379753283.docx',
  'abc-def-123.docx',     // uuid-style
  'book_42.docx',         // underscore style
  'ABC.docx',             // short alphanumeric
];

for (const input of LEGITIMATE_MANUSCRIPT_IDS) {
  test(`accepts legitimate manuscript id: ${input}`, () => {
    const resolved = safeJoinInsideDir(ROOT, input);
    assert.equal(typeof resolved, 'string');
    assert.ok(resolved.startsWith(ROOT + '/'), `resolved (${resolved}) must be inside root`);
    assert.ok(resolved.endsWith(input), `resolved must end with the input filename`);
  });
}

test('accepts legitimate nested transfer audio path', () => {
  const resolved = safeJoinInsideDir(TRANSFER_DIR, 'chapter01/section01.mp3');
  assert.ok(resolved.startsWith(TRANSFER_DIR + '/'));
  assert.ok(resolved.endsWith('chapter01/section01.mp3'));
});

test('rejects non-string inputs', () => {
  assert.throws(() => safeJoinInsideDir(ROOT, null));
  assert.throws(() => safeJoinInsideDir(ROOT, undefined));
  assert.throws(() => safeJoinInsideDir(ROOT, 12345));
  assert.throws(() => safeJoinInsideDir(ROOT, {}));
});
