'use client';

// StJohn Author Studio 4.0 — Prep Manuscript mode.
//
// Phase 6 passes 2-4:
//  - Import a .docx (mammoth in renderer).
//  - Detect every dialogue line with the shared manuscript-engine.
//  - Manage a list of characters (name + narrator + pastel color).
//  - Assign each dialogue line to a character + optional narrator override.
//  - Persist the project to Electron's Save Data folder
//    (`prep-manuscript-projects.json`).
//
// Pass 5 will add export (highlighted .docx + CSV chapter list).

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

// Default character swatches (cycled when adding a new character).
const CHARACTER_PALETTE = [
  '#F4DCE0', // pink
  '#E5DCEF', // purple
  '#DCE6F0', // blue
  '#DCEBE0', // green
  '#F4E4D8', // peach
  '#E8DCF1', // lavender
  '#D8EFE0', // mint
  '#D8E6F1', // sky
  '#F0DCE8', // rose
  '#EAE5F2', // mauve
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

function snippet(text = '', max = 70) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trim() + '…';
}

function buildProjectFromImport(file, html) {
  const chapters = splitHtmlIntoChapters(html).map((part, ci) => {
    const detect = detectDialogueSpansInHtml(part.html) || {};
    const rawSpans = Array.isArray(detect.dialogueSpans) ? detect.dialogueSpans : (Array.isArray(detect) ? detect : []);
    return {
      title: part.title || `Chapter ${ci + 1}`,
      spans: rawSpans.map((s, si) => ({
        id: `span-${ci}-${si}`,
        text: s.text || '',
        afterText: s.afterText || '',
        characterId: null,
        narratorOverride: '',
      })),
    };
  });
  return {
    id: uid('prep'),
    title: file.name.replace(/\.docx$/i, ''),
    fileName: file.name,
    importedAt: new Date().toISOString(),
    characters: [],
    chapters,
  };
}

function mergeReimportPreservingAssignments(oldProject, newProject) {
  // Try to keep character assignments across re-imports when the span text
  // matches exactly. Span IDs are stable per (chapter index, span index)
  // so most assignments will survive small edits.
  if (!oldProject) return newProject;
  const oldByKey = new Map();
  oldProject.chapters?.forEach((ch, ci) => {
    ch.spans?.forEach((sp, si) => {
      const k = `${ci}|${si}|${sp.text}`;
      oldByKey.set(k, { characterId: sp.characterId, narratorOverride: sp.narratorOverride });
    });
  });
  return {
    ...newProject,
    id: oldProject.id,
    importedAt: newProject.importedAt,
    characters: oldProject.characters?.length ? oldProject.characters : newProject.characters,
    chapters: newProject.chapters.map((ch, ci) => ({
      ...ch,
      spans: ch.spans.map((sp, si) => {
        const k = `${ci}|${si}|${sp.text}`;
        const prev = oldByKey.get(k);
        return prev ? { ...sp, characterId: prev.characterId || null, narratorOverride: prev.narratorOverride || '' } : sp;
      }),
    })),
  };
}

function nextPaletteColor(usedHexes = []) {
  const used = new Set(usedHexes);
  return CHARACTER_PALETTE.find((c) => !used.has(c)) || CHARACTER_PALETTE[usedHexes.length % CHARACTER_PALETTE.length];
}

export default function PrepManuscriptMode({ modeToggle, usesCustomDragRegion }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const saveTimerRef = useRef(null);

  // Hydrate from Electron Save Data on mount.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const electron = typeof window !== 'undefined' ? window.electron : null;
        if (!electron?.readPrepData) {
          setHydrated(true);
          return;
        }
        const list = await electron.readPrepData();
        if (cancelled) return;
        if (Array.isArray(list) && list.length > 0) {
          setProject(list[list.length - 1]);
        }
      } catch {
        // ignore; user can just import fresh
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }
    hydrate();
    return () => { cancelled = true; };
  }, []);

  // Persist on change (debounced).
  useEffect(() => {
    if (!hydrated || !project) return;
    const electron = typeof window !== 'undefined' ? window.electron : null;
    if (!electron?.writePrepData) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      electron.writePrepData([project]).catch(() => {});
    }, 350);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [project, hydrated]);

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
  const charactersById = useMemo(() => {
    const map = new Map();
    (project?.characters || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [project]);

  async function handleFile(file) {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const mammoth = (await import('mammoth')).default;
      const ab = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: ab });
      const fresh = buildProjectFromImport(file, result.value || '');
      setProject((prev) => mergeReimportPreservingAssignments(prev, fresh));
    } catch (err) {
      setError(err?.message || 'Could not read this manuscript.');
    } finally {
      setLoading(false);
    }
  }

  function addCharacter() {
    setProject((p) => {
      if (!p) return p;
      const used = (p.characters || []).map((c) => c.colorHex);
      const newChar = { id: uid('char'), name: '', narratorName: '', colorHex: nextPaletteColor(used) };
      return { ...p, characters: [...(p.characters || []), newChar] };
    });
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
        spans: ch.spans.map((s) => (s.characterId === id ? { ...s, characterId: null } : s)),
      })),
    }));
  }

  function assignSpan(chapterIndex, spanId, characterId) {
    setProject((p) => p && ({
      ...p,
      chapters: p.chapters.map((ch, ci) =>
        ci !== chapterIndex ? ch : { ...ch, spans: ch.spans.map((s) => (s.id === spanId ? { ...s, characterId: characterId || null } : s)) }
      ),
    }));
  }

  function setSpanNarratorOverride(chapterIndex, spanId, value) {
    setProject((p) => p && ({
      ...p,
      chapters: p.chapters.map((ch, ci) =>
        ci !== chapterIndex ? ch : { ...ch, spans: ch.spans.map((s) => (s.id === spanId ? { ...s, narratorOverride: value } : s)) }
      ),
    }));
  }

  async function exportHighlightedDocx() {
    if (!project) return;
    try {
      const blob = await buildPrepHighlightedDocxBlob(project);
      downloadBlob(blob, exportFileNames.docx(project));
    } catch (e) {
      setError(e?.message || 'Could not export highlighted .docx');
    }
  }

  function exportDialogueCsv() {
    if (!project) return;
    downloadText(buildPrepCsv(project), exportFileNames.fullCsv(project), 'text/csv;charset=utf-8');
  }

  function exportNarratorChapterCsv() {
    if (!project) return;
    downloadText(buildPrepNarratorChapterCsv(project), exportFileNames.chapterCsv(project), 'text/csv;charset=utf-8');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {usesCustomDragRegion && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 1100 }} />
      )}
      {modeToggle}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '5.2rem 1.25rem 4rem' }}>
        <header style={{ marginBottom: '1.2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: PREP_INK }}>
            Prep Manuscript
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Import a Word manuscript. Every line of dialogue is detected automatically. Add characters and assign each line before recording.
          </div>
        </header>

        {!project && (
          <ImportEmptyState onPick={handleFile} loading={loading} error={error} />
        )}

        {project && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 16, alignItems: 'start' }}>
            <main style={{ minWidth: 0 }}>
              <ProjectHeader project={project} totalDialogue={totalDialogue} totalAssigned={totalAssigned} onReplace={handleFile} />
              <ExportToolbar
                onDocx={exportHighlightedDocx}
                onDialogueCsv={exportDialogueCsv}
                onNarratorCsv={exportNarratorChapterCsv}
                hasCharacters={(project.characters || []).length > 0}
              />
              {error && (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 8, color: 'var(--danger)', fontSize: '0.78rem' }}>{error}</div>
              )}
              {project.chapters.map((ch, ci) => (
                <ChapterBlock
                  key={ci}
                  chapter={ch}
                  chapterIndex={ci}
                  characters={project.characters}
                  charactersById={charactersById}
                  onAssign={assignSpan}
                  onNarratorOverride={setSpanNarratorOverride}
                />
              ))}
              {project.chapters.length === 0 && (
                <div style={{ padding: 16, fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  No chapters detected. Make sure your .docx has Heading 1 or Heading 2 styles on chapter titles.
                </div>
              )}
            </main>
            <aside style={{ position: 'sticky', top: 80 }}>
              <CharactersPanel
                characters={project.characters}
                onAdd={addCharacter}
                onUpdate={updateCharacter}
                onRemove={removeCharacter}
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportEmptyState({ onPick, loading, error }) {
  return (
    <section
      style={{
        padding: '24px 22px',
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
        {loading ? 'Reading…' : 'Import manuscript (.docx)'}
        <input
          type="file"
          accept=".docx"
          disabled={loading}
          onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])}
          style={{ display: 'none' }}
        />
      </label>
      {error && (
        <div style={{ marginTop: 14, fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</div>
      )}
    </section>
  );
}

function ProjectHeader({ project, totalDialogue, totalAssigned, onReplace }) {
  const pct = totalDialogue === 0 ? 0 : Math.round((totalAssigned / totalDialogue) * 100);
  return (
    <section
      style={{
        marginBottom: 16,
        padding: '14px 18px',
        background: PASTEL_PREP,
        border: '1px solid ' + PREP_INK + '33',
        borderRadius: 16,
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PREP_INK }}>
          Loaded
        </div>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>
          {project.fileName}
        </div>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {project.chapters.length} chapter{project.chapters.length === 1 ? '' : 's'} · {totalAssigned}/{totalDialogue} assigned ({pct}%)
        </div>
      </div>
      <label
        style={{
          padding: '8px 14px',
          background: 'white',
          border: '1px solid ' + PREP_INK,
          color: PREP_INK,
          fontSize: '0.74rem',
          fontWeight: 700,
          borderRadius: 999,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Replace
        <input
          type="file"
          accept=".docx"
          onChange={(e) => e.target.files?.[0] && onReplace(e.target.files[0])}
          style={{ display: 'none' }}
        />
      </label>
    </section>
  );
}

function ExportToolbar({ onDocx, onDialogueCsv, onNarratorCsv, hasCharacters }) {
  const btn = (active) => ({
    padding: '8px 12px',
    background: 'white',
    border: '1px solid ' + PREP_INK,
    color: PREP_INK,
    fontSize: '0.74rem',
    fontWeight: 700,
    borderRadius: 999,
    cursor: 'pointer',
    opacity: active ? 1 : 0.55,
    whiteSpace: 'nowrap',
  });
  return (
    <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <button type="button" onClick={onDocx} style={btn(hasCharacters)} title={hasCharacters ? 'Export a Word doc with each dialogue line highlighted in its character color' : 'Add at least one character first to see highlights'}>
        Export highlighted .docx
      </button>
      <button type="button" onClick={onDialogueCsv} style={btn(true)}>
        Export every dialogue line (CSV)
      </button>
      <button type="button" onClick={onNarratorCsv} style={btn(true)}>
        Export narrators by chapter (CSV)
      </button>
    </section>
  );
}

function ChapterBlock({ chapter, chapterIndex, characters, charactersById, onAssign, onNarratorOverride }) {
  return (
    <section
      style={{
        marginBottom: 14,
        padding: '14px 16px',
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 16,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, gap: 10 }}>
        <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)' }}>
          {chapter.title || `Chapter ${chapterIndex + 1}`}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          {chapter.spans.length} dialogue{chapter.spans.length === 1 ? '' : 's'}
        </div>
      </header>
      {chapter.spans.length === 0 ? (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>No dialogue detected in this chapter.</div>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {chapter.spans.map((s) => {
            const char = s.characterId ? charactersById.get(s.characterId) : null;
            const bg = char ? char.colorHex : 'var(--accent-surface)';
            return (
              <li
                key={s.id}
                style={{
                  padding: '9px 12px',
                  background: bg,
                  border: '1px solid ' + (char ? PREP_INK + '22' : 'var(--border-light)'),
                  borderRadius: 10,
                  fontSize: '0.84rem',
                  lineHeight: 1.4,
                  color: 'var(--text)',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 160px 130px',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ color: PREP_INK, fontWeight: 700, fontFamily: 'Georgia, serif' }}>“{snippet(s.text, 200)}”</span>
                  {s.afterText && (
                    <span style={{ marginLeft: 6, fontSize: '0.78rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                      — {snippet(s.afterText, 50)}
                    </span>
                  )}
                </div>
                <select
                  value={s.characterId || ''}
                  onChange={(e) => onAssign(chapterIndex, s.id, e.target.value || null)}
                  style={{
                    fontSize: '0.78rem',
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'white',
                    minWidth: 0,
                  }}
                >
                  <option value="">— No character —</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || 'Unnamed'}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Narrator…"
                  value={s.narratorOverride || ''}
                  onChange={(e) => onNarratorOverride(chapterIndex, s.id, e.target.value)}
                  style={{
                    fontSize: '0.76rem',
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'white',
                    minWidth: 0,
                  }}
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function CharactersPanel({ characters, onAdd, onUpdate, onRemove }) {
  return (
    <section
      style={{
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '12px 14px',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PREP_INK }}>
          Characters
        </div>
        <button
          type="button"
          onClick={onAdd}
          style={{
            padding: '6px 12px',
            background: PREP_INK,
            color: 'white',
            border: 'none',
            borderRadius: 999,
            fontSize: '0.74rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          + Add
        </button>
      </header>
      {characters.length === 0 ? (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', padding: '8px 0' }}>
          No characters yet. Add one to start assigning lines.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {characters.map((c) => (
            <li key={c.id} style={{
              background: c.colorHex,
              border: '1px solid ' + PREP_INK + '22',
              borderRadius: 10,
              padding: 8,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <input
                type="text"
                value={c.name}
                onChange={(e) => onUpdate(c.id, { name: e.target.value })}
                placeholder="Character name"
                style={{ padding: '5px 8px', fontSize: '0.84rem', fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.7)' }}
              />
              <input
                type="text"
                value={c.narratorName}
                onChange={(e) => onUpdate(c.id, { narratorName: e.target.value })}
                placeholder="Narrator (optional)"
                style={{ padding: '5px 8px', fontSize: '0.76rem', borderRadius: 6, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.7)' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="color"
                  value={c.colorHex}
                  onChange={(e) => onUpdate(c.id, { colorHex: e.target.value })}
                  style={{ width: 24, height: 24, padding: 0, border: '1px solid var(--border)', borderRadius: 6, background: 'white', cursor: 'pointer' }}
                />
                <button
                  type="button"
                  onClick={() => onRemove(c.id)}
                  style={{ marginLeft: 'auto', padding: '4px 8px', background: 'rgba(255,255,255,0.85)', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
