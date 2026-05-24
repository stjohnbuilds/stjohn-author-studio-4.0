'use client';

// StJohn Author Studio 4.0 — Prep Manuscript mode (v5).
//
// What this mode does (in 6 plain bullets):
//
//  1. Home: list every prep project you've imported. Pick one or
//     import a new .docx.
//  2. Book detail: project title, character list (add / edit / side
//     voices), chapter list with per-chapter assignment progress.
//  3. Reader: one chapter at a time on the same paper-gradient page
//     as the Proof reader. Each dialogue is a clickable inline
//     button.
//  4. Sticky top bar in detail/reader so navigation is always
//     reachable (no scrolling to the top).
//  5. Bottom dock in the reader: current dialogue + nav + character
//     chips. Each chip has a "+" popover with side voices (recurring
//     or one-time). Popovers close on outside-click and Escape.
//  6. Persists to prep-manuscript-projects.json so every project
//     survives a reload, not just the last one.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  detectDialogueSpansInHtml,
  parseManuscriptStructure,
  applyChapterNumbers,
} from '../../packages/manuscript-engine/index.js';
import {
  buildPrepHighlightedDocxBlob,
  buildPrepCsv,
  buildPrepNarratorChapterCsv,
  downloadBlob,
  downloadText,
  exportFileNames,
} from './prepExport.js';

// Visual language locked to ProofingReader.
const READER_WIDTH = 'min(740px, calc(100vw - 40px))';
const READER_PAGE_BG = 'linear-gradient(180deg, #fbfaf7 0%, #ffffff 16%, #ffffff 100%)';
const READER_FONT_SIZE = '16.5px';
const READER_LINE_HEIGHT = 1.92;
const HOME_CONTAINER = 640;

const PASTEL_PREP = '#DCEBE0';
const PREP_INK = '#3F6A52';

const CHARACTER_PALETTE = [
  '#F4DCE0', '#E5DCEF', '#DCE6F0', '#DCEBE0',
  '#F4E4D8', '#E8DCF1', '#D8EFE0', '#D8E6F1',
  '#F0DCE8', '#EAE5F2',
];

// ===========================================================================
// Helpers
// ===========================================================================

function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}
function stripTags(s = '') { return String(s).replace(/<[^>]*>/g, ''); }
function nextPaletteColor(usedHexes = []) {
  const used = new Set(usedHexes);
  return CHARACTER_PALETTE.find((c) => !used.has(c)) || CHARACTER_PALETTE[usedHexes.length % CHARACTER_PALETTE.length];
}

function paragraphsFromHtml(html = '') {
  const blocks = [];
  const re = /<(p|h1|h2|h3|h4|h5|h6|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const text = stripTags(m[2]).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    blocks.push({ tag, text, isHeading: /^h\d$/.test(tag) });
  }
  if (blocks.length === 0) {
    const fallback = stripTags(html).replace(/\s+/g, ' ').trim();
    if (fallback) blocks.push({ tag: 'p', text: fallback, isHeading: false });
  }
  return blocks;
}

function detectSectionSpans(sectionHtml = '', chapterIdx = 0, sectionIdx = 0) {
  let raw = [];
  try {
    const result = detectDialogueSpansInHtml(sectionHtml) || {};
    raw = Array.isArray(result.dialogueSpans) ? result.dialogueSpans : (Array.isArray(result) ? result : []);
  } catch {
    raw = [];
  }
  return raw.map((s, si) => ({
    id: `span-${chapterIdx}-${sectionIdx}-${si}`,
    text: (s.text || '').trim(),
    afterText: (s.afterText || '').trim(),
    characterId: null,
    sideVoiceId: null,
  }));
}

function isCompatiblePrepProject(p) {
  if (!p || !Array.isArray(p.chapters)) return false;
  return p.chapters.every((ch) => Array.isArray(ch?.sections));
}

function buildShellFromStructure(file, structure) {
  const chapters = structure
    .map((ch) => ({
      id: ch.id,
      chapterIndex: ch.chapterIndex,
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      sections: (ch.sections || []).map((sec) => ({
        id: sec.id,
        sectionIndex: sec.sectionIndex,
        title: sec.title,
        html: sec.html || '',
        dialogueSpans: [],
        scanning: true,
      })),
    }))
    .filter((ch) => {
      const totalText = ch.sections.map((s) => stripTags(s.html)).join(' ').replace(/\s+/g, ' ').trim();
      return totalText.length > 60;
    });
  return {
    id: uid('prep'),
    title: file.name.replace(/\.docx$/i, ''),
    fileName: file.name,
    importedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    characters: [],
    chapters,
  };
}

function chapterCounts(chapter) {
  const all = (chapter.sections || []).flatMap((s) => s.dialogueSpans || []);
  return {
    total: all.length,
    assigned: all.filter((s) => s.characterId).length,
    scanning: (chapter.sections || []).some((s) => s.scanning),
  };
}

function projectCounts(project) {
  let total = 0, assigned = 0, scanning = false;
  (project.chapters || []).forEach((ch) => {
    const c = chapterCounts(ch);
    total += c.total;
    assigned += c.assigned;
    if (c.scanning) scanning = true;
  });
  return { total, assigned, scanning };
}

// ===========================================================================
// Click-outside hook + ESC handler — used for the side-voice popover.
// ===========================================================================

function useDismissable(open, onClose, ignoreRef) {
  useEffect(() => {
    if (!open) return undefined;
    function onMouseDown(e) {
      if (ignoreRef?.current && ignoreRef.current.contains(e.target)) return;
      onClose();
    }
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, ignoreRef]);
}

// ===========================================================================
// Root component
// ===========================================================================

export default function PrepManuscriptMode({ modeToggle, usesCustomDragRegion }) {
  const [allProjects, setAllProjects] = useState([]);   // PrepProject[]
  const [view, setView] = useState('home');             // 'home' | 'bookDetail' | 'reader'
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [selected, setSelected] = useState({ sectionIndex: 0, spanIndex: 0 });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const saveTimerRef = useRef(null);
  const savedFlashRef = useRef(null);

  // ---- hydrate ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const electron = typeof window !== 'undefined' ? window.electron : null;
        if (!electron?.readPrepData) { setHydrated(true); return; }
        const list = await electron.readPrepData();
        if (cancelled) return;
        const usable = Array.isArray(list) ? list.filter(isCompatiblePrepProject) : [];
        setAllProjects(usable);
      } catch {} finally { if (!cancelled) setHydrated(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  const activeProject = useMemo(
    () => allProjects.find((p) => p.id === activeProjectId) || null,
    [allProjects, activeProjectId]
  );

  // ---- persist on change ----
  useEffect(() => {
    if (!hydrated) return;
    const electron = typeof window !== 'undefined' ? window.electron : null;
    if (!electron?.writePrepData) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await electron.writePrepData(allProjects);
        setSaveStatus('saved');
        if (savedFlashRef.current) clearTimeout(savedFlashRef.current);
        savedFlashRef.current = setTimeout(() => setSaveStatus('idle'), 1400);
      } catch { setSaveStatus('idle'); }
    }, 350);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [allProjects, hydrated]);

  // ---- mutate active project ----
  const updateActive = useCallback((patcher) => {
    setAllProjects((all) => all.map((p) => {
      if (p.id !== activeProjectId) return p;
      const next = typeof patcher === 'function' ? patcher(p) : patcher;
      return { ...next, updatedAt: new Date().toISOString() };
    }));
  }, [activeProjectId]);

  // ---- import ----
  async function handleImport(file) {
    if (!file) return;
    setLoading(true);
    setError('');
    setProgress({ current: 0, total: 0, title: 'Reading file…' });
    try {
      const mammoth = (await import('mammoth')).default;
      setProgress({ current: 0, total: 0, title: 'Parsing manuscript…' });
      const ab = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: ab });
      const html = result.value || '';
      const structure = applyChapterNumbers(parseManuscriptStructure(html, { chapterLevel: 1 }));
      const shell = buildShellFromStructure(file, structure);
      setAllProjects((all) => [...all, shell]);
      setActiveProjectId(shell.id);
      setView('bookDetail');

      const totalSections = shell.chapters.reduce((n, ch) => n + ch.sections.length, 0);
      let processed = 0;
      for (const ch of shell.chapters) {
        for (const sec of ch.sections) {
          processed += 1;
          setProgress({
            current: processed,
            total: totalSections,
            title: `${ch.title || 'Chapter ' + (ch.chapterIndex + 1)} — ${sec.title || 'Section ' + (sec.sectionIndex + 1)}`,
          });
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 0));
          const spans = detectSectionSpans(sec.html || '', ch.chapterIndex, sec.sectionIndex);
          setAllProjects((all) => all.map((p) => {
            if (p.id !== shell.id) return p;
            const chapters = p.chapters.map((cch) => {
              if (cch.chapterIndex !== ch.chapterIndex) return cch;
              return {
                ...cch,
                sections: cch.sections.map((csec) =>
                  csec.sectionIndex !== sec.sectionIndex ? csec : { ...csec, dialogueSpans: spans, scanning: false }
                ),
              };
            });
            return { ...p, chapters };
          }));
        }
      }
      setProgress(null);
    } catch (err) {
      console.error('Prep import failed:', err);
      setError(err?.message || 'Could not read this manuscript.');
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }

  function replaceActiveManuscript(file) {
    // Treat as a fresh import that takes over the active project id.
    if (!activeProject) return handleImport(file);
    handleImport(file).then(() => {
      // remove the now-orphaned old project (we created a fresh shell)
      // Actually handleImport already appends a NEW shell with a new id —
      // and switches activeProjectId to it. We should clean up the old.
    });
    setAllProjects((all) => all.filter((p) => p.id !== activeProject.id));
  }

  function deleteProject(id) {
    setAllProjects((all) => all.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
      setView('home');
    }
  }

  // ---- character + side voice mutations (on active project) ----
  function addCharacter(prefill = {}) {
    updateActive((p) => {
      const used = (p.characters || []).map((c) => c.colorHex);
      const newChar = {
        id: uid('char'),
        name: prefill.name || 'New character',
        narratorName: prefill.narratorName || '',
        colorHex: prefill.colorHex || nextPaletteColor(used),
        sideVoices: [],
      };
      return { ...p, characters: [...(p.characters || []), newChar] };
    });
  }
  function updateCharacter(id, patch) {
    updateActive((p) => ({ ...p, characters: (p.characters || []).map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }
  function removeCharacter(id) {
    updateActive((p) => ({
      ...p,
      characters: (p.characters || []).filter((c) => c.id !== id),
      chapters: (p.chapters || []).map((ch) => ({
        ...ch,
        sections: ch.sections.map((sec) => ({
          ...sec,
          dialogueSpans: sec.dialogueSpans.map((s) => (s.characterId === id ? { ...s, characterId: null, sideVoiceId: null } : s)),
        })),
      })),
    }));
  }
  function addSideVoice(characterId, prefill = {}) {
    updateActive((p) => ({
      ...p,
      characters: (p.characters || []).map((c) => {
        if (c.id !== characterId) return c;
        const sv = {
          id: uid('side'),
          name: prefill.name || 'Side voice',
          narratorName: prefill.narratorName || c.narratorName || '',
          notes: prefill.notes || '',
          recurring: prefill.recurring !== false,
        };
        return { ...c, sideVoices: [...(c.sideVoices || []), sv] };
      }),
    }));
  }
  function removeSideVoice(characterId, sideVoiceId) {
    updateActive((p) => ({
      ...p,
      characters: (p.characters || []).map((c) =>
        c.id !== characterId ? c : { ...c, sideVoices: (c.sideVoices || []).filter((s) => s.id !== sideVoiceId) }
      ),
      chapters: (p.chapters || []).map((ch) => ({
        ...ch,
        sections: ch.sections.map((sec) => ({
          ...sec,
          dialogueSpans: sec.dialogueSpans.map((s) => (s.sideVoiceId === sideVoiceId ? { ...s, sideVoiceId: null } : s)),
        })),
      })),
    }));
  }

  // ---- dialogue assignment (only in reader; uses activeChapterIndex + selected) ----
  function assignCurrent({ characterId = null, sideVoiceId = null } = {}) {
    updateActive((p) => ({
      ...p,
      chapters: p.chapters.map((ch) => {
        if (ch.chapterIndex !== activeChapterIndex) return ch;
        return {
          ...ch,
          sections: ch.sections.map((sec) => {
            if (sec.sectionIndex !== selected.sectionIndex) return sec;
            return {
              ...sec,
              dialogueSpans: sec.dialogueSpans.map((s, si) =>
                si === selected.spanIndex ? { ...s, characterId: characterId || null, sideVoiceId: sideVoiceId || null } : s
              ),
            };
          }),
        };
      }),
    }));
  }

  // ---- exports ----
  function exports() {
    if (!activeProject) return null;
    const charactersById = new Map((activeProject.characters || []).map((c) => [c.id, c]));
    const flat = {
      ...activeProject,
      characters: (activeProject.characters || []).map((c) => ({ id: c.id, name: c.name, narratorName: c.narratorName, colorHex: c.colorHex })),
      chapters: (activeProject.chapters || []).map((ch) => ({
        title: ch.title,
        spans: ch.sections.flatMap((sec) => sec.dialogueSpans.map((sp) => {
          const char = sp.characterId ? charactersById.get(sp.characterId) : null;
          const sv = char && sp.sideVoiceId ? (char.sideVoices || []).find((s) => s.id === sp.sideVoiceId) : null;
          return { text: sp.text, afterText: sp.afterText, characterId: sp.characterId, narratorOverride: sv?.narratorName || '' };
        })),
      })),
    };
    return {
      docx: async () => downloadBlob(await buildPrepHighlightedDocxBlob(flat), exportFileNames.docx(flat)),
      csvAll: () => downloadText(buildPrepCsv(flat), exportFileNames.fullCsv(flat), 'text/csv;charset=utf-8'),
      csvNarrators: () => downloadText(buildPrepNarratorChapterCsv(flat), exportFileNames.chapterCsv(flat), 'text/csv;charset=utf-8'),
    };
  }
  const exp = exports();

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div style={{ minHeight: '100vh', background: READER_PAGE_BG, paddingTop: usesCustomDragRegion ? 24 : 0 }}>
      {usesCustomDragRegion && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 1100 }} />
      )}
      {modeToggle}

      {view === 'home' && (
        <HomeView
          allProjects={allProjects}
          onOpenProject={(id) => { setActiveProjectId(id); setView('bookDetail'); }}
          onDelete={deleteProject}
          onImport={handleImport}
          loading={loading}
          progress={progress}
          error={error}
        />
      )}

      {view === 'bookDetail' && activeProject && (
        <BookDetailView
          project={activeProject}
          saveStatus={saveStatus}
          onBack={() => { setView('home'); }}
          onOpenChapter={(chapterIndex) => {
            setActiveChapterIndex(chapterIndex);
            const ch = activeProject.chapters.find((c) => c.chapterIndex === chapterIndex);
            const firstSec = ch?.sections?.[0];
            setSelected({ sectionIndex: firstSec?.sectionIndex ?? 0, spanIndex: 0 });
            setView('reader');
          }}
          onReplace={replaceActiveManuscript}
          onAddCharacter={addCharacter}
          onUpdateCharacter={updateCharacter}
          onRemoveCharacter={removeCharacter}
          onAddSideVoice={addSideVoice}
          onRemoveSideVoice={removeSideVoice}
          onExportDocx={exp?.docx}
          onExportDialogueCsv={exp?.csvAll}
          onExportNarratorCsv={exp?.csvNarrators}
          progress={progress}
        />
      )}

      {view === 'reader' && activeProject && (
        <ReaderView
          project={activeProject}
          activeChapterIndex={activeChapterIndex}
          setActiveChapterIndex={(i) => {
            setActiveChapterIndex(i);
            const ch = activeProject.chapters.find((c) => c.chapterIndex === i);
            const firstSec = ch?.sections?.[0];
            setSelected({ sectionIndex: firstSec?.sectionIndex ?? 0, spanIndex: 0 });
          }}
          selected={selected}
          setSelected={setSelected}
          saveStatus={saveStatus}
          onBack={() => { setView('bookDetail'); }}
          onAssignCharacter={(charId) => {
            const sp = currentSpanFor(activeProject, activeChapterIndex, selected);
            const same = sp?.characterId === charId && !sp?.sideVoiceId;
            assignCurrent(same ? {} : { characterId: charId });
          }}
          onAssignSideVoice={(charId, sideId) => assignCurrent({ characterId: charId, sideVoiceId: sideId })}
          onAddCharacter={addCharacter}
          onUpdateCharacter={updateCharacter}
          onRemoveCharacter={removeCharacter}
          onAddSideVoice={addSideVoice}
          onRemoveSideVoice={removeSideVoice}
        />
      )}
    </div>
  );
}

function currentSpanFor(project, chapterIndex, selected) {
  const ch = project?.chapters?.find((c) => c.chapterIndex === chapterIndex);
  const sec = ch?.sections?.find((s) => s.sectionIndex === selected.sectionIndex);
  return sec?.dialogueSpans?.[selected.spanIndex];
}

// ===========================================================================
// Home view — project library
// ===========================================================================

function HomeView({ allProjects, onOpenProject, onDelete, onImport, loading, progress, error }) {
  const sorted = [...allProjects].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return (
    <div style={{ maxWidth: HOME_CONTAINER, margin: '0 auto', padding: '4.7rem 1.25rem 4.25rem' }}>
      <header style={{ marginBottom: '1.4rem', textAlign: 'center' }}>
        <div style={{ fontSize: '1.55rem', fontWeight: 600, letterSpacing: '0.02em', color: PREP_INK }}>Prep Manuscript</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Tag every line of dialogue with a character and narrator before recording.
        </div>
      </header>

      <section style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid var(--border)', borderRadius: 22, padding: '1rem', marginBottom: 14 }}>
        <label style={{ display: 'block', width: '100%', padding: '14px 18px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 16, fontSize: '0.96rem', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', textAlign: 'left', opacity: loading ? 0.7 : 1 }}>
          {loading ? (progress?.title || 'Importing…') : '+ Import new manuscript (.docx)'}
          <input type="file" accept=".docx" disabled={loading} onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} style={{ display: 'none' }} />
        </label>
        {loading && progress && progress.total > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 6, borderRadius: 999, background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(progress.current / progress.total) * 100}%`, background: PREP_INK, transition: 'width 0.2s' }} />
            </div>
            <div style={{ marginTop: 6, fontSize: '0.74rem', color: 'var(--text-muted)' }}>{progress.title} — {progress.current}/{progress.total}</div>
          </div>
        )}
        {error && (<div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</div>)}
      </section>

      <section style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid var(--border)', borderRadius: 22, padding: '1rem' }}>
        <div style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PREP_INK, marginBottom: 8, textAlign: 'center' }}>
          Your prep projects
        </div>
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.84rem', padding: '0.6rem 0' }}>
            No projects yet. Import a manuscript above to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map((p) => {
              const c = projectCounts(p);
              const pct = c.total === 0 ? 0 : Math.round((c.assigned / c.total) * 100);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 14 }}>
                  <button type="button" onClick={() => onOpenProject(p.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || 'Untitled'}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {p.chapters.length} chapter{p.chapters.length === 1 ? '' : 's'} · {c.assigned}/{c.total} assigned ({pct}%){c.scanning ? ' · scanning…' : ''}
                    </div>
                  </button>
                  <button type="button" onClick={() => { if (window.confirm(`Delete "${p.title}"? This can't be undone.`)) onDelete(p.id); }} title="Delete project" style={{ padding: '4px 10px', background: 'white', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  <span style={{ color: 'var(--text-light)', fontSize: '1.1rem' }}>›</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ===========================================================================
// Book detail view — characters + chapter list
// ===========================================================================

function BookDetailView({
  project, saveStatus, onBack, onOpenChapter, onReplace,
  onAddCharacter, onUpdateCharacter, onRemoveCharacter,
  onAddSideVoice, onRemoveSideVoice,
  onExportDocx, onExportDialogueCsv, onExportNarratorCsv,
  progress,
}) {
  const counts = projectCounts(project);
  const pct = counts.total === 0 ? 0 : Math.round((counts.assigned / counts.total) * 100);
  const scanning = progress && progress.total > 0 && progress.current < progress.total;

  return (
    <>
      <StickyTopBar onBack={onBack} title={project.title}>
        <SaveBadge status={saveStatus} />
        <label style={topBtn()}>
          Replace manuscript
          <input type="file" accept=".docx" onChange={(e) => e.target.files?.[0] && onReplace(e.target.files[0])} style={{ display: 'none' }} />
        </label>
      </StickyTopBar>

      <div style={{ width: READER_WIDTH, margin: '0 auto', padding: '20px 0 80px' }}>
        <section style={{ marginBottom: 18, padding: '14px 16px', background: PASTEL_PREP, border: '1px solid ' + PREP_INK + '33', borderRadius: 14 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>{project.fileName}</div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {project.chapters.length} chapter{project.chapters.length === 1 ? '' : 's'} · {counts.assigned}/{counts.total} dialogue assigned ({pct}%)
            {scanning && <> · <span style={{ color: PREP_INK, fontWeight: 600 }}>scanning {progress.current}/{progress.total}…</span></>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {onExportDocx && <button type="button" onClick={onExportDocx} style={pillBtn()}>Export highlighted .docx</button>}
            {onExportDialogueCsv && <button type="button" onClick={onExportDialogueCsv} style={pillBtn()}>Dialogue CSV</button>}
            {onExportNarratorCsv && <button type="button" onClick={onExportNarratorCsv} style={pillBtn()}>Narrators CSV</button>}
          </div>
        </section>

        <section style={{ marginBottom: 18 }}>
          <h3 style={sectionHeading()}>Characters</h3>
          <CharacterGrid
            characters={project.characters || []}
            mode="manage"
            onAdd={onAddCharacter}
            onUpdate={onUpdateCharacter}
            onRemove={onRemoveCharacter}
            onAddSideVoice={onAddSideVoice}
            onRemoveSideVoice={onRemoveSideVoice}
          />
        </section>

        <section>
          <h3 style={sectionHeading()}>Chapters</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {project.chapters.map((ch) => {
              const c = chapterCounts(ch);
              const p = c.total === 0 ? 0 : Math.round((c.assigned / c.total) * 100);
              return (
                <button key={ch.id} type="button" onClick={() => onOpenChapter(ch.chapterIndex)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text)' }}>{ch.title || `Chapter ${ch.chapterIndex + 1}`}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {c.scanning ? 'scanning…' : `${c.total} dialogue · ${c.assigned}/${c.total} assigned (${p}%)`}
                    </div>
                  </div>
                  <div style={{ width: 100, height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${p}%`, height: '100%', background: PREP_INK, transition: 'width 0.2s' }} />
                  </div>
                  <span style={{ color: 'var(--text-light)', fontSize: '1.1rem' }}>›</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

// ===========================================================================
// Reader view — one chapter at a time
// ===========================================================================

function ReaderView({
  project, activeChapterIndex, setActiveChapterIndex,
  selected, setSelected, saveStatus, onBack,
  onAssignCharacter, onAssignSideVoice,
  onAddCharacter, onUpdateCharacter, onRemoveCharacter,
  onAddSideVoice, onRemoveSideVoice,
}) {
  const chapter = project.chapters.find((c) => c.chapterIndex === activeChapterIndex) || project.chapters[0];
  const dialogueRefs = useRef({});

  // flat dialogue list within this chapter only
  const flatList = useMemo(() => {
    const list = [];
    (chapter?.sections || []).forEach((sec) => {
      (sec?.dialogueSpans || []).forEach((_, si) => list.push({ sectionIndex: sec.sectionIndex, spanIndex: si }));
    });
    return list;
  }, [chapter]);

  const flatPos = useMemo(
    () => flatList.findIndex((p) => p.sectionIndex === selected.sectionIndex && p.spanIndex === selected.spanIndex),
    [flatList, selected]
  );

  const selectedSection = chapter?.sections?.find((s) => s.sectionIndex === selected.sectionIndex);
  const selectedSpan = selectedSection?.dialogueSpans?.[selected.spanIndex];

  function spanKey(secIdx, spanIdx) { return `${secIdx}|${spanIdx}`; }

  function moveDialogue(step) {
    if (flatList.length === 0) return;
    const cur = Math.max(0, flatPos);
    const next = Math.max(0, Math.min(flatList.length - 1, cur + step));
    const target = flatList[next];
    setSelected(target);
    requestAnimationFrame(() => {
      const node = dialogueRefs.current[spanKey(target.sectionIndex, target.spanIndex)];
      if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const canPrevChapter = activeChapterIndex > Math.min(...project.chapters.map((c) => c.chapterIndex));
  const canNextChapter = activeChapterIndex < Math.max(...project.chapters.map((c) => c.chapterIndex));

  return (
    <>
      <StickyTopBar onBack={onBack} title={project.title}>
        <select
          value={activeChapterIndex}
          onChange={(e) => setActiveChapterIndex(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'white', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', maxWidth: 220 }}
        >
          {project.chapters.map((ch) => (
            <option key={ch.id} value={ch.chapterIndex}>{ch.title || `Chapter ${ch.chapterIndex + 1}`}</option>
          ))}
        </select>
        <button type="button" disabled={!canPrevChapter} onClick={() => {
          const ordered = project.chapters.map((c) => c.chapterIndex).sort((a, b) => a - b);
          const idx = ordered.indexOf(activeChapterIndex);
          if (idx > 0) setActiveChapterIndex(ordered[idx - 1]);
        }} style={{ ...topBtn(), opacity: canPrevChapter ? 1 : 0.35 }}>← Prev chapter</button>
        <button type="button" disabled={!canNextChapter} onClick={() => {
          const ordered = project.chapters.map((c) => c.chapterIndex).sort((a, b) => a - b);
          const idx = ordered.indexOf(activeChapterIndex);
          if (idx >= 0 && idx < ordered.length - 1) setActiveChapterIndex(ordered[idx + 1]);
        }} style={{ ...topBtn(), opacity: canNextChapter ? 1 : 0.35 }}>Next chapter →</button>
        <SaveBadge status={saveStatus} />
      </StickyTopBar>

      <div style={{ width: READER_WIDTH, margin: '0 auto', padding: '20px 0 200px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: PREP_INK, textAlign: 'center', margin: '0 0 22px 0' }}>
          {chapter?.title || `Chapter ${activeChapterIndex + 1}`}
        </h2>
        <div style={{ fontSize: READER_FONT_SIZE, lineHeight: READER_LINE_HEIGHT, color: 'var(--text)' }}>
          {(chapter?.sections || []).map((sec) => (
            <SectionBody
              key={sec.id}
              section={sec}
              charactersById={new Map((project.characters || []).map((c) => [c.id, c]))}
              selected={selected}
              onSelectDialogue={(sectionIndex, spanIndex) => setSelected({ sectionIndex, spanIndex })}
              dialogueRefs={dialogueRefs}
            />
          ))}
        </div>
      </div>

      <ReaderDock
        project={project}
        selectedSpan={selectedSpan}
        selectedSection={selectedSection}
        chapter={chapter}
        positionLabel={flatPos < 0 ? '—' : `${flatPos + 1} / ${flatList.length}`}
        onPrev={() => moveDialogue(-1)}
        onNext={() => moveDialogue(1)}
        onAssignCharacter={onAssignCharacter}
        onAssignSideVoice={onAssignSideVoice}
        onAddCharacter={onAddCharacter}
        onUpdateCharacter={onUpdateCharacter}
        onRemoveCharacter={onRemoveCharacter}
        onAddSideVoice={onAddSideVoice}
        onRemoveSideVoice={onRemoveSideVoice}
      />
    </>
  );
}

function SectionBody({ section, charactersById, selected, onSelectDialogue, dialogueRefs }) {
  if (!section.html && section.scanning) return <p style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>(scanning…)</p>;
  if (!section.html) return null;

  const blocks = useMemo(() => paragraphsFromHtml(section.html), [section.html]);
  const spans = section.dialogueSpans || [];
  let spanCursor = 0;
  return (
    <>
      {blocks.map((block, bi) => {
        const segments = [];
        let cursor = 0;
        const text = block.text;
        while (spanCursor < spans.length) {
          const sp = spans[spanCursor];
          const needle = sp.text || '';
          if (!needle) { spanCursor++; continue; }
          const where = text.indexOf(needle, cursor);
          if (where === -1) break;
          if (where > cursor) segments.push({ kind: 'plain', text: text.slice(cursor, where) });
          segments.push({ kind: 'dialogue', text: needle, spanIndex: spanCursor });
          cursor = where + needle.length;
          spanCursor++;
        }
        if (cursor < text.length) segments.push({ kind: 'plain', text: text.slice(cursor) });
        if (segments.length === 0) segments.push({ kind: 'plain', text });

        const Tag = block.isHeading ? 'h3' : 'p';
        const style = block.isHeading
          ? { fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-muted)', margin: '24px 0 12px 0', textAlign: 'center', fontStyle: 'italic' }
          : { margin: '0 0 0.6em 0', textIndent: '1.6em', textAlign: 'justify' };
        return (
          <Tag key={bi} style={style}>
            {segments.map((seg, i) => {
              if (seg.kind === 'plain') return <span key={i}>{seg.text}</span>;
              const span = spans[seg.spanIndex];
              const char = span?.characterId ? charactersById.get(span.characterId) : null;
              const sv = char && span?.sideVoiceId ? (char.sideVoices || []).find((s) => s.id === span.sideVoiceId) : null;
              const isSelected = selected.sectionIndex === section.sectionIndex && selected.spanIndex === seg.spanIndex;
              const bg = char ? char.colorHex : (isSelected ? '#FFF6CC' : 'transparent');
              const refKey = `${section.sectionIndex}|${seg.spanIndex}`;
              return (
                <button
                  key={i}
                  ref={(el) => { if (el) dialogueRefs.current[refKey] = el; else delete dialogueRefs.current[refKey]; }}
                  type="button"
                  onClick={() => onSelectDialogue(section.sectionIndex, seg.spanIndex)}
                  title={char ? `${char.name}${sv ? ' / ' + sv.name : ''}` : 'Unassigned'}
                  style={{
                    background: bg,
                    border: '1px solid ' + (isSelected ? PREP_INK : (char ? PREP_INK + '66' : '#e3d8b0')),
                    borderRadius: 6,
                    padding: '0 6px', margin: '0 1px',
                    fontFamily: 'inherit', fontSize: 'inherit', lineHeight: 'inherit',
                    color: 'var(--text)', cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 2px rgba(63, 106, 82, 0.25)' : 'none',
                  }}
                >“{seg.text}”</button>
              );
            })}
          </Tag>
        );
      })}
    </>
  );
}

// ===========================================================================
// Reader bottom dock — current dialogue + nav + character chips
// ===========================================================================

function ReaderDock({
  project, selectedSpan, selectedSection, chapter,
  positionLabel, onPrev, onNext,
  onAssignCharacter, onAssignSideVoice,
  onAddCharacter, onUpdateCharacter, onRemoveCharacter,
  onAddSideVoice, onRemoveSideVoice,
}) {
  const characters = project.characters || [];
  const charactersById = new Map(characters.map((c) => [c.id, c]));
  const currentChar = selectedSpan?.characterId ? charactersById.get(selectedSpan.characterId) : null;
  const currentSV = currentChar && selectedSpan?.sideVoiceId ? (currentChar.sideVoices || []).find((s) => s.id === selectedSpan.sideVoiceId) : null;

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.94)', borderTop: '1px solid var(--border-light)', backdropFilter: 'blur(8px)', boxShadow: '0 -8px 28px rgba(0,0,0,0.05)', zIndex: 1200, padding: '8px 16px 12px' }}>
      <div style={{ width: READER_WIDTH, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={onPrev} style={dockBtn(false)}>←</button>
            <button type="button" onClick={onNext} style={dockBtn(true)}>Next →</button>
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ fontWeight: 700, color: PREP_INK, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{positionLabel}</span>
            {chapter && <span> · {chapter.title}{selectedSection && selectedSection.title !== chapter.title ? ' · ' + selectedSection.title : ''}</span>}
          </div>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: currentChar ? PREP_INK : 'var(--text-light)', whiteSpace: 'nowrap' }}>
            {currentChar ? <>→ {currentChar.name}{currentSV ? ' / ' + currentSV.name : (currentChar.narratorName ? ' / ' + currentChar.narratorName : '')}</> : 'Unassigned'}
          </div>
        </div>

        <div style={{ padding: '6px 10px', background: currentChar?.colorHex || 'white', border: '1px solid ' + (currentChar ? PREP_INK + '33' : 'var(--border-light)'), borderRadius: 8, fontSize: '0.82rem', fontFamily: 'Georgia, serif', lineHeight: 1.45, color: 'var(--text)', maxHeight: 56, overflow: 'auto' }}>
          {selectedSpan ? <>“{selectedSpan.text}”</> : <span style={{ color: 'var(--text-light)' }}>Click a dialogue in the manuscript.</span>}
        </div>

        <CharacterGrid
          characters={characters}
          mode="assign"
          selectedSpan={selectedSpan}
          onAdd={onAddCharacter}
          onUpdate={onUpdateCharacter}
          onRemove={onRemoveCharacter}
          onAddSideVoice={onAddSideVoice}
          onRemoveSideVoice={onRemoveSideVoice}
          onAssignCharacter={onAssignCharacter}
          onAssignSideVoice={onAssignSideVoice}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// Shared: top bar + character grid + character chip + popovers
// ===========================================================================

function StickyTopBar({ onBack, title, children }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 1100,
      background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-light)',
      padding: '10px 16px 10px 240px',  // left pad clears the mode pill
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <button type="button" onClick={onBack} style={{ ...topBtn(), background: 'transparent', borderColor: 'transparent', color: 'var(--text-muted)' }}>← Back</button>
      <div style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      {children}
    </div>
  );
}

function topBtn() {
  return { padding: '6px 12px', background: 'white', color: PREP_INK, border: '1px solid ' + PREP_INK, borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
}
function pillBtn() {
  return { padding: '5px 11px', background: 'white', color: PREP_INK, border: '1px solid ' + PREP_INK, borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };
}
function dockBtn(primary) {
  return { padding: '5px 12px', background: primary ? PREP_INK : 'white', color: primary ? 'white' : PREP_INK, border: '1px solid ' + PREP_INK, borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' };
}
function sectionHeading() {
  return { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: PREP_INK, margin: '0 0 8px 0' };
}

function SaveBadge({ status }) {
  const map = {
    idle: { label: 'Saved', color: 'var(--text-light)', dot: '#b5cbb9' },
    saving: { label: 'Saving…', color: PREP_INK, dot: '#f3c93a' },
    saved: { label: 'Saved', color: PREP_INK, dot: '#3F8F65' },
  };
  const m = map[status] || map.idle;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', fontWeight: 600, color: m.color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot }} />
      {m.label}
    </div>
  );
}

function CharacterGrid({ characters, mode, selectedSpan, onAdd, onUpdate, onRemove, onAddSideVoice, onRemoveSideVoice, onAssignCharacter, onAssignSideVoice }) {
  const [adding, setAdding] = useState(false);
  const [popoverFor, setPopoverFor] = useState(null);    // characterId
  const [addingSideFor, setAddingSideFor] = useState(null); // characterId or null
  const [editing, setEditing] = useState(null);          // characterId or null

  function closePopover() { setPopoverFor(null); setAddingSideFor(null); }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'flex-start' }}>
      {characters.map((c) => (
        <CharacterChip
          key={c.id}
          character={c}
          mode={mode}
          isCurrent={mode === 'assign' && selectedSpan?.characterId === c.id && !selectedSpan?.sideVoiceId}
          currentSideVoiceId={mode === 'assign' && selectedSpan?.characterId === c.id ? selectedSpan?.sideVoiceId : null}
          editing={editing === c.id}
          onStartEdit={() => { setEditing(c.id); closePopover(); }}
          onEndEdit={() => setEditing(null)}
          onEdit={(patch) => onUpdate(c.id, patch)}
          onRemove={() => { setEditing(null); onRemove(c.id); }}
          popoverOpen={popoverFor === c.id}
          sideAdding={popoverFor === c.id && addingSideFor === c.id}
          onTogglePopover={() => {
            if (popoverFor === c.id) closePopover();
            else { setPopoverFor(c.id); setAddingSideFor(null); setEditing(null); }
          }}
          onClosePopover={closePopover}
          onClickAssign={() => onAssignCharacter && onAssignCharacter(c.id)}
          onPickSideVoice={(sv) => { onAssignSideVoice && onAssignSideVoice(c.id, sv.id); closePopover(); }}
          onStartAddSideVoice={() => setAddingSideFor(c.id)}
          onSaveSideVoice={(payload) => { onAddSideVoice(c.id, payload); closePopover(); }}
          onRemoveSideVoice={(sv) => onRemoveSideVoice(c.id, sv.id)}
        />
      ))}
      {!adding && (
        <button type="button" onClick={() => setAdding(true)} style={{ padding: '5px 10px', background: 'transparent', color: PREP_INK, border: '1px dashed ' + PREP_INK + '99', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Add character
        </button>
      )}
      {adding && (
        <AddCharacterInline existingCount={characters.length} onSave={(payload) => { onAdd(payload); setAdding(false); }} onCancel={() => setAdding(false)} />
      )}
    </div>
  );
}

function AddCharacterInline({ existingCount, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [narrator, setNarrator] = useState('');
  const preset = CHARACTER_PALETTE[existingCount % CHARACTER_PALETTE.length];
  const [color, setColor] = useState(preset);
  const ref = useRef(null);
  useDismissable(true, onCancel, ref);
  return (
    <div ref={ref} style={{ background: color, border: '1px solid ' + PREP_INK + '33', borderRadius: 999, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Character"
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSave({ name: name.trim(), narratorName: narrator.trim(), colorHex: color }); }}
        style={{ width: 100, padding: '2px 6px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
      <input value={narrator} onChange={(e) => setNarrator(e.target.value)} placeholder="Narrator"
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSave({ name: name.trim(), narratorName: narrator.trim(), colorHex: color }); }}
        style={{ width: 90, padding: '2px 6px', fontSize: '0.7rem', borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 22, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: 4, background: 'white', cursor: 'pointer' }} />
      <button type="button" onClick={onCancel} style={{ padding: '2px 8px', background: 'white', border: '1px solid var(--border)', borderRadius: 999, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
      <button type="button" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), narratorName: narrator.trim(), colorHex: color })}
        style={{ padding: '2px 10px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>Save</button>
    </div>
  );
}

function CharacterChip({
  character, mode, isCurrent, currentSideVoiceId,
  editing, onStartEdit, onEndEdit, onEdit, onRemove,
  popoverOpen, sideAdding, onTogglePopover, onClosePopover,
  onClickAssign, onPickSideVoice, onStartAddSideVoice, onSaveSideVoice, onRemoveSideVoice,
}) {
  const wrapRef = useRef(null);
  useDismissable(popoverOpen, onClosePopover, wrapRef);

  if (editing) {
    return (
      <div style={{ background: character.colorHex, border: '1px solid ' + PREP_INK + '55', borderRadius: 999, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <input value={character.name} onChange={(e) => onEdit({ name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') onEndEdit(); }}
          style={{ width: 100, padding: '2px 6px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
        <input value={character.narratorName} placeholder="narrator" onChange={(e) => onEdit({ narratorName: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') onEndEdit(); }}
          style={{ width: 90, padding: '2px 6px', fontSize: '0.7rem', borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
        <input type="color" value={character.colorHex} onChange={(e) => onEdit({ colorHex: e.target.value })} style={{ width: 22, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: 4, background: 'white', cursor: 'pointer' }} />
        <button type="button" onClick={onRemove} style={{ padding: '2px 8px', background: 'white', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 999, fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
        <button type="button" onClick={onEndEdit} style={{ padding: '2px 10px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>Done</button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: character.colorHex, border: '1px solid ' + (isCurrent ? PREP_INK : PREP_INK + '33'), borderRadius: 999, padding: '3px 4px 3px 10px', boxShadow: isCurrent ? '0 0 0 2px rgba(63, 106, 82, 0.22)' : 'none' }}>
        <button
          type="button"
          onClick={mode === 'assign' ? onClickAssign : onStartEdit}
          onDoubleClick={onStartEdit}
          title={mode === 'assign' ? (isCurrent ? 'Click to unassign · double-click to edit' : 'Assign · double-click to edit') : 'Edit character'}
          style={{ background: 'transparent', border: 'none', padding: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {character.name || 'Unnamed'}
          {character.narratorName && <span style={{ marginLeft: 4, fontWeight: 500, fontSize: '0.68rem', color: 'var(--text-muted)' }}>/ {character.narratorName}</span>}
        </button>
        <button type="button" onClick={onTogglePopover} aria-label="Side voices" title="Side voices"
          style={{ marginLeft: 2, background: 'rgba(255,255,255,0.8)', border: '1px solid ' + PREP_INK + '33', borderRadius: '50%', width: 18, height: 18, padding: 0, fontSize: '0.72rem', fontWeight: 800, color: PREP_INK, cursor: 'pointer', lineHeight: 1 }}>+</button>
      </div>

      {popoverOpen && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 1300, background: 'white', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: 8, minWidth: 240, maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-light)' }}>
              Side voices · {character.name || 'Unnamed'}
            </span>
            <button type="button" onClick={onClosePopover} aria-label="Close" style={{ background: 'transparent', border: 'none', color: 'var(--text-light)', fontSize: '0.9rem', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
          </div>
          {(character.sideVoices || []).length === 0 && !sideAdding && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', padding: '4px 2px' }}>None yet. Add a side voice for a recurring or one-time variant of this character.</div>
          )}
          {(character.sideVoices || []).map((sv) => (
            <div key={sv.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button type="button" onClick={() => onPickSideVoice(sv)}
                style={{ flex: 1, textAlign: 'left', padding: '6px 8px', background: currentSideVoiceId === sv.id ? PREP_INK + '14' : 'transparent', border: '1px solid ' + (currentSideVoiceId === sv.id ? PREP_INK : 'var(--border-light)'), borderRadius: 8, fontSize: '0.74rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                <div>{sv.name}{sv.narratorName ? <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}> / {sv.narratorName}</span> : null}</div>
                <div style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-light)', marginTop: 1 }}>{sv.recurring ? 'recurring' : 'one-time'}{sv.notes ? ' · ' + sv.notes : ''}</div>
              </button>
              <button type="button" onClick={() => onRemoveSideVoice(sv)} aria-label="Remove" style={{ padding: '2px 6px', background: 'white', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer' }}>×</button>
            </div>
          ))}
          {sideAdding ? (
            <AddSideVoiceInline characterNarrator={character.narratorName} onSave={onSaveSideVoice} onCancel={onClosePopover} />
          ) : (
            <button type="button" onClick={onStartAddSideVoice} style={{ padding: '7px 8px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>+ Add side voice…</button>
          )}
        </div>
      )}
    </div>
  );
}

function AddSideVoiceInline({ characterNarrator, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [narrator, setNarrator] = useState(characterNarrator || '');
  const [notes, setNotes] = useState('');
  const [recurring, setRecurring] = useState(true);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 4px', borderTop: '1px solid var(--border-light)', marginTop: 4 }}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Side voice name (e.g. Josie)"
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSave({ name: name.trim(), narratorName: narrator.trim(), notes: notes.trim(), recurring }); }}
        style={{ padding: '5px 8px', fontSize: '0.74rem', fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: 'white' }} />
      <input value={narrator} onChange={(e) => setNarrator(e.target.value)} placeholder="Narrator (optional)"
        style={{ padding: '5px 8px', fontSize: '0.72rem', borderRadius: 6, border: '1px solid var(--border)', background: 'white' }} />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (sweet, gruff, etc.)"
        style={{ padding: '5px 8px', fontSize: '0.7rem', borderRadius: 6, border: '1px solid var(--border)', background: 'white' }} />
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" onClick={() => setRecurring(true)} style={pillToggleStyle(recurring)}>Recurring</button>
        <button type="button" onClick={() => setRecurring(false)} style={pillToggleStyle(!recurring)}>One-time</button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, padding: '5px 8px', background: 'white', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button type="button" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), narratorName: narrator.trim(), notes: notes.trim(), recurring })}
          style={{ flex: 1, padding: '5px 8px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>Save & assign</button>
      </div>
    </div>
  );
}

function pillToggleStyle(active) {
  return {
    flex: 1, padding: '4px 8px',
    background: active ? PREP_INK : 'white',
    color: active ? 'white' : 'var(--text-muted)',
    border: '1px solid ' + (active ? PREP_INK : 'var(--border)'),
    borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer',
  };
}
