'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { transcribeAudio } from '../lib/transcriptionWorker';
import { alignTranscriptToManuscript } from '../lib/fuzzyMatcher';
import { STYLE_MAP, convertShadingToHighlight, parseStructure } from './ManuscriptSetup';
import InfoTip from './InfoTip';
import SharedBookDetail from './BookDetail';

function fmtTime(sec) { const s=Math.floor(sec),m=Math.floor(s/60); return m+':'+(s%60<10?'0':'')+s%60; }
function formatAuditionTime(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const whole = Math.floor(s);
  const ms = Math.round((s - whole) * 1000);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(whole).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
  return `${m}:${String(whole).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
}
function csvEsc(v) { return '"'+String(v||'').replace(/"/g,'""')+'"'; }
function fmtPct(x) { return `${Math.round((Number(x)||0) * 100)}%`; }
function cleanMarkerField(value) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function safeChapterLabel(chapter, index) {
  const fallback = `Chapter ${index + 1}`;
  return cleanMarkerField(chapter?.title || chapter?.sections?.[0]?.chapterTitle || fallback) || fallback;
}
function markerFileName(label) {
  const safeLabel = String(label || 'Chapter')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim() || 'Chapter';
  return `Marker_[${safeLabel}].csv`;
}

// ─── CRITICAL: Word tokenization must match ProofingReader's wrapWords() ───
// FIX (2026-03-26): The old regex /[A-Za-z0-9']+/g split contractions into
// separate tokens ("wasn't" → "wasn" + "t"), producing 3031 words.
// ProofingReader's wrapWords() splits by whitespace → 2893 words.
// This 138-word mismatch caused sync highlighting to drift ~119 words ahead
// by end of chapter. Fix: walk DOM text nodes and split by whitespace, keeping
// punctuation attached (e.g. "wasn't" stays as 1 token).
// Both transcribeChapter() and realignChapter() now use this function.
function htmlToDisplayWords(html) {
  const div = document.createElement('div');
  div.innerHTML = String(html || '');
  const words = [];
  function walk(node) {
    if (node.nodeType === 3) {
      const txt = node.textContent;
      if (!txt.trim()) return;
      txt.split(/\s+/).forEach(p => { if (p) words.push(p); });
    } else if (node.nodeType === 1) {
      Array.from(node.childNodes).forEach(walk);
    }
  }
  Array.from(div.childNodes).forEach(walk);
  return words;
}

function countWordsInHtml(html) {
  return htmlToDisplayWords(html).length;
}

function mergeContinuousAlignment(sections) {
  const merged = [];
  let wordOffset = 0;
  for (const section of (sections || [])) {
    const count = countWordsInHtml(section?.html);
    const local = Array.isArray(section?.whisperAlignment) ? section.whisperAlignment : [];
    for (let i = 0; i < count; i += 1) {
      const match = local[i];
      merged[wordOffset + i] = match ? { ...match, msIdx: wordOffset + i } : null;
    }
    wordOffset += count;
  }
  return merged;
}

function takeWordSnippet(words, count = 22) {
  return (Array.isArray(words) ? words : [])
    .slice(0, count)
    .map(word => String(word || '').trim())
    .filter(Boolean)
    .join(' ');
}

function openingWordOverlapRatio(msWords, whisperWords, count = 24) {
  const ms = (Array.isArray(msWords) ? msWords : [])
    .slice(0, count)
    .map(w => normText(w))
    .filter(Boolean);
  const whisper = (Array.isArray(whisperWords) ? whisperWords : [])
    .slice(0, count)
    .map(w => normText(typeof w === 'string' ? w : w?.word))
    .filter(Boolean);
  const max = Math.min(ms.length, whisper.length);
  if (!max) return 0;
  let hits = 0;
  for (let i = 0; i < max; i++) {
    if (ms[i] === whisper[i]) hits++;
  }
  return hits / max;
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

function clearSectionTranscription(section) {
  if (!section) return section;
  return {
    ...section,
    whisperTranscript: undefined,
    whisperWords: undefined,
    whisperAlignment: undefined,
    whisperMatchedCount: undefined,
    whisperManuscriptWordCount: undefined,
    whisperMatchQuality: undefined,
    transcribedAt: undefined,
    whisperAudioKey: undefined,
    whisperTextHash: undefined,
    whisperSourceUpdatedAt: undefined,
  };
}

function getChapterTextHash(chapter) {
  return hashText((chapter?.sections || []).map(section => section?.html || '').join(''));
}

function getChapterAudioKey(chapter) {
  const firstAudioSection = (chapter?.sections || []).find(section => !!getSectionAudioKey(section));
  return firstAudioSection ? getSectionAudioKey(firstAudioSection) : '';
}

function hasCurrentSectionTranscription(section, expectedAudioKey, expectedTextHash) {
  return !!(
    section &&
    Array.isArray(section.whisperWords) &&
    section.whisperWords.length &&
    Array.isArray(section.whisperAlignment) &&
    section.whisperAlignment.length &&
    section.whisperAudioKey &&
    section.whisperTextHash &&
    section.whisperAudioKey === expectedAudioKey &&
    section.whisperTextHash === expectedTextHash
  );
}

function isChapterTranscriptionCurrent(chapter) {
  const expectedAudioKey = getChapterAudioKey(chapter);
  const expectedTextHash = getChapterTextHash(chapter);
  const sections = chapter?.sections || [];
  if (!expectedAudioKey || !expectedTextHash || !sections.length) return false;
  return sections.every(section => hasCurrentSectionTranscription(section, expectedAudioKey, expectedTextHash));
}

let transcriptionQueueState = { tasks: [] };
let transcriptionQueuePumpPromise = null;
const transcriptionQueueListeners = new Set();

function cloneQueueState(state = transcriptionQueueState) {
  return {
    tasks: (state.tasks || []).map(task => ({ ...task })),
  };
}

function emitTranscriptionQueue() {
  const snapshot = cloneQueueState();
  transcriptionQueueListeners.forEach(listener => {
    try { listener(snapshot); } catch {}
  });
}

function getTranscriptionQueueState() {
  return cloneQueueState();
}

function subscribeToTranscriptionQueue(listener) {
  if (typeof listener !== 'function') return () => {};
  transcriptionQueueListeners.add(listener);
  listener(getTranscriptionQueueState());
  return () => {
    transcriptionQueueListeners.delete(listener);
  };
}

function updateTranscriptionQueue(mutator) {
  const nextState = mutator(cloneQueueState()) || transcriptionQueueState;
  transcriptionQueueState = {
    tasks: Array.isArray(nextState.tasks) ? nextState.tasks : [],
  };
  emitTranscriptionQueue();
  return transcriptionQueueState;
}

function setTranscriptionTask(taskId, patch) {
  updateTranscriptionQueue(state => ({
    ...state,
    tasks: (state.tasks || []).map(task => task.taskId === taskId ? { ...task, ...patch } : task),
  }));
}

function removeTranscriptionTask(taskId) {
  updateTranscriptionQueue(state => ({
    ...state,
    tasks: (state.tasks || []).filter(task => task.taskId !== taskId),
  }));
}

function getTranscriptionTask(taskId) {
  return (transcriptionQueueState.tasks || []).find(task => task.taskId === taskId) || null;
}

function clearQueuedTranscriptionTasksForChapter(bookId, chapterId) {
  let cancelledRunningTask = false;
  updateTranscriptionQueue(state => ({
    ...state,
    tasks: (state.tasks || []).flatMap(task => {
      if (task.bookId !== bookId || task.chapterId !== chapterId) return [task];
      if (task.status === 'running') {
        cancelledRunningTask = true;
        return [{
          ...task,
          cancelRequested: true,
          stage: 'cancel',
          message: 'Cancelling because the source changed…',
          updatedAt: Date.now(),
        }];
      }
      return [];
    }),
  }));
  if (cancelledRunningTask && typeof window !== 'undefined' && window.electron?.whisperCancel) {
    window.electron.whisperCancel().catch(() => {});
  }
}

// File System Access API helpers
async function pickAudioFile() {
  if (!window.showOpenFilePicker) return null; // fallback handled by caller
  try {
    const [h] = await window.showOpenFilePicker({ types:[{description:'Audio',accept:{'audio/*':[]}}], multiple:false });
    return h;
  } catch { return null; }
}

async function restoreHandle(handle) {
  if (!handle) return null;
  try {
    let perm = await handle.queryPermission({ mode:'read' });
    if (perm !== 'granted') perm = await handle.requestPermission({ mode:'read' });
    if (perm === 'granted') return await handle.getFile();
  } catch {}
  return null;
}

async function idbSet(key, value) {
  return new Promise((res,rej)=>{
    const req = indexedDB.open('ap-handles',1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('handles');
    req.onsuccess = e => { const tx=e.target.result.transaction('handles','readwrite'); tx.objectStore('handles').put(value,key); tx.oncomplete=()=>res(); tx.onerror=()=>rej(); };
    req.onerror=()=>rej();
  });
}
async function idbGet(key) {
  return new Promise(res=>{
    const req=indexedDB.open('ap-handles',1);
    req.onupgradeneeded=e=>e.target.result.createObjectStore('handles');
    req.onsuccess=e=>{ const tx=e.target.result.transaction('handles','readonly'); const r=tx.objectStore('handles').get(key); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); };
    req.onerror=()=>res(null);
  });
}

function exportAllCSV(book) {
  const rows=[['Chapter','Audio File','Page','Timestamp','Narrator/Engineer','Type','Note','Should Say']];
  (book.chapters||[]).forEach(ch=>{
    (ch.sections||[]).filter(s=>s.flags?.length).forEach(sec=>{
      (sec.flags||[]).forEach(fl=>rows.push([csvEsc(ch.title),csvEsc(sec.audioFileName||''),csvEsc(fl.page),csvEsc(fmtTime(fl.ts)),csvEsc(fl.narrator),csvEsc(fl.type),csvEsc(fl.sentPlain||''),csvEsc(fl.note||'')]));
    });
  });
  if (rows.length===1) { alert('No flags found yet.'); return; }
  dl(rows.map(r=>r.join(',')).join('\r\n'),`${book.title||'book'}-flags.csv`,'text/csv');
}

async function exportAuditionMarkers(book) {
  const groups = new Map();
  const collisions = [];
  const chapters = book?.chapters || [];

  chapters.forEach((chapter, chapterIndex) => {
    const chapterLabel = safeChapterLabel(chapter, chapterIndex);
    const groupKey = chapterLabel.toLowerCase();
    const group = groups.get(groupKey) || { label: chapterLabel, markers: [], audioNames: new Set() };

    (chapter.sections || []).forEach(section => {
      if (section?.audioFileName) group.audioNames.add(cleanMarkerField(section.audioFileName));
      (section.flags || []).forEach(flag => {
        const startSeconds = Number(flag?.ts);
        const start = formatAuditionTime(startSeconds);
        if (!start) return;
        group.markers.push({
          startSeconds,
          start,
          name: cleanMarkerField(flag?.sentPlain) || `Marker ${group.markers.length + 1}`,
          description: cleanMarkerField(flag?.note),
        });
      });
    });

    groups.set(groupKey, group);
  });

  const TAB = '\t';
  const HEADER = ['Name', 'Start', 'Duration', 'Time Format', 'Type', 'Description'].join(TAB);
  const files = [];

  groups.forEach(group => {
    if (!group.markers.length) return;
    if (group.audioNames.size > 1) collisions.push(group.label);
    group.markers.sort((a, b) => a.startSeconds - b.startSeconds);
    const rows = [HEADER];
    group.markers.forEach(marker => {
      rows.push([marker.name, marker.start, '0:00.000', 'decimal', 'Cue', marker.description].join(TAB));
    });
    files.push({ name: markerFileName(group.label), content: rows.join('\n') });
  });

  if (!files.length) {
    alert('No flags found yet.');
    return;
  }

  const folderName = `${cleanMarkerField(book?.title || 'book') || 'book'} audition markers`;
  const electron = typeof window !== 'undefined' ? window.electron : null;

  if (electron?.exportMarkersFolder) {
    const outDir = await electron.exportMarkersFolder({ folderName, files });
    if (!outDir) return;
    if (collisions.length) {
      alert(`Exported ${files.length} marker file(s) to:\n${outDir}\n\nHeads-up: ${collisions.join(', ')} combined flags from more than one audio filename because those chapter labels matched exactly.`);
      return;
    }
    alert(`Exported ${files.length} marker file(s) to:\n${outDir}`);
    return;
  }

  files.forEach(file => dl(file.content, file.name, 'text/tab-separated-values'));
  if (collisions.length) {
    alert(`Downloaded ${files.length} marker file(s).\n\nHeads-up: ${collisions.join(', ')} combined flags from more than one audio filename because those chapter labels matched exactly.`);
  }
}

function exportSectionCSV(ch, sec) {
  const rows=[['Chapter','Audio File','Page','Timestamp','Narrator/Engineer','Type','Note','Should Say']];
  (sec.flags||[]).forEach(fl=>rows.push([csvEsc(ch.title),csvEsc(sec.audioFileName||''),csvEsc(fl.page),csvEsc(fmtTime(fl.ts)),csvEsc(fl.narrator),csvEsc(fl.type),csvEsc(fl.sentPlain||''),csvEsc(fl.note||'')]));
  dl(rows.map(r=>r.join(',')).join('\r\n'),`${ch.title}-${sec.title}.csv`,'text/csv');
}

function dl(content, filename, type) { const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=filename;a.click(); }

function normText(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function nameMatches(a, b) {
  const na = normText(a), nb = normText(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function fmtDuration(totalSec) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
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

function getSectionStoredAudioPath(section, platform = getElectronPlatform()) {
  if (section?.audioPaths && typeof section.audioPaths === 'object') {
    const currentPath = section.audioPaths[platform];
    return typeof currentPath === 'string' && currentPath ? currentPath : null;
  }
  const legacyPath = section?.audioPath;
  return legacyPathMatchesCurrentPlatform(legacyPath, platform) ? legacyPath : null;
}

function buildPlatformAudioPaths(section, nextStoredPath, platform = getElectronPlatform()) {
  if (!platform) return section?.audioPaths && typeof section.audioPaths === 'object' ? { ...section.audioPaths } : null;
  const next = section?.audioPaths && typeof section.audioPaths === 'object' ? { ...section.audioPaths } : {};
  if (nextStoredPath) next[platform] = nextStoredPath;
  else delete next[platform];
  return Object.keys(next).length ? next : null;
}

function getSectionAudioKey(sec) {
  const storedAudioPath = getSectionStoredAudioPath(sec);
  if (storedAudioPath) return `path:${storedAudioPath}`;
  if (sec?.audioFileName) return `name:${normText(sec.audioFileName)}`;
  return null;
}

function getSectionNarratorName(sec) {
  return String(sec?.narratorName || 'Unassigned narrator').trim() || 'Unassigned narrator';
}

function getSectionCharacterName(sec) {
  return String(sec?.characterName || sec?.title || 'Unassigned character').trim() || 'Unassigned character';
}

function loadAudioDurationSeconds(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const audio = document.createElement('audio');
    let settled = false;
    const cleanup = () => {
      audio.removeAttribute('src');
      try { audio.load(); } catch {}
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const d = Number(audio.duration);
      finish(Number.isFinite(d) && d > 0 ? d : null);
    };
    audio.onerror = () => finish(null);
    audio.src = url;
  });
}

// Maintainer note:
// Book-level time counters for the selected-book screen live in this file.
// Search for "Timing totals" below. Duration values are cached on the book as
// `audioDurationCache` and intentionally invalidated only when audio assignment
// changes (single upload/chapter upload/bulk upload).

const btn=(style={})=>({ padding:'6px 12px',borderRadius:8,fontSize:'0.78rem',border:'1px solid var(--border)',background:'white',color:'var(--text)',cursor:'pointer',...style });

export default function BookDetail({ book, isElectron, audioUploadMode = 'chapter', onProof, onUpdateBook, onToggleComplete, onDelete, onBack, onTransferExport, onRescanPageMap, persistentAudioUrl = null, persistentAudioLabel = '', persistentAudioState = null, onPersistentAudioStateChange, onReturnToScene, onClearPersistentAudio, usesCustomDragRegion = false, mode = 'proof', actionButtonsOverride = null, engineerProgress = null }) {
  const [audioUrls, setAudioUrls] = useState({});
  const [audioFiles, setAudioFiles] = useState({});
  const [expanded, setExpanded] = useState({});
  const [restoring, setRestoring] = useState({});
  const [toast, setToast] = useState(null);
  const [rescanningPages, setRescanningPages] = useState(false);
  const [durationCache, setDurationCache] = useState(book.audioDurationCache || {});
  const [durationProbeRunning, setDurationProbeRunning] = useState(false);
  const [showTimingDetails, setShowTimingDetails] = useState(false);
  const [showFloatingNav, setShowFloatingNav] = useState(false);
  const [showSceneRows, setShowSceneRows] = useState(audioUploadMode === 'scene');
  const [showTranscribeAllModal, setShowTranscribeAllModal] = useState(false);
  const [retranscribeAll, setRetranscribeAll] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState('navigation');
  const [queueState, setQueueState] = useState(() => getTranscriptionQueueState());
  const isMountedRef = useRef(true);
  const persistentAudioRef = useRef(null);
  const persistentStateRef = useRef(persistentAudioState || { currentTime: 0, isPlaying: false, playbackRate: 1 });
  const durationProbeRef = useRef({});
  const chapterRefs = useRef({});
  const hasFSA = typeof window !== 'undefined' && !!window.showOpenFilePicker;

  const allSections = (book.chapters||[]).flatMap(c=>c.sections||[]);
  const completedCount = allSections.filter(s=>s.completed).length;
  const totalFlags = allSections.reduce((n,s)=>n+(s.flags?.length||0),0);
  const [bulkStartChapterId, setBulkStartChapterId] = useState(
    (book.chapters||[]).find(ch => ch.firstChapter)?.id || book.chapters?.[0]?.id || ''
  );
  const [editingMeta, setEditingMeta] = useState(false);
  const [reuploadPreview, setReuploadPreview] = useState(null); // { fullHtml, chapters: [{title, sections, included}] }
  const [editTitle, setEditTitle] = useState(book.title || '');
  // Marie 2026-05-26: per-book page nudge (±N). Lets her shift every
  // displayed page number to match her Word doc when LibreOffice
  // rendering drifts by a hair on long books.
  const [editPageNudge, setEditPageNudge] = useState(Number(book.pageNumberAdjustment) || 0);
  const [editNarrators, setEditNarrators] = useState((book.narratorColors || []).map(nc => ({
    hex: nc.hex || '#d9d9d9',
    characterName: nc.characterName || '',
    narratorName: nc.narratorName || '',
  })));
  // Chapter inclusion edit state — Marie can uncheck chapters here to
  // remove them from the book (e.g. a copyright page that snuck through
  // import). Initialized fresh each time the editor opens so the list
  // matches the current chapters.
  // editChapters carries BOTH the chapter-level tick AND a nested
  // section-level tick list, so Marie can untick a whole chapter or
  // just one scene inside it. Saving filters both levels.
  const [editChapters, setEditChapters] = useState((book.chapters || []).map(ch => ({
    id: ch.id,
    title: ch.title,
    included: true,
    sections: (ch.sections || []).map(sec => ({
      id: sec.id,
      title: sec.title,
      included: true,
    })),
  })));
  // Which chapters in the editor are expanded to reveal their scenes.
  const [editExpandedChapters, setEditExpandedChapters] = useState({});

  useEffect(() => {
    setBulkStartChapterId((book.chapters||[]).find(ch => ch.firstChapter)?.id || book.chapters?.[0]?.id || '');
    setEditingMeta(false);
    setEditTitle(book.title || '');
    setEditNarrators((book.narratorColors || []).map(nc => ({
      hex: nc.hex || '#d9d9d9',
      characterName: nc.characterName || '',
      narratorName: nc.narratorName || '',
    })));
    setEditChapters((book.chapters || []).map(ch => ({
      id: ch.id,
      title: ch.title,
      included: true,
      sections: (ch.sections || []).map(sec => ({
        id: sec.id,
        title: sec.title,
        included: true,
      })),
    })));
    setEditExpandedChapters({});
    setEditPageNudge(Number(book.pageNumberAdjustment) || 0);
    setShowSceneRows(audioUploadMode === 'scene');
    setDurationCache(book.audioDurationCache || {});
    durationProbeRef.current = {};
    setShowTimingDetails(false);
  }, [book.id, audioUploadMode]);

  useEffect(() => {
    const handleResize = () => {
      setShowFloatingNav(window.innerWidth >= 760);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => subscribeToTranscriptionQueue(setQueueState), []);

  const sectionTimingRows = useMemo(() => {
    const chapters = book.chapters || [];
    const rows = [];
    chapters.forEach(ch => {
      (ch.sections || []).forEach(sec => {
        const audioKey = getSectionAudioKey(sec);
        if (!audioKey) return;
        const mappedNarrator = (book.narratorColors || []).find(nc => nameMatches(sec.characterName, nc.characterName));
        rows.push({
          id: sec.id,
          chapterId: ch.id,
          completed: !!sec.completed,
          narrator: String(mappedNarrator?.narratorName || getSectionNarratorName(sec)).trim() || 'Unassigned narrator',
          character: getSectionCharacterName(sec),
          audioKey,
          wordCount: Math.max(1, countWordsInHtml(sec.html || '')),
          hasUrl: !!audioUrls[sec.id],
        });
      });
    });
    return rows;
  }, [book.chapters, book.narratorColors, audioUrls]);

  const durationSummary = useMemo(() => {
    const rows = sectionTimingRows;
    const grouped = new Map();
    rows.forEach(row => {
      if (!grouped.has(row.audioKey)) grouped.set(row.audioKey, []);
      grouped.get(row.audioKey).push(row);
    });

    let totalAudiobookSeconds = 0;
    let totalTimeLeftSeconds = 0;
    const narratorTotals = {};
    const narratorCharacters = {};
    const characterTotals = {};
    let cachedKeys = 0;

    grouped.forEach((groupRows, key) => {
      const totalSec = Number(durationCache?.[key]);
      if (!Number.isFinite(totalSec) || totalSec <= 0) return;
      cachedKeys += 1;
      totalAudiobookSeconds += totalSec;

      const weightSum = groupRows.reduce((n, row) => n + Math.max(1, Number(row.wordCount) || 1), 0);
      groupRows.forEach(row => {
        const weight = Math.max(1, Number(row.wordCount) || 1);
        const sectionSec = totalSec * (weight / Math.max(1, weightSum));
        narratorTotals[row.narrator] = (narratorTotals[row.narrator] || 0) + sectionSec;
        characterTotals[row.character] = (characterTotals[row.character] || 0) + sectionSec;
        if (!narratorCharacters[row.narrator]) narratorCharacters[row.narrator] = new Set();
        narratorCharacters[row.narrator].add(row.character);
        if (!row.completed) totalTimeLeftSeconds += sectionSec;
      });
    });

    const narratorRows = Object.entries(narratorTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, seconds]) => ({
        name,
        seconds,
        characters: [...(narratorCharacters[name] || [])].sort((a, b) => a.localeCompare(b)),
      }));

    const characterRows = Object.entries(characterTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, seconds]) => ({ name, seconds }));

    return {
      totalAudiobookSeconds,
      totalTimeLeftSeconds,
      narratorRows,
      characterRows,
      cachedKeys,
      totalKeys: grouped.size,
    };
  }, [sectionTimingRows, durationCache]);

  const chapterSummaries = useMemo(() => {
    return (book.chapters || []).map((chapter, index) => {
      const sections = chapter.sections || [];
      const doneCount = sections.filter(s => s.completed).length;
      const totalCount = sections.length;
      const isComplete = totalCount > 0 && doneCount === totalCount;
      return {
        chapter,
        index,
        id: chapter.id,
        displayNumber: chapterDisplayNumber(chapter, index),
        doneCount,
        totalCount,
        isComplete,
      };
    });
  }, [book.chapters]);

  const bookQueueItems = useMemo(() => {
    const statusOrder = { running: 0, queued: 1, error: 2, done: 3, cancelled: 4 };
    return (queueState.tasks || [])
      .filter(task => task.bookId === book.id)
      .sort((a, b) => {
        const diff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
        if (diff) return diff;
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      });
  }, [queueState.tasks, book.id]);

  const activeBookQueueCount = bookQueueItems.filter(task => task.status === 'queued' || task.status === 'running').length;
  const previousActiveBookQueueCountRef = useRef(activeBookQueueCount);

  useEffect(() => {
    if (activeBookQueueCount > previousActiveBookQueueCountRef.current) {
      setSidePanelTab('transcriptions');
    }
    previousActiveBookQueueCountRef.current = activeBookQueueCount;
  }, [activeBookQueueCount]);

  useEffect(() => {
    let canceled = false;

    async function probeMissingDurations() {
      const byKey = new Map();
      sectionTimingRows.forEach(row => {
        if (!byKey.has(row.audioKey)) byKey.set(row.audioKey, row);
      });
      const missingEntries = [...byKey.entries()].filter(([key]) => {
        const cached = Number(durationCache?.[key]);
        return !(Number.isFinite(cached) && cached > 0) && !durationProbeRef.current[key];
      });
      if (!missingEntries.length) return;

      setDurationProbeRunning(true);
      const updates = {};

      for (const [key, row] of missingEntries) {
        if (canceled) break;
        durationProbeRef.current[key] = true;
        try {
          const section = allSections.find(s => s.id === row.id);
          let url = audioUrls[row.id] || null;
          const storedAudioPath = getSectionStoredAudioPath(section);
          if (!url && storedAudioPath && typeof window !== 'undefined' && window.electron?.getAudioUrl) {
            url = await window.electron.getAudioUrl(storedAudioPath);
          }
          const seconds = await loadAudioDurationSeconds(url);
          if (Number.isFinite(seconds) && seconds > 0) {
            updates[key] = Math.round(seconds * 1000) / 1000;
          }
        } catch {}
      }

      if (!canceled && Object.keys(updates).length) {
        setDurationCache(prev => {
          const next = { ...(prev || {}), ...updates };
          onUpdateBook({ audioDurationCache: next });
          return next;
        });
      }
      if (!canceled) setDurationProbeRunning(false);
    }

    probeMissingDurations();
    return () => {
      canceled = true;
    };
  }, [sectionTimingRows, durationCache, audioUrls]);

  useEffect(() => {
    if (persistentAudioState) persistentStateRef.current = persistentAudioState;
  }, [persistentAudioState]);

  useEffect(() => {
    const a = persistentAudioRef.current;
    if (!a || !persistentAudioUrl) return;
    const currentSrc = a.getAttribute('src') || '';
    if (currentSrc !== persistentAudioUrl) a.src = persistentAudioUrl;

    const applyState = () => {
      const st = persistentStateRef.current || {};
      const t = Math.max(0, Number(st.currentTime) || 0);
      const r = Math.max(0.5, Math.min(3, Number(st.playbackRate) || 1));
      try { a.currentTime = t; } catch {}
      a.playbackRate = r;
      if (st.isPlaying) a.play().catch(() => {});
    };

    if (a.readyState >= 1) applyState();
    else a.addEventListener('loadedmetadata', applyState, { once: true });
  }, [persistentAudioUrl]);

  useEffect(() => {
    const a = persistentAudioRef.current;
    if (!a) return;
    const report = () => {
      const snapshot = {
        currentTime: Number(a.currentTime) || 0,
        isPlaying: !a.paused && !a.ended,
        playbackRate: Number(a.playbackRate) || 1,
      };
      persistentStateRef.current = snapshot;
      onPersistentAudioStateChange?.(snapshot);
    };
    a.addEventListener('timeupdate', report);
    a.addEventListener('play', report);
    a.addEventListener('pause', report);
    a.addEventListener('ratechange', report);
    return () => {
      report();
      a.removeEventListener('timeupdate', report);
      a.removeEventListener('play', report);
      a.removeEventListener('pause', report);
      a.removeEventListener('ratechange', report);
    };
  }, [persistentAudioUrl, onPersistentAudioStateChange]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  function showToast(message, tone = 'info') {
    if (!isMountedRef.current) return;
    setToast({ message, tone });
    window.setTimeout(() => {
      if (isMountedRef.current) setToast(null);
    }, 3800);
  }

  async function handleRescanPageMap(file) {
    if (!onRescanPageMap) return;
    setRescanningPages(true);
    showToast('Generating exact page map. This can take around 10-20 seconds for a full manuscript.', 'info');
    try {
      const result = await onRescanPageMap(file || null);
      showToast(result?.message || 'Exact page map regenerated.', 'success');
    } catch (error) {
      showToast(error?.message || 'Could not regenerate exact page map.', 'error');
    } finally {
      if (isMountedRef.current) setRescanningPages(false);
    }
  }

  function chapterDisplayNumber(chapter, index) {
    // Always use position in current chapter list so deleting chapters
    // post-import renumbers the remaining ones starting at 1.
    // Marie's complaint: "you uncheck the first few, but it still starts
    // naming them from 3 or 4."
    return index + 1;
  }

  function chapterDisplayLabel(chapter, index) {
    return `${chapterDisplayNumber(chapter, index)} · ${chapter.title}`;
  }

  function updateEditNarrator(i, field, value) {
    setEditNarrators(rows => rows.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  function addEditNarrator() {
    setEditNarrators(rows => [...rows, { hex:'#d9d9d9', characterName:'', narratorName:'' }]);
  }

  function removeEditNarrator(i) {
    setEditNarrators(rows => rows.filter((_, idx) => idx !== i));
  }

  async function handleReuploadManuscript(file) {
    if (!file || !file.name.endsWith('.docx')) { alert('Please select a .docx file.'); return; }
    try {
      showToast('Re-processing manuscript…', 'info');
      const mammoth = (await import('mammoth')).default;
      const ab = await file.arrayBuffer();
      const { buffer: processedAb } = await convertShadingToHighlight(ab);
      const result = await mammoth.convertToHtml({ arrayBuffer: processedAb }, { styleMap: STYLE_MAP });
      const html = result.value;
      const chapterTag = `h${book.chapterLevel || 1}`;
      const narratorColors = book.narratorColors || [];
      const parsed = parseStructure(html, chapterTag, narratorColors);
      // Mark all included by default
      const withIncluded = parsed.map(ch => ({ ...ch, included: true }));
      setReuploadPreview({ fullHtml: html, chapters: withIncluded });
      showToast('Choose which chapters to keep, then confirm.', 'info');
    } catch (e) { alert('Re-upload failed: ' + e.message); }
  }

  function confirmReupload() {
    if (!reuploadPreview) return;
    const { fullHtml, chapters: newChapters } = reuploadPreview;
    const included = newChapters.filter(ch => ch.included !== false);
    // Match new sections to old sections by title to preserve audio/flags
    const oldChapters = book.chapters || [];
    const mergedChapters = included.map(newCh => {
      const oldCh = oldChapters.find(o => normText(o.title) === normText(newCh.title));
      const newSections = newCh.sections || [];
      if (!oldCh) return { ...newCh, id: newCh.id };
      const oldSections = oldCh.sections || [];
      const chapterTextChanged = oldSections.length !== newSections.length ||
        oldCh.title !== newCh.title ||
        newSections.some(newSec => {
          const oldSec = oldSections.find(o => normText(o.title) === normText(newSec.title));
          return !oldSec || (oldSec.html || '') !== (newSec.html || '') || (oldSec.title || '') !== (newSec.title || '');
        });
      const mergedSections = newSections.map(newSec => {
        const oldSec = oldSections.find(o => normText(o.title) === normText(newSec.title));
        if (!oldSec) return newSec;
        return chapterTextChanged
          ? { ...clearSectionTranscription(oldSec), html: newSec.html, title: newSec.title }
          : { ...oldSec, html: newSec.html, title: newSec.title };
      });
      if (chapterTextChanged) clearQueuedTranscriptionTasksForChapter(book.id, oldCh.id);
      return { ...oldCh, title: newCh.title, sections: mergedSections, firstChapter: newCh.firstChapter };
    });
    onUpdateBook({ fullHtml, chapters: mergedChapters });
    setReuploadPreview(null);
    showToast(`Manuscript re-uploaded — ${included.length} chapters, highlights refreshed.`, 'success');
  }

  function saveBookMetaEdits() {
    const title = (editTitle || '').trim() || book.title;
    const finalNarrators = (editNarrators || [])
      .map(nc => ({
        hex: nc.hex || '#d9d9d9',
        characterName: (nc.characterName || '').trim(),
        narratorName: (nc.narratorName || '').trim(),
      }))
      .filter(nc => nc.characterName);

    // Build an "included" lookup from the editor's checkboxes. Any
    // chapter id that's unchecked gets dropped from the saved book —
    // Marie's "uncheck the copyright page I missed at import" flow.
    // Defensive guard: if the editor list is empty/missing (state didn't
    // load), treat that as "keep everything" rather than wiping the book.
    const editList = Array.isArray(editChapters) && editChapters.length
      ? editChapters
      : (book.chapters || []).map(ch => ({ id: ch.id, included: true }));
    const includedIds = new Set(editList.filter(c => c.included).map(c => c.id));
    const removedCount = (book.chapters || []).filter(ch => !includedIds.has(ch.id)).length;

    // Double-confirm destructive removals — Marie's rule for any action
    // that drops user data.
    if (removedCount > 0 && typeof window !== 'undefined') {
      const ok = window.confirm(
        removedCount === (book.chapters || []).length
          ? 'You unchecked every chapter — saving will leave the book empty. Continue?'
          : `Remove ${removedCount} chapter${removedCount === 1 ? '' : 's'} from this book? Their flags and audio will be lost.`
      );
      if (!ok) return;
    }

    // Build per-chapter included-section sets so a section unticked in
    // the Edit panel actually drops out of the saved book.
    const editById = new Map(editList.map(c => [c.id, c]));
    const chapters = (book.chapters || [])
      .filter(ch => includedIds.has(ch.id))
      .map(ch => {
        const editCh = editById.get(ch.id);
        const editSectionList = Array.isArray(editCh?.sections) ? editCh.sections : null;
        const includedSectionIds = editSectionList
          ? new Set(editSectionList.filter(s => s.included).map(s => s.id))
          : null;
        const sectionsAfterUntick = includedSectionIds
          ? (ch.sections || []).filter(sec => includedSectionIds.has(sec.id))
          : (ch.sections || []);
        return {
          ...ch,
          sections: sectionsAfterUntick.map(sec => {
            const byTitle = finalNarrators.find(nc => nameMatches(sec.title, nc.characterName));
            const byExisting = !byTitle ? finalNarrators.find(nc => nameMatches(sec.characterName, nc.characterName)) : null;
            const match = byTitle || byExisting;
            if (!match) return sec;
            return {
              ...sec,
              characterName: match.characterName,
              narratorName: match.narratorName || null,
              isCharPOV: true,
            };
          }),
        };
      });

    // Persist the page nudge alongside the rest of the book meta.
    const pageNumberAdjustment = Math.trunc(Number(editPageNudge) || 0);
    onUpdateBook({ title, narratorColors: finalNarrators, chapters, pageNumberAdjustment });
    setEditingMeta(false);
    if (removedCount > 0) {
      showToast(`Book updated — ${removedCount} chapter${removedCount === 1 ? '' : 's'} removed.`, 'success');
    } else {
      showToast('Book details updated.', 'success');
    }
  }

  // Remove one flag by section + flag id. Triggers the parent's
  // debounced cloud push (which still does full delete-all-insert for
  // flags today; phone uses single-row delete, desktop will too once
  // ProofingReader is reworked).
  function removeFlagFromBook(sectionId, flagId) {
    const chapters = (book.chapters || []).map((ch) => ({
      ...ch,
      sections: (ch.sections || []).map((sec) => {
        if (sec.id !== sectionId) return sec;
        return { ...sec, flags: (sec.flags || []).filter((f) => (f.id || `${f.idx}:${f.ts}`) !== flagId) };
      }),
    }));
    onUpdateBook({ chapters });
  }

  // Flat list of every flag across every chapter for the all-flags tab.
  // Sorted by chapter position then by timestamp so engineers can scan
  // top-to-bottom and the order matches the audiobook timeline.
  const allFlagsAcrossBook = useMemo(() => {
    const out = [];
    (book.chapters || []).forEach((ch, chIdx) => {
      (ch.sections || []).forEach((sec) => {
        (sec.flags || []).forEach((fl, idx) => {
          const id = fl.id || `${fl.idx}:${fl.ts}`;
          out.push({
            id,
            sectionId: sec.id,
            chapterId: ch.id,
            chapterIndex: chIdx,
            chapterTitle: ch.title || `Chapter ${chIdx + 1}`,
            chapterDisplay: chapterDisplayNumber(ch, chIdx),
            sectionTitle: sec.title || '',
            audioFileName: sec.audioFileName || '',
            ts: Number(fl.ts) || 0,
            page: fl.page || '',
            narrator: fl.narrator || '',
            type: fl.type || 'Edit',
            sentPlain: fl.sentPlain || '',
            note: fl.note || '',
            order: idx,
          });
        });
      });
    });
    return out.sort((a, b) => (a.chapterIndex - b.chapterIndex) || (a.ts - b.ts));
  }, [book.chapters]);

  function setChapterCompletion(chapterId, complete) {
    const chapters = (book.chapters || []).map(ch => {
      if (ch.id !== chapterId) return ch;
      return {
        ...ch,
        sections: (ch.sections || []).map(sec => ({ ...sec, completed: complete })),
      };
    });
    onUpdateBook({ chapters });
  }

  function toggleAllChaptersComplete() {
    const nextValue = !allChaptersComplete;
    const chapters = (book.chapters || []).map(ch => ({
      ...ch,
      sections: (ch.sections || []).map(sec => ({ ...sec, completed: nextValue })),
    }));
    onUpdateBook({ chapters });
  }

  function scrollToChapter(chapterId) {
    setExpanded(prev => ({ ...prev, [chapterId]: true }));
    const node = chapterRefs.current[chapterId];
    if (node?.scrollIntoView) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Try to restore handles on mount (web) or paths (Electron)
  useEffect(()=>{
    if (isElectron) {
      // In Electron, restore audio URLs from stored paths
      allSections.forEach(async sec => {
        const storedAudioPath = getSectionStoredAudioPath(sec);
        if (storedAudioPath) {
          const url = await window.electron.getAudioUrl(storedAudioPath);
          if (url) {
            setAudioUrls(u=>({...u,[sec.id]:url}));
            setAudioFiles(f=>({...f,[sec.id]:{name:sec.audioFileName||'audio'}}));
          }
        }
      });
      return;
    }
    if (!hasFSA) return;
    allSections.forEach(async sec => {
      const handle = await idbGet('audio-'+sec.id);
      if (handle && sec.audioFileName) {
        setRestoring(r=>({...r,[sec.id]:true}));
        const file = await restoreHandle(handle);
        setRestoring(r=>({...r,[sec.id]:false}));
        if (file) {
          setAudioFiles(f=>({...f,[sec.id]:file}));
          setAudioUrls(u=>({...u,[sec.id]:URL.createObjectURL(file)}));
        }
      }
    });
  }, [book.id]);

  function applyAudioToTargets(targetSections, fileMeta, url, audioPath) {
    const targetIds = new Set(targetSections.map(s => s.id));
    const affectedChapterIds = new Set(
      (book.chapters || [])
        .filter(chapter => (chapter.sections || []).some(section => targetIds.has(section.id)))
        .map(chapter => chapter.id)
    );
    setAudioUrls(u => {
      const next = { ...u };
      targetSections.forEach(s => {
        if (next[s.id] && next[s.id].startsWith('blob:') && next[s.id] !== url) URL.revokeObjectURL(next[s.id]);
        next[s.id] = url;
      });
      return next;
    });
    setAudioFiles(f => {
      const next = { ...f };
      targetSections.forEach(s => { next[s.id] = fileMeta; });
      return next;
    });
    const chapters = book.chapters.map(ch => ({
      ...ch,
      sections: ch.sections.map(s => targetIds.has(s.id)
        ? {
            ...clearSectionTranscription(s),
            audioFileName:fileMeta?.name||null,
            audioPath:s.audioPath || null,
            audioPaths: buildPlatformAudioPaths(s, audioPath || null),
          }
        : s),
    }));
    affectedChapterIds.forEach(chapterId => clearQueuedTranscriptionTasksForChapter(book.id, chapterId));
    setDurationCache({});
    durationProbeRef.current = {};
    onUpdateBook({ chapters, audioDurationCache: {} });
  }

  async function buildElectronPlanItems(entries) {
    const urls = await Promise.all((entries || []).map(entry => window.electron.getAudioUrl(entry.path)));
    return (entries || [])
      .map((entry, index) => ({
        name: entry.name,
        audioPath: entry.storedPath || entry.path,
        url: urls[index],
        fileMeta: { name: entry.name },
      }))
      .filter(item => item.url);
  }

  async function applyBulkAudioPlan(plan, previousPlan = book.bulkAudioPlan) {
    const chapters = book.chapters || [];
    const startIndex = chapters.findIndex(ch => ch.id === plan?.startChapterId);
    if (startIndex < 0) return;
    const previousStartIndex = chapters.findIndex(ch => ch.id === previousPlan?.startChapterId);
    const previousLen = previousPlan?.items?.length || 0;
    const nextLen = plan?.items?.length || 0;
    const affectedIndexes = new Set();
    if (previousStartIndex >= 0) {
      for (let index = previousStartIndex; index < previousStartIndex + previousLen; index += 1) affectedIndexes.add(index);
    }
    for (let index = startIndex; index < startIndex + nextLen; index += 1) affectedIndexes.add(index);

    const nextUrls = { ...audioUrls };
    const nextFiles = { ...audioFiles };
    const nextChapters = [];

    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
      const chapter = chapters[chapterIndex];
      if (!affectedIndexes.has(chapterIndex)) {
        nextChapters.push(chapter);
        continue;
      }
      const planItem = chapterIndex >= startIndex ? plan.items?.[chapterIndex - startIndex] : null;
      const nextSections = [];
      for (const section of (chapter.sections || [])) {
        if (nextUrls[section.id] && nextUrls[section.id].startsWith('blob:') && nextUrls[section.id] !== planItem?.url) {
          URL.revokeObjectURL(nextUrls[section.id]);
        }
        if (planItem?.handle) await idbSet('audio-' + section.id, planItem.handle);
        if (planItem) {
          nextUrls[section.id] = planItem.url;
          nextFiles[section.id] = planItem.fileMeta || { name: planItem.name };
          nextSections.push({
            ...clearSectionTranscription(section),
            audioFileName: planItem.name || planItem.fileMeta?.name || null,
            audioPath: section.audioPath || null,
            audioPaths: buildPlatformAudioPaths(section, planItem.audioPath || null),
          });
        } else {
          delete nextUrls[section.id];
          delete nextFiles[section.id];
          nextSections.push({
            ...clearSectionTranscription(section),
            audioFileName: null,
            audioPath: section.audioPath || null,
            audioPaths: buildPlatformAudioPaths(section, null),
          });
        }
      }
      clearQueuedTranscriptionTasksForChapter(book.id, chapter.id);
      nextChapters.push({ ...chapter, sections: nextSections });
    }

    setAudioUrls(nextUrls);
    setAudioFiles(nextFiles);
    setDurationCache({});
    durationProbeRef.current = {};
    onUpdateBook({ chapters: nextChapters, audioDurationCache: {} });
  }

  async function bulkImportAudio() {
    if (!bulkStartChapterId) return;
    if (isElectron) {
      const results = await window.electron.openAudioDialog({ multiple: true });
      if (!results?.length) return;
      const items = await buildElectronPlanItems(results);
      if (!items.length) return;
      await applyBulkAudioPlan({ startChapterId: bulkStartChapterId, items }, null);
      return;
    }
    if (hasFSA && window.showOpenFilePicker) {
      try {
        const handles = await window.showOpenFilePicker({ types:[{description:'Audio',accept:{'audio/*':[]}}], multiple:true });
        const items = await Promise.all(handles.map(async handle => {
          const file = await handle.getFile();
          return { name: file.name, url: URL.createObjectURL(file), fileMeta: file, handle };
        }));
        if (items.length) await applyBulkAudioPlan({ startChapterId: bulkStartChapterId, items }, null);
      } catch {}
      return;
    }
    const input = document.createElement('input');
    input.type='file'; input.accept='audio/*'; input.multiple = true;
    input.onchange = async e => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const items = files.map(file => ({ name: file.name, url: URL.createObjectURL(file), fileMeta: file }));
      await applyBulkAudioPlan({ startChapterId: bulkStartChapterId, items }, null);
    };
    input.click();
  }

  async function selectAudio(sec, chapter, applyToChapter = false) {
    const targetSections = applyToChapter ? (chapter?.sections || [sec]) : [sec];
    if (isElectron) {
      const result = await window.electron.openAudioDialog();
      if (!result) return;
      const url = await window.electron.getAudioUrl(result.path);
      if (!url) return;
      applyAudioToTargets(targetSections, { name: result.name }, url, result.storedPath || result.path);
    } else if (hasFSA) {
      const handle = await pickAudioFile();
      if (!handle) return;
      const file = await handle.getFile();
      const url = URL.createObjectURL(file);
      for (const target of targetSections) {
        await idbSet('audio-'+target.id, handle);
      }
      applyAudioToTargets(targetSections, file, url);
    } else {
      const input = document.createElement('input');
      input.type='file'; input.accept='audio/*';
      input.onchange=e=>{
        const file=e.target.files[0]; if(!file) return;
        const url = URL.createObjectURL(file);
        applyAudioToTargets(targetSections, file, url);
      };
      input.click();
    }
  }

  async function runQueuedTranscriptionTask(task) {
    const sections = task.sections || [];
    const mergedHtml = task.mergedHtml || '';
    const chapterTitle = task.chapterTitle || 'Chapter';

    if (!task.audioUrl || !mergedHtml) {
      return { ok: false, error: 'Need audio and manuscript text to transcribe. Please upload chapter audio first.' };
    }

    let audioBlob = null;
    const canUseNativeWhisper = typeof window !== 'undefined' && window.electron?.whisperTranscribe && task.audioPath;
    if (!canUseNativeWhisper) {
      const response = await fetch(task.audioUrl);
      if (!response.ok) throw new Error('Failed to fetch audio');
      audioBlob = await response.blob();
    }

    const pushTaskUpdate = (patch) => {
      setTranscriptionTask(task.taskId, { ...patch, updatedAt: Date.now() });
    };

    pushTaskUpdate({ progress: 0, stage: 'prepare', message: 'Preparing transcription…' });

    const result = await transcribeAudio(audioBlob, (prog) => {
      const patch = {};
      if (prog?.progress !== undefined) patch.progress = Math.max(0, Math.min(100, Math.round(Number(prog.progress) || 0)));
      if (prog?.stage) patch.stage = String(prog.stage);
      if (prog?.message) patch.message = String(prog.message);
      if (Object.keys(patch).length) pushTaskUpdate(patch);
    }, task.audioPath);

    if (getTranscriptionTask(task.taskId)?.cancelRequested) {
      return { ok: false, error: 'Cancelled.' };
    }

    if (!result?.words?.length) {
      const d = result?.diagnostics || {};
      const dur = d.audioDurationSec != null ? `${d.audioDurationSec}s` : 'unknown';
      const sr = d.decodedSampleRate != null ? `${d.decodedSampleRate} Hz` : 'unknown';
      const amp = d.maxAmplitude != null ? d.maxAmplitude : 'unknown';
      const rawSnippet = d.rawText
        ? `"${d.rawText.slice(0, 140)}${d.rawText.length > 140 ? '…' : '"'}`
        : '(none — Whisper heard nothing)';
      let cause = '';
      if (!d.audioDurationSec) cause = 'Audio decoded to 0 seconds — the file may be unreadable or in an unsupported format.';
      else if (d.maxAmplitude != null && d.maxAmplitude < 0.001) cause = 'Audio decoded but the signal is near-silent (max amplitude ' + amp + '). The file may be empty or the wrong track.';
      else if (!d.rawText) cause = `Whisper processed ${d.chunkCount ?? 0} chunks but heard nothing in any of them. The audio may contain music/narration that the current model cannot recognise — check the browser console for per-chunk errors.`;
      else cause = 'Whisper returned text but could not produce word timestamps. The fallback distributor also failed.';
      console.warn(
        `Transcription complete but no words detected.\n` +
        `Audio decoded: ${dur} at ${sr}\n` +
        `Max amplitude: ${amp}\n` +
        `Chunks processed: ${d.chunkCount ?? 0} (${d.chunksWithText ?? 0} with text)\n` +
        `Whisper raw text: ${rawSnippet}\n` +
        `Likely cause: ${cause}`
      );
      showToast(`Chapter "${chapterTitle}" finished but no words were detected.`, 'error');
      return { ok: false, error: 'No words detected. See diagnostics in console.' };
    }

    const msWords = htmlToDisplayWords(mergedHtml);
    const alignment = alignTranscriptToManuscript(msWords, result.words);
    const scoringHtml = mergedHtml.replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi, '');
    const scoreWords = htmlToDisplayWords(scoringHtml);
    const scoreAlignment = alignTranscriptToManuscript(scoreWords, result.words);
    const matchedCount = scoreAlignment.filter(Boolean).length;
    const matchQuality = scoreWords.length ? (matchedCount / scoreWords.length) : 0;
    const transcriptWordTexts = (result.words || []).map(w => String(w?.word || ''));
    const manuscriptSnippet = takeWordSnippet(msWords);
    const transcriptSnippet = takeWordSnippet(transcriptWordTexts);
    const openingOverlap = openingWordOverlapRatio(msWords, transcriptWordTexts);
    const likelyMismatch = matchQuality < 0.35 && openingOverlap < 0.2;
    const sectionWordCounts = sections.map(section => htmlToDisplayWords(section.html).length);
    let wordOffset = 0;
    const sectionAlignments = sectionWordCounts.map(count => {
      const slice = alignment.slice(wordOffset, wordOffset + count);
      wordOffset += count;
      return slice;
    });
    const transcribedAt = new Date().toISOString();

    if (getTranscriptionTask(task.taskId)?.cancelRequested) {
      return { ok: false, error: 'Cancelled.' };
    }

    onUpdateBook(currentBook => ({
      chapters: (currentBook.chapters || []).map(chapter => chapter.id !== task.chapterId ? chapter : ({
        ...chapter,
        sections: (chapter.sections || []).map((section, sectionIndex) => ({
          ...section,
          whisperTranscript: result.text,
          whisperWords: result.words,
          whisperAlignment: sectionAlignments[sectionIndex] || [],
          whisperMatchedCount: matchedCount,
          whisperManuscriptWordCount: scoreWords.length,
          whisperMatchQuality: matchQuality,
          transcribedAt,
          whisperAudioKey: task.expectedAudioKey,
          whisperTextHash: task.expectedTextHash,
          whisperSourceUpdatedAt: transcribedAt,
        })),
      })),
    }));

    console.log('Transcription debug', {
      chapterTitle,
      manuscriptWordCount: scoreWords.length,
      fullManuscriptWordCount: msWords.length,
      whisperWordCount: result.words.length,
      matchedCount,
      matchQuality,
      openingOverlap,
      manuscriptSnippet,
      transcriptSnippet,
    });

    if (likelyMismatch) {
      console.warn(
        `Low alignment warning for "${chapterTitle}".\n` +
        `Manuscript starts: ${manuscriptSnippet}\n` +
        `Transcript starts: ${transcriptSnippet}`
      );
    }

    showToast(`Transcription finished for "${chapterTitle}" (${fmtPct(matchQuality)} match).`, likelyMismatch ? 'error' : 'success');
    if (task.source === 'manual' && (book.id === 'dev-sandbox-pac3' || book.title === 'PAC3 Sandbox' || likelyMismatch)) {
      alert(
        likelyMismatch
          ? `Transcription finished.\n\nAlignment: ${fmtPct(matchQuality)}\n\nThis looks like the audio and manuscript may be different chapters.\n\nManuscript starts:\n${manuscriptSnippet}\n\nTranscript starts:\n${transcriptSnippet}`
          : `Transcription finished.\n\nAlignment: ${fmtPct(matchQuality)}\nMatched words: ${matchedCount}\nTranscript words: ${result.words.length}`
      );
    }

    return {
      ok: true,
      wordCount: result.words.length,
      matchQuality,
      doneMessage: `Done • ${result.words.length} words • Align ${fmtPct(matchQuality)}`,
    };
  }

  async function pumpTranscriptionQueue() {
    if (transcriptionQueuePumpPromise) return transcriptionQueuePumpPromise;
    transcriptionQueuePumpPromise = (async () => {
      try {
        while (true) {
          // Marie 2026-05-26: auto-resume any 'waiting' tasks. If Whisper
          // is now free (no 'running' task), flip every waiting task back
          // to 'queued' so the dispatcher picks them up. Wait a beat first
          // so the child process has time to fully exit and clear
          // activeWhisperChild in the main process.
          const snapshot = getTranscriptionQueueState();
          const hasRunning = (snapshot.tasks || []).some(t => t.status === 'running');
          const stuck = (snapshot.tasks || []).filter(t => t.status === 'waiting');
          if (stuck.length && !hasRunning) {
            await new Promise(r => setTimeout(r, 1500));
            for (const t of stuck) {
              setTranscriptionTask(t.taskId, {
                status: 'queued',
                message: 'Queued for transcription.',
                stage: 'queued',
                progress: 0,
                updatedAt: Date.now(),
              });
            }
          }
          const nextTask = (getTranscriptionQueueState().tasks || []).find(task => task.status === 'queued');
          if (!nextTask) break;

          setTranscriptionTask(nextTask.taskId, {
            status: 'running',
            progress: 0,
            stage: 'prepare',
            message: 'Preparing transcription…',
            startedAt: Date.now(),
            updatedAt: Date.now(),
          });

          try {
            const result = await nextTask.execute();
            const latestTask = getTranscriptionTask(nextTask.taskId);
            if (!latestTask) continue;
            if (latestTask.cancelRequested) {
              setTranscriptionTask(nextTask.taskId, {
                status: 'cancelled',
                message: 'Cancelled.',
                stage: 'cancelled',
                progress: 0,
                finishedAt: Date.now(),
                updatedAt: Date.now(),
              });
            } else if (result?.ok) {
              setTranscriptionTask(nextTask.taskId, {
                status: 'done',
                message: result.doneMessage || 'Done.',
                stage: 'done',
                progress: 100,
                finishedAt: Date.now(),
                updatedAt: Date.now(),
              });
            } else {
              setTranscriptionTask(nextTask.taskId, {
                status: 'error',
                message: result?.error || 'Transcription failed.',
                stage: 'error',
                progress: 0,
                finishedAt: Date.now(),
                updatedAt: Date.now(),
              });
            }
          } catch (error) {
            console.error('Transcription failed:', error);
            const latestTask = getTranscriptionTask(nextTask.taskId);
            const cancelled = latestTask?.cancelRequested;
            // Marie 2026-05-26: when Whisper is already running another
            // chapter, the IPC throws "Whisper is already transcribing…".
            // That's not an error to scare the user with — it just means
            // wait. Show a friendly "Waiting…" state, no red toast.
            const rawMsg = String(error?.message || '');
            const isQueueClash = /whisper is already transcribing/i.test(rawMsg);
            if (isQueueClash && !cancelled) {
              setTranscriptionTask(nextTask.taskId, {
                status: 'waiting',
                message: 'Waiting for the current chapter to finish. Press Transcribe again once the running one is done.',
                stage: 'waiting',
                progress: 0,
                finishedAt: Date.now(),
                updatedAt: Date.now(),
              });
            } else {
              setTranscriptionTask(nextTask.taskId, {
                status: cancelled ? 'cancelled' : 'error',
                message: cancelled ? 'Cancelled.' : `Failed: ${error?.message || 'Unknown error'}`,
                stage: cancelled ? 'cancelled' : 'error',
                progress: 0,
                finishedAt: Date.now(),
                updatedAt: Date.now(),
              });
              if (!cancelled) showToast(`Transcription failed for "${nextTask.chapterTitle}".`, 'error');
            }
          }
        }
      } finally {
        transcriptionQueuePumpPromise = null;
      }
    })();
    return transcriptionQueuePumpPromise;
  }

  function queueChapterTranscription(ch, source = 'manual') {
    const sections = ch.sections || [];
    const sectionWithPath = sections.find(section => !!getSectionStoredAudioPath(section));
    const sectionWithAudio = sections.find(section => audioUrls[section.id]);
    const audioUrl = sectionWithAudio ? audioUrls[sectionWithAudio.id] : null;
    const audioPath = getSectionStoredAudioPath(sectionWithPath) || null;
    const mergedHtml = sections.map(section => section.html || '').join('');
    const expectedAudioKey = getChapterAudioKey(ch);
    const expectedTextHash = getChapterTextHash(ch);

    if (!audioUrl || !mergedHtml) {
      alert('Need audio and manuscript text to transcribe. Please upload chapter audio first.');
      return { queued: false, reason: 'missing-source' };
    }

    const existingTask = (getTranscriptionQueueState().tasks || []).find(task => task.bookId === book.id && task.chapterId === ch.id && (task.status === 'queued' || task.status === 'running'));
    if (existingTask) {
      setSidePanelTab('transcriptions');
      showToast(`"${ch.title}" is already in the transcription queue.`, 'info');
      return { queued: false, reason: 'already-queued' };
    }

    const taskId = `${book.id}:${ch.id}`;
    updateTranscriptionQueue(state => ({
      ...state,
      tasks: [
        ...(state.tasks || []).filter(task => !(task.bookId === book.id && task.chapterId === ch.id)),
        {
          taskId,
          bookId: book.id,
          chapterId: ch.id,
          chapterTitle: ch.title,
          sections: sections.map(section => ({ id: section.id, html: section.html || '' })),
          audioUrl,
          audioPath,
          mergedHtml,
          expectedAudioKey,
          expectedTextHash,
          source,
          status: 'queued',
          progress: 0,
          stage: 'queued',
          message: 'Queued.',
          cancelRequested: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          execute: () => runQueuedTranscriptionTask({
            taskId,
            chapterId: ch.id,
            chapterTitle: ch.title,
            sections: sections.map(section => ({ id: section.id, html: section.html || '' })),
            audioUrl,
            audioPath,
            mergedHtml,
            expectedAudioKey,
            expectedTextHash,
            source,
          }),
        },
      ],
    }));
    setSidePanelTab('transcriptions');
    void pumpTranscriptionQueue();
    return { queued: true };
  }

  function removeOrCancelTranscriptionTask(task) {
    if (!task) return;
    if (task.status === 'running') {
      setTranscriptionTask(task.taskId, {
        cancelRequested: true,
        message: 'Cancelling…',
        stage: 'cancel',
        updatedAt: Date.now(),
      });
      if (typeof window !== 'undefined' && window.electron?.whisperCancel) {
        window.electron.whisperCancel().catch(() => {});
      }
      return;
    }
    removeTranscriptionTask(task.taskId);
  }

  // Re-run alignment only (skip Whisper) using existing transcript words.
  function realignChapter(ch) {
    const sections = ch.sections || [];
    const expectedAudioKey = getChapterAudioKey(ch);
    const expectedTextHash = getChapterTextHash(ch);
    const sectionWithWords = sections.find(section => hasCurrentSectionTranscription(section, expectedAudioKey, expectedTextHash));
    if (!sectionWithWords) {
      alert('No existing transcription found. Run Transcribe first.');
      return;
    }
    const whisperWords = sectionWithWords.whisperWords;
    const mergedHtml = sections.map(s => s.html || '').join('');
    const msWords = htmlToDisplayWords(mergedHtml);
    const alignment = alignTranscriptToManuscript(msWords, whisperWords);

    // Debug: log sample of alignment matches so we can verify correctness
    const samplePoints = [0, 50, 100, 200, 500, 1000, 1500, 2000].filter(i => i < msWords.length);
    console.log('Re-align debug — sample matches:');
    samplePoints.forEach(mi => {
      const match = alignment[mi];
      const msWord = msWords[mi] || '?';
      if (match) {
        const wWord = whisperWords[match.wordIdx]?.word || '?';
        const wTime = whisperWords[match.wordIdx]?.start?.toFixed(1) || '?';
        console.log(`  ms[${mi}]="${msWord}" → whisper[${match.wordIdx}]="${wWord}" @${wTime}s conf=${match.confidence?.toFixed(2)}`);
      } else {
        console.log(`  ms[${mi}]="${msWord}" → (no match)`);
      }
    });

    const scoringHtml = mergedHtml.replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi, '');
    const scoreWords = htmlToDisplayWords(scoringHtml);
    const scoreAlignment = alignTranscriptToManuscript(scoreWords, whisperWords);
    const matchedCount = scoreAlignment.filter(Boolean).length;
    const matchQuality = scoreWords.length ? (matchedCount / scoreWords.length) : 0;

    const sectionWordCounts = sections.map(s => htmlToDisplayWords(s.html).length);
    let wOff = 0;
    const sectionAlignments = sectionWordCounts.map(count => {
      const slice = alignment.slice(wOff, wOff + count);
      wOff += count;
      return slice;
    });
    const chapters = book.chapters.map(c => c.id !== ch.id ? c : ({
      ...c,
      sections: c.sections.map((s, si) => ({
        ...s,
        whisperAlignment: sectionAlignments[si] || [],
        whisperMatchedCount: matchedCount,
        whisperManuscriptWordCount: scoreWords.length,
        whisperMatchQuality: matchQuality,
        whisperAudioKey: expectedAudioKey,
        whisperTextHash: expectedTextHash,
        whisperSourceUpdatedAt: new Date().toISOString(),
      })),
    }));
    onUpdateBook({ chapters });
    showToast(`Re-aligned "${ch.title}" — ${fmtPct(matchQuality)} match (${matchedCount} words).`, 'success');
    alert(`Re-alignment finished.\n\nAlignment: ${fmtPct(matchQuality)}\nMatched words: ${matchedCount}\nTranscript words: ${whisperWords.length}`);
  }
  // Transcribe all chapters sequentially in the background.
  // Yields to the event loop between chapters so the UI stays responsive.
  function openTranscribeAllModal() {
    const chapters = book.chapters || [];
    const ready = chapters.filter(ch => {
      const secs = ch.sections || [];
      const hasAudio = secs.length > 0 && secs.every(s => audioUrls[s.id]);
      const hasHtml = secs.some(s => s.html);
      return hasAudio && hasHtml;
    });
    if (!ready.length) {
      alert('No chapters have both audio and manuscript text. Upload audio first.');
      return;
    }
    setRetranscribeAll(false);
    setShowTranscribeAllModal(true);
  }

  async function transcribeAllChapters() {
    setShowTranscribeAllModal(false);
    const chapters = book.chapters || [];
    const ready = chapters.filter(ch => {
      const secs = ch.sections || [];
      const hasAudio = secs.length > 0 && secs.every(s => audioUrls[s.id]);
      const hasHtml = secs.some(s => s.html);
      return hasAudio && hasHtml;
    });
    if (!ready.length) return;
    const toTranscribe = retranscribeAll ? ready : ready.filter(ch => !isChapterTranscriptionCurrent(ch));
    if (!toTranscribe.length) {
      showToast('All chapters already transcribed. Enable "Re-transcribe" to redo them.', 'info');
      return;
    }
    let queued = 0;
    toTranscribe.forEach(chapter => {
      const result = queueChapterTranscription(chapter, 'batch');
      if (result.queued) queued += 1;
    });
    if (!queued) {
      showToast('Those chapters are already queued.', 'info');
      return;
    }
    showToast(`Queued ${queued} chapter${queued !== 1 ? 's' : ''} for transcription.`, 'info');
  }

  function buildContinuousProofSection(chapter, section) {
    const sectionUrl = audioUrls[section.id];
    const sections = chapter?.sections || [];
    const sectionIdx = sections.findIndex(s => s.id === section.id);
    if (!sectionUrl || sectionIdx < 0) return section;

    let startIdx = sectionIdx;
    while (startIdx > 0 && audioUrls[sections[startIdx - 1].id] === sectionUrl) {
      startIdx -= 1;
    }

    let endIdx = sectionIdx;
    while (endIdx < sections.length - 1 && audioUrls[sections[endIdx + 1].id] === sectionUrl) {
      endIdx += 1;
    }

    const allSections = sections.slice(startIdx, endIdx + 1);
    const proofWordCount = allSections.reduce((n, s) => n + countWordsInHtml(s.html), 0);
    const expectedAudioKey = getSectionAudioKey(allSections[0]) || getSectionAudioKey(section) || '';
    const expectedTextHash = hashText(allSections.map(s => s.html || '').join(''));
    const hasCurrentMergedTranscription = allSections.every(s => hasCurrentSectionTranscription(s, expectedAudioKey, expectedTextHash));

    if (startIdx === endIdx) {
      return {
        ...section,
        whisperAlignment: hasCurrentMergedTranscription ? section.whisperAlignment : [],
        whisperWords: hasCurrentMergedTranscription ? section.whisperWords : [],
        proofWordCount,
      };
    }

    const mergedHtml = allSections.map(s => s.html || '').join('');
    const prefixWordCount = sections.slice(startIdx, sectionIdx)
      .reduce((n, s) => n + countWordsInHtml(s.html), 0);

    return {
      ...section,
      html: mergedHtml,
      whisperAlignment: hasCurrentMergedTranscription ? mergeContinuousAlignment(allSections) : [],
      whisperWords: hasCurrentMergedTranscription ? (allSections.find(s => Array.isArray(s.whisperWords) && s.whisperWords.length)?.whisperWords || section.whisperWords || []) : [],
      proofInitialWordOffset: prefixWordCount,
      proofWordCount,
    };
  }

  function buildProofSectionForReader(chapter, section) {
    const merged = buildContinuousProofSection(chapter, section);
    const isFirstSectionInChapter = ((chapter?.sections || []).findIndex(s => s.id === section.id) === 0);
    return {
      ...merged,
      chapterTitle: chapter?.title || merged.chapterTitle || "",
      audioFileName: audioFiles[section.id]?.name || section.audioFileName || merged.audioFileName || "",
      isFirstSectionInChapter,
    };
  }

  function openSceneProof(chapter, section) {
    const url = audioUrls[section.id];
    if (!url) return;
    onProof(buildProofSectionForReader(chapter, section), url);
  }

  function openChapterProof(chapter) {
    // Proof: needs audio attached before opening (listen flow).
    // Quill: open straight into the reader even without audio (annotate flow).
    const firstSection = (chapter?.sections || []).find(sec => !!audioUrls[sec.id])
      || (mode === 'quill' ? (chapter?.sections || [])[0] : null);
    if (!firstSection) return;
    openSceneProof(chapter, firstSection);
  }

  function renderChapterNavigator(isInline = false) {
    if (!chapterSummaries.length) return null;
    const hasRunningQueueTask = bookQueueItems.some(task => task.status === 'running');
    const renderNavigationTab = () => (
      <div style={{ padding:isInline ? '3px 0 0' : '3px 4px 5px',overflowY:'auto',minHeight:isInline ? 180 : 320,maxHeight:isInline ? 'min(210px, 34vh)' : `calc(100vh - ${persistentAudioUrl ? 214 : 178}px)` }}>
        {chapterSummaries.map(item => (
          <div key={`nav-${item.id}`} style={{ display:'grid',gridTemplateColumns:'1fr 20px',gap:6,alignItems:'center',padding:'1px 1px' }}>
            <button
              onClick={() => scrollToChapter(item.id)}
              style={{
                border:'1px solid transparent',
                background:item.isComplete ? '#f6f1ff' : 'transparent',
                color:'var(--text)',
                borderRadius:10,
                padding:'5px 7px',
                textAlign:'left',
                cursor:'pointer',
              }}
            >
              <div style={{ minWidth:0,display:'flex',alignItems:'center',gap:8 }}>
                <span style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:38,padding:'2px 8px',borderRadius:999,background:'white',border:'1px solid var(--border-light)',fontSize:'0.68rem',fontWeight:800,color:'var(--text-muted)',flex:'0 0 auto' }}>
                  {item.displayNumber}
                </span>
                <div style={{ fontSize:'0.74rem',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:'var(--text)',lineHeight:1.15 }}>
                  {item.chapter.title}
                </div>
              </div>
            </button>
            <div aria-label={item.isComplete ? 'Complete' : 'Incomplete'} title={item.isComplete ? 'Complete' : 'Not yet listened — not a delete button'} style={{ color:item.isComplete ? 'var(--success)' : 'var(--text-light)',fontSize:item.isComplete ? '0.86rem' : '0.7rem',fontWeight:item.isComplete ? 900 : 600,textAlign:'center',lineHeight:1 }}>
              {item.isComplete ? '✓' : '○'}
            </div>
          </div>
        ))}
      </div>
    );

    const renderFlagsTab = () => (
      <div style={{ padding:isInline ? '4px 2px 4px' : '6px 6px 7px',overflowY:'auto',minHeight:isInline ? 180 : 320,maxHeight:isInline ? 'min(210px, 34vh)' : `calc(100vh - ${persistentAudioUrl ? 214 : 178}px)` }}>
        {allFlagsAcrossBook.length === 0 ? (
          <div style={{ padding:'14px 10px',fontSize:'0.74rem',color:'var(--text-muted)',lineHeight:1.5 }}>
            No flags yet. Open a chapter and tap a word to flag a moment.
          </div>
        ) : (
          allFlagsAcrossBook.map((flag) => (
            <div
              key={`${flag.sectionId}-${flag.id}`}
              style={{ display:'flex',alignItems:'flex-start',gap:6,padding:'6px 4px',borderBottom:'1px solid var(--border-light)' }}
            >
              <button
                type="button"
                onClick={() => scrollToChapter(flag.chapterId)}
                title="Jump to this chapter"
                style={{ flex:1,background:'transparent',border:'none',padding:'2px 4px',textAlign:'left',cursor:'pointer',minWidth:0 }}
              >
                <div style={{ display:'flex',alignItems:'baseline',gap:6,fontSize:'0.66rem',color:'var(--text-light)',fontWeight:700,letterSpacing:'0.04em',textTransform:'uppercase',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                  <span>Ch {flag.chapterDisplay}</span>
                  <span style={{ fontFamily:'monospace',color:'var(--accent-dark)' }}>{fmtTime(flag.ts)}</span>
                  <span>· {flag.type}</span>
                  {flag.page && flag.page !== '#' && <span>· p.{flag.page}</span>}
                </div>
                <div style={{ fontSize:'0.74rem',color:'var(--text)',fontStyle:'italic',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                  &ldquo;{flag.sentPlain || '(no quote)'}&rdquo;
                </div>
                {flag.note && (
                  <div style={{ fontSize:'0.7rem',color:'var(--text-muted)',marginTop:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                    {flag.note}
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete this ${flag.type} flag on Ch ${flag.chapterDisplay}?`)) removeFlagFromBook(flag.sectionId, flag.id);
                }}
                aria-label="Delete flag"
                title="Delete flag"
                style={{ flexShrink:0,width:22,height:22,padding:0,borderRadius:999,border:'1px solid #f0b8b8',background:'white',color:'var(--danger)',cursor:'pointer',fontSize:'0.78rem',lineHeight:1,display:'inline-flex',alignItems:'center',justifyContent:'center' }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    );

    const renderTranscriptionsTab = () => (
      <div style={{ padding:isInline ? '4px 0 0' : '6px 6px 7px',overflowY:'auto',minHeight:isInline ? 180 : 320,maxHeight:isInline ? 'min(210px, 34vh)' : `calc(100vh - ${persistentAudioUrl ? 214 : 178}px)` }}>
        {!bookQueueItems.length ? (
          <div style={{ padding:'10px 8px',fontSize:'0.74rem',lineHeight:1.45,color:'var(--text-muted)' }}>
            No queued transcriptions yet.
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
            {/* Stop All — Marie 2026-05-26: clicking 45 individual × buttons
                was the friction point. One Stop All cancels everything
                running + queued + waiting in this book. */}
            {bookQueueItems.some(t => t.status === 'running' || t.status === 'queued' || t.status === 'waiting') && (
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm('Stop every transcription in this book? Running, queued, and waiting items will all be cancelled.')) return;
                  for (const t of bookQueueItems) {
                    if (t.status === 'running') {
                      setTranscriptionTask(t.taskId, { cancelRequested: true, message: 'Cancelling…', stage: 'cancel', updatedAt: Date.now() });
                      if (typeof window !== 'undefined' && window.electron?.whisperCancel) {
                        window.electron.whisperCancel().catch(() => {});
                      }
                    } else if (t.status === 'queued' || t.status === 'waiting') {
                      removeTranscriptionTask(t.taskId);
                    }
                  }
                }}
                style={{ padding:'6px 10px',borderRadius:10,border:'1px solid #efc6c3',background:'white',color:'var(--danger)',fontWeight:700,fontSize:'0.74rem',cursor:'pointer',alignSelf:'flex-end' }}
                title="Cancel every transcription in this book"
              >
                ■ Stop all
              </button>
            )}
            {bookQueueItems.map(task => {
              const isActive = task.status === 'running';
              const isQueued = task.status === 'queued';
              const isError = task.status === 'error';
              const isDone = task.status === 'done';
              const tone = isError ? 'var(--danger)' : isDone ? 'var(--success)' : 'var(--accent-dark)';
              return (
                <div key={task.taskId} style={{ background:'white',border:'1px solid '+(isError ? '#efc6c3' : 'var(--accent-border)'),borderRadius:12,padding:'8px 8px 7px',boxShadow:isActive ? '0 8px 18px var(--accent-shadow)' : 'none' }}>
                  <div style={{ display:'flex',alignItems:'flex-start',gap:8 }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4 }}>
                        <div style={{ fontSize:'0.76rem',fontWeight:700,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{task.chapterTitle}</div>
                        <span style={{ fontSize:'0.63rem',fontWeight:700,color:tone,background:isError ? 'var(--danger-light)' : isDone ? 'var(--success-light)' : 'var(--accent-soft)',borderRadius:999,padding:'2px 6px',textTransform:'uppercase',letterSpacing:'0.05em',flexShrink:0 }}>
                          {isActive ? 'Running' : isQueued ? 'Queued' : isDone ? 'Done' : isError ? 'Error' : 'Stopped'}
                        </span>
                      </div>
                      <div style={{ height:4,borderRadius:999,background:'var(--accent-light)',overflow:'hidden',marginBottom:5 }}>
                        <div style={{ width:`${Math.max(0, Math.min(100, task.progress || 0))}%`,height:'100%',background:isError ? 'var(--danger)' : isDone ? 'var(--success)' : 'var(--accent)',transition:'width 160ms linear' }} />
                      </div>
                      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:8 }}>
                        <span style={{ fontSize:'0.68rem',color:'var(--text-muted)',lineHeight:1.35,flex:1 }}>{task.message || 'Queued.'}</span>
                        <span style={{ fontSize:'0.67rem',color:'var(--text-light)',fontWeight:600,flexShrink:0 }}>{task.progress ? `${task.progress}%` : ''}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeOrCancelTranscriptionTask(task)}
                      title={isActive ? 'Cancel transcription' : 'Remove from list'}
                      aria-label={isActive ? 'Cancel transcription' : 'Remove from list'}
                      style={{ border:'1px solid var(--border)',background:'white',color:'var(--text-muted)',borderRadius:999,width:26,height:26,cursor:'pointer',fontSize:'0.78rem',flexShrink:0 }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );

    return (
      <div
        style={isInline
          ? {
              background:'white',
              border:'1px solid var(--border)',
              borderRadius:16,
              padding:'6px 7px 4px',
              marginBottom:'0.75rem',
              boxShadow:'0 10px 24px var(--accent-shadow)',
              // Pinned-tab pattern: fixed height so the tab strip top
              // never moves when switching between Nav and Queue.
              // Content inside scrolls if it overflows. (See
              // CLAUDE.md "Tab-top pinned" rule.)
              display:'flex',
              flexDirection:'column',
              minHeight:240,
              maxHeight:'40vh',
            }
          : {
              // Centered vertically — was top:88 spanning full height,
              // which felt like a sticky banner. Capped at 60vh so it
              // floats neatly to one side instead of dominating the page.
              // Marie 2026-05-26: bumped width 224→252 and right 12→24
              // because the Nav/Flags/Queue tab pill (minWidth 220) was
              // clipping inside the old 224 width.
              position:'fixed',
              right:24,
              top:'50%',
              transform:'translateY(-50%)',
              width:252,
              height:'min(60vh, 560px)',
              overflow:'hidden',
              background:'rgba(255,255,255,0.96)',
              backdropFilter:'blur(10px)',
              border:'1px solid var(--accent-border)',
              borderRadius:16,
              boxShadow:'0 16px 32px var(--accent-shadow-strong)',
              zIndex:980,
              display:'flex',
              flexDirection:'column',
            }}
      >
        <div style={{ padding:isInline ? 0 : '8px 8px 6px',borderBottom:isInline ? 'none' : '1px solid var(--accent-border)' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'flex-start' }}>
            <div style={{ display:'inline-flex',alignItems:'center',gap:4,background:'white',border:'1px solid var(--accent-border)',borderRadius:999,padding:3,minWidth:220 }}>
              <button
                onClick={() => setSidePanelTab('navigation')}
                style={{ flex:1,border:'none',background:sidePanelTab === 'navigation' ? 'var(--accent-light)' : 'transparent',color:sidePanelTab === 'navigation' ? 'var(--accent-dark)' : 'var(--text-muted)',padding:'5px 8px',borderRadius:999,fontSize:'0.68rem',fontWeight:700,cursor:'pointer',textAlign:'center' }}
              >
                Nav
              </button>
              <button
                onClick={() => setSidePanelTab('flags')}
                aria-label={`All flags (${allFlagsAcrossBook.length})`}
                title={`View every flag in this book (${allFlagsAcrossBook.length})`}
                style={{ flex:1,border:'none',background:sidePanelTab === 'flags' ? 'var(--accent-light)' : 'transparent',color:sidePanelTab === 'flags' ? 'var(--accent-dark)' : 'var(--text-muted)',padding:'5px 8px',borderRadius:999,fontSize:'0.68rem',fontWeight:700,cursor:'pointer',textAlign:'center',display:'inline-flex',alignItems:'center',justifyContent:'center',gap:4 }}
              >
                <span>Flags</span>
                {allFlagsAcrossBook.length > 0 && (
                  <span style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:16,height:14,padding:'0 4px',borderRadius:999,background:sidePanelTab === 'flags' ? 'var(--accent-dark)' : 'var(--cream-dark)',color:sidePanelTab === 'flags' ? 'white' : 'var(--text-muted)',fontSize:'0.6rem',fontWeight:800,lineHeight:1 }}>
                    {allFlagsAcrossBook.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setSidePanelTab('transcriptions')}
                style={{ flex:1,border:'none',background:sidePanelTab === 'transcriptions' ? 'var(--accent-light)' : 'transparent',color:sidePanelTab === 'transcriptions' ? 'var(--accent-dark)' : 'var(--text-muted)',padding:'5px 16px 5px 8px',borderRadius:999,fontSize:'0.68rem',fontWeight:700,cursor:'pointer',position:'relative',textAlign:'center' }}
              >
                Queue
                <span
                  aria-hidden="true"
                  style={{
                    position:'absolute',
                    right:7,
                    top:'50%',
                    width:8,
                    height:8,
                    marginTop:-4,
                    borderRadius:'50%',
                    border:hasRunningQueueTask ? '1.5px solid var(--warning)' : '1.5px solid transparent',
                    borderTopColor:hasRunningQueueTask ? 'transparent' : 'transparent',
                    animation:hasRunningQueueTask ? 'ap-spin 0.9s linear infinite, ap-queue-fade 1.05s ease-in-out infinite' : 'none',
                    opacity:hasRunningQueueTask ? 1 : 0,
                  }}
                />
              </button>
            </div>
          </div>
        </div>
        {sidePanelTab === 'navigation' && renderNavigationTab()}
        {sidePanelTab === 'flags' && renderFlagsTab()}
        {sidePanelTab === 'transcriptions' && renderTranscriptionsTab()}
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh',background:'var(--cream)' }}>
      {toast && (
        <div
          style={{
            position:'fixed',
            left:'48%',
            transform:'translateX(-50%)',
            top:16,
            right:'auto',
            zIndex:1100,
            maxWidth:380,
            padding:'10px 12px',
            borderRadius:10,
            border:'1px solid var(--border)',
            background: toast.tone === 'success' ? '#f0fdf4' : toast.tone === 'error' ? '#fef2f2' : 'white',
            color: toast.tone === 'success' ? '#166534' : toast.tone === 'error' ? '#991b1b' : 'var(--text)',
            boxShadow:'0 8px 20px rgba(0,0,0,0.08)',
            fontSize:'0.8rem',
            fontWeight:600,
          }}
        >
          {toast.message}
        </div>
      )}
      {showTimingDetails && (
        <div style={{ position:'fixed',inset:0,background:'rgba(28, 18, 44, 0.18)',backdropFilter:'blur(4px)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px' }} onClick={()=>setShowTimingDetails(false)}>
          <div style={{ width:'min(760px, 100%)',maxHeight:'min(78vh, 720px)',overflow:'auto',background:'white',border:'1px solid var(--accent-border)',borderRadius:24,boxShadow:'0 24px 60px var(--accent-shadow-strong)',padding:'18px 18px 16px' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:14 }}>
              <div>
                <div style={{ fontSize:'0.72rem',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--accent-dark)',marginBottom:4 }}>Audiobook timing detail</div>
                <div style={{ fontSize:'0.82rem',color:'var(--text-muted)' }}>Separate runtime totals by character and by assigned narrator.</div>
              </div>
              <button onClick={()=>setShowTimingDetails(false)} style={btn({ background:'white',borderColor:'var(--accent-border)',color:'var(--accent-dark)',fontWeight:700 })}>Close</button>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))',gap:12 }}>
              <div style={{ background:'var(--accent-surface)',border:'1px solid var(--accent-border)',borderRadius:18,padding:'12px 14px' }}>
                <div style={{ fontSize:'0.76rem',fontWeight:700,color:'var(--accent-dark)',marginBottom:10 }}>By character</div>
                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {durationSummary.characterRows.map(row => (
                    <div key={`char-${row.name}`} style={{ display:'flex',justifyContent:'space-between',gap:10,fontSize:'0.78rem' }}>
                      <span style={{ color:'var(--text-muted)' }}>{row.name}</span>
                      <span style={{ color:'var(--text)',fontWeight:700 }}>{fmtDuration(row.seconds)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background:'var(--accent-surface)',border:'1px solid var(--accent-border)',borderRadius:18,padding:'12px 14px' }}>
                <div style={{ fontSize:'0.76rem',fontWeight:700,color:'var(--accent-dark)',marginBottom:10 }}>By narrator</div>
                <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                  {durationSummary.narratorRows.map(row => (
                    <div key={`nar-${row.name}`} style={{ display:'grid',gridTemplateColumns:'1fr auto',gap:10,alignItems:'start',fontSize:'0.78rem' }}>
                      <div>
                        <div style={{ color:'var(--text-muted)' }}>{row.name}</div>
                        <div style={{ fontSize:'0.69rem',color:'var(--text-light)',marginTop:2 }}>{row.characters.join(', ')}</div>
                      </div>
                      <span style={{ color:'var(--text)',fontWeight:700 }}>{fmtDuration(row.seconds)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Re-upload chapter selection modal */}
      {reuploadPreview && (
        <div style={{ position:'fixed',inset:0,background:'rgba(28,18,44,0.18)',backdropFilter:'blur(4px)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }} onClick={()=>setReuploadPreview(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'white',borderRadius:20,padding:'2rem',maxWidth:520,width:'100%',maxHeight:'80vh',overflow:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ fontSize:'1rem',fontWeight:700,marginBottom:'0.75rem' }}>Select chapters to keep</h3>
            <p style={{ fontSize:'0.78rem',color:'var(--text-muted)',marginBottom:'1rem' }}>Uncheck any chapters you don't need (e.g. copyright, title page). Audio and flags will be preserved for matching sections.</p>
            <div style={{ display:'flex',flexDirection:'column',gap:4,marginBottom:'1.25rem' }}>
              {reuploadPreview.chapters.map((ch, i) => (
                <label key={ch.id || i} style={{ display:'flex',alignItems:'center',gap:8,fontSize:'0.84rem',padding:'6px 8px',borderRadius:8,cursor:'pointer',background: ch.included === false ? 'var(--cream)' : 'white',opacity: ch.included === false ? 0.5 : 1 }}>
                  <input type="checkbox" checked={ch.included !== false} onChange={e => {
                    setReuploadPreview(prev => ({ ...prev, chapters: prev.chapters.map((c, j) => j === i ? { ...c, included: e.target.checked } : c) }));
                  }} style={{ accentColor:'var(--accent)' }} />
                  <span style={{ fontWeight:600 }}>{ch.title}</span>
                  <span style={{ fontSize:'0.7rem',color:'var(--text-muted)',marginLeft:'auto' }}>{(ch.sections||[]).length} section{(ch.sections||[]).length !== 1 ? 's' : ''}</span>
                </label>
              ))}
            </div>
            <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
              <button onClick={()=>setReuploadPreview(null)} style={{ padding:'8px 16px',borderRadius:10,fontSize:'0.82rem',fontWeight:600,border:'1px solid var(--border)',background:'white',color:'var(--text-muted)',cursor:'pointer' }}>Cancel</button>
              <button onClick={confirmReupload} style={{ padding:'8px 20px',borderRadius:10,fontSize:'0.82rem',fontWeight:600,border:'none',background:'var(--accent)',color:'white',cursor:'pointer' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      {showTranscribeAllModal && (() => {
        const chapters = book.chapters || [];
        const ready = chapters.filter(ch => {
          const secs = ch.sections || [];
          return secs.length > 0 && secs.every(s => audioUrls[s.id]) && secs.some(s => s.html);
        });
        const alreadyDone = ready.filter(ch => isChapterTranscriptionCurrent(ch)).length;
        const pending = ready.length - alreadyDone;
        const willRun = retranscribeAll ? ready.length : pending;
        return (
          <div style={{ position:'fixed',inset:0,background:'rgba(28,18,44,0.18)',backdropFilter:'blur(4px)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }} onClick={()=>setShowTranscribeAllModal(false)}>
            <div style={{ width:'min(420px,100%)',background:'white',border:'1px solid var(--accent-border)',borderRadius:20,boxShadow:'0 24px 60px var(--accent-shadow-strong)',padding:'24px 24px 20px' }} onClick={e=>e.stopPropagation()}>
              <div style={{ fontSize:'1.05rem',fontWeight:700,color:'var(--text)',marginBottom:12 }}>Transcribe All Chapters</div>
              <div style={{ fontSize:'0.82rem',color:'var(--text-muted)',lineHeight:1.5,marginBottom:16 }}>
                {ready.length} chapter{ready.length!==1?'s':''} ready.{alreadyDone > 0 && <> <strong>{alreadyDone}</strong> already transcribed, <strong>{pending}</strong> remaining.</>}
              </div>
              {alreadyDone > 0 && (
                <label style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:16,fontSize:'0.82rem',color:'var(--text)' }}>
                  <button onClick={()=>setRetranscribeAll(v=>!v)} style={{ width:22,height:22,borderRadius:6,border:'1.5px solid '+(retranscribeAll?'var(--accent-dark)':'var(--accent-border)'),background:retranscribeAll?'var(--accent)':'white',color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.65rem',padding:0,flexShrink:0 }}>{retranscribeAll?'✓':''}</button>
                  Re-transcribe chapters already done
                </label>
              )}
              <div style={{ fontSize:'0.75rem',color:'var(--text-light)',marginBottom:16 }}>
                Will transcribe <strong>{willRun}</strong> chapter{willRun!==1?'s':''}. This runs in the background.
              </div>
              <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
                <button onClick={()=>setShowTranscribeAllModal(false)} style={{ padding:'8px 16px',borderRadius:10,fontSize:'0.82rem',fontWeight:600,border:'1px solid var(--border)',background:'white',color:'var(--text-muted)',cursor:'pointer' }}>Cancel</button>
                <button onClick={transcribeAllChapters} disabled={willRun===0} style={{ padding:'8px 20px',borderRadius:10,fontSize:'0.82rem',fontWeight:600,border:'1px solid var(--accent)',background:willRun?'var(--accent)':'#ccc',color:'white',cursor:willRun?'pointer':'not-allowed' }}>Transcribe {willRun} chapter{willRun!==1?'s':''}</button>
              </div>
            </div>
          </div>
        );
      })()}
      <SharedBookDetail
        tone={mode === 'quill' ? 'quill' : 'proof'}
        title={book.title}
        subtitle={(() => {
          // Marie 2026-05-26: dropped the .docx filename tail — eats a
          // second subtitle line on long names and adds nothing useful.
          return mode === 'quill'
            ? `${(book.chapters || []).length} chapters · ${totalFlags} annotations`
            : `${allSections.length} sections · ${completedCount} completed · ${totalFlags} flags`;
        })()}
        onBackHome={onBack}
        usesCustomDragRegion={usesCustomDragRegion}
        onDelete={onDelete}
        deleteLabel={`Delete "${book.title}"`}
        actionButtons={(
          <>
            {actionButtonsOverride !== null ? actionButtonsOverride : (
              <>
                <button data-tutorial="export-flags-csv" style={btn({color:'var(--accent-dark)',borderColor:'var(--accent-border)',background:'white',fontWeight:700})} onClick={()=>exportAllCSV(book)} title="Export the full flags spreadsheet">Export Flags</button>
                <button style={btn({color:'var(--accent-dark)',borderColor:'var(--accent-border)',background:'var(--accent-light)',fontWeight:700})} onClick={()=>{ void exportAuditionMarkers(book); }} title="Export one marker file per matching chapter label for the engineer">Export for Engineer</button>
                {isElectron && onTransferExport && (
                  <button style={btn({color:'var(--accent-dark)',borderColor:'var(--accent-border)',background:'white',fontWeight:700})} onClick={onTransferExport} title="Create a Transfer folder with audiobook data and copied audio files">Transfer</button>
                )}
              </>
            )}
            <button style={btn({color:'var(--accent-dark)',borderColor:'var(--accent-border)',background:'white'})} onClick={()=>editingMeta ? saveBookMetaEdits() : setEditingMeta(true)}>{editingMeta ? 'Save changes' : 'Edit book data'}</button>
          </>
        )}
        containerWidth={showFloatingNav ? 'min(900px, calc(100vw - 560px))' : 'min(900px, calc(100vw - 2.2rem))'}
        prePanels={(
          <div style={{ paddingBottom: persistentAudioUrl ? '5rem' : 0 }}>

        {/* Marie 2026-05-26: page-number status panel. Green when the
            PDF scan succeeded during import. Yellow warning when it
            didn't — page fields will show "?" until fixed. */}
        {(() => {
          const pdfPages = book.pdfPaging?.pages?.length || 0;
          const printedCount = book.pdfPaging?.printedPageCount || 0;
          const hasPdfMap = pdfPages > 0;
          const adj = Number(book.pageNumberAdjustment) || 0;
          if (hasPdfMap) {
            return (
              <div style={{ marginBottom:'0.85rem',background:'#eaf5ec',border:'1px solid #b9d6bf',borderRadius:14,padding:'8px 14px',display:'flex',alignItems:'center',gap:10 }}>
                <div style={{ fontSize:'1rem',lineHeight:1,color:'#3d7a4a' }}>✓</div>
                <div style={{ flex:1,minWidth:0,fontSize:'0.78rem',color:'#3d7a4a' }}>
                  <strong>Page numbers scanned.</strong> {printedCount} of {pdfPages} pages numbered from the PDF rendering.
                  {adj !== 0 && <span style={{ marginLeft:6 }}>· nudge {adj > 0 ? `+${adj}` : adj}</span>}
                </div>
              </div>
            );
          }
          return (
            <div style={{ marginBottom:'0.85rem',background:'#fff4d6',border:'1px solid #e0c682',borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'flex-start',gap:10 }}>
              <div style={{ fontSize:'1.2rem',lineHeight:1,marginTop:1 }}>⚠️</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:'0.85rem',fontWeight:700,color:'#7a5a18',marginBottom:3 }}>This book has no page numbers yet.</div>
                <div style={{ fontSize:'0.76rem',color:'#7a5a18',lineHeight:1.45 }}>
                  Page fields will show <strong>?</strong> in flags, exports, and the reader. The app couldn&apos;t scan page numbers — usually because LibreOffice or Microsoft Word isn&apos;t installed. Re-import after installing one of those, or upload the printed PDF to fix this book.
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{ marginBottom:'0.85rem' }}>
          {/* Compact top panel grid: Narrators (full) + Audiobook timing (½)
              + Bulk audio (½) + editing meta as full-width row. Previously
              wrapped in a chunky white card — removed because card-inside-
              card was wasting vertical space. */}
          <div style={{ display:'grid',gap:8,gridTemplateColumns:'repeat(2, minmax(0, 1fr))' }}>
            {editingMeta && (
              <div style={{ gridColumn:'1 / -1',background:'var(--accent-surface)',borderRadius:16,border:'1px solid var(--accent-border)',padding:'11px 12px' }}>
                <div style={{ fontSize:'0.84rem',fontWeight:700,color:'var(--text)',marginBottom:10 }}>
                  {mode === 'duet' ? 'Edit book' : mode === 'quill' ? 'Edit book + characters' : 'Edit book + narrator mappings'}
                </div>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:'0.68rem',color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em' }}>Book title</div>
                  <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} style={{ width:'100%',border:'1px solid var(--border)',borderRadius:10,padding:'8px 10px',fontSize:'0.86rem',background:'white',color:'var(--text)' }} />
                </div>
                {/* Marie 2026-05-26: Page-number nudge. When the app's
                    PDF-rendered page numbers are off by ±N pages from
                    the user's Word doc (LibreOffice and Word render
                    long books slightly differently), this slider shifts
                    every reported page by that amount. */}
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:'0.68rem',color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em' }}>Page-number nudge</div>
                  <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
                    <button type="button" onClick={()=>setEditPageNudge(n => Math.max(-50, (Number(n)||0) - 1))} style={{ width:34,height:34,borderRadius:10,border:'1px solid var(--border)',background:'white',color:'var(--text)',fontSize:'1.1rem',fontWeight:700,cursor:'pointer' }}>−</button>
                    <input type="number" value={editPageNudge} onChange={e=>setEditPageNudge(Math.trunc(Number(e.target.value)||0))} min={-50} max={50} style={{ width:70,textAlign:'center',border:'1px solid var(--border)',borderRadius:10,padding:'7px 8px',fontSize:'0.95rem',color:'var(--text)' }} />
                    <button type="button" onClick={()=>setEditPageNudge(n => Math.min(50, (Number(n)||0) + 1))} style={{ width:34,height:34,borderRadius:10,border:'1px solid var(--border)',background:'white',color:'var(--text)',fontSize:'1.1rem',fontWeight:700,cursor:'pointer' }}>+</button>
                    <span style={{ fontSize:'0.74rem',color:'var(--text-muted)',flex:1,minWidth:160 }}>
                      Shifts every page number in this book by this amount. Use if a flag says &ldquo;p.&nbsp;313&rdquo; but Word shows p.&nbsp;314.
                    </span>
                  </div>
                </div>
                {/* Chapter inclusion — uncheck to remove a chapter
                    from the book (e.g. a copyright page that snuck
                    through import). Available in every mode. */}
                <div style={{ marginBottom:10 }}>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4 }}>
                    <div style={{ fontSize:'0.68rem',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.04em' }}>
                      Chapters in this book ({(editChapters || []).filter(c => c.included).length} of {editChapters?.length || 0})
                    </div>
                    <div style={{ display:'inline-flex',gap:6 }}>
                      <button
                        type="button"
                        onClick={()=>setEditChapters(cs => cs.map(c => ({ ...c, included: true })))}
                        style={{ background:'transparent',border:'none',color:'var(--accent-dark)',fontSize:'0.7rem',fontWeight:700,cursor:'pointer',padding:'2px 6px' }}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={()=>setEditChapters(cs => cs.map(c => ({ ...c, included: false })))}
                        style={{ background:'transparent',border:'none',color:'var(--text-muted)',fontSize:'0.7rem',fontWeight:700,cursor:'pointer',padding:'2px 6px' }}
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div style={{ maxHeight:260,overflow:'auto',background:'white',border:'1px solid var(--border)',borderRadius:10,padding:'4px 6px' }}>
                    {(editChapters || []).map((c, i) => {
                      const hasScenes = Array.isArray(c.sections) && c.sections.length > 1;
                      const expanded = !!editExpandedChapters[c.id];
                      const includedScenes = (c.sections || []).filter(s => s.included).length;
                      const totalScenes = (c.sections || []).length;
                      return (
                        <div key={c.id} style={{ background:i % 2 ? 'transparent' : 'rgba(0,0,0,0.015)', borderRadius:6 }}>
                          <div style={{ display:'flex',alignItems:'center',gap:8,padding:'4px 6px',fontSize:'0.78rem',color:c.included?'var(--text)':'var(--text-light)' }}>
                            <input
                              type="checkbox"
                              checked={c.included}
                              onChange={()=>setEditChapters(cs => cs.map((cc, ci) => ci === i ? { ...cc, included: !cc.included } : cc))}
                            />
                            <span style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:28,padding:'1px 6px',borderRadius:999,background:'white',border:'1px solid var(--border-light)',fontSize:'0.66rem',fontWeight:700,color:'var(--text-muted)' }}>
                              {i + 1}
                            </span>
                            <span style={{ flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:c.included?'none':'line-through' }}>{c.title}</span>
                            {hasScenes && (
                              <button
                                type="button"
                                onClick={()=>setEditExpandedChapters(prev => ({ ...prev, [c.id]: !expanded }))}
                                title={expanded ? 'Hide scenes' : `${includedScenes}/${totalScenes} scenes included — click to edit`}
                                style={{ background:'transparent',border:'1px solid var(--border-light)',borderRadius:6,fontSize:'0.66rem',color:'var(--text-muted)',cursor:'pointer',padding:'2px 8px',whiteSpace:'nowrap' }}
                              >
                                {expanded ? '▴ scenes' : `▾ ${includedScenes}/${totalScenes} scenes`}
                              </button>
                            )}
                          </div>
                          {hasScenes && expanded && (
                            <div style={{ paddingLeft:30, paddingRight:6, paddingBottom:4 }}>
                              {(c.sections || []).map((sec, si) => (
                                <label
                                  key={sec.id}
                                  style={{ display:'flex',alignItems:'center',gap:8,padding:'2px 6px',borderRadius:4,cursor:'pointer',fontSize:'0.74rem',color:sec.included ? 'var(--text)' : 'var(--text-light)' }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={sec.included}
                                    onChange={()=>setEditChapters(cs => cs.map((cc, ci) => {
                                      if (ci !== i) return cc;
                                      return {
                                        ...cc,
                                        sections: (cc.sections || []).map((s, sj) => sj === si ? { ...s, included: !s.included } : s),
                                      };
                                    }))}
                                  />
                                  <span style={{ flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:sec.included?'none':'line-through' }}>
                                    {sec.title || `Scene ${si + 1}`}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {mode !== 'duet' && (
                <>
                <div style={{ fontSize:'0.68rem',color:'var(--text-muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em' }}>
                  {mode === 'quill' ? 'Characters' : 'Narrator mapping'}
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  {editNarrators.map((row, i)=>(
                    <div key={i} style={{ display:'grid',gridTemplateColumns:'42px 1fr 1fr auto',gap:8,alignItems:'end' }}>
                      <input type="color" value={row.hex || '#d9d9d9'} onChange={e=>updateEditNarrator(i,'hex',e.target.value)} style={{ width:36,height:36,border:'1px solid var(--border)',borderRadius:8,cursor:'pointer',padding:2 }} />
                      <input value={row.characterName || ''} onChange={e=>updateEditNarrator(i,'characterName',e.target.value)} placeholder={mode === 'quill' ? 'Character (e.g. Elara)' : 'Character (e.g. Thistle)'} style={{ border:'1px solid var(--border)',borderRadius:8,padding:'8px 10px',fontSize:'0.82rem' }} />
                      <input value={row.narratorName || ''} onChange={e=>updateEditNarrator(i,'narratorName',e.target.value)} placeholder={mode === 'quill' ? 'Notes (optional)' : 'Narrator (e.g. Jadis)'} style={{ border:'1px solid var(--border)',borderRadius:8,padding:'8px 10px',fontSize:'0.82rem' }} />
                      <button onClick={()=>removeEditNarrator(i)} style={{ ...btn({ padding:'6px 10px',fontSize:'0.76rem' }), color:'var(--text-muted)' }}>Remove</button>
                    </div>
                  ))}
                </div>
                </>
                )}
                <div style={{ display:'flex',gap:8,marginTop:10,flexWrap:'wrap' }}>
                  {mode !== 'duet' && (
                  <button onClick={addEditNarrator} style={btn({ color:'var(--accent-dark)',borderColor:'var(--accent-border)',background:'var(--accent-light)' })}>+ Add character</button>
                  )}
                  <div style={{ display:'inline-flex',alignItems:'center',gap:6 }}>
                    <label style={{ ...btn({ color:'var(--accent-dark)',borderColor:'var(--accent-border)',background:'var(--accent-light)' }), display:'inline-flex',alignItems:'center',gap:4 }}>
                      📄 Re-upload manuscript
                      <input type="file" accept=".docx" style={{ display:'none' }} onChange={e => { if (e.target.files[0]) handleReuploadManuscript(e.target.files[0]); e.target.value = ''; }} />
                    </label>
                    <InfoTip tip={'Use this if you updated the manuscript file after import, or if the chapter breaks or highlight mapping came in wrong the first time.'} side="bottom" />
                  </div>
                  {onRescanPageMap && (
                    <div style={{ display:'inline-flex',alignItems:'center',gap:6 }}>
                      {book.manuscriptSource?.stored ? (
                        <button
                          onClick={() => handleRescanPageMap(null)}
                          disabled={rescanningPages}
                          style={btn({ color:'var(--accent-dark)',borderColor:'var(--accent-border)',background:'white',fontWeight:700,opacity:rescanningPages?0.7:1,cursor:rescanningPages?'not-allowed':'pointer' })}
                        >
                          {rescanningPages ? 'Rescanning…' : 'Rescan page numbers'}
                        </button>
                      ) : (
                        <label style={{ ...btn({ color:'var(--accent-dark)',borderColor:'var(--accent-border)',background:'white',fontWeight:700 }), display:'inline-flex',alignItems:'center',opacity:rescanningPages?0.7:1,cursor:rescanningPages?'not-allowed':'pointer' }}>
                          {rescanningPages ? 'Scanning…' : 'Rescan page numbers'}
                          <input
                            type="file"
                            accept=".docx"
                            style={{ display:'none' }}
                            disabled={rescanningPages}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleRescanPageMap(file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                      <InfoTip tip={'Use this only if the imported page numbers are missing or wrong.'} side="bottom" />
                    </div>
                  )}
                  <button onClick={saveBookMetaEdits} style={btn({ background:'var(--accent)',borderColor:'var(--accent)',color:'white',fontWeight:700 })}>Save changes</button>
                </div>
              </div>
            )}

            {engineerProgress && (
              <div style={{ gridColumn:'1 / -1' }}>{engineerProgress}</div>
            )}

            {mode !== 'duet' && book.narratorColors?.length>0&&(
              <div style={{ gridColumn:'1 / -1',background:'var(--accent-surface)',borderRadius:16,border:'1px solid var(--accent-border)',padding:'8px 12px',display:'flex',flexWrap:'wrap',gap:6,alignItems:'center' }}>
                <span style={{ fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--accent-dark)',marginRight:4 }}>Narrators</span>
                <div style={{ display:'flex',alignItems:'center',gap:4,background:'white',borderRadius:20,padding:'2px 8px 2px 6px',border:'1px solid var(--accent-border)' }}>
                  <div style={{ width:12,height:12,borderRadius:3,background:'white',border:'1px solid var(--border)' }} />
                  <span style={{ fontSize:'0.72rem',color:'var(--text-muted)' }}>Narrating</span>
                </div>
                {book.narratorColors.map((nc,i)=>(
                  <div
                    key={i}
                    className="ap-quick-tip ap-quick-tip-top"
                    data-tip={nc.narratorName && nc.narratorName !== nc.characterName ? `${nc.characterName}\nNarrator: ${nc.narratorName}` : nc.characterName}
                    style={{ display:'flex',alignItems:'center',gap:4,background:'white',borderRadius:20,padding:'2px 8px 2px 6px',border:'1px solid var(--accent-border)',position:'relative' }}
                  >
                    <div style={{ width:12,height:12,borderRadius:3,background:nc.hex }} />
                    <span style={{ fontSize:'0.72rem',color:'var(--text-muted)' }}>{nc.characterName}{nc.narratorName&&nc.narratorName!==nc.characterName?' / '+nc.narratorName:''}</span>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{ background:'var(--accent-soft)',borderRadius:16,border:'1px solid var(--accent-border)',padding:'8px 12px' }}
              title={durationProbeRunning
                ? 'Checking attached audio durations…'
                : durationSummary.totalKeys === 0
                  ? 'This will populate once the audio files have been attached.'
                  : `Cached ${durationSummary.cachedKeys}/${durationSummary.totalKeys} attached audio durations.`}
            >
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap' }}>
                <div style={{ fontWeight:700,fontSize:'0.84rem',color:'var(--text)',whiteSpace:'nowrap' }}>Audiobook timing</div>
                <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
                  <div style={{ display:'inline-flex',alignItems:'baseline',gap:5,padding:'3px 8px',borderRadius:999,background:'white',border:'1px solid var(--accent-border)' }}>
                    <span style={{ fontSize:'0.62rem',textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-light)',fontWeight:700 }}>Total</span>
                    <span style={{ fontSize:'0.84rem',fontWeight:700,color:'var(--text)' }}>{fmtDuration(durationSummary.totalAudiobookSeconds)}</span>
                  </div>
                  <div style={{ display:'inline-flex',alignItems:'baseline',gap:5,padding:'3px 8px',borderRadius:999,background:'white',border:'1px solid var(--accent-border)' }}>
                    <span style={{ fontSize:'0.62rem',textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-light)',fontWeight:700 }}>Left</span>
                    <span style={{ fontSize:'0.84rem',fontWeight:700,color:'var(--text)' }}>{fmtDuration(durationSummary.totalTimeLeftSeconds)}</span>
                  </div>
                  {durationSummary.cachedKeys > 0 && (
                    <button onClick={()=>setShowTimingDetails(true)} style={btn({ background:'white',borderColor:'var(--accent-border)',color:'var(--accent-dark)',fontSize:'0.68rem',fontWeight:700,padding:'3px 8px' })}>
                      Breakdown
                    </button>
                  )}
                </div>
              </div>
            </div>

            {audioUploadMode === 'chapter' && (
              <div style={{ background:'var(--accent-surface)',borderRadius:16,border:'1px solid var(--accent-border)',padding:'8px 12px' }} data-tutorial="bulk-audio-card">
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                    <div style={{ fontWeight:700,fontSize:'0.84rem',color:'var(--text)',whiteSpace:'nowrap' }}>Bulk audio</div>
                    <InfoTip tip={'Choose one audio file per chapter from the selected start chapter onward. Each chapter still keeps its own file after import.'} />
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
                    <select
                      value={bulkStartChapterId}
                      onChange={e=>setBulkStartChapterId(e.target.value)}
                      title="Start from this chapter"
                      style={{ ...btn({ background:'white',borderColor:'var(--accent-border)' }), padding:'3px 8px', fontSize:'0.72rem', maxWidth:160 }}
                    >
                      {(book.chapters||[]).map((chapter, index) => (
                        <option key={chapter.id} value={chapter.id}>{chapterDisplayLabel(chapter, index)}</option>
                      ))}
                    </select>
                    <button style={btn({background:'var(--accent-light)',borderColor:'var(--accent-border)',color:'var(--accent-dark)',fontWeight:700,fontSize:'0.7rem',padding:'4px 10px'})} onClick={bulkImportAudio}>
                      Import…
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {!showFloatingNav && renderChapterNavigator(true)}

        <div style={{ display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:10,marginBottom:'0.45rem',flexWrap:'wrap' }}>
          <div style={{ display:'inline-flex',alignItems:'baseline',gap:10 }}>
            <span style={{ fontSize:'1.02rem',fontWeight:700,color:'var(--text)' }}>Chapters</span>
            <span style={{ fontSize:'0.7rem',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text-muted)' }}>Manuscript · {(book.chapters || []).length}</span>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {audioUploadMode === 'chapter' && (
              <button
                onClick={()=>setShowSceneRows(v=>!v)}
                aria-pressed={showSceneRows}
                style={{
                  display:'inline-flex',alignItems:'center',gap:10,
                  padding:'6px 10px',borderRadius:999,fontSize:'0.78rem',fontWeight:600,
                  border:'1px solid var(--border)',background:'white',color:'var(--text)',
                  cursor:'pointer',
                }}
                title="Split chapters into scenes — show or hide scene rows under each chapter"
              >
                <span>Split</span>
                <span style={{
                  minWidth:36,
                  padding:'4px 8px',
                  borderRadius:999,
                  background:showSceneRows ? 'var(--accent)' : 'var(--cream-dark)',
                  color:showSceneRows ? 'white' : 'var(--text-muted)',
                  fontSize:'0.68rem',
                  fontWeight:700,
                  textAlign:'center',
                }}>
                  {showSceneRows ? 'On' : 'Off'}
                </span>
              </button>
            )}
            {mode !== 'duet' && (
              <button
                data-tutorial="transcribe-all"
                onClick={openTranscribeAllModal}
                style={{
                  padding:'6px 14px',borderRadius:8,fontSize:'0.78rem',fontWeight:600,
                  border:'1px solid var(--accent)',background:'var(--accent)',color:'white',
                  cursor:'pointer',
                }}
                title="Transcribe all — queue chapter transcriptions in the background"
              >
                Transcribe all
              </button>
            )}
            <InfoTip tip={'This queues chapters for transcription one at a time. Progress now lives in the side panel under Queue, so you can leave and come back without losing the status.'} side="bottom" />
            {activeBookQueueCount > 0 && (
              <span style={{ fontSize:'0.74rem',color:'var(--text-muted)' }}>
                {activeBookQueueCount} in queue
              </span>
            )}
          </div>
        </div>

        {/* Chapter/section list — scrolls inside its own container so the
            user can't scroll the page past the top panels. Marie
            2026-05-26: tightened to calc(100vh - 360px) so the whole book
            detail fits one desktop viewport without page-level scroll. */}
        <div style={{ background:'white',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden auto',maxHeight:'calc(100vh - 360px)',minHeight:240 }}>
          {(book.chapters||[]).map((ch, chIndex)=>{
            const chDone=(ch.sections||[]).filter(s=>s.completed).length;
            const chTotal=(ch.sections||[]).length;
            const isExpanded=expanded[ch.id]!==false; // default open
            const chapterAudioFiles = (ch.sections||[])
              .map(s => audioFiles[s.id]?.name)
              .filter(Boolean);
            const chapterHasAudioForAll = chTotal > 0 && (ch.sections||[]).every(s => !!audioUrls[s.id]);
            const chapterAudioName = chapterAudioFiles.length && chapterAudioFiles.every(n => n === chapterAudioFiles[0])
              ? chapterAudioFiles[0]
              : null;
            const chapterAudioKey = getChapterAudioKey(ch);
            const chapterTextHash = getChapterTextHash(ch);
            const chapterTranscribed = isChapterTranscriptionCurrent(ch);
            const chapterQueueTask = bookQueueItems.find(task => task.chapterId === ch.id && (task.status === 'queued' || task.status === 'running'));
            const chapterTranscribedSection = (ch.sections || []).find(section => hasCurrentSectionTranscription(section, chapterAudioKey, chapterTextHash));
            const chapterAlignmentPercent = Number.isFinite(chapterTranscribedSection?.whisperMatchQuality)
              ? `${Math.round((Number(chapterTranscribedSection.whisperMatchQuality) || 0) * 100)}%`
              : '';
            const showChapterAlignmentBadge = chapterTranscribed && !chapterQueueTask;
            const chapterTranscribeTone = chapterQueueTask
              ? { background:'var(--warning-light)', borderColor:'#e9cda6', color:'var(--warning)' }
              : chapterTranscribed
                ? { background:'white', borderColor:'var(--border)', color:'var(--text-muted)' }
                : { background:'white', borderColor:'#c8ddd0', color:'var(--success)' };
            const chapterTranscribeTitle = chapterQueueTask?.status === 'running'
              ? `Transcribing now: ${Math.round(Number(chapterQueueTask.progress) || 0)}%.`
              : chapterQueueTask?.status === 'queued'
                ? 'Chapter queued for transcription.'
                : chapterTranscribed
                  ? `Re-transcribe chapter. Current alignment: ${chapterAlignmentPercent || 'saved result'}. Option/Alt-click to realign only.`
                  : 'Transcribe chapter';
            const chapterFlagCount = (ch.sections||[]).reduce((n, s) => n + (s.flags?.length || 0), 0);
            // Display sections: when Split is ON but the chapter has only
            // ONE section, derive scene rows on-the-fly by splitting the
            // section's HTML on H2 boundaries. Same H2 logic ImportFlow's
            // parser uses (see parseChaptersFromHtml). This is view-only —
            // the underlying section data isn't mutated, so flags/audio
            // stay attached to the original section.
            let displaySections = ch.sections || [];
            if (showSceneRows && displaySections.length === 1) {
              const onlyHtml = displaySections[0]?.html || '';
              if (/<h2[\s>]/i.test(onlyHtml)) {
                try {
                  const host = document.createElement('div');
                  host.innerHTML = onlyHtml;
                  const parts = [];
                  let curPart = null;
                  // Buffer any nodes that come BEFORE the first H2. Marie
                  // never wrote a scene called "Beginning" — the old code
                  // invented that label for the pre-H2 prefix. Instead,
                  // fold those nodes into the FIRST H2 scene so the text
                  // stays readable but no synthetic row shows up.
                  const prefixNodes = [];
                  Array.from(host.childNodes).forEach(node => {
                    const tag = node.nodeName ? node.nodeName.toLowerCase() : '';
                    if (tag === 'h2') {
                      if (curPart) parts.push(curPart);
                      const nodes = prefixNodes.length
                        ? [...prefixNodes.splice(0), node.cloneNode(true)]
                        : [node.cloneNode(true)];
                      curPart = { title: (node.textContent || '').trim() || 'Scene', nodes };
                    } else {
                      if (!curPart) prefixNodes.push(node.cloneNode(true));
                      else curPart.nodes.push(node.cloneNode(true));
                    }
                  });
                  if (curPart) parts.push(curPart);
                  if (parts.length >= 2) {
                    const baseSection = displaySections[0];
                    displaySections = parts.map((p, i) => ({
                      ...baseSection,
                      id: `${baseSection.id}-scene-${i}`,
                      title: p.title,
                      html: p.nodes.map(n => n.outerHTML || n.textContent || '').join(''),
                      isDerivedScene: true,
                    }));
                  } else {
                    displaySections = [];
                  }
                } catch (e) { displaySections = []; }
              } else {
                displaySections = [];
              }
            }
            return (
              <div key={ch.id} ref={node => { chapterRefs.current[ch.id] = node; }} style={{ background:'white',overflow:'hidden',scrollMarginTop:88,borderTop:chIndex===0?'none':'1px solid var(--border)' }}>
                {/* Chapter header — single line per chapter, no
                    Neapolitan striping. Simple outlined-box aesthetic
                    that matches the Quill home view. */}
                <div style={{ display:'flex',alignItems:'center',padding:'4px 10px',gap:6,background:'white',flexWrap:'nowrap',minHeight:34 }}>
                  <button onClick={()=>setExpanded(e=>({...e,[ch.id]:!isExpanded}))} style={{ display:'flex',alignItems:'center',gap:10,background:'transparent',border:'none',cursor:'pointer',textAlign:'left',padding:0,flex:'1 1 260px',minWidth:220 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0 }}>
                      <span style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:44,padding:'3px 8px',borderRadius:999,background:'white',border:'1px solid var(--border-light)',fontSize:'0.67rem',fontWeight:700,color:'var(--text-muted)' }}>
                        {chapterDisplayNumber(ch, chIndex)}
                      </span>
                      <span style={{ fontWeight:700,fontSize:'0.92rem',color:'var(--text)',flex:1 }}>{ch.title}</span>
                    </div>
                    {chDone===chTotal&&chTotal>0&&<span style={{ fontSize:'0.72rem',color:'var(--accent-dark)',fontWeight:700 }}>✓</span>}
                    <span style={{ color:'var(--text-light)',fontSize:'0.76rem',marginLeft:2 }}>{isExpanded?'▲':'▼'}</span>
                  </button>
                  <div style={{ display:'flex',alignItems:'center',gap:6,marginLeft:'auto',flexWrap:'wrap' }}>
                    {chapterAudioName&&(
                      <span title={chapterAudioName} style={{ fontSize:'0.7rem',color:'var(--success)',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                        🎵 {chapterAudioName}
                      </span>
                    )}
                    {chapterFlagCount > 0 && <span style={{ fontSize:'0.7rem',color:'var(--danger)',fontWeight:600 }}>🚩 {chapterFlagCount}</span>}
                    {audioUploadMode === 'chapter' && (
                      <button
                        onClick={()=>selectAudio((ch.sections||[])[0], ch, true)}
                        disabled={chTotal===0}
                        style={btn({
                          fontSize:'0.82rem',
                          padding:'4px 10px',
                          background:'white',
                          color:'var(--text)',
                          cursor:chTotal===0?'not-allowed':'pointer'
                        })}
                        title="Upload one audio file for the whole chapter; proofing later scenes will continue from earlier scenes in this chapter"
                        aria-label="Upload chapter audio"
                      >
                        ↑
                      </button>
                    )}
                    {audioUploadMode === 'chapter' && chapterHasAudioForAll && (
                      <>
                      {showChapterAlignmentBadge && (
                        <span
                          title={chapterAlignmentPercent ? `Aligned to ${chapterAlignmentPercent}` : 'Transcription saved'}
                          style={{ display:'inline-flex',alignItems:'center',gap:4,fontSize:'0.7rem',fontWeight:700,color:'var(--success)',whiteSpace:'nowrap' }}
                        >
                          <span>✓</span>
                          {chapterAlignmentPercent && <span>{chapterAlignmentPercent}</span>}
                        </span>
                      )}
                      <button
                        onClick={(e)=>{
                          if (e.altKey && chapterTranscribed && !chapterQueueTask) {
                            realignChapter(ch);
                            return;
                          }
                          queueChapterTranscription(ch, 'manual');
                        }}
                        style={btn({
                          fontSize:'0.74rem',
                          padding:'4px 0',
                          width:62,
                          justifyContent:'center',
                          background:chapterTranscribeTone.background,
                          color:chapterTranscribeTone.color,
                          borderColor:chapterTranscribeTone.borderColor,
                          cursor:'pointer',
                          fontWeight:700,
                        })}
                        title={chapterTranscribeTitle}
                        aria-label="Transcribe chapter"
                      >
                        {chapterQueueTask?.status === 'running'
                          ? `${Math.round(Number(chapterQueueTask.progress) || 0)}%`
                          : chapterQueueTask?.status === 'queued'
                            ? <span style={{ animation:'ap-soft-pulse 1.1s ease-in-out infinite', letterSpacing:'0.16em', paddingLeft:'0.16em' }}>...</span>
                            : chapterTranscribed
                              ? '↻'
                              : 'T'}
                      </button>
                      </>
                    )}
                    {audioUploadMode === 'chapter' && (
                      <button
                        onClick={()=>openChapterProof(ch)}
                        disabled={mode !== 'quill' && !chapterHasAudioForAll}
                        style={btn({
                          fontSize:'0.72rem',
                          padding:'4px 11px',
                          background:(mode === 'quill' || chapterHasAudioForAll)?'var(--accent-light)':'var(--cream-dark)',
                          color:(mode === 'quill' || chapterHasAudioForAll)?'var(--accent-dark)':'var(--text-light)',
                          borderColor:(mode === 'quill' || chapterHasAudioForAll)?'var(--accent-border-strong)':'var(--border)',
                          fontWeight:700,
                          cursor:(mode === 'quill' || chapterHasAudioForAll)?'pointer':'not-allowed',
                        })}
                        title={mode === 'quill' ? 'Open this chapter to annotate' : 'Play and proof this chapter'}
                        aria-label={mode === 'quill' ? 'Open this chapter to annotate' : 'Play and proof this chapter'}
                      >
                        ▶
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && audioUploadMode === 'chapter' && !showSceneRows && (
                  <div style={{ borderTop:'1px solid var(--border-light)',background:'white' }}>
                    {(ch.sections||[]).map((sec)=>{
                      const hasAudio=!!audioUrls[sec.id];
                      const flagCount=sec.flags?.length||0;
                      const ncColor=book.narratorColors?.find(nc=>nc.characterName===sec.characterName);
                      return (
                        <button
                          key={`compact-${sec.id}`}
                          onClick={()=>openSceneProof(ch, sec)}
                          disabled={!hasAudio}
                          title={sec.characterName ? `${sec.title} — ${sec.characterName}${sec.narratorName ? ` / ${sec.narratorName}` : ''}` : sec.title}
                          style={{
                            width:'100%',
                            display:'flex',
                            alignItems:'center',
                            gap:8,
                            padding:'8px 16px',
                            border:'none',
                            borderTop:'1px solid var(--border-light)',
                            background:'white',
                            cursor:hasAudio?'pointer':'not-allowed',
                            textAlign:'left',
                            opacity:hasAudio?1:0.55,
                          }}
                        >
                          <div style={{ width:8,height:8,borderRadius:2,background:ncColor?.hex||'transparent',border:ncColor?'none':'1px dashed var(--border)',flexShrink:0 }} />
                          <span style={{ fontSize:'0.8rem',color:'var(--text)',flex:1,textDecoration:sec.completed?'line-through':'none',textDecorationColor:'var(--text-muted)' }}>
                            {sec.title}
                          </span>
                          {flagCount>0&&<span style={{ fontSize:'0.7rem',color:'var(--danger)',fontWeight:600 }}>🚩{flagCount}</span>}
                          <span style={{ fontSize:'0.9rem',color:'var(--text-light)',paddingRight:2 }}>›</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Sections */}
                {isExpanded && (audioUploadMode === 'scene' || showSceneRows) && displaySections.map((sec)=>{
                  const hasAudio=!!audioUrls[sec.id];
                  const isRest=restoring[sec.id];
                  const ncColor=book.narratorColors?.find(nc=>nc.characterName===sec.characterName);
                  const flagCount=sec.flags?.length||0;
                  const secExpanded=expanded['s-'+sec.id];
                  const isChapterModeScene = audioUploadMode === 'chapter';
                  return (
                    <div key={sec.id} style={{ borderTop:'1px solid var(--border-light)' }}>
                      <div style={{ display:'flex',alignItems:'center',padding:'6px 10px 6px 16px',gap:7,flexWrap:'wrap' }}>
                        {/* Colour dot */}
                        <div style={{ width:8,height:8,borderRadius:2,background:ncColor?.hex||'transparent',border:ncColor?'none':'1px dashed var(--border)',flexShrink:0 }} />

                        {/* Completed checkbox */}
                        <button onClick={()=>onToggleComplete(sec.id)} title={sec.completed?'Mark incomplete':'Mark complete'}
                          style={{ width:16,height:16,borderRadius:'50%',border:'1.25px solid '+(sec.completed?'var(--accent-dark)':'var(--accent-border)'),background:sec.completed?'var(--accent)':'white',color:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.5rem',flexShrink:0,padding:0,boxShadow:sec.completed?'0 3px 8px var(--accent-shadow)':'none' }}>
                          {sec.completed?'✓':''}
                        </button>

                        {isChapterModeScene ? (
                          <button
                            onClick={()=>openSceneProof(ch, sec)}
                            disabled={!hasAudio}
                            title={sec.characterName ? `${sec.title} — ${sec.characterName}${sec.narratorName ? ` / ${sec.narratorName}` : ''}` : sec.title}
                            style={{
                              flex:1,
                              minWidth:180,
                              background:'transparent',
                              border:'none',
                              padding:0,
                              textAlign:'left',
                              cursor:hasAudio?'pointer':'not-allowed',
                              opacity:hasAudio?1:0.55,
                            }}
                          >
                            <span style={{ fontSize:'0.8rem',color:'var(--text)',fontWeight:sec.isCharPOV?500:400,fontStyle:sec.isCharPOV?'normal':'italic',textDecoration:sec.completed?'line-through':'none',textDecorationColor:'var(--text-muted)' }}>
                              {sec.title}
                            </span>
                          </button>
                        ) : (
                          <span style={{ fontSize:'0.8rem',color:'var(--text)',fontWeight:sec.isCharPOV?500:400,flex:1,fontStyle:sec.isCharPOV?'normal':'italic',textDecoration:sec.completed?'line-through':'none',textDecorationColor:'var(--text-muted)' }}>{sec.title}</span>
                        )}

                        {flagCount>0&&<span style={{ fontSize:'0.7rem',color:'var(--danger)',fontWeight:500 }}>🚩{flagCount}</span>}
                        {isRest&&<span style={{ fontSize:'0.7rem',color:'var(--text-muted)' }}>⏳ Restoring…</span>}
                        {!hasAudio&&sec.audioFileName&&!isRest&&(
                          <span style={{ fontSize:'0.7rem',color:'var(--warning)',fontWeight:500 }} title={sec.audioFileName}>⚠ Re-select audio</span>
                        )}
                        {audioUploadMode === 'scene' && hasAudio&&<span style={{ fontSize:'0.7rem',color:'var(--success)' }}>🎵 {audioFiles[sec.id]?.name}</span>}

                        <div style={{ display:'flex',gap:5,flexShrink:0 }}>
                          {flagCount>0&&<button style={btn({fontSize:'0.68rem',padding:'4px 7px',color:'var(--success)',borderColor:'#c6e4cd'})} onClick={()=>exportSectionCSV(ch,sec)}>CSV</button>}
                          {flagCount>0&&<button style={btn({fontSize:'0.68rem',padding:'4px 7px'})} onClick={()=>setExpanded(e=>({...e,['s-'+sec.id]:!secExpanded}))}>
                            {secExpanded?'▲':'▼'}
                          </button>}
                          {audioUploadMode === 'scene' && (
                            <>
                              <button onClick={()=>selectAudio(sec, ch, false)} style={btn({fontSize:'0.72rem',padding:'4px 8px'})}>
                                {hasAudio?'Change audio':sec.audioFileName?'Re-select audio':'Select audio…'}
                              </button>
                              <button onClick={()=>openSceneProof(ch, sec)} disabled={!hasAudio}
                                style={btn({
                                  background:hasAudio?'var(--accent-light)':'var(--cream-dark)',
                                  color:hasAudio?'var(--accent-dark)':'var(--text-light)',
                                  borderColor:hasAudio?'var(--accent-border-strong)':'var(--border)',
                                  fontWeight:700,
                                  padding:'4px 11px',
                                  cursor:hasAudio?'pointer':'not-allowed'
                                })}
                                title="Play and proof this scene"
                                aria-label="Play and proof this scene"
                              >
                                ▶
                              </button>
                            </>
                          )}
                          {isChapterModeScene && <span style={{ fontSize:'0.9rem',color:'var(--text-light)',padding:'0 4px' }}>›</span>}
                        </div>
                      </div>

                      {/* Flags preview */}
                      {secExpanded&&flagCount>0&&(
                        <div style={{ padding:'8px 16px 10px 40px',background:'var(--cream)',borderTop:'1px solid var(--border-light)' }}>
                          {(sec.flags||[]).map((fl,fi)=>(
                            <div key={fi} style={{ display:'flex',gap:8,padding:'3px 0',fontSize:'0.75rem',borderBottom:'1px solid var(--border-light)' }}>
                              <span style={{ fontFamily:'monospace',color:'var(--accent)',fontWeight:600,minWidth:36,flexShrink:0 }}>{fmtTime(fl.ts)}</span>
                              <span style={{ color:'var(--text-muted)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{fl.sentPlain}</span>
                              {fl.note&&<span style={{ color:'var(--text)',fontWeight:500,flexShrink:0,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>→ {fl.note}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
          </div>
        )}
      />

      {showFloatingNav && renderChapterNavigator(false)}

      {persistentAudioUrl && (
        <div style={{ position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:10,width:'min(780px, calc(100vw - 24px))',background:'white',border:'1px solid var(--border)',borderRadius:14,padding:'8px 10px',boxShadow:'0 10px 24px rgba(0,0,0,0.10)',zIndex:1000 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:6,flexWrap:'wrap' }}>
            <span style={{ fontSize:'0.74rem',color:'var(--text-muted)' }}>Now playing {persistentAudioLabel ? `· ${persistentAudioLabel}` : ''}</span>
            <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
              <button onClick={onReturnToScene} style={btn({ fontSize:'0.72rem', padding:'4px 9px' })}>Return to scene</button>
              <button onClick={onClearPersistentAudio} title="Stop playback" aria-label="Stop playback" style={btn({ fontSize:'0.82rem', fontWeight:700, lineHeight:1, padding:'4px 10px', minWidth:34 })}>■</button>
            </div>
          </div>
          <audio ref={persistentAudioRef} controls style={{ width:'100%',height:32 }} />
        </div>
      )}
    </div>
  );
}
