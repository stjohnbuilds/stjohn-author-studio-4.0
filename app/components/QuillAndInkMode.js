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
import {
  MODE_TOKENS,
  HomeBackPill,
  SaveBadge,
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
  buildAnnotationsCsv,
  buildInDesignJsx,
} from '../../packages/quill-engine';
import {
  getSupabaseClient,
  pushQuillProject,
  pullQuillProjects,
  deleteQuillProject,
} from '../../packages/cloud-sync';

const QUILL = MODE_TOKENS.quill;
const STORAGE_KEY = 'quill-projects-v1';

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isBlockTag(tagName) {
  return ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'LI'].includes(tagName);
}

async function loadProjects() {
  const electron = typeof window !== 'undefined' ? window.electron : null;
  if (electron?.readQuillData) {
    try {
      const list = await electron.readQuillData();
      return Array.isArray(list) ? list : [];
    } catch {}
  }
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

async function persistProjects(projects) {
  const electron = typeof window !== 'undefined' ? window.electron : null;
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

function safeFileName(value = 'quill-and-ink-project') {
  return String(value || 'project').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'project';
}

function mergeProjectLists(local, cloud) {
  const byId = new Map();
  for (const p of local) byId.set(p.id, p);
  for (const p of cloud) {
    const existing = byId.get(p.id);
    if (!existing) { byId.set(p.id, p); continue; }
    const newer = new Date(p.updatedAt || 0) > new Date(existing.updatedAt || 0);
    byId.set(p.id, newer ? p : { ...existing, cloudId: p.cloudId || existing.cloudId });
  }
  return Array.from(byId.values());
}

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
  const [error, setError] = useState('');
  const saveTimerRef = useRef(null);
  const savedFlashRef = useRef(null);

  // hydrate — local first, then merge in cloud if signed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const local = await loadProjects();
        if (cancelled) return;
        setAllProjects(local);

        // Try cloud pull. If signed in and any cloud rows exist, merge
        // them in (cloud wins on conflicting project ids). If not
        // signed in, the call throws and we silently keep local.
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        if (!data?.session?.user) return;
        try {
          const cloudProjects = await pullQuillProjects(supabase);
          if (cancelled || !cloudProjects.length) return;
          setAllProjects((current) => mergeProjectLists(current, cloudProjects));
        } catch (e) {
          console.warn('[Quill] cloud pull failed:', e?.message || e);
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // persist on change (debounced). Writes local AND attempts cloud push.
  useEffect(() => {
    if (!hydrated) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await persistProjects(allProjects);
        // Fire-and-forget cloud push for each project. Failures are
        // logged but don't disrupt the local save.
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          const ownerId = data?.session?.user?.id;
          if (ownerId) {
            for (const project of allProjects) {
              try { await pushQuillProject(supabase, project, ownerId); }
              catch (e) { console.warn('[Quill] cloud push failed for', project.title, e?.message || e); }
            }
          }
        }
        setSaveStatus('saved');
        if (savedFlashRef.current) clearTimeout(savedFlashRef.current);
        savedFlashRef.current = setTimeout(() => setSaveStatus('idle'), 1400);
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
    };
    setAllProjects((all) => [...all, project]);
    setActiveProjectId(project.id);
    setActiveChapterId(chapters[0]?.id || null);
    setView('bookDetail');
    setError('');
  }

  function deleteProject(id) {
    const target = allProjects.find((p) => p.id === id);
    setAllProjects((all) => all.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
      setActiveChapterId(null);
      setView('home');
    }
    // Cloud delete is fire-and-forget.
    if (target?.cloudId) {
      const supabase = getSupabaseClient();
      if (supabase) {
        deleteQuillProject(supabase, target.cloudId).catch((e) =>
          console.warn('[Quill] cloud delete failed:', e?.message || e));
      }
    }
  }

  // ----- export from book detail -----
  function exportAll() {
    if (!activeProject) return;
    const safe = safeFileName(activeProject.title);
    downloadText(`${safe}-annotations.csv`, buildAnnotationsCsv(activeProject), 'text/csv');
    downloadText(`${safe}-indesign.jsx`, buildInDesignJsx(activeProject), 'application/javascript');
  }
  function exportCsv() {
    if (!activeProject) return;
    downloadText(`${safeFileName(activeProject.title)}-annotations.csv`, buildAnnotationsCsv(activeProject), 'text/csv');
  }
  function exportJsx() {
    if (!activeProject) return;
    downloadText(`${safeFileName(activeProject.title)}-indesign.jsx`, buildInDesignJsx(activeProject), 'application/javascript');
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
        onCancel={() => setView(activeProject ? 'bookDetail' : 'home')}
        onConfirm={commitImport}
      />
    );
  }

  if (view === 'reader' && activeProject && activeChapter) {
    return (
      <>
        {usesCustomDragRegion && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 1100 }} />
        )}
        <HomeBackPill icon="←" onClick={() => setView('bookDetail')} usesCustomDragRegion={usesCustomDragRegion} tone="quill" />
        <QuillReaderView
          project={activeProject}
          chapterId={activeChapterId}
          onChangeChapter={setActiveChapterId}
          saveStatus={saveStatus}
          usesCustomDragRegion={usesCustomDragRegion}
          updateProject={updateActive}
        />
      </>
    );
  }

  if (view === 'bookDetail' && activeProject) {
    return (
      <>
        {usesCustomDragRegion && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 1100 }} />
        )}
        <HomeBackPill icon="⌂" onClick={() => { setView('home'); setActiveProjectId(null); }} usesCustomDragRegion={usesCustomDragRegion} tone="quill" />
        <QuillBookDetail
          project={activeProject}
          saveStatus={saveStatus}
          onOpenChapter={(chId) => { setActiveChapterId(chId); setView('reader'); }}
          onDelete={() => deleteProject(activeProject.id)}
          onReimport={() => setView('setup')}
          onExportCsv={exportCsv}
          onExportJsx={exportJsx}
          onExportAll={exportAll}
        />
      </>
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
        onOpen={(p) => { setActiveProjectId(p.id); setActiveChapterId(p.chapters?.[0]?.id || null); setView('bookDetail'); }}
        onNew={() => setView('setup')}
        error={error}
      />
    </div>
  );
}

// ===========================================================================
// Home — project list
// ===========================================================================

function QuillHomeView({ projects, onOpen, onNew, error }) {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '5.2rem 1.25rem 4rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
        <div style={{ fontSize: '1.55rem', fontWeight: 600, color: QUILL.ink }}>Quill &amp; Ink</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Annotate a manuscript for InDesign-friendly special-edition print design.
        </div>
      </div>

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
            {projects.map((p) => {
              const chapterCount = p.chapters?.length || 0;
              const annCount = p.annotations?.length || 0;
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
                  <span style={{ color: 'var(--text-light)', fontSize: '1.2rem', paddingLeft: 10 }}>›</span>
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
      {error && (
        <div style={{ marginTop: 12, color: 'var(--danger)', fontSize: '0.82rem' }}>{error}</div>
      )}
    </div>
  );
}

// ===========================================================================
// Book detail — chapter list + export bar
// ===========================================================================

function QuillBookDetail({ project, saveStatus, onOpenChapter, onDelete, onExportCsv, onExportJsx, onExportAll }) {
  const chapters = project.chapters || [];
  const annotationsByChapter = useMemo(() => {
    const map = new Map();
    for (const ann of project.annotations || []) {
      const key = ann.sectionId || '';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [project.annotations]);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '5.2rem 1.25rem 4rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 600, color: QUILL.ink }}>{project.title}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {chapters.length} chapter{chapters.length === 1 ? '' : 's'} · {project.annotations?.length || 0} annotation{project.annotations?.length === 1 ? '' : 's'}
        </div>
        <div style={{ marginTop: 8 }}>
          <SaveBadge status={saveStatus} tone="quill" />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <button onClick={onExportAll} style={topBtnStyle('quill', 'solid')}>Export CSV + InDesign</button>
        <button onClick={onExportCsv} style={topBtnStyle('quill', 'outline')}>CSV only</button>
        <button onClick={onExportJsx} style={topBtnStyle('quill', 'outline')}>InDesign .jsx only</button>
      </div>

      <section style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid var(--border)', borderRadius: 22, padding: '1rem', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL.ink }}>Chapters</div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Click a chapter to annotate</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: '60vh', overflowY: 'auto' }}>
          {chapters.map((ch) => {
            const count = annotationsByChapter.get(ch.id) || 0;
            return (
              <button
                key={ch.id}
                onClick={() => onOpenChapter(ch.id)}
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
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ch.chapterNumber}. {ch.title}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {count} annotation{count === 1 ? '' : 's'}
                  </div>
                </div>
                <span style={{ color: 'var(--text-light)', fontSize: '1.2rem', paddingLeft: 10 }}>›</span>
              </button>
            );
          })}
          {!chapters.length && (
            <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.82rem', padding: '1.2rem 0 0.35rem' }}>
              No chapters imported yet.
            </div>
          )}
        </div>
      </section>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button onClick={() => { if (confirm(`Delete "${project.title}"? This cannot be undone.`)) onDelete(); }} style={topBtnStyle('quill', 'danger')}>
          Delete project
        </button>
      </div>
    </div>
  );
}

// ===========================================================================
// Reader view — word render, drag-to-highlight, annotation popover + list
// ===========================================================================

function QuillReaderView({ project, chapterId, onChangeChapter, saveStatus, usesCustomDragRegion, updateProject }) {
  const chapters = project.chapters || [];
  const chapterIndex = chapters.findIndex((c) => c.id === chapterId);
  const chapter = chapters[chapterIndex] || null;

  const plainText = chapter?.plainText || htmlToPlainText(chapter?.textHtml || '');
  const wordSpans = useMemo(() => buildWordSpans(plainText), [plainText]);

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
    setPopoverOpen(true);
    setPopoverPos(positionFromEvent(event));
  }

  function positionFromEvent(event) {
    const r = event?.currentTarget?.getBoundingClientRect?.();
    if (!r) return null;
    return { top: window.scrollY + r.top - 8, left: window.scrollX + r.left };
  }

  function openPopover(event) {
    if (!selectedRange) return;
    setPopoverOpen(true);
    setPopoverPos(positionFromEvent(event));
  }

  function saveAnnotation() {
    if (!chapter || !selectedRange) return;
    const start = selectedRange.start;
    const end = selectedRange.end;
    const selectedText = wordSpans.slice(start, end + 1).map((s) => s.word).join(' ');
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
    updateProject((p) => ({
      ...p,
      annotations: (p.annotations || []).filter((a) => a.id !== editingAnnotationId),
    }));
    clearSelection();
  }

  function deleteAnnotation(id) {
    updateProject((p) => ({
      ...p,
      annotations: (p.annotations || []).filter((a) => a.id !== id),
    }));
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
    const target = document.querySelector(`[data-quill-word-index="${ann.wordStart}"]`);
    if (target?.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // -- render content -------------------------------------------------------

  const renderedContent = useMemo(
    () => renderChapterAsWords({ chapter, selectedRange, wordToAnnotation, draggingRef, onWordPointerDown, onWordPointerEnter, onSelectionPlusClick: openPopover, editingAnnotationId, popoverOpen, popoverPos }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter?.id, chapter?.textHtml, selectedRange?.start, selectedRange?.end, wordToAnnotation, editingAnnotationId, popoverOpen, popoverPos]
  );

  if (!chapter) {
    return (
      <div style={{ padding: '5.2rem 1.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No chapter to read.
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{
        position: 'sticky',
        top: usesCustomDragRegion ? 40 : 16,
        zIndex: 1400,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border-light)',
        padding: '10px 16px 10px 92px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 54,
        WebkitAppRegion: 'no-drag',
      }}>
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', maxWidth: '55%', pointerEvents: 'none' }}>
          <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text)' }}>
            Chapter {chapterIndex + 1} of {chapters.length}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {chapter.title}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => onChangeChapter(chapters[Math.max(0, chapterIndex - 1)]?.id)}
            disabled={chapterIndex <= 0}
            style={{ ...topBtnStyle('quill', 'ghost'), opacity: chapterIndex <= 0 ? 0.3 : 1 }}
          >
            ← Prev
          </button>
          <button
            onClick={() => onChangeChapter(chapters[Math.min(chapters.length - 1, chapterIndex + 1)]?.id)}
            disabled={chapterIndex >= chapters.length - 1}
            style={{ ...topBtnStyle('quill', 'ghost'), opacity: chapterIndex >= chapters.length - 1 ? 0.3 : 1 }}
          >
            Next →
          </button>
          <SaveBadge status={saveStatus} tone="quill" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 22, padding: '1.4rem 1.25rem', maxWidth: 1200, margin: '0 auto', alignItems: 'flex-start' }}>
        <div style={{
          flex: '1 1 auto',
          background: 'linear-gradient(180deg, #fbfaf7 0%, #ffffff 16%, #ffffff 100%)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '1.8rem 2rem',
          fontSize: '16.5px',
          lineHeight: 1.92,
          minHeight: '60vh',
          userSelect: 'none',
        }}>
          {renderedContent}
        </div>

        <aside style={{
          flex: '0 0 280px',
          maxWidth: 280,
          background: 'rgba(255,255,255,0.78)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '1rem',
          position: 'sticky',
          top: 120,
          maxHeight: '78vh',
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: QUILL.ink, marginBottom: 10 }}>
            Annotations · {annotationsForChapter.length}
          </div>
          {!annotationsForChapter.length && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
              Drag across text to start.
            </div>
          )}
          {annotationsForChapter.map((ann) => (
            <div key={ann.id} style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              marginBottom: 6,
              background: 'white',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: ann.color || QUILL.accent, flexShrink: 0 }} />
                <button
                  onClick={() => jumpToAnnotation(ann)}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, color: QUILL.ink, textAlign: 'left' }}
                >
                  {ann.label || ann.classLabel || 'Annotation'}
                </button>
                <button
                  onClick={() => deleteAnnotation(ann.id)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: '0.78rem' }}
                  title="Delete"
                >
                  ×
                </button>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text)', fontStyle: 'italic', marginBottom: 2 }}>
                &ldquo;{(ann.selectedText || '').slice(0, 80)}{(ann.selectedText || '').length > 80 ? '…' : ''}&rdquo;
              </div>
              {ann.note && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ann.note}</div>}
            </div>
          ))}
        </aside>
      </div>

      {popoverOpen && popoverPos && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            top: popoverPos.top + 22,
            // Clamp to viewport so the popover never falls off-screen
            // when annotating near the right edge or in a narrow window.
            left: clampPopoverLeft(popoverPos.left - 120, 320),
            zIndex: 1600,
            background: 'white',
            border: '1px solid ' + QUILL.ink + '55',
            borderRadius: 14,
            boxShadow: '0 14px 34px rgba(76, 72, 70, 0.18)',
            padding: 12,
            width: 320,
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
              <button onClick={() => { setCustomAddClassId(''); setCustomLabel(''); }} style={miniCircleBtn('var(--text-light)')}>×</button>
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
                <button onClick={() => { setCustomAddClassId(''); setCustomLabel(''); }} style={miniCircleBtn('var(--text-light)')}>×</button>
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
    </div>
  );
}

function clampPopoverLeft(left, width) {
  if (typeof window === 'undefined') return Math.max(12, left);
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 800;
  const maxLeft = Math.max(12, viewportWidth - width - 12);
  return Math.max(12, Math.min(left, maxLeft));
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

// ===========================================================================
// Word renderer — walks chapter HTML and replaces each [A-Za-z0-9']+ token
// with a clickable button, preserving block formatting.
// ===========================================================================

function renderChapterAsWords({ chapter, selectedRange, wordToAnnotation, draggingRef, onWordPointerDown, onWordPointerEnter, onSelectionPlusClick, editingAnnotationId, popoverOpen, popoverPos }) {
  if (!chapter || typeof document === 'undefined') return null;
  const html = chapter.textHtml || '';
  const host = document.createElement('div');
  host.innerHTML = html;
  let wordIndex = 0;

  function renderText(text, keyPrefix) {
    const pieces = [];
    const re = /[A-Za-z0-9']+/g;
    let last = 0;
    const matches = [];
    let m;
    const source = String(text || '');
    while ((m = re.exec(source)) !== null) {
      matches.push({ value: m[0], start: m.index, end: m.index + m[0].length });
    }
    matches.forEach((it, i) => {
      if (it.start > last) pieces.push(source.slice(last, it.start));
      const idx = wordIndex;
      wordIndex += 1;
      const next = matches[i + 1];
      const after = source.slice(it.end, next ? next.start : source.length);
      pieces.push(renderWord(it.value, after, idx, `${keyPrefix}-w-${idx}`));
      last = next ? next.start : source.length;
    });
    if (!matches.length && source) pieces.push(source);
    return pieces;
  }

  function renderNode(node, key) {
    if (node.nodeType === 3) return renderText(node.textContent || '', key); // text node
    if (node.nodeType !== 1) return null;
    const tag = node.tagName;
    if (tag === 'BR') return <br key={key} />;
    const children = Array.from(node.childNodes).flatMap((c, i) => renderNode(c, `${key}-${i}`));
    if (!children.length && !isBlockTag(tag)) return null;
    if (tag === 'H1') return <h1 key={key} style={{ fontSize: '1.4rem', fontWeight: 600, margin: '1.2rem 0 0.4rem', color: QUILL.ink }}>{children}</h1>;
    if (tag === 'H2') return <h2 key={key} style={{ fontSize: '1.18rem', fontWeight: 600, margin: '1rem 0 0.4rem', color: QUILL.ink }}>{children}</h2>;
    if (tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') return <h3 key={key} style={{ fontSize: '1.02rem', fontWeight: 600, margin: '0.9rem 0 0.3rem', color: QUILL.ink }}>{children}</h3>;
    if (tag === 'P') return <p key={key} style={{ margin: '0 0 0.9rem' }}>{children}</p>;
    if (tag === 'BLOCKQUOTE') return <blockquote key={key} style={{ margin: '0.6rem 0 0.6rem 1rem', borderLeft: '3px solid ' + QUILL.pastel, paddingLeft: '0.8rem', color: 'var(--text-muted)' }}>{children}</blockquote>;
    if (tag === 'UL') return <ul key={key}>{children}</ul>;
    if (tag === 'OL') return <ol key={key}>{children}</ol>;
    if (tag === 'LI') return <li key={key}>{children}</li>;
    if (tag === 'STRONG' || tag === 'B') return <strong key={key}>{children}</strong>;
    if (tag === 'EM' || tag === 'I') return <em key={key}>{children}</em>;
    return isBlockTag(tag) ? <div key={key}>{children}</div> : <span key={key}>{children}</span>;
  }

  function renderWord(word, after, idx, key) {
    const inSelection = !!selectedRange && idx >= selectedRange.start && idx <= selectedRange.end;
    const isSelectionStart = !!selectedRange && idx === selectedRange.start;
    const ann = wordToAnnotation.get(idx);

    const style = {
      cursor: 'pointer',
      padding: '0 1px',
      borderRadius: 3,
      transition: 'background-color 0.1s ease',
    };
    if (ann && !inSelection) {
      if (ann.classId === 'highlight') {
        style.borderBottom = '3px solid ' + (ann.color || '#f0aac0');
        style.paddingBottom = 1;
      } else if (ann.classId === 'image') {
        style.background = '#d8282822';
        style.color = '#7a1818';
      } else {
        style.background = (ann.color || QUILL.accent) + '33';
      }
    }
    if (inSelection) {
      style.background = QUILL.pastel;
      style.boxShadow = `inset 0 -2px 0 ${QUILL.ink}`;
    }

    return (
      <span key={key} style={{ position: 'relative', display: 'inline' }}>
        {isSelectionStart && (
          <span style={{ position: 'absolute', top: -20, left: 0, zIndex: 1500 }}>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => onSelectionPlusClick(e)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                background: QUILL.accent,
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.88rem',
                fontWeight: 700,
                lineHeight: 1,
                boxShadow: '0 4px 10px rgba(76,72,70,0.2)',
              }}
              aria-label={ann ? 'Edit annotation' : 'Add annotation'}
              title={ann ? 'Edit annotation' : 'Add annotation'}
            >
              {ann ? '✎' : '+'}
            </button>
          </span>
        )}
        <span
          data-quill-word-index={idx}
          onPointerDown={(e) => onWordPointerDown(idx, e)}
          onPointerEnter={() => onWordPointerEnter(idx)}
          style={style}
        >
          {word}
        </span>
        {after}
      </span>
    );
  }

  const out = Array.from(host.childNodes).flatMap((node, i) => renderNode(node, `n-${i}`));
  return out;
}
