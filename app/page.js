'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import BookSetup from './components/ManuscriptSetup';
import ProofingReader from './components/ProofingReader';
import BookDetail from './components/SessionsView';
import InfoTip from './components/InfoTip';
import PrebuildMode from './components/PrebuildMode';
import PrepManuscriptMode from './components/PrepManuscriptMode';
import QuillAndInkMode from './components/QuillAndInkMode';
import LoginScreen from './components/LoginScreen';
import { modeAccentVars, ProfilePill } from './components/ReaderChrome';
import { countWordsInHtml, normalizeBookPaging } from './lib/manuscriptPaging';
import {
  hasSupabaseConfig,
  getSupabaseClient,
  signOutSupabaseAccount,
  pushProofProject,
  pullProofProjects,
  deleteProofProject,
  addTombstone,
  applyTombstonesToCloudList,
} from '../packages/cloud-sync';

// Detect Electron
const el = () => typeof window !== 'undefined' && window.electron;

function getElectronPlatform() {
  return el()?.platform || null;
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

function getSectionStoredAudioPath(section, platform = getElectronPlatform()) {
  if (section?.audioPaths && typeof section.audioPaths === 'object') {
    const currentPath = section.audioPaths[platform];
    return typeof currentPath === 'string' && currentPath ? currentPath : null;
  }
  const legacyPath = section?.audioPath;
  return legacyPathMatchesCurrentPlatform(legacyPath, platform) ? legacyPath : null;
}

function normalizeBooks(books) {
  return (Array.isArray(books) ? books : []).map(normalizeBookPaging);
}

async function loadBooks() {
  if (el()) return normalizeBooks((await window.electron.readData()) || []);
  try { return normalizeBooks(JSON.parse(localStorage.getItem('ap-books') || '[]')); } catch { return []; }
}

async function persistBooks(books) {
  if (el()) { await window.electron.writeData(books); return; }
  try { localStorage.setItem('ap-books', JSON.stringify(books)); }
  catch { alert('Storage full — please export a backup.'); }
}

function sectionAudioKey(section) {
  return getSectionStoredAudioPath(section) || section?.audioFileName || null;
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

function hasCurrentSectionTranscription(section, expectedAudioKey, expectedTextHash) {
  return !!(
    section &&
    Array.isArray(section.whisperWords) &&
    section.whisperWords.length &&
    Array.isArray(section.whisperAlignment) &&
    section.whisperAlignment.length &&
    section.whisperAudioKey === expectedAudioKey &&
    section.whisperTextHash === expectedTextHash
  );
}

function findSectionContext(book, sectionId) {
  const chapters = book?.chapters || [];
  for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
    const chapter = chapters[chIdx];
    const secIdx = (chapter.sections || []).findIndex(s => s.id === sectionId);
    if (secIdx >= 0) {
      return { chapter, chapterIndex: chIdx, sectionIndex: secIdx, section: chapter.sections[secIdx] };
    }
  }
  return null;
}

function buildContinuousChapterSection(chapter, section) {
  const sections = chapter?.sections || [];
  const idx = sections.findIndex(s => s.id === section?.id);
  if (idx < 0) return section;
  const sectionWithMeta = {
    ...section,
    chapterTitle: chapter?.title || section?.chapterTitle || '',
    audioFileName: section?.audioFileName || '',
  };
  const key = sectionAudioKey(section);
  if (!key) return sectionWithMeta;

  // Find ALL sections sharing this audio file
  let startIdx = idx;
  while (startIdx > 0 && sectionAudioKey(sections[startIdx - 1]) === key) startIdx -= 1;
  let endIdx = idx;
  while (endIdx < sections.length - 1 && sectionAudioKey(sections[endIdx + 1]) === key) endIdx += 1;

  const allSections = sections.slice(startIdx, endIdx + 1);
  const expectedTextHash = hashText(allSections.map(s => s.html || '').join(''));
  const hasCurrentMergedTranscription = allSections.every(s => hasCurrentSectionTranscription(s, key, expectedTextHash));

  if (startIdx === endIdx) {
    return {
      ...sectionWithMeta,
      whisperAlignment: hasCurrentMergedTranscription ? sectionWithMeta.whisperAlignment : [],
      whisperWords: hasCurrentMergedTranscription ? sectionWithMeta.whisperWords : [],
    };
  }

  const prefixWordCount = sections.slice(startIdx, idx).reduce((n, s) => n + countWordsInHtml(s.html), 0);
  const mergedAlignment = [];
  let wordOffset = 0;
  for (const current of allSections) {
    const count = countWordsInHtml(current?.html);
    const local = Array.isArray(current?.whisperAlignment) ? current.whisperAlignment : [];
    for (let i = 0; i < count; i += 1) {
      const match = local[i];
      mergedAlignment[wordOffset + i] = match ? { ...match, msIdx: wordOffset + i } : null;
    }
    wordOffset += count;
  }

  return {
    ...sectionWithMeta,
    html: allSections.map(s => s.html || '').join(''),
    whisperAlignment: hasCurrentMergedTranscription ? mergedAlignment : [],
    whisperWords: hasCurrentMergedTranscription ? (allSections.find(s => Array.isArray(s.whisperWords) && s.whisperWords.length)?.whisperWords || section?.whisperWords || []) : [],
    proofInitialWordOffset: prefixWordCount,
  };
}

function buildPersistentPlayerLabel(book, section) {
  if (!book || !section) return section?.title || section?.chapterTitle || '';
  const ctx = findSectionContext(book, section.id);
  const chapter = ctx?.chapter || null;
  const chapterNumber = chapter?.chapterNumber || (ctx ? ctx.chapterIndex + 1 : null);
  const narrator = section?.narratorName || section?.characterName || 'Narrating';
  const sceneTitle = section?.title || section?.chapterTitle || '';
  const parts = [];
  if (chapterNumber) parts.push(`Ch ${chapterNumber}`);
  if (sceneTitle) parts.push(sceneTitle);
  if (narrator) parts.push(narrator);
  return parts.join(' · ');
}

function formatRelativeFromNow(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t) || t <= 0) return '';
  const diff = Math.max(0, Date.now() - t);
  if (diff < 30 * 1000) return 'just now';
  if (diff < 60 * 1000) return 'a moment ago';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  return new Date(t).toLocaleString();
}

function formatSaveLocation(dataLocation) {
  if (!dataLocation?.primaryPath) return 'Not available yet';
  return dataLocation.primaryPath;
}

const LISTEN_SPEED_PRESETS = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
const APP_MODE_STORAGE_KEY = 'ap-app-mode-v1';
const TUTORIAL_STORAGE_KEY = 'ap-tutorial-enabled-v3';
const TUTORIAL_STEPS = [
  {
    id: 'save-location',
    selector: '[data-tutorial="save-location-card"]',
    title: 'Check the save folder first',
    body: 'Use one shared Save Data folder if you switch between Mac and Windows.',
  },
  {
    id: 'create-book',
    selector: '[data-tutorial="create-book"]',
    title: 'Start a new book here',
    body: 'Click New Book to begin.',
  },
  {
    id: 'book-title',
    selector: '[data-tutorial="book-title"]',
    title: 'Name the book first',
    body: 'Add the book title before you upload the manuscript.',
  },
  {
    id: 'manuscript-upload',
    selector: '[data-tutorial="manuscript-upload"]',
    title: 'Upload the full manuscript',
    body: 'Upload the manuscript `.docx` here.',
  },
  {
    id: 'narrator-mapping',
    selector: '[data-tutorial="narrator-mapping"]',
    title: 'Check character and narrator names',
    body: 'Check the character and narrator names before saving.',
  },
  {
    id: 'review-chapters',
    selector: '[data-tutorial="review-chapters"]',
    title: 'Clean up the imported chapters',
    body: 'Untick anything you do not want imported.',
  },
  {
    id: 'save-book',
    selector: '[data-tutorial="save-book"]',
    title: 'Save the book',
    body: 'Save once the structure looks right.',
  },
  {
    id: 'add-audio',
    selector: '[data-tutorial="bulk-audio-card"]',
    title: 'Add audio',
    body: 'Attach chapter or scene audio here.',
  },
  {
    id: 'transcribe-all',
    selector: '[data-tutorial="transcribe-all"]',
    title: 'Transcribe all chapters',
    lead: 'This can take a while, so press it once and let it finish.',
    body: 'If you stop partway through, transcription stops there. Any chapter that already finished will stay transcribed. You can still proof without this if you do not need word sync.',
  },
];

function hasTutorialTarget(selector) {
  return typeof document !== 'undefined' && !!document.querySelector(selector);
}

function getTutorialInputValue(selector) {
  if (typeof document === 'undefined') return '';
  const input = document.querySelector(`${selector} input[type="text"]`);
  return String(input?.value || '').trim();
}

function manuscriptUploadLooksComplete() {
  if (typeof document === 'undefined') return false;
  if (document.querySelector('[data-tutorial="review-chapters"]')) return true;
  if (document.querySelector('[data-tutorial="narrator-mapping"]')) return true;
  const uploadCard = document.querySelector('[data-tutorial="manuscript-upload"]');
  return !!uploadCard && /re-upload|sections|chapters/i.test(uploadCard.textContent || '');
}

function bookHasAttachedAudio(book) {
  return !!(book?.chapters || []).some(ch => (ch.sections || []).some(section => !!getSectionStoredAudioPath(section)));
}

function bookHasTranscriptions(book) {
  return !!(book?.chapters || []).some(ch => (ch.sections || []).some(section => !!section?.transcribedAt));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Merge local Proof books with the cloud-pulled list. Cloud books carry
// a `cloudId` (the Supabase row uuid). When a local book and a cloud
// book share the same local `id`, the one with the newer updated time
// wins, but we always preserve the cloudId so subsequent pushes update
// the same row instead of creating a duplicate.
//
// IMPORTANT: audio paths are stripped on every upload (audio-guard
// keeps audio off Supabase). So the cloud copy NEVER has audioPath /
// audioPaths. When the cloud version wins on time (e.g. after a flag
// saved on the phone), we splice the local audioPath / audioPaths back
// in by matching section.id — otherwise Marie's audio attachments get
// wiped on every cloud-newer pull.
function mergeProofBookLists(localBooks, cloudBooks) {
  const byId = new Map((localBooks || []).map((b) => [b.id, b]));
  for (const cb of cloudBooks || []) {
    if (!cb?.id) continue;
    const existing = byId.get(cb.id);
    if (!existing) {
      byId.set(cb.id, cb);
      continue;
    }
    const localTime = Number(existing.updatedAt) || 0;
    const cloudTime = Date.parse(cb.updatedAt) || 0;
    if (cloudTime > localTime) {
      byId.set(cb.id, mergePreservingLocalAudio(existing, cb));
    } else {
      byId.set(cb.id, { ...existing, cloudId: cb.cloudId || existing.cloudId });
    }
  }
  return Array.from(byId.values());
}

// When cloud wins on time, take the cloud book but overlay the local
// audioPath / audioPaths / audioDurationCache so the user's audio
// attachments survive every cloud sync. (Audio never travels to the
// cloud — only the filename does.)
function mergePreservingLocalAudio(localBook, cloudBook) {
  const localSectionsById = new Map();
  (localBook?.chapters || []).forEach((ch) => {
    (ch.sections || []).forEach((sec) => {
      if (sec?.id) localSectionsById.set(sec.id, sec);
    });
  });
  return {
    ...cloudBook,
    cloudId: cloudBook.cloudId,
    audioDurationCache: localBook?.audioDurationCache || cloudBook?.audioDurationCache,
    chapters: (cloudBook.chapters || []).map((ch) => ({
      ...ch,
      sections: (ch.sections || []).map((sec) => {
        const localSec = sec?.id ? localSectionsById.get(sec.id) : null;
        if (!localSec) return sec;
        const merged = { ...sec };
        if (localSec.audioPath !== undefined) merged.audioPath = localSec.audioPath;
        if (localSec.audioPaths !== undefined) merged.audioPaths = localSec.audioPaths;
        return merged;
      }),
    })),
  };
}

export default function Home() {
  const [appMode, setAppMode] = useState('default');
  const [view, setView] = useState('home');
  const [books, setBooks] = useState([]);
  const [activeBook, setActiveBook] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [bookPlayerState, setBookPlayerState] = useState({ currentTime: 0, isPlaying: false, playbackRate: 1 });
  const [bookPlayerLabel, setBookPlayerLabel] = useState('');
  const [isElectron, setIsElectron] = useState(false);
  const [dataLocation, setDataLocation] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioUploadMode, setAudioUploadMode] = useState('chapter');
  const [readerIncludeChapterPreroll, setReaderIncludeChapterPreroll] = useState(true);
  const [readerDefaultListeningSpeed, setReaderDefaultListeningSpeed] = useState(2);
  const [pagefinderColumn, setPagefinderColumn] = useState('G');
  const [pagefinderStartRow, setPagefinderStartRow] = useState(6);
  const [pagefinderPageOffset, setPagefinderPageOffset] = useState(-1);
  const [tutorialEnabled, setTutorialEnabled] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(-1);
  const [tutorialWrapUpOpen, setTutorialWrapUpOpen] = useState(false);
  const [tutorialIntroOpen, setTutorialIntroOpen] = useState(false);
  const [transferNotice, setTransferNotice] = useState(null);
  const [transferProgress, setTransferProgress] = useState(null);
  const [tutorialStartRequested, setTutorialStartRequested] = useState(false);
  const [tutorialMinimized, setTutorialMinimized] = useState(false);
  const [tutorialCompletedIds, setTutorialCompletedIds] = useState([]);
  const [authReady, setAuthReady] = useState(!hasSupabaseConfig);
  const [authSession, setAuthSession] = useState(null);
  const bookDetailScrollRef = useRef(0);
  const cameFromProofCloudRef = useRef(false);
  const proofCloudPushTimerRef = useRef(null);
  const clientPlatform = typeof navigator === 'undefined'
    ? 'unknown'
    : String(navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  const usesCustomDragRegion = isElectron && clientPlatform.includes('mac');

  useEffect(() => {
    setIsElectron(!!el());
    loadBooks().then(setBooks).catch((error) => {
      console.error('Failed to load books.', error);
    });
    if (el()) window.electron.getDataLocation?.().then(setDataLocation).catch((error) => {
      console.error('Failed to load data location.', error);
    });
    try {
      const storedMode = localStorage.getItem(APP_MODE_STORAGE_KEY);
      if (['default','prep-manuscript','prebuild','quill'].includes(storedMode)) setAppMode(storedMode);
    } catch {}
    try {
      const stored = localStorage.getItem('ap-audio-upload-mode');
      if (stored === 'chapter' || stored === 'scene') setAudioUploadMode(stored);
    } catch {}
    try {
      const preroll = localStorage.getItem('ap-include-chapter-preroll');
      if (preroll != null) setReaderIncludeChapterPreroll(preroll !== '0');
    } catch {}
    try {
      const speed = Number(localStorage.getItem('ap-default-listening-speed'));
      if (Number.isFinite(speed) && speed >= 0.5 && speed <= 3) {
        if (LISTEN_SPEED_PRESETS.includes(speed)) {
          setReaderDefaultListeningSpeed(speed);
        } else {
          setReaderDefaultListeningSpeed(2);
          localStorage.setItem('ap-default-listening-speed', '2');
        }
      }
    } catch {}
    try {
      const column = String(localStorage.getItem('ap-pagefinder-column') || 'G').toUpperCase().slice(0, 1);
      if (/^[A-Z]$/.test(column)) setPagefinderColumn(column);
    } catch {}
    try {
      const startRow = Number(localStorage.getItem('ap-pagefinder-start-row'));
      if (Number.isFinite(startRow) && startRow >= 1) setPagefinderStartRow(Math.floor(startRow));
    } catch {}
    try {
      const offset = Number(localStorage.getItem('ap-pagefinder-page-offset'));
      if (Number.isFinite(offset) && offset >= -200 && offset <= 200) setPagefinderPageOffset(Math.floor(offset));
    } catch {}
    try {
      setTutorialEnabled(localStorage.getItem(TUTORIAL_STORAGE_KEY) === '1');
    } catch {}
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setAuthReady(true);
      return undefined;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthReady(true);
      return undefined;
    }
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setAuthSession(data?.session || null);
      setAuthReady(true);
    }).catch(() => {
      if (cancelled) return;
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session || null);
    });
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Cloud pull state — last-success timestamp + the imperative resync
  // handler used by the Resync button on HomePage. The button matters
  // because focus-pull doesn't fire when the window has been continuously
  // focused (Marie's case: phone saved, desktop already open).
  const [lastProofPullAt, setLastProofPullAt] = useState(0);
  const [proofPullError, setProofPullError] = useState('');
  const [proofPullInflight, setProofPullInflight] = useState(false);

  const resyncProof = useCallback(async () => {
    if (!hasSupabaseConfig || !authReady || !authSession?.user) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setProofPullInflight(true);
    try {
      const rawCloudBooks = await pullProofProjects(supabase);
      const cloudBooks = applyTombstonesToCloudList('proof', rawCloudBooks || [], supabase, deleteProofProject);
      if (cloudBooks.length) {
        cameFromProofCloudRef.current = true;
        setBooks((current) => mergeProofBookLists(current, cloudBooks));
      }
      setLastProofPullAt(Date.now());
      setProofPullError('');
    } catch (e) {
      const msg = e?.message || String(e);
      console.warn('[Proof] cloud pull failed:', msg);
      setProofPullError(msg);
    } finally {
      setProofPullInflight(false);
    }
  }, [authReady, authSession]);

  // Pull Proof books from Supabase once auth is ready + signed in. Merge
  // with whatever loaded locally so a fresh machine sees cloud-only
  // books and an offline-first machine doesn't lose its local edits.
  //
  // ALSO re-pull when the window regains focus / becomes visible — this
  // catches the "I saved a flag on the phone while desktop was idle"
  // case so the desktop doesn't push a stale book back over it.
  useEffect(() => {
    if (!hasSupabaseConfig || !authReady || !authSession?.user) return undefined;
    let cancelled = false;
    resyncProof();
    const onFocus = () => { if (!cancelled) resyncProof(); };
    const onVisibility = () => { if (!cancelled && typeof document !== 'undefined' && document.visibilityState === 'visible') resyncProof(); };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [authReady, authSession, resyncProof]);

  // Debounced cloud push whenever Proof books change. Fire-and-forget
  // so a slow Supabase round-trip never blocks the local save. The
  // cameFromProofCloudRef guard stops the cloud pull echoing back as a
  // write.
  useEffect(() => {
    if (!hasSupabaseConfig || !authReady || !authSession?.user) return undefined;
    if (!books?.length) return undefined;
    if (cameFromProofCloudRef.current) {
      cameFromProofCloudRef.current = false;
      return undefined;
    }
    if (proofCloudPushTimerRef.current) clearTimeout(proofCloudPushTimerRef.current);
    proofCloudPushTimerRef.current = setTimeout(async () => {
      const supabase = getSupabaseClient();
      const ownerId = authSession?.user?.id;
      if (!supabase || !ownerId) return;
      try {
        const results = await Promise.all(books.map(async (book) => {
          try {
            const cloudId = await pushProofProject(supabase, book, ownerId);
            return cloudId && cloudId !== book.cloudId ? { id: book.id, cloudId } : null;
          } catch (e) {
            console.warn('[Proof] cloud push failed for', book?.title, e?.message || e);
            return null;
          }
        }));
        const updates = results.filter(Boolean);
        if (updates.length) {
          cameFromProofCloudRef.current = true;
          setBooks((all) => all.map((b) => {
            const u = updates.find((x) => x.id === b.id);
            return u ? { ...b, cloudId: u.cloudId } : b;
          }));
        }
      } catch (e) {
        console.warn('[Proof] cloud push batch failed:', e?.message || e);
      }
    }, 1200);
    return () => { if (proofCloudPushTimerRef.current) clearTimeout(proofCloudPushTimerRef.current); };
  }, [books, authReady, authSession]);

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await signOutSupabaseAccount(supabase);
    setAuthSession(null);
  }

  useEffect(() => {
    if (!el() || !window.electron?.onTransferProgress) return undefined;
    return window.electron.onTransferProgress((progress) => {
      setTransferProgress(prev => ({
        active: progress?.active !== false,
        minimized: prev?.minimized || false,
        percent: Math.max(0, Math.min(100, Math.round(Number(progress?.percent) || 0))),
        message: progress?.message || 'Preparing transfer...',
      }));
    });
  }, []);

  function handleAudioUploadModeChange(nextMode) {
    const safeMode = nextMode === 'scene' ? 'scene' : 'chapter';
    setAudioUploadMode(safeMode);
    try { localStorage.setItem('ap-audio-upload-mode', safeMode); } catch {}
  }

  function handleReaderIncludeChapterPrerollChange(next) {
    const on = !!next;
    setReaderIncludeChapterPreroll(on);
    try { localStorage.setItem('ap-include-chapter-preroll', on ? '1' : '0'); } catch {}
  }

  function handleReaderDefaultListeningSpeedChange(next) {
    const speed = Math.max(0.5, Math.min(3, Number(next) || 2));
    const snapped = LISTEN_SPEED_PRESETS.reduce((best, val) => (
      Math.abs(val - speed) < Math.abs(best - speed) ? val : best
    ), 2);
    setReaderDefaultListeningSpeed(snapped);
    try { localStorage.setItem('ap-default-listening-speed', String(snapped)); } catch {}
  }

  function handlePagefinderColumnChange(next) {
    const column = String(next || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1) || 'G';
    setPagefinderColumn(column);
    try { localStorage.setItem('ap-pagefinder-column', column); } catch {}
  }

  function handlePagefinderStartRowChange(next) {
    const row = Math.max(1, Math.floor(Number(next) || 6));
    setPagefinderStartRow(row);
    try { localStorage.setItem('ap-pagefinder-start-row', String(row)); } catch {}
  }

  function handlePagefinderPageOffsetChange(next) {
    const offset = Math.max(-200, Math.min(200, Math.floor(Number(next) || 0)));
    setPagefinderPageOffset(offset);
    try { localStorage.setItem('ap-pagefinder-page-offset', String(offset)); } catch {}
  }

  async function persist(updated) {
    const normalized = normalizeBooks(updated);
    setBooks(normalized);
    await persistBooks(normalized);
  }

  function saveBook(book) {
    const updated = [book, ...books.filter(b => b.id !== book.id)];
    persist(updated);
    setActiveBook(book);
    setView('bookDetail');
  }

  function updateBook(bookId, updatesOrUpdater) {
    setBooks(prevBooks => {
      const updated = prevBooks.map(book => {
        if (book.id !== bookId) return book;
        const updates = typeof updatesOrUpdater === 'function'
          ? updatesOrUpdater(book)
          : updatesOrUpdater;
        return { ...book, ...(updates || {}) };
      });
      const normalized = normalizeBooks(updated);
      persistBooks(normalized).catch(() => {});
      return normalized;
    });
    setActiveBook(prev => {
      if (prev?.id !== bookId) return prev;
      const updates = typeof updatesOrUpdater === 'function'
        ? updatesOrUpdater(prev)
        : updatesOrUpdater;
      return normalizeBookPaging({ ...prev, ...(updates || {}) });
    });
  }

  async function rescanBookPageMap(bookId, manuscriptFile = null) {
    if (!el() || !window.electron?.rescanBookPageMap) {
      throw new Error('Page rescanning is only available in the desktop app.');
    }

    const book = books.find(entry => entry.id === bookId) || activeBook;
    if (!book) throw new Error('Book not found.');

    let manuscriptSource = book.manuscriptSource || { stored: false, fileName: book.fileName || '' };
    if (manuscriptFile) {
      if (!window.electron?.saveManuscriptSource) {
        throw new Error('The app cannot store the manuscript source yet.');
      }
      await window.electron.saveManuscriptSource({
        bookId,
        data: new Uint8Array(await manuscriptFile.arrayBuffer()),
      });
      manuscriptSource = {
        stored: true,
        fileName: manuscriptFile.name,
      };
    }

    const converted = await window.electron.rescanBookPageMap({
      bookId,
      fileName: manuscriptSource.fileName || book.fileName || 'manuscript.docx',
      pageOffset: pagefinderPageOffset,
    });
    const nextPdfPaging = converted?.pdfPaging;
    if (!nextPdfPaging?.pageCount) {
      throw new Error('The manuscript was converted, but no PDF page map was generated.');
    }

    const updated = books.map(entry => entry.id === bookId ? {
      ...entry,
      manuscriptSource,
      pdfPaging: {
        mode: nextPdfPaging.mode,
        fileName: converted.fileName || nextPdfPaging.fileName,
        pageOffset: Number.isFinite(Number(nextPdfPaging.pageOffset)) ? Number(nextPdfPaging.pageOffset) : pagefinderPageOffset,
        pageCount: nextPdfPaging.pageCount,
        printedPageCount: nextPdfPaging.printedPageCount,
        pages: nextPdfPaging.pages,
      },
    } : entry);
    await persist(updated);
    if (activeBook?.id === bookId) {
      setActiveBook(prev => prev ? ({
        ...prev,
        manuscriptSource,
        pdfPaging: {
          mode: nextPdfPaging.mode,
          fileName: converted.fileName || nextPdfPaging.fileName,
          pageOffset: Number.isFinite(Number(nextPdfPaging.pageOffset)) ? Number(nextPdfPaging.pageOffset) : pagefinderPageOffset,
          pageCount: nextPdfPaging.pageCount,
          printedPageCount: nextPdfPaging.printedPageCount,
          pages: nextPdfPaging.pages,
        },
      }) : prev);
    }

    return {
      message: `Exact page map regenerated from ${manuscriptSource.fileName || 'the manuscript'} (${nextPdfPaging.pageCount} PDF pages).`,
    };
  }

  function deleteBook(id) {
    const target = books.find(b => b.id === id);
    // Tombstone BEFORE any state changes so a focus-pull racing this
    // delete doesn't resurrect the book. If the cloud delete fails or
    // is slow, applyTombstonesToCloudList will retry it on every pull
    // until the cloud row is gone.
    addTombstone('proof', { id, cloudId: target?.cloudId });
    persist(books.filter(b => b.id !== id));
    setView('home');
    if (target?.cloudId) {
      const supabase = getSupabaseClient();
      if (supabase) {
        deleteProofProject(supabase, target.cloudId).catch((e) => {
          console.warn('[Proof] cloud delete failed:', e?.message || e);
        });
      }
    }
  }

  async function startProofing(section, url, startSec) {
    if (typeof window !== 'undefined') {
      bookDetailScrollRef.current = window.scrollY || window.pageYOffset || document.documentElement?.scrollTop || 0;
    }
    const nextSection = (Number.isFinite(startSec) && startSec >= 0)
      ? { ...section, proofStartSec: Math.max(0, Number(startSec) || 0) }
      : section;
    setActiveSection(nextSection);
    if (audioUrl && audioUrl.startsWith('blob:') && audioUrl !== url) URL.revokeObjectURL(audioUrl);
    setAudioUrl(url);
    setBookPlayerLabel(buildPersistentPlayerLabel(activeBook, nextSection));
    setView('reading');
  }

  function returnToActiveScene() {
    if (!activeSection || !audioUrl) return;
    const snapshotTime = Math.max(0, Number(bookPlayerState?.currentTime) || 0);
    startProofing(activeSection, audioUrl, snapshotTime);
  }

  function restoreBookDetailScroll() {
    if (typeof window === 'undefined') return;
    const y = Math.max(0, Number(bookDetailScrollRef.current) || 0);
    const restore = () => window.scrollTo({ top: y, behavior: 'auto' });
    requestAnimationFrame(restore);
    window.setTimeout(restore, 80);
    window.setTimeout(restore, 220);
    window.setTimeout(restore, 450);
  }

  async function jumpToReaderScene(sceneId) {
    const ctx = findSectionContext(activeBook, activeSection?.id);
    if (!ctx) return;
    const sections = ctx.chapter.sections || [];
    const targetBase = sections.find(sec => sec.id === sceneId);
    if (!targetBase) return;

    const currentKey = sectionAudioKey(sections[ctx.sectionIndex]);
    const targetKey = sectionAudioKey(targetBase);
    if (!currentKey || currentKey !== targetKey) return;

    let targetUrl = audioUrl;
    if (!targetUrl && el() && window.electron?.getAudioUrl) {
      try {
        const storedAudioPath = getSectionStoredAudioPath(targetBase);
        if (storedAudioPath) targetUrl = await window.electron.getAudioUrl(storedAudioPath);
      } catch {
        targetUrl = null;
      }
    }
    if (!targetUrl) return;

    const target = buildContinuousChapterSection(ctx.chapter, targetBase);
    startProofing(target, targetUrl);
  }

  function canNavigateReaderChapter(direction) {
    const ctx = findSectionContext(activeBook, activeSection?.id);
    if (!ctx) return false;
    const chapters = activeBook?.chapters || [];
    const targetChapterIndex = ctx.chapterIndex + direction;
    if (targetChapterIndex < 0 || targetChapterIndex >= chapters.length) return false;
    const targetChapter = chapters[targetChapterIndex];
    const targetSection = (targetChapter?.sections || []).find(s => !!sectionAudioKey(s));
    return !!targetSection;
  }

  async function navigateReaderChapter(direction) {
    const ctx = findSectionContext(activeBook, activeSection?.id);
    if (!ctx) return;
    const chapters = activeBook?.chapters || [];
    const targetChapterIndex = ctx.chapterIndex + direction;
    if (targetChapterIndex < 0 || targetChapterIndex >= chapters.length) return;
    const targetChapter = chapters[targetChapterIndex];
    const targetSectionBase = (targetChapter?.sections || []).find(s => !!sectionAudioKey(s));
    if (!targetSectionBase) return;

    let targetUrl = null;
    const currentKey = sectionAudioKey(activeSection);
    const targetKey = sectionAudioKey(targetSectionBase);
    if (audioUrl && currentKey && targetKey && currentKey === targetKey) {
      targetUrl = audioUrl;
    } else if (el() && window.electron?.getAudioUrl) {
      try {
        const storedAudioPath = getSectionStoredAudioPath(targetSectionBase);
        if (storedAudioPath) targetUrl = await window.electron.getAudioUrl(storedAudioPath);
      } catch {
        targetUrl = null;
      }
    }

    if (!targetUrl) {
      alert('Could not open chapter audio for this jump. Re-select chapter audio first.');
      return;
    }

    const targetSection = buildContinuousChapterSection(targetChapter, targetSectionBase);
    startProofing({ ...targetSection, proofStartSec: 0 }, targetUrl, 0);
  }

  function saveFlags(chapterId, sectionId, flags) {
    if (!activeBook) return;
    const chapters = activeBook.chapters.map(ch => ({
      ...ch,
      sections: ch.sections.map(s =>
        s.id === sectionId ? { ...s, flags, lastProofed: new Date().toLocaleDateString() } : s
      )
    }));
    updateBook(activeBook.id, { chapters });
    setActiveSection(prev => ({ ...prev, flags }));
  }

  function toggleComplete(sectionId) {
    if (!activeBook) return;
    const chapters = activeBook.chapters.map(ch => ({
      ...ch,
      sections: ch.sections.map(s => s.id === sectionId ? { ...s, completed: !s.completed } : s)
    }));
    updateBook(activeBook.id, { chapters });
  }

  async function importBooks(data) {
    try {
      const arr = Array.isArray(JSON.parse(data)) ? JSON.parse(data) : [JSON.parse(data)];
      const merged = [...arr, ...books].filter((b,i,a) => a.findIndex(x=>x.id===b.id)===i);
      await persist(merged);
      alert(`Imported ${arr.length} book(s).`);
    } catch { alert('Invalid file.'); }
  }

  async function exportBackup() {
    if (el()) { await window.electron.exportBackup(books); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(books,null,2)],{type:'application/json'}));
    a.download = 'audiobook-proofer-backup.json'; a.click();
  }

  async function handleImport() {
    if (el()) {
      const data = await window.electron.importBackup();
      if (data) importBooks(data);
      return;
    }
    // web fallback via file input (handled in HomePage)
  }

  async function handleTransferImport() {
    if (!el() || !window.electron?.importTransferBundle) {
      alert('Transfer import is available in the desktop app.');
      return;
    }
    try {
      const result = await window.electron.importTransferBundle();
      if (!result?.book) return;
      const importedBook = normalizeBookPaging(result.book);
      const updated = [importedBook, ...books.filter(b => b.id !== importedBook.id)];
      await persist(updated);
      setActiveBook(importedBook);
      setView('bookDetail');
      setTransferNotice({
        title: 'Audiobook imported',
        lines: [
          `Imported "${importedBook.title}".`,
          `${result.audioCount || 0} bundled audio file(s) were linked.`,
        ],
        warnings: [
          ...(result.missingAudio || []).map(item => `Missing audio: ${item}`),
          ...(result.failedAudio || []).map(item => `Audio copy failed during export: ${item}`),
        ],
      });
    } catch (error) {
      setTransferNotice({
        title: 'Import did not finish',
        lines: [error.message],
        tone: 'error',
      });
    }
  }

  async function handleTransferExport(book) {
    if (!el() || !window.electron?.exportTransferBundle) {
      alert('Transfer export is available in the desktop app.');
      return;
    }
    try {
      setTransferProgress({ active: true, minimized: false, percent: 0, message: 'Choose where to save the transfer folder...' });
      const result = await window.electron.exportTransferBundle(book);
      setTransferProgress(null);
      if (!result) return;
      setTransferNotice({
        title: 'Transfer folder created',
        folderPath: result.folderPath,
        lines: [
          `Copied ${result.audioCount || 0} audio file(s).`,
          result.hasManuscript ? 'Included manuscript source.' : 'No stored manuscript source was found.',
          result.hasPageMap ? 'Included the app page-number map.' : 'No app page-number map was found.',
        ],
        warnings: [
          ...(result.missingAudio || []).map(item => `Missing audio: ${item}`),
          ...(result.failedAudio || []).map(item => `Could not verify copied audio: ${item}`),
        ],
      });
    } catch (error) {
      setTransferProgress(null);
      setTransferNotice({
        title: 'Transfer did not finish',
        lines: [error.message],
        tone: 'error',
      });
    }
  }

  async function handleChangeDataLocation() {
    if (!el() || !window.electron.chooseDataLocation) return;
    const nextLocation = await window.electron.chooseDataLocation();
    if (!nextLocation) return;
    setDataLocation(nextLocation);
    setBooks(await loadBooks());
  }

  function setTutorialEnabledPersisted(nextEnabled) {
    setTutorialEnabled(nextEnabled);
    try { localStorage.setItem(TUTORIAL_STORAGE_KEY, nextEnabled ? '1' : '0'); } catch {}
  }

  function restartTutorial() {
    setTutorialEnabledPersisted(true);
    setTutorialActive(false);
    setTutorialStep(-1);
    setTutorialWrapUpOpen(false);
    setTutorialIntroOpen(true);
    setTutorialMinimized(false);
    setTutorialStartRequested(false);
    setTutorialCompletedIds([]);
    setSettingsOpen(true);
    setView('home');
    setActiveSection(null);
    setAudioUrl(null);
    setBookPlayerLabel('');
  }

  function handleTutorialEnabledChange(nextEnabled) {
    setTutorialEnabledPersisted(nextEnabled);
    if (!nextEnabled) {
      setTutorialActive(false);
      setTutorialStep(-1);
      setTutorialWrapUpOpen(false);
      setTutorialIntroOpen(false);
      setTutorialMinimized(false);
      setTutorialStartRequested(false);
      setTutorialCompletedIds([]);
      return;
    }
    setTutorialActive(false);
    setTutorialStep(-1);
    setTutorialWrapUpOpen(false);
    setTutorialIntroOpen(false);
    setTutorialMinimized(false);
    setTutorialStartRequested(true);
    setTutorialCompletedIds([]);
  }

  useEffect(() => {
    if (!tutorialEnabled || !tutorialStartRequested || !settingsOpen) return;
    setTutorialIntroOpen(true);
    setTutorialStartRequested(false);
  }, [tutorialEnabled, tutorialStartRequested, settingsOpen]);

  const completedTutorialIdsSet = new Set(tutorialCompletedIds);

  function finishTutorial() {
    setTutorialActive(false);
    setTutorialWrapUpOpen(true);
    setTutorialMinimized(false);
    setTutorialStep(TUTORIAL_STEPS.length);
  }

  function isTutorialStepAutoComplete(step) {
    if (!step) return false;
    switch (step.id) {
      case 'save-location':
        return !settingsOpen || view !== 'home';
      case 'create-book':
        return view === 'newBook';
      case 'book-title':
        return view === 'newBook' && getTutorialInputValue('[data-tutorial="book-title"]').length > 0;
      case 'manuscript-upload':
        return view === 'newBook' && manuscriptUploadLooksComplete();
      case 'narrator-mapping':
        return false;
      case 'review-chapters':
        return false;
      case 'save-book':
        return view === 'bookDetail';
      case 'add-audio':
        return bookHasAttachedAudio(activeBook);
      case 'transcribe-all':
        return bookHasTranscriptions(activeBook);
      default:
        return false;
    }
  }

  function goToNextTutorialStep(fromIndex, completedIds = tutorialCompletedIds) {
    const completedSet = new Set(completedIds);
    for (let index = fromIndex + 1; index < TUTORIAL_STEPS.length; index += 1) {
      if (!completedSet.has(TUTORIAL_STEPS[index].id)) {
        setTutorialStep(index);
        return;
      }
    }
    finishTutorial();
  }

  function completeTutorialStep(stepIndex = tutorialStep) {
    const step = TUTORIAL_STEPS[stepIndex];
    if (!step) return;
    const nextCompletedIds = completedTutorialIdsSet.has(step.id)
      ? tutorialCompletedIds
      : [...tutorialCompletedIds, step.id];
    setTutorialCompletedIds(nextCompletedIds);
    if (step.id === 'save-location' && settingsOpen) setSettingsOpen(false);
    goToNextTutorialStep(stepIndex, nextCompletedIds);
  }

  function closeTutorial() {
    setTutorialActive(false);
    setTutorialWrapUpOpen(false);
    setTutorialIntroOpen(false);
    setTutorialMinimized(false);
    setTutorialStep(-1);
    setTutorialCompletedIds([]);
    setSettingsOpen(false);
  }

  function endTutorial() {
    handleTutorialEnabledChange(false);
    setSettingsOpen(false);
  }

  function startTutorialFromIntro() {
    setTutorialIntroOpen(false);
    setTutorialMinimized(false);
    setTutorialCompletedIds([]);
    setTutorialActive(true);
    setTutorialStep(0);
  }

  function minimizeTutorial() {
    setTutorialIntroOpen(false);
    if (tutorialActive) setTutorialMinimized(true);
  }

  function expandTutorial() {
    setTutorialMinimized(false);
  }

  const currentTutorialStep = tutorialActive && tutorialStep >= 0 && tutorialStep < TUTORIAL_STEPS.length
    ? TUTORIAL_STEPS[tutorialStep]
    : null;
  const currentTutorialTargetAvailable = currentTutorialStep?.selector
    ? hasTutorialTarget(currentTutorialStep.selector)
    : false;
  const activeReaderContext = findSectionContext(activeBook, activeSection?.id);
  const readerSceneOptions = activeReaderContext
    ? (activeReaderContext.chapter.sections || [])
        .filter(sec => {
          const currentKey = sectionAudioKey(activeReaderContext.section);
          const targetKey = sectionAudioKey(sec);
          return !!currentKey && currentKey === targetKey;
        })
        .map(sec => ({ id: sec.id, title: sec.title || sec.chapterTitle || 'Scene' }))
    : [];

  function handleAppModeChange(nextMode) {
    const allowed = APP_MODES.some((m) => m.id === nextMode);
    if (!allowed) return;
    setAppMode(nextMode);
    setSettingsOpen(false);
    try {
      localStorage.setItem(APP_MODE_STORAGE_KEY, nextMode);
    } catch {}
  }

  useEffect(() => {
    if (!tutorialActive) return;
    if (currentTutorialStep?.id !== 'add-audio') return;
    if (audioUploadMode === 'chapter') return;
    handleAudioUploadModeChange('chapter');
  }, [tutorialActive, currentTutorialStep, audioUploadMode]);

  useEffect(() => {
    if (!currentTutorialStep?.selector || !currentTutorialTargetAvailable || tutorialMinimized || typeof document === 'undefined') return;
    const node = document.querySelector(currentTutorialStep.selector);
    if (!node?.scrollIntoView) return;
    const timer = window.setTimeout(() => {
      node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [currentTutorialStep?.id, currentTutorialTargetAvailable, tutorialMinimized]);

  useEffect(() => {
    if (!tutorialActive || tutorialStep < 0 || tutorialStep >= TUTORIAL_STEPS.length) return;
    if (!currentTutorialStep) return;

    let cancelled = false;
    const maybeAdvance = () => {
      if (cancelled || !isTutorialStepAutoComplete(currentTutorialStep)) return;
      completeTutorialStep(tutorialStep);
    };

    const initialTimer = window.setTimeout(maybeAdvance, 180);
    const interval = window.setInterval(maybeAdvance, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [tutorialActive, tutorialStep, currentTutorialStep, view, settingsOpen, activeBook, tutorialCompletedIds]);

  if (hasSupabaseConfig && !authReady) {
    return (
      <div style={{ minHeight:'100vh', background:'var(--cream)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {usesCustomDragRegion && (
          <div style={{ position:'fixed', top:0, left:0, right:0, height:38, WebkitAppRegion:'drag', zIndex:1100 }} />
        )}
        <div style={{ fontSize:'0.86rem', color:'var(--text-muted)' }}>Checking your account…</div>
      </div>
    );
  }

  if (hasSupabaseConfig && !authSession) {
    return (
      <LoginScreen
        onSignedIn={(session) => setAuthSession(session)}
        usesCustomDragRegion={usesCustomDragRegion}
      />
    );
  }

  if (appMode === 'prebuild') {
    return (
      <div style={{ ...modeAccentVars('duet'), minHeight:'100vh', background:'var(--cream)' }}>
        {usesCustomDragRegion && (
          <div style={{ position:'fixed', top:0, left:0, right:0, height:38, WebkitAppRegion:'drag', zIndex:1100 }} />
        )}
        <ProfilePill tone="duet" email={authSession?.user?.email || ''} onSignOut={handleSignOut} usesCustomDragRegion={usesCustomDragRegion} />
        <PrebuildMode modeToggle={<AppModeToggle mode={appMode} onChange={handleAppModeChange} usesCustomDragRegion={usesCustomDragRegion} />} />
      </div>
    );
  }

  if (appMode === 'prep-manuscript') {
    return (
      <div style={{ ...modeAccentVars('prep'), minHeight:'100vh' }}>
        <ProfilePill tone="prep" email={authSession?.user?.email || ''} onSignOut={handleSignOut} usesCustomDragRegion={usesCustomDragRegion} />
        <PrepManuscriptMode
          modeToggle={<AppModeToggle mode={appMode} onChange={handleAppModeChange} usesCustomDragRegion={usesCustomDragRegion} />}
          usesCustomDragRegion={usesCustomDragRegion}
        />
      </div>
    );
  }

  if (appMode === 'quill') {
    return (
      <div style={{ ...modeAccentVars('quill'), minHeight:'100vh' }}>
        <ProfilePill tone="quill" email={authSession?.user?.email || ''} onSignOut={handleSignOut} usesCustomDragRegion={usesCustomDragRegion} />
        <QuillAndInkMode
          modeToggle={<AppModeToggle mode={appMode} onChange={handleAppModeChange} usesCustomDragRegion={usesCustomDragRegion} />}
          usesCustomDragRegion={usesCustomDragRegion}
        />
      </div>
    );
  }

  return (
    <div style={{ ...modeAccentVars('proof'), minHeight:'100vh', background:'var(--cream)' }}>
      <ProfilePill tone="proof" email={authSession?.user?.email || ''} onSignOut={handleSignOut} usesCustomDragRegion={usesCustomDragRegion} />
      {usesCustomDragRegion && (
        <div style={{ position:'fixed', top:0, left:0, right:0, height:38, WebkitAppRegion:'drag', zIndex:1100 }} />
      )}
      {view==='home' && <AppModeToggle mode={appMode} onChange={handleAppModeChange} usesCustomDragRegion={usesCustomDragRegion} />}
      <SettingsCog
        isOpen={settingsOpen}
        onToggle={() => setSettingsOpen(open => !open)}
        onClose={() => setSettingsOpen(false)}
        isElectron={isElectron}
        dataLocation={dataLocation}
        onChangeDataLocation={handleChangeDataLocation}
        books={books}
        onImport={importBooks}
        onExport={exportBackup}
        onElectronImport={handleImport}
        audioUploadMode={audioUploadMode}
        onAudioUploadModeChange={handleAudioUploadModeChange}
        readerIncludeChapterPreroll={readerIncludeChapterPreroll}
        onReaderIncludeChapterPrerollChange={handleReaderIncludeChapterPrerollChange}
        readerDefaultListeningSpeed={readerDefaultListeningSpeed}
        onReaderDefaultListeningSpeedChange={handleReaderDefaultListeningSpeedChange}
        pagefinderColumn={pagefinderColumn}
        onPagefinderColumnChange={handlePagefinderColumnChange}
        pagefinderStartRow={pagefinderStartRow}
        onPagefinderStartRowChange={handlePagefinderStartRowChange}
        pagefinderPageOffset={pagefinderPageOffset}
        onPagefinderPageOffsetChange={handlePagefinderPageOffsetChange}
        tutorialEnabled={tutorialEnabled}
        onTutorialEnabledChange={handleTutorialEnabledChange}
        onRestartTutorial={restartTutorial}
        showTutorialHint={!tutorialActive && !settingsOpen && view !== 'reading'}
      />
      {view==='home'       && <HomePage books={books} isElectron={isElectron} dataLocation={dataLocation} onChangeDataLocation={handleChangeDataLocation} onNew={()=>setView('newBook')} onOpen={b=>{setActiveBook(b);setView('bookDetail');}} onImport={importBooks} onExport={exportBackup} onElectronImport={handleImport} authEmail={authSession?.user?.email || ''} onSignOut={handleSignOut} onResync={resyncProof} resyncing={proofPullInflight} resyncError={proofPullError} lastResyncedAt={lastProofPullAt} />}
      {view==='newBook'    && <BookSetup onSave={saveBook} onBack={()=>setView('home')} pageOffset={pagefinderPageOffset} isElectron={isElectron} onImportTransfer={handleTransferImport} />}
      {view==='bookDetail' && activeBook && <BookDetail book={activeBook} isElectron={isElectron} audioUploadMode={audioUploadMode} onProof={startProofing} onUpdateBook={u=>updateBook(activeBook.id,u)} onToggleComplete={toggleComplete} onDelete={()=>deleteBook(activeBook.id)} onBack={()=>{setActiveBook(null);setAudioUrl(null);setBookPlayerLabel('');setView('home');}} onTransferExport={() => handleTransferExport(activeBook)} onRescanPageMap={(file)=>rescanBookPageMap(activeBook.id, file)} persistentAudioUrl={audioUrl} persistentAudioLabel={bookPlayerLabel} persistentAudioState={bookPlayerState} onPersistentAudioStateChange={setBookPlayerState} onReturnToScene={returnToActiveScene} onClearPersistentAudio={()=>{setAudioUrl(null);setBookPlayerLabel('');setBookPlayerState({ currentTime: 0, isPlaying: false, playbackRate: 1 });}} usesCustomDragRegion={usesCustomDragRegion} />}
      {view==='reading'    && activeSection && activeBook && <ProofingReader section={activeSection} audioUrl={audioUrl} narratorColors={activeBook.narratorColors} manuscriptPaging={activeBook.manuscriptPaging} pdfPaging={activeBook.pdfPaging} includeChapterPreroll={readerIncludeChapterPreroll} defaultListeningSpeed={readerDefaultListeningSpeed} onSaveFlags={(cid,sid,f)=>saveFlags(cid,sid,f)} onBack={(snapshot)=>{ if(snapshot) setBookPlayerState({ currentTime: Math.max(0, Number(snapshot.currentTime) || 0), isPlaying: !!snapshot.isPlaying, playbackRate: Math.max(0.5, Math.min(3, Number(snapshot.playbackRate) || 1)) }); setBookPlayerLabel(buildPersistentPlayerLabel(activeBook, activeSection)); setView('bookDetail'); restoreBookDetailScroll();}} canPrevChapter={canNavigateReaderChapter(-1)} canNextChapter={canNavigateReaderChapter(1)} onPrevChapter={()=>navigateReaderChapter(-1)} onNextChapter={()=>navigateReaderChapter(1)} sceneOptions={readerSceneOptions} onJumpToScene={jumpToReaderScene} usesCustomDragRegion={usesCustomDragRegion} />}
      {transferNotice && (
        <TransferNoticeModal notice={transferNotice} onClose={() => setTransferNotice(null)} />
      )}
      {transferProgress?.active && (
        <TransferProgress progress={transferProgress} onMinimize={() => setTransferProgress(prev => prev ? { ...prev, minimized: true } : prev)} onExpand={() => setTransferProgress(prev => prev ? { ...prev, minimized: false } : prev)} />
      )}
      {currentTutorialStep && (
        <TutorialOverlay
          step={currentTutorialStep}
          stepIndex={tutorialStep}
          totalSteps={TUTORIAL_STEPS.length}
          minimized={tutorialMinimized}
          steps={TUTORIAL_STEPS}
          completedStepIds={tutorialCompletedIds}
          targetAvailable={currentTutorialTargetAvailable}
          onExpand={expandTutorial}
          onMarkDone={completeTutorialStep}
          onMinimize={minimizeTutorial}
          onEndTutorial={endTutorial}
        />
      )}
      {tutorialIntroOpen && (
        <TutorialStartModal
          onStart={startTutorialFromIntro}
          onClose={closeTutorial}
        />
      )}
      {tutorialWrapUpOpen && (
        <TutorialWrapUpModal
          onClose={() => setTutorialWrapUpOpen(false)}
        />
      )}
    </div>
  );
}

// 4.0 mode taxonomy. Internal IDs stay backwards-compatible with the SaS
// 3.0 base ('default' = Proof Listen, 'prebuild' = Duet Prep) so existing
// localStorage values keep working. Two new IDs (prep-manuscript, quill)
// are added for the future modes.
// Pastel palette per Marie's preference: pink / purple / blue / green only.
// Quill = pink (Quill & Ink ❤️ stationery), Duet = blue.
export const APP_MODES = [
  { id: 'default',         label: 'Proof Listen',    short: 'Proof', pastel: '#E5DCEF', ink: '#5C4A78', enabled: true,  phase: null }, // pastel purple
  { id: 'prep-manuscript', label: 'Prep Manuscript', short: 'Prep',  pastel: '#DCEBE0', ink: '#3F6A52', enabled: true,  phase: null }, // pastel green
  { id: 'prebuild',        label: 'Duet Prep',       short: 'Duet',  pastel: '#DCE6F0', ink: '#3F5772', enabled: true,  phase: null }, // pastel blue
  { id: 'quill',           label: 'Quill & Ink',     short: 'Quill', pastel: '#F4DCE0', ink: '#834D5C', enabled: true,  phase: null }, // pastel pink
];

function AppModeToggle({ mode, onChange, usesCustomDragRegion }) {
  const pillButton = (active, m) => ({
    flex: 1,
    border: 'none',
    background: active ? m.pastel : 'transparent',
    color: active ? m.ink : (m.enabled ? 'var(--text-muted)' : 'var(--text-light)'),
    fontSize: '0.74rem',
    fontWeight: active ? 700 : 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    borderRadius: 999,
    padding: '13px 16px',
    cursor: 'pointer',
    opacity: m.enabled ? 1 : 0.7,
    transition: 'all 0.16s ease',
    WebkitAppRegion: 'no-drag',
    whiteSpace: 'nowrap',
  });

  return (
    <div
      className="ap-pill-slide-in"
      style={{
        position: 'fixed',
        top: usesCustomDragRegion ? 40 : 16,
        left: 16,
        zIndex: 1300,
        padding: 5,
        borderRadius: 999,
        border: '1px solid var(--accent-border)',
        background: 'rgba(255,255,255,0.92)',
        boxShadow: '0 10px 26px var(--accent-shadow)',
        backdropFilter: 'blur(12px)',
        WebkitAppRegion: 'no-drag',
      }}
    >
      <div style={{ display:'flex', gap: 4 }}>
        {APP_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            title={m.enabled ? m.label : `${m.label} — Coming in Phase ${m.phase}`}
            style={pillButton(mode === m.id, m)}
          >
            {m.short}
          </button>
        ))}
      </div>
    </div>
  );
}

// Pastel "coming in phase X" panel shown when Prep or Quill is selected.
function ComingSoonScreen({ mode }) {
  const found = APP_MODES.find((m) => m.id === mode);
  if (!found) return null;
  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'5.2rem 1.25rem 4rem' }}>
      <section
        style={{
          padding: '24px 22px',
          background: found.pastel,
          border: '1px solid ' + found.ink,
          borderRadius: 22,
          color: 'var(--text)',
        }}
      >
        <div style={{ fontSize:'0.74rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:found.ink, marginBottom:6 }}>
          Coming in Phase {found.phase}
        </div>
        <div style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', marginBottom:10 }}>
          {found.label}
        </div>
        <div style={{ fontSize:'0.86rem', lineHeight:1.55, color:'var(--text-muted)' }}>
          {found.id === 'prep-manuscript' && 'Assign dialogue to characters/narrators. Export a highlighted Word doc + narrator chapter list.'}
          {found.id === 'quill' && 'Add annotations to a manuscript for special-edition print design. Export to InDesign.'}
        </div>
        <div style={{ marginTop:14, fontSize:'0.74rem', color:'var(--text-light)' }}>
          Not built yet. Use Proof Listen or Duet Prep for now.
        </div>
      </section>
    </div>
  );
}

function SettingsCog({
  isOpen,
  onToggle,
  onClose,
  isElectron,
  dataLocation,
  onChangeDataLocation,
  books,
  onImport,
  onExport,
  onElectronImport,
  audioUploadMode,
  onAudioUploadModeChange,
  readerIncludeChapterPreroll,
  onReaderIncludeChapterPrerollChange,
  readerDefaultListeningSpeed,
  onReaderDefaultListeningSpeedChange,
  pagefinderColumn,
  onPagefinderColumnChange,
  pagefinderStartRow,
  onPagefinderStartRowChange,
  pagefinderPageOffset,
  onPagefinderPageOffsetChange,
  tutorialEnabled,
  onTutorialEnabledChange,
  onRestartTutorial,
  showTutorialHint,
  // Marie 2026-05-26: cog now lives on every mode. Profile goes at the
  // top of the panel; Proof-only sections sit below.
  mode = 'proof',
  authEmail = '',
  onSignOut,
}) {
  const isProof = mode === 'proof';
  const [whisperInfo, setWhisperInfo] = useState(null);
  const refreshWhisperInfo = useCallback(() => {
    if (typeof window !== 'undefined' && window.electron?.whisperGetInfo) {
      window.electron.whisperGetInfo().then(setWhisperInfo).catch(() => {});
    }
  }, []);
  useEffect(() => { if (isOpen && isElectron) refreshWhisperInfo(); }, [isOpen, isElectron, refreshWhisperInfo]);
  return (
    <>
      <style>{`
        @keyframes apTutorialHintFloat {
          0% { transform: translateY(0px); box-shadow: 0 10px 24px rgba(76, 72, 70, 0.10); }
          50% { transform: translateY(-3px); box-shadow: 0 16px 30px rgba(76, 72, 70, 0.16); }
          100% { transform: translateY(0px); box-shadow: 0 10px 24px rgba(76, 72, 70, 0.10); }
        }
      `}</style>
      <button
        onClick={onToggle}
        title="Settings"
        data-tutorial="settings-cog"
        style={{
          position:'fixed',
          top:16,
          right:16,
          width:46,
          height:46,
          borderRadius:12,
          border:'1px solid var(--border)',
          background:'white',
          color:'var(--text)',
          fontSize:'1.5rem',
          lineHeight:1,
          cursor:'pointer',
          zIndex:1200,
          boxShadow:'0 8px 22px rgba(0,0,0,0.10)',
          WebkitAppRegion:'no-drag',
        }}
      >
        ⚙
      </button>
      {showTutorialHint && (
        <button
          type="button"
          onClick={onToggle}
          title="Open Settings to start the tutorial"
          style={{
            position:'fixed',
            top:20,
            right:74,
            zIndex:1201,
            display:'inline-flex',
            alignItems:'center',
            gap:8,
            padding:'9px 14px',
            borderRadius:999,
            border:'2px solid var(--accent-dark)',
            background:'var(--accent-dark)',
            color:'white',
            fontSize:'0.82rem',
            fontWeight:700,
            cursor:'pointer',
            boxShadow:'0 12px 28px rgba(0,0,0,0.18)',
            animation:'apTutorialHintFloat 1.8s ease-in-out infinite',
            WebkitAppRegion:'no-drag',
          }}
        >
          <span>Start tutorial</span>
          <span style={{ fontSize:'1rem' }}>→</span>
        </button>
      )}

      {isOpen && (
        <>
          <div data-tutorial="settings-panel" style={{ position:'fixed', top:68, right:16, zIndex:1199, width:'min(384px, 92vw)', maxHeight:'80vh', overflowY:'auto', background:'white', border:'1px solid var(--border)', borderRadius:18, padding:'12px', boxShadow:'0 14px 30px rgba(0,0,0,0.12)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <h3 style={{ margin:0, fontSize:'1.05rem', color:'var(--text)' }}>Settings</h3>
              <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'1.1rem' }}>✕</button>
            </div>

            {/* Profile card at top — Marie 2026-05-26: replaces the
                floating M ProfilePill that overlapped the home pill. */}
            <div style={{ border:'1px solid var(--accent-border)', background:'rgba(255,255,255,0.78)', borderRadius:12, padding:'12px 12px', marginBottom:10 }}>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:700, marginBottom:6 }}>Signed in as</div>
              <div style={{ fontSize:'0.86rem', color:'var(--text)', wordBreak:'break-all', marginBottom: onSignOut ? 10 : 0 }}>{authEmail || 'Local mode'}</div>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:'1px solid #f0b8b8', background:'white', color:'var(--danger)', fontWeight:700, cursor:'pointer', fontSize:'0.8rem' }}
                >
                  Sign out
                </button>
              )}
            </div>

            <div data-tutorial="tutorial-settings-card" style={{ border:'1px solid var(--accent-border)', background:'linear-gradient(180deg, var(--accent-soft) 0%, #ffffff 100%)', borderRadius:12, padding:'12px 12px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:8 }}>
                <div>
                  <div style={{ fontSize:'0.72rem', color:'var(--accent-dark)', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.04em', fontWeight:700 }}>Tutorial</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ fontSize:'0.86rem', color:'var(--text)', fontWeight:600 }}>Guided setup inside the app</div>
                    <InfoTip tip={'Starts with a quick checklist, then walks you through setup, audio import, and proofing prep.'} />
                  </div>
                </div>
                <label style={{ display:'inline-flex', alignItems:'center', gap:7, fontSize:'0.8rem', color:'var(--text)', fontWeight:600 }}>
                  <input
                    type="checkbox"
                    checked={tutorialEnabled}
                    onChange={e => onTutorialEnabledChange(e.target.checked)}
                  />
                  Tutorial on
                </label>
              </div>
              <button
                onClick={onRestartTutorial}
                style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--accent-dark)', cursor:'pointer', padding:'7px 11px', border:'1px solid var(--accent-border)', borderRadius:8, background:'white' }}
              >
                Restart tutorial
              </button>
            </div>

            {/* Proof-only sections — Marie 2026-05-26: Prep/Quill/Duet
                settings panel shows just profile + tutorial. */}
            {isProof && (<>
            <div data-tutorial="save-location-card" style={{ border:'1px solid var(--border)', borderRadius:12, padding:'12px 12px', marginBottom:10 }}>
              <div style={{ fontSize:'0.8rem', color:'var(--text)', fontWeight:600, marginBottom:6 }}>Save location</div>
              {isElectron ? (
                <>
                  <div style={{ fontSize:'0.8rem', color:'var(--text)', wordBreak:'break-word', background:'var(--cream)', border:'1px solid var(--border-light)', borderRadius:8, padding:'8px 10px', marginBottom:10 }}>
                    {formatSaveLocation(dataLocation)}
                  </div>
                  <button onClick={onChangeDataLocation} style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text)', cursor:'pointer', padding:'7px 11px', border:'1px solid var(--border)', borderRadius:8, background:'white' }}>
                    {dataLocation?.usesCustomFolder ? 'Change save folder' : 'Choose save folder'}
                  </button>
                </>
              ) : (
                <div style={{ fontSize:'0.8rem', color:'var(--text-muted)', lineHeight:1.45 }}>
                  Desktop-only settings are available in the Electron app.
                </div>
              )}
            </div>

            <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:'12px 12px', marginBottom:10 }}>
              <div style={{ fontSize:'0.8rem', color:'var(--text)', fontWeight:600, marginBottom:8 }}>Backup and restore</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {isElectron ? (
                  <button onClick={onElectronImport} style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text)', cursor:'pointer', padding:'7px 11px', border:'1px solid var(--border)', borderRadius:8, background:'white' }}>
                    Restore backup
                  </button>
                ) : (
                  <label style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text)', cursor:'pointer', padding:'7px 11px', border:'1px solid var(--border)', borderRadius:8, background:'white' }}>
                    Restore backup
                    <input type="file" accept=".json" style={{ display:'none' }} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>onImport(ev.target.result);r.readAsText(f);e.target.value='';}} />
                  </label>
                )}
                {books.length > 0 && (
                  <button onClick={onExport} style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text)', cursor:'pointer', padding:'7px 11px', border:'1px solid var(--border)', borderRadius:8, background:'white' }}>
                    Backup all books
                  </button>
                )}
              </div>
            </div>

            <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:'12px 12px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:8 }}>
                <span>Audio upload mode</span>
                <InfoTip tip={'Per chapter is best when one file covers a whole chapter. Per scene is better if you get separate files for each POV or scene.'} />
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button
                  onClick={() => onAudioUploadModeChange('chapter')}
                  style={{
                    fontSize:'0.8rem',
                    fontWeight:600,
                    cursor:'pointer',
                    padding:'7px 11px',
                    border:'1px solid ' + (audioUploadMode === 'chapter' ? 'var(--accent)' : 'var(--border)'),
                    borderRadius:8,
                    background:audioUploadMode === 'chapter' ? 'var(--accent-light)' : 'white',
                    color:'var(--text)',
                  }}
                >
                  Per chapter
                </button>
                <button
                  onClick={() => onAudioUploadModeChange('scene')}
                  style={{
                    fontSize:'0.8rem',
                    fontWeight:600,
                    cursor:'pointer',
                    padding:'7px 11px',
                    border:'1px solid ' + (audioUploadMode === 'scene' ? 'var(--accent)' : 'var(--border)'),
                    borderRadius:8,
                    background:audioUploadMode === 'scene' ? 'var(--accent-light)' : 'white',
                    color:'var(--text)',
                  }}
                >
                  Per scene
                </button>
              </div>
            </div>

            <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:'12px 12px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                <span style={{ fontSize:'0.8rem', color:'var(--text)', fontWeight:600 }}>Page matching</span>
                <InfoTip tip={'These defaults match the original spreadsheet workflow: Column G, Start row 6, Page offset -1.'} />
              </div>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', lineHeight:1.45, marginBottom:10 }}>
                Controls how spreadsheet rows line up with manuscript page numbers.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:8 }}>
                <label style={{ fontSize:'0.76rem', color:'var(--text-muted)', display:'flex', flexDirection:'column', gap:4 }}>
                  Column
                  <input
                    type="text"
                    value={pagefinderColumn}
                    onChange={e=>onPagefinderColumnChange(e.target.value)}
                    maxLength={1}
                    style={{ border:'1px solid var(--border)', borderRadius:8, padding:'6px 8px', fontSize:'0.86rem', color:'var(--text)' }}
                  />
                </label>
                <label style={{ fontSize:'0.76rem', color:'var(--text-muted)', display:'flex', flexDirection:'column', gap:4 }}>
                  Start row
                  <input
                    type="number"
                    min={1}
                    value={pagefinderStartRow}
                    onChange={e=>onPagefinderStartRowChange(e.target.value)}
                    style={{ border:'1px solid var(--border)', borderRadius:8, padding:'6px 8px', fontSize:'0.86rem', color:'var(--text)' }}
                  />
                </label>
                <label style={{ fontSize:'0.76rem', color:'var(--text-muted)', display:'flex', flexDirection:'column', gap:4 }}>
                  Offset
                  <input
                    type="number"
                    min={-200}
                    max={200}
                    value={pagefinderPageOffset}
                    onChange={e=>onPagefinderPageOffsetChange(e.target.value)}
                    style={{ border:'1px solid var(--border)', borderRadius:8, padding:'6px 8px', fontSize:'0.86rem', color:'var(--text)' }}
                  />
                </label>
              </div>
            </div>

            <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:'12px 12px', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.8rem', color:'var(--text)', fontWeight:600, marginBottom:8 }}>
                <span>Reader settings</span>
                <InfoTip tip={'Chapter pre-roll repeats the chapter title at the start of the first scene. Default listening speed opens every proofing session at your chosen speed.'} />
              </div>
              <label style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:'0.82rem', color:'var(--text-muted)', userSelect:'none', marginBottom:10 }}>
                <input type="checkbox" checked={readerIncludeChapterPreroll} onChange={e=>onReaderIncludeChapterPrerollChange(e.target.checked)} />
                Include chapter title pre-roll (first scene only)
              </label>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:'0.8rem', color:'var(--text-muted)', minWidth:150 }}>Default listening speed</span>
                <select
                  value={String(readerDefaultListeningSpeed)}
                  onChange={e=>onReaderDefaultListeningSpeedChange(e.target.value)}
                  style={{ border:'1px solid var(--border)', borderRadius:10, padding:'5px 10px', fontSize:'0.86rem', fontFamily:'inherit', background:'white', color:'var(--text)' }}
                >
                  {[0.75,1,1.25,1.5,1.75,2,2.25,2.5,2.75,3].map(v=><option key={v} value={String(v)}>{v.toFixed(2)}x</option>)}
                </select>
              </div>
            </div>

            {isElectron && (
              <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:'12px 12px' }}>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:6 }}>Whisper engine</div>
                <div style={{ fontSize:'0.78rem', color:'var(--text)', marginBottom:8 }}>
                  Architecture: auto-detected as <strong>{whisperInfo?.detectedArch || '…'}</strong>
                </div>
                <div style={{ fontSize:'0.74rem', color:'var(--text-muted)', marginBottom:8 }}>
                  Model: <strong>{whisperInfo?.modelName || 'checking...'}</strong>{whisperInfo?.modelSizeMb ? ` (${whisperInfo.modelSizeMb} MB)` : ''} - Threads: {whisperInfo?.threadCount || 'auto'}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  {['auto', 'arm64', 'x64'].map(opt => (
                    <button key={opt} onClick={() => {
                      if (window.electron?.whisperSetArch) {
                        window.electron.whisperSetArch(opt).then(() => refreshWhisperInfo());
                      }
                    }} style={{
                      padding:'5px 12px', borderRadius:8, fontSize:'0.76rem', fontWeight:600,
                      border:'1px solid ' + ((whisperInfo?.selectedArch || 'auto') === opt ? 'var(--accent-dark)' : 'var(--border)'),
                      background: (whisperInfo?.selectedArch || 'auto') === opt ? 'var(--accent-light)' : 'white',
                      color: (whisperInfo?.selectedArch || 'auto') === opt ? 'var(--accent-dark)' : 'var(--text-muted)',
                      cursor:'pointer',
                    }}>
                      {opt === 'auto' ? 'Auto' : opt === 'arm64' ? 'Apple Silicon' : 'Intel'}
                    </button>
                  ))}
                </div>
                {whisperInfo && !whisperInfo.binaryExists && (
                  <div style={{ fontSize:'0.72rem', color:'var(--danger)', marginTop:6 }}>Binary not found</div>
                )}
                {whisperInfo && !whisperInfo.modelExists && (
                  <div style={{ fontSize:'0.72rem', color:'var(--danger)', marginTop:6 }}>Model not found</div>
                )}
              </div>
            )}

          </div>
        </>
      )}
    </>
  );
}

function HomePage({ books, isElectron, dataLocation, onChangeDataLocation, onNew, onOpen, onImport, onExport, onElectronImport, authEmail, onSignOut, onResync, resyncing, resyncError, lastResyncedAt }) {
  const saveLocationText = formatSaveLocation(dataLocation);
  // Sort by updatedAt desc so the most recently-touched book is on top.
  // Marie's note: "your audiobooks doesn't do last-touched first, which
  // is very annoying. I would like the last thing we worked on to be
  // first."
  const sortedBooks = [...(books || [])].sort((a, b) => {
    const at = Date.parse(a?.updatedAt || '') || Number(a?.updatedAt) || 0;
    const bt = Date.parse(b?.updatedAt || '') || Number(b?.updatedAt) || 0;
    return bt - at;
  });
  const lastResyncedLabel = lastResyncedAt ? formatRelativeFromNow(lastResyncedAt) : '';
  // ? info modal + image header — mirrors Duet's pattern at PrebuildMode.js.
  // Marie 2026-05-26: "copy DUET which already has one, that exactly."
  const [showHomeInfo, setShowHomeInfo] = useState(false);
  return (
    <div style={{ maxWidth:640,margin:'0 auto',padding:'4.7rem 1.25rem 4.25rem' }}>
      {showHomeInfo && (
        <div
          onClick={() => setShowHomeInfo(false)}
          style={{ position:'fixed',inset:0,background:'rgba(28, 18, 44, 0.18)',backdropFilter:'blur(4px)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width:'min(520px, 100%)',background:'white',border:'1px solid var(--accent-border)',borderRadius:24,boxShadow:'0 24px 60px var(--accent-shadow-strong)',padding:'20px 20px 18px' }}
          >
            <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:12 }}>
              <div style={{ fontSize:'1rem',fontWeight:700,color:'var(--text)' }}>About Proof Listen</div>
              <button onClick={() => setShowHomeInfo(false)} style={{ padding:'6px 10px',fontSize:'0.74rem',color:'var(--accent-dark)',border:'1px solid var(--accent-border)',background:'white',borderRadius:8,fontWeight:700,cursor:'pointer' }}>
                Close
              </button>
            </div>
            <div style={{ display:'grid',gap:10,fontSize:'0.85rem',lineHeight:1.6,color:'var(--text-muted)' }}>
              <p style={{ margin:0 }}>
                Script and Sync Proof Listen helps you listen to your audiobook against the original manuscript and flag every spot where the narrator misread, skipped, or repeated a line.
              </p>
              <p style={{ margin:0 }}>
                Each flag captures the misread quote, the page number, the narrator&apos;s timestamp, and your note. Export the full list of flags as a CSV (or Adobe Audition markers) for your engineer.
              </p>
            </div>
          </div>
        </div>
      )}
      <div style={{ marginBottom:'1.9rem', textAlign:'center', position:'relative' }}>
        <button
          onClick={() => setShowHomeInfo(true)}
          aria-label="About Proof Listen"
          title="About Proof Listen"
          style={{ position:'absolute',top:0,right:'max(4%, 0px)',width:42,height:42,borderRadius:'50%',border:'1px solid var(--accent-border)',background:'white',color:'var(--accent-dark)',fontSize:'1.1rem',fontWeight:700,cursor:'pointer',boxShadow:'0 10px 24px var(--accent-shadow)',display:'flex',alignItems:'center',justifyContent:'center' }}
        >
          ?
        </button>
        <img
          src="/branding/script-and-sync-header.png"
          alt="Script and Sync — an audiobook proofing tool"
          style={{ width:'min(420px, 92%)',height:'auto',display:'block',margin:'0 auto 0.85rem' }}
        />
        <h1 style={{ position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0, 0, 0, 0)',whiteSpace:'nowrap',border:0 }}>Script and Sync Proof Listen</h1>
      </div>
      <div style={{ display:'grid', gap:14 }}>
        <section style={{ background:'rgba(255,255,255,0.78)', border:'1px solid var(--border)', borderRadius:22, padding:'1rem' }}>
          <button data-tutorial="create-book" onClick={onNew} style={{ display:'block',width:'100%',padding:'14px 18px',background:'var(--accent)',color:'white',border:'none',borderRadius:16,fontSize:'0.96rem',fontWeight:600,cursor:'pointer',textAlign:'left',marginBottom:12 }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--accent-dark)'} onMouseLeave={e=>e.currentTarget.style.background='var(--accent)'}>
            + New Book
          </button>
        </section>

        <section style={{ background:'rgba(255,255,255,0.72)', border:'1px solid var(--border)', borderRadius:22, padding:'1rem' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:books.length>0 ? 10 : 0 }}>
            <div style={{ flex:1,textAlign:'left' }}>
              <div style={{ fontSize:'0.74rem',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--accent-dark)',marginBottom:2 }}>Your books</div>
              <div style={{ fontSize:'0.82rem',color:'var(--text-muted)' }}>
                {books.length>0 ? `${books.length} saved ${books.length===1 ? 'book' : 'books'}` : 'Saved books will appear here'}
                {lastResyncedLabel && <span style={{ marginLeft:8,fontSize:'0.72rem',color:'var(--text-light)' }}>· synced {lastResyncedLabel}</span>}
              </div>
            </div>
            {onResync && (
              <button
                type="button"
                onClick={onResync}
                disabled={resyncing}
                title="Pull the latest from the cloud (useful when a flag saved on the phone isn't showing up here yet)"
                style={{
                  padding:'7px 14px',
                  borderRadius:999,
                  border:'1px solid var(--accent-border)',
                  background:resyncing ? 'var(--cream)' : 'white',
                  color:'var(--accent-dark)',
                  fontSize:'0.78rem',
                  fontWeight:700,
                  cursor:resyncing ? 'not-allowed' : 'pointer',
                  whiteSpace:'nowrap',
                }}
              >
                {resyncing ? 'Syncing…' : '↻ Resync'}
              </button>
            )}
          </div>
          {resyncError && (
            <div style={{ marginBottom:8,padding:'6px 10px',background:'#fdecea',color:'#a23a2f',border:'1px solid #f5c6c0',borderRadius:8,fontSize:'0.75rem' }}>
              Cloud sync failed: {resyncError}
            </div>
          )}

          {books.length>0 ? (
            <div style={{ display:'flex',flexDirection:'column',gap:7,maxHeight:'min(46vh, 420px)',overflowY:'auto',paddingRight:4 }}>
              {sortedBooks.map(b=>{
                const sects=(b.chapters||[]).flatMap(c=>c.sections||[]);
                const d=sects.filter(s=>s.completed).length;
                return (
                  <button key={b.id} onClick={()=>onOpen(b)} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'white',border:'1px solid var(--border)',borderRadius:14,cursor:'pointer',textAlign:'left',transition:'border-color 0.15s' }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='#ccc'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:600,fontSize:'0.92rem',color:'var(--text)',marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{b.title}</div>
                      <div style={{ fontSize:'0.75rem',color:'var(--text-muted)' }}>{sects.length} sections · {d}/{sects.length} done · {sects.reduce((n,s)=>n+(s.flags?.length||0),0)} flags</div>
                    </div>
                    <span style={{ color:'var(--text-light)',fontSize:'1.2rem',paddingLeft:10 }}>›</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign:'center',color:'var(--text-light)',fontSize:'0.82rem',padding:'1.2rem 0 0.35rem' }}>No books yet</div>
          )}
        </section>
      </div>
      {isElectron && (
        <div style={{ marginTop:'1.4rem',background:'var(--success-light)',border:'1px solid #d3ddd6',borderRadius:12,padding:'9px 11px',color:'var(--success)' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:10 }}>
            <div style={{ minWidth:0,flex:'1 1 auto' }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
                <div style={{ fontSize:'0.74rem',fontWeight:700 }}>Save location</div>
                {dataLocation?.usesGoogleDrive && (
                  <span style={{ display:'inline-flex',alignItems:'center',padding:'3px 8px',borderRadius:999,border:'1px solid #c4d2c8',background:'#f8fbf8',fontSize:'0.64rem',fontWeight:600,whiteSpace:'nowrap' }}>Google Drive</span>
                )}
              </div>
              <div style={{ marginTop:4,fontSize:'0.67rem',lineHeight:1.35,color:'var(--success)',wordBreak:'break-all',opacity:0.9 }}>
                {saveLocationText}
              </div>
            </div>
            <button onClick={onChangeDataLocation} style={{ flexShrink:0,fontSize:'0.7rem',fontWeight:600,color:'var(--success)',cursor:'pointer',padding:'6px 10px',border:'1px solid #c4d2c8',borderRadius:8,background:'white',whiteSpace:'nowrap' }}>
              {dataLocation?.usesCustomFolder ? 'Change' : 'Choose'}
            </button>
          </div>
        </div>
      )}
      {authEmail && (
        <div style={{ marginTop:'1.4rem', textAlign:'center', fontSize:'0.72rem', color:'var(--text-light)' }}>
          Signed in as <span style={{ color:'var(--text-muted)', fontWeight:600 }}>{authEmail}</span>
          <span style={{ margin:'0 6px', color:'var(--text-light)' }}>·</span>
          <button
            type="button"
            onClick={onSignOut}
            style={{ background:'none', border:'none', padding:0, color:'var(--accent-dark)', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', textDecoration:'underline', textUnderlineOffset:3 }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function TransferNoticeModal({ notice, onClose }) {
  const warnings = Array.isArray(notice?.warnings) ? notice.warnings.filter(Boolean) : [];
  const lines = Array.isArray(notice?.lines) ? notice.lines.filter(Boolean) : [];
  const isError = notice?.tone === 'error';
  return (
    <div
      onClick={onClose}
      style={{ position:'fixed',inset:0,background:'rgba(28, 18, 44, 0.24)',backdropFilter:'blur(4px)',zIndex:1500,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width:'min(520px, 100%)',background:'white',border:'1px solid var(--accent-border)',borderRadius:24,boxShadow:'0 24px 60px var(--accent-shadow-strong)',padding:'18px' }}
      >
        <div style={{ fontSize:'1rem',fontWeight:800,color:isError ? 'var(--danger)' : 'var(--text)',marginBottom:10 }}>
          {notice?.title || 'Transfer update'}
        </div>
        <div style={{ maxHeight:'min(34vh, 240px)',overflowY:'auto',border:'1px solid var(--border-light)',borderRadius:14,background:'var(--accent-surface)',padding:'12px 13px',fontSize:'0.82rem',lineHeight:1.55,color:'var(--text)' }}>
          {notice?.folderPath && (
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:'0.68rem',fontWeight:800,letterSpacing:'0.07em',textTransform:'uppercase',color:'var(--accent-dark)',marginBottom:3 }}>Folder</div>
              <div style={{ wordBreak:'break-word',fontWeight:700 }}>{notice.folderPath}</div>
            </div>
          )}
          {lines.map((line, index) => (
            <div key={`line-${index}`} style={{ marginTop:index ? 5 : 0 }}>{line}</div>
          ))}
          {warnings.length > 0 && (
            <div style={{ marginTop:12,paddingTop:10,borderTop:'1px solid var(--border-light)',color:'var(--danger)' }}>
              <div style={{ fontSize:'0.68rem',fontWeight:800,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:5 }}>Needs attention</div>
              {warnings.map((warning, index) => (
                <div key={`warning-${index}`} style={{ marginTop:index ? 4 : 0,wordBreak:'break-word' }}>{warning}</div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display:'flex',justifyContent:'flex-end',marginTop:14 }}>
          <button
            onClick={onClose}
            style={{ padding:'10px 18px',borderRadius:999,border:'1px solid var(--accent)',background:'var(--accent)',color:'white',fontWeight:800,cursor:'pointer',boxShadow:'0 10px 24px var(--accent-shadow)' }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function TransferProgress({ progress, onMinimize, onExpand }) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(progress?.percent) || 0)));
  if (progress?.minimized) {
    return (
      <button
        type="button"
        onClick={onExpand}
        title="Show transfer progress"
        aria-label="Show transfer progress"
        style={{ position:'fixed',right:18,bottom:18,zIndex:1510,width:54,height:54,borderRadius:'50%',border:'1px solid var(--accent-border)',background:'white',color:'var(--accent-dark)',fontWeight:900,cursor:'pointer',boxShadow:'0 14px 32px var(--accent-shadow-strong)' }}
      >
        {percent}%
      </button>
    );
  }
  return (
    <div style={{ position:'fixed',right:18,bottom:18,zIndex:1510,width:'min(360px, calc(100vw - 36px))',background:'white',border:'1px solid var(--accent-border)',borderRadius:18,boxShadow:'0 18px 40px var(--accent-shadow-strong)',padding:'13px 14px' }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:8 }}>
        <div style={{ fontSize:'0.8rem',fontWeight:900,color:'var(--text)' }}>Exporting transfer folder</div>
        <button type="button" onClick={onMinimize} style={{ border:'1px solid var(--border)',background:'white',borderRadius:999,padding:'4px 9px',fontSize:'0.72rem',fontWeight:800,color:'var(--text-muted)',cursor:'pointer' }}>
          Minimize
        </button>
      </div>
      <div style={{ height:9,borderRadius:999,background:'var(--accent-light)',overflow:'hidden',marginBottom:8 }}>
        <div style={{ width:`${percent}%`,height:'100%',background:'linear-gradient(90deg, var(--accent-dark), var(--accent))',transition:'width 0.2s ease' }} />
      </div>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:8 }}>
        <div style={{ fontSize:'0.74rem',color:'var(--text-muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{progress?.message || 'Working...'}</div>
        <div style={{ fontSize:'0.78rem',fontWeight:900,color:'var(--accent-dark)',flex:'0 0 auto' }}>{percent}%</div>
      </div>
    </div>
  );
}

function TutorialOverlay({ step, stepIndex, totalSteps, minimized, steps, completedStepIds, targetAvailable, onExpand, onMarkDone, onMinimize, onEndTutorial }) {
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    if (!step?.selector || typeof window === 'undefined') return undefined;

    let frameId = null;
    const update = () => {
      const node = document.querySelector(step.selector);
      if (!node) {
        setTargetRect(null);
        return;
      }
      const rect = node.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    const schedule = () => {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const timer = window.setInterval(update, 500);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.clearInterval(timer);
    };
  }, [step]);

  const paddedRect = targetRect
    ? {
        top: Math.max(8, targetRect.top - 8),
        left: Math.max(8, targetRect.left - 8),
        width: targetRect.width + 16,
        height: targetRect.height + 16,
      }
    : null;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const panelWidth = Math.min(224, Math.max(172, viewportWidth - 32));
  const estimatedPanelHeight = 134;
  const gap = 12;

  let panelLeft = 16;
  let panelTop = 72;

  if (paddedRect) {
    panelLeft = paddedRect.left + paddedRect.width + gap;
    panelTop = paddedRect.top;

    if (panelLeft + panelWidth > viewportWidth - 16) {
      panelLeft = paddedRect.left - panelWidth - gap;
    }
    if (panelLeft < 16) {
      panelLeft = clamp(paddedRect.left + (paddedRect.width / 2) - (panelWidth / 2), 16, Math.max(16, viewportWidth - panelWidth - 16));
      panelTop = paddedRect.top + paddedRect.height + gap;
    }
    if (panelTop + estimatedPanelHeight > viewportHeight - 16) {
      panelTop = Math.max(16, viewportHeight - estimatedPanelHeight - 16);
    }
  }

  return (
    <>
      <style>{`
        @keyframes apTutorialPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(140, 124, 148, 0.16); }
          70% { transform: scale(1.005); box-shadow: 0 0 0 12px rgba(140, 124, 148, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(140, 124, 148, 0); }
        }
      `}</style>
      {paddedRect && (
        <div
          style={{
            position: 'fixed',
            top: paddedRect.top,
            left: paddedRect.left,
            width: paddedRect.width,
            height: paddedRect.height,
            borderRadius: 18,
            border: '2px solid rgba(140, 124, 148, 0.85)',
            boxShadow: '0 0 0 4px rgba(255,255,255,0.85), 0 14px 38px rgba(76, 72, 70, 0.18)',
            zIndex: 1400,
            pointerEvents: 'none',
            animation: 'apTutorialPulse 2s ease-in-out infinite',
          }}
        />
      )}
      {minimized ? (
        <button
          onClick={onExpand}
          style={{
            position:'fixed',
            top:74,
            left:16,
            width:'min(210px, calc(100vw - 32px))',
            zIndex:1402,
            display:'flex',
            alignItems:'center',
            justifyContent:'space-between',
            gap:8,
            padding:'8px 10px',
            borderRadius:14,
            border:'1px solid var(--accent-border)',
            background:'rgba(255,255,255,0.96)',
            boxShadow:'0 12px 24px var(--accent-shadow)',
            cursor:'pointer',
          }}
        >
          <div style={{ minWidth:0, textAlign:'left' }}>
            <div style={{ fontSize:'0.64rem', fontWeight:800, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--accent-dark)', marginBottom:1 }}>
              Tutorial {stepIndex + 1}/{totalSteps}
            </div>
            <div style={{ fontSize:'0.76rem', fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {step.title}
            </div>
          </div>
          <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--accent-dark)', whiteSpace:'nowrap' }}>
            Open
          </div>
        </button>
      ) : (
      <div
        style={{
          position: 'fixed',
          top: panelTop,
          left: panelLeft,
          width: panelWidth,
          zIndex: 1401,
          background: 'linear-gradient(180deg, var(--accent-surface) 0%, #ffffff 100%)',
          border: '1px solid var(--accent-border)',
          borderRadius: 18,
          boxShadow: '0 18px 38px var(--accent-shadow-strong)',
          padding: '10px 10px 9px',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:7 }}>
          <div style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--accent-dark)' }}>
            Tutorial {stepIndex + 1}/{totalSteps}
          </div>
          <button onClick={onMinimize} style={{ border:'none', background:'transparent', color:'var(--text-light)', cursor:'pointer', fontSize:'0.7rem', fontWeight:700 }}>
            Minimize
          </button>
        </div>

        <div style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--text)', marginBottom:4, lineHeight:1.26 }}>
          {step.title}
        </div>
        {step.lead ? (
          <div style={{ fontSize:'0.74rem', color:'var(--text)', lineHeight:1.42, fontWeight:700, marginBottom:3 }}>
            {step.lead}
          </div>
        ) : null}
        <div style={{ fontSize:'0.74rem', color:'var(--text-muted)', lineHeight:1.42 }}>
          {step.body}
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginTop:9 }}>
          <button
            onClick={onEndTutorial}
            style={{
              border:'none',
              background:'transparent',
              color:'var(--text-light)',
              cursor:'pointer',
              fontSize:'0.68rem',
              padding:0,
            }}
          >
            End tutorial
          </button>
          <button
            onClick={() => onMarkDone(stepIndex)}
            style={{
              padding:'7px 12px',
              borderRadius:10,
              border:'1px solid var(--accent)',
              background:'var(--accent)',
              color:'white',
              fontWeight:700,
              cursor:'pointer',
              boxShadow:'0 8px 18px var(--accent-shadow)',
            }}
          >
            Done
          </button>
        </div>
      </div>
      )}
    </>
  );
}

function TutorialWrapUpModal({ onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(28, 18, 44, 0.36)', backdropFilter:'blur(5px)', zIndex:1405, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <style>{`
        @keyframes apProofGlow {
          0% { transform: translateY(0); box-shadow: 0 10px 24px rgba(76, 72, 70, 0.18); }
          50% { transform: translateY(-1px); box-shadow: 0 0 0 10px rgba(140, 124, 148, 0.10), 0 18px 34px rgba(76, 72, 70, 0.24); }
          100% { transform: translateY(0); box-shadow: 0 10px 24px rgba(76, 72, 70, 0.18); }
        }
      `}</style>
      <div style={{ width:'min(520px, 100%)', background:'linear-gradient(180deg, var(--accent-surface) 0%, #ffffff 100%)', border:'1px solid var(--accent-border)', borderRadius:26, boxShadow:'0 28px 70px var(--accent-shadow-strong)', padding:'22px 22px 20px' }}>
        <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--accent-dark)', marginBottom:8 }}>
          Tutorial wrap-up
        </div>
        <div style={{ fontSize:'1.12rem', fontWeight:700, color:'var(--text)', marginBottom:10 }}>
          You are ready to start proofing
        </div>
        <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', lineHeight:1.6, marginBottom:14 }}>
          The setup part is done. These are the last pieces you will use while working through the book.
        </div>
        <div style={{ display:'grid', gap:10 }}>
          <div style={{ padding:'12px 14px', borderRadius:16, background:'var(--accent-surface)', border:'1px solid var(--accent-border)' }}>
            <div style={{ fontSize:'0.84rem', fontWeight:700, color:'var(--text)', marginBottom:4 }}>Start proofing</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', lineHeight:1.55 }}>
              Click Proof on the section you want, then listen and compare the audio against the manuscript.
            </div>
          </div>
          <div style={{ padding:'12px 14px', borderRadius:16, background:'var(--accent-surface)', border:'1px solid var(--accent-border)' }}>
            <div style={{ fontSize:'0.84rem', fontWeight:700, color:'var(--text)', marginBottom:4 }}>Use flags for mistakes</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', lineHeight:1.55 }}>
              Add flags whenever you spot a problem so you can review or export those notes later.
            </div>
          </div>
          <div style={{ padding:'12px 14px', borderRadius:16, background:'var(--accent-surface)', border:'1px solid var(--accent-border)' }}>
            <div style={{ fontSize:'0.84rem', fontWeight:700, color:'var(--text)', marginBottom:4 }}>Export your notes</div>
            <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', lineHeight:1.55 }}>
              Use Export for Engineer for grouped chapter marker files, or use Export Flags if you want the spreadsheet version.
            </div>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:18 }}>
          <button
            onClick={onClose}
            style={{
              padding:'10px 16px',
              borderRadius:12,
              border:'1px solid var(--accent)',
              background:'var(--accent)',
              color:'white',
              fontWeight:700,
              cursor:'pointer',
              boxShadow:'0 10px 24px var(--accent-shadow-strong)',
              animation:'apProofGlow 1.8s ease-in-out infinite',
            }}
          >
            Start proofing
          </button>
        </div>
      </div>
    </div>
  );
}

function TutorialStartModal({ onStart, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(28, 18, 44, 0.36)', backdropFilter:'blur(5px)', zIndex:1405, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <style>{`
        @keyframes apTutorialModalPop {
          from { opacity: 0; transform: translateY(14px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes apTutorialIntroReveal {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes apTutorialHeadingType {
          from { width: 0; opacity: 0.3; }
          to { width: 100%; opacity: 1; }
        }
      `}</style>
      <div style={{ width:'min(560px, 100%)', background:'linear-gradient(180deg, var(--accent-surface) 0%, #ffffff 100%)', border:'1px solid var(--accent-border)', borderRadius:26, boxShadow:'0 28px 70px var(--accent-shadow-strong)', padding:'22px 22px 20px', animation:'apTutorialModalPop 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both' }}>
        <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--accent-dark)', marginBottom:8 }}>
          Tutorial start
        </div>
        <div style={{ fontSize:'0.92rem', color:'var(--text)', lineHeight:1.7, marginBottom:14, animation:'apTutorialIntroReveal 420ms ease-out both' }}>
          This is an audiobook proofing tool. Load in your manuscript, your audio, and your character names, and it will help line everything up so you can catch the little things before they slip through.
        </div>
        <div style={{ fontSize:'0.98rem', fontWeight:600, color:'var(--text)', marginBottom:10, display:'inline-block', whiteSpace:'nowrap', overflow:'hidden', animation:'apTutorialHeadingType 360ms steps(18, end) both 140ms' }}>
          What you need:
        </div>
        <div style={{ display:'grid', gap:8, marginBottom:16, padding:'2px 6px 0' }}>
          <div style={{ fontSize:'0.84rem', color:'var(--text)', lineHeight:1.55, animation:'apTutorialIntroReveal 420ms ease-out both 220ms' }}>
            • Manuscript `.docx`, ideally with printed page numbers in the header or footer.
          </div>
          <div style={{ fontSize:'0.84rem', color:'var(--text)', lineHeight:1.55, animation:'apTutorialIntroReveal 420ms ease-out both 300ms' }}>
            • The location of your audio files, whether they are one file per chapter or one file per scene.
          </div>
          <div style={{ fontSize:'0.84rem', color:'var(--text)', lineHeight:1.55, animation:'apTutorialIntroReveal 420ms ease-out both 380ms' }}>
            • Names of the main POV characters and, if possible, the narrator names who voice them.
          </div>
          <div style={{ fontSize:'0.84rem', color:'var(--text)', lineHeight:1.55, animation:'apTutorialIntroReveal 420ms ease-out both 460ms' }}>
            • If your Word file includes pages the narrator will never read, like copyright or other front matter, it helps to remove those before you import.
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, flexWrap:'wrap' }}>
          <button
            onClick={onClose}
            style={{ padding:'10px 14px', borderRadius:12, border:'1px solid var(--border)', background:'white', color:'var(--text-muted)', fontWeight:700, cursor:'pointer' }}
          >
            Not now
          </button>
          <button
            onClick={onStart}
            style={{ padding:'10px 16px', borderRadius:12, border:'1px solid var(--accent)', background:'var(--accent)', color:'white', fontWeight:700, cursor:'pointer', boxShadow:'0 10px 24px var(--accent-shadow-strong)' }}
          >
            Start tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
