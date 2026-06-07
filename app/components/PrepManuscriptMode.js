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
import { detectDialogueSpansInHtml, stripHtml as engineStripHtml, mergeDialogueAssignmentsByOccurrence } from '../../packages/manuscript-engine/index.js';
import {
  buildPrepHighlightedDocxBlob,
  buildPrepCsv,
  buildPrepNarratorChapterCsv,
  downloadBlob,
  downloadText,
  exportFileNames,
} from './prepExport.js';
// Shared reader chrome. Universal across every mode. If Marie wants to
// change the chapter pill / save badge / sticky bar everywhere, this is
// the one file to edit.
import {
  READER_WIDTH,
  READER_PAGE_BG,
  READER_FONT_SIZE,
  READER_LINE_HEIGHT,
  HOME_CONTAINER,
  MODE_TOKENS,
  ChapterContextPill,
  SaveBadge as SharedSaveBadge,
  StickyTopBar as SharedStickyTopBar,
  HomeBackPill as SharedHomeBackPill,
  topBtnStyle,
  pillBtnStyle,
  useDismissable as sharedUseDismissable,
} from './ReaderChrome.js';
// One shared upload + chapter-picker for every mode. Replaces Prep's old
// inline SetupView + Duet's PrebuildManuscriptUpload.
import ImportFlow from './ImportFlow.js';
import AppDialog from './AppDialog';
import { buildSlimPageMap, extractManuscriptWordsFromHtml } from '../lib/pdfPaging.js';
import { classifyCharacterMarker } from '../lib/characterMarker.js';
import { CHARACTER_PALETTE, nextPaletteColor } from '../lib/characterPalette.js';

const TONE = 'prep';
const PASTEL_PREP = MODE_TOKENS.prep.pastel;
const PREP_INK = MODE_TOKENS.prep.ink;
// Mid-tone "accent" — what we now use for primary button backgrounds.
// PREP_INK still backs text, borders, and progress lines (it's the
// dark anchor of the palette), but buttons in the dock and on inline
// forms use this softer pastel-y accent so the UI doesn't feel
// wine-coloured.
const PREP_ACCENT = MODE_TOKENS.prep.accent || MODE_TOKENS.prep.ink;
const useDismissable = sharedUseDismissable;
const SaveBadge = (props) => <SharedSaveBadge {...props} tone={TONE} />;
const StickyTopBar = (props) => <SharedStickyTopBar {...props} tone={TONE} />;
const HomeBackPill = (props) => <SharedHomeBackPill {...props} tone={TONE} />;

// Ten pastels in the order Marie wants — pink first, then warm tones,
// then cool tones. These are the BASE colors for each character chip;
// side voices get progressively darker shades of the chosen base via
// darkenHex() so a character + side voice still visually relate.
// Marie can override any chip's base via the colour picker.
// Marie 2026-05-26: "got this pink, this red, but it's not pink. I like
// pink. Pink pink is default." Re-ordered so the first two characters
// added are both pink-family before stepping out to peach / yellow.
// Marie 2026-06-06: matched to ManuscriptSetup.js DEFAULT_MANUAL_COLORS
// so adding a new character in Prep cycles through the SAME swatches
// the rest of the app uses (Proof's narrator setup, etc.). Pink first
// so it looks identical when Marie clicks "+ Add character" anywhere.
const CHARACTER_PALETTE = [
  '#f8bbd0', // pink
  '#c8e6c9', // mint
  '#bbdefb', // blue
  '#e1bee7', // lavender
  '#ffcdd2', // rose
  '#ffe0b2', // peach
  '#fff9c4', // yellow
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

// Darken a pastel by `amount` (0-1). Used for side-voice tint so a
// side voice of "Crescent (light pink)" reads as a deeper pink than
// Crescent herself.
function darkenHex(hex, amount = 0.15) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return hex;
  const r = Math.max(0, parseInt(h.slice(0, 2), 16) - Math.round(255 * amount));
  const g = Math.max(0, parseInt(h.slice(2, 4), 16) - Math.round(255 * amount));
  const b = Math.max(0, parseInt(h.slice(4, 6), 16) - Math.round(255 * amount));
  const px = (n) => n.toString(16).padStart(2, '0');
  return '#' + px(r) + px(g) + px(b);
}

// Pick the right tint for a dialogue/chip given a character + optional
// side voice. Each side voice gets progressively darker so multiple
// side voices on one character are visually distinguishable.
function colorForAssignment(character, sideVoice) {
  if (!character) return null;
  if (!sideVoice) return character.colorHex;
  const idx = (character.sideVoices || []).findIndex((s) => s.id === sideVoice.id);
  const step = Math.max(1, idx + 1);  // 1, 2, 3...
  return darkenHex(character.colorHex, Math.min(0.45, 0.12 * step));
}

// Decode the XML/HTML entities mammoth leaves in the chapter HTML
// (mostly &amp;, &lt;, &gt;, &quot;, plus &#NNNN; numeric refs for
// smart quotes and ellipses). The dialogue engine decodes these on
// its side, so without matching decoding here the indexOf fails and
// affected dialogues never render — that's the bug that made Next
// "lose connection" mid-chapter for Marie.
function decodeHtmlEntities(s = '') {
  return String(s).replace(
    /&#(\d+);|&#x([0-9a-fA-F]+);|&(amp|lt|gt|quot|apos|nbsp);/g,
    (_, dec, hex, named) => {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      switch (named) {
        case 'amp': return '&';
        case 'lt': return '<';
        case 'gt': return '>';
        case 'quot': return '"';
        case 'apos': return "'";
        case 'nbsp': return ' ';
        default: return _;
      }
    }
  );
}

function paragraphsFromHtml(html = '') {
  const blocks = [];
  const re = /<(p|h1|h2|h3|h4|h5|h6|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    // CRITICAL: use the engine's stripHtml here. It replaces tags with
    // a space (not an empty string), which matters when inline <span>
    // or <em> splits a word — the engine sees "Really ?" with a space,
    // and the reader has to see the exact same thing or indexOf fails
    // and the dialogue span doesn't render. That bug stopped Next from
    // advancing past every italic-mid-quote dialogue in the manuscript.
    const text = engineStripHtml(m[2]);
    if (!text) continue;
    blocks.push({ tag, text, isHeading: /^h\d$/.test(tag) });
  }
  if (blocks.length === 0) {
    const fallback = engineStripHtml(html);
    if (fallback) blocks.push({ tag: 'p', text: fallback, isHeading: false });
  }
  return blocks;
}

// The engine emits ONE warning type now: missing-closing-quote, only
// when the next quote mark is more than ~3 paragraphs after the
// orphaned open. We pass it straight through.
function detectSectionSpans(sectionHtml = '', chapterIdx = 0, sectionIdx = 0) {
  let raw = [];
  let issues = [];
  let totalQuoteMarks = 0;
  let quoteMarksEven = true;
  try {
    const result = detectDialogueSpansInHtml(sectionHtml) || {};
    raw = Array.isArray(result.dialogueSpans) ? result.dialogueSpans : [];
    issues = Array.isArray(result.issues) ? result.issues : [];
    totalQuoteMarks = Number(result.totalQuoteMarks || 0);
    quoteMarksEven = result.quoteMarksEven !== false;
  } catch {
    raw = [];
  }
  const dialogueSpans = raw.map((s, si) => ({
    id: `span-${chapterIdx}-${sectionIdx}-${si}`,
    text: (s.text || '').trim(),
    afterText: (s.afterText || '').trim(),
    characterId: null,
    sideVoiceId: null,
  }));
  return { dialogueSpans, issues, totalQuoteMarks, quoteMarksEven };
}

function isCompatiblePrepProject(p) {
  if (!p || !Array.isArray(p.chapters)) return false;
  return p.chapters.every((ch) => Array.isArray(ch?.sections));
}

function chapterCounts(chapter) {
  const sections = chapter.sections || [];
  const all = sections.flatMap((s) => s.dialogueSpans || []);
  const allIssues = sections.flatMap((s) => s.safetyIssues || []);
  return {
    total: all.length,
    assigned: all.filter((s) => s.characterId).length,
    scanning: sections.some((s) => s.scanning),
    issues: allIssues.length,
    blockingIssues: allIssues.filter((i) => i.blocking !== false).length,
  };
}

function projectCounts(project) {
  let total = 0, assigned = 0, scanning = false, issues = 0, blockingIssues = 0;
  (project.chapters || []).forEach((ch) => {
    const c = chapterCounts(ch);
    total += c.total;
    assigned += c.assigned;
    issues += c.issues;
    blockingIssues += c.blockingIssues;
    if (c.scanning) scanning = true;
  });
  return { total, assigned, scanning, issues, blockingIssues };
}

// ===========================================================================
// Character / word-count analysis for the breakdown popup and per-chapter
// character pills. Same approach as Proof's tallyCharacterWordCountsDom:
// walk H1/H2/H3 headings in DOM order; whenever a heading's text matches
// a character name (fuzzy), that character becomes the "active" attribution
// for all text following it — until the next character-named heading.
//
// Marie's spec: "let's say vandal and crescent, and it detects vandal in
// a head of one, then it will go until it finds crescent in a head of one,
// and that's the amount of words it would count. But if there's nothing
// in the header ones for the names, then you look for head of twos. And
// maybe even just to cover any funny formats, maybe it looks at both."
// Walking ALL heading levels at once does exactly that — H1 character
// headings win if present; H2/H3 headings cover the case where chapters
// are H1 and scenes are H2.
// ===========================================================================
function _prepNormName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function _prepNameMatches(a, b) {
  const na = _prepNormName(a);
  const nb = _prepNormName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}
const PREP_NARRATOR_KEY = '__narrator__';

function analyzePrepChapterByCharacter(html, characters) {
  const result = { headingCharacters: [], wordTallies: {}, totalWords: 0 };
  if (typeof document === 'undefined' || !html) return result;
  const mapping = (characters || []).filter((c) => (c?.name || '').trim());
  if (!mapping.length) return result;

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:absolute;left:-99999px;top:-99999px;visibility:hidden;pointer-events:none;width:600px;';
  host.innerHTML = String(html);
  document.body.appendChild(host);

  const seenChars = new Set();
  try {
    // Headings + plain block-level paragraphs whose entire trimmed
    // text is EXACTLY a character name. Mirrors Proof's
    // tallyCharacterWordCountsDom — Vellum-style manuscripts drop
    // the POV character name as a standalone `<p>Vex</p>` above
    // the scene's prose, not as a heading. Strict equality avoids
    // body paragraphs that mention the name being mistaken for a
    // scene boundary.
    const blocks = Array.from(host.querySelectorAll('h1,h2,h3,h4,h5,h6,p,div'));
    const headingEntries = [];
    for (const el of blocks) {
      const text = (el.textContent || '').trim();
      const classified = classifyCharacterMarker(el.tagName, text, mapping);
      if (classified) headingEntries.push({ el, char: classified.char });
    }
    function activeCharFor(el) {
      let last = null;
      for (const h of headingEntries) {
        const rel = h.el.compareDocumentPosition(el);
        if ((rel & Node.DOCUMENT_POSITION_FOLLOWING) || h.el === el) {
          if (h.char) {
            last = h.char;
            if (!seenChars.has(h.char)) {
              seenChars.add(h.char);
              result.headingCharacters.push(h.char);
            }
          }
        } else if (rel & Node.DOCUMENT_POSITION_PRECEDING) {
          break;
        }
      }
      return last;
    }
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.nodeValue || '';
      const wordCount = (text.match(/\S+/g) || []).length;
      if (!wordCount) continue;
      result.totalWords += wordCount;
      const char = activeCharFor(node.parentElement);
      const key = char || PREP_NARRATOR_KEY;
      result.wordTallies[key] = (result.wordTallies[key] || 0) + wordCount;
    }
  } finally {
    document.body.removeChild(host);
  }
  return result;
}

// ===========================================================================
// Root component
// ===========================================================================

export default function PrepManuscriptMode({ modeToggle, usesCustomDragRegion }) {
  const [allProjects, setAllProjects] = useState([]);   // PrepProject[]
  const [view, setView] = useState('home');             // 'home' | 'setup' | 'bookDetail' | 'reader'
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [selected, setSelected] = useState({ sectionIndex: 0, spanIndex: 0 });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  // When set, the next ImportFlow confirm will REPLACE this project's
  // contents (preserve id + characters where possible) instead of
  // creating a brand-new project.
  const [replacingProjectId, setReplacingProjectId] = useState(null);
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

  // ---- import: ImportFlow drives the upload + chapter picker. This
  // commit step turns its payload into a Prep project (one section per
  // chapter — Prep doesn't sub-split) and runs dialogue detection in
  // the background so Marie can already be poking around the book
  // detail screen while it scans.
  async function commitImport(payload) {
    const sourceDocxBase64 = payload.sourceDocxBase64 || '';
    const chapters = (payload.chapters || []).map((ch, i) => ({
      id: uid('ch'),
      chapterIndex: i,
      chapterNumber: ch.chapterNumber || i + 1,
      title: ch.title || `Chapter ${i + 1}`,
      sections: [{
        id: uid('sec'),
        sectionIndex: 0,
        title: ch.title || `Chapter ${i + 1}`,
        html: ch.html || '',
        dialogueSpans: [],
        scanning: true,
      }],
    }));

    const replacing = replacingProjectId
      ? allProjects.find((p) => p.id === replacingProjectId)
      : null;

    const shell = {
      id: replacing ? replacing.id : uid('prep'),
      title: payload.title || 'Untitled',
      fileName: payload.fileName || '',
      importedAt: replacing ? replacing.importedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Preserve characters across a replace so Marie doesn't lose her
      // cast when she swaps a corrected manuscript in.
      characters: replacing ? (replacing.characters || []) : [],
      chapters,
      sourceDocxBase64,
      // Marie 2026-05-26: PDF page map from auto-scan during import.
      // Preserved on replace so the user doesn't need to re-scan when
      // swapping in a corrected .docx.
      pdfPaging: payload.pdfPaging || (replacing ? replacing.pdfPaging : null),
      pdfFileName: payload.pdfFileName || (replacing ? replacing.pdfFileName : '') || '',
      pdfSource: payload.pdfSource || (replacing ? replacing.pdfSource : null) || null,
      pageNumberAdjustment: Number(payload.pageNumberAdjustment) || (replacing ? (replacing.pageNumberAdjustment || 0) : 0),
    };

    setAllProjects((all) => {
      if (replacing) return all.map((p) => (p.id === replacing.id ? shell : p));
      return [...all, shell];
    });
    setActiveProjectId(shell.id);
    setReplacingProjectId(null);
    setView('bookDetail');

    setLoading(true);
    setError('');
    const totalSections = shell.chapters.reduce((n, ch) => n + ch.sections.length, 0);
    let processed = 0;
    try {
      for (const ch of shell.chapters) {
        for (const sec of ch.sections) {
          processed += 1;
          setProgress({
            current: processed,
            total: totalSections,
            title: ch.title || `Chapter ${ch.chapterIndex + 1}`,
          });
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 0));
          const { dialogueSpans, issues, totalQuoteMarks, quoteMarksEven } = detectSectionSpans(sec.html || '', ch.chapterIndex, sec.sectionIndex);
          setAllProjects((all) => all.map((p) => {
            if (p.id !== shell.id) return p;
            const newChapters = p.chapters.map((cch) => {
              if (cch.chapterIndex !== ch.chapterIndex) return cch;
              return {
                ...cch,
                sections: cch.sections.map((csec) =>
                  csec.sectionIndex !== sec.sectionIndex ? csec : {
                    ...csec,
                    dialogueSpans,
                    safetyIssues: issues,
                    totalQuoteMarks,
                    quoteMarksEven,
                    scanning: false,
                  }
                ),
              };
            });
            return { ...p, chapters: newChapters };
          }));
        }
      }
    } finally {
      setProgress(null);
      setLoading(false);
    }
  }

  function cancelImport() {
    setReplacingProjectId(null);
    setView(activeProjectId ? 'bookDetail' : 'home');
  }

  function startReplaceManuscript() {
    if (!activeProject) return;
    setReplacingProjectId(activeProject.id);
    setView('setup');
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
    // Generate the id synchronously so the caller can immediately
    // assign the currently-selected dialogue to the new character —
    // Marie expects "add character" inside the reader to assign that
    // character to the selected line in one step.
    const newId = uid('char');
    updateActive((p) => {
      const used = (p.characters || []).map((c) => c.colorHex);
      const newChar = {
        id: newId,
        name: prefill.name || 'New character',
        narratorName: prefill.narratorName || '',
        colorHex: prefill.colorHex || nextPaletteColor(used),
        sideVoices: [],
      };
      return { ...p, characters: [...(p.characters || []), newChar] };
    });
    return newId;
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

  // Remove a chapter from the active project. Re-numbers everything
  // afterwards so the remaining chapters become 1..N. Used by the
  // "Edit chapters" cog in the book detail — Marie accidentally left
  // a chapter in on import and didn't want to re-import to fix it.
  function removeChapter(chapterIndex) {
    updateActive((p) => {
      const filtered = (p.chapters || []).filter((ch) => ch.chapterIndex !== chapterIndex);
      const reindexed = filtered.map((ch, i) => ({
        ...ch,
        chapterIndex: i,
        chapterNumber: i + 1,
      }));
      return { ...p, chapters: reindexed };
    });
    // If the active chapter was the one we just removed, clamp to a valid one.
    if (activeChapterIndex === chapterIndex) setActiveChapterIndex(0);
  }
  function addSideVoice(characterId, prefill = {}) {
    // Generate id sync so the caller can immediately assign current
    // dialogue to it (otherwise we'd race React state).
    const sideVoiceId = prefill.id || uid('side');
    updateActive((p) => ({
      ...p,
      characters: (p.characters || []).map((c) => {
        if (c.id !== characterId) return c;
        const sv = {
          id: sideVoiceId,
          name: prefill.name || 'Side voice',
          narratorName: prefill.narratorName || c.narratorName || '',
          notes: prefill.notes || '',
          recurring: prefill.recurring !== false,
        };
        return { ...c, sideVoices: [...(c.sideVoices || []), sv] };
      }),
    }));
    return sideVoiceId;
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

  // ---- in-place section edit (used by the "Fix missing quote" affordance).
  // Marie clicks Fix on a warning, edits the paragraphs to insert the
  // missing close quote, hits Save. We update section.html, rerun
  // dialogue detection, and ALSO log the edit on the section so the
  // export can replay it into the source .docx — without that the
  // exported file still has the original missing quote.
  function updateSectionHtml(chapterIndex, sectionIndex, newHtml, edit) {
    const { dialogueSpans: nextSpans, issues, totalQuoteMarks, quoteMarksEven } = detectSectionSpans(newHtml, chapterIndex, sectionIndex);
    updateActive((p) => ({
      ...p,
      chapters: p.chapters.map((ch) => {
        if (ch.chapterIndex !== chapterIndex) return ch;
        return {
          ...ch,
          sections: ch.sections.map((sec) => {
            if (sec.sectionIndex !== sectionIndex) return sec;
            // Preserve assignments by matching new spans to old BY
            // OCCURRENCE — first→first, second→second, etc. The shared
            // helper lives in packages/manuscript-engine so the test
            // suite verifies the same source the app runs.
            // (SAS-AUD-20260602-005, Block 5.)
            const mergedSpans = mergeDialogueAssignmentsByOccurrence(sec.dialogueSpans, nextSpans);
            // Append the paragraph edit to a side-list so the export can
            // replay it onto the original .docx. We dedupe by oldText to
            // keep the list small if Marie edits the same paragraph
            // repeatedly.
            const existingEdits = (sec.manualEdits || []).filter((e) => e.oldText !== edit?.oldText);
            const nextEdits = edit && edit.oldText && edit.newText && edit.oldText !== edit.newText
              ? [...existingEdits, { oldText: edit.oldText, newText: edit.newText }]
              : existingEdits;
            return {
              ...sec,
              html: newHtml,
              dialogueSpans: mergedSpans,
              safetyIssues: issues,
              totalQuoteMarks,
              quoteMarksEven,
              scanning: false,
              manualEdits: nextEdits,
            };
          }),
        };
      }),
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
      characters: (activeProject.characters || []).map((c) => ({
        id: c.id, name: c.name, narratorName: c.narratorName, colorHex: c.colorHex,
        sideVoices: (c.sideVoices || []).map((s) => ({ id: s.id, name: s.name, narratorName: s.narratorName, notes: s.notes, recurring: s.recurring })),
      })),
      // Preserve the full chapter → section → html tree so the export
      // can rebuild the manuscript with original paragraph structure
      // and inline-highlight just the dialogue lines.
      chapters: (activeProject.chapters || []).map((ch) => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        sections: (ch.sections || []).map((sec) => ({
          title: sec.title,
          html: sec.html || '',
          // Paragraph-level edits Marie made via the Fix button — these
          // need to be replayed onto the source .docx during export so
          // the inserted close-quotes (and any other paragraph tweaks)
          // show up in the file she downloads.
          manualEdits: (sec.manualEdits || []).map((e) => ({ oldText: e.oldText, newText: e.newText })),
          dialogueSpans: (sec.dialogueSpans || []).map((sp) => ({
            text: sp.text,
            afterText: sp.afterText,
            characterId: sp.characterId,
            sideVoiceId: sp.sideVoiceId || '',
          })),
        })),
        // Backwards-compat flat spans for the CSV exporters (unchanged).
        spans: ch.sections.flatMap((sec) => sec.dialogueSpans.map((sp) => {
          const char = sp.characterId ? charactersById.get(sp.characterId) : null;
          const sv = char && sp.sideVoiceId ? (char.sideVoices || []).find((s) => s.id === sp.sideVoiceId) : null;
          return {
            text: sp.text,
            afterText: sp.afterText,
            characterId: sp.characterId,
            sideVoiceId: sp.sideVoiceId || '',
            narratorOverride: sv?.narratorName || '',
          };
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
      {/* Top-left nav. ONE pill, same position, morphs by view:
          - home: the 4-mode tab switcher (passed in as modeToggle)
          - bookDetail/setup: ⌂ icon → go to home (project list)
          - reader: ← icon → go back to the book detail
          Marie wanted the container to stay put and only the icon to
          change between modes; that's why the pill is rendered up here
          instead of inside each child view. */}
      {view === 'home' && modeToggle}
      {(view === 'bookDetail' || view === 'setup') && (
        <HomeBackPill
          icon="⌂"
          usesCustomDragRegion={usesCustomDragRegion}
          onClick={() => {
            setReplacingProjectId(null);
            setActiveProjectId(null);
            setView('home');
          }}
        />
      )}
      {view === 'reader' && (
        <HomeBackPill
          icon="←"
          usesCustomDragRegion={usesCustomDragRegion}
          onClick={() => setView('bookDetail')}
        />
      )}

      {view === 'setup' && (
        <ImportFlow
          accent={PREP_INK}
          heading={replacingProjectId ? 'Replace manuscript' : 'New prep project'}
          blurb={replacingProjectId
            ? 'Upload the corrected .docx. Your characters and assignments stay; dialogue is rescanned.'
            : 'Upload your .docx, check the chapters you want, and we\'ll scan dialogue.'}
          submitLabel={replacingProjectId ? 'Replace & rescan' : 'Save & scan'}
          onCancel={cancelImport}
          onConfirm={commitImport}
        />
      )}

      {view === 'home' && (
        <HomeView
          allProjects={allProjects}
          onOpenProject={(id) => { setActiveProjectId(id); setView('bookDetail'); }}
          onDelete={deleteProject}
          onStartImport={() => { setReplacingProjectId(null); setView('setup'); }}
          error={error}
        />
      )}

      {view === 'bookDetail' && activeProject && (
        <BookDetailView
          project={activeProject}
          saveStatus={saveStatus}
          usesCustomDragRegion={usesCustomDragRegion}
          onUpdatePaging={(patch) => updateActive((p) => ({ ...p, ...patch }))}
          onDelete={() => {
            if (window.confirm(`Delete "${activeProject.title}"? This can't be undone.`)) deleteProject(activeProject.id);
          }}
          onOpenChapter={(chapterIndex) => {
            setActiveChapterIndex(chapterIndex);
            const ch = activeProject.chapters.find((c) => c.chapterIndex === chapterIndex);
            const firstSec = ch?.sections?.find((s) => (s.dialogueSpans || []).length > 0) || ch?.sections?.[0];
            setSelected({ sectionIndex: firstSec?.sectionIndex ?? 0, spanIndex: 0 });
            setView('reader');
          }}
          onReplace={startReplaceManuscript}
          onAddCharacter={addCharacter}
          onUpdateCharacter={updateCharacter}
          onRemoveCharacter={removeCharacter}
          onAddSideVoice={addSideVoice}
          onRemoveSideVoice={removeSideVoice}
          onRemoveChapter={removeChapter}
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
          setActiveChapterIndex={setActiveChapterIndex}
          onJumpToChapter={(i) => {
            // Used by the top-bar chapter dropdown: jump to the chapter
            // AND select its first dialogue-bearing section/span.
            setActiveChapterIndex(i);
            const ch = activeProject.chapters.find((c) => c.chapterIndex === i);
            const firstSec = (ch?.sections || []).find((s) => (s.dialogueSpans || []).length > 0) || ch?.sections?.[0];
            setSelected({ sectionIndex: firstSec?.sectionIndex ?? 0, spanIndex: 0 });
          }}
          selected={selected}
          setSelected={setSelected}
          saveStatus={saveStatus}
          usesCustomDragRegion={usesCustomDragRegion}
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
          onUpdateSectionHtml={updateSectionHtml}
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

function HomeView({ allProjects, onOpenProject, onDelete, onStartImport, error }) {
  const sorted = [...allProjects].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  // ? info modal + image header — mirrors Duet's pattern in PrebuildMode.js.
  // Marie 2026-05-26: "copy DUET which already has one, that exactly."
  // headerImageOk: until the green PNG (script-and-sync-header-for-prep.png)
  // is dropped into public/branding/, fall back to a plain text title so no
  // broken-image icon is shown.
  const [showHomeInfo, setShowHomeInfo] = useState(false);
  const [headerImageOk, setHeaderImageOk] = useState(true);
  return (
    <div style={{ maxWidth: HOME_CONTAINER, margin: '0 auto', padding: '4.7rem 1.25rem 4.25rem' }}>
      <AppDialog
        open={showHomeInfo}
        onClose={() => setShowHomeInfo(false)}
        titleId="prep-about-title"
        panelStyle={{ width:'min(520px, 100%)',background:'white',border:'1px solid var(--accent-border)',borderRadius:24,boxShadow:'0 24px 60px var(--accent-shadow-strong)',padding:'20px 20px 18px' }}
      >
        <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:12 }}>
          <div id="prep-about-title" style={{ fontSize:'1rem',fontWeight:700,color:'var(--text)' }}>About Prep Manuscript</div>
          <button type="button" onClick={() => setShowHomeInfo(false)} style={{ padding:'6px 10px',fontSize:'0.74rem',color:PREP_INK,border:'1px solid var(--accent-border)',background:'white',borderRadius:8,fontWeight:700,cursor:'pointer' }}>
            Close
          </button>
        </div>
        <div style={{ display:'grid',gap:10,fontSize:'0.85rem',lineHeight:1.6,color:'var(--text-muted)' }}>
          <p style={{ margin:0 }}>
            Script and Sync Prep Manuscript helps you mark up a dialogue-heavy manuscript before recording. Tag who says what, assign side voices for one-time characters, and fix missing close-quotes inline.
          </p>
          <p style={{ margin:0 }}>
            Export a Word doc where each character&apos;s lines are colour-coded and side-voice dialogue carries a real Word comment for your narrator.
          </p>
        </div>
      </AppDialog>
      <header style={{ marginBottom: '1.9rem', textAlign: 'center', position: 'relative' }}>
        <button
          onClick={() => setShowHomeInfo(true)}
          aria-label="About Prep Manuscript"
          title="About Prep Manuscript"
          style={{ position:'absolute',top:0,right:'max(4%, 0px)',width:42,height:42,borderRadius:'50%',border:'1px solid var(--accent-border)',background:'white',color:PREP_INK,fontSize:'1.1rem',fontWeight:700,cursor:'pointer',boxShadow:'0 10px 24px var(--accent-shadow)',display:'flex',alignItems:'center',justifyContent:'center' }}
        >
          ?
        </button>
        {headerImageOk ? (
          <img
            src="/branding/script-and-sync-header-for-prep.png"
            alt="Script and Sync — prep your manuscript for recording"
            onError={() => setHeaderImageOk(false)}
            style={{ width:'min(420px, 92%)',height:'auto',display:'block',margin:'0 auto 0.85rem' }}
          />
        ) : (
          <>
            <div style={{ fontSize: '1.55rem', fontWeight: 600, letterSpacing: '0.02em', color: PREP_INK }}>Prep Manuscript</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Tag every line of dialogue with a character and narrator before recording.
            </div>
          </>
        )}
        <h1 style={{ position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0, 0, 0, 0)',whiteSpace:'nowrap',border:0 }}>Script and Sync Prep Manuscript</h1>
      </header>

      <section style={{ background: 'rgba(255,255,255,0.78)', border: '1px solid var(--border)', borderRadius: 22, padding: '1rem', marginBottom: 14 }}>
        <button
          type="button"
          onClick={onStartImport}
          style={{ display: 'block', width: '100%', padding: '14px 18px', background: PREP_ACCENT, color: 'white', border: 'none', borderRadius: 16, fontSize: '0.96rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
        >
          + Import new manuscript (.docx)
        </button>
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
                  <TrashButton onClick={() => { if (window.confirm(`Delete "${p.title}"? This can't be undone.`)) onDelete(p.id); }} title="Delete project" />
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
  project, saveStatus, usesCustomDragRegion, onDelete, onOpenChapter, onReplace,
  onAddCharacter, onUpdateCharacter, onRemoveCharacter,
  onAddSideVoice, onRemoveSideVoice,
  onRemoveChapter,
  onExportDocx, onExportDialogueCsv, onExportNarratorCsv,
  onUpdatePaging,
  progress,
}) {
  const [editingChapters, setEditingChapters] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const counts = projectCounts(project);
  const pct = counts.total === 0 ? 0 : Math.round((counts.assigned / counts.total) * 100);
  const scanning = progress && progress.total > 0 && progress.current < progress.total;

  // Per-chapter character analysis + project-wide word totals.
  // Recomputes when chapters or characters change. Skipped on the server
  // (typeof document === 'undefined') and inside analyzePrepChapter when
  // there are no characters mapped yet.
  const chapterAnalyses = useMemo(() => {
    return (project.chapters || []).map((ch) => {
      const html = (ch.sections || []).map((s) => s.html || '').join('\n');
      return {
        chapter: ch,
        analysis: analyzePrepChapterByCharacter(html, project.characters || []),
      };
    });
  }, [project.chapters, project.characters]);

  const breakdownSummary = useMemo(() => {
    const byCharacter = {};
    let grandTotal = 0;
    chapterAnalyses.forEach(({ analysis }) => {
      grandTotal += analysis.totalWords;
      for (const [k, v] of Object.entries(analysis.wordTallies)) {
        byCharacter[k] = (byCharacter[k] || 0) + v;
      }
    });
    const rows = Object.entries(byCharacter)
      .map(([key, words]) => {
        const isNarrator = key === PREP_NARRATOR_KEY;
        const character = isNarrator ? null : (project.characters || []).find((c) => c.name === key);
        return {
          key,
          // Marie 2026-06-06: "Unsure" reads clearer than "Narrator"
          // for the unattributed-words bucket. Real narrators have names.
          label: isNarrator ? 'Unsure' : key,
          narrator: character?.narratorName || (isNarrator ? 'Unsure' : key),
          color: character?.colorHex || null,
          words,
        };
      })
      .sort((a, b) => b.words - a.words);
    return { rows, grandTotal };
  }, [chapterAnalyses, project.characters]);

  return (
    <>
      <StickyTopBar
        usesCustomDragRegion={usesCustomDragRegion}
        title={project.title}
        subtitle={`${project.chapters.length} chapter${project.chapters.length === 1 ? '' : 's'} · ${counts.assigned}/${counts.total} assigned (${pct}%)`}
      >
        <SaveBadge status={saveStatus} />
        <button type="button" onClick={() => setShowBreakdown(true)} style={topBtn()} title="Word-count breakdown by character (by H1/H2/H3 headings in the manuscript)">Breakdown</button>
        <button type="button" onClick={onReplace} style={topBtn()}>Replace</button>
        {onDelete && <TrashButton onClick={onDelete} title="Delete this project" />}
      </StickyTopBar>

      <div style={{ width: READER_WIDTH, margin: '0 auto', padding: '18px 0 60px' }}>
        {/* Slim file + export strip. Counts live in the sticky top bar. */}
        <section style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ flex: '1 1 auto', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{project.fileName}</span>
            {scanning && <span style={{ color: PREP_INK, fontWeight: 600 }}> · scanning {progress.current}/{progress.total}…</span>}
          </span>
          {onExportDocx && <button type="button" onClick={onExportDocx} style={pillBtn()}>.docx</button>}
          {onExportDialogueCsv && <button type="button" onClick={onExportDialogueCsv} style={pillBtn()}>Dialogue CSV</button>}
          {onExportNarratorCsv && <button type="button" onClick={onExportNarratorCsv} style={pillBtn()}>Narrators CSV</button>}
        </section>

        {/* Marie 2026-05-26: page-numbering banner, mirroring the one in
            SessionsView. Same three states (green / amber / yellow) with
            an Upload PDF button so Prep matches the other modes. */}
        {(() => {
          const pdfPages = project.pdfPaging?.pages?.length || 0;
          const printedCount = project.pdfPaging?.printedPageCount || 0;
          const hasPdfMap = pdfPages > 0;
          const adj = Number(project.pageNumberAdjustment) || 0;
          const fromUserPdf = project.pdfSource === 'user-pdf';

          async function pickAndUploadPdf() {
            if (typeof window === 'undefined' || !window.electron?.extractPdfPaging) {
              alert('PDF upload needs the desktop app.');
              return;
            }
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/pdf,.pdf';
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              try {
                const ab = await file.arrayBuffer();
                const extracted = await window.electron.extractPdfPaging({ fileName: file.name, data: new Uint8Array(ab), pageOffset: 0 });
                if (extracted?.pages?.length && onUpdatePaging) {
                  const suggested = Number(extracted.suggestedAdjustment) || 0;
                  // Marie 2026-05-26: build the slim word-index → page
                  // map right here so the post-import PDF upload gives
                  // the same answer the import-time path does.
                  let pdfPageMap = null;
                  try {
                    const allWords = [];
                    for (const ch of (project?.chapters || [])) {
                      const html = ch?.html || '';
                      if (html) allWords.push(...extractManuscriptWordsFromHtml(html));
                    }
                    if (allWords.length) pdfPageMap = buildSlimPageMap(extracted.pages, allWords);
                  } catch (mapErr) {
                    console.warn('buildSlimPageMap (Prep post-import) failed:', mapErr);
                  }
                  onUpdatePaging({ pdfPaging: extracted, pdfPageMap, pdfFileName: file.name, pdfSource: 'user-pdf', pageNumberAdjustment: suggested });
                }
              } catch (e) { alert(`PDF read failed: ${e?.message || e}`); }
            };
            input.click();
          }

          const baseBox = { marginBottom: 16, borderRadius: 12, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.78rem' };
          if (hasPdfMap && fromUserPdf) {
            return (
              <div style={{ ...baseBox, background: '#eaf5ec', border: '1px solid #b9d6bf', color: '#3d7a4a' }}>
                <span>✓</span>
                <span style={{ flex: 1 }}><strong>Page numbers from your PDF.</strong> {printedCount}/{pdfPages} numbered.{adj !== 0 && ` · nudge ${adj > 0 ? `+${adj}` : adj}`}</span>
                <button onClick={pickAndUploadPdf} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #b9d6bf', background: 'white', color: '#3d7a4a', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Replace PDF</button>
              </div>
            );
          }
          if (hasPdfMap) {
            return (
              <div style={{ ...baseBox, background: '#fdf3e0', border: '1px solid #e8c98a', color: '#8a6519', alignItems: 'flex-start' }}>
                <span>○</span>
                <div style={{ flex: 1, lineHeight: 1.45 }}>
                  <strong>Page numbers auto-scanned via LibreOffice.</strong> {printedCount}/{pdfPages} numbered. May drift ±1-2 pages.
                  <div style={{ marginTop: 4 }}>For exact, upload the PDF downloaded from the same Google Doc.</div>
                </div>
                <button onClick={pickAndUploadPdf} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #8a6519', background: 'white', color: '#8a6519', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Upload PDF</button>
              </div>
            );
          }
          return (
            <div style={{ ...baseBox, background: '#fff4d6', border: '1px solid #e0c682', color: '#7a5a18', alignItems: 'flex-start' }}>
              <span>⚠️</span>
              <div style={{ flex: 1, lineHeight: 1.45 }}>
                <strong>This book has no page numbers yet.</strong> Upload the printed PDF to fix.
              </div>
              <button onClick={pickAndUploadPdf} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #8a6519', background: 'white', color: '#7a5a18', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>Upload PDF</button>
            </div>
          );
        })()}

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ ...sectionHeading(), margin: 0 }}>Chapters</h3>
            {onRemoveChapter && (
              <button
                type="button"
                onClick={() => setEditingChapters((v) => !v)}
                title={editingChapters ? 'Done editing' : 'Edit chapter list'}
                style={{
                  background: editingChapters ? PREP_ACCENT : 'white',
                  color: editingChapters ? 'white' : PREP_INK,
                  border: '1px solid ' + PREP_INK + '55',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {editingChapters ? 'Done' : '⚙ Edit'}
              </button>
            )}
          </div>
          {editingChapters && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Tap the trash to remove a chapter you didn&apos;t mean to include. To add a chapter back, re-import the manuscript.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
            {project.chapters.map((ch, i) => {
              const c = chapterCounts(ch);
              const p = c.total === 0 ? 0 : Math.round((c.assigned / c.total) * 100);
              const navPos = ch.chapterNumber || (i + 1);
              const sourceTitle = ch.title || '';
              const showSource = sourceTitle && sourceTitle.toLowerCase() !== `chapter ${navPos}`.toLowerCase();
              const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'white', border: '1px solid var(--border-light)', borderRadius: 10, textAlign: 'left' };
              // Pills for the characters whose names appear as headings
              // inside this chapter (in document order). Pulls colour
              // from each character's saved hex — so Vandle yellow,
              // Crescent green, exactly as Marie spec'd. Per-character
              // word count comes from the same analysis pass.
              const chTallies = chapterAnalyses[i]?.analysis?.wordTallies || {};
              const chapterCharNames = chapterAnalyses[i]?.analysis?.headingCharacters || [];
              const chapterCharPills = chapterCharNames
                .map((name) => {
                  const cp = (project.characters || []).find((cc) => cc.name === name);
                  return cp ? { ...cp, words: chTallies[name] || 0 } : null;
                })
                .filter(Boolean);
              const inner = (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Chapter {navPos}{showSource ? <span style={{ color: 'var(--text-light)', fontWeight: 400, marginLeft: 8 }}>· {sourceTitle}</span> : null}
                    </div>
                    {chapterCharPills.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                        {chapterCharPills.map((cp) => (
                          <span key={cp.id} style={{ display:'inline-flex', alignItems:'baseline', gap:5, padding:'1px 7px', background: cp.colorHex || 'transparent', border: '1px solid rgba(0,0,0,0.08)', borderRadius:999, fontSize:'0.66rem', fontWeight:600, color:'rgba(0,0,0,0.78)' }}>
                            <span>{cp.name}</span>
                            {cp.words > 0 && <span style={{ fontWeight:500, color:'rgba(0,0,0,0.55)', fontVariantNumeric:'tabular-nums' }}>· {Number(cp.words).toLocaleString()}</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {c.issues > 0 && (
                    <span title={`${c.issues} missing-quote warning${c.issues === 1 ? '' : 's'} to fix`} style={{ padding: '2px 8px', background: '#FDF3E3', color: '#9A6A1F', border: '1px solid #E3CBA1', borderRadius: 999, fontSize: '0.66rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      ⚠ {c.issues}
                    </span>
                  )}
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {c.scanning ? 'scanning…' : `${c.assigned}/${c.total}`}
                  </div>
                  <div style={{ width: 80, height: 3, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${p}%`, height: '100%', background: PREP_ACCENT, transition: 'width 0.2s' }} />
                  </div>
                </>
              );
              if (editingChapters) {
                return (
                  <div key={ch.id} style={rowStyle}>
                    {inner}
                    <TrashButton
                      onClick={() => {
                        if (window.confirm(`Remove Chapter ${navPos}${showSource ? ` (${sourceTitle})` : ''}? You can re-import to add it back.`)) {
                          onRemoveChapter(ch.chapterIndex);
                        }
                      }}
                      title="Remove this chapter from the project"
                    />
                  </div>
                );
              }
              return (
                <button key={ch.id} type="button" onClick={() => onOpenChapter(ch.chapterIndex)}
                  style={{ ...rowStyle, cursor: 'pointer' }}>
                  {inner}
                  <span style={{ color: 'var(--text-light)', fontSize: '0.95rem' }}>›</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
      {showBreakdown && (
        <div style={{ position:'fixed', inset:0, background:'rgba(28,18,44,0.18)', backdropFilter:'blur(4px)', zIndex:1300, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px' }} onClick={() => setShowBreakdown(false)}>
          <div style={{ width:'min(640px, 100%)', maxHeight:'min(78vh, 720px)', overflow:'auto', background:'white', border:'1px solid var(--accent-border)', borderRadius:24, boxShadow:'0 24px 60px var(--accent-shadow-strong)', padding:'18px 18px 16px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:14 }}>
              <div>
                <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:PREP_INK, marginBottom:4 }}>Manuscript breakdown</div>
                <div style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>Word counts per character, attributed by H1/H2/H3 heading. Everything before the first character heading counts as Narrator.</div>
              </div>
              <button onClick={() => setShowBreakdown(false)} style={{ padding:'6px 12px', fontSize:'0.78rem', color:PREP_INK, border:'1px solid var(--accent-border)', background:'white', borderRadius:8, fontWeight:700, cursor:'pointer' }}>Close</button>
            </div>
            {breakdownSummary.rows.length === 0 ? (
              <div style={{ padding:'24px 8px', textAlign:'center', color:'var(--text-muted)', fontSize:'0.86rem' }}>
                {(project.characters || []).length === 0
                  ? 'Add characters to the project first — the breakdown counts words by character heading.'
                  : 'No character headings found yet in the manuscript. Make sure each character\'s name appears as an H1, H2 or H3 heading where their dialogue starts.'}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {breakdownSummary.rows.map((row) => {
                  const pct = breakdownSummary.grandTotal > 0 ? (row.words / breakdownSummary.grandTotal) * 100 : 0;
                  const pctText = pct >= 9.5 ? Math.round(pct) + '%' : pct.toFixed(1) + '%';
                  return (
                    <div key={row.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', background:'white', border:'1px solid var(--border-light)', borderRadius:999, fontSize:'0.84rem' }}>
                      <span style={{ width:10, height:10, borderRadius:3, background: row.color || 'transparent', border: row.color ? 'none' : '1px dashed var(--border)', flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.label}</div>
                        {row.narrator && row.narrator !== row.label && (
                          <div style={{ fontSize:'0.68rem', color:'var(--text-light)', marginTop:2 }}>{row.narrator}</div>
                        )}
                      </div>
                      <span style={{ color:'var(--text-muted)', fontSize:'0.72rem', fontVariantNumeric:'tabular-nums', minWidth:60, textAlign:'right' }}>{Number(row.words).toLocaleString()}w</span>
                      <span style={{ color:'var(--text)', fontWeight:600, fontSize:'0.78rem', fontVariantNumeric:'tabular-nums', minWidth:44, textAlign:'right' }}>{pctText}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {breakdownSummary.grandTotal > 0 && (
              <div style={{ marginTop:10, fontSize:'0.7rem', color:'var(--text-light)', textAlign:'right' }}>
                Total manuscript: {Number(breakdownSummary.grandTotal).toLocaleString()} words
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ===========================================================================
// Reader view — one chapter at a time
// ===========================================================================

function ReaderView({
  project, activeChapterIndex, setActiveChapterIndex, onJumpToChapter,
  selected, setSelected, saveStatus, usesCustomDragRegion,
  onAssignCharacter, onAssignSideVoice,
  onAddCharacter, onUpdateCharacter, onRemoveCharacter,
  onAddSideVoice, onRemoveSideVoice,
  onUpdateSectionHtml,
}) {
  const chapter = project.chapters.find((c) => c.chapterIndex === activeChapterIndex) || project.chapters[0];
  const dialogueRefs = useRef({});
  // pendingScrollKey is the refKey ("sectionIdx|spanIdx") we want to
  // bring into view next. The button itself triggers the scroll in
  // its ref callback the moment it's in the DOM — no polling needed.
  // The useEffect below handles the "already mounted" case (in-chapter
  // navigation).
  const [pendingScrollKey, setPendingScrollKey] = useState(null);
  const requestScroll = useCallback((key) => setPendingScrollKey(key), []);

  // Already-mounted case: if the target button exists right now, scroll
  // immediately on the next frame.
  useEffect(() => {
    if (!pendingScrollKey) return undefined;
    const node = dialogueRefs.current[pendingScrollKey];
    if (!node) return undefined;   // not mounted yet; ref callback will handle
    const id = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPendingScrollKey(null);
    });
    return () => cancelAnimationFrame(id);
  }, [pendingScrollKey]);

  // When the chapter changes (cross-chapter hop or dropdown jump),
  // snap to top so the user sees the new chapter starting fresh.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeChapterIndex]);

  // Expose a callback the button's ref callback can call when it mounts
  // and matches the pending key.
  const onDialogueButtonMounted = useCallback((key, el) => {
    if (!el) return;
    if (pendingScrollKey === key) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setPendingScrollKey(null);
      });
    }
  }, [pendingScrollKey]);

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
    const next = cur + step;
    const orderedIdxLocal = project.chapters.map((c) => c.chapterIndex).sort((a, b) => a - b);
    if (next < 0) {
      const idx = orderedIdxLocal.indexOf(activeChapterIndex);
      if (idx > 0) {
        const prevChapterIdx = orderedIdxLocal[idx - 1];
        const prevCh = project.chapters.find((c) => c.chapterIndex === prevChapterIdx);
        const lastSec = (prevCh?.sections || []).slice().reverse().find((s) => (s.dialogueSpans || []).length > 0);
        if (lastSec) {
          const target = { sectionIndex: lastSec.sectionIndex, spanIndex: lastSec.dialogueSpans.length - 1 };
          setActiveChapterIndex(prevChapterIdx);
          setSelected(target);
          requestScroll(`${target.sectionIndex}|${target.spanIndex}`);
        }
      }
      return;
    }
    if (next >= flatList.length) {
      const idx = orderedIdxLocal.indexOf(activeChapterIndex);
      if (idx >= 0 && idx < orderedIdxLocal.length - 1) {
        const nextChapterIdx = orderedIdxLocal[idx + 1];
        const nextCh = project.chapters.find((c) => c.chapterIndex === nextChapterIdx);
        const firstSec = (nextCh?.sections || []).find((s) => (s.dialogueSpans || []).length > 0);
        if (firstSec) {
          const target = { sectionIndex: firstSec.sectionIndex, spanIndex: 0 };
          setActiveChapterIndex(nextChapterIdx);
          setSelected(target);
          requestScroll(`${target.sectionIndex}|${target.spanIndex}`);
        }
      }
      return;
    }
    const target = flatList[next];
    setSelected(target);
    requestScroll(`${target.sectionIndex}|${target.spanIndex}`);
  }

  const canPrevChapter = activeChapterIndex > Math.min(...project.chapters.map((c) => c.chapterIndex));
  const canNextChapter = activeChapterIndex < Math.max(...project.chapters.map((c) => c.chapterIndex));

  const chapterCount = chapterCounts(chapter || {});
  const chapterPct = chapterCount.total === 0 ? 0 : Math.round((chapterCount.assigned / chapterCount.total) * 100);
  const orderedIdx = project.chapters.map((c) => c.chapterIndex).sort((a, b) => a - b);
  const navPos = orderedIdx.indexOf(activeChapterIndex) + 1;
  // The source heading (e.g. "Chapter 2" because she deselected the
  // original first chapter on import) only goes in the subtitle if it
  // would tell us something different from the navigation number.
  // Otherwise we'd be showing "Chapter 1 · Chapter 2", which is the
  // exact thing she said confused her.
  const sourceTitle = chapter?.title || '';
  const navTitle = `Chapter ${navPos} of ${orderedIdx.length}`;
  const showSourceTitle = sourceTitle && sourceTitle.toLowerCase() !== `chapter ${navPos}`.toLowerCase();

  return (
    <>
      <StickyTopBar
        usesCustomDragRegion={usesCustomDragRegion}
        title={navTitle}
        subtitle={`${showSourceTitle ? sourceTitle + ' · ' : ''}${chapterCount.assigned}/${chapterCount.total} assigned (${chapterPct}%)${chapterCount.issues > 0 ? ` · ⚠ ${chapterCount.issues} to fix` : ''} · ${project.title}`}
      >
        <select
          value={activeChapterIndex}
          onChange={(e) => (onJumpToChapter || setActiveChapterIndex)(Number(e.target.value))}
          style={{ padding: '6px 10px', borderRadius: 999, border: '1px solid var(--border)', background: 'white', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', maxWidth: 220 }}
        >
          {project.chapters.map((ch) => {
            const pos = orderedIdx.indexOf(ch.chapterIndex) + 1;
            return (
              <option key={ch.id} value={ch.chapterIndex}>Chapter {pos}</option>
            );
          })}
        </select>
        <button type="button" disabled={!canPrevChapter} onClick={() => {
          const idx = orderedIdx.indexOf(activeChapterIndex);
          if (idx > 0) (onJumpToChapter || setActiveChapterIndex)(orderedIdx[idx - 1]);
        }} style={{ ...topBtn(), opacity: canPrevChapter ? 1 : 0.35 }}>← Chapter</button>
        <button type="button" disabled={!canNextChapter} onClick={() => {
          const idx = orderedIdx.indexOf(activeChapterIndex);
          if (idx >= 0 && idx < orderedIdx.length - 1) (onJumpToChapter || setActiveChapterIndex)(orderedIdx[idx + 1]);
        }} style={{ ...topBtn(), opacity: canNextChapter ? 1 : 0.35 }}>Chapter →</button>
        <SaveBadge status={saveStatus} />
      </StickyTopBar>

      <div style={{ width: READER_WIDTH, margin: '0 auto', padding: '20px 0 150px' }}>
        {/* No in-page chapter pill — the sticky top bar already shows
            chapter title + N of M + assignment progress. */}
        <div style={{ fontSize: READER_FONT_SIZE, lineHeight: READER_LINE_HEIGHT, color: 'var(--text)' }}>
          {(chapter?.sections || []).map((sec) => (
            <SectionBody
              key={sec.id}
              section={sec}
              chapterIndex={activeChapterIndex}
              charactersById={new Map((project.characters || []).map((c) => [c.id, c]))}
              selected={selected}
              onSelectDialogue={(sectionIndex, spanIndex) => setSelected({ sectionIndex, spanIndex })}
              dialogueRefs={dialogueRefs}
              onDialogueButtonMounted={onDialogueButtonMounted}
              onUpdateSectionHtml={onUpdateSectionHtml}
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

function SectionBody({
  section, chapterIndex, charactersById, selected,
  onSelectDialogue, dialogueRefs, onDialogueButtonMounted,
  onUpdateSectionHtml,
}) {
  const [fixingBlock, setFixingBlock] = useState(null); // block index being fixed, or null

  if (!section.html && section.scanning) return <p style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>(scanning…)</p>;
  if (!section.html) return null;

  const blocks = useMemo(() => paragraphsFromHtml(section.html), [section.html]);
  const spans = section.dialogueSpans || [];
  const safetyIssues = section.safetyIssues || [];

  // The engine now tags each orphan warning with the block (paragraph)
  // index it lives in. We use that to put the Fix editor right on the
  // problematic paragraph instead of dumping the whole section into a
  // textarea like the first version did.
  const warningBlockIndex = (() => {
    const issue = safetyIssues[0];
    if (!issue) return -1;
    const idx = Number(issue.blockIndex);
    return Number.isFinite(idx) ? idx : -1;
  })();

  let spanCursor = 0;
  return (
    <>
      {safetyIssues.length > 0 && (
        <div style={{ margin: '8px 0 14px', padding: '8px 12px', background: '#FDF3E3', border: '1px solid #E3CBA1', borderRadius: 8, fontSize: '0.78rem', color: '#7A4F11', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1 }}>⚠ {safetyIssues[0].message}</span>
          {onUpdateSectionHtml && fixingBlock === null && (
            <button
              type="button"
              onClick={() => setFixingBlock(warningBlockIndex >= 0 ? warningBlockIndex : 0)}
              style={{ padding: '4px 10px', background: '#C47F2A', color: 'white', border: 'none', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
            >Fix</button>
          )}
        </div>
      )}
      {blocks.map((block, bi) => {
        // If this block is being fixed, swap it for the paragraph editor
        // (in place — Marie keeps the rest of the section as context).
        // We still need to walk spanCursor past any spans that live in
        // this paragraph, otherwise the next paragraph's render starts
        // searching for the wrong spans and nothing else lights up.
        if (fixingBlock === bi) {
          const text = block.text;
          let cur = 0;
          while (spanCursor < spans.length) {
            const sp = spans[spanCursor];
            const needle = sp.text || '';
            if (!needle) { spanCursor++; continue; }
            const where = text.indexOf(needle, cur);
            if (where === -1) break;
            cur = where + needle.length;
            spanCursor++;
          }
          return (
            <ParagraphFixer
              key={`fix-${bi}`}
              block={block}
              onCancel={() => setFixingBlock(null)}
              onSave={(newParaText) => {
                const oldText = block.text;
                // Rebuild section.html by replacing just this block's text.
                const newHtml = blocks.map((b, i) => {
                  const t = i === bi ? newParaText : b.text;
                  if (b.isHeading) {
                    const tag = b.tag || 'h2';
                    return `<${tag}>${escapeHtml(t)}</${tag}>`;
                  }
                  return `<p>${escapeHtml(t)}</p>`;
                }).join('');
                if (onUpdateSectionHtml) {
                  onUpdateSectionHtml(
                    chapterIndex,
                    section.sectionIndex,
                    newHtml,
                    { oldText, newText: newParaText },
                  );
                }
                setFixingBlock(null);
              }}
            />
          );
        }

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
        // Use left alignment instead of justify — justify combined with
        // inline-block dialogue buttons caused huge gaps in the
        // surrounding text and made long dialogues balloon onto their
        // own line (the screenshot Marie sent in 05-25 testing).
        const style = block.isHeading
          ? { fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-muted)', margin: '24px 0 12px 0', textAlign: 'center', fontStyle: 'italic' }
          : { margin: '0 0 0.6em 0', textIndent: '1.6em', textAlign: 'left' };
        return (
          <Tag key={bi} style={style}>
            {segments.map((seg, i) => {
              if (seg.kind === 'plain') return <span key={i}>{seg.text}</span>;
              const span = spans[seg.spanIndex];
              const char = span?.characterId ? charactersById.get(span.characterId) : null;
              const sv = char && span?.sideVoiceId ? (char.sideVoices || []).find((s) => s.id === span.sideVoiceId) : null;
              const isSelected = selected.sectionIndex === section.sectionIndex && selected.spanIndex === seg.spanIndex;
              const bg = char ? colorForAssignment(char, sv) : (isSelected ? '#FFF6CC' : 'transparent');
              const refKey = `${section.sectionIndex}|${seg.spanIndex}`;
              // Render dialogue as an inline span (not a <button>) so
              // text flows through the paragraph naturally — long
              // dialogue wraps mid-line, no inline-block ballooning.
              return (
                <span
                  key={i}
                  ref={(el) => {
                    if (el) {
                      dialogueRefs.current[refKey] = el;
                      if (onDialogueButtonMounted) onDialogueButtonMounted(refKey, el);
                    } else {
                      delete dialogueRefs.current[refKey];
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectDialogue(section.sectionIndex, seg.spanIndex)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectDialogue(section.sectionIndex, seg.spanIndex);
                    }
                  }}
                  title={char ? `${char.name}${sv ? ' — ' + sv.name : ''}` : 'Unassigned'}
                  style={{
                    background: bg,
                    borderBottom: '2px solid ' + (isSelected ? PREP_INK : (char ? PREP_INK + '66' : '#e3d8b0')),
                    padding: '0 3px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? 'inset 0 0 0 2px rgba(63, 106, 82, 0.25)' : 'none',
                    borderRadius: 3,
                  }}
                >{seg.text}</span>
              );
            })}
          </Tag>
        );
      })}
    </>
  );
}

// One-paragraph editor that pops up where the warning paragraph used
// to be. Marie types the missing close quote (or any other fix) and
// hits Save. We keep the rest of the section's text intact.
function ParagraphFixer({ block, onCancel, onSave }) {
  const [text, setText] = useState(block.text);
  const ref = useRef(null);

  function insertCloseQuote() {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? start;
    const next = text.slice(0, start) + '”' + text.slice(end);
    setText(next);
    setTimeout(() => {
      el.focus();
      const pos = start + 1;
      el.selectionStart = pos;
      el.selectionEnd = pos;
    }, 0);
  }

  return (
    <div style={{ margin: '0 0 0.8em 0', padding: '10px 12px', background: 'white', border: '1px solid ' + PREP_INK + '55', borderRadius: 10, boxShadow: '0 6px 22px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: PREP_INK, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Fix this paragraph
        </div>
        <button type="button" onClick={insertCloseQuote}
          title={'Insert a closing curly quote at the cursor'}
          style={{ padding: '4px 10px', background: PREP_ACCENT, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
          Insert &rdquo; here
        </button>
      </div>
      <textarea
        ref={ref}
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        style={{
          width: '100%', minHeight: 120,
          padding: '8px 10px',
          fontFamily: 'Georgia, serif',
          fontSize: '0.95rem',
          lineHeight: 1.55,
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: '#FBF8F2',
          color: 'var(--text)',
          outline: 'none',
          resize: 'vertical',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
        <button type="button" onClick={onCancel} style={{ padding: '6px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 999, fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button type="button" onClick={() => onSave(text)} style={{ padding: '6px 12px', background: PREP_ACCENT, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>Save &amp; rescan</button>
      </div>
    </div>
  );
}

function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.96)', borderTop: '1px solid var(--border-light)', backdropFilter: 'blur(10px)', boxShadow: '0 -6px 22px rgba(0,0,0,0.04)', zIndex: 1200, padding: '6px 16px 8px' }}>
      <div style={{ width: READER_WIDTH, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Single row: nav + selected dialogue + current assignment. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={onPrev} style={dockBtn(false)} title="Previous dialogue">←</button>
          <button type="button" onClick={onNext} style={dockBtn(true)} title="Next dialogue">Next →</button>
          <span style={{ fontSize: '0.66rem', fontWeight: 700, color: PREP_INK, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{positionLabel}</span>
          <div style={{ flex: 1, minWidth: 0, padding: '4px 9px', background: colorForAssignment(currentChar, currentSV) || 'white', border: '1px solid ' + (currentChar ? PREP_INK + '33' : 'var(--border-light)'), borderRadius: 7, fontSize: '0.76rem', fontFamily: 'Georgia, serif', lineHeight: 1.4, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedSpan ? <>“{selectedSpan.text}”</> : <span style={{ color: 'var(--text-light)' }}>Click a dialogue.</span>}
          </div>
          <span style={{ fontSize: '0.66rem', fontWeight: 600, color: currentChar ? PREP_INK : 'var(--text-light)', whiteSpace: 'nowrap' }}>
            {currentChar ? <>{currentChar.name}{currentSV ? ' / ' + currentSV.name : ''}</> : 'Unassigned'}
          </span>
        </div>

        {/* Character chips below. Let it wrap freely so the Add form
            doesn't get clipped. */}
        <div style={{ paddingTop: 2 }}>
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
    </div>
  );
}

// ===========================================================================
// Shared: top bar + character grid + character chip + popovers
// ===========================================================================

function topBtn() { return topBtnStyle(TONE, 'outline'); }
function pillBtn() { return pillBtnStyle(TONE); }
function dockBtn(primary) {
  return { padding: '5px 12px', background: primary ? PREP_ACCENT : 'white', color: primary ? 'white' : PREP_INK, border: '1px solid ' + (primary ? PREP_ACCENT : PREP_INK), borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' };
}
function sectionHeading() {
  return { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: PREP_INK, margin: '0 0 8px 0' };
}

// Small red trash-can button used in places where a destructive
// action should be unmistakable but unobtrusive.
function TrashButton({ onClick, title = 'Delete' }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
      title={title}
      aria-label={title}
      style={{
        padding: '5px 7px',
        background: 'white',
        color: 'var(--danger)',
        border: '1px solid #f0b8b8',
        borderRadius: 8,
        cursor: 'pointer',
        lineHeight: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  );
}

function CharacterGrid({ characters, mode, selectedSpan, onAdd, onUpdate, onRemove, onAddSideVoice, onRemoveSideVoice, onAssignCharacter, onAssignSideVoice }) {
  const [adding, setAdding] = useState(false);
  const [popoverFor, setPopoverFor] = useState(null);    // characterId
  const [addingSideFor, setAddingSideFor] = useState(null); // characterId or null
  const [editing, setEditing] = useState(null);          // characterId or null

  function closePopover() { setPopoverFor(null); setAddingSideFor(null); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* When adding a character, show the inline form on its OWN row
          above the chips so it can't be clipped by the dock's
          scrollable strip. */}
      {adding && (
        <div>
          <AddCharacterInline existingCount={characters.length} onSave={(payload) => {
            const newId = onAdd(payload);
            // If we're in the reader (mode === 'assign') and there's a
            // dialogue selected, auto-assign the brand-new character to
            // it so Marie doesn't have to click again.
            if (mode === 'assign' && onAssignCharacter && newId) {
              onAssignCharacter(newId);
            }
            setAdding(false);
          }} onCancel={() => setAdding(false)} />
        </div>
      )}
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
          onSaveSideVoice={(payload) => {
            const newId = onAddSideVoice(c.id, payload);
            // In the reader dock we also assign the brand-new side
            // voice to the currently selected dialogue (that's what
            // "Save & assign" means). In the book-detail "manage"
            // view we just save and keep the popover open so the
            // user sees the new entry appear in the list.
            if (mode === 'assign' && onAssignSideVoice && newId) {
              onAssignSideVoice(c.id, newId);
              closePopover();
            } else {
              setAddingSideFor(null);
            }
          }}
          onRemoveSideVoice={(sv) => onRemoveSideVoice(c.id, sv.id)}
        />
      ))}
      {!adding && (
        <button type="button" onClick={() => setAdding(true)} style={{ padding: '5px 10px', background: 'transparent', color: PREP_INK, border: '1px dashed ' + PREP_INK + '99', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Add character
        </button>
      )}
      </div>
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
        style={{ padding: '2px 10px', background: PREP_ACCENT, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>Save</button>
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
        <button type="button" onClick={onEndEdit} style={{ padding: '2px 10px', background: PREP_ACCENT, color: 'white', border: 'none', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>Done</button>
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
        <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', zIndex: 1500, background: 'white', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.16)', padding: 8, minWidth: 240, maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
            <AddSideVoiceInline characterNarrator={character.narratorName} saveLabel={mode === 'assign' ? 'Save & assign' : 'Save'} onSave={onSaveSideVoice} onCancel={onClosePopover} />
          ) : (
            <button type="button" onClick={onStartAddSideVoice} style={{ padding: '7px 8px', background: PREP_ACCENT, color: 'white', border: 'none', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', marginTop: 4 }}>+ Add side voice…</button>
          )}
        </div>
      )}
    </div>
  );
}

function AddSideVoiceInline({ characterNarrator, saveLabel = 'Save', onSave, onCancel }) {
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
          style={{ flex: 1, padding: '5px 8px', background: PREP_ACCENT, color: 'white', border: 'none', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 }}>{saveLabel}</button>
      </div>
    </div>
  );
}

function pillToggleStyle(active) {
  return {
    flex: 1, padding: '4px 8px',
    background: active ? PREP_ACCENT : 'white',
    color: active ? 'white' : 'var(--text-muted)',
    border: '1px solid ' + (active ? PREP_INK : 'var(--border)'),
    borderRadius: 999, fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer',
  };
}
