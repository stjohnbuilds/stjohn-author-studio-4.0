// Remembers which audio folder Marie picked for each book, so the phone can
// offer to reload it instead of forgetting every time she reopens the app.
//
// What we store (per user + book), and nothing more:
//   • folderName — for display ("Last folder: X")
//   • fileNames  — the audio filenames that were in it (for the count + so
//                  matching still shows even before a reload)
//   • dirHandle  — a File System Access directory handle, when the browser
//                  supports it (Chrome / Android). IndexedDB can persist
//                  these; on return we re-check permission and re-read the
//                  files. iOS Safari has no such API, so there's no handle
//                  and Marie re-picks (one tap) — we still show her the
//                  remembered folder name + file count.
//
// Audio bytes are NEVER stored — only the name + a handle/pointer. The audio
// still lives only on the phone, exactly like before. (Matches the app rule:
// audio never goes to the cloud; this is on-device IndexedDB anyway.)

'use client';

const DB_NAME = 'stjohn-author-phone-audio-folder-v1';
const STORE_NAME = 'folders';
const AUDIO_FILE_RE = /\.(mp3|m4a|m4b|wav|aac|flac|ogg|opus|aif|aiff)$/i;

function canUseIdb() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

// True only where the browser can re-open a folder for us later (Chrome,
// Android Chrome) — needs a secure context (https). iOS Safari returns false.
export function supportsDirectoryPicker() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

function openDb() {
  if (!canUseIdb()) return Promise.resolve(null);
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

function memKey(userId, audioKey) {
  return `${userId || 'anonymous'}::${audioKey || 'unknown'}`;
}

export async function readAudioFolderMemory(userId, audioKey) {
  if (!audioKey) return null;
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const txn = db.transaction(STORE_NAME, 'readonly');
      const req = txn.objectStore(STORE_NAME).get(memKey(userId, audioKey));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveAudioFolderMemory(userId, audioKey, record) {
  // Require a real user id (mirrors projectCache.js) so two signed-out users
  // on a shared device never share one "anonymous" folder-memory bucket.
  if (!userId || !audioKey) return;
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const txn = db.transaction(STORE_NAME, 'readwrite');
      txn.objectStore(STORE_NAME).put({
        key: memKey(userId, audioKey),
        folderName: record?.folderName || '',
        fileNames: Array.isArray(record?.fileNames) ? record.fileNames.slice(0, 5000) : [],
        // A FileSystemDirectoryHandle is structured-cloneable, so IndexedDB
        // can persist it. Stored as null on browsers without the API.
        dirHandle: record?.dirHandle || null,
        updatedAt: new Date().toISOString(),
      });
      txn.oncomplete = () => resolve();
      txn.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearAudioFolderMemory(userId, audioKey) {
  if (!audioKey) return;
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const txn = db.transaction(STORE_NAME, 'readwrite');
      txn.objectStore(STORE_NAME).delete(memKey(userId, audioKey));
      txn.oncomplete = () => resolve();
      txn.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Pull every audio File out of a directory handle (this folder + a few
// nested levels, in case Marie's audio sits in subfolders).
export async function readAudioFilesFromDirHandle(handle) {
  const files = [];
  if (!handle || typeof handle.values !== 'function') return files;
  async function walk(dir, depth) {
    for await (const entry of dir.values()) {
      if (entry.kind === 'file' && AUDIO_FILE_RE.test(entry.name)) {
        try { files.push(await entry.getFile()); } catch { /* skip unreadable */ }
      } else if (entry.kind === 'directory' && depth < 3) {
        try { await walk(entry, depth + 1); } catch { /* skip */ }
      }
    }
  }
  try { await walk(handle, 0); } catch { /* permission / other */ }
  return files;
}

// Returns 'granted' | 'prompt' | 'denied' | 'unsupported'. When request is
// true it will pop the browser's "allow?" dialog — which needs to be called
// from a user gesture (e.g. a button tap) to actually show.
export async function checkDirHandlePermission(handle, request = false) {
  if (!handle || typeof handle.queryPermission !== 'function') return 'unsupported';
  try {
    const opts = { mode: 'read' };
    let status = await handle.queryPermission(opts);
    if (status !== 'granted' && request && typeof handle.requestPermission === 'function') {
      status = await handle.requestPermission(opts);
    }
    return status;
  } catch {
    return 'denied';
  }
}
