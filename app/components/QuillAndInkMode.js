'use client';

// Quill & Ink mode — port from the alpha at
// /Users/.../StJohn Author Apps/apps/quill-and-ink - ARCHIVED 2026-05-23/
//
// Flow: Home (projects list) → Setup (ImportFlow) → Book detail
// (chapter list, export) → Reader (word-render, drag-to-highlight,
// annotation popover, sidebar list).
//
// Shared chrome: ReaderChrome (HomeBackPill, StickyTopBar, SaveBadge).
// Shared upload: ImportFlow.
// Engine: packages/quill-engine (normalize, annotations, exporters).
//
// Persistence: Electron file system (window.electron.readQuillData /
// writeQuillData), falling back to localStorage when running in the
// browser. Cloud sync to Supabase quill_projects / quill_chapters /
// quill_annotations is a separate task — local first, cloud later.

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ImportFlow from './ImportFlow';
import BookDetail, { ChapterRow } from './BookDetail';
import ProofBookDetail from './SessionsView';
import AppDialog from './AppDialog';
import ChapterReader, {
  getChapterReaderWordEl,
  computeChapterReaderPopoverPos,
} from './ChapterReader';
import AudioDock from './AudioDock';
import { transcribeAudio } from '../lib/transcriptionWorker';
import { alignTranscriptToManuscript } from '../lib/fuzzyMatcher';
// Same per-narrator speed memory as desktop Proof. Quill rarely has
// distinct narrators per chapter, but reusing the helper means the
// stored speed is shared across the whole app — set 1.45 in Proof
// and Quill opens at 1.45 too.
import { getNarratorSpeed, saveNarratorSpeed } from '../lib/narratorSpeedMemory';
import {
  buildSyncTable as buildDirectSyncTable,
  getMsIdxAtTime,
} from '../../packages/audio-engine';
import {
  MODE_TOKENS,
  topBtnStyle,
  useDismissable,
} from './ReaderChrome';
import {
  htmlToPlainText,
  buildWordSpans,
  buildSelectionTextContext,
  BASE_ANNOTATION_CLASSES,
  getAnnotationClassTree,
  createCustomOption,
  resolveAnnotationSelection,
  createAnnotation,
  idsForAnnotationBundle,
  buildAnnotationsCsv,
  buildInDesignJsx,
  buildAnnotationsDocxBlob,
} from '../../packages/quill-engine';
// Source-of-truth plain text + per-word-box positions. Replaces the old
// `htmlToPlainText` path which inserted a space for every inline tag —
// that's why "Kar<span>ma</span>" became "Kar ma" and "<em>all</em>."
// became "all ." in annotation `selectedText` and `textContext`.
import { buildChapterPlainTextIndex, sliceUnitsRange } from '../../packages/manuscript-engine';
import {
  getSupabaseClient,
  pushQuillProject,
  pullQuillProjects,
  deleteQuillProject,
  addTombstone,
  clearTombstone,
  applyTombstonesToCloudList,
  formatCloudErrorMessage,
  filterLocalForCloudPrune,
} from '../../packages/cloud-sync';

const QUILL = MODE_TOKENS.quill;
const STORAGE_KEY = 'quill-projects-v1';
const FOLLOW_LOOKAHEAD_BASE_SEC = 0.045;
const FOLLOW_LOOKAHEAD_MAX_SEC = 0.18;

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function loadProjects() {
  const electron = typeof window !== 'undefined' ? window.electron : null;
  if (electron?.readQuillProjectList) {
    try {
      const list = await electron.readQuillProjectList();
      return Array.isArray(list) ? list : [];
    } catch {}
  }
  if (electron?.readQuillData) {
    try {
      const list = await electron.readQuillData();
      return Array.isArray(list) ? list : [];
    } catch {}
  }
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

async function loadFullProject(projectId) {
  const electron = typeof window !== 'undefined' ? window.electron : null;
  if (electron?.readQuillProject) {
    try {
      const project = await electron.readQuillProject(projectId);
      return project && typeof project === 'object' ? project : null;
    } catch {}
  }
  const projects = await loadProjects();
  return projects.find((project) => project?.id === projectId) || null;
}

async function persistProjects(projects) {
  const electron = typeof window !== 'undefined' ? window.electron : null;
  const hasSummaryOnly = (projects || []).some((project) => project?._summaryOnly);
  if (hasSummaryOnly && electron?.writeQuillProject) {
    const fullProjects = (projects || []).filter((project) => project && !project._summaryOnly);
    await Promise.all(fullProjects.map((project) => electron.writeQuillProject(project)));
    return;
  }
  if (electron?.writeQuillData) {
    try { await electron.writeQuillData(projects); return; } catch {}
  }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
}

function downloadText(filename, content, mime = 'text/plain') {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Same idea as downloadText, but for a ready-made Blob (the Word .docx
// comes out of JSZip as a Blob, not a string).
function downloadBlob(filename, blob) {
  if (typeof document === 'undefined' || !blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileName(value = 'quill-and-ink-project') {
  return String(value || 'project').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'project';
}

function hashText(value) {
  const input = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(36)}`;
}

function getElectronPlatform() {
  return typeof window !== 'undefined' ? window.electron?.platform || null : null;
}

function isPortableStoredAudioPath(storedPath) {
  return typeof storedPath === 'string' && (storedPath.startsWith('gdrive://') || storedPath.startsWith('data://'));
}

function legacyPathMatchesCurrentPlatform(storedPath, platform = getElectronPlatform()) {
  if (typeof storedPath !== 'string' || !storedPath) return false;
  if (isPortableStoredAudioPath(storedPath)) return true;
  if (platform === 'win32') return /^[A-Za-z]:[\\/]/.test(storedPath) || storedPath.startsWith('\\\\');
  if (platform === 'darwin' || platform === 'linux') return storedPath.startsWith('/');
  return true;
}

function getChapterStoredAudioPath(chapter, platform = getElectronPlatform()) {
  if (chapter?.audioPaths && typeof chapter.audioPaths === 'object') {
    const currentPath = chapter.audioPaths[platform];
    return typeof currentPath === 'string' && currentPath ? currentPath : null;
  }
  const legacyPath = chapter?.audioPath;
  return legacyPathMatchesCurrentPlatform(legacyPath, platform) ? legacyPath : null;
}

function chapterAlignment(chapter) {
  if (Array.isArray(chapter?.whisperAlignment)) return chapter.whisperAlignment;
  if (Array.isArray(chapter?.alignment)) return chapter.alignment;
  return [];
}

function transcriptStateFromChapter(chapter) {
  const alignment = chapterAlignment(chapter);
  if (!alignment.length && !chapter?.whisperTranscript && !chapter?.transcribedAt) return null;
  return {
    status: 'done',
    progress: 100,
    alignment,
    words: Array.isArray(chapter?.whisperWords) ? chapter.whisperWords : [],
    transcript: chapter?.whisperTranscript || '',
    syncTable: buildDirectSyncTable(alignment),
  };
}

function transcriptionPatchFromSection(section) {
  if (!section || typeof section !== 'object') return null;
  const alignment = Array.isArray(section.whisperAlignment) ? section.whisperAlignment : [];
  const hasTranscription = alignment.length || section.whisperTranscript || section.transcribedAt;
  if (!hasTranscription) return null;
  return {
    alignment,
    whisperAlignment: alignment,
    whisperWords: Array.isArray(section.whisperWords) ? section.whisperWords : [],
    whisperTranscript: section.whisperTranscript || '',
    whisperMatchedCount: section.whisperMatchedCount ?? null,
    whisperManuscriptWordCount: section.whisperManuscriptWordCount ?? null,
    whisperMatchQuality: section.whisperMatchQuality ?? null,
    whisperAudioKey: section.whisperAudioKey || null,
    whisperTextHash: section.whisperTextHash || null,
    whisperSourceUpdatedAt: section.whisperSourceUpdatedAt || null,
    transcribedAt: section.transcribedAt || new Date().toISOString(),
  };
}

const TRANSCRIPTION_FIELD_KEYS = [
  'alignment',
  'whisperAlignment',
  'whisperWords',
  'whisperTranscript',
  'whisperMatchedCount',
  'whisperManuscriptWordCount',
  'whisperMatchQuality',
  'whisperAudioKey',
  'whisperTextHash',
  'whisperSourceUpdatedAt',
  'transcribedAt',
];

function hasExplicitTranscriptionClear(section) {
  if (!section || typeof section !== 'object') return false;
  return (
    Object.prototype.hasOwnProperty.call(section, 'whisperAlignment') &&
    section.whisperAlignment === undefined &&
    Object.prototype.hasOwnProperty.call(section, 'whisperWords') &&
    section.whisperWords === undefined
  );
}

function withoutTranscriptionFields(chapter) {
  const out = { ...(chapter || {}) };
  TRANSCRIPTION_FIELD_KEYS.forEach((key) => { delete out[key]; });
  return out;
}

function transcriptStateFromSection(section) {
  const patch = transcriptionPatchFromSection(section);
  if (!patch) return null;
  return {
    status: 'done',
    progress: 100,
    alignment: patch.alignment,
    words: patch.whisperWords,
    transcript: patch.whisperTranscript,
    syncTable: buildDirectSyncTable(patch.alignment),
  };
}

function buildTranscriptMap(projects) {
  const out = {};
  for (const project of projects || []) {
    if (project?._summaryOnly) continue;
    for (const chapter of project?.chapters || []) {
      const state = transcriptStateFromChapter(chapter);
      if (state) out[chapter.id] = state;
    }
  }
  return out;
}

async function buildRuntimeState(projects) {
  const rebuiltAudio = {};
  const electron = typeof window !== 'undefined' ? window.electron : null;
  for (const proj of projects || []) {
    if (proj?._summaryOnly) continue;
    for (const ch of proj?.chapters || []) {
      const storedAudioPath = getChapterStoredAudioPath(ch);
      if (storedAudioPath) {
        let url = storedAudioPath;
        if (electron?.getAudioUrl) {
          try { url = await electron.getAudioUrl(storedAudioPath); }
          catch { url = storedAudioPath; }
        }
        rebuiltAudio[ch.id] = {
          fileName: ch.audioFileName || '',
          url,
        };
      }
    }
  }
  return {
    audio: rebuiltAudio,
    transcripts: buildTranscriptMap(projects),
  };
}

function mergeChapterFromCloud(localChapter, cloudChapter) {
  if (!localChapter) return cloudChapter;
  const localAlignment = chapterAlignment(localChapter);
  const cloudAlignment = chapterAlignment(cloudChapter);
  const hasCloudAlignment = cloudAlignment.length > 0 || cloudChapter?.transcribedAt;
  return {
    ...cloudChapter,
    audioFileName: cloudChapter?.audioFileName || localChapter.audioFileName || '',
    audioPath: localChapter.audioPath || '',
    audioPaths: localChapter.audioPaths || null,
    alignment: hasCloudAlignment ? cloudAlignment : localAlignment,
    whisperAlignment: hasCloudAlignment ? cloudAlignment : localAlignment,
    whisperWords: hasCloudAlignment
      ? (Array.isArray(cloudChapter?.whisperWords) ? cloudChapter.whisperWords : [])
      : (Array.isArray(localChapter?.whisperWords) ? localChapter.whisperWords : []),
    whisperTranscript: hasCloudAlignment ? (cloudChapter?.whisperTranscript || '') : (localChapter.whisperTranscript || ''),
    whisperMatchedCount: hasCloudAlignment ? cloudChapter?.whisperMatchedCount : localChapter.whisperMatchedCount,
    whisperManuscriptWordCount: hasCloudAlignment ? cloudChapter?.whisperManuscriptWordCount : localChapter.whisperManuscriptWordCount,
    whisperMatchQuality: hasCloudAlignment ? cloudChapter?.whisperMatchQuality : localChapter.whisperMatchQuality,
    whisperAudioKey: hasCloudAlignment ? cloudChapter?.whisperAudioKey : localChapter.whisperAudioKey,
    whisperTextHash: hasCloudAlignment ? cloudChapter?.whisperTextHash : localChapter.whisperTextHash,
    whisperSourceUpdatedAt: hasCloudAlignment ? cloudChapter?.whisperSourceUpdatedAt : localChapter.whisperSourceUpdatedAt,
    transcribedAt: hasCloudAlignment ? cloudChapter?.transcribedAt : localChapter.transcribedAt,
  };
}

function annotationTime(annotation) {
  const updated = Date.parse(annotation?.updatedAt || '') || 0;
  const created = Date.parse(annotation?.createdAt || '') || 0;
  return Math.max(updated, created, 0);
}

function latestAnnotationTime(project) {
  return Math.max(0, ...((project?.annotations || []).map(annotationTime)));
}

function mergeAnnotationsPreservingNewerLocal(localAnnotations = [], cloudAnnotations = []) {
  const byId = new Map();
  for (const annotation of [...cloudAnnotations, ...localAnnotations]) {
    if (!annotation || typeof annotation !== 'object') continue;
    const id = annotation.id || `${annotation.sectionId || ''}:${annotation.wordStart || 0}:${annotation.wordEnd || 0}:${annotation.label || ''}:${annotation.selectedText || ''}`;
    const existing = byId.get(id);
    if (!existing || annotationTime(annotation) >= annotationTime(existing)) {
      byId.set(id, annotation);
    }
  }
  return Array.from(byId.values()).sort((a, b) => annotationTime(a) - annotationTime(b));
}

function mergeProjectLists(local, cloud, { pruneRemoteDeleted = false } = {}) {
  let workingLocal = local || [];
  if (pruneRemoteDeleted) {
    // Cross-device delete prune (shared with Proof) — see
    // packages/cloud-sync/cross-device-prune.js for the rule.
    workingLocal = filterLocalForCloudPrune(workingLocal, cloud);
  }
  const byId = new Map();
  for (const p of workingLocal) byId.set(p.id, p);
  for (const p of cloud) {
    const existing = byId.get(p.id);
    if (!existing) { byId.set(p.id, p); continue; }
    const newer = new Date(p.updatedAt || 0) > new Date(existing.updatedAt || 0);
    if (!newer) {
      byId.set(p.id, { ...existing, cloudId: p.cloudId || existing.cloudId });
      continue;
    }
    const localChapterById = new Map((existing.chapters || []).map((ch) => [ch.id, ch]));
    const localHasNewerAnnotations = latestAnnotationTime(existing) > latestAnnotationTime(p);
    byId.set(p.id, {
      ...p,
      annotations: localHasNewerAnnotations
        ? mergeAnnotationsPreservingNewerLocal(existing.annotations || [], p.annotations || [])
        : (p.annotations || []),
      chapters: (p.chapters || []).map((ch) => mergeChapterFromCloud(localChapterById.get(ch.id), ch)),
    });
  }
  return Array.from(byId.values());
}

// Geometry helpers (word-element lookup, popover placement) live in
// ChapterReader now — imported as getChapterReaderWordEl /
// computeChapterReaderPopoverPos at the top of this file. The
// action-button position is owned by ChapterReader itself.

// ===========================================================================
// Root
// ===========================================================================

export default function QuillAndInkMode({ modeToggle, usesCustomDragRegion }) {
  const [allProjects, setAllProjects] = useState([]);
  const [view, setView] = useState('home'); // home | setup | bookDetail | reader
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  // Per-chapter audio attachments. Lives in memory only (blob URLs don't
  // survive reload). Key = chapterId; value = { url, fileName, file }.
  // Marie's rule: audio NEVER touches Supabase. Stays on this device.
  const [chapterAudios, setChapterAudios] = useState({});
  // Per-chapter transcription state — alignment from whisper, sync table
  // for audio↔word mapping, progress UI. { alignment, syncTable, progress, status }
  const [chapterTranscripts, setChapterTranscripts] = useState({});
  // Surface cloud-pull failures so Quill matches Proof's "Cloud sync
  // failed: …" banner instead of being silent in the console.
  const [cloudPullError, setCloudPullError] = useState('');

  // Run whisper transcription for a single chapter. Same path Proof uses
  // (transcribeAudio → alignTranscriptToManuscript → buildSyncTable).
  // Extracted so onTranscribe and onTranscribeAll both call it.
  const runTranscribe = useCallback(async (chapterId, audios, project) => {
    const audio = audios?.[chapterId];
    if (!audio?.file) return;
    const chapter = (project?.chapters || []).find(c => c.id === chapterId);
    if (!chapter) return;
    setChapterTranscripts((prev) => ({ ...prev, [chapterId]: { status: 'running', progress: 0 } }));
    try {
      const result = await transcribeAudio(audio.file, (p) => {
        setChapterTranscripts((prev) => ({ ...prev, [chapterId]: { ...(prev[chapterId] || {}), status: 'running', progress: p?.progress || 0, message: p?.message || '' } }));
      });
      const manuscriptText = chapter.plainText || htmlToPlainText(chapter.textHtml || '');
      const msWords = buildWordSpans(manuscriptText).map((span) => span.word);
      const whisperWords = result?.words || [];
      const alignment = alignTranscriptToManuscript(msWords, whisperWords);
      const syncTable = buildDirectSyncTable(alignment);
      setChapterTranscripts((prev) => ({ ...prev, [chapterId]: { status: 'done', progress: 100, alignment, syncTable } }));

      // Marie 2026-05-26 CRITICAL FIX — the "transcription tick disappears
      // after 0.5 seconds" bug had two parts:
      //   (1) runTranscribe only updated in-memory chapterTranscripts.
      //       Never wrote alignment into `allProjects`. So nothing
      //       persisted to disk or cloud, and any re-render that
      //       re-derived state from the project lost the tick.
      //   (2) SessionsView's tick check (`isChapterTranscriptionCurrent`)
      //       requires whisperAudioKey in `path:<storedAudioPath>` or
      //       `name:<normText(fileName)>` format AND whisperTextHash =
      //       hashText(section.html). If they don't match, the tick
      //       silently flips back to "not current" within one render.
      //       The previous version of this fix saved a raw filename
      //       (no prefix) — the format mismatch is what wiped the tick.
      const transcribedAt = new Date().toISOString();
      const whisperTranscript = result?.transcript || whisperWords.map((w) => w?.word || w?.text || '').join(' ').trim();
      // Match SessionsView.getSectionAudioKey exactly so the tick check
      // doesn't reject our saved transcription as stale.
      const storedAudioPath = chapter?.audioPaths
        ? (Object.values(chapter.audioPaths).find((v) => typeof v === 'string' && v) || '')
        : (chapter?.audioPath || '');
      const audioName = String(audio?.fileName || chapter?.audioFileName || '');
      const normalizedName = audioName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const whisperAudioKey = storedAudioPath
        ? `path:${storedAudioPath}`
        : (normalizedName ? `name:${normalizedName}` : '');
      const whisperTextHash = hashText(chapter?.textHtml || chapter?.html || '');
      setAllProjects((all) => all.map((p) => {
        if (p.id !== project.id) return p;
        return {
          ...p,
          updatedAt: new Date().toISOString(),
          chapters: (p.chapters || []).map((ch) => {
            if (ch.id !== chapterId) return ch;
            return {
              ...ch,
              // Mirror — quill-sync.js's getChapterAlignment reads either.
              alignment,
              whisperAlignment: alignment,
              whisperWords,
              whisperTranscript,
              whisperAudioKey,
              whisperTextHash,
              whisperSourceUpdatedAt: transcribedAt,
              transcribedAt,
            };
          }),
        };
      }));
    } catch (err) {
      setChapterTranscripts((prev) => ({ ...prev, [chapterId]: { status: 'error', progress: 0, error: String(err?.message || err) } }));
    }
  }, []);
  const saveTimerRef = useRef(null);
  const savedFlashRef = useRef(null);
  // True for state changes that came from the cloud (initial hydrate
  // + post-save cloudId backfill) — skips the cloud push side of the
  // persist effect to avoid echo-loops.
  const cameFromCloudRef = useRef(false);
  // Mirror of `hydrated` state for the cloud-pull closure to read
  // synchronously. Cross-device delete pruning waits for this so a
  // cloud pull racing the local load can't briefly look like
  // "everything was deleted."
  const hydratedRef = useRef(false);

  // hydrate — local first, render immediately, cloud merges in the
  // background. Previously `setHydrated(true)` lived in a `finally`
  // that waited for the cloud pull to finish, so the user saw a blank
  // screen for as long as Supabase took to respond. With N projects
  // and a slow connection this was the "Quill takes forever to load"
  // bug Marie reported.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await loadProjects();
      if (cancelled) return;
      setAllProjects(local);
      // Rebuild the in-memory audio map from each chapter's persisted
      // audioPath, so a full app restart still plays attached audio
      // without Marie re-picking the file. Audio paths only persist on
      // disk (audio-guard strips them before any cloud push), so we
      // only ever rebuild from local-loaded projects.
      const rebuiltRuntime = await buildRuntimeState(local);
      if (Object.keys(rebuiltRuntime.audio).length) setChapterAudios(rebuiltRuntime.audio);
      if (Object.keys(rebuiltRuntime.transcripts).length) setChapterTranscripts(rebuiltRuntime.transcripts);
      setHydrated(true);                     // ← render now, don't wait for cloud
      hydratedRef.current = true;            // unblock cross-device delete prune
      cameFromCloudRef.current = true;       // suppress the first persist round-trip
      const supabase = getSupabaseClient();
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session?.user) return;
        const rawCloudProjects = await pullQuillProjects(supabase);
        if (cancelled) return;
        // Successful pull (even empty) clears any prior error banner.
        setCloudPullError('');
        // Drop anything the user has tombstoned, and re-issue cloud
        // delete for ids that came back. This is what fixes Marie's
        // "delete doesn't really stick" bug.
        const cloudProjects = applyTombstonesToCloudList('quill', rawCloudProjects, supabase, deleteQuillProject);
        // Always merge — even an empty cloud list — so cross-device
        // remote-delete prunes local cloud-owned projects. Block 1's
        // strict error checks mean we only reach here on a successful
        // pull, so an empty cloudProjects here genuinely means "cloud
        // has none." Prune only when local hydration completed.
        cameFromCloudRef.current = true;     // the merge isn't a user edit
        setAllProjects((current) => mergeProjectLists(current, cloudProjects, {
          pruneRemoteDeleted: hydratedRef.current,
        }));
      } catch (e) {
        const msg = formatCloudErrorMessage(e);
        console.warn('[Quill] cloud pull failed:', msg);
        if (!cancelled) setCloudPullError(msg);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // persist on change. Local save is awaited (gates the "Saved" badge);
  // cloud push fires-and-forgets in parallel with Promise.all so a save
  // with N projects no longer waits for N × ~4 sequential Supabase
  // round-trips. Local-only hydrate-time changes skip the cloud push
  // entirely so we don't echo every cloud pull back as a write.
  useEffect(() => {
    if (!hydrated) return;
    if (cameFromCloudRef.current) {
      cameFromCloudRef.current = false;
      persistProjects(allProjects).catch(() => {});
      return;
    }
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await persistProjects(allProjects);
        setSaveStatus('saved');
        if (savedFlashRef.current) clearTimeout(savedFlashRef.current);
        savedFlashRef.current = setTimeout(() => setSaveStatus('idle'), 1400);
        const supabase = getSupabaseClient();
        if (!supabase) return;
        // Background cloud push — does not block the saved badge.
        (async () => {
          try {
            const { data } = await supabase.auth.getSession();
            const ownerId = data?.session?.user?.id;
            if (!ownerId) return;
            const pushableProjects = allProjects.filter((p) => p && !p._summaryOnly);
            if (!pushableProjects.length) return;
            const results = await Promise.all(pushableProjects.map(async (p) => {
              try {
                const cloudId = await pushQuillProject(supabase, p, ownerId);
                return cloudId && cloudId !== p.cloudId ? { projectId: p.id, cloudId } : null;
              } catch (e) {
                console.warn('[Quill] cloud push failed for', p.title, formatCloudErrorMessage(e));
                return null;
              }
            }));
            const updates = results.filter(Boolean);
            if (updates.length) {
              cameFromCloudRef.current = true;
              setAllProjects((all) => all.map((p) => {
                const u = updates.find((x) => x.projectId === p.id);
                return u ? { ...p, cloudId: u.cloudId } : p;
              }));
            }
          } catch {}
        })();
      } catch {
        setSaveStatus('idle');
      }
    }, 350);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [allProjects, hydrated]);

  const activeProject = useMemo(
    () => allProjects.find((p) => p.id === activeProjectId) || null,
    [allProjects, activeProjectId]
  );
  const activeChapter = useMemo(
    () => activeProject?.chapters?.find((c) => c.id === activeChapterId) || null,
    [activeProject, activeChapterId]
  );

  const updateActive = useCallback((patcher) => {
    setAllProjects((all) => all.map((p) => {
      if (p.id !== activeProjectId) return p;
      const next = typeof patcher === 'function' ? patcher(p) : patcher;
      return { ...next, updatedAt: new Date().toISOString() };
    }));
  }, [activeProjectId]);

  const openProject = useCallback(async (project) => {
    if (!project?.id) return;
    let fullProject = project;
    if (project._summaryOnly) {
      const loadedProject = await loadFullProject(project.id);
      if (loadedProject) {
        fullProject = loadedProject;
        setAllProjects((all) => all.map((p) => (p.id === loadedProject.id ? loadedProject : p)));
        const rebuiltRuntime = await buildRuntimeState([loadedProject]);
        if (Object.keys(rebuiltRuntime.audio).length) {
          setChapterAudios((prev) => ({ ...prev, ...rebuiltRuntime.audio }));
        }
        if (Object.keys(rebuiltRuntime.transcripts).length) {
          setChapterTranscripts((prev) => ({ ...prev, ...rebuiltRuntime.transcripts }));
        }
      }
    }
    setActiveProjectId(fullProject.id);
    setActiveChapterId(fullProject.chapters?.[0]?.id || null);
    setView('bookDetail');
  }, []);

  function commitImport(payload) {
    const chapters = (payload.chapters || []).map((ch, i) => ({
      id: uid('ch'),
      chapterNumber: ch.chapterNumber || i + 1,
      title: ch.title || `Chapter ${i + 1}`,
      textHtml: ch.html || '',
      plainText: htmlToPlainText(ch.html || ''),
    }));
    const project = {
      id: uid('quill'),
      title: payload.title || 'Untitled',
      fileName: payload.fileName || '',
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chapters,
      annotations: [],
      annotationOptions: [],
      // Marie 2026-05-26: PDF page map from auto-scan during import.
      pdfPaging: payload.pdfPaging || null,
      pdfFileName: payload.pdfFileName || '',
      pdfSource: payload.pdfSource || null, // 'user-pdf' | 'libreoffice' | null
      pageNumberAdjustment: Number(payload.pageNumberAdjustment) || 0,
    };
    try { clearTombstone('quill', { id: project.id, cloudId: project.cloudId }); } catch {}
    setAllProjects((all) => [...all, project]);
    setActiveProjectId(project.id);
    setActiveChapterId(chapters[0]?.id || null);
    setView('bookDetail');
  }

  function deleteProject(id) {
    const target = allProjects.find((p) => p.id === id);
    // Tombstone first so a racing pull can't resurrect the project.
    addTombstone('quill', { id, cloudId: target?.cloudId });
    setAllProjects((all) => all.filter((p) => p.id !== id));
    const electron = typeof window !== 'undefined' ? window.electron : null;
    if (electron?.deleteQuillProjectData) {
      electron.deleteQuillProjectData(id).catch(() => {});
    }
    if (activeProjectId === id) {
      setActiveProjectId(null);
      setActiveChapterId(null);
      setView('home');
    }
    // Cloud delete is fire-and-forget. If it fails, the tombstone
    // retry-delete on the next pull will catch the cloud up.
    if (target?.cloudId) {
      const supabase = getSupabaseClient();
      if (supabase) {
        deleteQuillProject(supabase, target.cloudId).catch((e) =>
          console.warn('[Quill] cloud delete failed:', formatCloudErrorMessage(e)));
      }
    }
  }

  // ----- export from book detail -----
  // Marie 2026-05-29: "Export all" bundles Word + CSV + InDesign into ONE
  // .zip download. A single file is guaranteed to contain all three — no
  // risk of back-to-back downloads dropping one (the old "CSV + InDesign"
  // button only ever saved the CSV). CSV + InDesign always go in; the Word
  // doc is added too, but if it ever fails to build the zip still ships
  // with the other two rather than failing the whole export.
  async function exportAll() {
    if (!activeProject) return;
    const safe = safeFileName(activeProject.title);
    try {
      const mod = await import('jszip');
      const JSZip = mod.default || mod;
      const zip = new JSZip();
      try {
        const docxBlob = await buildAnnotationsDocxBlob(activeProject);
        zip.file(`${safe}-annotated-review.docx`, docxBlob);
      } catch (e) {
        console.warn('[Quill] Word doc failed; zip will still hold CSV + InDesign:', e);
      }
      zip.file(`${safe}-annotations.csv`, buildAnnotationsCsv(activeProject));
      zip.file(`${safe}-indesign.jsx`, buildInDesignJsx(activeProject));
      const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
      downloadBlob(`${safe} - Quill Export.zip`, blob);
    } catch (e) {
      console.warn('[Quill] bundle export failed:', e);
      alert('Sorry — the bundle export hit a snag. The individual Word / CSV / InDesign buttons still work.');
    }
  }
  function exportCsv() {
    if (!activeProject) return;
    downloadText(`${safeFileName(activeProject.title)}-annotations.csv`, buildAnnotationsCsv(activeProject), 'text/csv');
  }
  function exportJsx() {
    if (!activeProject) return;
    downloadText(`${safeFileName(activeProject.title)}-indesign.jsx`, buildInDesignJsx(activeProject), 'application/javascript');
  }
  // The manuscript as a Word doc: every annotation highlighted in its own
  // colour, with a real Word comment (Type / Label / Note) on each.
  async function exportDocx() {
    if (!activeProject) return;
    try {
      const blob = await buildAnnotationsDocxBlob(activeProject);
      downloadBlob(`${safeFileName(activeProject.title)}-annotated-review.docx`, blob);
    } catch (e) {
      console.warn('[Quill] Word export failed:', e);
      alert('Sorry — the Word export hit a snag. Your CSV and InDesign exports still work.');
    }
  }
  // Marie 2026-05-26: SAFETY NET — download the full project as JSON
  // (annotations + chapter html + characters + audio file names) so a
  // mid-session crash, sign-out bug, or rogue cloud merge can never
  // wipe her annotation work. The dump is the literal shape Quill reads
  // back — restore by placing it at:
  //   ~/Documents/StJohn Author Studio/Save Data/quill-projects.json
  // (replacing or merging into the existing array).
  function exportProjectBackup() {
    if (!activeProject) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const safe = safeFileName(activeProject.title);
    const payload = {
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      note: 'Quill raw project backup. Drop the `project` object into Save Data/quill-projects.json (inside the array) to restore.',
      project: activeProject,
    };
    downloadText(
      `${safe}-quill-backup-${stamp}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  if (!hydrated) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        {modeToggle}
      </div>
    );
  }

  if (view === 'setup') {
    return (
      <ImportFlow
        heading="Import a manuscript"
        blurb="Upload a .docx, pick the chapters you want to annotate."
        submitLabel="Import & open"
        accent={QUILL.accent}
        allowSceneSplitting={true}
        needsPageNumbers={false}
        onCancel={() => setView(activeProject ? 'bookDetail' : 'home')}
        onConfirm={commitImport}
      />
    );
  }

  if (view === 'reader' && activeProject && activeChapter) {
    return (
      <QuillReaderView
        project={activeProject}
        chapterId={activeChapterId}
        onChangeChapter={setActiveChapterId}
        onBack={() => setView('bookDetail')}
        saveStatus={saveStatus}
        usesCustomDragRegion={usesCustomDragRegion}
        updateProject={updateActive}
        chapterAudio={chapterAudios[activeChapterId] || null}
        chapterTranscript={chapterTranscripts[activeChapterId] || transcriptStateFromChapter(activeChapter)}
      />
    );
  }

  if (view === 'bookDetail' && activeProject) {
    // Adapter — Quill project shape → Proof book shape — so SessionsView
    // (Proof's full book-detail UI: side nav, transcription queue, bulk
    // audio, audiobook timing, edit-nav-post-import, audio survives nav-out)
    // can render Quill data unchanged. ONE component, not two.
    const adaptedBook = {
      id: activeProject.id,
      title: activeProject.title,
      fileName: activeProject.fileName || '',
      chapters: (activeProject.chapters || []).map((ch) => {
        const audio = chapterAudios[ch.id] || null;
        const tx = chapterTranscripts[ch.id] || transcriptStateFromChapter(ch);
        const alignment = tx?.alignment || chapterAlignment(ch);
        // Fall back to persisted audio info on the chapter when there's
        // no live blob URL — file name + path survive disk save, so the
        // reader can show them after a reload. Cloud strips paths via
        // audio-guard, so only the file name travels off-device.
        const persistedAudioName = ch.audioFileName || '';
        const persistedAudioPath = getChapterStoredAudioPath(ch) || '';
        const persistedAudioPaths = ch.audioPaths || null;
        const sectionHtml = ch.textHtml || ch.html || '';
        // Marie 2026-05-26 — match SessionsView.getSectionAudioKey
        // format exactly (`path:<storedPath>` or `name:<normText>`),
        // otherwise SessionsView's isChapterTranscriptionCurrent
        // rejects the chapter and the ✓ Synced tick vanishes.
        const normalizedFallbackName = String(persistedAudioName || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const fallbackAudioKey = persistedAudioPath
          ? `path:${persistedAudioPath}`
          : (normalizedFallbackName ? `name:${normalizedFallbackName}` : '');
        const fallbackTextHash = hashText(sectionHtml);
        return {
          id: ch.id,
          title: ch.title,
          chapterTitle: ch.title,
          sections: [{
            id: ch.id,
            title: ch.title,
            html: ch.textHtml || ch.html || '',
            audioFileName: audio?.fileName || persistedAudioName || null,
            audioPath: persistedAudioPath || null,
            audioPaths: persistedAudioPaths || null,
            audioBlobUrl: audio?.url || null,
            flags: (activeProject.annotations || []).filter((a) => a.sectionId === ch.id),
            completed: !!ch.completed,
            characterName: null,
            narratorName: null,
            whisperAlignment: alignment.length ? alignment : null,
            whisperWords: tx?.words || ch.whisperWords || null,
            whisperTranscript: tx?.transcript || ch.whisperTranscript || '',
            whisperMatchedCount: ch.whisperMatchedCount ?? null,
            whisperManuscriptWordCount: ch.whisperManuscriptWordCount ?? null,
            whisperMatchQuality: ch.whisperMatchQuality ?? null,
            whisperAudioKey: ch.whisperAudioKey || (alignment.length ? fallbackAudioKey : null),
            whisperTextHash: ch.whisperTextHash || (alignment.length ? fallbackTextHash : null),
            whisperSourceUpdatedAt: ch.whisperSourceUpdatedAt || null,
            transcribedAt: ch.transcribedAt || null,
            chapterTitle: ch.title,
            isFirstSectionInChapter: true,
          }],
        };
      }),
      narratorColors: (activeProject.annotationOptions || [])
        .filter((o) => o.classId === 'character')
        .map((c) => ({ hex: c.color || '#9b8aa8', characterName: c.label, narratorName: c.label })),
      manuscriptPaging: null,
      pdfPaging: null,
    };
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        {usesCustomDragRegion && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 1100 }} />
        )}
        <ProofBookDetail
          mode="quill"
          book={adaptedBook}
          isElectron={typeof window !== 'undefined' && !!window.electron}
          usesCustomDragRegion={usesCustomDragRegion}
          onProof={(sectionOrId) => {
            const chapterId = typeof sectionOrId === 'object' ? sectionOrId?.id : sectionOrId;
            if (!chapterId) return;
            setActiveChapterId(chapterId);
            setView('reader');
          }}
          onUpdateBook={(updatesOrUpdater) => {
            // Bridge SessionsView's book-shape updates back to Quill's
            // project shape (chapter title edits etc.). Audio + narrator
            // edits map to chapterAudios / annotationOptions.
            const updated = typeof updatesOrUpdater === 'function'
              ? updatesOrUpdater(adaptedBook)
              : updatesOrUpdater;
            if (!updated || typeof updated !== 'object') return;
            if (updated.title && updated.title !== activeProject.title) {
              updateActive((p) => ({ ...p, title: updated.title }));
            }
            if (Array.isArray(updated.narratorColors)) {
              // Map narratorColors back to annotationOptions characters.
              const existing = (activeProject.annotationOptions || []).filter((o) => o.classId !== 'character');
              const next = updated.narratorColors.map((nc, i) => ({
                id: `char-${i}-${(nc.characterName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || Date.now()}`,
                classId: 'character',
                label: nc.characterName || `Character ${i + 1}`,
                color: nc.hex || '#9b8aa8',
              }));
              updateActive((p) => ({ ...p, annotationOptions: [...existing, ...next] }));
            }
            if (Array.isArray(updated.chapters)) {
              // Four things to sync back to Quill's project model:
              // 1. Chapter list — so unchecking a chapter in Edit book data
              //    actually removes it.
              // 2. audioFileName on each chapter — saved to disk AND pushed
              //    to Supabase (quill_chapters.audio_file_name) AND visible
              //    on the phone.
              // 3. audioPath / audioPaths on each chapter — LOCAL ONLY.
              //    audio-guard.js strips these before any cloud push, so
              //    they stay on this device. Saving them means Marie's
              //    attached audio survives a full app restart without
              //    re-picking the file.
              // 4. whisper alignment/transcript metadata — saved locally
              //    and pushed as small structured rows for the phone.
              // 5. chapterAudios in-memory map for the live blob URL
              //    so the reader can play right now.
              const keptIds = new Set(updated.chapters.map((ch) => ch.id));
              const chapterPatchById = {};
              const transcriptPatch = {};
	              updated.chapters.forEach((ch) => {
	                const sec = (ch.sections || [])[0];
	                const storedPath = getChapterStoredAudioPath(sec) || '';
	                const projectTranscription = transcriptionPatchFromSection(sec);
	                const transcriptState = projectTranscription ? transcriptStateFromSection(sec) : null;
	                const transcriptionCleared = hasExplicitTranscriptionClear(sec);
	                if (transcriptState) transcriptPatch[ch.id] = transcriptState;
	                chapterPatchById[ch.id] = {
	                  name: sec?.audioFileName || '',
	                  path: storedPath,
	                  paths: sec?.audioPaths || null,
	                  completed: !!sec?.completed,
	                  transcription: projectTranscription,
	                  transcriptionCleared,
	                };
	              });
              updateActive((p) => ({
                ...p,
                chapters: (p.chapters || [])
                  .filter((ch) => keptIds.has(ch.id))
                  .map((ch) => {
                    const incoming = chapterPatchById[ch.id];
                    // Only update audio fields when the parent actually
                    // touched audio (incoming defined). Empty fields mean
                    // "audio was cleared"; missing entry means "no change".
                    if (incoming === undefined) return ch;
	                    const nextChapter = {
	                      ...ch,
	                      audioFileName: incoming.name || '',
	                      audioPath: incoming.path || '',
	                      audioPaths: incoming.paths || null,
	                      completed: incoming.completed,
	                    };
	                    if (incoming.transcriptionCleared) return withoutTranscriptionFields(nextChapter);
	                    return incoming.transcription
	                      ? { ...nextChapter, ...incoming.transcription }
	                      : nextChapter;
	                  }),
                // When a chapter is removed from book detail, drop its
                // annotations too. Otherwise stale annotations stay in
                // the saved project, get pushed to cloud as
                // chapter_id: null, and continue to appear in exports.
                // Reorder/rename are safe — keptIds includes them.
                // (SAS-AUD-20260602-007, Block 4.)
                annotations: (p.annotations || [])
                  .filter((a) => !a?.sectionId || keptIds.has(a.sectionId)),
	              }));
              const audioPatch = {};
              updated.chapters.forEach((ch) => {
                const sec = (ch.sections || [])[0];
                if (sec?.audioFileName) {
                  audioPatch[ch.id] = {
                    fileName: sec.audioFileName,
                    url: sec.audioBlobUrl || getChapterStoredAudioPath(sec) || null,
                  };
                } else {
                  audioPatch[ch.id] = null;
                }
              });
              setChapterAudios((prev) => {
                const next = { ...prev };
                Object.entries(audioPatch).forEach(([id, val]) => {
                  if (val) next[id] = val;
                  else delete next[id];
                });
                // Also drop audio entries for chapters that were removed.
                Object.keys(next).forEach((id) => {
                  if (!keptIds.has(id)) delete next[id];
                });
                return next;
              });
	              setChapterTranscripts((prev) => {
	                const next = { ...prev, ...transcriptPatch };
	                Object.entries(chapterPatchById).forEach(([id, patch]) => {
	                  if (patch?.transcriptionCleared) delete next[id];
	                });
	                return next;
	              });
	            }
          }}
          onToggleComplete={(sectionId) => {
            // In Quill, each chapter renders as one section whose id
            // equals the chapter id. Flip the chapter's `completed`
            // flag — it persists through the normal save path (local
            // disk + quill_chapters Supabase row).
            updateActive((p) => ({
              ...p,
              chapters: (p.chapters || []).map((ch) =>
                ch.id === sectionId ? { ...ch, completed: !ch.completed } : ch
              ),
            }));
          }}
          onDelete={() => deleteProject(activeProject.id)}
          onBack={() => { setView('home'); setActiveProjectId(null); }}
          persistentAudioUrl={null}
          persistentAudioLabel=""
          persistentAudioState={null}
          // intentional: Quill doesn't use the persistent home-level audio
          // dock that Proof has. Audio plays inside the reader only.
          onPersistentAudioStateChange={() => {}}
          onReturnToScene={() => {}}
          onClearPersistentAudio={() => {}}
          actionButtonsOverride={(
            <>
              <button type="button" style={topBtnStyle('quill', 'solid')} onClick={exportAll}>Export all (.zip: Word + CSV + InDesign)</button>
              <button type="button" style={topBtnStyle('quill', 'outline')} onClick={exportDocx}>Word .docx only</button>
              <button type="button" style={topBtnStyle('quill', 'outline')} onClick={exportCsv}>CSV only</button>
              <button type="button" style={topBtnStyle('quill', 'outline')} onClick={exportJsx}>InDesign .jsx only</button>
              {/* Marie 2026-05-26: raw JSON safety-net backup. Click any
                  time mid-session — re-importable later if anything
                  in the app, cloud, or local file gets corrupted. */}
              <button type="button" style={topBtnStyle('quill', 'outline')} onClick={exportProjectBackup} title="Save the full raw project (annotations, characters, chapter HTML) as a JSON backup">💾 Backup (raw JSON)</button>
            </>
          )}
        />
      </div>
    );
  }

  // Home view
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {usesCustomDragRegion && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 1100 }} />
      )}
      {modeToggle}
      <QuillHomeView
        projects={allProjects}
        onOpen={openProject}
        onNew={() => setView('setup')}
        cloudPullError={cloudPullError}
      />
    </div>
  );
}

// ===========================================================================
// Home — project list
// ===========================================================================

function QuillHomeView({ projects, onOpen, onNew, cloudPullError }) {
  // ? info modal + image header — mirrors Duet's pattern in PrebuildMode.js.
  // Marie 2026-05-26: "copy DUET which already has one, that exactly."
  // headerImageOk: until the pink PNG (quill-and-ink-header.png) is dropped
  // into public/branding/, fall back to a plain text title so no broken-image
  // icon is shown.
  const [showHomeInfo, setShowHomeInfo] = useState(false);
  const [headerImageOk, setHeaderImageOk] = useState(true);
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '5.2rem 1.25rem 4rem' }}>
      <AppDialog
        open={showHomeInfo}
        onClose={() => setShowHomeInfo(false)}
        titleId="quill-about-title"
        panelStyle={{ width:'min(520px, 100%)',background:'white',border:'1px solid var(--accent-border)',borderRadius:24,boxShadow:'0 24px 60px var(--accent-shadow-strong)',padding:'20px 20px 18px' }}
      >
        <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:12 }}>
          <div id="quill-about-title" style={{ fontSize:'1rem',fontWeight:700,color:'var(--text)' }}>About Quill &amp; Ink</div>
          <button type="button" onClick={() => setShowHomeInfo(false)} style={{ padding:'6px 10px',fontSize:'0.74rem',color:QUILL.ink,border:'1px solid var(--accent-border)',background:'white',borderRadius:8,fontWeight:700,cursor:'pointer' }}>
            Close
          </button>
        </div>
        <div style={{ display:'grid',gap:10,fontSize:'0.85rem',lineHeight:1.6,color:'var(--text-muted)' }}>
          <p style={{ margin:0 }}>
            Quill &amp; Ink Design Studio helps you mark up a manuscript for special-edition print design. Drag across any words and tag them as Image, Highlight, Emotion, or a Character voice.
          </p>
          <p style={{ margin:0 }}>
            Export to a CSV for reference plus an InDesign .jsx script that re-creates every annotation as a character style, ready to drop onto your typeset pages.
          </p>
        </div>
      </AppDialog>
      <div style={{ textAlign: 'center', marginBottom: '1.9rem', position: 'relative' }}>
        <button
          onClick={() => setShowHomeInfo(true)}
          aria-label="About Quill & Ink"
          title="About Quill & Ink"
          style={{ position:'absolute',top:0,right:'max(4%, 0px)',width:42,height:42,borderRadius:'50%',border:'1px solid var(--accent-border)',background:'white',color:QUILL.ink,fontSize:'1.1rem',fontWeight:700,cursor:'pointer',boxShadow:'0 10px 24px var(--accent-shadow)',display:'flex',alignItems:'center',justifyContent:'center' }}
        >
          ?
        </button>
        {headerImageOk ? (
          <img
            src="/branding/quill-and-ink-header.png"
            alt="Quill & Ink design studio — prepping manuscripts for special edition formatting"
            onError={() => setHeaderImageOk(false)}
            style={{ width:'min(420px, 92%)',height:'auto',display:'block',margin:'0 auto 0.85rem' }}
          />
        ) : (
          <>
            <div style={{ fontSize: '1.55rem', fontWeight: 600, color: QUILL.ink }}>Quill &amp; Ink</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Annotate a manuscript for InDesign-friendly special-edition print design.
            </div>
          </>
        )}
        <h1 style={{ position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0, 0, 0, 0)',whiteSpace:'nowrap',border:0 }}>Quill &amp; Ink Design Studio</h1>
      </div>

      {cloudPullError && (
        <div style={{ marginBottom:8,padding:'6px 10px',background:'#fdecea',color:'#a23a2f',border:'1px solid #f5c6c0',borderRadius:8,fontSize:'0.75rem' }}>
          Cloud sync failed: {cloudPullError}
        </div>
      )}

      <section style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid var(--border)', borderRadius: 22, padding: '1rem', marginBottom: 14 }}>
        <button
          onClick={onNew}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 18px',
            background: QUILL.accent,
            color: 'white',
            border: 'none',
            borderRadius: 16,
            fontSize: '0.96rem',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          + New project
        </button>
      </section>

      <section style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid var(--border)', borderRadius: 22, padding: '1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: projects.length > 0 ? 10 : 0 }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL.ink, marginBottom: 2 }}>Your projects</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {projects.length > 0 ? `${projects.length} saved` : 'Imported manuscripts will appear here'}
          </div>
        </div>

        {projects.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 'min(46vh, 420px)', overflowY: 'auto', paddingRight: 4 }}>
            {/* Last-touched first. Marie 2026-05-26: same as Proof + Phone. */}
            {[...projects].sort((a, b) => {
              const at = Date.parse(a?.updatedAt || '') || Number(a?.updatedAt) || 0;
              const bt = Date.parse(b?.updatedAt || '') || Number(b?.updatedAt) || 0;
              return bt - at;
            }).map((p) => {
              const chapterCount = p.chapterCount ?? p.chapters?.length ?? 0;
              const annCount = p.annotationCount ?? p.annotations?.length ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => onOpen(p)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'white',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{chapterCount} chapters · {annCount} annotations</div>
                  </div>
                  <span aria-hidden="true" style={{ color: 'var(--text-light)', fontSize: '1.2rem', paddingLeft: 10 }}>›</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.82rem', padding: '1.2rem 0 0.35rem' }}>
            No projects yet
          </div>
        )}
      </section>
    </div>
  );
}


// ===========================================================================
// Reader view — word render, drag-to-highlight, annotation popover + list
// ===========================================================================

function QuillReaderView({ project, chapterId, onChangeChapter, onBack, saveStatus, usesCustomDragRegion, updateProject, chapterAudio = null, chapterTranscript = null }) {
  const chapters = project.chapters || [];
  const chapterIndex = chapters.findIndex((c) => c.id === chapterId);
  const chapter = chapters[chapterIndex] || null;

  // Build the chapter's plain text + per-unit positions from the source
  // HTML using the new index helper, NOT the old `htmlToPlainText`
  // (which inserts a space for every inline tag — that's the "Kar ma"
  // bug). Quill uses regex split (alphanumeric only), same as
  // ChapterReader's default, so unit count matches saved annotations.
  const chapterPlainIndex = useMemo(() => {
    const html = chapter?.textHtml || chapter?.html || '';
    try { return buildChapterPlainTextIndex(html, 'regex'); }
    catch (err) { console.warn('chapterPlainIndex build failed:', err); return null; }
  }, [chapter?.id, chapter?.textHtml, chapter?.html]);
  const plainText = chapterPlainIndex?.plainText || chapter?.plainText || htmlToPlainText(chapter?.textHtml || '');
  // Shape the index into the `{word,start,end}` rows the rest of the
  // file already uses (search, context, popover anchor, etc.). Fall back
  // to the old buildWordSpans path only if the index didn't build.
  const wordSpans = useMemo(() => {
    if (chapterPlainIndex?.unitMeta?.length) {
      return chapterPlainIndex.unitMeta.map((u) => {
        const seg = chapterPlainIndex.plainText.slice(u.plainStart, u.plainNext);
        const word = (seg.match(/^\S*/)?.[0]) || '';
        return { word, start: u.plainStart, end: u.plainStart + word.length };
      });
    }
    return buildWordSpans(plainText);
  }, [chapterPlainIndex, plainText]);

  // Character chip strip below the sticky bar — same look as Proof's
  // narrator strip. Pulls from project.annotationOptions where classId
  // === 'character'. Visible only when characters exist.
  const characters = (project.annotationOptions || []).filter(o => o.classId === 'character');
  const characterStrip = characters.length > 0 ? (
    <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
      {characters.map((c) => (
        <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.9)', border: '1px solid var(--border-light)' }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: c.color || 'var(--accent)' }} />
          {c.label}
        </span>
      ))}
    </div>
  ) : null;

  // Audio is attached at the BOOK DETAIL level, per chapter. The parent
  // owns the audio state; this view just consumes the prop. Marie's
  // rule: audio NEVER leaves the device.
  const audioUrl = chapterAudio?.url || null;
  const audioFileName = chapterAudio?.fileName || '';

  // Audio sync — when a transcript is loaded, follow the audio time and
  // highlight the current word. Same engine helpers Proof uses.
  const audioRef = useRef(null);
  const syncScrollWordRef = useRef(-1);
  const [currentMsIdx, setCurrentMsIdx] = useState(-1);
  const [followText, setFollowText] = useState(true);
  // Marie 2026-05-26: T (transcription sync) on/off toggle — parity with
  // Proof's player. When OFF, audio scrubbing falls back to plain time
  // (no whisper alignment lookup, no current-word highlight). Default
  // ON since the user always wants sync if a transcription exists.
  const [useWhisperSync, setUseWhisperSync] = useState(true);

  // Search inside chapter — same shape as Proof's ChapterSearchBar.
  // Cmd/Ctrl+F to open. Highlights matching words via unitDecoration.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState([]); // array of unit indices
  const [searchHitIdx, setSearchHitIdx] = useState(0);
  const searchInputRef = useRef(null);
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchHits([]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);
  // Recompute hits when query changes
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchHits([]); setSearchHitIdx(0); return; }
    const q = searchQuery.toLowerCase();
    const hits = [];
    wordSpans.forEach((w, i) => { if (String(w.word || w.text || '').toLowerCase().includes(q)) hits.push(i); });
    setSearchHits(hits);
    setSearchHitIdx(0);
  }, [searchQuery, wordSpans]);
  function searchStep(direction) {
    if (!searchHits.length) return;
    setSearchHitIdx((prev) => (prev + direction + searchHits.length) % searchHits.length);
  }
  // Reset search when chapter changes
  useEffect(() => { setSearchOpen(false); setSearchQuery(''); setSearchHits([]); }, [chapter?.id]);
  const syncTable = chapterTranscript?.syncTable || null;
  useEffect(() => {
    setCurrentMsIdx(-1);
  }, [chapter?.id]);
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!syncTable || syncTable.length < 4) return;
    // Marie 2026-05-26: if the user turned the T (transcription sync)
    // toggle OFF, stop updating currentMsIdx and clear it. The audio
    // still plays normally — just no word highlight chases it.
    if (!useWhisperSync) {
      setCurrentMsIdx(-1);
      return;
    }
    let raf = null;
    function tick(force = false) {
      const rate = Math.max(1, Number(el.playbackRate) || 1);
      const lookahead = !el.paused ? Math.min(FOLLOW_LOOKAHEAD_MAX_SEC, FOLLOW_LOOKAHEAD_BASE_SEC * rate) : 0;
      const idx = getMsIdxAtTime(syncTable, (Number(el.currentTime) || 0) + lookahead, -1);
      setCurrentMsIdx((prev) => (prev === idx ? prev : idx));
      if (!el.paused || force) raf = requestAnimationFrame(() => tick(false));
      else raf = null;
    }
    function onPlay() { if (raf == null) raf = requestAnimationFrame(() => tick(false)); }
    function onPause() { if (raf != null) { cancelAnimationFrame(raf); raf = null; } }
    function onSeek() {
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
      syncScrollWordRef.current = -1;
      tick(true);
    }
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('seeking', onSeek);
    el.addEventListener('seeked', onSeek);
    el.addEventListener('timeupdate', onSeek);
    onPlay();
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('seeking', onSeek);
      el.removeEventListener('seeked', onSeek);
      el.removeEventListener('timeupdate', onSeek);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [syncTable, audioUrl, useWhisperSync]);
  useEffect(() => {
    if (!followText || !useWhisperSync || currentMsIdx < 0) return;
    if (syncScrollWordRef.current === currentMsIdx) return;
    syncScrollWordRef.current = currentMsIdx;
    const target = getChapterReaderWordEl(currentMsIdx);
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentMsIdx, followText, useWhisperSync]);

  // Selection state
  const [selectedRange, setSelectedRange] = useState(null);    // { start, end } (word indices, inclusive)
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState(null);

  // Annotation form state
  const [classId, setClassId] = useState('highlight');
  const [optionId, setOptionId] = useState('');
  const [characterIds, setCharacterIds] = useState([]); // attach character markers in parallel
  const [note, setNote] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customAddClassId, setCustomAddClassId] = useState('');

  // Drag state
  const draggingRef = useRef(false);
  const dragAnchorRef = useRef(null);
  // Floating-action-button position is owned by ChapterReader now.

  const projectAnnotations = project.annotations || [];
  const annotationsForChapter = useMemo(
    () => projectAnnotations.filter((a) => a.sectionId === chapter?.id),
    [projectAnnotations, chapter?.id]
  );

  // Build a word->annotation lookup so we can paint each word.
  const wordToAnnotation = useMemo(() => {
    const map = new Map();
    for (const ann of annotationsForChapter) {
      const start = Number(ann.wordStart);
      const end = Number(ann.wordEnd ?? ann.wordStart);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      for (let i = start; i <= end; i += 1) {
        // Character (marker-only) annotations don't paint the word — they
        // attach a marker after the range. Skip them in the paint pass so
        // they don't shade the underlying highlight.
        if (ann.markerOnly || ann.classId === 'character') continue;
        const existing = map.get(i);
        if (!existing) map.set(i, ann);
      }
    }
    return map;
  }, [annotationsForChapter]);

  const classTree = useMemo(() => getAnnotationClassTree(project.annotationOptions || []), [project.annotationOptions]);
  const selectedClass = classTree.find((c) => c.id === classId) || classTree[1] || classTree[0];
  const selectedOptions = selectedClass?.options || [];
  const characterClass = classTree.find((c) => c.id === 'character');
  const characterOptions = characterClass?.options || [];

  // Ensure optionId is valid whenever classId changes.
  useEffect(() => {
    if (!selectedClass) return;
    if (selectedClass.options.length === 0) { setOptionId(''); return; }
    if (!selectedClass.options.find((o) => o.id === optionId)) {
      setOptionId(selectedClass.options[0].id);
    }
  }, [selectedClass, optionId]);

  const popoverRef = useRef(null);
  useDismissable(popoverOpen, () => closePopover(), popoverRef);

  function clearSelection() {
    setSelectedRange(null);
    setPopoverOpen(false);
    setPopoverPos(null);
    setEditingAnnotationId(null);
    setCustomLabel('');
    setCustomAddClassId('');
    setCharacterIds([]);
    setNote('');
  }

  function closePopover() {
    setPopoverOpen(false);
    setPopoverPos(null);
    setCustomLabel('');
    setCustomAddClassId('');
  }

  // word click / drag handlers
  function onWordPointerDown(index, event) {
    event.preventDefault();
    // If this word is part of an existing annotation, open it for editing.
    const existing = wordToAnnotation.get(index);
    if (existing && !event.shiftKey) {
      openExistingAnnotation(existing, event);
      return;
    }
    draggingRef.current = true;
    dragAnchorRef.current = index;
    setSelectedRange({ start: index, end: index });
    setEditingAnnotationId(null);
    setPopoverOpen(false);
  }

  function onWordPointerEnter(index) {
    if (!draggingRef.current || dragAnchorRef.current == null) return;
    const anchor = dragAnchorRef.current;
    setSelectedRange({ start: Math.min(anchor, index), end: Math.max(anchor, index) });
  }

  useEffect(() => {
    function up() { draggingRef.current = false; }
    window.addEventListener('pointerup', up);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('mouseup', up);
    };
  }, []);

  // Keep the popover anchored to the selected word as the layout
  // shifts (scroll, resize). ChapterReader owns the action-button
  // position; this effect is just for the popover (which mode-side
  // code owns because the popover is annotation-specific).
  useEffect(() => {
    if (!popoverOpen || !selectedRange) return undefined;
    function update() {
      const wordEl = getChapterReaderWordEl(selectedRange.start);
      setPopoverPos(computeChapterReaderPopoverPos(wordEl));
    }
    const raf = requestAnimationFrame(update);
    window.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [selectedRange?.start, selectedRange?.end, popoverOpen]);

  function openExistingAnnotation(ann, event) {
    const start = Number(ann.wordStart);
    const end = Number(ann.wordEnd ?? ann.wordStart);
    setSelectedRange({ start, end });
    setEditingAnnotationId(ann.id);
    setClassId(ann.classId || 'highlight');
    setOptionId(ann.optionId || '');
    setNote(ann.note || '');
    // Pre-tick any character markers that share this same range, so the
    // user sees them and can untick to remove. Without this they'd be
    // invisible in the popover and saving would duplicate them.
    const charsAtRange = (project.annotations || [])
      .filter((a) => (a.classId === 'character' || a.markerOnly) &&
        Number(a.wordStart) === start && Number(a.wordEnd ?? a.wordStart) === end)
      .map((a) => a.optionId)
      .filter(Boolean);
    setCharacterIds(charsAtRange);
    const wordEl = event?.currentTarget || getChapterReaderWordEl(start);
    setPopoverOpen(true);
    setPopoverPos(computeChapterReaderPopoverPos(wordEl));
  }

  function openPopover() {
    if (!selectedRange) return;
    const wordEl = getChapterReaderWordEl(selectedRange.start);
    setPopoverOpen(true);
    setPopoverPos(computeChapterReaderPopoverPos(wordEl));
  }

  function saveAnnotation() {
    if (!chapter || !selectedRange) return;
    const start = selectedRange.start;
    const end = selectedRange.end;
    // Pull the exact text from the chapter's plain-text index so phantom
    // spaces inside words / before punctuation never leak into a saved
    // annotation. Falls back to the old join if the index didn't build.
    const selectedText = chapterPlainIndex
      ? sliceUnitsRange(chapterPlainIndex, start, end)
      : wordSpans.slice(start, end + 1).map((s) => s.word).join(' ');
    const textContext = buildSelectionTextContext(plainText, wordSpans, start, end);

    const updatedAnnotations = [];
    // When editing, also drop any character markers that shared this
    // range — they'll be re-added from characterIds below. Without
    // this, re-saving an edited annotation duplicates the markers.
    const previousAnnotations = (project.annotations || []).filter((a) => {
      if (a.id === editingAnnotationId) return false;
      if (editingAnnotationId && (a.classId === 'character' || a.markerOnly) &&
          a.sectionId === chapter.id &&
          Number(a.wordStart) === start && Number(a.wordEnd ?? a.wordStart) === end) {
        return false;
      }
      return true;
    });

    // Primary annotation (the class chosen in the popover)
    const primarySelection = resolveAnnotationSelection({
      classId,
      optionId,
      projectOptions: project.annotationOptions || [],
    });
    const primary = createAnnotation({
      selection: primarySelection,
      sectionId: chapter.id,
      sectionTitle: chapter.title,
      chapterNumber: chapter.chapterNumber,
      wordStart: start,
      wordEnd: end,
      selectedText,
      textContext,
      note,
    });
    if (editingAnnotationId) primary.id = editingAnnotationId;
    updatedAnnotations.push(primary);

    // Character markers (parallel — same range, marker-only)
    for (const charOptionId of characterIds) {
      const charSelection = resolveAnnotationSelection({
        classId: 'character',
        optionId: charOptionId,
        projectOptions: project.annotationOptions || [],
      });
      const charAnn = createAnnotation({
        selection: charSelection,
        sectionId: chapter.id,
        sectionTitle: chapter.title,
        chapterNumber: chapter.chapterNumber,
        wordStart: start,
        wordEnd: end,
        selectedText,
        textContext,
      });
      updatedAnnotations.push(charAnn);
    }

    updateProject((p) => ({
      ...p,
      annotations: [...previousAnnotations, ...updatedAnnotations],
    }));
    clearSelection();
  }

  function deleteEditingAnnotation() {
    if (!editingAnnotationId) return;
    updateProject((p) => {
      const list = p.annotations || [];
      const target = list.find((a) => a.id === editingAnnotationId);
      if (!target) return p;
      // Bundle-delete: same-range character markers go with the main
      // annotation, matching how openExistingAnnotation/saveAnnotation
      // already treat them. Without this, deleting an annotation that
      // has character tags leaves orphan markers in the dock, exports,
      // and cloud payload. (SAS-AUD-20260602-006, Block 4.)
      const drop = idsForAnnotationBundle(target, list);
      return { ...p, annotations: list.filter((a) => !drop.has(a.id)) };
    });
    clearSelection();
  }

  function deleteAnnotation(id) {
    updateProject((p) => {
      const list = p.annotations || [];
      const target = list.find((a) => a.id === id);
      if (!target) return p;
      const drop = idsForAnnotationBundle(target, list);
      return { ...p, annotations: list.filter((a) => !drop.has(a.id)) };
    });
    if (editingAnnotationId === id) clearSelection();
  }

  function addCustomOption(forClassId) {
    const cleanLabel = customLabel.trim();
    if (!cleanLabel) return;
    const existing = (project.annotationOptions || []).filter((o) => o.classId === forClassId);
    const newOption = createCustomOption(cleanLabel, forClassId, existing);
    if (!newOption) return;
    updateProject((p) => ({
      ...p,
      annotationOptions: [...(p.annotationOptions || []), newOption],
    }));
    setCustomLabel('');
    setCustomAddClassId('');
    if (forClassId === 'character') {
      setCharacterIds((ids) => [...ids, newOption.id]);
    } else {
      setClassId(forClassId);
      setOptionId(newOption.id);
    }
  }

  function toggleCharacter(optionId) {
    setCharacterIds((ids) => ids.includes(optionId) ? ids.filter((x) => x !== optionId) : [...ids, optionId]);
  }

  function jumpToAnnotation(ann) {
    if (ann.sectionId && ann.sectionId !== chapter?.id) {
      onChangeChapter(ann.sectionId);
      return;
    }
    const target = getChapterReaderWordEl(ann.wordStart);
    if (target?.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // -- per-word decoration handed to ChapterReader --------------------------
  // Annotated words get a continuous pink underline (highlight class)
  // — text-decoration spans inline content INCLUDING the trailing
  // whitespace, so adjacent annotated words appear as one band, not
  // N broken stripes. Image annotations get a pastel pink wash
  // (was red — Marie hated red). Anything else with a colour gets a
  // tinted background. useCallback so ChapterReader's render memo
  // stays stable.
  const searchHitsSet = useMemo(() => new Set(searchHits), [searchHits]);
  const currentSearchHit = searchHits[searchHitIdx];
  const unitDecoration = useCallback((idx) => {
    const isCurrent = followText && currentMsIdx >= 0 && idx === currentMsIdx;
    const isSearchHit = searchHitsSet.has(idx);
    const isCurrentSearchHit = idx === currentSearchHit;
    const ann = wordToAnnotation.get(idx);
    // Start with the annotation style (if any), then merge the audio-
    // synced current-word highlight on top so it always wins visually.
    let base = null;
    if (ann) {
      if (ann.classId === 'highlight') {
        const color = ann.color || QUILL.accent;
        base = {
          textDecorationLine: 'underline',
          textDecorationColor: color,
          textDecorationThickness: '3px',
          textUnderlineOffset: '2px',
          textDecorationSkipInk: 'none',
        };
      } else if (ann.classId === 'image') {
        base = { background: '#DCEAC9', color: '#3D5630' };
      } else {
        base = { background: (ann.color || QUILL.accent) + '33' };
      }
    }
    // Search match wins over annotation, current-word wins over both.
    if (isCurrentSearchHit) return { ...base, background: '#f59e0b', color: 'white', borderRadius: 3 };
    if (isSearchHit) return { ...base, background: '#fff3a0', borderRadius: 3 };
    if (isCurrent) {
      return {
        ...base,
        background: 'color-mix(in srgb, var(--accent-light) 88%, white)',
        boxShadow: '0 0 0 1px var(--accent-border-strong), inset 0 -1px 0 var(--accent-border-strong)',
        borderRadius: 6,
      };
    }
    return base;
  }, [wordToAnnotation, currentMsIdx, followText, searchHitsSet, currentSearchHit]);

  if (!chapter) {
    return (
      <div style={{ padding: '5.2rem 1.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No chapter to read.
      </div>
    );
  }

  return (
    <>
      <ChapterReader
        tone="quill"
        chapter={chapter}
        chapters={chapters}
        chapterIndex={chapterIndex}
        onChangeChapter={onChangeChapter}
        onBack={onBack}
        saveStatus={saveStatus}
        usesCustomDragRegion={usesCustomDragRegion}
        paperPaddingBottom={audioUrl ? 220 : 120}
        topActions={(
          <button
            type="button"
            onClick={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
            title="Search inside chapter (⌘/Ctrl+F)"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', padding: '4px 8px' }}
          >
            🔍
          </button>
        )}
        headerExtra={(
          <>
            {searchOpen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.96)', border: '1px solid var(--border-light)', borderRadius: 14, boxShadow: '0 10px 24px rgba(0,0,0,0.04)', marginBottom: 8 }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  placeholder="Search manuscript…"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); searchStep(e.shiftKey ? -1 : 1); }
                    if (e.key === 'Escape') { e.preventDefault(); setSearchOpen(false); setSearchQuery(''); setSearchHits([]); }
                  }}
                  style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: '0.9rem', fontFamily: 'inherit', outline: 'none', background: 'white' }}
                />
                {searchHits.length > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{searchHitIdx + 1} / {searchHits.length}</span>}
                {searchHits.length === 0 && searchQuery.trim() && <span style={{ fontSize: '0.72rem', color: 'var(--danger)', whiteSpace: 'nowrap' }}>Not found</span>}
                <button type="button" onClick={() => searchStep(-1)} disabled={searchHits.length < 2} aria-label="Previous search hit" title="Previous hit" style={{ padding: '4px 8px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', opacity: searchHits.length < 2 ? 0.4 : 1 }}><span aria-hidden="true">↑</span></button>
                <button type="button" onClick={() => searchStep(1)} disabled={searchHits.length < 2} aria-label="Next search hit" title="Next hit" style={{ padding: '4px 8px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', opacity: searchHits.length < 2 ? 0.4 : 1 }}><span aria-hidden="true">↓</span></button>
                <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchHits([]); }} aria-label="Close search" title="Close search" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.875rem', padding: '0 4px' }}><span aria-hidden="true">✕</span></button>
              </div>
            )}
            {characterStrip}
          </>
        )}
	        bottomDock={audioUrl ? (
	          <AudioDock
	            audioRef={audioRef}
	            audioUrl={audioUrl}
	            label={audioFileName || ''}
	            rightActions={syncTable && syncTable.length >= 4 ? (
	              <>
	                {/* Marie 2026-05-26: matches Proof's "T" transcription
	                    toggle exactly. Replaces the old passive ✓ Synced
	                    badge. ON = current word follows audio playback;
	                    OFF = audio scrubs by time only. */}
	                <button
	                  type="button"
	                  onClick={() => setUseWhisperSync((v) => !v)}
	                  title={useWhisperSync ? 'Transcription on. Click to turn it off.' : 'Transcription off. Click to turn it on.'}
	                  style={{
	                    width: 38,
	                    height: 38,
	                    border: '1px solid ' + (useWhisperSync ? '#8fbf8f' : 'var(--border)'),
	                    borderRadius: 999,
	                    background: useWhisperSync ? '#e7f6e7' : 'white',
	                    fontSize: '0.82rem',
	                    fontWeight: 700,
	                    cursor: 'pointer',
	                    color: useWhisperSync ? '#2b7a2b' : 'var(--text-muted)',
	                  }}
	                >
	                  T
	                </button>
	                <button
	                  type="button"
	                  onClick={() => setFollowText((v) => !v)}
	                  title={`Follow text is ${followText ? 'on' : 'off'}. When on, moving the audio keeps the text following along.`}
	                  style={{
	                    minWidth: 132,
	                    padding: '7px 12px',
	                    border: '1px solid ' + (followText ? 'var(--accent)' : 'var(--border)'),
	                    borderRadius: 999,
	                    background: followText ? 'var(--accent-soft)' : 'white',
	                    fontSize: '0.74rem',
	                    fontWeight: 700,
	                    cursor: 'pointer',
	                    color: followText ? 'var(--accent-dark)' : 'var(--text-muted)',
	                  }}
	                >
	                  Follow text: {followText ? 'On' : 'Off'}
	                </button>
	              </>
	            ) : null}
	          />
	        ) : null}
        unitDecoration={unitDecoration}
        onUnitPointerDown={onWordPointerDown}
        onUnitPointerEnter={onWordPointerEnter}
        selectedRange={selectedRange}
        onSelectionAction={openPopover}
        actionButtonIcon={editingAnnotationId ? '✎' : '+'}
      />

      {popoverOpen && popoverPos && (
        <div
          ref={popoverRef}
          style={{
            // Viewport coords — computePopoverPos already clamps to the
            // visible area and flips above/below the selected word
            // depending on which side has room.
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            width: popoverPos.width,
            zIndex: 1600,
            background: 'white',
            border: '1px solid ' + QUILL.ink + '55',
            borderRadius: 14,
            boxShadow: '0 14px 34px rgba(76, 72, 70, 0.18)',
            padding: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {classTree.filter((c) => c.id !== 'character').map((c) => (
              <button
                key={c.id}
                onClick={() => setClassId(c.id)}
                style={{
                  padding: '5px 10px',
                  border: '1px solid ' + (classId === c.id ? c.color : 'var(--border)'),
                  background: classId === c.id ? c.color + '22' : 'white',
                  borderRadius: 999,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  color: 'var(--text)',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                {c.label}
              </button>
            ))}
          </div>

          {selectedOptions.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
              <select
                value={optionId}
                onChange={(e) => setOptionId(e.target.value)}
                style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.82rem' }}
              >
                {selectedOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              {selectedClass?.allowCustom && customAddClassId !== selectedClass.id && (
                <button onClick={() => { setCustomAddClassId(selectedClass.id); setCustomLabel(''); }} style={miniCircleBtn(QUILL.accent)}>+</button>
              )}
            </div>
          )}

          {customAddClassId === selectedClass?.id && selectedClass.allowCustom && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder={`New ${selectedClass.label.toLowerCase()}`}
                style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.82rem' }}
              />
              <button onClick={() => addCustomOption(selectedClass.id)} style={miniCircleBtn(QUILL.accent)}>+</button>
              <button type="button" onClick={() => { setCustomAddClassId(''); setCustomLabel(''); }} aria-label="Cancel adding custom option" title="Cancel" style={miniCircleBtn('var(--text-light)')}><span aria-hidden="true">×</span></button>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 8, marginBottom: 8 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL.ink, marginBottom: 6 }}>
              Attach characters
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
              {characterOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleCharacter(opt.id)}
                  style={{
                    padding: '4px 9px',
                    border: '1px solid ' + (characterIds.includes(opt.id) ? QUILL.ink : 'var(--border)'),
                    background: characterIds.includes(opt.id) ? QUILL.pastel : 'white',
                    borderRadius: 999,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
              {customAddClassId !== 'character' && (
                <button onClick={() => { setCustomAddClassId('character'); setCustomLabel(''); }} style={miniCircleBtn(QUILL.accent)}>+</button>
              )}
              {!characterOptions.length && customAddClassId !== 'character' && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>No characters yet</span>
              )}
            </div>
            {customAddClassId === 'character' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Character name"
                  style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.82rem' }}
                />
                <button onClick={() => addCustomOption('character')} style={miniCircleBtn(QUILL.accent)}>+</button>
                <button type="button" onClick={() => { setCustomAddClassId(''); setCustomLabel(''); }} aria-label="Cancel adding custom option" title="Cancel" style={miniCircleBtn('var(--text-light)')}><span aria-hidden="true">×</span></button>
              </div>
            )}
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={classId === 'image' ? 'Image note' : 'Comment'}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.84rem', marginBottom: 8 }}
          />

          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {editingAnnotationId && (
              <button onClick={deleteEditingAnnotation} style={{ ...topBtnStyle('quill', 'danger') }}>Delete</button>
            )}
            <button onClick={closePopover} style={topBtnStyle('quill', 'ghost')}>Cancel</button>
            <button onClick={saveAnnotation} style={topBtnStyle('quill', 'solid')}>{editingAnnotationId ? 'Save' : 'Add ✓'}</button>
          </div>
        </div>
      )}

      {/* Bottom annotation dock — Marie wanted the list at the BOTTOM,
          not in a right-hand sidebar. Chips scroll horizontally so a
          chapter with lots of annotations still fits in a single row.
          Marie 2026-05-26: when audio is attached, stack ABOVE the
          AudioDock (which is also fixed at bottom) — otherwise this
          strip was hiding AudioDock's Speed slider, Jump chips, T
          toggle, and Follow-text button. They were rendering but
          covered. AudioDock is ~120px tall when fully rendered. */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: audioUrl ? 120 : 0,
          background: 'rgba(255,255,255,0.96)',
          borderTop: '1px solid var(--border-light)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 -6px 22px rgba(0,0,0,0.04)',
          zIndex: 1200,
          padding: '8px 16px 12px',
          WebkitAppRegion: 'no-drag',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL.ink }}>
              Annotations · {annotationsForChapter.length}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
              {annotationsForChapter.length === 0
                ? 'Drag across text to start.'
                : 'Click a chip to jump back to it.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {annotationsForChapter.map((ann) => (
              <div
                key={ann.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 8px 5px 10px',
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: 999,
                  flexShrink: 0,
                  maxWidth: 340,
                }}
                title={ann.note ? `${ann.label || ann.classLabel || 'Annotation'} — ${ann.note}` : (ann.label || ann.classLabel || 'Annotation')}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ann.color || QUILL.accent, flexShrink: 0 }} />
                <button
                  type="button"
                  onClick={() => jumpToAnnotation(ann)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: '0.74rem',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 260,
                    color: 'var(--text)',
                  }}
                >
                  <span style={{ fontWeight: 700, color: QUILL.ink }}>{ann.label || ann.classLabel || 'Annotation'}</span>
                  <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    &ldquo;{(ann.selectedText || '').slice(0, 32)}{(ann.selectedText || '').length > 32 ? '…' : ''}&rdquo;
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteAnnotation(ann.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-light)',
                    fontSize: '0.92rem',
                    lineHeight: 1,
                    padding: '0 2px',
                  }}
                  title="Delete annotation"
                  aria-label="Delete annotation"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function miniCircleBtn(color) {
  return {
    width: 26,
    height: 26,
    borderRadius: 999,
    border: '1px solid ' + color,
    background: 'white',
    color,
    cursor: 'pointer',
    fontSize: '0.94rem',
    fontWeight: 700,
    lineHeight: 1,
    flexShrink: 0,
  };
}

// Word-rendering moved to app/components/ChapterReader.js. Modes pass
// `unitDecoration` (per-word style) + pointer handlers; ChapterReader
// owns the HTML walk and word splitter.
