// Rule is: every version carries its own emoji in the version badge, so a
// new version can be told apart from the last one at a glance. This check
// fails when the version number moves without a new emoji, or when an emoji
// is reused.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(fs.readFileSync(join(root, 'package.json'), 'utf8')).version;
const markers = JSON.parse(fs.readFileSync(join(root, 'scripts', 'build-markers.json'), 'utf8'));
const inApp = (fs.readFileSync(join(root, 'main.js'), 'utf8').match(/const BUILD_EMOJI = '([^']+)';/) || [])[1];

test('the current version has its own emoji on record', () => {
  assert.ok(markers[version], `scripts/build-markers.json has no emoji for version ${version}`);
});

test('the app shows the emoji recorded for the current version', () => {
  assert.equal(inApp, markers[version], 'BUILD_EMOJI in main.js must match the entry for the current version');
});

test('no two versions share an emoji', () => {
  const used = Object.values(markers);
  assert.equal(new Set(used).size, used.length, 'each version needs an emoji no earlier version used');
});
