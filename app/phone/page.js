'use client';

// Phone companion — lives at /phone in this Next.js app.
//
// Two services share the same shell:
//   • Quill & Ink — annotate the manuscript
//   • Proof Listen — tap-to-flag while listening
//
// Both services use the SAME reader + selection model from the v1 Studio
// phone (the one Marie said was "thoroughly debugged"):
//   - HTML-preserving word render (keeps italics, paragraphs, headings)
//   - Double-tap to start a selection (not single-tap)
//   - Drag handles at each end to extend the selection
//   - Block-style highlight (consecutive selected words look continuous)
//   - Reader settings (font, size, mode, line height, margins, bg, etc.)
//     persisted across services
//   - Optional Page Swipe vs Scroll reader mode
//   - Audio plays from a file picked locally; only the file *name* ever
//     touches the cloud
//   - When the desktop has transcribed a section (whisperAlignment),
//     the Sync toggle lights up the current word as audio plays.
//
// Shared reader is in `./_components/PhoneReader.js`.
// Shared settings are in `./_components/PhoneReaderSettings.js`.
// IndexedDB cache + reader-location memory in `./_lib/`.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import LoginScreen from '../components/LoginScreen';
import {
  hasSupabaseConfig,
  getSupabaseClient,
  signOutSupabaseAccount,
  pullQuillProjects,
  pushQuillProject,
  pullProofProjects,
  pushProofProject,
  upsertProofFlag,
  deleteProofFlag,
  recordPendingFlag,
  clearPendingFlag,
  recordDeletedFlag,
  clearDeletedFlag,
  applyFlagQueueToBook,
  retryFlagQueue,
  loadFlagQueue,
  countAllFlagQueues,
} from '../../packages/cloud-sync';
import {
  buildWordSpans,
  buildSelectionTextContext,
  getAnnotationClassTree,
  createAnnotation,
  resolveAnnotationSelection,
  htmlToPlainText,
  buildAnnotationsCsv,
} from '../../packages/quill-engine';
import PhoneReader, { PHONE_READER_MAX_WIDTH } from './_components/PhoneReader.js';
import PhoneReaderSettings from './_components/PhoneReaderSettings.js';
import {
  loadPhoneReaderSettings,
  savePhoneReaderSettings,
  loadPhoneReaderLocation,
  savePhoneReaderLocation,
  getPhoneReaderBackgroundColor,
  getPhoneReaderNavColor,
  DEFAULT_PHONE_READER_SETTINGS,
} from './_lib/readerSettings.js';
import { readPhoneProjectCache, writePhoneProjectCache } from './_lib/projectCache.js';
import {
  getAudioFiles,
  pickAudioFile,
  countSectionAudioMatches,
  countSectionTotals,
} from './_lib/audioLibrary.js';

const QUILL_INK = '#834D5C';
const QUILL_ACCENT = '#CB8AA0';
const QUILL_PASTEL = '#F8E2E8';
const PROOF_INK = '#5C4A78';
const PROOF_ACCENT = '#B8A0D4';
const PROOF_PASTEL = '#EBDEF6';

// Match the desktop ProofingReader exactly so CSV exports + cloud syncs
// agree on the categorical set.
const FLAG_TYPES = ['Edit', 'Emphasis', 'Pronunciation', 'Special Edition', 'Unclear', 'Misread', 'Other'];

const SERVICE_OPTIONS = [
  { id: 'quill', label: 'Quill & Ink', subtitle: 'Annotate the manuscript', ink: QUILL_INK, accent: QUILL_ACCENT, pastel: QUILL_PASTEL, enabled: true },
  { id: 'script', label: 'Proof Listen', subtitle: 'Tap to flag while listening', ink: PROOF_INK, accent: PROOF_ACCENT, pastel: PROOF_PASTEL, enabled: true },
];

function sectionPlainText(section) {
  if (!section) return '';
  if (section.plainText && typeof section.plainText === 'string') return section.plainText;
  return htmlToPlainText(String(section.html || section.textHtml || ''));
}
function chapterPlainText(chapter) {
  return chapter?.plainText || htmlToPlainText(String(chapter?.html || chapter?.textHtml || ''));
}
function chapterHtml(chapter) {
  return String(chapter?.textHtml || chapter?.html || '').trim();
}
function sectionHtml(section) {
  return String(section?.html || section?.textHtml || '').trim();
}

function formatTime(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const remaining = Math.floor(value % 60);
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function csvEsc(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildFlagsCsv(book) {
  const rows = [['Chapter', 'Audio File', 'Page', 'Timestamp', 'Narrator', 'Type', 'Quote', 'Note']];
  (book?.chapters || []).forEach((ch) => {
    (ch.sections || []).forEach((sec) => {
      (sec.flags || []).forEach((fl) => {
        rows.push([
          ch.title || '',
          sec.audioFileName || '',
          fl.page || '',
          formatTime(fl.ts),
          fl.narrator || '',
          fl.type || '',
          fl.sentPlain || '',
          fl.note || '',
        ]);
      });
    });
  });
  return rows.map((row) => row.map(csvEsc).join(',')).join('\r\n');
}

function safeFileName(name) {
  return String(name || 'project').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'project';
}

function downloadText(filename, content, type = 'text/plain') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- Flag auto-fill helpers (mirror the desktop's behaviour) ---

function countWords(text) {
  return (String(text || '').match(/\S+/g) || []).length;
}

// Global word index across the whole book, so the page map (which is
// keyed by global manuscript word index) can be looked up.
function globalWordIndexFor(book, targetSection, sectionLocalIdx) {
  const explicit = Number(targetSection?.manuscriptWordStart);
  if (Number.isFinite(explicit)) return explicit + Math.max(0, sectionLocalIdx);
  let offset = 0;
  for (const ch of book?.chapters || []) {
    for (const sec of ch.sections || []) {
      if (sec.id === targetSection?.id) return offset + Math.max(0, sectionLocalIdx);
      const txt = sec.plainText || htmlToPlainText(String(sec.html || sec.textHtml || ''));
      offset += countWords(txt);
    }
  }
  return Math.max(0, sectionLocalIdx);
}

function pageNumberForWord(pageMap, globalWordIdx) {
  const entries = (Array.isArray(pageMap) ? pageMap : [])
    .filter((e) => Number.isFinite(Number(e?.wordStart)) && Number.isFinite(Number(e?.pageNumber)))
    .sort((a, b) => Number(a.wordStart) - Number(b.wordStart));
  if (!entries.length) return null;
  const idx = Math.max(0, Number(globalWordIdx) || 0);
  let pn = Number(entries[0].pageNumber) || 1;
  for (const e of entries) {
    if (Number(e.wordStart) > idx) break;
    pn = Number(e.pageNumber) || pn;
  }
  return pn;
}

// Look up the start time (seconds into the audio) for a given word
// index using the section's whisper alignment table, if present.
function wordStartTimeFromAlignment(alignment, wordIdx) {
  if (!Array.isArray(alignment) || wordIdx < 0 || wordIdx >= alignment.length) return null;
  const w = alignment[wordIdx]?.wordObj;
  if (!w) return null;
  const start = Number(w.start);
  return Number.isFinite(start) ? start : null;
}

// Map "character → narrator" using book.narratorColors. The narrator is
// the person doing the recording (Illisa); the character is the POV
// (Crescent). Marie cares about who's responsible — narrator wins.
function narratorChoicesFor(book) {
  const out = new Set();
  out.add('Narrator');
  out.add('Engineer');
  (book?.narratorColors || []).forEach((nc) => {
    const ch = (nc.characterName || '').trim();
    const nr = (nc.narratorName || '').trim();
    if (ch && nr && nr !== ch) out.add(`${ch} / ${nr}`);
    else if (ch) out.add(ch);
    if (nr) out.add(nr);
  });
  return Array.from(out);
}

function autoNarratorFor(book, section) {
  const ch = (section?.characterName || '').trim();
  const directSectionNarrator = (section?.narratorName || '').trim();
  const byCharacter = (book?.narratorColors || []).find((nc) => (nc.characterName || '').trim() === ch);
  const mappedNarrator = (byCharacter?.narratorName || '').trim();
  // Priority: mapped narrator (Illisa) > directly-set narrator > character > fallback.
  // Marie's note: when section.characterName === 'Crescent' and the
  // narratorColors map says Crescent → Illisa, "Illisa" wins.
  return mappedNarrator || directSectionNarrator || ch || 'Narrator';
}

export default function PhoneShell() {
  const [authReady, setAuthReady] = useState(!hasSupabaseConfig);
  const [authSession, setAuthSession] = useState(null);

  useEffect(() => {
    if (!hasSupabaseConfig) { setAuthReady(true); return undefined; }
    const supabase = getSupabaseClient();
    if (!supabase) { setAuthReady(true); return undefined; }
    let cancelled = false;
    // 8s safety net: if Supabase auth never resolves (slow connection,
    // bad token, whatever) drop the splash screen so the login form is
    // reachable. The auth listener below will still pick up the session
    // later if it arrives.
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setAuthReady(true);
    }, 8000);
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      clearTimeout(safetyTimer);
      setAuthSession(data?.session || null);
      setAuthReady(true);
    }).catch(() => {
      if (cancelled) return;
      clearTimeout(safetyTimer);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthSession(session || null);
    });
    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await signOutSupabaseAccount(supabase);
    setAuthSession(null);
  }

  if (hasSupabaseConfig && !authReady) {
    return (
      <main style={{ minHeight: '100vh', background: '#F4F1EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '0.86rem', color: '#6D6663' }}>Checking your account…</div>
      </main>
    );
  }

  if (hasSupabaseConfig && !authSession) {
    return <LoginScreen onSignedIn={(s) => setAuthSession(s)} />;
  }

  return <PhoneApp session={authSession} onSignOut={handleSignOut} />;
}

// ===========================================================================
// PhoneApp — owns universal reader settings + service routing + settings cog
// ===========================================================================

function PhoneApp({ session, onSignOut }) {
  const [service, setService] = useState(null); // null | 'quill' | 'script'
  const [readerSettings, setReaderSettings] = useState(DEFAULT_PHONE_READER_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Phone audio state lives HERE (the long-lived shell) so going to
  // Choose-a-service and back doesn't drop the audio connection.
  // Marie complained: "When I go back home, it disconnects all the audio
  // on the phone app." Fix: parent owns it, ScriptPhoneService just
  // reads + writes via props.
  const [audioFilesByBook, setAudioFilesByBook] = useState({});
  const [audioSectionOverride, setAudioSectionOverride] = useState({});

  // Load persisted settings once on mount.
  useEffect(() => {
    setReaderSettings(loadPhoneReaderSettings());
  }, []);

  const updateReaderSettings = useCallback((next) => {
    setReaderSettings(next);
    savePhoneReaderSettings(next);
  }, []);

  // The settings panel renders as an OVERLAY on top of the current
  // service, so closing it returns the user to exactly where they were
  // (without unmounting the underlying service component and losing the
  // active project / chapter / scroll position).
  const settingsOverlay = settingsOpen ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#FBF7F2', overflow: 'auto' }}>
      <PhoneReaderSettings
        settings={readerSettings}
        onChange={updateReaderSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  ) : null;

  const openSettings = () => setSettingsOpen(true);

  let body;
  if (!service) {
    body = (
      <ServicePicker
        session={session}
        onSignOut={onSignOut}
        onPick={(id) => setService(id)}
        onOpenSettings={openSettings}
      />
    );
  } else if (service === 'quill') {
    body = (
      <QuillPhoneService
        session={session}
        onSignOut={onSignOut}
        onBackToServices={() => setService(null)}
        readerSettings={readerSettings}
        onOpenSettings={openSettings}
      />
    );
  } else if (service === 'script') {
    body = (
      <ScriptPhoneService
        session={session}
        onSignOut={onSignOut}
        onBackToServices={() => setService(null)}
        readerSettings={readerSettings}
        onOpenSettings={openSettings}
        audioFilesByBook={audioFilesByBook}
        setAudioFilesByBook={setAudioFilesByBook}
        audioSectionOverride={audioSectionOverride}
        setAudioSectionOverride={setAudioSectionOverride}
      />
    );
  }

  return (
    <>
      {body}
      {settingsOverlay}
    </>
  );
}

// ---------------------------------------------------------------------------
// Service picker
// ---------------------------------------------------------------------------

function ServicePicker({ session, onSignOut, onPick, onOpenSettings }) {
  return (
    <main style={phoneRoot('#F4F1EE')}>
      <PhoneHeader
        title="Author Companion"
        bg="#F4F1EE"
        navBg="#EAE4DF"
        ink={QUILL_INK}
        right={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SettingsButton onClick={onOpenSettings} ink={QUILL_INK} />
            <AccountChip email={session?.user?.email} onSignOut={onSignOut} />
          </div>
        }
      />
      <section style={{ padding: '1.2rem 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 600, color: '#4C4846' }}>Choose a service</div>
          {session?.user?.email && (
            <div style={{ fontSize: '0.78rem', color: '#6D6663', marginTop: 4 }}>
              Signed in as <strong>{session.user.email}</strong>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SERVICE_OPTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => { if (s.enabled) onPick(s.id); }}
              disabled={!s.enabled}
              style={{
                padding: '20px 18px',
                background: s.enabled ? 'white' : 'rgba(255,255,255,0.55)',
                border: '1px solid ' + s.ink + (s.enabled ? '33' : '22'),
                borderLeft: '6px solid ' + (s.enabled ? s.accent : s.ink + '55'),
                borderRadius: 14,
                textAlign: 'left',
                cursor: s.enabled ? 'pointer' : 'not-allowed',
                opacity: s.enabled ? 1 : 0.55,
              }}
            >
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: s.ink, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: '0.82rem', color: '#6D6663' }}>{s.subtitle}</div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

// ===========================================================================
// QuillPhoneService — projects → chapter list → reader (annotation popover)
// ===========================================================================

function QuillPhoneService({ session, onSignOut, onBackToServices, readerSettings, onOpenSettings }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeChapterId, setActiveChapterId] = useState(null);
  // Same refresh robustness pattern as ScriptPhoneService: single-flight,
  // 10s timeout, 30s focus debounce. Stops the Refresh button from
  // getting wedged on a slow Supabase call.
  const refreshInflightRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  const refreshFromCloud = useCallback(async () => {
    if (refreshInflightRef.current) return;
    refreshInflightRef.current = true;
    setError('');
    setLoading(true);
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Took too long. Tap Refresh to try again.')), 10000);
    });
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase is not configured.');
      const list = await Promise.race([pullQuillProjects(supabase), timeout]);
      // Never wipe a populated local cache with an empty cloud pull —
      // a transient error or wrong account would otherwise look like
      // "all my projects vanished." Trust the cloud only when it
      // returns at least one project; otherwise keep what we have.
      setProjects((current) => {
        if (list?.length) {
          if (session?.user?.id) writePhoneProjectCache('quill', session.user.id, list);
          return list;
        }
        if (!current?.length && session?.user?.id) {
          writePhoneProjectCache('quill', session.user.id, []);
        }
        return current;
      });
      lastRefreshAtRef.current = Date.now();
    } catch (e) {
      setError(e?.message || 'Could not load projects.');
    } finally {
      if (timer) clearTimeout(timer);
      setLoading(false);
      refreshInflightRef.current = false;
    }
  }, [session?.user?.id]);

  const focusRefresh = useCallback(() => {
    if (Date.now() - lastRefreshAtRef.current < 30000) return;
    refreshFromCloud();
  }, [refreshFromCloud]);

  // Load IndexedDB cache, then refresh from cloud.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readPhoneProjectCache('quill', session?.user?.id);
      if (cancelled) return;
      if (cached?.length) setProjects(cached);
      await refreshFromCloud();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Re-pull when the user returns to the app (focus / visibility) so a
  // flag saved on the other device a few minutes ago shows up.
  // Debounced via focusRefresh — won't fire more than once per 30s.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onFocus = () => { focusRefresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') focusRefresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [focusRefresh]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );
  const activeChapter = useMemo(
    () => activeProject?.chapters?.find((c) => c.id === activeChapterId) || null,
    [activeProject, activeChapterId]
  );

  // Restore last-opened chapter when entering a project.
  useEffect(() => {
    if (!activeProject || activeChapterId) return;
    const loc = loadPhoneReaderLocation(`quill:${activeProject.id}`);
    if (loc?.chapterId && activeProject.chapters?.some((c) => c.id === loc.chapterId)) {
      setActiveChapterId(loc.chapterId);
    }
  }, [activeProject, activeChapterId]);

  // Persist the current chapter when reading.
  useEffect(() => {
    if (activeProject && activeChapterId) {
      savePhoneReaderLocation(`quill:${activeProject.id}`, { chapterId: activeChapterId });
    }
  }, [activeProject?.id, activeChapterId]);

  function pushProject(nextProject) {
    setProjects((all) => {
      const next = all.map((p) => p.id === nextProject.id ? nextProject : p);
      if (session?.user?.id) writePhoneProjectCache('quill', session.user.id, next);
      return next;
    });
    const supabase = getSupabaseClient();
    if (supabase && session?.user?.id) {
      pushQuillProject(supabase, nextProject, session.user.id).catch((e) =>
        console.warn('[Phone] Quill push failed:', e?.message || e));
    }
  }

  const bgColor = getPhoneReaderBackgroundColor(readerSettings.background);
  const navColor = getPhoneReaderNavColor(readerSettings.background);

  // Reader open: full chapter, annotations.
  if (activeChapter && activeProject) {
    return (
      <QuillChapterView
        project={activeProject}
        chapter={activeChapter}
        readerSettings={readerSettings}
        onBack={() => setActiveChapterId(null)}
        onOpenSettings={onOpenSettings}
        onSaveProject={pushProject}
      />
    );
  }

  if (activeProject) {
    const annotationCount = (activeProject.annotations || []).length;
    return (
      <main style={phoneRoot(bgColor)}>
        <PhoneHeader
          title={activeProject.title}
          bg={bgColor}
          navBg={navColor}
          ink={QUILL_INK}
          left={<BackButton ink={QUILL_INK} onClick={() => setActiveProjectId(null)} />}
          right={<SettingsButton onClick={onOpenSettings} ink={QUILL_INK} />}
        />
        <section style={{ padding: '1rem', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL_INK }}>
              Chapters
            </div>
            <button
              onClick={() => {
                if (!annotationCount) { window.alert('No annotations to export yet.'); return; }
                downloadText(`${safeFileName(activeProject.title)}-annotations.csv`, buildAnnotationsCsv(activeProject), 'text/csv');
              }}
              style={textBtnStyle(QUILL_INK)}
            >
              Export CSV
            </button>
          </div>
          {(activeProject.chapters || []).map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChapterId(ch.id)}
              style={projectCardStyle(QUILL_ACCENT)}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#4C4846' }}>
                  {ch.chapterNumber}. {ch.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6D6663', marginTop: 2 }}>
                  {(activeProject.annotations || []).filter((a) => a.sectionId === ch.id).length} annotations
                </div>
              </div>
              <span style={{ color: '#9B928E', fontSize: '1.2rem' }}>›</span>
            </button>
          ))}
        </section>
      </main>
    );
  }

  return (
    <main style={phoneRoot(bgColor)}>
      <PhoneHeader
        title="Quill & Ink"
        bg={bgColor}
        navBg={navColor}
        ink={QUILL_INK}
        left={<BackButton ink={QUILL_INK} onClick={onBackToServices} />}
        right={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SettingsButton onClick={onOpenSettings} ink={QUILL_INK} />
            <AccountChip email={session?.user?.email} onSignOut={onSignOut} />
          </div>
        }
      />
      <section style={{ padding: '1rem', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL_INK }}>
            Your projects
          </div>
          <button onClick={refreshFromCloud} style={textBtnStyle(QUILL_INK)}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {error && <div style={errorBoxStyle}>{error}</div>}
        {!projects.length && !loading && (
          <div style={emptyStyle}>
            No projects saved to the cloud yet. Import a manuscript on the desktop app first.
          </div>
        )}
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => { setActiveProjectId(p.id); setActiveChapterId(null); }}
            style={projectCardStyle(QUILL_ACCENT)}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.94rem', color: '#4C4846', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.title}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6D6663', marginTop: 2 }}>
                {p.chapters?.length || 0} chapters · {p.annotations?.length || 0} annotations
              </div>
            </div>
            <span style={{ color: '#9B928E', fontSize: '1.2rem' }}>›</span>
          </button>
        ))}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// QuillChapterView — reader + annotation popover.
// ---------------------------------------------------------------------------

function QuillChapterView({ project, chapter, readerSettings, onBack, onOpenSettings, onSaveProject }) {
  const html = chapterHtml(chapter);
  const plainText = useMemo(() => chapterPlainText(chapter), [chapter]);
  const words = useMemo(() => buildWordSpans(plainText), [plainText]);

  const [selectedRange, setSelectedRange] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [classId, setClassId] = useState('highlight');
  const [note, setNote] = useState('');

  const classTree = useMemo(() => getAnnotationClassTree(project.annotationOptions || []), [project.annotationOptions]);

  // Reset selection when chapter changes.
  useEffect(() => {
    setSelectedRange(null);
    setPanelOpen(false);
    setNote('');
  }, [chapter.id]);

  const annotationsForChapter = useMemo(
    () => (project.annotations || []).filter((a) => a.sectionId === chapter.id),
    [project.annotations, chapter.id]
  );

  const wordDecoration = useCallback((idx) => {
    const ann = annotationsForChapter.find((a) => idx >= Number(a.wordStart) && idx <= Number(a.wordEnd ?? a.wordStart));
    if (!ann) return null;
    if (ann.classId === 'highlight') {
      return { borderBottom: '3px solid ' + (ann.color || '#f0aac0') };
    }
    return { background: (ann.color || QUILL_ACCENT) + '33' };
  }, [annotationsForChapter]);

  function clearSelection() {
    setSelectedRange(null);
    setPanelOpen(false);
    setNote('');
  }

  function saveAnnotation() {
    if (!selectedRange) return;
    const start = Math.min(selectedRange.start, selectedRange.end);
    const end = Math.max(selectedRange.start, selectedRange.end);
    const selectedText = words.slice(start, end + 1).map((s) => s.word).join(' ');
    const textContext = buildSelectionTextContext(plainText, words, start, end);
    const selection = resolveAnnotationSelection({ classId, optionId: classId, projectOptions: project.annotationOptions || [] });
    const ann = createAnnotation({
      selection,
      sectionId: chapter.id,
      sectionTitle: chapter.title,
      chapterNumber: chapter.chapterNumber,
      wordStart: start,
      wordEnd: end,
      selectedText,
      textContext,
      note,
    });
    const nextProject = {
      ...project,
      annotations: [...(project.annotations || []), ann],
      updatedAt: new Date().toISOString(),
    };
    onSaveProject(nextProject);
    clearSelection();
  }

  const bgColor = getPhoneReaderBackgroundColor(readerSettings.background);
  const navColor = getPhoneReaderNavColor(readerSettings.background);
  const tone = { ink: QUILL_INK, accent: QUILL_ACCENT, pastel: QUILL_PASTEL };
  const hasSelection = !!selectedRange;

  return (
    <main style={phoneRoot(bgColor)}>
      <PhoneHeader
        title={`Ch ${chapter.chapterNumber}: ${chapter.title}`}
        bg={bgColor}
        navBg={navColor}
        ink={QUILL_INK}
        left={<BackButton ink={QUILL_INK} onClick={onBack} />}
        right={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {hasSelection && (
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                aria-label="Add annotation"
                style={topActionStyle(QUILL_ACCENT)}
              >
                +
              </button>
            )}
            <SettingsButton onClick={onOpenSettings} ink={QUILL_INK} />
          </div>
        }
      />
      <section style={{ padding: '0.7rem 0.6rem 7rem', maxWidth: PHONE_READER_MAX_WIDTH, margin: '0 auto' }}>
        <PhoneReader
          html={html}
          plainText={plainText}
          words={words}
          settings={readerSettings}
          selectedRange={selectedRange}
          onSelectionChange={(r) => { setSelectedRange(r); }}
          wordDecoration={wordDecoration}
          tone={tone}
        />

        {/* Annotation list under the reader (Scroll mode only — Page mode
            uses the swipe surface so the list goes below). */}
        {annotationsForChapter.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL_INK, marginBottom: 8 }}>
              Annotations · {annotationsForChapter.length}
            </div>
            {annotationsForChapter.map((a) => (
              <div key={a.id} style={annotationCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.color || QUILL_ACCENT }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: QUILL_INK }}>{a.label || a.classLabel}</span>
                </div>
                <div style={{ fontSize: '0.82rem', fontStyle: 'italic' }}>&ldquo;{a.selectedText}&rdquo;</div>
                {a.note && <div style={{ fontSize: '0.72rem', color: '#6D6663', marginTop: 3 }}>{a.note}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      {panelOpen && selectedRange && (
        <ReaderPopover ink={QUILL_INK}>
          <div style={popoverHeader(QUILL_INK)}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL_INK }}>
              New annotation
            </span>
            <button type="button" onClick={clearSelection} aria-label="Cancel" style={popoverCloseStyle}>×</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {classTree.filter((c) => c.id !== 'character').map((c) => (
              <button
                key={c.id}
                onClick={() => setClassId(c.id)}
                style={{
                  padding: '6px 11px',
                  border: '1px solid ' + (classId === c.id ? c.color : '#DDD0C4'),
                  background: classId === c.id ? c.color + '22' : 'white',
                  borderRadius: 999,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#4C4846',
                  cursor: 'pointer',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Comment (optional)"
            style={popoverInputStyle}
          />
          <div style={popoverActionsStyle}>
            <button onClick={clearSelection} style={popoverSecondaryStyle}>Cancel</button>
            <button onClick={saveAnnotation} style={popoverPrimaryStyle(QUILL_ACCENT)}>Save annotation</button>
          </div>
        </ReaderPopover>
      )}
    </main>
  );
}

// ===========================================================================
// ScriptPhoneService — Proof Listen on the phone. Tap-to-flag + audio.
// ===========================================================================

function ScriptPhoneService({ session, onSignOut, onBackToServices, readerSettings, onOpenSettings, audioFilesByBook, setAudioFilesByBook, audioSectionOverride, setAudioSectionOverride }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeBookId, setActiveBookId] = useState(null);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  // 'chapters' or 'flags' — which tab is showing inside the book detail.
  const [bookView, setBookView] = useState('chapters');
  // Pending-flag count — how many flag pushes are sitting in the queue
  // waiting to reach the cloud. Surfaces as a persistent banner so Marie
  // sees when a save didn't make it through.
  const [pendingCount, setPendingCount] = useState(0);
  const [audioPickStatus, setAudioPickStatus] = useState('');
  // Refresh robustness: single-flight + 10s timeout + 30s focus debounce.
  // Marie hit "stuck on Loading…" because the Supabase call could hang
  // and never resolved the loading state. These refs make refresh
  // self-healing.
  const refreshInflightRef = useRef(false);
  const lastRefreshAtRef = useRef(0);

  const refresh = useCallback(async ({ force = false } = {}) => {
    // Single-flight: if a refresh is already running, ignore the call.
    // Stops the "Loading…" button from getting wedged by stacked
    // requests and the focus-listener from queueing duplicates.
    if (refreshInflightRef.current) return;
    refreshInflightRef.current = true;
    setError('');
    setLoading(true);

    // 10-second hard timeout. If Supabase hangs (slow network, sleeping
    // tab), we resolve with an error so the button comes back.
    const timeoutMs = 10000;
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Took too long. Tap Refresh to try again.')), timeoutMs);
    });

    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase is not configured.');
      const list = await Promise.race([pullProofProjects(supabase), timeout]);
      setBooks((current) => {
        if (list?.length) {
          // Fold any queued offline saves / deletes into the freshly
          // pulled cloud books so we never overwrite Marie's pending
          // local work with the (stale) cloud version. Also preserve a
          // local updatedAt that's newer than the cloud's so the
          // last-touched-first sort doesn't snap back when a single-row
          // flag op (which doesn't bump the project row) is the only
          // recent activity.
          const localById = new Map((current || []).map((b) => [b.id, b]));
          const merged = list.map((b) => {
            const withQueue = b?.cloudId ? applyFlagQueueToBook(b.cloudId, b) : b;
            const local = localById.get(b.id);
            const localTime = Date.parse(local?.updatedAt || '') || 0;
            const cloudTime = Date.parse(withQueue?.updatedAt || '') || 0;
            if (localTime > cloudTime) {
              return { ...withQueue, updatedAt: local.updatedAt };
            }
            return withQueue;
          });
          if (session?.user?.id) writePhoneProjectCache('script', session.user.id, merged);
          return merged;
        }
        if (!current?.length && session?.user?.id) {
          writePhoneProjectCache('script', session.user.id, []);
        }
        return current;
      });
      lastRefreshAtRef.current = Date.now();
      // After the pull lands, retry any cloud writes that failed
      // earlier. Single-flight per project — won't fan out duplicates.
      if (session?.user?.id) {
        const promises = (list || []).map((b) => {
          if (!b?.cloudId) return null;
          return retryFlagQueue(b.cloudId, {
            supabase,
            ownerId: session.user.id,
            upsertFn: upsertProofFlag,
            deleteFn: deleteProofFlag,
          });
        }).filter(Boolean);
        // Recompute the pending banner once retries settle.
        Promise.all(promises).finally(() => setPendingCount(countAllFlagQueues()));
      }
      // Recompute immediately too so the banner reacts to the freshly
      // pulled cloud (in case some pending items were resolved by the
      // pull merging cloud changes).
      setPendingCount(countAllFlagQueues());
    } catch (e) {
      setError(e?.message || 'Could not load projects.');
    } finally {
      if (timer) clearTimeout(timer);
      setLoading(false);
      refreshInflightRef.current = false;
    }
  }, [session?.user?.id]);

  // Focus-triggered refresh is debounced to once per 30s so rapid
  // in/out of the app doesn't pile up requests. Manual Refresh button
  // always runs (subject to the single-flight guard).
  const focusRefresh = useCallback(() => {
    const sinceLast = Date.now() - lastRefreshAtRef.current;
    if (sinceLast < 30000) return;
    refresh();
  }, [refresh]);

  // Load IndexedDB cache, then refresh from cloud.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readPhoneProjectCache('script', session?.user?.id);
      if (cancelled) return;
      if (cached?.length) setBooks(cached);
      // Show any queued items immediately on mount.
      setPendingCount(countAllFlagQueues());
      await refresh();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Re-fetch when the user returns to the app (focus / visibility) so
  // a flag saved on the other device a few minutes ago shows up.
  // Debounced via focusRefresh — won't fire more than once per 30s.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onFocus = () => { focusRefresh(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') focusRefresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [focusRefresh]);

  const activeBook = useMemo(
    () => books.find((b) => b.id === activeBookId) || null,
    [books, activeBookId]
  );
  const activeChapter = useMemo(
    () => activeBook?.chapters?.find((c) => c.id === activeChapterId) || null,
    [activeBook, activeChapterId]
  );
  const activeSection = useMemo(() => {
    if (!activeChapter) return null;
    const sections = activeChapter.sections || [];
    if (!sections.length) return null;
    return sections.find((s) => s.id === activeSectionId) || sections[0];
  }, [activeChapter, activeSectionId]);

  // Last-touched-first ordering: sort by updatedAt desc so the book Marie
  // just flagged on the phone shows up at the top of the list. Must sit
  // up here with the other hooks — if it's below the early returns for
  // activeChapter / activeBook, React's hook count flips between
  // renders ("rendered fewer hooks than expected").
  const sortedBooks = useMemo(() => {
    return [...(books || [])].sort((a, b) => {
      const at = Date.parse(a?.updatedAt || '') || 0;
      const bt = Date.parse(b?.updatedAt || '') || 0;
      return bt - at;
    });
  }, [books]);

  function pushBook(nextBook) {
    setBooks((all) => {
      const next = all.map((b) => b.id === nextBook.id ? nextBook : b);
      if (session?.user?.id) writePhoneProjectCache('script', session.user.id, next);
      return next;
    });
    const supabase = getSupabaseClient();
    if (supabase && session?.user?.id) {
      pushProofProject(supabase, nextBook, session.user.id).catch((e) => {
        console.warn('[Phone] Proof push failed:', e?.message || e);
        setError('Could not save to the cloud. Try Refresh.');
      });
    }
  }

  // Flag-only save — single Supabase row. Use this for add/edit so a
  // concurrent device save doesn't clobber the rest of the project's
  // flags. Updates local state + cache eagerly. Also writes to a
  // localStorage queue so if the cloud push fails (offline, slow
  // network), the next refresh sees the pending flag and retries —
  // the saved flag never silently disappears.
  function saveFlagToCloud(bookId, sectionId, flag) {
    setBooks((all) => {
      const next = all.map((b) => {
        if (b.id !== bookId) return b;
        return {
          ...b,
          chapters: (b.chapters || []).map((ch) => ({
            ...ch,
            sections: (ch.sections || []).map((s) => {
              if (s.id !== sectionId) return s;
              const localId = flag.id;
              const existing = (s.flags || []).find((f) => (f.id || `${f.idx}:${f.ts}`) === localId);
              const flags = existing
                ? (s.flags || []).map((f) => ((f.id || `${f.idx}:${f.ts}`) === localId ? flag : f))
                : [...(s.flags || []), flag];
              return { ...s, flags };
            }),
          })),
          updatedAt: new Date().toISOString(),
        };
      });
      if (session?.user?.id) writePhoneProjectCache('script', session.user.id, next);
      return next;
    });
    const supabase = getSupabaseClient();
    const book = books.find((b) => b.id === bookId);
    const cloudId = book?.cloudId;
    if (!cloudId) {
      // Brand-new book that hasn't been pushed yet — fall back to a
      // full project push to create the project row, then we're done.
      // (Rare path; happens only when the very first save of a new
      // book also happens to be a flag, which the phone flow doesn't
      // currently allow because books are created on desktop.)
      const fullBook = books.find((b) => b.id === bookId);
      if (fullBook && supabase && session?.user?.id) {
        pushProofProject(supabase, fullBook, session.user.id).catch(() => {});
      }
      return;
    }
    if (!supabase || !session?.user?.id) {
      // Not signed in — queue for whenever we are.
      recordPendingFlag(cloudId, sectionId, flag);
      return;
    }
    // Optimistic queue write — if the push succeeds, we clear it; if
    // it fails, the next refresh's retryFlagQueue picks it up.
    recordPendingFlag(cloudId, sectionId, flag);
    setPendingCount(countAllFlagQueues());
    upsertProofFlag(supabase, cloudId, sectionId, flag, session.user.id)
      .then(() => { clearPendingFlag(cloudId, flag.id); setPendingCount(countAllFlagQueues()); })
      .catch((e) => {
        const reason = e?.message || String(e);
        console.warn('[Phone] flag upsert failed (queued for retry):', reason);
        setError(`Flag is saved on this phone but the cloud upload failed: ${reason}. Tap Refresh to retry.`);
        setPendingCount(countAllFlagQueues());
      });
  }

  function removeFlagFromCloud(bookId, sectionId, flagId) {
    setBooks((all) => {
      const next = all.map((b) => {
        if (b.id !== bookId) return b;
        return {
          ...b,
          chapters: (b.chapters || []).map((ch) => ({
            ...ch,
            sections: (ch.sections || []).map((s) => {
              if (s.id !== sectionId) return s;
              return { ...s, flags: (s.flags || []).filter((f) => (f.id || `${f.idx}:${f.ts}`) !== flagId) };
            }),
          })),
          updatedAt: new Date().toISOString(),
        };
      });
      if (session?.user?.id) writePhoneProjectCache('script', session.user.id, next);
      return next;
    });
    const supabase = getSupabaseClient();
    const book = books.find((b) => b.id === bookId);
    const cloudId = book?.cloudId;
    if (!cloudId) return;
    // Queue the delete intent so the next refresh strips this flag from
    // the cloud merge result AND retries the cloud delete if the first
    // attempt fails.
    recordDeletedFlag(cloudId, flagId);
    setPendingCount(countAllFlagQueues());
    if (supabase && session?.user?.id) {
      deleteProofFlag(supabase, cloudId, flagId)
        .then(() => { clearDeletedFlag(cloudId, flagId); setPendingCount(countAllFlagQueues()); })
        .catch((e) => {
          const reason = e?.message || String(e);
          console.warn('[Phone] flag delete failed (queued for retry):', reason);
          setError(`Removed on this phone but the cloud delete failed: ${reason}. Tap Refresh to retry.`);
          setPendingCount(countAllFlagQueues());
        });
    }
  }

  const bgColor = getPhoneReaderBackgroundColor(readerSettings.background);
  const navColor = getPhoneReaderNavColor(readerSettings.background);

  // Find a preset audio file for the current section: manual override
  // first (so a per-section pick survives navigation), then the folder
  // picker match.
  const activeBookAudioFiles = activeBook ? (audioFilesByBook[activeBook.id] || []) : [];

  if (activeChapter && activeBook && activeSection) {
    const override = audioSectionOverride[activeSection.id] || null;
    const sectionAudioLabels = [activeSection.audioFileName, activeSection.title, activeChapter.title].filter(Boolean);
    const folderMatched = activeBookAudioFiles.length
      ? pickAudioFile(activeBookAudioFiles, sectionAudioLabels)
      : null;
    const presetAudioFile = override || folderMatched;
    return (
      <ScriptChapterView
        book={activeBook}
        chapter={activeChapter}
        section={activeSection}
        readerSettings={readerSettings}
        onBack={() => { setActiveSectionId(null); setActiveChapterId(null); }}
        onSwitchSection={(id) => setActiveSectionId(id)}
        onOpenSettings={onOpenSettings}
        onSaveBook={pushBook}
        onSaveFlag={(flag) => saveFlagToCloud(activeBook.id, activeSection.id, flag)}
        onRemoveFlag={(flagId) => removeFlagFromCloud(activeBook.id, activeSection.id, flagId)}
        presetAudioFile={presetAudioFile}
        onManualPickAudio={(file) => {
          if (!activeSection?.id) return;
          setAudioSectionOverride((prev) => {
            const next = { ...prev };
            if (file) next[activeSection.id] = file; else delete next[activeSection.id];
            return next;
          });
        }}
      />
    );
  }

  if (activeBook) {
    const totalFlags = (activeBook.chapters || []).reduce((n, ch) => n + (ch.sections || []).reduce((m, s) => m + (s.flags?.length || 0), 0), 0);
    const audioFiles = audioFilesByBook[activeBook.id] || [];
    const totalSections = countSectionTotals(activeBook);
    const matchedCount = audioFiles.length ? countSectionAudioMatches(audioFiles, activeBook) : 0;
    return (
      <main style={phoneRoot(bgColor)}>
        <PhoneHeader
          title={activeBook.title}
          bg={bgColor}
          navBg={navColor}
          ink={PROOF_INK}
          left={<BackButton ink={PROOF_INK} onClick={() => setActiveBookId(null)} />}
          right={<SettingsButton onClick={onOpenSettings} ink={PROOF_INK} />}
        />
        <PendingFlagBanner count={pendingCount} onRetry={refresh} loading={loading} />
        <section style={{ padding: '1rem', maxWidth: 480, margin: '0 auto' }}>
          {/* Per-book audio folder picker. Marie picks the folder once
              for the whole book; each chapter's audio is auto-matched
              by exact filename. Files stay on the phone — only the
              filename ever crossed Supabase. */}
          <BookAudioFolderPicker
            book={activeBook}
            audioFiles={audioFiles}
            matchedCount={matchedCount}
            totalSections={totalSections}
            status={audioPickStatus}
            onPick={(files) => {
              setAudioFilesByBook((prev) => ({ ...prev, [activeBook.id]: files }));
              const matched = countSectionAudioMatches(files, activeBook);
              setAudioPickStatus(
                matched
                  ? `Linked ${matched} of ${countSectionTotals(activeBook)} sections.`
                  : 'No filenames matched. You can still pick audio per chapter inside the reader.'
              );
            }}
            onClear={() => {
              setAudioFilesByBook((prev) => { const next = { ...prev }; delete next[activeBook.id]; return next; });
              setAudioPickStatus('');
            }}
          />
          {/* Chapters / Flags tab strip. Lets Marie see every flag in
              the book without having to dig into each chapter — the same
              affordance the desktop has in its side nav. */}
          <BookTabStrip
            tabs={[
              { id: 'chapters', label: 'Chapters', count: (activeBook.chapters || []).length },
              { id: 'flags', label: 'Flags', count: totalFlags },
            ]}
            active={bookView}
            onChange={setBookView}
            tone={{ ink: PROOF_INK, pastel: PROOF_PASTEL }}
            right={
              <button
                onClick={() => {
                  if (!totalFlags) { window.alert('No flags to export yet.'); return; }
                  downloadText(`${safeFileName(activeBook.title)}-flags.csv`, buildFlagsCsv(activeBook), 'text/csv');
                }}
                style={textBtnStyle(PROOF_INK)}
              >
                Export CSV
              </button>
            }
          />

          {bookView === 'chapters' && (
            <>
              {!(activeBook.chapters || []).length && (
                <div style={emptyStyle}>
                  No chapters yet — open the book on the desktop and let it sync.
                </div>
              )}
              {(activeBook.chapters || []).map((ch, i) => {
                const firstSection = (ch.sections || [])[0];
                const chapterFlagCount = (ch.sections || []).reduce((n, s) => n + (s.flags?.length || 0), 0);
                return (
                  <button
                    key={ch.id}
                    onClick={() => { setActiveChapterId(ch.id); setActiveSectionId(firstSection?.id || null); }}
                    style={projectCardStyle(PROOF_ACCENT)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#4C4846' }}>
                        {i + 1}. {ch.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#6D6663', marginTop: 2 }}>
                        {(ch.sections || []).length} section{(ch.sections || []).length === 1 ? '' : 's'} · {chapterFlagCount} flag{chapterFlagCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span style={{ color: '#9B928E', fontSize: '1.2rem' }}>›</span>
                  </button>
                );
              })}
            </>
          )}

          {bookView === 'flags' && (
            <BookFlagsList
              book={activeBook}
              onOpenFlag={(chapterId, sectionId) => {
                setActiveChapterId(chapterId);
                setActiveSectionId(sectionId);
              }}
              onDeleteFlag={(sectionId, flagId) => removeFlagFromCloud(activeBook.id, sectionId, flagId)}
            />
          )}
        </section>
      </main>
    );
  }

  // Last-touched-first ordering: sort by updatedAt desc with new
  // pending-saved flags bumping a book up. So the book Marie just
  // flagged on the phone shows up at the top of the list.
  const sortedBooks = useMemo(() => {
    return [...(books || [])].sort((a, b) => {
      const at = Date.parse(a?.updatedAt || '') || 0;
      const bt = Date.parse(b?.updatedAt || '') || 0;
      return bt - at;
    });
  }, [books]);
  return (
    <main style={phoneRoot(bgColor)}>
      <PhoneHeader
        title="Proof Listen"
        bg={bgColor}
        navBg={navColor}
        ink={PROOF_INK}
        left={<BackButton ink={PROOF_INK} onClick={onBackToServices} />}
        right={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <SettingsButton onClick={onOpenSettings} ink={PROOF_INK} />
            <AccountChip email={session?.user?.email} onSignOut={onSignOut} />
          </div>
        }
      />
      <PendingFlagBanner count={pendingCount} onRetry={refresh} loading={loading} />
      <section style={{ padding: '1rem', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PROOF_INK }}>
            Your audiobooks
          </div>
          <button onClick={refresh} style={textBtnStyle(PROOF_INK)}>{loading ? 'Loading…' : 'Refresh'}</button>
        </div>
        {error && <div style={errorBoxStyle}>{error}</div>}
        {!books.length && !loading && (
          <div style={emptyStyle}>
            No audiobooks saved to the cloud yet. Open Proof Listen on the desktop first.
          </div>
        )}
        {sortedBooks.map((b) => {
          const chapterCount = (b.chapters || []).length;
          const flagCount = (b.chapters || []).reduce((n, ch) => n + (ch.sections || []).reduce((m, s) => m + (s.flags?.length || 0), 0), 0);
          return (
            <button
              key={b.id}
              onClick={() => { setActiveBookId(b.id); setActiveChapterId(null); setActiveSectionId(null); }}
              style={projectCardStyle(PROOF_ACCENT)}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.94rem', color: '#4C4846', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6D6663', marginTop: 2 }}>
                  {chapterCount} chapter{chapterCount === 1 ? '' : 's'} · {flagCount} flag{flagCount === 1 ? '' : 's'}
                </div>
              </div>
              <span style={{ color: '#9B928E', fontSize: '1.2rem' }}>›</span>
            </button>
          );
        })}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// ScriptChapterView — reader + flag popover + audio dock with sync.
// ---------------------------------------------------------------------------

function ScriptChapterView({ book, chapter, section, readerSettings, onBack, onSwitchSection, onOpenSettings, onSaveBook, onSaveFlag, onRemoveFlag, presetAudioFile = null, onManualPickAudio = null }) {
  const sections = chapter.sections || [];
  const html = sectionHtml(section);
  const plainText = useMemo(() => sectionPlainText(section), [section]);
  const words = useMemo(() => buildWordSpans(plainText), [plainText]);

  // Mirror the desktop's auto-fill: narrator from book.narratorColors
  // mapping (Crescent → Illisa), page from book.manuscriptPaging.pageMap
  // at the selected word's GLOBAL index, timestamp from whisper alignment
  // for that word. All three derived per-word so the flag panel pre-fills
  // accurately even if Marie hasn't played the audio yet.
  const autoNarrator = useMemo(() => autoNarratorFor(book, section), [book, section]);
  const narratorOptions = useMemo(() => {
    const list = narratorChoicesFor(book);
    if (autoNarrator && !list.includes(autoNarrator)) list.unshift(autoNarrator);
    return list;
  }, [book, autoNarrator]);

  const [selectedRange, setSelectedRange] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  // Desktop's flag draft shape — keep the field names aligned so the
  // CSV builder and the cloud-sync row builder don't have to translate.
  const [flagDraft, setFlagDraft] = useState({
    quote: '',
    page: '',
    note: '',
    narrator: autoNarrator,
    type: 'Edit',
  });
  const [toast, setToast] = useState('');
  const [audioTime, setAudioTime] = useState(0);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const currentAudioTimeRef = useRef(0);

  // Reset selection + audio state on section change.
  useEffect(() => {
    setSelectedRange(null);
    setPanelOpen(false);
    setFlagDraft({
      quote: '',
      page: '',
      note: '',
      narrator: autoNarrator,
      type: 'Edit',
    });
    setSyncEnabled(false);
    setAudioTime(0);
    currentAudioTimeRef.current = 0;
    // autoNarrator depends on section — including it here is safe
  }, [section.id, autoNarrator]);

  // Derived metadata for the SELECTED WORD. This is the heart of the
  // fix — timestamp + page + quote come from the WORD, not from the
  // audio playback state. So tapping a word at sentence 38 always
  // produces ts=38, even if Marie hasn't pressed play yet.
  const selectionMeta = useMemo(() => {
    if (!selectedRange) return null;
    const start = Math.min(selectedRange.start, selectedRange.end);
    const end = Math.max(selectedRange.start, selectedRange.end);
    const quoteText = words.slice(start, end + 1).map((s) => s.word).join(' ');
    const alignedStart = wordStartTimeFromAlignment(section.whisperAlignment, start);
    const globalIdx = globalWordIndexFor(book, section, start);
    const page = pageNumberForWord(book?.manuscriptPaging?.pageMap, globalIdx);
    return {
      start,
      end,
      quote: quoteText,
      // Timestamp priority: whisper alignment → live audio playback → 0.
      ts: alignedStart != null ? alignedStart : Number(currentAudioTimeRef.current) || 0,
      tsSource: alignedStart != null ? 'aligned' : (Number(currentAudioTimeRef.current) > 0 ? 'audio' : 'none'),
      page: page != null ? String(page) : '',
      globalIdx,
    };
  }, [selectedRange, words, section, book]);

  // Pre-fill the draft when the panel opens (or the selection changes
  // and the user hasn't typed yet — we don't clobber edits in progress).
  useEffect(() => {
    if (!panelOpen || !selectionMeta) return;
    setFlagDraft((prev) => ({
      ...prev,
      quote: prev.quote || selectionMeta.quote,
      page: prev.page || selectionMeta.page,
    }));
  }, [panelOpen, selectionMeta]);

  // Toast helper — small auto-dismiss notice for things like "page
  // number missing" that Marie wants surfaced.
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const wordDecoration = useCallback((idx) => {
    const flag = (section.flags || []).find((f) => {
      const s = Number(f.idx);
      const e = Number(f.wordEnd ?? f.idx);
      if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
      return idx >= Math.min(s, e) && idx <= Math.max(s, e);
    });
    if (!flag) return null;
    return { borderBottom: `3px solid ${PROOF_ACCENT}` };
  }, [section.flags]);

  // Whisper-aligned word sync — show the playing word as audio plays.
  const canSyncAudio = useMemo(() => {
    const alignment = section.whisperAlignment || [];
    return alignment.some((m) => m?.wordObj && Number.isFinite(Number(m.wordObj.start)) && Number.isFinite(Number(m.wordObj.end)));
  }, [section.whisperAlignment]);

  const syncedWordIndex = useMemo(() => {
    if (!syncEnabled || !canSyncAudio) return -1;
    const alignment = section.whisperAlignment || [];
    const now = Number(audioTime);
    if (!Number.isFinite(now)) return -1;
    let nearest = -1;
    for (let i = 0; i < alignment.length; i += 1) {
      const w = alignment[i]?.wordObj;
      if (!w) continue;
      const start = Number(w.start);
      const end = Number(w.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      if (now >= start && now <= end) return i;
      if (start <= now) nearest = i;
      if (start > now) break;
    }
    return nearest;
  }, [audioTime, canSyncAudio, syncEnabled, section.whisperAlignment]);

  function clearSelection() {
    setSelectedRange(null);
    setPanelOpen(false);
    setFlagDraft({ quote: '', page: '', note: '', narrator: autoNarrator, type: 'Edit' });
  }

  function saveFlag() {
    if (!selectedRange || !selectionMeta) return;
    const editedQuote = (flagDraft.quote || selectionMeta.quote || '').trim();
    const pageRaw = (flagDraft.page || selectionMeta.page || '').trim();
    const flag = {
      id: `phone-flag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      idx: selectionMeta.start,
      wordEnd: selectionMeta.end,
      // CRITICAL: timestamp comes from the SELECTED WORD's whisper
      // alignment when available — not from where audio playback
      // happens to be. Falls back to the live audio time only if no
      // alignment is present for this word.
      ts: Number.isFinite(Number(selectionMeta.ts)) ? Number(selectionMeta.ts) : (Number(currentAudioTimeRef.current) || 0),
      // Match the desktop schema exactly so CSV + cloud rows agree:
      // sentPlain = the quote text, note = "should say" correction,
      // narrator + page + type carry forward.
      sentPlain: editedQuote,
      sentHtml: editedQuote, // plain on phone; desktop wraps with <em class="fw">
      page: pageRaw || '#',
      narrator: (flagDraft.narrator || autoNarrator || 'Narrator').trim() || 'Narrator',
      type: flagDraft.type || 'Edit',
      note: (flagDraft.note || '').trim(),
      source: 'phone',
      createdAt: new Date().toISOString(),
    };
    if (!pageRaw && pageRaw !== '0') {
      setToast('Saved without a page number — the manuscript may not have a page map yet.');
    }
    // Prefer single-row flag save (won't clobber desktop's other
    // flags). Fall back to onSaveBook only if the parent didn't wire
    // the flag-specific callback.
    if (onSaveFlag) {
      onSaveFlag(flag);
      clearSelection();
      return;
    }
    const nextBook = {
      ...book,
      chapters: (book.chapters || []).map((ch) => ch.id !== chapter.id ? ch : ({
        ...ch,
        sections: (ch.sections || []).map((s) => s.id !== section.id ? s : ({
          ...s,
          flags: [...(s.flags || []), flag],
        })),
      })),
      updatedAt: new Date().toISOString(),
    };
    onSaveBook(nextBook);
    clearSelection();
  }

  function deleteFlag(flagId) {
    if (onRemoveFlag) { onRemoveFlag(flagId); return; }
    const nextBook = {
      ...book,
      chapters: (book.chapters || []).map((ch) => ch.id !== chapter.id ? ch : ({
        ...ch,
        sections: (ch.sections || []).map((s) => s.id !== section.id ? s : ({
          ...s,
          flags: (s.flags || []).filter((f) => (f.id || `${f.idx}:${f.ts}`) !== flagId),
        })),
      })),
      updatedAt: new Date().toISOString(),
    };
    onSaveBook(nextBook);
  }

  const bgColor = getPhoneReaderBackgroundColor(readerSettings.background);
  const navColor = getPhoneReaderNavColor(readerSettings.background);
  const tone = { ink: PROOF_INK, accent: PROOF_ACCENT, pastel: PROOF_PASTEL };
  const hasSelection = !!selectedRange;
  const chapterIndex = (book.chapters || []).findIndex((c) => c.id === chapter.id) + 1;

  return (
    <main style={phoneRoot(bgColor)}>
      <PhoneHeader
        title={`Ch ${chapterIndex}: ${chapter.title}`}
        bg={bgColor}
        navBg={navColor}
        ink={PROOF_INK}
        left={<BackButton ink={PROOF_INK} onClick={onBack} />}
        right={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {hasSelection && (
              <button type="button" onClick={() => setPanelOpen(true)} aria-label="Add flag" style={topActionStyle(PROOF_ACCENT)}>+</button>
            )}
            <SettingsButton onClick={onOpenSettings} ink={PROOF_INK} />
          </div>
        }
      />
      {sections.length > 1 && (
        <div style={{ padding: '6px 14px 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#6D6663', maxWidth: PHONE_READER_MAX_WIDTH, margin: '0 auto' }}>
          <span>Section</span>
          <select
            value={section.id}
            onChange={(e) => { if (e.target.value !== section.id) onSwitchSection?.(e.target.value); }}
            style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1px solid #DDD0C4', background: 'white', fontSize: '0.82rem' }}
          >
            {sections.map((s, i) => (
              <option key={s.id} value={s.id}>{i + 1}. {s.title || `Section ${i + 1}`}</option>
            ))}
          </select>
        </div>
      )}
      <section style={{ padding: '0.7rem 0.6rem 7rem', maxWidth: PHONE_READER_MAX_WIDTH, margin: '0 auto' }}>
        <PhoneReader
          html={html}
          plainText={plainText}
          words={words}
          settings={readerSettings}
          selectedRange={selectedRange}
          onSelectionChange={(r) => setSelectedRange(r)}
          wordDecoration={wordDecoration}
          syncWordIndex={syncedWordIndex}
          tone={tone}
        />

        {(section.flags || []).length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PROOF_INK, marginBottom: 8 }}>
              Flags · {(section.flags || []).length}
            </div>
            {(section.flags || []).map((f, i) => {
              const flagId = f.id || `${f.idx}:${f.ts}:${i}`;
              return (
                <div key={flagId} style={annotationCardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: PROOF_ACCENT }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: PROOF_INK }}>{f.type || 'Edit'}</span>
                    <span style={{ fontSize: '0.7rem', color: '#9B928E', marginLeft: 'auto' }}>{formatTime(f.ts)}</span>
                    <button onClick={() => deleteFlag(flagId)} aria-label="Delete flag" style={{ background: 'none', border: 'none', color: '#C4514A', cursor: 'pointer', fontSize: '0.86rem', padding: '0 4px' }}>×</button>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontStyle: 'italic' }}>&ldquo;{f.sentPlain}&rdquo;</div>
                  {f.note && <div style={{ fontSize: '0.72rem', color: '#6D6663', marginTop: 3 }}>{f.note}</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {panelOpen && selectedRange && selectionMeta && (
        <ReaderPopover ink={PROOF_INK}>
          <div style={popoverHeader(PROOF_INK)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                style={{ fontFamily: 'monospace', fontWeight: 800, color: PROOF_INK, fontSize: '1.02rem', letterSpacing: '0.04em' }}
                title={
                  selectionMeta.tsSource === 'aligned'
                    ? 'Timestamp pulled from the chapter transcription for this word'
                    : selectionMeta.tsSource === 'audio'
                      ? 'Timestamp pulled from where audio is currently playing — transcribe this chapter on desktop for word-accurate times'
                      : 'No audio time available — transcribe this chapter on desktop'
                }
              >
                {formatTime(Number(selectionMeta.ts) || 0)}
              </span>
              {selectionMeta.tsSource === 'audio' && (
                <span style={{ fontSize: '0.6rem', color: '#7a5b18', background: '#fff7e6', border: '1px solid #f4d28a', padding: '1px 6px', borderRadius: 999, fontWeight: 700, whiteSpace: 'nowrap' }} title="Timestamp came from live audio playback, not the chapter transcription. Transcribe on desktop for word-accurate times.">live</span>
              )}
              {selectionMeta.tsSource === 'none' && (
                <span style={{ fontSize: '0.6rem', color: '#7a5b18', background: '#fff7e6', border: '1px solid #f4d28a', padding: '1px 6px', borderRadius: 999, fontWeight: 700, whiteSpace: 'nowrap' }} title="No audio time — transcribe this chapter on desktop for word-accurate times">no audio</span>
              )}
              <span style={{ fontSize: '0.66rem', background: PROOF_PASTEL, color: PROOF_INK, padding: '2px 8px', borderRadius: 999, fontWeight: 700, border: '1px solid ' + PROOF_INK + '33', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }} title={autoNarrator}>
                {autoNarrator}
              </span>
            </div>
            <button type="button" onClick={clearSelection} aria-label="Cancel" style={popoverCloseStyle}>×</button>
          </div>

          <FieldLabel>Quote</FieldLabel>
          <textarea
            value={flagDraft.quote}
            onChange={(e) => setFlagDraft((prev) => ({ ...prev, quote: e.target.value }))}
            rows={2}
            style={{ ...popoverInputStyle, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.45 }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '78px 1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <FieldLabel>Page</FieldLabel>
              <input
                type="text"
                inputMode="numeric"
                placeholder="#"
                value={flagDraft.page}
                onChange={(e) => setFlagDraft((prev) => ({ ...prev, page: e.target.value }))}
                style={smallFieldStyle}
              />
            </div>
            <div>
              <FieldLabel>Narrator / Engineer</FieldLabel>
              <input
                type="text"
                list="phone-flag-narrators"
                placeholder={autoNarrator}
                value={flagDraft.narrator}
                onChange={(e) => setFlagDraft((prev) => ({ ...prev, narrator: e.target.value }))}
                style={smallFieldStyle}
              />
              <datalist id="phone-flag-narrators">
                {narratorOptions.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div>
              <FieldLabel>Type</FieldLabel>
              <select
                value={flagDraft.type}
                onChange={(e) => setFlagDraft((prev) => ({ ...prev, type: e.target.value }))}
                style={smallFieldStyle}
              >
                {FLAG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <FieldLabel>Should say / note</FieldLabel>
          <input
            type="text"
            value={flagDraft.note}
            onChange={(e) => setFlagDraft((prev) => ({ ...prev, note: e.target.value }))}
            placeholder="What the narrator should say…"
            style={popoverInputStyle}
          />

          <div style={popoverActionsStyle}>
            <button onClick={clearSelection} style={popoverSecondaryStyle}>Cancel</button>
            <button onClick={saveFlag} style={popoverPrimaryStyle(PROOF_ACCENT)}>Save flag</button>
          </div>
        </ReaderPopover>
      )}

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 86,
            transform: 'translateX(-50%)',
            maxWidth: `min(${PHONE_READER_MAX_WIDTH}px, calc(100vw - 24px))`,
            background: '#fff7e6',
            color: '#7a5b18',
            border: '1px solid #f4d28a',
            borderRadius: 999,
            padding: '8px 14px',
            fontSize: '0.78rem',
            fontWeight: 600,
            boxShadow: '0 8px 22px rgba(76,72,70,0.16)',
            zIndex: 1600,
          }}
        >
          {toast}
        </div>
      )}

      <PhoneAudioDock
        tone={tone}
        sectionKey={section.id}
        currentTimeRef={currentAudioTimeRef}
        onTimeTick={(t) => setAudioTime(t)}
        canSync={canSyncAudio}
        syncEnabled={syncEnabled}
        onToggleSync={() => setSyncEnabled((s) => !s)}
        defaultFileName={section.audioFileName || ''}
        presetAudioFile={presetAudioFile}
        onManualPickAudio={onManualPickAudio}
      />
    </main>
  );
}

// ===========================================================================
// PhoneAudioDock — shared audio strip (Quill + Script). Now with Sync.
// ===========================================================================

function PhoneAudioDock({ tone = { ink: PROOF_INK, accent: PROOF_ACCENT, pastel: PROOF_PASTEL }, sectionKey, currentTimeRef, onTimeTick, canSync = false, syncEnabled = false, onToggleSync, defaultFileName = '', presetAudioFile = null, onManualPickAudio = null }) {
  const inputRef = useRef(null);
  const audioRef = useRef(null);
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [loadError, setLoadError] = useState('');

  // When the user navigates to a different section, reset all transient
  // playback state. If the parent has already matched a file from the
  // folder Marie picked at the book level, adopt it as the new default.
  useEffect(() => {
    setFile(presetAudioFile || null);
    setIsPlaying(false);
    setTime(0);
    setLoadError('');
    if (currentTimeRef) currentTimeRef.current = 0;
    // intentionally only react to section change, not to presetAudioFile
    // identity changes within the same section
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey, currentTimeRef]);

  useEffect(() => {
    if (!file) { setAudioUrl(''); return undefined; }
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate, audioUrl]);

  function handleTimeUpdate(e) {
    const t = e.currentTarget.currentTime;
    setTime(t);
    if (currentTimeRef) currentTimeRef.current = t;
    if (onTimeTick) onTimeTick(t);
  }

  function handleLoadedMetadata(e) {
    setDuration(Number(e.currentTarget.duration) || 0);
  }

  async function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      try { await a.play(); setIsPlaying(true); } catch { setIsPlaying(false); }
    } else {
      a.pause();
      setIsPlaying(false);
    }
  }

  function seek(t) {
    const a = audioRef.current;
    if (!a) return;
    const next = Number(t) || 0;
    a.currentTime = next;
    setTime(next);
    if (currentTimeRef) currentTimeRef.current = next;
  }

  function clear() {
    if (audioRef.current) audioRef.current.pause();
    setFile(null);
    setIsPlaying(false);
    setTime(0);
    if (currentTimeRef) currentTimeRef.current = 0;
    // Clear any per-section override so re-entering doesn't restore it.
    if (onManualPickAudio) onManualPickAudio(null);
  }

  const ink = tone.ink || PROOF_INK;
  const accent = tone.accent || PROOF_ACCENT;
  const pastel = tone.pastel || PROOF_PASTEL;

  return (
    <div
      style={{
        position: 'fixed',
        left: 8,
        right: 8,
        bottom: 8,
        zIndex: 1400,
        background: 'white',
        border: '1px solid ' + ink + '33',
        borderRadius: file ? 18 : 999,
        padding: file ? '8px 10px' : '6px 8px',
        boxShadow: '0 12px 28px rgba(76,72,70,0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: PHONE_READER_MAX_WIDTH,
        margin: '0 auto',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setLoadError('');
            setFile(f);
            // Tell the parent so this pick survives navigation away
            // from the section and back.
            if (onManualPickAudio) onManualPickAudio(f);
          }
          e.target.value = '';
        }}
      />
      {!file ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 4 }}>
          <button
            onClick={() => inputRef.current?.click()}
            aria-label="Pick audio file"
            title={defaultFileName ? `Suggested: ${defaultFileName}` : 'Pick an audio file on this device'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', background: pastel,
              border: '1px solid ' + ink + '33',
              borderRadius: 999, color: ink,
              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            ♫ Pick audio
          </button>
          {loadError && <div style={{ fontSize: '0.66rem', color: '#C4514A' }}>{loadError}</div>}
        </div>
      ) : (
        <>
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onError={() => {
              setLoadError('Could not play that audio file.');
              setFile(null);
              setIsPlaying(false);
            }}
            preload="metadata"
          />
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{ width: 36, height: 36, borderRadius: '50%', background: accent, color: 'white', border: 'none', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', flexShrink: 0 }}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          {onToggleSync && (
            <button
              onClick={onToggleSync}
              disabled={!canSync}
              title={canSync ? (syncEnabled ? 'Sync on' : 'Sync off') : 'Sync needs whisper transcription from the desktop'}
              style={{
                padding: '5px 10px',
                background: syncEnabled ? ink : 'white',
                color: syncEnabled ? 'white' : (canSync ? ink : '#9B928E'),
                border: '1px solid ' + (canSync ? ink + '55' : '#DDD0C4'),
                borderRadius: 999,
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: canSync ? 'pointer' : 'not-allowed',
                flexShrink: 0,
              }}
            >
              Sync
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              type="range"
              min={0}
              max={Math.max(0.1, duration)}
              step={0.1}
              value={Math.min(time, Math.max(0.1, duration))}
              onChange={(e) => seek(e.target.value)}
              style={{ width: '100%', accentColor: ink }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#6D6663', marginTop: 1 }}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(time)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{file.name}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTime(duration)}</span>
            </div>
          </div>
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            aria-label="Playback speed"
            style={{ padding: '3px 4px', borderRadius: 6, border: '1px solid #DDD0C4', fontSize: '0.7rem', background: 'white', color: '#4C4846' }}
          >
            {[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
              <option key={r} value={r}>{r}×</option>
            ))}
          </select>
          <button
            onClick={clear}
            aria-label="Close audio"
            style={{ background: 'none', border: 'none', color: '#9B928E', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', flexShrink: 0 }}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

// ===========================================================================
// Shared chrome
// ===========================================================================

function phoneRoot(bg) {
  return {
    minHeight: '100vh',
    background: bg,
    color: '#4C4846',
    paddingBottom: 24,
  };
}

function PhoneHeader({ title, left, right, bg, navBg, ink }) {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '12px 12px',
      background: navBg || 'rgba(244,241,238,0.94)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(0,0,0,0.08)',
    }}>
      <div style={{ minWidth: 36, display: 'flex', justifyContent: 'flex-start' }}>{left}</div>
      <div style={{ flex: 1, textAlign: 'center', fontSize: '0.92rem', fontWeight: 700, color: ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>
        {title}
      </div>
      <div style={{ minWidth: 36, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </header>
  );
}

function BackButton({ onClick, ink = QUILL_INK }) {
  return (
    <button
      onClick={onClick}
      aria-label="Back"
      style={{
        width: 34, height: 34, borderRadius: 999,
        background: 'white', border: '1px solid rgba(0,0,0,0.08)',
        cursor: 'pointer', fontSize: '1.05rem', color: ink,
        lineHeight: 1,
      }}
    >
      ←
    </button>
  );
}

function SettingsButton({ onClick, ink }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Reader settings"
      title="Reader settings"
      style={{
        width: 34, height: 34, borderRadius: 999,
        background: 'white', border: '1px solid rgba(0,0,0,0.08)',
        cursor: 'pointer', color: ink, fontSize: '1rem',
        display: 'inline-grid', placeItems: 'center',
      }}
    >
      {/* Gear glyph */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09c0 .66.39 1.26 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82c.25.61.85 1 1.51 1H21a2 2 0 0 1 0 4h-.09c-.66 0-1.26.39-1.51 1z" />
      </svg>
    </button>
  );
}

function AccountChip({ email, onSignOut }) {
  const [open, setOpen] = useState(false);
  if (!email) return null;
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        style={{
          width: 34, height: 34, borderRadius: 999,
          background: QUILL_PASTEL,
          border: '1px solid ' + QUILL_INK + '33',
          color: QUILL_INK, fontWeight: 700, cursor: 'pointer',
        }}
      >
        {email.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', top: 40, right: 0,
            background: 'white', border: '1px solid #DDD0C4',
            borderRadius: 12, padding: 10,
            boxShadow: '0 14px 34px rgba(76, 72, 70, 0.18)',
            minWidth: 220, zIndex: 30,
          }}
        >
          <div style={{ fontSize: '0.74rem', color: '#6D6663', marginBottom: 8, wordBreak: 'break-all' }}>{email}</div>
          <button onClick={() => { setOpen(false); onSignOut(); }} style={{ width: '100%', padding: '8px 10px', background: 'white', border: '1px solid #DDD0C4', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', color: '#4C4846' }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// PendingFlagBanner — "X flag(s) waiting to sync to the cloud" notice
// that surfaces whenever the local flag queue isn't empty. Click to
// trigger a retry refresh. Matters because Marie had no way of knowing
// when a push silently failed.

function PendingFlagBanner({ count, onRetry, loading }) {
  if (!count) return null;
  return (
    <div
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#fff7e6',
        color: '#7a5b18',
        border: '1px solid #f4d28a',
        borderRadius: 0,
        padding: '8px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10,
        fontSize: '0.78rem',
        fontWeight: 700,
      }}
    >
      <span>
        ⏳ {count} flag change{count === 1 ? '' : 's'} waiting to sync
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={loading}
        style={{
          padding: '5px 12px',
          background: loading ? 'rgba(122,91,24,0.16)' : '#7a5b18',
          color: 'white',
          border: 'none',
          borderRadius: 999,
          fontSize: '0.72rem',
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Retrying…' : 'Retry now'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BookTabStrip — Chapters / Flags toggle inside a book's detail screen.
// Mirrors the desktop side-nav tab pills so the phone has the same
// affordance for "show me every flag in the book."
// ---------------------------------------------------------------------------

function BookTabStrip({ tabs, active, onChange, tone, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'white', border: '1px solid ' + tone.ink + '33', borderRadius: 999, padding: 3 }}>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: on ? tone.pastel : 'transparent',
                color: on ? tone.ink : '#6D6663',
                border: 'none',
                borderRadius: 999,
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.label}
              {typeof t.count === 'number' && t.count > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 18, height: 16, padding: '0 6px',
                  borderRadius: 999,
                  background: on ? tone.ink : '#EAE0D6',
                  color: on ? 'white' : '#6D6663',
                  fontSize: '0.62rem', fontWeight: 800, lineHeight: 1,
                }}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {right}
    </div>
  );
}

// BookFlagsList — flat scrollable list of every flag in the book, with
// per-flag delete + tap-to-jump-to-chapter. Same data shape as desktop's
// renderFlagsTab.
function BookFlagsList({ book, onOpenFlag, onDeleteFlag }) {
  const rows = useMemo(() => {
    const out = [];
    (book?.chapters || []).forEach((ch, ci) => {
      (ch.sections || []).forEach((sec) => {
        (sec.flags || []).forEach((fl) => {
          const id = fl.id || `${fl.idx}:${fl.ts}`;
          out.push({
            id,
            chapterId: ch.id,
            sectionId: sec.id,
            chapterIndex: ci,
            chapterTitle: ch.title || `Chapter ${ci + 1}`,
            ts: Number(fl.ts) || 0,
            page: fl.page || '',
            type: fl.type || 'Edit',
            narrator: fl.narrator || '',
            sentPlain: fl.sentPlain || '',
            note: fl.note || '',
          });
        });
      });
    });
    return out.sort((a, b) => (a.chapterIndex - b.chapterIndex) || (a.ts - b.ts));
  }, [book]);

  if (!rows.length) {
    return (
      <div style={emptyStyle}>
        No flags yet. Open a chapter and tap a word to flag a moment.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((flag) => (
        <div key={flag.id} style={{ display: 'flex', alignItems: 'stretch', gap: 6, background: 'white', border: '1px solid #DDD0C4', borderRadius: 12, padding: '10px 12px' }}>
          <button
            type="button"
            onClick={() => onOpenFlag(flag.chapterId, flag.sectionId)}
            style={{ flex: 1, background: 'transparent', border: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', minWidth: 0 }}
            title="Jump to this flag"
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: '0.66rem', color: '#6D6663', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              <span>Ch {flag.chapterIndex + 1}</span>
              <span style={{ fontFamily: 'monospace', color: PROOF_INK }}>{formatTime(flag.ts)}</span>
              <span>· {flag.type}</span>
              {flag.page && flag.page !== '#' && <span>· p.{flag.page}</span>}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#4C4846', fontStyle: 'italic', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              &ldquo;{flag.sentPlain || '(no quote)'}&rdquo;
            </div>
            {flag.note && (
              <div style={{ fontSize: '0.72rem', color: '#6D6663', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {flag.note}
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete this ${flag.type} flag on Ch ${flag.chapterIndex + 1}?`)) onDeleteFlag(flag.sectionId, flag.id);
            }}
            aria-label="Delete flag"
            title="Delete flag"
            style={{ flexShrink: 0, width: 28, height: 28, padding: 0, borderRadius: 999, border: '1px solid #f0b8b8', background: 'white', color: '#C4514A', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BookAudioFolderPicker — top-of-book "pick the whole audio folder once"
// strip. After Marie picks a folder, each chapter's audio is matched by
// `audioFileName` automatically when she opens that chapter. The audio
// files NEVER leave her phone — only the filename ever crossed Supabase
// (set on the desktop at import time).
// ---------------------------------------------------------------------------

function BookAudioFolderPicker({ book, audioFiles, matchedCount, totalSections, status, onPick, onClear }) {
  const folderInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const hasFolder = (audioFiles || []).length > 0;
  return (
    <div
      style={{
        background: 'white',
        border: '1px dashed ' + PROOF_INK + '44',
        borderRadius: 14,
        padding: '10px 12px',
        marginBottom: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <input
        ref={folderInputRef}
        type="file"
        // Standard + WebKit dir attrs let the browser open a folder picker.
        // On iOS Safari (which doesn't support webkitdirectory), the file
        // input falls back to multi-file selection — Marie can multi-select
        // the audio files inside the Files app and we'll match the same way.
        webkitdirectory=""
        directory=""
        multiple
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = getAudioFiles(e.target.files);
          e.target.value = '';
          if (files.length) onPick(files);
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = getAudioFiles(e.target.files);
          e.target.value = '';
          if (files.length) onPick(files);
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PROOF_INK }}>
            Audio folder
          </div>
          {hasFolder ? (
            <div style={{ fontSize: '0.78rem', color: '#4C4846', marginTop: 2 }}>
              {audioFiles.length} file{audioFiles.length === 1 ? '' : 's'} loaded · matched <strong>{matchedCount}</strong> of {totalSections} section{totalSections === 1 ? '' : 's'}
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: '#6D6663', marginTop: 2 }}>
              Pick the folder of audio files for this book — every chapter auto-attaches.
            </div>
          )}
          {status && (
            <div style={{ fontSize: '0.7rem', color: '#6D6663', marginTop: 4, fontStyle: 'italic' }}>{status}</div>
          )}
        </div>
        {hasFolder && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear audio folder"
            style={{ background: 'none', border: 'none', color: '#9B928E', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, padding: '2px 6px' }}
          >
            Clear
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          style={{
            flex: '1 1 auto',
            padding: '10px 14px',
            background: PROOF_PASTEL,
            color: PROOF_INK,
            border: '1px solid ' + PROOF_INK + '33',
            borderRadius: 999,
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          📁 Pick folder
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            flex: '1 1 auto',
            padding: '10px 14px',
            background: 'white',
            color: PROOF_INK,
            border: '1px solid ' + PROOF_INK + '33',
            borderRadius: 999,
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          title="On iPhone, use this to pick multiple audio files at once"
        >
          🎵 Pick files
        </button>
      </div>
    </div>
  );
}

// Constrained popover that sits at the bottom of the reader, matching the
// reader's column width so it doesn't look like a system sheet.
function ReaderPopover({ ink, children }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 80,
        transform: 'translateX(-50%)',
        width: `min(${PHONE_READER_MAX_WIDTH}px, calc(100vw - 24px))`,
        background: 'white',
        border: `1px solid ${ink}55`,
        borderRadius: 16,
        boxShadow: '0 14px 34px rgba(76, 72, 70, 0.22)',
        padding: '14px 14px',
        zIndex: 1500,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function textBtnStyle(ink) {
  return {
    background: 'none', border: 'none', color: ink,
    fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
    textDecoration: 'underline', textUnderlineOffset: 3,
  };
}

function projectCardStyle(accent) {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '14px 14px',
    background: 'white',
    border: '1px solid #DDD0C4',
    borderLeft: '4px solid ' + accent,
    borderRadius: 12,
    marginBottom: 8,
    cursor: 'pointer',
    textAlign: 'left',
  };
}

function topActionStyle(accent) {
  return {
    width: 34, height: 34, borderRadius: 999,
    background: accent, color: 'white',
    border: 'none', fontWeight: 700, fontSize: '1.1rem',
    cursor: 'pointer', lineHeight: 1,
  };
}

const errorBoxStyle = {
  background: '#FAEDEC',
  color: '#C4514A',
  padding: '10px 12px',
  borderRadius: 10,
  fontSize: '0.82rem',
  marginBottom: 10,
};

const emptyStyle = {
  textAlign: 'center',
  padding: '1.6rem 0',
  fontSize: '0.84rem',
  color: '#9B928E',
};

const annotationCardStyle = {
  background: 'white',
  border: '1px solid #DDD0C4',
  borderRadius: 10,
  padding: '8px 10px',
  marginBottom: 6,
};

function popoverHeader(ink) {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  };
}

const popoverCloseStyle = {
  width: 26,
  height: 26,
  borderRadius: 999,
  background: 'white',
  border: '1px solid #DDD0C4',
  fontSize: '0.95rem',
  cursor: 'pointer',
  color: '#6D6663',
  lineHeight: 1,
};

const popoverInputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid #DDD0C4',
  fontSize: '0.88rem',
  marginBottom: 10,
  boxSizing: 'border-box',
};

const smallFieldStyle = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid #DDD0C4',
  fontSize: '0.86rem',
  background: 'white',
  color: '#4C4846',
  boxSizing: 'border-box',
};

function FieldLabel({ children }) {
  return (
    <div
      style={{
        fontSize: '0.62rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#6D6663',
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

const popoverActionsStyle = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
};

const popoverSecondaryStyle = {
  padding: '9px 14px',
  background: 'white',
  border: '1px solid #DDD0C4',
  borderRadius: 999,
  fontSize: '0.82rem',
  fontWeight: 600,
  color: '#6D6663',
  cursor: 'pointer',
};

function popoverPrimaryStyle(accent) {
  return {
    padding: '9px 16px',
    background: accent,
    color: 'white',
    border: 'none',
    borderRadius: 999,
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
  };
}
