// IndexedDB project cache — lets the phone show last-known projects
// instantly while the cloud pull spins up. Ported from the v1 Studio
// phone (`local-book-cache.js`).
//
// Keyed by `scope:userId` so signing in as a different account shows
// that account's cache, not the previous one.

'use client';

const DB_NAME = 'stjohn-author-phone-project-cache-v1';
const STORE_NAME = 'projects';

function canUseIndexedDb() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb() {
  if (!canUseIndexedDb()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function cacheKey(scope, userId) {
  return `${scope}:${userId || 'anonymous'}`;
}

export async function readPhoneProjectCache(scope, userId) {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const txn = db.transaction(STORE_NAME, 'readonly');
      const req = txn.objectStore(STORE_NAME).get(cacheKey(scope, userId));
      req.onsuccess = () => {
        const list = req.result?.projects;
        resolve(Array.isArray(list) ? list : []);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function writePhoneProjectCache(scope, userId, projects) {
  const db = await openDb();
  if (!db || !userId) return;
  return new Promise((resolve) => {
    try {
      const txn = db.transaction(STORE_NAME, 'readwrite');
      txn.objectStore(STORE_NAME).put({
        key: cacheKey(scope, userId),
        projects: Array.isArray(projects) ? projects : [],
        updatedAt: new Date().toISOString(),
      });
      txn.oncomplete = () => resolve();
      txn.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
