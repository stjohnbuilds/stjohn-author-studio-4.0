// Local tombstones — remember which projects the user just deleted, so
// the next cloud pull doesn't silently resurrect them.
//
// Symptoms before this: Marie deletes an audiobook, the cloud delete is
// fire-and-forget, the next focus-pull fetches it back, mergeProjectLists
// sees a cloud book that's not in local and adds it. The deleted book
// reappears 10 seconds later. The "sometimes it works" pattern came from
// the race between the cloud delete finishing first vs. the pull.
//
// Fix: when a user deletes, write the project id to a tombstone set in
// localStorage. The pull filters out anything tombstoned. We also retry
// the cloud delete for any tombstoned id that still comes back — so the
// cloud catches up eventually even if the original delete failed.
//
// Scopes: 'proof' and 'quill'. Each scope has its own list.

'use client';

const STORAGE_PREFIX = 'stjohn-cloud-tombstones-v1';

function key(scope) {
  return `${STORAGE_PREFIX}:${scope}`;
}

function readSet(scope) {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(key(scope));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeSet(scope, set) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(scope), JSON.stringify(Array.from(set)));
  } catch {
    // localStorage may be full or blocked in private browsing — tombstones
    // become best-effort in that case.
  }
}

// Track BOTH the local project id AND the cloud uuid for that project,
// because cloud books come back keyed by the cloud uuid which may not
// match the local id 1:1 (esp. if the project was created on another
// device and never had a local id matching). We tombstone whichever we
// can identify.
export function addTombstone(scope, { id, cloudId } = {}) {
  if (!id && !cloudId) return;
  const set = readSet(scope);
  if (id) set.add(String(id));
  if (cloudId) set.add(String(cloudId));
  writeSet(scope, set);
}

export function clearTombstone(scope, { id, cloudId } = {}) {
  const set = readSet(scope);
  let changed = false;
  if (id && set.delete(String(id))) changed = true;
  if (cloudId && set.delete(String(cloudId))) changed = true;
  if (changed) writeSet(scope, set);
}

export function loadTombstones(scope) {
  return readSet(scope);
}

function projectHitsSet(set, project) {
  if (!project || !set?.size) return false;
  if (project.id && set.has(String(project.id))) return true;
  if (project.cloudId && set.has(String(project.cloudId))) return true;
  return false;
}

export function isTombstoned(scope, project) {
  return projectHitsSet(readSet(scope), project);
}

// Filter a cloud list against tombstones AND retry-delete the survivors
// in the background. `deleteFn(supabase, cloudId)` is the cloud delete
// helper for this scope (e.g. deleteProofProject / deleteQuillProject).
// We return only the cloud projects that aren't tombstoned.
export function applyTombstonesToCloudList(scope, cloudList, supabase, deleteFn) {
  const set = readSet(scope);
  if (!set.size) return cloudList || [];
  const kept = [];
  for (const p of cloudList || []) {
    if (!projectHitsSet(set, p)) { kept.push(p); continue; }
    // Cloud still has this — re-issue the delete in the background.
    if (supabase && p.cloudId && typeof deleteFn === 'function') {
      Promise.resolve(deleteFn(supabase, p.cloudId)).catch((e) => {
        console.warn(`[cloud-sync:${scope}] tombstone retry-delete failed:`, e?.message || e);
      });
    }
  }
  return kept;
}
