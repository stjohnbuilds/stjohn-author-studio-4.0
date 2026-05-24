'use client';

// StJohn Author Studio 4.0 — Prep Manuscript mode (v3 layout).
//
// Rebuilt to match Marie's 2.0 design after she said v2 was wrong:
//
//   - Centered container on the home / empty state (matches the proof
//     home width, ~640px).
//   - When a project is loaded: a reader-page-style article fills the
//     main column (Kindle-style serif on white card), with each
//     detected dialogue line rendered inline as a clickable button.
//   - A sticky BOTTOM panel (not a right sidebar) follows you down
//     the page. It shows the current dialogue, a grid of characters
//     (click to assign), narrator override, and Prev / Next dialogue.
//   - Chapter detection uses parseManuscriptStructure from the shared
//     manuscript-engine (chapterLevel: 1) instead of a naive h1/h2
//     split. A 24-chapter novel returns 24 chapters, not 171.
//   - Progressive import: project shell appears immediately, chapters
//     fill in one at a time with a real progress bar so you can start
//     assigning before the whole book has finished scanning.

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const PASTEL_PREP = '#DCEBE0';
const PREP_INK = '#3F6A52';
const CONTENT_MAX = 760;          // tight reading column like the proof reader
const HOME_CONTAINER = 640;       // matches the proof home

const CHARACTER_PALETTE = [
  '#F4DCE0', '#E5DCEF', '#DCE6F0', '#DCEBE0',
  '#F4E4D8', '#E8DCF1', '#D8EFE0', '#D8E6F1',
  '#F0DCE8', '#EAE5F2',
];

function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
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
    narratorOverride: '',
  }));
}

function nextPaletteColor(usedHexes = []) {
  const used = new Set(usedHexes);
  return CHARACTER_PALETTE.find((c) => !used.has(c)) || CHARACTER_PALETTE[usedHexes.length % CHARACTER_PALETTE.length];
}

function buildShellFromStructure(file, structure) {
  return {
    id: uid('prep'),
    title: file.name.replace(/\.docx$/i, ''),
    fileName: file.name,
    importedAt: new Date().toISOString(),
    characters: [],
    chapters: structure.map((ch) => ({
      id: ch.id,
      chapterIndex: ch.chapterIndex,
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      sections: (ch.sections || []).map((sec) => ({
        id: sec.id,
        sectionIndex: sec.sectionIndex,
        title: sec.title,
        plainText: sec.plainText || '',
        dialogueSpans: [],
        scanning: true,
      })),
    })),
  };
}

function restoreAssignments(oldProject, freshChapters) {
  if (!oldProject) return freshChapters;
  // Match by (chapterIndex, sectionIndex, spanIndex, text). If text
  // matches at the same position, carry over the previous assignment.
  const oldByKey = new Map();
  (oldProject.chapters || []).forEach((ch) => {
    (ch.sections || []).forEach((sec) => {
      (sec.dialogueSpans || []).forEach((sp, si) => {
        const k = `${ch.chapterIndex}|${sec.sectionIndex}|${si}|${sp.text}`;
        oldByKey.set(k, { characterId: sp.characterId, narratorOverride: sp.narratorOverride });
      });
    });
  });
  return freshChapters.map((ch) => ({
    ...ch,
    sections: ch.sections.map((sec) => ({
      ...sec,
      dialogueSpans: sec.dialogueSpans.map((sp, si) => {
        const k = `${ch.chapterIndex}|${sec.sectionIndex}|${si}|${sp.text}`;
        const prev = oldByKey.get(k);
        return prev ? { ...sp, characterId: prev.characterId || null, narratorOverride: prev.narratorOverride || '' } : sp;
      }),
    })),
  }));
}

export default function PrepManuscriptMode({ modeToggle, usesCustomDragRegion }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);   // { current, total, title }
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState({ chapterIndex: 0, sectionIndex: 0, spanIndex: 0 });
  const [addingChar, setAddingChar] = useState(false);
  const [showCharGrid, setShowCharGrid] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle');
  const saveTimerRef = useRef(null);
  const savedFlashRef = useRef(null);

  // Hydrate from Save Data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const electron = typeof window !== 'undefined' ? window.electron : null;
        if (!electron?.readPrepData) { setHydrated(true); return; }
        const list = await electron.readPrepData();
        if (cancelled) return;
        if (Array.isArray(list) && list.length > 0) setProject(list[list.length - 1]);
      } catch {} finally { if (!cancelled) setHydrated(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist with visible status badge
  useEffect(() => {
    if (!hydrated || !project) return;
    const electron = typeof window !== 'undefined' ? window.electron : null;
    if (!electron?.writePrepData) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await electron.writePrepData([project]);
        setSaveStatus('saved');
        if (savedFlashRef.current) clearTimeout(savedFlashRef.current);
        savedFlashRef.current = setTimeout(() => setSaveStatus('idle'), 1400);
      } catch { setSaveStatus('idle'); }
    }, 350);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [project, hydrated]);

  const charactersById = useMemo(() => {
    const map = new Map();
    (project?.characters || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [project]);

  // Flat dialogue index for prev/next.
  const dialogueIndex = useMemo(() => {
    const list = [];
    (project?.chapters || []).forEach((ch) => {
      (ch.sections || []).forEach((sec) => {
        (sec.dialogueSpans || []).forEach((_, si) => {
          list.push({ chapterIndex: ch.chapterIndex, sectionIndex: sec.sectionIndex, spanIndex: si });
        });
      });
    });
    return list;
  }, [project]);
  const flatPos = useMemo(
    () => dialogueIndex.findIndex((p) => p.chapterIndex === selected.chapterIndex && p.sectionIndex === selected.sectionIndex && p.spanIndex === selected.spanIndex),
    [dialogueIndex, selected]
  );
  const totalDialogue = dialogueIndex.length;
  const totalAssigned = useMemo(
    () => (project?.chapters || []).reduce((n, ch) => n + ch.sections.reduce((m, sec) => m + sec.dialogueSpans.filter((s) => s.characterId).length, 0), 0),
    [project]
  );

  function selectDialogue(chapterIndex, sectionIndex, spanIndex) {
    setSelected({ chapterIndex, sectionIndex, spanIndex });
  }
  function moveDialogue(step) {
    if (dialogueIndex.length === 0) return;
    const cur = Math.max(0, flatPos);
    const next = Math.max(0, Math.min(dialogueIndex.length - 1, cur + step));
    setSelected(dialogueIndex[next]);
  }

  // Resolve helpers
  const selectedChapter = project?.chapters?.find((c) => c.chapterIndex === selected.chapterIndex);
  const selectedSection = selectedChapter?.sections?.find((s) => s.sectionIndex === selected.sectionIndex);
  const selectedSpan = selectedSection?.dialogueSpans?.[selected.spanIndex];

  async function handleFile(file) {
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

      // Real chapter/section structure — chapters from h1, sections from h2.
      const structure = applyChapterNumbers(parseManuscriptStructure(html, { chapterLevel: 1 }));
      const totalSections = structure.reduce((n, ch) => n + (ch.sections?.length || 0), 0);
      setProgress({ current: 0, total: totalSections, title: 'Scanning…' });

      const oldProject = project;
      const shell = buildShellFromStructure(file, structure);
      setProject(shell);
      setSelected({ chapterIndex: 0, sectionIndex: 0, spanIndex: 0 });

      // Stream dialogue detection per section so the UI stays responsive
      // and the user can start assigning while later chapters are still
      // being scanned.
      let processed = 0;
      for (const ch of structure) {
        for (const sec of (ch.sections || [])) {
          processed += 1;
          setProgress({
            current: processed,
            total: totalSections,
            title: `${ch.title || 'Chapter ' + (ch.chapterIndex + 1)} — ${sec.title || 'Section ' + (sec.sectionIndex + 1)}`,
          });
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 0));
          const spans = detectSectionSpans(sec.html || '', ch.chapterIndex, sec.sectionIndex);
          setProject((cur) => {
            if (!cur) return cur;
            const nextChapters = cur.chapters.map((cch) => {
              if (cch.chapterIndex !== ch.chapterIndex) return cch;
              return {
                ...cch,
                sections: cch.sections.map((csec) => {
                  if (csec.sectionIndex !== sec.sectionIndex) return csec;
                  return { ...csec, dialogueSpans: spans, scanning: false };
                }),
              };
            });
            const restored = oldProject ? restoreAssignments(oldProject, nextChapters) : nextChapters;
            return { ...cur, chapters: restored };
          });
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

  function addCharacter(prefill = {}) {
    setProject((p) => {
      if (!p) return p;
      const used = (p.characters || []).map((c) => c.colorHex);
      const newChar = {
        id: uid('char'),
        name: prefill.name || '',
        narratorName: prefill.narratorName || '',
        colorHex: prefill.colorHex || nextPaletteColor(used),
      };
      return { ...p, characters: [...(p.characters || []), newChar] };
    });
    setAddingChar(false);
  }
  function updateCharacter(id, patch) {
    setProject((p) => p && ({ ...p, characters: (p.characters || []).map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }
  function removeCharacter(id) {
    setProject((p) => p && ({
      ...p,
      characters: (p.characters || []).filter((c) => c.id !== id),
      chapters: (p.chapters || []).map((ch) => ({
        ...ch,
        sections: ch.sections.map((sec) => ({
          ...sec,
          dialogueSpans: sec.dialogueSpans.map((s) => (s.characterId === id ? { ...s, characterId: null } : s)),
        })),
      })),
    }));
  }
  function assignCurrent(characterId) {
    setProject((p) => {
      if (!p) return p;
      const chapters = p.chapters.map((ch) => {
        if (ch.chapterIndex !== selected.chapterIndex) return ch;
        return {
          ...ch,
          sections: ch.sections.map((sec) => {
            if (sec.sectionIndex !== selected.sectionIndex) return sec;
            return {
              ...sec,
              dialogueSpans: sec.dialogueSpans.map((s, si) =>
                si === selected.spanIndex ? { ...s, characterId: characterId || null } : s
              ),
            };
          }),
        };
      });
      return { ...p, chapters };
    });
  }
  function setNarratorOverride(value) {
    setProject((p) => {
      if (!p) return p;
      const chapters = p.chapters.map((ch) => {
        if (ch.chapterIndex !== selected.chapterIndex) return ch;
        return {
          ...ch,
          sections: ch.sections.map((sec) => {
            if (sec.sectionIndex !== selected.sectionIndex) return sec;
            return {
              ...sec,
              dialogueSpans: sec.dialogueSpans.map((s, si) =>
                si === selected.spanIndex ? { ...s, narratorOverride: value } : s
              ),
            };
          }),
        };
      });
      return { ...p, chapters };
    });
  }

  async function exportHighlightedDocx() {
    if (!project) return;
    try {
      const flat = flattenProjectForExport(project);
      const blob = await buildPrepHighlightedDocxBlob(flat);
      downloadBlob(blob, exportFileNames.docx(flat));
    } catch (e) { setError(e?.message || 'Could not export highlighted .docx'); }
  }
  function exportDialogueCsv() {
    if (!project) return;
    const flat = flattenProjectForExport(project);
    downloadText(buildPrepCsv(flat), exportFileNames.fullCsv(flat), 'text/csv;charset=utf-8');
  }
  function exportNarratorChapterCsv() {
    if (!project) return;
    const flat = flattenProjectForExport(project);
    downloadText(buildPrepNarratorChapterCsv(flat), exportFileNames.chapterCsv(flat), 'text/csv;charset=utf-8');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {usesCustomDragRegion && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 1100 }} />
      )}
      {modeToggle}

      {!project && (
        <div style={{ maxWidth: HOME_CONTAINER, margin: '0 auto', padding: '4.7rem 1.25rem 4.25rem' }}>
          <header style={{ marginBottom: '1.4rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.55rem', fontWeight: 600, letterSpacing: '0.02em', color: PREP_INK }}>Prep Manuscript</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Import a Word manuscript. Every line of dialogue is detected so you can assign characters before recording.</div>
          </header>
          <ImportEmptyState onPick={handleFile} loading={loading} progress={progress} error={error} />
        </div>
      )}

      {project && (
        <>
          <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto', padding: '88px 24px 200px' }}>
            <ProjectHeader
              project={project}
              totalDialogue={totalDialogue}
              totalAssigned={totalAssigned}
              onReplace={handleFile}
              progress={progress}
              saveStatus={saveStatus}
            />
            <ExportToolbar
              onDocx={exportHighlightedDocx}
              onDialogueCsv={exportDialogueCsv}
              onNarratorCsv={exportNarratorChapterCsv}
              hasCharacters={(project.characters || []).length > 0}
            />
            {error && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 8, color: 'var(--danger)', fontSize: '0.78rem' }}>{error}</div>
            )}
            <ReaderPage
              project={project}
              charactersById={charactersById}
              selected={selected}
              onSelectDialogue={selectDialogue}
            />
          </div>

          <AssignmentDock
            project={project}
            charactersById={charactersById}
            selectedSpan={selectedSpan}
            selectedChapter={selectedChapter}
            selectedSection={selectedSection}
            positionLabel={flatPos < 0 ? '—' : `${flatPos + 1} / ${dialogueIndex.length}`}
            onPrev={() => moveDialogue(-1)}
            onNext={() => moveDialogue(1)}
            onAssign={assignCurrent}
            onNarratorOverride={setNarratorOverride}
            onAddCharacter={addCharacter}
            onUpdateCharacter={updateCharacter}
            onRemoveCharacter={removeCharacter}
            addingChar={addingChar}
            setAddingChar={setAddingChar}
            showCharGrid={showCharGrid}
            setShowCharGrid={setShowCharGrid}
          />
        </>
      )}
    </div>
  );
}

// Flatten the chapter/section tree into the shape prepExport.js expects
// (chapters with flat spans). Keeps exports working unchanged.
function flattenProjectForExport(project) {
  return {
    ...project,
    chapters: (project.chapters || []).map((ch) => ({
      title: ch.title,
      spans: ch.sections.flatMap((sec) => sec.dialogueSpans),
    })),
  };
}

function ImportEmptyState({ onPick, loading, progress, error }) {
  const label = progress && progress.total > 0 ? `${progress.title} — ${progress.current}/${progress.total}` : (progress?.title || '');
  return (
    <section
      style={{
        padding: '28px 24px',
        background: PASTEL_PREP,
        border: '1px solid ' + PREP_INK + '33',
        borderRadius: 22,
        color: 'var(--text)',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 10 }}>No manuscript yet</div>
      <div style={{ fontSize: '0.85rem', lineHeight: 1.55, color: 'var(--text-muted)', marginBottom: 16 }}>
        Pick a .docx file. The app will scan for dialogue automatically — you don&apos;t have to do anything else.
      </div>
      <label style={{ display: 'inline-block', padding: '13px 22px', background: PREP_INK, color: 'white', fontSize: '0.86rem', fontWeight: 700, borderRadius: 14, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
        {loading ? (label || 'Reading…') : 'Import manuscript (.docx)'}
        <input type="file" accept=".docx" disabled={loading} onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} style={{ display: 'none' }} />
      </label>
      {loading && progress && progress.total > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.6)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(progress.current / progress.total) * 100}%`, background: PREP_INK, transition: 'width 0.2s' }} />
          </div>
          <div style={{ marginTop: 8, fontSize: '0.76rem', color: 'var(--text-muted)' }}>{label}</div>
        </div>
      )}
      {error && (<div style={{ marginTop: 14, fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</div>)}
    </section>
  );
}

function ProjectHeader({ project, totalDialogue, totalAssigned, onReplace, progress, saveStatus }) {
  const pct = totalDialogue === 0 ? 0 : Math.round((totalAssigned / totalDialogue) * 100);
  const scanning = progress && progress.total > 0 && progress.current < progress.total;
  return (
    <section style={{ marginBottom: 12, padding: '10px 14px', background: PASTEL_PREP, border: '1px solid ' + PREP_INK + '33', borderRadius: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all' }}>{project.fileName}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {project.chapters.length} chapter{project.chapters.length === 1 ? '' : 's'} · {totalAssigned}/{totalDialogue} assigned ({pct}%)
          {scanning && <> · <span style={{ color: PREP_INK, fontWeight: 600 }}>scanning {progress.current}/{progress.total}…</span></>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SaveBadge status={saveStatus} />
        <label style={{ padding: '6px 12px', background: 'white', border: '1px solid ' + PREP_INK, color: PREP_INK, fontSize: '0.7rem', fontWeight: 700, borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Replace
          <input type="file" accept=".docx" onChange={(e) => e.target.files?.[0] && onReplace(e.target.files[0])} style={{ display: 'none' }} />
        </label>
      </div>
    </section>
  );
}

function SaveBadge({ status }) {
  const map = {
    idle: { label: 'Saved to Save Data', color: 'var(--text-light)', dot: '#b5cbb9' },
    saving: { label: 'Saving…', color: PREP_INK, dot: '#f3c93a' },
    saved: { label: 'Saved', color: PREP_INK, dot: '#3F8F65' },
  };
  const m = map[status] || map.idle;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 600, color: m.color }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.dot }} />
      {m.label}
    </div>
  );
}

function ExportToolbar({ onDocx, onDialogueCsv, onNarratorCsv, hasCharacters }) {
  const btn = (active) => ({ padding: '6px 12px', background: 'white', border: '1px solid ' + PREP_INK, color: PREP_INK, fontSize: '0.7rem', fontWeight: 700, borderRadius: 999, cursor: 'pointer', opacity: active ? 1 : 0.55, whiteSpace: 'nowrap' });
  return (
    <section style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      <button type="button" onClick={onDocx} style={btn(hasCharacters)}>Export highlighted .docx</button>
      <button type="button" onClick={onDialogueCsv} style={btn(true)}>Export dialogue (CSV)</button>
      <button type="button" onClick={onNarratorCsv} style={btn(true)}>Export narrators by chapter (CSV)</button>
    </section>
  );
}

function ReaderPage({ project, charactersById, selected, onSelectDialogue }) {
  return (
    <article style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 38px', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '1rem', lineHeight: 1.7, color: 'var(--text)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {project.chapters.map((ch) => (
        <section key={ch.id} style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: PREP_INK, margin: '0 0 16px 0', fontFamily: 'inherit', textAlign: 'center' }}>
            {ch.title || `Chapter ${ch.chapterIndex + 1}`}
          </h2>
          {ch.sections.map((sec) => (
            <SectionBody
              key={sec.id}
              section={sec}
              chapterIndex={ch.chapterIndex}
              charactersById={charactersById}
              selected={selected}
              onSelectDialogue={onSelectDialogue}
            />
          ))}
        </section>
      ))}
    </article>
  );
}

function SectionBody({ section, chapterIndex, charactersById, selected, onSelectDialogue }) {
  const text = section.plainText || '';
  if (!text && section.scanning) return <div style={{ color: 'var(--text-light)', fontSize: '0.86rem', fontStyle: 'italic' }}>(scanning…)</div>;
  if (!text) return null;
  const spans = section.dialogueSpans || [];

  // Render section title (h2) inline if not generic
  const sectionHeading = (section.title && !/^section \d+$/i.test(section.title) && !/^chapter /i.test(section.title))
    ? <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', margin: '20px 0 10px 0', fontFamily: 'inherit', fontStyle: 'italic', textAlign: 'center' }}>{section.title}</h3>
    : null;

  const segments = [];
  let cursor = 0;
  spans.forEach((sp, si) => {
    const needle = sp.text || '';
    if (!needle) return;
    const where = text.indexOf(needle, cursor);
    if (where === -1) return;
    if (where > cursor) segments.push({ kind: 'plain', text: text.slice(cursor, where) });
    segments.push({ kind: 'dialogue', text: needle, spanIndex: si });
    cursor = where + needle.length;
  });
  if (cursor < text.length) segments.push({ kind: 'plain', text: text.slice(cursor) });
  if (segments.length === 0) segments.push({ kind: 'plain', text });

  return (
    <>
      {sectionHeading}
      <div>
        {segments.map((seg, i) => {
          if (seg.kind === 'plain') return renderPlainSegment(seg.text, i);
          const span = spans[seg.spanIndex];
          const char = span?.characterId ? charactersById.get(span.characterId) : null;
          const isSelected = selected.chapterIndex === chapterIndex && selected.sectionIndex === section.sectionIndex && selected.spanIndex === seg.spanIndex;
          const bg = char ? char.colorHex : (isSelected ? '#FFF6CC' : 'transparent');
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDialogue(chapterIndex, section.sectionIndex, seg.spanIndex)}
              style={{
                background: bg,
                border: '1px solid ' + (isSelected ? PREP_INK : (char ? PREP_INK + '55' : '#e3d8b0')),
                borderRadius: 6,
                padding: '1px 6px',
                margin: '0 1px',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                color: 'var(--text)',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 0 0 2px rgba(63, 106, 82, 0.2)' : 'none',
              }}
              aria-label={`Dialogue ${seg.spanIndex + 1} in ${section.title}`}
            >
              “{seg.text}”
            </button>
          );
        })}
      </div>
    </>
  );
}

function renderPlainSegment(text, key) {
  const paragraphs = String(text || '').split(/\n{2,}/);
  return (
    <React.Fragment key={key}>
      {paragraphs.map((para, pi) => {
        const cleaned = para.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        if (!cleaned) return null;
        return <p key={pi} style={{ margin: '0 0 12px 0' }}>{cleaned}</p>;
      })}
    </React.Fragment>
  );
}

function AssignmentDock({
  project, charactersById, selectedSpan, selectedChapter, selectedSection,
  positionLabel, onPrev, onNext, onAssign, onNarratorOverride,
  onAddCharacter, onUpdateCharacter, onRemoveCharacter,
  addingChar, setAddingChar, showCharGrid, setShowCharGrid,
}) {
  const characters = project.characters || [];
  const currentChar = selectedSpan?.characterId ? charactersById.get(selectedSpan.characterId) : null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0, right: 0, bottom: 0,
        background: 'rgba(244, 241, 238, 0.94)',
        borderTop: '1px solid var(--border)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 -8px 30px rgba(0,0,0,0.06)',
        zIndex: 1200,
        padding: '10px 14px 12px',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 14, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PREP_INK }}>
              Dialogue {positionLabel}
            </span>
            {selectedChapter && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {selectedChapter.title}{selectedSection && selectedSection.title !== selectedChapter.title ? ' · ' + selectedSection.title : ''}
              </span>
            )}
          </div>
          {selectedSpan ? (
            <div style={{ padding: '8px 12px', background: currentChar?.colorHex || 'white', border: '1px solid ' + (currentChar ? PREP_INK + '44' : 'var(--border)'), borderRadius: 10, fontSize: '0.88rem', fontFamily: 'Georgia, serif', lineHeight: 1.45, color: 'var(--text)', maxHeight: 80, overflow: 'auto' }}>
              “{selectedSpan.text}”
              {selectedSpan.afterText && (<span style={{ marginLeft: 6, fontSize: '0.74rem', color: 'var(--text-light)', fontStyle: 'italic' }}>— {selectedSpan.afterText}</span>)}
            </div>
          ) : (
            <div style={{ padding: '8px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.78rem', color: 'var(--text-light)' }}>
              {project.chapters?.length ? 'Click a dialogue in the manuscript to assign.' : 'Import a manuscript first.'}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={onPrev} style={dockBtn(false)}>← Prev</button>
            <button type="button" onClick={onNext} style={dockBtn(true)}>Next →</button>
            <span style={{ width: 12 }} />
            <input
              type="text"
              placeholder="Narrator override (optional)"
              value={selectedSpan?.narratorOverride || ''}
              disabled={!selectedSpan}
              onChange={(e) => onNarratorOverride(e.target.value)}
              style={{ flex: 1, minWidth: 160, padding: '6px 10px', fontSize: '0.74rem', borderRadius: 999, border: '1px solid var(--border)', background: 'white' }}
            />
          </div>
        </div>

        <div style={{ minWidth: 360, maxWidth: 460 }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <button type="button" onClick={() => setShowCharGrid((s) => !s)} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PREP_INK }}>
              Characters ({characters.length}) {showCharGrid ? '▾' : '▸'}
            </button>
            <button type="button" onClick={() => setAddingChar((a) => !a)} style={{ padding: '5px 10px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer' }}>
              {addingChar ? 'Cancel' : '+ Add'}
            </button>
          </header>
          {addingChar && (
            <AddCharacterInline onSave={onAddCharacter} onCancel={() => setAddingChar(false)} existingCount={characters.length} />
          )}
          {showCharGrid && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 110, overflow: 'auto' }}>
              {characters.length === 0 && !addingChar && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', padding: '4px 2px' }}>
                  No characters yet. Click + Add.
                </div>
              )}
              {characters.map((c) => {
                const isCurrent = selectedSpan?.characterId === c.id;
                return (
                  <CharacterChip
                    key={c.id}
                    character={c}
                    isCurrent={isCurrent}
                    onClickAssign={() => onAssign(isCurrent ? null : c.id)}
                    onEdit={(patch) => onUpdateCharacter(c.id, patch)}
                    onRemove={() => onRemoveCharacter(c.id)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function dockBtn(primary) {
  return {
    padding: '7px 14px',
    background: primary ? PREP_INK : 'white',
    color: primary ? 'white' : PREP_INK,
    border: '1px solid ' + PREP_INK,
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
  };
}

function AddCharacterInline({ onSave, onCancel, existingCount }) {
  const [name, setName] = useState('');
  const [narrator, setNarrator] = useState('');
  const preset = CHARACTER_PALETTE[existingCount % CHARACTER_PALETTE.length];
  const [color, setColor] = useState(preset);
  return (
    <div style={{ background: color, border: '1px solid ' + PREP_INK + '33', borderRadius: 10, padding: 6, display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Character name"
        style={{ flex: 1, minWidth: 140, padding: '5px 8px', fontSize: '0.78rem', fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
      <input type="text" value={narrator} onChange={(e) => setNarrator(e.target.value)} placeholder="Narrator"
        style={{ flex: 1, minWidth: 120, padding: '5px 8px', fontSize: '0.74rem', borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
        style={{ width: 28, height: 28, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'white', cursor: 'pointer' }} />
      <button type="button" onClick={onCancel}
        style={{ padding: '5px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
      <button type="button" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), narratorName: narrator.trim(), colorHex: color })}
        style={{ padding: '5px 12px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>Save</button>
    </div>
  );
}

function CharacterChip({ character, isCurrent, onClickAssign, onEdit, onRemove }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div style={{ background: character.colorHex, border: '1px solid ' + PREP_INK + '44', borderRadius: 999, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input type="text" value={character.name} onChange={(e) => onEdit({ name: e.target.value })}
          style={{ padding: '2px 6px', width: 90, fontSize: '0.72rem', fontWeight: 600, borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
        <input type="text" value={character.narratorName} placeholder="narrator" onChange={(e) => onEdit({ narratorName: e.target.value })}
          style={{ padding: '2px 6px', width: 80, fontSize: '0.7rem', borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
        <input type="color" value={character.colorHex} onChange={(e) => onEdit({ colorHex: e.target.value })}
          style={{ width: 22, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: 4, background: 'white', cursor: 'pointer' }} />
        <button type="button" onClick={onRemove} style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.85)', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
        <button type="button" onClick={() => setEditing(false)} style={{ padding: '2px 8px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Done</button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClickAssign}
      onDoubleClick={() => setEditing(true)}
      title={isCurrent ? 'Click to unassign · double-click to edit' : (character.narratorName ? `Assign · narrator: ${character.narratorName}` : 'Assign · double-click to edit')}
      style={{
        background: character.colorHex,
        border: '1px solid ' + (isCurrent ? PREP_INK : PREP_INK + '33'),
        borderRadius: 999,
        padding: '5px 12px',
        fontSize: '0.74rem',
        fontWeight: 700,
        color: 'var(--text)',
        cursor: 'pointer',
        boxShadow: isCurrent ? '0 0 0 2px rgba(63, 106, 82, 0.25)' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {character.name || 'Unnamed'}
      {character.narratorName ? <span style={{ marginLeft: 6, fontWeight: 500, fontSize: '0.7rem', color: 'var(--text-muted)' }}>/ {character.narratorName}</span> : null}
    </button>
  );
}
