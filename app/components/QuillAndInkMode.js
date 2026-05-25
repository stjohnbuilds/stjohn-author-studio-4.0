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
import ChapterReader, {
  getChapterReaderWordEl,
  computeChapterReaderPopoverPos,
} from './ChapterReader';
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
  const saveTimerRef = useRef(null);
  const savedFlashRef = useRef(null);
  // True for state changes that came from the cloud (initial hydrate
  // + post-save cloudId backfill) — skips the cloud push side of the
  // persist effect to avoid echo-loops.
  const cameFromCloudRef = useRef(false);

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
      setHydrated(true);                     // ← render now, don't wait for cloud
      cameFromCloudRef.current = true;       // suppress the first persist round-trip
      const supabase = getSupabaseClient();
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session?.user) return;
        const cloudProjects = await pullQuillProjects(supabase);
        if (cancelled || !cloudProjects.length) return;
        cameFromCloudRef.current = true;     // the merge isn't a user edit
        setAllProjects((current) => mergeProjectLists(current, cloudProjects));
      } catch (e) {
        console.warn('[Quill] cloud pull failed:', e?.message || e);
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
            const results = await Promise.all(allProjects.map(async (p) => {
              try {
                const cloudId = await pushQuillProject(supabase, p, ownerId);
                return cloudId && cloudId !== p.cloudId ? { projectId: p.id, cloudId } : null;
              } catch (e) {
                console.warn('[Quill] cloud push failed for', p.title, e?.message || e);
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
      <QuillReaderView
        project={activeProject}
        chapterId={activeChapterId}
        onChangeChapter={setActiveChapterId}
        onBack={() => setView('bookDetail')}
        saveStatus={saveStatus}
        usesCustomDragRegion={usesCustomDragRegion}
        updateProject={updateActive}
      />
    );
  }

  if (view === 'bookDetail' && activeProject) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        {usesCustomDragRegion && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 1100 }} />
        )}
        <QuillBookDetail
          project={activeProject}
          saveStatus={saveStatus}
          usesCustomDragRegion={usesCustomDragRegion}
          onBackHome={() => { setView('home'); setActiveProjectId(null); }}
          onOpenChapter={(chId) => { setActiveChapterId(chId); setView('reader'); }}
          onDelete={() => deleteProject(activeProject.id)}
          onExportCsv={exportCsv}
          onExportJsx={exportJsx}
          onExportAll={exportAll}
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
        onOpen={(p) => { setActiveProjectId(p.id); setActiveChapterId(p.chapters?.[0]?.id || null); setView('bookDetail'); }}
        onNew={() => setView('setup')}
      />
    </div>
  );
}

// ===========================================================================
// Home — project list
// ===========================================================================

function QuillHomeView({ projects, onOpen, onNew }) {
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
    </div>
  );
}

// ===========================================================================
// Book detail — chapter list + export bar
// ===========================================================================

function QuillBookDetail({ project, saveStatus, usesCustomDragRegion, onBackHome, onOpenChapter, onDelete, onExportCsv, onExportJsx, onExportAll }) {
  const chapters = project.chapters || [];
  const annotationsByChapter = useMemo(() => {
    const map = new Map();
    for (const ann of project.annotations || []) {
      const key = ann.sectionId || '';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [project.annotations]);

  const annCount = project.annotations?.length || 0;
  const subtitle = `${chapters.length} chapter${chapters.length === 1 ? '' : 's'} · ${annCount} annotation${annCount === 1 ? '' : 's'}`;

  return (
    <BookDetail
      tone="quill"
      title={project.title}
      subtitle={subtitle}
      saveStatus={saveStatus}
      usesCustomDragRegion={usesCustomDragRegion}
      onBackHome={onBackHome}
      actionButtons={
        <>
          <button type="button" onClick={onExportAll} style={topBtnStyle('quill', 'solid')}>Export CSV + InDesign</button>
          <button type="button" onClick={onExportCsv} style={topBtnStyle('quill', 'outline')}>CSV only</button>
          <button type="button" onClick={onExportJsx} style={topBtnStyle('quill', 'outline')}>InDesign .jsx only</button>
        </>
      }
      onDelete={onDelete}
      deleteLabel={`Delete "${project.title}"`}
    >
      {chapters.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.82rem', padding: '1.2rem 0 0.35rem' }}>
          No chapters imported yet.
        </div>
      )}
      {chapters.map((ch) => {
        const count = annotationsByChapter.get(ch.id) || 0;
        return (
          <ChapterRow
            key={ch.id}
            tone="quill"
            number={ch.chapterNumber}
            title={ch.title}
            meta={`${count} annotation${count === 1 ? '' : 's'}`}
            onClick={() => onOpenChapter(ch.id)}
          />
        );
      })}
    </BookDetail>
  );
}

// ===========================================================================
// Reader view — word render, drag-to-highlight, annotation popover + list
// ===========================================================================

function QuillReaderView({ project, chapterId, onChangeChapter, onBack, saveStatus, usesCustomDragRegion, updateProject }) {
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
    const target = getChapterReaderWordEl(ann.wordStart);
    if (target?.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // -- per-word decoration handed to ChapterReader --------------------------
  // Annotated words get a pink underline (highlight class), a red wash
  // (image), or a tinted background (anything else with a colour).
  // useCallback so ChapterReader's render memo stays stable.
  const unitDecoration = useCallback((idx) => {
    const ann = wordToAnnotation.get(idx);
    if (!ann) return null;
    if (ann.classId === 'highlight') {
      return { borderBottom: '3px solid ' + (ann.color || '#f0aac0'), paddingBottom: 1 };
    }
    if (ann.classId === 'image') {
      return { background: '#d8282822', color: '#7a1818' };
    }
    return { background: (ann.color || QUILL.accent) + '33' };
  }, [wordToAnnotation]);

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
        paperPaddingBottom={200}
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

      {/* Bottom annotation dock — Marie wanted the list at the BOTTOM,
          not in a right-hand sidebar. Chips scroll horizontally so a
          chapter with lots of annotations still fits in a single row. */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
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
