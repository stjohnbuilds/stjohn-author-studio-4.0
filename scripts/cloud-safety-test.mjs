// Cloud-safety unit tests for the 3 Proof bug fixes.
import { clearProofPushCache } from '/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/packages/cloud-sync/proof-sync.js';
import { addTombstone, clearTombstone, applyTombstonesToCloudList } from '/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/packages/cloud-sync/tombstones.js';

const results = [];
const pass = (n) => results.push({ n, ok: '✓ PASS' });
const fail = (n, why) => results.push({ n, ok: '❌ FAIL', why });

// Polyfill localStorage for Node
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null,
  };
}

// T1: clearProofPushCache is a function and runs without error
try {
  const r = clearProofPushCache();
  if (r === undefined) pass('T1: clearProofPushCache callable, no return value');
  else fail('T1', `unexpected return ${JSON.stringify(r)}`);
} catch (e) { fail('T1', e.message); }

// T2: tombstone round-trip — add then clear then verify gone
try {
  localStorage.clear();
  addTombstone('proof', { id: 999, cloudId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
  const beforeClear = localStorage.getItem('proof-tombstones-v1') || '';
  if (!beforeClear.includes('999')) { fail('T2', 'tombstone not added'); }
  else {
    clearTombstone('proof', { id: 999 });
    const afterClear = localStorage.getItem('proof-tombstones-v1') || '';
    if (afterClear.includes('999')) fail('T2: clearTombstone removes by id', `still present: ${afterClear}`);
    else pass('T2: addTombstone + clearTombstone round-trip works');
  }
} catch (e) { fail('T2', e.message); }

// T3: tombstone clears by cloudId too
try {
  localStorage.clear();
  addTombstone('proof', { id: 'local-1', cloudId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
  clearTombstone('proof', { cloudId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' });
  const after = localStorage.getItem('proof-tombstones-v1') || '';
  if (after.includes('local-1') || after.includes('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')) fail('T3', `still present: ${after}`);
  else pass('T3: clearTombstone removes by cloudId');
} catch (e) { fail('T3', e.message); }

// T4: tombstones SURVIVE clear of a DIFFERENT id (don't blow away unrelated)
try {
  localStorage.clear();
  addTombstone('proof', { id: 'keep-me', cloudId: 'cccccccc-1111-2222-3333-444444444444' });
  addTombstone('proof', { id: 'remove-me', cloudId: 'dddddddd-1111-2222-3333-444444444444' });
  clearTombstone('proof', { id: 'remove-me' });
  const after = localStorage.getItem('proof-tombstones-v1') || '';
  if (!after.includes('keep-me')) fail('T4', `keep-me was wrongly removed: ${after}`);
  else if (after.includes('remove-me')) fail('T4', `remove-me still present: ${after}`);
  else pass('T4: clearTombstone is targeted, leaves other tombstones alone');
} catch (e) { fail('T4', e.message); }

// T5: applyTombstonesToCloudList filters tombstoned cloudIds from the cloud list
try {
  localStorage.clear();
  addTombstone('proof', { id: 1, cloudId: 'aaaaaaaa-1111-1111-1111-111111111111' });
  const cloudList = [
    { cloudId: 'aaaaaaaa-1111-1111-1111-111111111111', title: 'GHOST (should be filtered)' },
    { cloudId: 'bbbbbbbb-2222-2222-2222-222222222222', title: 'Real book' },
  ];
  const supabase = { from: () => ({ delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }) };
  const filtered = applyTombstonesToCloudList('proof', cloudList, supabase, () => Promise.resolve());
  if (filtered.length === 1 && filtered[0].title === 'Real book') pass('T5: applyTombstonesToCloudList filters the tombstoned cloudId');
  else fail('T5', `got ${filtered.length} items: ${JSON.stringify(filtered.map(f=>f.title))}`);
} catch (e) { fail('T5', e.message); }

// T6: After clearTombstone, the ghost should NO LONGER be filtered
try {
  localStorage.clear();
  addTombstone('proof', { id: 1, cloudId: 'aaaaaaaa-1111-1111-1111-111111111111' });
  clearTombstone('proof', { id: 1 });
  const cloudList = [
    { cloudId: 'aaaaaaaa-1111-1111-1111-111111111111', title: 'Re-created' },
  ];
  const supabase = { from: () => ({ delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }) };
  const filtered = applyTombstonesToCloudList('proof', cloudList, supabase, () => Promise.resolve());
  if (filtered.length === 1) pass('T6: after clearTombstone, re-created project is no longer filtered (ghost gone)');
  else fail('T6', `got ${filtered.length} items`);
} catch (e) { fail('T6', e.message); }

console.log('\n══════════════════════════════════════════════════════════');
console.log('  CLOUD-SAFETY UNIT TESTS — Proof fixes');
console.log('══════════════════════════════════════════════════════════');
for (const r of results) {
  console.log(`  ${r.ok}  ${r.n}`);
  if (r.why) console.log(`         ↳ ${r.why}`);
}
const ps = results.filter(r => r.ok.includes('PASS')).length;
const fs_ = results.filter(r => r.ok.includes('FAIL')).length;
console.log(`\n  Total: ${ps} pass, ${fs_} fail\n`);
process.exit(fs_ ? 1 : 0);
