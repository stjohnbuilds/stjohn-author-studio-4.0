// Drive snapshot orchestrator (Marie 2026-05-27).
//
// Opt-in per Supabase user. The renderer calls runDailySnapshotIfDue
// once after sign-in; it skips silently unless:
//   1) the app is running in Electron,
//   2) backups are enabled for this user id (Settings toggle),
//   3) no snapshot has been taken today on this Mac, and
//   4) Google Drive is detected on this Mac (no local fallback).
//
// On a successful daily snapshot, the user-id's "last run day" is
// recorded in localStorage so the rest of the day stays quiet, and a
// prune is fired to keep the freshest 25 snapshots.

'use client';

import { pullProofProjects, pullQuillProjects } from '../cloud-sync/index.js';

const LAST_RUN_PREFIX = 'stjohn-backup-last-run-v1';
const ENABLED_PREFIX = 'stjohn-backup-enabled-v1';

export const MAX_SNAPSHOTS = 25;

function userKey(prefix, userId) {
  return `${prefix}:${String(userId || 'anon')}`;
}

function todayStamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function safeLocalStorageGet(key) {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function safeLocalStorageSet(key, value) {
  if (typeof window === 'undefined') return;
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, String(value));
  } catch {}
}

export function isBackupEnabledForUser(userId) {
  if (!userId) return false;
  return safeLocalStorageGet(userKey(ENABLED_PREFIX, userId)) === '1';
}

export function setBackupEnabledForUser(userId, enabled) {
  if (!userId) return;
  safeLocalStorageSet(userKey(ENABLED_PREFIX, userId), enabled ? '1' : null);
}

export function getLastSnapshotDayForUser(userId) {
  if (!userId) return null;
  return safeLocalStorageGet(userKey(LAST_RUN_PREFIX, userId));
}

function markLastSnapshotDayForUser(userId) {
  if (!userId) return;
  safeLocalStorageSet(userKey(LAST_RUN_PREFIX, userId), todayStamp());
}

export function needsSnapshotToday(userId) {
  if (!isBackupEnabledForUser(userId)) return false;
  return getLastSnapshotDayForUser(userId) !== todayStamp();
}

async function buildCloudSnapshot(supabase) {
  if (!supabase) return null;
  // Track each source separately so the backup manifest can tell the
  // truth instead of claiming "cloud included" after a swallowed error.
  let proofProjects = [];
  let proofError = null;
  let quillProjects = [];
  let quillError = null;
  const [proofResult, quillResult] = await Promise.allSettled([
    pullProofProjects(supabase),
    pullQuillProjects(supabase),
  ]);
  if (proofResult.status === 'fulfilled') {
    proofProjects = proofResult.value || [];
  } else {
    proofError = proofResult.reason?.message || 'Proof cloud read failed';
  }
  if (quillResult.status === 'fulfilled') {
    quillProjects = quillResult.value || [];
  } else {
    quillError = quillResult.reason?.message || 'Quill cloud read failed';
  }
  const proofOk = proofError === null;
  const quillOk = quillError === null;
  const status = proofOk && quillOk ? 'complete' : 'partial-or-failed';
  return {
    capturedAt: new Date().toISOString(),
    status,
    proof: { status: proofOk ? 'ok' : 'failed', error: proofError, projects: proofProjects },
    quill: { status: quillOk ? 'ok' : 'failed', error: quillError, projects: quillProjects },
    // Legacy fields kept so any older reader of cloud-snapshot.json still
    // sees the projects it expects.
    proofProjects,
    quillProjects,
  };
}

export async function getBackupInfo() {
  if (typeof window === 'undefined' || !window.electron?.getBackupInfo) {
    return { driveDetected: false, drivePath: null, snapshotCount: 0, lastSnapshotAt: null, totalBytes: 0 };
  }
  try {
    return await window.electron.getBackupInfo();
  } catch {
    return { driveDetected: false, drivePath: null, snapshotCount: 0, lastSnapshotAt: null, totalBytes: 0 };
  }
}

// Take a snapshot right now, regardless of "already done today." Used by
// the manual "Snapshot now" button in Settings. Caller is responsible
// for any UX feedback / toast.
export async function takeSnapshotNow({ supabase, userId, userEmail }) {
  if (typeof window === 'undefined' || !window.electron?.makeBackupSnapshot) {
    return { ok: false, error: 'Desktop-only feature.' };
  }
  const cloudSnapshot = await buildCloudSnapshot(supabase).catch(() => null);
  const result = await window.electron.makeBackupSnapshot({
    userId: userId || '',
    userEmail: userEmail || '',
    cloudSnapshot,
  });
  if (result?.ok) {
    if (userId) markLastSnapshotDayForUser(userId);
    try { await window.electron.pruneBackups?.({ keepCount: MAX_SNAPSHOTS }); } catch {}
  }
  return result || { ok: false };
}

// Daily wrapper. Returns either the snapshot result OR { ok: false,
// skipped: true, reason } so the caller can show a quiet status note.
export async function runDailySnapshotIfDue({ supabase, userId, userEmail }) {
  if (typeof window === 'undefined' || !window.electron?.makeBackupSnapshot) {
    return { ok: false, skipped: true, reason: 'Not desktop' };
  }
  if (!userId) return { ok: false, skipped: true, reason: 'No user' };
  if (!isBackupEnabledForUser(userId)) {
    return { ok: false, skipped: true, reason: 'Disabled for this account' };
  }
  if (!needsSnapshotToday(userId)) {
    return { ok: false, skipped: true, reason: 'Already done today' };
  }
  const info = await getBackupInfo();
  if (!info?.driveDetected) {
    return { ok: false, skipped: true, reason: 'Drive not detected' };
  }
  return takeSnapshotNow({ supabase, userId, userEmail });
}
