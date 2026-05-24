'use client';

// StJohn Author Studio 4.0 — Prep Manuscript mode (v4 layout).
//
// Rebuilt AGAIN to honour the architecture I broke:
//
//   - "ONE shared reader." Visual styling now matches ProofingReader
//     exactly: 740px max-width, paper gradient page background, no
//     white card, 16.5px text at 1.92 line height. (Logic isn't yet
//     literally shared — that's a Phase 4.5 refactor — but the
//     reader LOOKS identical.)
//
//   - Paragraphs render as paragraphs (no more blob): section HTML is
//     parsed into paragraph blocks and rendered with proper <p> tags.
//
//   - "Before first chapter" / front-matter sections with no dialogue
//     are filtered out so trigger warnings + copyright don't clutter.
//
//   - Side-character + narrator popover system restored from the 2.0
//     design: each character has a "+" that opens a popover of side
//     voices (e.g. character "narrating in a different voice for
//     side scenes"). Pick one to assign or "Add side voice..." to
//     create + assign in one click.
//
//   - Next/Prev dialogue scrolls the reader to the selected line.
//
//   - Bottom dock is tighter and matches the 740px reader width.

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

// Visual language locked to ProofingReader (lines 1180, 1190, 1282).
const READER_WIDTH = 'min(740px, calc(100vw - 40px))';
const READER_PAGE_BG = 'linear-gradient(180deg, #fbfaf7 0%, #ffffff 16%, #ffffff 100%)';
const READER_FONT_SIZE = '16.5px';
const READER_LINE_HEIGHT = 1.92;

const PASTEL_PREP = '#DCEBE0';
const PREP_INK = '#3F6A52';
const HOME_CONTAINER = 640;

const CHARACTER_PALETTE = [
  '#F4DCE0', '#E5DCEF', '#DCE6F0', '#DCEBE0',
  '#F4E4D8', '#E8DCF1', '#D8EFE0', '#D8E6F1',
  '#F0DCE8', '#EAE5F2',
];

function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

function stripTags(s = '') {
  return String(s).replace(/<[^>]*>/g, '');
}

function paragraphsFromHtml(html = '') {
  // Extract paragraph-level blocks in document order so we render proper
  // <p> nodes (not a blob of joined text). Skips empty blocks.
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

function nextPaletteColor(usedHexes = []) {
  const used = new Set(usedHexes);
  return CHARACTER_PALETTE.find((c) => !used.has(c)) || CHARACTER_PALETTE[usedHexes.length % CHARACTER_PALETTE.length];
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
      sections: (ch.sections || [])
        .map((sec) => ({
          id: sec.id,
          sectionIndex: sec.sectionIndex,
          title: sec.title,
          html: sec.html || '',
          dialogueSpans: [],
          scanning: true,
        })),
    }))
    // Drop chapters whose total text body is tiny or empty (front matter).
    .filter((ch) => {
      const totalText = ch.sections.map((s) => stripTags(s.html)).join(' ').replace(/\s+/g, ' ').trim();
      return totalText.length > 60;  // arbitrary threshold for "real chapter"
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

function restoreAssignments(oldProject, freshChapters) {
  if (!oldProject) return freshChapters;
  const oldByKey = new Map();
  (oldProject.chapters || []).forEach((ch) => {
    (ch?.sections || []).forEach((sec) => {
      (sec?.dialogueSpans || []).forEach((sp, si) => {
        const k = `${ch.chapterIndex}|${sec.sectionIndex}|${si}|${sp.text}`;
        oldByKey.set(k, { characterId: sp.characterId, sideVoiceId: sp.sideVoiceId });
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
        return prev ? { ...sp, characterId: prev.characterId || null, sideVoiceId: prev.sideVoiceId || null } : sp;
      }),
    })),
  }));
}

export default function PrepManuscriptMode({ modeToggle, usesCustomDragRegion }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState({ chapterIndex: 0, sectionIndex: 0, spanIndex: 0 });
  const [addingChar, setAddingChar] = useState(false);
  const [sideVoicePopoverFor, setSideVoicePopoverFor] = useState(null);   // characterId
  const [sideVoiceAdding, setSideVoiceAdding] = useState(false);         // bool, paired with popoverFor
  const [saveStatus, setSaveStatus] = useState('idle');
  const saveTimerRef = useRef(null);
  const savedFlashRef = useRef(null);
  const dialogueRefs = useRef({});                                       // spanKey -> DOM node

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const electron = typeof window !== 'undefined' ? window.electron : null;
        if (!electron?.readPrepData) { setHydrated(true); return; }
        const list = await electron.readPrepData();
        if (cancelled) return;
        if (Array.isArray(list) && list.length > 0) {
          const last = list[list.length - 1];
          if (isCompatiblePrepProject(last)) setProject(last);
        }
      } catch {} finally { if (!cancelled) setHydrated(true); }
    })();
    return () => { cancelled = true; };
  }, []);

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
    const m = new Map();
    (project?.characters || []).forEach((c) => m.set(c.id, c));
    return m;
  }, [project]);

  const dialogueIndex = useMemo(() => {
    const list = [];
    (project?.chapters || []).forEach((ch) => {
      (ch?.sections || []).forEach((sec) => {
        (sec?.dialogueSpans || []).forEach((_, si) => {
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
    () => (project?.chapters || []).reduce(
      (n, ch) => n + (ch?.sections || []).reduce(
        (m, sec) => m + (sec?.dialogueSpans || []).filter((s) => s.characterId).length, 0
      ), 0
    ),
    [project]
  );

  const selectedChapter = project?.chapters?.find((c) => c.chapterIndex === selected.chapterIndex);
  const selectedSection = selectedChapter?.sections?.find((s) => s.sectionIndex === selected.sectionIndex);
  const selectedSpan = selectedSection?.dialogueSpans?.[selected.spanIndex];

  function spanKey(chapterIndex, sectionIndex, spanIndex) {
    return `${chapterIndex}|${sectionIndex}|${spanIndex}`;
  }

  function selectDialogue(chapterIndex, sectionIndex, spanIndex, { scroll = false } = {}) {
    setSelected({ chapterIndex, sectionIndex, spanIndex });
    if (scroll) {
      requestAnimationFrame(() => {
        const node = dialogueRefs.current[spanKey(chapterIndex, sectionIndex, spanIndex)];
        if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  function moveDialogue(step) {
    if (dialogueIndex.length === 0) return;
    const cur = Math.max(0, flatPos);
    const next = Math.max(0, Math.min(dialogueIndex.length - 1, cur + step));
    const target = dialogueIndex[next];
    selectDialogue(target.chapterIndex, target.sectionIndex, target.spanIndex, { scroll: true });
    setSideVoicePopoverFor(null);
    setSideVoiceAdding(false);
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
      const structure = applyChapterNumbers(parseManuscriptStructure(html, { chapterLevel: 1 }));

      const oldProject = project;
      const shell = buildShellFromStructure(file, structure);
      setProject(shell);
      setSelected({ chapterIndex: shell.chapters[0]?.chapterIndex || 0, sectionIndex: 0, spanIndex: 0 });

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
        sideVoices: [],
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
        sections: ch.sections.map((sec) => ({
          ...sec,
          dialogueSpans: sec.dialogueSpans.map((s) => (s.characterId === id ? { ...s, characterId: null, sideVoiceId: null } : s)),
        })),
      })),
    }));
  }
  function addSideVoice(characterId, prefill = {}) {
    setProject((p) => p && ({
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
    setProject((p) => p && ({
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

  function assignCurrent({ characterId = null, sideVoiceId = null } = {}) {
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
                si === selected.spanIndex ? { ...s, characterId: characterId || null, sideVoiceId: sideVoiceId || null } : s
              ),
            };
          }),
        };
      });
      return { ...p, chapters };
    });
    setSideVoicePopoverFor(null);
    setSideVoiceAdding(false);
  }

  async function exportHighlightedDocx() {
    if (!project) return;
    try {
      const flat = flattenProjectForExport(project, charactersById);
      const blob = await buildPrepHighlightedDocxBlob(flat);
      downloadBlob(blob, exportFileNames.docx(flat));
    } catch (e) { setError(e?.message || 'Could not export highlighted .docx'); }
  }
  function exportDialogueCsv() {
    if (!project) return;
    const flat = flattenProjectForExport(project, charactersById);
    downloadText(buildPrepCsv(flat), exportFileNames.fullCsv(flat), 'text/csv;charset=utf-8');
  }
  function exportNarratorChapterCsv() {
    if (!project) return;
    const flat = flattenProjectForExport(project, charactersById);
    downloadText(buildPrepNarratorChapterCsv(flat), exportFileNames.chapterCsv(flat), 'text/csv;charset=utf-8');
  }

  return (
    <div style={{ minHeight: '100vh', background: READER_PAGE_BG, paddingTop: usesCustomDragRegion ? 24 : 0 }}>
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
          <div style={{ maxWidth: 'none', margin: '0 auto', padding: '88px 0 220px' }}>
            <div style={{ width: READER_WIDTH, margin: '0 auto' }}>
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
            </div>
            <ReaderPage
              project={project}
              charactersById={charactersById}
              selected={selected}
              onSelectDialogue={(ch, sec, sp) => selectDialogue(ch, sec, sp, { scroll: false })}
              dialogueRefs={dialogueRefs}
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
            onAssignCharacter={(charId) => {
              const isSame = selectedSpan?.characterId === charId && !selectedSpan?.sideVoiceId;
              assignCurrent(isSame ? {} : { characterId: charId });
            }}
            onAssignSideVoice={(charId, sideId) => assignCurrent({ characterId: charId, sideVoiceId: sideId })}
            onAddCharacter={addCharacter}
            onUpdateCharacter={updateCharacter}
            onRemoveCharacter={removeCharacter}
            onAddSideVoice={addSideVoice}
            onRemoveSideVoice={removeSideVoice}
            addingChar={addingChar}
            setAddingChar={setAddingChar}
            sideVoicePopoverFor={sideVoicePopoverFor}
            setSideVoicePopoverFor={setSideVoicePopoverFor}
            sideVoiceAdding={sideVoiceAdding}
            setSideVoiceAdding={setSideVoiceAdding}
          />
        </>
      )}
    </div>
  );
}

// Flatten chapter/section/sideVoice tree → shape prepExport.js expects.
function flattenProjectForExport(project, charactersById) {
  return {
    ...project,
    characters: (project.characters || []).map((c) => ({
      id: c.id, name: c.name, narratorName: c.narratorName, colorHex: c.colorHex,
    })),
    chapters: (project.chapters || []).map((ch) => ({
      title: ch.title,
      spans: ch.sections.flatMap((sec) =>
        sec.dialogueSpans.map((sp) => {
          const char = sp.characterId ? charactersById.get(sp.characterId) : null;
          const sv = char && sp.sideVoiceId ? (char.sideVoices || []).find((s) => s.id === sp.sideVoiceId) : null;
          return {
            text: sp.text,
            afterText: sp.afterText,
            characterId: sp.characterId,
            narratorOverride: sv?.narratorName || '',
          };
        })
      ),
    })),
  };
}

function ImportEmptyState({ onPick, loading, progress, error }) {
  const label = progress && progress.total > 0 ? `${progress.title} — ${progress.current}/${progress.total}` : (progress?.title || '');
  return (
    <section style={{ padding: '28px 24px', background: PASTEL_PREP, border: '1px solid ' + PREP_INK + '33', borderRadius: 22, color: 'var(--text)', textAlign: 'center' }}>
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
    <section style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(220, 235, 224, 0.55)', border: '1px solid ' + PREP_INK + '22', borderRadius: 10, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, fontSize: '0.72rem' }}>
        <strong style={{ color: 'var(--text)' }}>{project.fileName}</strong>
        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
          {project.chapters.length} ch · {totalAssigned}/{totalDialogue} assigned ({pct}%)
          {scanning && <> · <span style={{ color: PREP_INK, fontWeight: 600 }}>scanning {progress.current}/{progress.total}…</span></>}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SaveBadge status={saveStatus} />
        <label style={{ padding: '5px 10px', background: 'white', border: '1px solid ' + PREP_INK, color: PREP_INK, fontSize: '0.68rem', fontWeight: 700, borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Replace
          <input type="file" accept=".docx" onChange={(e) => e.target.files?.[0] && onReplace(e.target.files[0])} style={{ display: 'none' }} />
        </label>
      </div>
    </section>
  );
}

function SaveBadge({ status }) {
  const map = {
    idle:   { label: 'Saved', color: 'var(--text-light)', dot: '#b5cbb9' },
    saving: { label: 'Saving…', color: PREP_INK, dot: '#f3c93a' },
    saved:  { label: 'Saved', color: PREP_INK, dot: '#3F8F65' },
  };
  const m = map[status] || map.idle;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', fontWeight: 600, color: m.color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot }} />
      {m.label}
    </div>
  );
}

function ExportToolbar({ onDocx, onDialogueCsv, onNarratorCsv, hasCharacters }) {
  const btn = (active) => ({ padding: '5px 10px', background: 'white', border: '1px solid ' + PREP_INK, color: PREP_INK, fontSize: '0.66rem', fontWeight: 700, borderRadius: 999, cursor: 'pointer', opacity: active ? 1 : 0.55, whiteSpace: 'nowrap' });
  return (
    <section style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
      <button type="button" onClick={onDocx} style={btn(hasCharacters)}>Export highlighted .docx</button>
      <button type="button" onClick={onDialogueCsv} style={btn(true)}>Export dialogue (CSV)</button>
      <button type="button" onClick={onNarratorCsv} style={btn(true)}>Export narrators by chapter (CSV)</button>
    </section>
  );
}

function ReaderPage({ project, charactersById, selected, onSelectDialogue, dialogueRefs }) {
  return (
    <div
      style={{
        width: READER_WIDTH,
        margin: '0 auto',
        padding: '0 0.35rem 2rem',
        fontSize: READER_FONT_SIZE,
        lineHeight: READER_LINE_HEIGHT,
        color: 'var(--text)',
      }}
    >
      {project.chapters.map((ch) => (
        <section key={ch.id} style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: PREP_INK, margin: '0 0 18px 0', textAlign: 'center' }}>
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
              dialogueRefs={dialogueRefs}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function SectionBody({ section, chapterIndex, charactersById, selected, onSelectDialogue, dialogueRefs }) {
  if (!section.html && section.scanning) return <p style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>(scanning…)</p>;
  if (!section.html) return null;

  const blocks = useMemo(() => paragraphsFromHtml(section.html), [section.html]);
  const spans = section.dialogueSpans || [];
  // Build a flat list of (paragraphIndex, spanIndex) so we render spans
  // in document order, advancing the cursor within each paragraph.
  // Simple approach: scan all paragraphs in order, using a single cursor.
  let spanCursor = 0;
  const renderedBlocks = blocks.map((block, bi) => {
    const segments = [];
    let cursor = 0;
    const text = block.text;
    // While spans are still left, try to place the next span(s) inside
    // this paragraph by indexOf.
    while (spanCursor < spans.length) {
      const sp = spans[spanCursor];
      const needle = sp.text || '';
      if (!needle) { spanCursor++; continue; }
      const where = text.indexOf(needle, cursor);
      if (where === -1) break;  // span not in this paragraph; move on
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
          const isSelected = selected.chapterIndex === chapterIndex && selected.sectionIndex === section.sectionIndex && selected.spanIndex === seg.spanIndex;
          const bg = char ? char.colorHex : (isSelected ? '#FFF6CC' : 'transparent');
          const refKey = `${chapterIndex}|${section.sectionIndex}|${seg.spanIndex}`;
          return (
            <button
              key={i}
              ref={(el) => { if (el) dialogueRefs.current[refKey] = el; else delete dialogueRefs.current[refKey]; }}
              type="button"
              onClick={() => onSelectDialogue(chapterIndex, section.sectionIndex, seg.spanIndex)}
              title={char ? `${char.name}${sv ? ' / ' + sv.name : ''}` : 'Unassigned'}
              style={{
                background: bg,
                border: '1px solid ' + (isSelected ? PREP_INK : (char ? PREP_INK + '66' : '#e3d8b0')),
                borderRadius: 6,
                padding: '0 6px',
                margin: '0 1px',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                color: 'var(--text)',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 0 0 2px rgba(63, 106, 82, 0.25)' : 'none',
              }}
              aria-label={`Dialogue`}
            >
              “{seg.text}”
            </button>
          );
        })}
      </Tag>
    );
  });
  return <>{renderedBlocks}</>;
}

function AssignmentDock({
  project, charactersById, selectedSpan, selectedChapter, selectedSection,
  positionLabel, onPrev, onNext,
  onAssignCharacter, onAssignSideVoice,
  onAddCharacter, onUpdateCharacter, onRemoveCharacter,
  onAddSideVoice, onRemoveSideVoice,
  addingChar, setAddingChar,
  sideVoicePopoverFor, setSideVoicePopoverFor,
  sideVoiceAdding, setSideVoiceAdding,
}) {
  const characters = project.characters || [];
  const currentChar = selectedSpan?.characterId ? charactersById.get(selectedSpan.characterId) : null;
  const currentSV = currentChar && selectedSpan?.sideVoiceId ? (currentChar.sideVoices || []).find((s) => s.id === selectedSpan.sideVoiceId) : null;

  return (
    <div
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        background: 'rgba(255,255,255,0.94)',
        borderTop: '1px solid var(--border-light)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 -8px 28px rgba(0,0,0,0.05)',
        zIndex: 1200,
        padding: '8px 16px 10px',
      }}
    >
      <div style={{ width: READER_WIDTH, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Row 1: position + current dialogue + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
            <button type="button" onClick={onPrev} style={dockBtn(false)}>←</button>
            <button type="button" onClick={onNext} style={dockBtn(true)}>Next →</button>
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontWeight: 700, color: PREP_INK, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{positionLabel}</span>
            {selectedChapter && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                · {selectedChapter.title}{selectedSection && selectedSection.title !== selectedChapter.title ? ' · ' + selectedSection.title : ''}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.68rem', color: currentChar ? PREP_INK : 'var(--text-light)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {currentChar
              ? <>→ {currentChar.name || 'Unnamed'}{currentSV ? ' / ' + currentSV.name : (currentChar.narratorName ? ' / ' + currentChar.narratorName : '')}</>
              : 'Unassigned'}
          </div>
        </div>

        {/* Row 2: dialogue text */}
        <div style={{ padding: '6px 10px', background: currentChar?.colorHex || 'white', border: '1px solid ' + (currentChar ? PREP_INK + '33' : 'var(--border-light)'), borderRadius: 8, fontSize: '0.82rem', fontFamily: 'Georgia, serif', lineHeight: 1.45, color: 'var(--text)', maxHeight: 56, overflow: 'auto' }}>
          {selectedSpan ? <>“{selectedSpan.text}”</> : <span style={{ color: 'var(--text-light)' }}>{project.chapters.length ? 'Click a dialogue in the manuscript to assign.' : 'Import a manuscript.'}</span>}
        </div>

        {/* Row 3: characters */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
          {characters.map((c) => (
            <CharacterChip
              key={c.id}
              character={c}
              isCurrent={selectedSpan?.characterId === c.id && !selectedSpan?.sideVoiceId}
              currentSideVoiceId={selectedSpan?.characterId === c.id ? selectedSpan?.sideVoiceId : null}
              popoverOpen={sideVoicePopoverFor === c.id}
              sideVoiceAdding={sideVoicePopoverFor === c.id && sideVoiceAdding}
              onClickAssign={() => onAssignCharacter(c.id)}
              onOpenSidePopover={() => { setSideVoicePopoverFor(c.id); setSideVoiceAdding(false); }}
              onCloseSidePopover={() => { setSideVoicePopoverFor(null); setSideVoiceAdding(false); }}
              onPickSideVoice={(sv) => onAssignSideVoice(c.id, sv.id)}
              onStartAddSideVoice={() => setSideVoiceAdding(true)}
              onSaveSideVoice={(payload) => { onAddSideVoice(c.id, payload); setSideVoiceAdding(false); }}
              onRemoveSideVoice={(sv) => onRemoveSideVoice(c.id, sv.id)}
              onEditCharacter={(patch) => onUpdateCharacter(c.id, patch)}
              onRemoveCharacter={() => onRemoveCharacter(c.id)}
            />
          ))}
          {!addingChar && (
            <button type="button" onClick={() => setAddingChar(true)} style={{ padding: '5px 10px', background: 'transparent', color: PREP_INK, border: '1px dashed ' + PREP_INK + '99', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Add character
            </button>
          )}
          {addingChar && (
            <AddCharacterInline existingCount={characters.length} onSave={onAddCharacter} onCancel={() => setAddingChar(false)} />
          )}
        </div>
      </div>
    </div>
  );
}

function dockBtn(primary) {
  return {
    padding: '5px 12px',
    background: primary ? PREP_INK : 'white',
    color: primary ? 'white' : PREP_INK,
    border: '1px solid ' + PREP_INK,
    borderRadius: 999,
    fontSize: '0.68rem',
    fontWeight: 700,
    cursor: 'pointer',
  };
}

function AddCharacterInline({ existingCount, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [narrator, setNarrator] = useState('');
  const preset = CHARACTER_PALETTE[existingCount % CHARACTER_PALETTE.length];
  const [color, setColor] = useState(preset);
  return (
    <div style={{ background: color, border: '1px solid ' + PREP_INK + '33', borderRadius: 999, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Character"
        style={{ width: 90, padding: '2px 6px', fontSize: '0.7rem', fontWeight: 600, borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
      <input value={narrator} onChange={(e) => setNarrator(e.target.value)} placeholder="Narrator"
        style={{ width: 80, padding: '2px 6px', fontSize: '0.68rem', borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 20, height: 20, padding: 0, border: '1px solid var(--border)', borderRadius: 4, background: 'white', cursor: 'pointer' }} />
      <button type="button" onClick={onCancel} style={{ padding: '2px 6px', background: 'white', border: '1px solid var(--border)', borderRadius: 999, fontSize: '0.66rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
      <button type="button" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), narratorName: narrator.trim(), colorHex: color })}
        style={{ padding: '2px 10px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>Save</button>
    </div>
  );
}

function CharacterChip({
  character, isCurrent, currentSideVoiceId,
  popoverOpen, sideVoiceAdding,
  onClickAssign, onOpenSidePopover, onCloseSidePopover,
  onPickSideVoice, onStartAddSideVoice, onSaveSideVoice, onRemoveSideVoice,
  onEditCharacter, onRemoveCharacter,
}) {
  const [editing, setEditing] = useState(false);
  const sideVoices = character.sideVoices || [];

  if (editing) {
    return (
      <div style={{ background: character.colorHex, border: '1px solid ' + PREP_INK + '44', borderRadius: 999, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <input value={character.name} onChange={(e) => onEditCharacter({ name: e.target.value })}
          style={{ width: 85, padding: '2px 6px', fontSize: '0.7rem', fontWeight: 600, borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
        <input value={character.narratorName} placeholder="narrator" onChange={(e) => onEditCharacter({ narratorName: e.target.value })}
          style={{ width: 75, padding: '2px 6px', fontSize: '0.68rem', borderRadius: 4, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.85)' }} />
        <input type="color" value={character.colorHex} onChange={(e) => onEditCharacter({ colorHex: e.target.value })} style={{ width: 20, height: 20, padding: 0, border: '1px solid var(--border)', borderRadius: 4, background: 'white', cursor: 'pointer' }} />
        <button type="button" onClick={onRemoveCharacter} style={{ padding: '2px 6px', background: 'white', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 999, fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer' }}>Remove</button>
        <button type="button" onClick={() => setEditing(false)} style={{ padding: '2px 10px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer' }}>Done</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: character.colorHex, border: '1px solid ' + (isCurrent ? PREP_INK : PREP_INK + '33'), borderRadius: 999, padding: '3px 4px 3px 10px', boxShadow: isCurrent ? '0 0 0 2px rgba(63, 106, 82, 0.22)' : 'none' }}>
        <button
          type="button"
          onClick={onClickAssign}
          onDoubleClick={() => setEditing(true)}
          title={isCurrent ? 'Click to unassign · double-click to edit' : 'Assign · double-click to edit'}
          style={{ background: 'transparent', border: 'none', padding: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {character.name || 'Unnamed'}
          {character.narratorName && <span style={{ marginLeft: 4, fontWeight: 500, fontSize: '0.66rem', color: 'var(--text-muted)' }}>/ {character.narratorName}</span>}
        </button>
        <button
          type="button"
          onClick={() => (popoverOpen ? onCloseSidePopover() : onOpenSidePopover())}
          aria-label="Side voices"
          title="Side voices for this character"
          style={{ marginLeft: 2, background: 'rgba(255,255,255,0.8)', border: '1px solid ' + PREP_INK + '33', borderRadius: '50%', width: 18, height: 18, padding: 0, fontSize: '0.7rem', fontWeight: 800, color: PREP_INK, cursor: 'pointer', lineHeight: 1 }}
        >+</button>
      </div>
      {popoverOpen && (
        <div
          style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
            zIndex: 1300,
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
            padding: 8,
            minWidth: 220,
            maxWidth: 280,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}
        >
          <div style={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-light)', marginBottom: 2 }}>
            Side voices · {character.name || 'Unnamed'}
          </div>
          {sideVoices.length === 0 && !sideVoiceAdding && (
            <div style={{ fontSize: '0.7rem', color: 'var(--text-light)', padding: '4px 2px' }}>None yet.</div>
          )}
          {sideVoices.map((sv) => (
            <div key={sv.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => onPickSideVoice(sv)}
                style={{
                  flex: 1, textAlign: 'left',
                  padding: '6px 8px',
                  background: currentSideVoiceId === sv.id ? PREP_INK + '11' : 'transparent',
                  border: '1px solid ' + (currentSideVoiceId === sv.id ? PREP_INK : 'var(--border-light)'),
                  borderRadius: 8,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                <div>{sv.name}{sv.narratorName ? <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}> / {sv.narratorName}</span> : null}</div>
                <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-light)', marginTop: 1 }}>{sv.recurring ? 'recurring' : 'one-time'}{sv.notes ? ' · ' + sv.notes : ''}</div>
              </button>
              <button type="button" onClick={() => onRemoveSideVoice(sv)} aria-label="Remove" style={{ padding: '2px 6px', background: 'white', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.62rem', fontWeight: 600, cursor: 'pointer' }}>×</button>
            </div>
          ))}
          {sideVoiceAdding ? (
            <AddSideVoiceInline characterNarrator={character.narratorName} onSave={onSaveSideVoice} onCancel={() => onCloseSidePopover()} />
          ) : (
            <button
              type="button"
              onClick={onStartAddSideVoice}
              style={{ padding: '6px 8px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', marginTop: 4 }}
            >+ Add side voice…</button>
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
        style={{ padding: '5px 8px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', background: 'white' }} />
      <input value={narrator} onChange={(e) => setNarrator(e.target.value)} placeholder="Narrator (optional)"
        style={{ padding: '5px 8px', fontSize: '0.7rem', borderRadius: 6, border: '1px solid var(--border)', background: 'white' }} />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (sweet, gruff, etc.)"
        style={{ padding: '5px 8px', fontSize: '0.68rem', borderRadius: 6, border: '1px solid var(--border)', background: 'white' }} />
      <div style={{ display: 'flex', gap: 4 }}>
        <button type="button" onClick={() => setRecurring(true)} style={pillStyle(recurring)}>Recurring</button>
        <button type="button" onClick={() => setRecurring(false)} style={pillStyle(!recurring)}>One-time</button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
        <button type="button" onClick={onCancel} style={{ flex: 1, padding: '4px 8px', background: 'white', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button type="button" disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), narratorName: narrator.trim(), notes: notes.trim(), recurring })}
          style={{ flex: 1, padding: '4px 8px', background: PREP_INK, color: 'white', border: 'none', borderRadius: 6, fontSize: '0.68rem', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>Save & assign</button>
      </div>
    </div>
  );
}

function pillStyle(active) {
  return {
    flex: 1,
    padding: '4px 8px',
    background: active ? PREP_INK : 'white',
    color: active ? 'white' : 'var(--text-muted)',
    border: '1px solid ' + (active ? PREP_INK : 'var(--border)'),
    borderRadius: 999,
    fontSize: '0.66rem',
    fontWeight: 700,
    cursor: 'pointer',
  };
}
