// Per-project flag queue — survives "I saved a flag while offline" and
// "the cloud delete failed" cases.
//
// The problem this exists to fix:
//   • Phone saves a flag offline → local state has it, cache has it,
//     cloud push fails silently → next refresh pulls cloud (no flag)
//     and REPLACES local. The user-typed flag vanishes.
//   • Phone deletes a flag → local removes it, cache removes it, cloud
//     delete fails → next refresh pulls cloud (still has it) and
//     re-adds it. The "deleted" flag comes back.
//
// Strategy: every save and every delete writes the intent to
// localStorage. When refresh runs it folds the queue back into the
// merged book — pending saves are added on top of cloud, deleted ids
// are filtered out — THEN retries the cloud calls so the next refresh
// stops needing to merge once the cloud has caught up.
//
// Per-tab in-memory single-flight retry guard so the queue can't fire
// duplicate writes during a flurry of refresh calls.

'use client';

const STORAGE_KEY = 'stjohn-cloud-flag-queue-v1';

// Shape in storage:
// {
//   [projectId]: {
//     pending: { [localId]: { sectionId, flag, queuedAt } },
//     deleted: { [localId]: { queuedAt } },
//   }
// }

function readStore() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store || {}));
  } catch {
    // Private browsing may block — the queue degrades to in-memory.
  }
}

function ensureBucket(store, projectId) {
  if (!store[projectId]) store[projectId] = { pending: {}, deleted: {} };
  if (!store[projectId].pending) store[projectId].pending = {};
  if (!store[projectId].deleted) store[projectId].deleted = {};
  return store[projectId];
}

export function recordPendingFlag(projectId, sectionId, flag) {
  if (!projectId || !sectionId || !flag?.id) return;
  const store = readStore();
  const bucket = ensureBucket(store, projectId);
  bucket.pending[String(flag.id)] = {
    sectionId: String(sectionId),
    flag,
    queuedAt: Date.now(),
  };
  // If we delete-then-add the same id, clear the delete intent so the
  // next refresh doesn't undo the new save.
  delete bucket.deleted[String(flag.id)];
  writeStore(store);
}

export function clearPendingFlag(projectId, localId) {
  if (!projectId || !localId) return;
  const store = readStore();
  if (!store[projectId]?.pending) return;
  delete store[projectId].pending[String(localId)];
  writeStore(store);
}

export function recordDeletedFlag(projectId, localId) {
  if (!projectId || !localId) return;
  const store = readStore();
  const bucket = ensureBucket(store, projectId);
  bucket.deleted[String(localId)] = { queuedAt: Date.now() };
  // If we add-then-delete the same id, clear the pending save.
  delete bucket.pending[String(localId)];
  writeStore(store);
}

export function clearDeletedFlag(projectId, localId) {
  if (!projectId || !localId) return;
  const store = readStore();
  if (!store[projectId]?.deleted) return;
  delete store[projectId].deleted[String(localId)];
  writeStore(store);
}

export function loadFlagQueue(projectId) {
  const store = readStore();
  return store[projectId] || { pending: {}, deleted: {} };
}

// Returns true if there's any pending save OR pending delete for a project.
export function hasFlagQueue(projectId) {
  const q = loadFlagQueue(projectId);
  return Object.keys(q.pending).length > 0 || Object.keys(q.deleted).length > 0;
}

// Total count of pending writes (saves + deletes) for a project. Used by
// the phone's persistent "X flags waiting to sync" banner so Marie can
// see when something's stuck.
export function countFlagQueue(projectId) {
  const q = loadFlagQueue(projectId);
  return Object.keys(q.pending || {}).length + Object.keys(q.deleted || {}).length;
}

// Sum the queue counts across every project in storage — for a single
// "X pending across all books" indicator.
export function countAllFlagQueues() {
  const store = readStore();
  let total = 0;
  Object.values(store || {}).forEach((b) => {
    if (!b) return;
    total += Object.keys(b.pending || {}).length;
    total += Object.keys(b.deleted || {}).length;
  });
  return total;
}

// Fold the queue back into a freshly-pulled cloud book:
//   • Pending flags get appended to their section (after the cloud's).
//   • Deleted flag ids get filtered out of every section.
// Identifies flag ids by `flag.id` (the stable local id).
export function applyFlagQueueToBook(projectId, book) {
  if (!book) return book;
  const queue = loadFlagQueue(projectId);
  const pendingBySection = new Map();
  Object.values(queue.pending || {}).forEach((entry) => {
    if (!entry?.sectionId || !entry.flag) return;
    const arr = pendingBySection.get(entry.sectionId) || [];
    arr.push(entry.flag);
    pendingBySection.set(entry.sectionId, arr);
  });
  const deletedIds = new Set(Object.keys(queue.deleted || {}));
  if (!pendingBySection.size && !deletedIds.size) return book;
  return {
    ...book,
    chapters: (book.chapters || []).map((ch) => ({
      ...ch,
      sections: (ch.sections || []).map((sec) => {
        const cloudFlags = sec.flags || [];
        const keptCloud = deletedIds.size
          ? cloudFlags.filter((f) => !deletedIds.has(String(f.id || `${f.idx}:${f.ts}`)))
          : cloudFlags;
        const localPending = pendingBySection.get(sec.id) || [];
        if (!localPending.length) return { ...sec, flags: keptCloud };
        const presentIds = new Set(keptCloud.map((f) => String(f.id || `${f.idx}:${f.ts}`)));
        const extra = localPending.filter((f) => !presentIds.has(String(f.id)));
        return { ...sec, flags: [...keptCloud, ...extra] };
      }),
    })),
  };
}

// Background retry: for every pending save, call upsertFn; for every
// pending delete, call deleteFn. Clear from the queue on success; keep
// on failure for the next attempt. Single-flight per project so a
// flurry of refresh calls doesn't fan out into duplicate writes.
const inFlightByProject = new Set();

export async function retryFlagQueue(projectId, { supabase, ownerId, upsertFn, deleteFn }) {
  if (!projectId || inFlightByProject.has(projectId)) return;
  if (!supabase || !ownerId || !upsertFn || !deleteFn) return;
  const queue = loadFlagQueue(projectId);
  const pendingIds = Object.keys(queue.pending || {});
  const deletedIds = Object.keys(queue.deleted || {});
  if (!pendingIds.length && !deletedIds.length) return;

  inFlightByProject.add(projectId);
  try {
    for (const id of pendingIds) {
      const entry = queue.pending[id];
      if (!entry?.sectionId || !entry.flag) { clearPendingFlag(projectId, id); continue; }
      try {
        await upsertFn(supabase, projectId, entry.sectionId, entry.flag, ownerId);
        clearPendingFlag(projectId, id);
      } catch (e) {
        console.warn('[flag-queue] retry pending failed:', e?.message || e);
        // Leave in queue for next attempt.
      }
    }
    for (const id of deletedIds) {
      try {
        await deleteFn(supabase, projectId, id);
        clearDeletedFlag(projectId, id);
      } catch (e) {
        console.warn('[flag-queue] retry delete failed:', e?.message || e);
      }
    }
  } finally {
    inFlightByProject.delete(projectId);
  }
}
