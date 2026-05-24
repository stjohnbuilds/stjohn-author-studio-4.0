'use client';

// Phone companion — port from
// /Users/.../StJohn Author Apps/apps/phone - ARCHIVED 2026-05-23/
//
// Live at /phone in this Next.js app. Deploys to Vercel as a web app
// (no Electron). Scope (per CLAUDE.md):
//   - Login (Supabase, same account as desktop)
//   - Service picker (Script / Quill — small for now, only Quill wired)
//   - Project list (text-only, from cloud)
//   - Chapter list per project
//   - Read-only chapter view with tap-to-annotate (Quill)
//   - Audio stays on the phone — only file *name* is exchanged
//
// NOT in this overnight build: audio playback, search, CSV export, Script
// mode flag-tapping, manuscript editing. Marie's morning todo.

import { useState, useEffect, useMemo, useCallback } from 'react';
import LoginScreen from '../components/LoginScreen';
import {
  hasSupabaseConfig,
  getSupabaseClient,
  signOutSupabaseAccount,
  pullQuillProjects,
  pushQuillProject,
} from '../../packages/cloud-sync';
import {
  buildWordSpans,
  buildSelectionTextContext,
  getAnnotationClassTree,
  createAnnotation,
  resolveAnnotationSelection,
} from '../../packages/quill-engine';

const PHONE_BG = '#F4F1EE';
const QUILL_INK = '#834D5C';
const QUILL_ACCENT = '#CB8AA0';
const QUILL_PASTEL = '#F8E2E8';

const SERVICE_OPTIONS = [
  { id: 'quill', label: 'Quill & Ink', subtitle: 'Annotate the manuscript', ink: QUILL_INK, accent: QUILL_ACCENT, pastel: QUILL_PASTEL },
  { id: 'script', label: 'Proof Listen', subtitle: 'Tap to flag while listening', ink: '#5C4A78', accent: '#9C7FBE', pastel: '#EBDEF6' },
];

export default function PhoneShell() {
  const [authReady, setAuthReady] = useState(!hasSupabaseConfig);
  const [authSession, setAuthSession] = useState(null);

  useEffect(() => {
    if (!hasSupabaseConfig) { setAuthReady(true); return undefined; }
    const supabase = getSupabaseClient();
    if (!supabase) { setAuthReady(true); return undefined; }
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setAuthSession(data?.session || null);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthSession(session || null);
    });
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await signOutSupabaseAccount(supabase);
    setAuthSession(null);
  }

  if (!authReady) {
    return (
      <main style={{ minHeight: '100vh', background: PHONE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
// PhoneApp — service picker → projects → chapter view
// ===========================================================================

function PhoneApp({ session, onSignOut }) {
  const [service, setService] = useState(null); // null | 'quill' | 'script'
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeChapterId, setActiveChapterId] = useState(null);

  const reloadProjects = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase is not configured.');
      const list = await pullQuillProjects(supabase);
      setProjects(list);
    } catch (e) {
      setError(e?.message || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (service === 'quill') reloadProjects();
  }, [service, reloadProjects]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );
  const activeChapter = useMemo(
    () => activeProject?.chapters?.find((c) => c.id === activeChapterId) || null,
    [activeProject, activeChapterId]
  );

  function pushProject(nextProject) {
    setProjects((all) => all.map((p) => p.id === nextProject.id ? nextProject : p));
    const supabase = getSupabaseClient();
    if (supabase && session?.user?.id) {
      pushQuillProject(supabase, nextProject, session.user.id).catch((e) =>
        console.warn('[Phone] cloud push failed:', e?.message || e));
    }
  }

  // ---- service picker ----
  if (!service) {
    return (
      <main style={phoneRoot}>
        <PhoneHeader title="Author Companion" right={<AccountChip email={session?.user?.email} onSignOut={onSignOut} />} />
        <section style={{ padding: '1.2rem 1rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 600, color: '#4C4846' }}>Choose a service</div>
            <div style={{ fontSize: '0.78rem', color: '#6D6663', marginTop: 4 }}>
              Signed in as <strong>{session?.user?.email || ''}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SERVICE_OPTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => { if (s.id === 'quill') setService('quill'); else alert('Proof Listen on phone is coming next.'); }}
                style={{
                  padding: '20px 18px',
                  background: 'white',
                  border: '1px solid ' + s.ink + '33',
                  borderLeft: '6px solid ' + s.accent,
                  borderRadius: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
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

  // ---- reader (chapter open) ----
  if (activeChapter && activeProject) {
    return (
      <PhoneChapterReader
        project={activeProject}
        chapter={activeChapter}
        onBack={() => setActiveChapterId(null)}
        onSaveProject={pushProject}
      />
    );
  }

  // ---- chapter list ----
  if (activeProject) {
    return (
      <main style={phoneRoot}>
        <PhoneHeader
          title={activeProject.title}
          left={<BackButton onClick={() => setActiveProjectId(null)} />}
        />
        <section style={{ padding: '1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL_INK, marginBottom: 10 }}>
            Chapters
          </div>
          {(activeProject.chapters || []).map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActiveChapterId(ch.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '14px 14px',
                background: 'white',
                border: '1px solid #DDD0C4',
                borderRadius: 12,
                marginBottom: 8,
                cursor: 'pointer',
                textAlign: 'left',
              }}
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

  // ---- project list ----
  return (
    <main style={phoneRoot}>
      <PhoneHeader
        title="Quill & Ink"
        left={<BackButton onClick={() => setService(null)} />}
        right={<AccountChip email={session?.user?.email} onSignOut={onSignOut} />}
      />
      <section style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL_INK }}>
            Your projects
          </div>
          <button onClick={reloadProjects} style={{ background: 'none', border: 'none', color: QUILL_INK, fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {error && <div style={{ background: '#FAEDEC', color: '#C4514A', padding: '10px 12px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 10 }}>{error}</div>}
        {!projects.length && !loading && (
          <div style={{ textAlign: 'center', padding: '1.6rem 0', fontSize: '0.84rem', color: '#9B928E' }}>
            No projects saved to the cloud yet. Import a manuscript on the desktop app first.
          </div>
        )}
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => { setActiveProjectId(p.id); setActiveChapterId(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '14px 14px',
              background: 'white',
              border: '1px solid #DDD0C4',
              borderLeft: '4px solid ' + QUILL_ACCENT,
              borderRadius: 12,
              marginBottom: 8,
              cursor: 'pointer',
              textAlign: 'left',
            }}
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

// ===========================================================================
// Chapter reader — read-only manuscript with tap-to-annotate
// ===========================================================================

function PhoneChapterReader({ project, chapter, onBack, onSaveProject }) {
  const plainText = chapter.plainText || '';
  const wordSpans = useMemo(() => buildWordSpans(plainText), [plainText]);
  const [selectedRange, setSelectedRange] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [classId, setClassId] = useState('highlight');
  const [optionId, setOptionId] = useState('');
  const [note, setNote] = useState('');

  const classTree = useMemo(() => getAnnotationClassTree(project.annotationOptions || []), [project.annotationOptions]);
  const annotationsForChapter = useMemo(
    () => (project.annotations || []).filter((a) => a.sectionId === chapter.id),
    [project.annotations, chapter.id]
  );

  function onWordTap(idx) {
    if (selectedRange?.start === idx && selectedRange?.end === idx) {
      // Same tap — clear
      setSelectedRange(null);
      setPopoverOpen(false);
      return;
    }
    setSelectedRange({ start: idx, end: idx });
    setPopoverOpen(true);
  }

  function extendSelection(targetIdx) {
    if (!selectedRange) return;
    setSelectedRange({
      start: Math.min(selectedRange.start, targetIdx),
      end: Math.max(selectedRange.end, targetIdx),
    });
  }

  function cancelAnnotation() {
    setSelectedRange(null);
    setPopoverOpen(false);
    setNote('');
  }

  function saveAnnotation() {
    if (!selectedRange) return;
    const selectedText = wordSpans.slice(selectedRange.start, selectedRange.end + 1).map((s) => s.word).join(' ');
    const textContext = buildSelectionTextContext(plainText, wordSpans, selectedRange.start, selectedRange.end);
    const selection = resolveAnnotationSelection({ classId, optionId, projectOptions: project.annotationOptions || [] });
    const ann = createAnnotation({
      selection,
      sectionId: chapter.id,
      sectionTitle: chapter.title,
      chapterNumber: chapter.chapterNumber,
      wordStart: selectedRange.start,
      wordEnd: selectedRange.end,
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
    cancelAnnotation();
  }

  return (
    <main style={phoneRoot}>
      <PhoneHeader
        title={`Ch ${chapter.chapterNumber}: ${chapter.title}`}
        left={<BackButton onClick={onBack} />}
      />
      <section style={{ padding: '1rem 0.9rem 6rem', userSelect: 'none' }}>
        <div style={{ background: 'white', border: '1px solid #DDD0C4', borderRadius: 14, padding: '1rem 1rem', fontSize: '17px', lineHeight: 1.7, color: '#4C4846' }}>
          {wordSpans.length === 0 && (
            <span style={{ color: '#9B928E', fontSize: '0.86rem' }}>No text in this chapter.</span>
          )}
          {wordSpans.map((span, idx) => {
            const inSel = !!selectedRange && idx >= selectedRange.start && idx <= selectedRange.end;
            const ann = annotationsForChapter.find((a) => idx >= Number(a.wordStart) && idx <= Number(a.wordEnd ?? a.wordStart));
            const style = { cursor: 'pointer', padding: '0 1px', borderRadius: 3 };
            if (ann && !inSel) {
              if (ann.classId === 'highlight') { style.borderBottom = '3px solid ' + (ann.color || '#f0aac0'); }
              else { style.background = (ann.color || QUILL_ACCENT) + '33'; }
            }
            if (inSel) { style.background = QUILL_PASTEL; style.boxShadow = `inset 0 -2px 0 ${QUILL_INK}`; }
            const sep = idx < wordSpans.length - 1 ? plainText.slice(span.end, wordSpans[idx + 1].start) : '';
            return (
              <span
                key={idx}
                onClick={() => onWordTap(idx)}
                onPointerEnter={(e) => { if (e.buttons === 1 && selectedRange) extendSelection(idx); }}
              >
                <span style={style}>{span.word}</span>
                {sep}
              </span>
            );
          })}
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL_INK, marginBottom: 8 }}>
            Annotations · {annotationsForChapter.length}
          </div>
          {annotationsForChapter.map((a) => (
            <div key={a.id} style={{ background: 'white', border: '1px solid #DDD0C4', borderRadius: 10, padding: '8px 10px', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: a.color || QUILL_ACCENT }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: QUILL_INK }}>{a.label || a.classLabel}</span>
              </div>
              <div style={{ fontSize: '0.82rem', fontStyle: 'italic' }}>&ldquo;{a.selectedText}&rdquo;</div>
              {a.note && <div style={{ fontSize: '0.72rem', color: '#6D6663', marginTop: 3 }}>{a.note}</div>}
            </div>
          ))}
        </div>
      </section>

      {popoverOpen && selectedRange && (
        <div
          style={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 18,
            background: 'white',
            border: '1px solid ' + QUILL_INK + '55',
            borderRadius: 16,
            boxShadow: '0 14px 34px rgba(76, 72, 70, 0.22)',
            padding: '14px 14px',
            zIndex: 1500,
          }}
        >
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
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #DDD0C4', fontSize: '0.88rem', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cancelAnnotation} style={{ padding: '9px 14px', background: 'white', border: '1px solid #DDD0C4', borderRadius: 999, fontSize: '0.82rem', fontWeight: 600, color: '#6D6663', cursor: 'pointer' }}>Cancel</button>
            <button onClick={saveAnnotation} style={{ padding: '9px 16px', background: QUILL_ACCENT, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}>
              Save annotation
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ===========================================================================
// Small chrome bits
// ===========================================================================

const phoneRoot = {
  minHeight: '100vh',
  background: PHONE_BG,
  color: '#4C4846',
  maxWidth: 480,
  margin: '0 auto',
  paddingBottom: 24,
};

function PhoneHeader({ title, left, right }) {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: '14px 12px',
      background: 'rgba(244,241,238,0.94)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid #EAE0D6',
    }}>
      <div style={{ width: 36, display: 'flex', justifyContent: 'flex-start' }}>{left}</div>
      <div style={{ flex: 1, textAlign: 'center', fontSize: '0.94rem', fontWeight: 700, color: QUILL_INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </div>
      <div style={{ width: 36, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </header>
  );
}

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Back"
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        background: 'white',
        border: '1px solid #DDD0C4',
        cursor: 'pointer',
        fontSize: '1.05rem',
        color: QUILL_INK,
        lineHeight: 1,
      }}
    >
      ←
    </button>
  );
}

function AccountChip({ email, onSignOut }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          background: QUILL_PASTEL,
          border: '1px solid ' + QUILL_INK + '33',
          color: QUILL_INK,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {(email || '?').charAt(0).toUpperCase()}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 0,
            background: 'white',
            border: '1px solid #DDD0C4',
            borderRadius: 12,
            padding: 10,
            boxShadow: '0 14px 34px rgba(76, 72, 70, 0.18)',
            minWidth: 220,
            zIndex: 30,
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
