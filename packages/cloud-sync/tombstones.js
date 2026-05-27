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

// Marie 2026-05-26: store as a list of {id, cloudId} PAIRS so
// clearTombstone({id}) also removes the linked cloudId entry. Old
// shape was a flat Set<string> mixing both — clearing one wouldn't
// touch the other, leaving a half-tombstone that the next pull would
// still match against. See cloud audit Bug 3 ("permanent ghost").
function readPairs(scope) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key(scope));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Migrate legacy: array of bare strings → wrap as { id: s } pairs.
    return arr.map((item) => {
      if (typeof item === 'string') return { id: item, cloudId: null };
      if (item && typeof item === 'object') {
        return { id: item.id ? String(item.id) : null, cloudId: item.cloudId ? String(item.cloudId) : null };
      }
      return null;
    }).filter((p) => p && (p.id || p.cloudId));
  } catch {
    return [];
  }
}

function writePairs(scope, pairs) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key(scope), JSON.stringify(pairs));
  } catch {
    // localStorage may be full / blocked — tombstones are best-effort.
  }
}

// Track the local project id AND the cloud uuid as a LINKED PAIR so
// clearing one side also clears the other. Avoids the "I cleared the
// local id but the cloudId tombstone still filters the re-pulled row"
// ghost.
export function addTombstone(scope, { id, cloudId } = {}) {
  if (!id && !cloudId) return;
  const pairs = readPairs(scope);
  // Don't duplicate: if a pair already matches either side, merge.
  const sid = id ? String(id) : null;
  const scloud = cloudId ? String(cloudId) : null;
  const existingIdx = pairs.findIndex((p) => (sid && p.id === sid) || (scloud && p.cloudId === scloud));
  if (existingIdx >= 0) {
    pairs[existingIdx] = {
      id: sid || pairs[existingIdx].id,
      cloudId: scloud || pairs[existingIdx].cloudId,
    };
  } else {
    pairs.push({ id: sid, cloudId: scloud });
  }
  writePairs(scope, pairs);
}

export function clearTombstone(scope, { id, cloudId } = {}) {
  if (!id && !cloudId) return;
  const sid = id ? String(id) : null;
  const scloud = cloudId ? String(cloudId) : null;
  const pairs = readPairs(scope);
  const kept = pairs.filter((p) => !((sid && p.id === sid) || (scloud && p.cloudId === scloud)));
  if (kept.length !== pairs.length) writePairs(scope, kept);
}

export function loadTombstones(scope) {
  // Back-compat: return a flat Set of all string ids/cloudIds for any
  // legacy callers that still expect Set shape.
  const set = new Set();
  for (const p of readPairs(scope)) {
    if (p.id) set.add(p.id);
    if (p.cloudId) set.add(p.cloudId);
  }
  return set;
}

function projectHitsPairs(pairs, project) {
  if (!project || !pairs?.length) return false;
  const pid = project.id != null ? String(project.id) : null;
  const pcloud = project.cloudId != null ? String(project.cloudId) : null;
  for (const p of pairs) {
    if (pid && p.id === pid) return true;
    if (pcloud && p.cloudId === pcloud) return true;
  }
  return false;
}

export function isTombstoned(scope, project) {
  return projectHitsPairs(readPairs(scope), project);
}

// Filter a cloud list against tombstones AND retry-delete the survivors
// in the background. `deleteFn(supabase, cloudId)` is the cloud delete
// helper for this scope (e.g. deleteProofProject / deleteQuillProject).
// We return only the cloud projects that aren't tombstoned.
export function applyTombstonesToCloudList(scope, cloudList, supabase, deleteFn) {
  const pairs = readPairs(scope);
  if (!pairs.length) return cloudList || [];
  const kept = [];
  for (const p of cloudList || []) {
    if (!projectHitsPairs(pairs, p)) { kept.push(p); continue; }
    // Cloud still has this — re-issue the delete in the background.
    if (supabase && p.cloudId && typeof deleteFn === 'function') {
      Promise.resolve(deleteFn(supabase, p.cloudId)).catch((e) => {
        console.warn(`[cloud-sync:${scope}] tombstone retry-delete failed:`, e?.message || e);
      });
    }
  }
  return kept;
}
