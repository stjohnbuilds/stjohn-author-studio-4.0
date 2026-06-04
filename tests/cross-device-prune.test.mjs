// Regression tests for Block 2 (SAS-AUD-20260602-013).
// A successful cloud pull that's missing a previously-known cloudId
// should prune that local item (it was deleted on another device).
// Local-only drafts and re-imports (no cloudId) must always survive.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterLocalForCloudPrune } from '../packages/cloud-sync/cross-device-prune.js';

test('local cloud-owned item still in cloud → kept', () => {
  const local = [{ id: 'b1', cloudId: 'C1', title: 'Kept' }];
  const cloud = [{ id: 'b1', cloudId: 'C1' }];
  const r = filterLocalForCloudPrune(local, cloud);
  assert.equal(r.length, 1);
});

test('local cloud-owned item missing from cloud → pruned (remote-deleted)', () => {
  const local = [
    { id: 'b1', cloudId: 'C1' },
    { id: 'b2', cloudId: 'C2' },
  ];
  const cloud = [{ id: 'b1', cloudId: 'C1' }];
  const r = filterLocalForCloudPrune(local, cloud);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'b1');
});

test('local-only draft (no cloudId) always survives', () => {
  const local = [
    { id: 'b1', title: 'Local draft, never pushed' }, // no cloudId
    { id: 'b2', cloudId: 'C2', title: 'Was synced' },
  ];
  const cloud = []; // cloud has nothing — perhaps fresh account
  const r = filterLocalForCloudPrune(local, cloud);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'b1');
});

test('empty cloud + all synced → all pruned', () => {
  const local = [{ id: 'b1', cloudId: 'C1' }];
  const r = filterLocalForCloudPrune(local, []);
  assert.equal(r.length, 0);
});

test('re-imported book (cloudId stripped at import) survives later prune', () => {
  const local = [{ id: 'b1', title: 'Re-import' }]; // importBooks strips cloudId
  const r = filterLocalForCloudPrune(local, []);
  assert.equal(r.length, 1);
});

test('null/undefined inputs are safe', () => {
  assert.deepEqual(filterLocalForCloudPrune(null, []), []);
  assert.deepEqual(filterLocalForCloudPrune([], null), []);
  assert.deepEqual(filterLocalForCloudPrune(null, null), []);
});

test('item with cloudId but cloud list has a different cloudId is pruned', () => {
  const local = [{ id: 'b1', cloudId: 'C1' }];
  const cloud = [{ id: 'bX', cloudId: 'CX' }];
  assert.equal(filterLocalForCloudPrune(local, cloud).length, 0);
});

test('cloud item with no cloudId does not protect a local item', () => {
  // A cloud entry without a cloudId is malformed — it shouldn't be
  // taken as evidence that any local cloud-owned item still exists.
  const local = [{ id: 'b1', cloudId: 'C1' }];
  const cloud = [{ id: 'b1' }]; // no cloudId on the cloud side
  assert.equal(filterLocalForCloudPrune(local, cloud).length, 0);
});
