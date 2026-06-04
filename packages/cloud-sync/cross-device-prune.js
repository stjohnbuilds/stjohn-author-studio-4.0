// Cross-device delete prune helper for Block 2 (audit fix
// SAS-AUD-20260602-013). Given a local list and the just-pulled cloud
// list, drop any local item whose cloudId is missing from the cloud
// list — that item was deleted on another device. Local-only items
// (no cloudId) always survive: they haven't been pushed yet, so cloud
// absence is expected. Re-imports survive too because importBooks
// strips cloudId at the import boundary.
//
// Callers MUST gate this so it only runs when:
//   (a) the user is signed in,
//   (b) local hydration completed, AND
//   (c) the cloud pull actually succeeded (Block 1's strict throws
//       ensure a partial failure never reaches the merge).
//
// Both Proof (app/page.js mergeProofBookLists) and Quill
// (QuillAndInkMode.js mergeProjectLists) use this — same rule.

export function filterLocalForCloudPrune(localItems, cloudItems) {
  const cloudIds = new Set();
  for (const cb of cloudItems || []) {
    if (cb?.cloudId) cloudIds.add(cb.cloudId);
  }
  return (localItems || []).filter((lb) => !lb?.cloudId || cloudIds.has(lb.cloudId));
}
