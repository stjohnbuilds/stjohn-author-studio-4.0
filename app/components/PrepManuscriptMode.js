'use client';

// StJohn Author Studio 4.0 — Prep Manuscript mode (v2 layout).
//
// Built to match the 2.0 design Marie already designed:
//  - Reader-page on the left showing the manuscript with dialogue
//    spans as inline clickable buttons (selected/assigned tints).
//  - Right-side assignment panel that shows the selected dialogue and
//    a grid of characters to click to assign.
//  - Prev / Next dialogue buttons at the bottom.
//  - Progressive load: each chapter renders as soon as it's scanned;
//    you can start assigning before the whole book finishes.
//
// Persists to prep-manuscript-projects.json via the new IPC.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  detectDialogueSpansInHtml,
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

const CHARACTER_PALETTE = [
  '#F4DCE0', '#E5DCEF', '#DCE6F0', '#DCEBE0',
  '#F4E4D8', '#E8DCF1', '#D8EFE0', '#D8E6F1',
  '#F0DCE8', '#EAE5F2',
];

function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

function splitHtmlIntoChapters(html = '') {
  if (!html) return [];
  const re = /<(h1|h2)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const breaks = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    breaks.push({ index: m.index, end: m.index + m[0].length, title: stripTags(m[2]).trim() });
  }
  if (!breaks.length) return [{ title: 'Untitled chapter', html }];
  const chapters = [];
  for (let i = 0; i < breaks.length; i++) {
    const start = breaks[i].index;
    const end = i + 1 < breaks.length ? breaks[i + 1].index : html.length;
    chapters.push({ title: breaks[i].title || `Chapter ${i + 1}`, html: html.slice(start, end) });
  }
  return chapters;
}

function stripTags(s = '') {
  return String(s).replace(/<[^>]*>/g, '');
}

function chapterPlainText(html = '') {
  // Strip every tag, collapse whitespace. Used to render the reader page.
  return String(html || '')
    .replace(/<\/(p|h1|h2|h3|h4|h5|h6|li|blockquote)>/gi, '\n\n')
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectChapterSpans(chapterHtml = '', chapterIndex = 0) {
  let raw = [];
  try {
    const result = detectDialogueSpansInHtml(chapterHtml) || {};
    raw = Array.isArray(result.dialogueSpans) ? result.dialogueSpans : (Array.isArray(result) ? result : []);
  } catch {
    raw = [];
  }
  return raw.map((s, si) => ({
    id: `span-${chapterIndex}-${si}`,
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

function mergeReimport(oldProject, freshShell) {
  if (!oldProject) return freshShell;
  return {
    ...freshShell,
    id: oldProject.id,
    characters: oldProject.characters?.length ? oldProject.characters : freshShell.characters,
  };
}

function withAssignmentsRestored(oldProject, newChapters) {
  if (!oldProject) return newChapters;
  const oldByKey = new Map();
  oldProject.chapters?.forEach((ch, ci) => {
    ch.spans?.forEach((sp, si) => {
      const k = `${ci}|${si}|${sp.text}`;
      oldByKey.set(k, { characterId: sp.characterId, narratorOverride: sp.narratorOverride });
    });
  });
  return newChapters.map((ch, ci) => ({
    ...ch,
    spans: ch.spans.map((sp, si) => {
      const k = `${ci}|${si}|${sp.text}`;
      const prev = oldByKey.get(k);
      return prev ? { ...sp, characterId: prev.characterId || null, narratorOverride: prev.narratorOverride || '' } : sp;
    }),
  }));
}

export default function PrepManuscriptMode({ modeToggle, usesCustomDragRegion }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);   // { current, total, title }
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState({ chapter: 0, span: 0 });
  const [addingChar, setAddingChar] = useState(false);
  const [showCharPanel, setShowCharPanel] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle');  // idle | saving | saved
  const saveTimerRef = useRef(null);
  const savedFlashRef = useRef(null);

  // Hydrate from Electron Save Data on mount.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const electron = typeof window !== 'undefined' ? window.electron : null;
        if (!electron?.readPrepData) { setHydrated(true); return; }
        const list = await electron.readPrepData();
        if (cancelled) return;
        if (Array.isArray(list) && list.length > 0) setProject(list[list.length - 1]);
      } catch {}
      finally { if (!cancelled) setHydrated(true); }
    }
    hydrate();
    return () => { cancelled = true; };
  }, []);

  // Persist on change with a visible "Saved" indicator.
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
      } catch {
        setSaveStatus('idle');
      }
    }, 350);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [project, hydrated]);

  const charactersById = useMemo(() => {
    const map = new Map();
    (project?.characters || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [project]);

  const totalDialogue = useMemo(
    () => (project?.chapters || []).reduce((n, ch) => n + (ch.spans?.length || 0), 0),
    [project]
  );
  const totalAssigned = useMemo(
    () => (project?.chapters || []).reduce(
      (n, ch) => n + (ch.spans?.filter((s) => s.characterId).length || 0),
      0,
    ),
    [project]
  );

  // Flat list of (chapterIndex, spanIndex) for prev/next nav.
  const dialogueIndex = useMemo(() => {
    const list = [];
    (project?.chapters || []).forEach((ch, ci) => {
      (ch.spans || []).forEach((_, si) => list.push({ chapter: ci, span: si }));
    });
    return list;
  }, [project]);

  const flatPos = useMemo(
    () => dialogueIndex.findIndex((p) => p.chapter === selected.chapter && p.span === selected.span),
    [dialogueIndex, selected]
  );

  function selectDialogue(ci, si) {
    setSelected({ chapter: ci, span: si });
  }

  function moveDialogue(step) {
    if (dialogueIndex.length === 0) return;
    const cur = Math.max(0, flatPos);
    const next = Math.max(0, Math.min(dialogueIndex.length - 1, cur + step));
    setSelected(dialogueIndex[next]);
  }

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
      const parts = splitHtmlIntoChapters(html);
      const total = parts.length;
      setProgress({ current: 0, total, title: parts[0]?.title || '' });

      // Seed an empty project shell immediately so the user can interact
      // with whatever's already loaded.
      const initialShell = {
        id: uid('prep'),
        title: file.name.replace(/\.docx$/i, ''),
        fileName: file.name,
        importedAt: new Date().toISOString(),
        characters: [],
        chapters: parts.map((p) => ({ title: p.title, fullText: '', spans: [], scanning: true })),
      };
      const oldProject = project;
      const carriedShell = mergeReimport(oldProject, initialShell);
      setProject(carriedShell);
      setSelected({ chapter: 0, span: 0 });

      // Now stream chapters: detect, push, yield, repeat.
      for (let ci = 0; ci < total; ci++) {
        setProgress({ current: ci + 1, total, title: parts[ci].title || `Chapter ${ci + 1}` });
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 0));
        const spans = detectChapterSpans(parts[ci].html, ci);
        const fullText = chapterPlainText(parts[ci].html);
        setProject((cur) => {
          if (!cur) return cur;
          const restoredChapters = cur.chapters.map((ch, idx) => {
            if (idx !== ci) return ch;
            return { title: parts[ci].title || `Chapter ${ci + 1}`, fullText, spans, scanning: false };
          });
          const withRestored = oldProject ? withAssignmentsRestored(oldProject, restoredChapters) : restoredChapters;
          return { ...cur, chapters: withRestored };
        });
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
    setProject((p) => p && ({
      ...p,
      characters: (p.characters || []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  function removeCharacter(id) {
    setProject((p) => p && ({
      ...p,
      characters: (p.characters || []).filter((c) => c.id !== id),
      chapters: (p.chapters || []).map((ch) => ({
        ...ch,
        spans: (ch.spans || []).map((s) => (s.characterId === id ? { ...s, characterId: null } : s)),
      })),
    }));
  }

  function assignCurrent(characterId) {
    setProject((p) => p && ({
      ...p,
      chapters: p.chapters.map((ch, ci) =>
        ci !== selected.chapter ? ch : {
          ...ch,
          spans: ch.spans.map((s, si) => (si === selected.span ? { ...s, characterId: characterId || null } : s)),
        }
      ),
    }));
  }

  function setNarratorOverride(value) {
    setProject((p) => p && ({
      ...p,
      chapters: p.chapters.map((ch, ci) =>
        ci !== selected.chapter ? ch : {
          ...ch,
          spans: ch.spans.map((s, si) => (si === selected.span ? { ...s, narratorOverride: value } : s)),
        }
      ),
    }));
  }

  async function exportHighlightedDocx() {
    if (!project) return;
    try {
      const blob = await buildPrepHighlightedDocxBlob(project);
      downloadBlob(blob, exportFileNames.docx(project));
    } catch (e) { setError(e?.message || 'Could not export highlighted .docx'); }
  }
  function exportDialogueCsv() {
    if (!project) return;
    downloadText(buildPrepCsv(project), exportFileNames.fullCsv(project), 'text/csv;charset=utf-8');
  }
  function exportNarratorChapterCsv() {
    if (!project) return;
    downloadText(buildPrepNarratorChapterCsv(project), exportFileNames.chapterCsv(project), 'text/csv;charset=utf-8');
  }

  const selectedChapter = project?.chapters?.[selected.chapter];
  const selectedSpan = selectedChapter?.spans?.[selected.span];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {usesCustomDragRegion && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 1100 }} />
      )}
      {modeToggle}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 24px 56px' }}>
        <header style={{ marginBottom: 14, paddingLeft: 240, textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: PREP_INK }}>
            Prep Manuscript
          </div>
        </header>

        {!project && (
          <ImportEmptyState onPick={handleFile} loading={loading} progress={progress} error={error} />
        )}

        {project && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'start' }}>
            <main style={{ minWidth: 0 }}>
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
            </main>
            <aside style={{ position: 'sticky', top: 88 }}>
              <AssignmentPanel
                project={project}
                charactersById={charactersById}
                selected={selected}
                selectedSpan={selectedSpan}
                selectedChapter={selectedChapter}
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
                showCharPanel={showCharPanel}
                setShowCharPanel={setShowCharPanel}
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportEmptyState({ onPick, loading, progress, error }) {
  const progressLabel = progress
    ? (progress.total > 0
        ? `${progress.title} — ${progress.current}/${progress.total}`
        : progress.title)
    : '';
  return (
    <section
      style={{
        margin: '40px auto 0',
        maxWidth: 560,
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
      <label
        style={{
          display: 'inline-block',
          padding: '13px 22px',
          background: PREP_INK,
          color: 'white',
          fontSize: '0.86rem',
          fontWeight: 700,
          borderRadius: 14,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (progressLabel || 'Reading…') : 'Import manuscript (.docx)'}
        <input
          type="file"
          accept=".docx"
          disabled={loading}
          onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
          style={{ display: 'none' }}
        />
      </label>
      {loading && progress && progress.total > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.6)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(progress.current / progress.total) * 100}%`, background: PREP_INK, transition: 'width 0.2s' }} />
          </div>
          <div style={{ marginTop: 8, fontSize: '0.76rem', color: 'var(--text-muted)' }}>{progressLabel}</div>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 14, fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</div>
      )}
    </section>
  );
}

function ProjectHeader({ project, totalDialogue, totalAssigned, onReplace, progress, saveStatus }) {
  const pct = totalDialogue === 0 ? 0 : Math.round((totalAssigned / totalDialogue) * 100);
  const scanning = progress && progress.total > 0 && progress.current < progress.total;
  return (
    <section
      style={{
        marginBottom: 12,
        padding: '12px 16px',
        background: PASTEL_PREP,
        border: '1px solid ' + PREP_INK + '33',
        borderRadius: 14,
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all' }}>
          {project.fileName}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {project.chapters.length} chapter{project.chapters.length === 1 ? '' : 's'} · {totalAssigned}/{totalDialogue} assigned ({pct}%)
          {scanning && <> · <span style={{ color: PREP_INK, fontWeight: 600 }}>scanning {progress.current}/{progress.total}…</span></>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <SaveBadge status={saveStatus} />
        <label
          style={{
            padding: '7px 12px',
            background: 'white',
            border: '1px solid ' + PREP_INK,
            color: PREP_INK,
            fontSize: '0.72rem',
            fontWeight: 700,
            borderRadius: 999,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Replace
          <input type="file" accept=".docx" onChange={(e) => e.target.files?.[0] && onReplace(e.target.files[0])} style={{ display: 'none' }} />
        </label>
      </div>
    </section>
  );
}

function SaveBadge({ status }) {
  const map = {
    idle:   { label: 'Saved to Save Data', color: 'var(--text-light)', dot: '#b5cbb9' },
    saving: { label: 'Saving…',            color: PREP_INK,            dot: '#f3c93a' },
    saved:  { label: 'Saved',              color: PREP_INK,            dot: '#3F8F65' },
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
  const btn = (active) => ({
    padding: '7px 12px',
    background: 'white',
    border: '1px solid ' + PREP_INK,
    color: PREP_INK,
    fontSize: '0.72rem',
    fontWeight: 700,
    borderRadius: 999,
    cursor: 'pointer',
    opacity: active ? 1 : 0.55,
    whiteSpace: 'nowrap',
  });
  return (
    <section style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      <button type="button" onClick={onDocx} style={btn(hasCharacters)} title={hasCharacters ? 'Highlighted Word doc with each line in its character color' : 'Add at least one character first'}>
        Export highlighted .docx
      </button>
      <button type="button" onClick={onDialogueCsv} style={btn(true)}>Export dialogue (CSV)</button>
      <button type="button" onClick={onNarratorCsv} style={btn(true)}>Export narrators by chapter (CSV)</button>
    </section>
  );
}

function ReaderPage({ project, charactersById, selected, onSelectDialogue }) {
  return (
    <article
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '24px 30px',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '0.96rem',
        lineHeight: 1.65,
        color: 'var(--text)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {project.chapters.map((ch, ci) => (
        <section key={ci} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: PREP_INK, margin: '0 0 12px 0', fontFamily: 'inherit' }}>
            {ch.title || `Chapter ${ci + 1}`}
            {ch.scanning && <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-light)', fontWeight: 400 }}>scanning…</span>}
          </h2>
          <ChapterPageBody
            chapter={ch}
            chapterIndex={ci}
            charactersById={charactersById}
            selected={selected}
            onSelectDialogue={onSelectDialogue}
          />
        </section>
      ))}
    </article>
  );
}

function ChapterPageBody({ chapter, chapterIndex, charactersById, selected, onSelectDialogue }) {
  // Build inline content by walking the chapter's full plain text and
  // replacing each detected dialogue text with a clickable button.
  // Spans can repeat — match in order, advancing the cursor past each.
  const text = chapter.fullText || '';
  if (!text) {
    return <div style={{ color: 'var(--text-light)', fontSize: '0.86rem' }}>(scanning chapter…)</div>;
  }
  const spans = chapter.spans || [];
  const segments = [];
  let cursor = 0;
  let usedFromIndex = {};
  spans.forEach((sp, si) => {
    const needle = sp.text || '';
    if (!needle) return;
    const startFrom = cursor;
    const where = text.indexOf(needle, startFrom);
    if (where === -1) {
      // span text not located in plain text — skip (rare, OK to no-op)
      return;
    }
    if (where > cursor) segments.push({ kind: 'plain', text: text.slice(cursor, where) });
    segments.push({ kind: 'dialogue', text: needle, spanIndex: si });
    cursor = where + needle.length;
    usedFromIndex[si] = true;
  });
  if (cursor < text.length) segments.push({ kind: 'plain', text: text.slice(cursor) });

  return (
    <div>
      {segments.map((seg, i) => {
        if (seg.kind === 'plain') {
          return renderPlainSegment(seg.text, i);
        }
        const span = spans[seg.spanIndex];
        const char = span?.characterId ? charactersById.get(span.characterId) : null;
        const isSelected = selected.chapter === chapterIndex && selected.span === seg.spanIndex;
        const bg = char ? char.colorHex : (isSelected ? '#FFF6CC' : 'transparent');
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelectDialogue(chapterIndex, seg.spanIndex)}
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
              boxShadow: isSelected ? '0 0 0 2px rgba(63, 106, 82, 0.18)' : 'none',
            }}
            aria-label={`Dialogue ${seg.spanIndex + 1}`}
          >
            “{seg.text}”
          </button>
        );
      })}
    </div>
  );
}

function renderPlainSegment(text, key) {
  // Preserve paragraph breaks.
  const paragraphs = text.split(/\n{2,}/);
  return (
    <React.Fragment key={key}>
      {paragraphs.map((para, pi) => (
        <React.Fragment key={pi}>
          {pi > 0 && <><br /><br /></>}
          <span>{para.replace(/\n/g, ' ').replace(/\s+/g, ' ')}</span>
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

function AssignmentPanel({
  project,
  charactersById,
  selected,
  selectedSpan,
  selectedChapter,
  positionLabel,
  onPrev,
  onNext,
  onAssign,
  onNarratorOverride,
  onAddCharacter,
  onUpdateCharacter,
  onRemoveCharacter,
  addingChar,
  setAddingChar,
  showCharPanel,
  setShowCharPanel,
}) {
  const currentChar = selectedSpan?.characterId ? charactersById.get(selectedSpan.characterId) : null;
  const characters = project.characters || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <section
        style={{
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PREP_INK, marginBottom: 6 }}>
          Dialogue {positionLabel}
        </div>
        {selectedChapter && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            {selectedChapter.title || `Chapter ${selected.chapter + 1}`}
          </div>
        )}
        {selectedSpan ? (
          <>
            <div style={{
              padding: '10px 12px',
              background: currentChar?.colorHex || 'var(--accent-surface)',
              border: '1px solid ' + (currentChar ? PREP_INK + '33' : 'var(--border-light)'),
              borderRadius: 10,
              fontSize: '0.86rem',
              fontFamily: 'Georgia, serif',
              lineHeight: 1.5,
              color: 'var(--text)',
            }}>
              “{selectedSpan.text}”
              {selectedSpan.afterText && (
                <span style={{ display: 'block', marginTop: 4, fontSize: '0.74rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                  — {selectedSpan.afterText}
                </span>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {currentChar ? <>Assigned to <strong>{currentChar.name || 'Unnamed'}</strong></> : 'Unassigned'}
            </div>
            <input
              type="text"
              placeholder="Narrator override (optional)"
              value={selectedSpan.narratorOverride || ''}
              onChange={(e) => onNarratorOverride(e.target.value)}
              style={{ marginTop: 6, width: '100%', padding: '6px 8px', fontSize: '0.76rem', borderRadius: 8, border: '1px solid var(--border)', background: 'white' }}
            />
          </>
        ) : (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
            {project.chapters?.length === 0
              ? 'No chapters yet.'
              : 'Click a dialogue in the manuscript to start assigning.'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <button type="button" onClick={onPrev} style={navBtnStyle(false)}>← Prev</button>
          <button type="button" onClick={onNext} style={navBtnStyle(true)}>Next →</button>
        </div>
      </section>

      <section
        style={{
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => setShowCharPanel((s) => !s)}
            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PREP_INK }}
          >
            Characters ({characters.length}) {showCharPanel ? '▾' : '▸'}
          </button>
          <button
            type="button"
            onClick={() => setAddingChar(true)}
            style={{ padding: '5px 10px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
          >
            + Add
          </button>
        </header>

        {addingChar && (
          <AddCharacterInline
            onSave={onAddCharacter}
            onCancel={() => setAddingChar(false)}
            existingCount={characters.length}
          />
        )}

        {showCharPanel && characters.length === 0 && !addingChar && (
          <div style={{ fontSize: '0.74rem', color: 'var(--text-light)' }}>
            No characters yet. Click + Add to create one.
          </div>
        )}

        {showCharPanel && characters.length > 0 && (
          <div style={{ display: 'grid', gap: 6, marginTop: addingChar ? 8 : 0 }}>
            {characters.map((c) => {
              const isCurrent = selectedSpan?.characterId === c.id;
              return (
                <CharacterRow
                  key={c.id}
                  character={c}
                  isCurrent={isCurrent}
                  onClickAssign={() => onAssign(isCurrent ? null : c.id)}
                  onUpdate={(patch) => onUpdateCharacter(c.id, patch)}
                  onRemove={() => onRemoveCharacter(c.id)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function navBtnStyle(primary) {
  return {
    flex: 1,
    padding: '8px 10px',
    background: primary ? PREP_INK : 'white',
    color: primary ? 'white' : PREP_INK,
    border: '1px solid ' + PREP_INK,
    borderRadius: 999,
    fontSize: '0.74rem',
    fontWeight: 700,
    cursor: 'pointer',
  };
}

function AddCharacterInline({ onSave, onCancel, existingCount }) {
  const [name, setName] = useState('');
  const [narrator, setNarrator] = useState('');
  const presetColor = CHARACTER_PALETTE[existingCount % CHARACTER_PALETTE.length];
  const [color, setColor] = useState(presetColor);
  return (
    <div style={{
      background: color,
      border: '1px solid ' + PREP_INK + '33',
      borderRadius: 10,
      padding: 8,
      display: 'flex', flexDirection: 'column', gap: 6,
      marginBottom: 8,
    }}>
      <input
        type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)}
        placeholder="Character name (e.g. Crescent)"
        style={{ padding: '6px 8px', fontSize: '0.82rem', fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }}
      />
      <input
        type="text" value={narrator} onChange={(e) => setNarrator(e.target.value)}
        placeholder="Narrator (optional)"
        style={{ padding: '6px 8px', fontSize: '0.76rem', borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 28, height: 28, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'white', cursor: 'pointer' }} />
        <button type="button" onClick={onCancel} style={{ marginLeft: 'auto', padding: '5px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button
          type="button"
          onClick={() => onSave({ name: name.trim(), narratorName: narrator.trim(), colorHex: color })}
          disabled={!name.trim()}
          style={{ padding: '5px 12px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}
        >Save</button>
      </div>
    </div>
  );
}

function CharacterRow({ character, isCurrent, onClickAssign, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      style={{
        background: character.colorHex,
        border: '1px solid ' + (isCurrent ? PREP_INK : PREP_INK + '22'),
        borderRadius: 10,
        padding: 8,
        boxShadow: isCurrent ? '0 0 0 2px rgba(63, 106, 82, 0.15)' : 'none',
      }}
    >
      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onClickAssign}
            title={isCurrent ? 'Unassign from current dialogue' : 'Assign current dialogue to this character'}
            style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text)' }}>
              {character.name || 'Unnamed'}
            </div>
            {character.narratorName && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Narrator: {character.narratorName}
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit"
            style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.85)', color: PREP_INK, border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
          >Edit</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <input
            type="text" value={character.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Character name"
            style={{ padding: '5px 8px', fontSize: '0.82rem', fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }}
          />
          <input
            type="text" value={character.narratorName}
            onChange={(e) => onUpdate({ narratorName: e.target.value })}
            placeholder="Narrator (optional)"
            style={{ padding: '5px 8px', fontSize: '0.74rem', borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="color" value={character.colorHex} onChange={(e) => onUpdate({ colorHex: e.target.value })} style={{ width: 24, height: 24, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'white', cursor: 'pointer' }} />
            <button type="button" onClick={onRemove} style={{ marginLeft: 'auto', padding: '4px 8px', background: 'rgba(255,255,255,0.85)', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
            <button type="button" onClick={() => setEditing(false)} style={{ padding: '4px 10px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
