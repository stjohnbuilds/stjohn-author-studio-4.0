'use client';

// Check Errors popup. Walks flags one at a time so Marie can listen
// against the (possibly re-recorded) audio.
//
// One UI, two sources — toggle top-right:
//   "Saved flags" → walks book.chapters[].sections[].flags as-is.
//   "Upload CSV"  → parses the existing flag-export CSV (or Marie's
//                   engineer-template variant) into the same shape.
//                   CSV flags are in-memory only, never saved into
//                   the book.
//
// Everything reuses existing pieces: AppDialog (modal + focus trap),
// AudioDock (player), nameMatches (chapter match), the flag-shape
// the rest of the app already understands. Doesn't change book or
// flag schema. The dialog never writes to section.flags.
//
// Audio source: whatever is currently attached to the matched chapter.
// After Marie re-uploads new audio for the error chapters, this popup
// naturally picks it up. Old timestamps are used as the seek point
// (small fixes → close enough). If the chapter has a whisperAlignment
// for the new audio and the flag has an idx, we use the whisper-aligned
// time instead so a re-recorded chapter with shifted pacing still lands
// on the right word.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppDialog from './AppDialog';
import AudioDock from './AudioDock';
import { parseFlagCsv } from '../lib/csvFlagImport';
import { getAudioTimeForMsIdx, getMsIdxAtTime, buildSyncTable } from '../../packages/audio-engine';

const SEEK_LEAD_SECONDS = 10;

function normText(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function nameMatches(a, b) {
  const na = normText(a), nb = normText(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}
// Render the target paragraph with the flagged sentence highlighted
// inline. We do a soft (whitespace-collapsed, case-insensitive) match
// so minor punctuation/spacing drift between the saved flag quote and
// the paragraph text doesn't break the highlight. If we can't find
// the quote at all, the whole paragraph just renders with no extra
// styling.
function renderTargetWithHighlight(target, quote) {
  const text = String(target || '');
  if (!text) return '(paragraph not found in chapter HTML)';
  const q = String(quote || '').trim();
  if (!q) return text;
  const normTarget = text.toLowerCase().replace(/\s+/g, ' ');
  const normQuote = q.toLowerCase().replace(/\s+/g, ' ');
  const idx = normTarget.indexOf(normQuote);
  if (idx < 0) {
    // Soft fallback: try matching just the first 5 words of the quote
    const head = normQuote.split(' ').slice(0, 5).join(' ');
    const fallbackIdx = head ? normTarget.indexOf(head) : -1;
    if (fallbackIdx < 0) return text;
    return splitWithHighlight(text, normTarget, fallbackIdx, head.length);
  }
  return splitWithHighlight(text, normTarget, idx, normQuote.length);
}

// Map a position in the normalised text back to the original text by
// walking both in lockstep, then render <before><highlight><after>.
function splitWithHighlight(original, normalised, normStart, normLen) {
  let oi = 0;
  let ni = 0;
  let originalStart = 0;
  let originalEnd = original.length;
  while (oi < original.length && ni < normStart) {
    const oc = original[oi];
    const nc = normalised[ni];
    if (oc.toLowerCase() === nc) { oi += 1; ni += 1; continue; }
    if (/\s/.test(oc)) { oi += 1; continue; }
    // Drift — bail out and return whole text
    return original;
  }
  originalStart = oi;
  let matched = 0;
  while (oi < original.length && matched < normLen) {
    const oc = original[oi];
    const nc = normalised[normStart + matched];
    if (oc.toLowerCase() === nc) { oi += 1; matched += 1; continue; }
    if (/\s/.test(oc)) { oi += 1; continue; }
    return original;
  }
  originalEnd = oi;
  const before = original.slice(0, originalStart);
  const hl = original.slice(originalStart, originalEnd);
  const after = original.slice(originalEnd);
  return (
    <>
      {before}
      <mark style={{ background: '#fff2a8', padding: '0 2px', borderRadius: 3 }}>{hl}</mark>
      {after}
    </>
  );
}

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

// Build the flag list from already-saved book data. Shape matches the
// CSV-imported version so the walker UI doesn't care which mode.
function buildSavedFlagList(book) {
  const out = [];
  (book?.chapters || []).forEach((ch) => {
    (ch.sections || []).forEach((sec) => {
      (sec.flags || []).forEach((fl, i) => {
        out.push({
          id: `saved:${ch.id}:${sec.id}:${i}`,
          source: 'saved',
          chapterId: ch.id,
          chapterTitle: ch.title || '(untitled chapter)',
          sectionId: sec.id,
          sectionTitle: sec.title || '',
          page: String(fl.page ?? ''),
          ts: Number(fl.ts) || 0,
          narrator: String(fl.narrator || ''),
          type: String(fl.type || ''),
          quote: String(fl.sentPlain || fl.sentHtml || ''),
          should: String(fl.note || ''),
          idx: Number.isFinite(fl.idx) ? Number(fl.idx) : null,
        });
      });
    });
  });
  return out;
}

// Map CSV rows onto the same shape + the matched book chapter/section.
// If no chapter matches by title, the row is kept with chapterId=null
// so the dialog can show it as "no matching chapter" rather than
// silently dropping it.
function buildImportedFlagList(book, csvRows) {
  const chapters = book?.chapters || [];
  return csvRows.map((r, i) => {
    const matchedChapter = chapters.find((ch) => nameMatches(ch.title, r.chapterTitle));
    const firstSection = matchedChapter?.sections?.[0] || null;
    return {
      id: `imported:${i}`,
      source: 'imported',
      chapterId: matchedChapter?.id || null,
      chapterTitle: matchedChapter?.title || r.chapterTitle || '(unmatched)',
      sectionId: firstSection?.id || null,
      sectionTitle: firstSection?.title || '',
      page: String(r.page || ''),
      ts: Number(r.ts) || 0,
      narrator: String(r.narrator || ''),
      type: String(r.type || ''),
      // Position-based: col 7 = "Misread Quote" (the manuscript text),
      // col 8 = "Should Say" (the engineer's note). Matches the
      // exact column order Export-for-Engineer writes
      // (SessionsView.js lines 316 + 443). Earlier this used a
      // longer/shorter heuristic which flipped the two when Marie's
      // engineer wrote a note longer than the quote.
      quote:  String(r.colSeven || ''),
      should: String(r.colEight || ''),
      idx: null,
      unmatched: !matchedChapter,
      audioFileHint: r.audioFileHint || '',
    };
  });
}

function findSectionInChapter(book, chapterId, sectionId) {
  const ch = (book?.chapters || []).find((c) => c.id === chapterId);
  if (!ch) return { chapter: null, section: null };
  const sec = sectionId
    ? (ch.sections || []).find((s) => s.id === sectionId)
    : (ch.sections || [])[0];
  return { chapter: ch, section: sec || null };
}

// Pull the paragraph that contains the flagged audio time + the
// paragraph before + after, for context. We use the section HTML
// (already in memory) — no DOM walk, no new data.
function extractContextParagraphs(sectionHtml, quote) {
  const html = String(sectionHtml || '');
  if (!html) return { before: '', target: '', after: '', targetStartWordIdx: 0 };
  // Split on every block-level closing tag (not just </p> — mammoth
  // wraps headings and quoted blocks too). Strip remaining inline tags.
  const paragraphs = html.split(/<\/(?:p|div|h[1-6]|blockquote|li)>/i)
    .map((p) => p.replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!paragraphs.length) return { before: '', target: '', after: '', targetStartWordIdx: 0 };

  // Cumulative chapter word-index BEFORE each paragraph — so the live
  // highlight can convert "current chapter word" → "word inside this
  // paragraph". Counts every \\S+ in every preceding paragraph so the
  // total matches what the reader's whisper sync table uses.
  const wordCounts = paragraphs.map((p) => (p.match(/\S+/g) || []).length);
  const startIdxs = [];
  let acc = 0;
  for (const n of wordCounts) { startIdxs.push(acc); acc += n; }

  // Locate the paragraph containing the quote. Strategy:
  //   1. Exact normalised substring match.
  //   2. N-gram overlap score — slide a 4-word window across the
  //      normalised quote, count how many windows each paragraph
  //      contains, pick the paragraph with the highest score.
  //   3. Head fallback — first 5 words of the quote as substring.
  //   4. Tail fallback — last 5 words.
  //   5. Final fallback — paragraph 0 (so the dialog still renders).
  //
  // Marie 2026-06-09: previously only #1 + #3 ran, which failed for
  // CSV-imported flags whose engineer notes had carriage returns,
  // mangled quote starts, or punctuation drift — the dialog
  // silently rendered the chapter's first paragraph instead of the
  // real flagged one.
  const q = normText(quote);
  let idx = -1;
  if (q) {
    idx = paragraphs.findIndex((p) => normText(p).includes(q));
    if (idx < 0) {
      const words = q.split(' ').filter(Boolean);
      if (words.length >= 3) {
        const NG = Math.min(4, words.length);
        const ngrams = [];
        for (let i = 0; i + NG <= words.length; i += 1) {
          ngrams.push(words.slice(i, i + NG).join(' '));
        }
        let bestScore = 0;
        let bestIdx = -1;
        paragraphs.forEach((p, pi) => {
          const np = normText(p);
          let s = 0;
          for (const ng of ngrams) {
            if (np.includes(ng)) s += 1;
          }
          if (s > bestScore) { bestScore = s; bestIdx = pi; }
        });
        // Require at least 2 overlapping windows (or 1 if the quote
        // itself only fits one window) so unrelated paragraphs don't
        // claim a stray match by accident.
        const minScore = ngrams.length === 1 ? 1 : 2;
        if (bestIdx >= 0 && bestScore >= minScore) idx = bestIdx;
      }
      if (idx < 0) {
        const head = q.split(' ').slice(0, 5).join(' ');
        if (head) idx = paragraphs.findIndex((p) => normText(p).includes(head));
      }
      if (idx < 0) {
        const tail = q.split(' ').slice(-5).join(' ');
        if (tail) idx = paragraphs.findIndex((p) => normText(p).includes(tail));
      }
    }
  }
  if (idx < 0) idx = 0;

  return {
    before: paragraphs[idx - 1] || '',
    target: paragraphs[idx] || '',
    after: paragraphs[idx + 1] || '',
    beforeStartWordIdx: idx > 0 ? (startIdxs[idx - 1] || 0) : 0,
    targetStartWordIdx: startIdxs[idx] || 0,
    afterStartWordIdx: idx + 1 < startIdxs.length ? (startIdxs[idx + 1] || 0) : 0,
  };
}

// Renders the target paragraph with the flagged sentence highlighted
// (static yellow band) AND the audio's currently-spoken word highlighted
// amber. The dialog hoists the audio subscription so this component is
// pure props — `currentLocalIdx` is just "which word inside this
// paragraph is being spoken right now, or -1 if none / no transcription".
// `tone` controls which colour the moving word uses:
//   'target'  — amber (default; for the paragraph containing the
//               flagged quote — also paints the quote band yellow).
//   'context' — pastel lilac (for the before / after paragraphs so the
//               moving word stays visible without yelling "this is the
//               issue").
// `quote` is only consulted when tone='target'; context paragraphs
// never paint a static highlight band.
function LiveTargetParagraph({ target, quote, paragraphStartWordIdx, currentChapterMsIdx, audioPlaying, tone = 'target' }) {
  const currentLocalIdx = (Number.isFinite(currentChapterMsIdx) && currentChapterMsIdx >= 0 && paragraphStartWordIdx != null)
    ? currentChapterMsIdx - paragraphStartWordIdx
    : -1;
  const text = String(target || '');
  if (!text) return '(paragraph not found in chapter HTML)';

  // Find the flagged quote's char range in the paragraph (for static
  // yellow highlight). Only runs for the target paragraph — context
  // paragraphs skip this entirely so we don't paint phantom highlights
  // when an unrelated section of prose happens to contain a few of
  // the quote's words.
  const q = tone === 'target' ? String(quote || '').trim().toLowerCase().replace(/\s+/g, ' ') : '';
  const normText2 = text.toLowerCase().replace(/\s+/g, ' ');
  let quoteHeadInNorm = -1;
  let matchLength = q.length;
  if (q) {
    quoteHeadInNorm = normText2.indexOf(q);
    if (quoteHeadInNorm < 0) {
      // Soft fallback: match just the first 5 words. The highlight length
      // must shrink to the head length too, otherwise words past the
      // actual match get painted yellow (the bug Marie nearly hit).
      const head = q.split(' ').slice(0, 5).join(' ');
      if (head) {
        quoteHeadInNorm = normText2.indexOf(head);
        if (quoteHeadInNorm >= 0) matchLength = head.length;
      }
    }
  }
  const quoteTailInNorm = quoteHeadInNorm >= 0 ? quoteHeadInNorm + matchLength : -1;

  // Per-tone colour palette for the moving current-word highlight.
  // Marie 2026-06-09: amber for target (matches the static yellow
  // quote band visually), pastel lilac for context so the eye can
  // tell apart "this is the issue paragraph" vs "this is just before
  // / after for context".
  const palette = tone === 'target'
    ? { play: '#ffd166', pause: '#ffeec2' }
    : { play: '#d4b8f0', pause: '#ece1f8' };

  // Walk tokens. Word tokens get a wordIdx counter (matched against
  // currentLocalIdx for the moving highlight). Whitespace tokens just
  // render as-is.
  const tokens = text.split(/(\s+)/);
  const out = [];
  let wordIdx = 0;
  let normPos = 0;
  tokens.forEach((tok, i) => {
    if (!tok) return;
    if (/^\s+$/.test(tok)) {
      out.push(<React.Fragment key={`s${i}`}>{tok}</React.Fragment>);
      normPos += 1; // collapsed-whitespace consumes one char in normText2
      return;
    }
    const myIdx = wordIdx++;
    const myNormStart = normPos;
    const myNormEnd = normPos + tok.toLowerCase().length;
    normPos = myNormEnd;
    const inQuote = quoteHeadInNorm >= 0
      && myNormStart < quoteTailInNorm
      && myNormEnd > quoteHeadInNorm;
    const isCurrent = myIdx === currentLocalIdx;
    const style = {};
    if (inQuote) {
      style.background = '#fff2a8';
      style.padding = '0 2px';
      style.borderRadius = 3;
    }
    if (isCurrent) {
      // No outline; just a background tint pulled from the per-tone
      // palette. Faded variant when paused so the word-position is
      // still visible without strobing while scanning Next/Previous.
      style.background = audioPlaying ? palette.play : palette.pause;
      style.padding = '0 2px';
      style.borderRadius = 3;
      style.transition = 'background 0.18s ease';
    }
    out.push(<span key={`w${i}`} style={style}>{tok}</span>);
  });
  return out;
}

export default function CheckErrorsDialog({ open, onClose, book, audioUrls }) {
  const [mode, setMode] = useState('saved'); // 'saved' | 'imported'
  const [csvRows, setCsvRows] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [cursor, setCursor] = useState(0);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  // Build the flag list from whichever source is active.
  const flagList = useMemo(() => {
    if (mode === 'saved') return buildSavedFlagList(book);
    return buildImportedFlagList(book, csvRows);
  }, [mode, book, csvRows]);

  // Reset cursor when source / list changes.
  useEffect(() => { setCursor(0); }, [mode, csvRows.length]);

  const total = flagList.length;
  const current = total > 0 ? flagList[Math.min(cursor, total - 1)] : null;

  // Find the section + audio + paragraph context for the current flag.
  const sectionInfo = useMemo(() => {
    if (!current || !current.chapterId) return { chapter: null, section: null };
    return findSectionInChapter(book, current.chapterId, current.sectionId);
  }, [book, current]);
  const audioUrl = sectionInfo.section ? (audioUrls?.[sectionInfo.section.id] || null) : null;
  const context = useMemo(() => (
    sectionInfo.section ? extractContextParagraphs(sectionInfo.section.html, current?.quote) : { before: '', target: '', after: '' }
  ), [sectionInfo.section, current?.quote]);

  // Live word-following highlight — same mechanism Proof's reader uses:
  // build a sync table from whisperAlignment (manuscript-word ↔ audio-
  // time), then on every audio tick look up the current msIdx. We
  // hoist this to the dialog (not inside the paragraph component) so
  // the effect re-runs when audioUrl changes — by then AudioDock has
  // mounted its <audio> and audioRef.current is real. Was the bug that
  // caused the highlight to never start: the listener was attached
  // before the audio element existed.
  const [currentMsIdx, setCurrentMsIdx] = useState(-1);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const syncTblRef = useRef(null);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return undefined;
    const sync = () => setAudioPlaying(!a.paused);
    a.addEventListener('play', sync);
    a.addEventListener('pause', sync);
    a.addEventListener('ended', sync);
    sync();
    return () => {
      a.removeEventListener('play', sync);
      a.removeEventListener('pause', sync);
      a.removeEventListener('ended', sync);
    };
  }, [audioUrl]);
  useEffect(() => {
    const alignment = sectionInfo.section?.whisperAlignment;
    if (!Array.isArray(alignment) || alignment.length < 4) { syncTblRef.current = null; return; }
    try { syncTblRef.current = buildSyncTable(alignment); }
    catch { syncTblRef.current = null; }
  }, [sectionInfo.section?.id, sectionInfo.section?.whisperAlignment]);
  useEffect(() => {
    if (!audioUrl) { setCurrentMsIdx(-1); return; }
    const audio = audioRef.current;
    if (!audio) { setCurrentMsIdx(-1); return; }
    let raf = null;
    function tick() {
      raf = null;
      const tbl = syncTblRef.current;
      if (!tbl) return;
      const msIdx = getMsIdxAtTime(tbl, audio.currentTime, -1);
      setCurrentMsIdx(Number.isFinite(msIdx) && msIdx >= 0 ? msIdx : -1);
      if (!audio.paused) raf = requestAnimationFrame(tick);
    }
    function schedule() { if (raf == null) raf = requestAnimationFrame(tick); }
    audio.addEventListener('play', schedule);
    audio.addEventListener('pause', schedule);
    audio.addEventListener('timeupdate', schedule);
    audio.addEventListener('seeked', schedule);
    audio.addEventListener('loadedmetadata', schedule);
    schedule();
    return () => {
      audio.removeEventListener('play', schedule);
      audio.removeEventListener('pause', schedule);
      audio.removeEventListener('timeupdate', schedule);
      audio.removeEventListener('seeked', schedule);
      audio.removeEventListener('loadedmetadata', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [audioUrl, current?.id]);

  // Pick the seek time. Preference order:
  // 1. If the flag has an idx AND the section has a whisperAlignment,
  //    build a sync table from it (same shape Proof uses internally)
  //    and ask it where the manuscript word lives in the current audio.
  //    Handles re-recorded chapters with shifted pacing.
  // 2. Otherwise the flag's ts as-is.
  const seekStart = useMemo(() => {
    if (!current) return 0;
    const sec = sectionInfo.section;
    const alignment = Array.isArray(sec?.whisperAlignment) ? sec.whisperAlignment : null;
    if (current.idx != null && alignment && alignment.length >= 4) {
      try {
        const tbl = buildSyncTable(alignment);
        const aligned = getAudioTimeForMsIdx(tbl, current.idx);
        if (Number.isFinite(aligned) && aligned >= 0) return aligned;
      } catch {}
      return current.ts;
    }
    return current.ts;
  }, [current, sectionInfo.section]);

  // Auto-seek + play when the current flag changes.
  //
  // Pitfalls handled:
  //  • setting `currentTime` only sticks once `duration` is known →
  //    try on multiple readiness events + poll for ~6s as a fallback
  //  • calling `play()` immediately after setting `currentTime` can
  //    leave the audio paused at 0 OR playing from the OLD position
  //    on browsers/Electron — the seek hasn't settled. Wait for the
  //    `seeked` event before play. (Marie 2026-06-04 bug: first flag
  //    at 50s played from 0.)
  //  • `seeked` may never fire if we're already at the target — 800ms
  //    fallback timeout calls play() anyway
  //  • `didSeek` flag so we only fire once per (audio, flag)
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !audioUrl || !current) return;
    const target = Math.max(0, seekStart - SEEK_LEAD_SECONDS);
    let didSeek = false;
    let cancelled = false;
    let pollTimer = null;
    let pollsLeft = 100; // ~6s of polling at 60ms

    // Marie 2026-06-09: removed the auto-play. The dialog still
    // seeks the player to the flag's timestamp so the play button
    // starts in the right place, but doesn't kick off playback
    // automatically — Marie was finding the auto-play disruptive
    // when scanning Next/Previous to inspect the manuscript context
    // without listening every time. Press the play button to listen.
    function doSeek() {
      if (cancelled || didSeek) return;
      if (!Number.isFinite(a.duration) || a.duration <= 0) return;
      didSeek = true;
      const clamped = Math.max(0, Math.min(target, a.duration - 0.1));
      try { a.currentTime = clamped; } catch {}
    }

    function poll() {
      if (cancelled || didSeek) return;
      doSeek();
      if (!didSeek && pollsLeft > 0) {
        pollsLeft -= 1;
        pollTimer = setTimeout(poll, 60);
      }
    }

    doSeek();
    a.addEventListener('loadedmetadata', doSeek);
    a.addEventListener('durationchange', doSeek);
    a.addEventListener('canplay', doSeek);
    poll();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      a.removeEventListener('loadedmetadata', doSeek);
      a.removeEventListener('durationchange', doSeek);
      a.removeEventListener('canplay', doSeek);
    };
  }, [audioUrl, current?.id, seekStart]);

  function step(delta) {
    if (!total) return;
    setCursor((c) => Math.max(0, Math.min(total - 1, c + delta)));
  }

  async function onPickCsv(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');
    try {
      const text = await file.text();
      const result = parseFlagCsv(text);
      if (result.error) {
        setCsvError(result.error);
        setCsvRows([]);
        return;
      }
      setCsvRows(result.rows);
      setMode('imported');
    } catch (err) {
      setCsvError(`Couldn't read that file: ${err?.message || err}`);
      setCsvRows([]);
    } finally {
      e.target.value = '';
    }
  }

  if (!open) return null;
  const dialogTitleId = 'check-errors-title';

  const pillBtn = (active) => ({
    padding: '6px 12px',
    fontSize: '0.78rem',
    border: '1px solid ' + (active ? 'var(--accent-border-strong)' : 'var(--border)'),
    borderRadius: 999,
    background: active ? 'var(--accent-light)' : 'white',
    color: active ? 'var(--accent-dark)' : 'var(--text-muted)',
    cursor: 'pointer',
    fontWeight: active ? 600 : 500,
  });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      titleId={dialogTitleId}
      panelStyle={{ maxWidth: 760, width: '92vw', height: '85vh', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(28, 18, 44, 0.25)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border-light)', flexShrink: 0, background: 'white' }}>
        <h2 id={dialogTitleId} style={{ margin: 0, fontSize: '1.04rem', fontWeight: 700, flex: 1 }}>See errors</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={pillBtn(mode === 'saved')} onClick={() => setMode('saved')}>Saved flags</button>
          <button type="button" style={pillBtn(mode === 'imported')} onClick={() => fileInputRef.current?.click()}>Upload CSV</button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onPickCsv} style={{ display: 'none' }} />
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px' }}>×</button>
      </div>

      {csvError && (
        <div style={{ padding: '10px 18px', background: '#fdf2f2', color: '#7a2424', fontSize: '0.82rem', borderBottom: '1px solid #f0d4d4' }}>{csvError}</div>
      )}

      {/* Scrollable middle — chapter title, info strip, and the manuscript text context */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
        {total === 0 ? (
          <div style={{ padding: '40px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {mode === 'saved'
              ? 'No saved flags in this book yet. Add some in Proof, or use "Upload CSV" to import a list.'
              : 'No CSV loaded yet — click "Upload CSV" above.'}
          </div>
        ) : current ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {cursor + 1} of {total}
              </div>
              {current.unmatched && (
                <div style={{ fontSize: '0.72rem', color: '#a04848', background: '#fdf2f2', padding: '2px 8px', borderRadius: 999 }}>
                  No matching chapter in this book
                </div>
              )}
            </div>
            <div style={{ fontSize: '1.02rem', fontWeight: 700, marginBottom: 4 }}>{current.chapterTitle}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              <span><strong style={{ color: 'var(--text)' }}>At</strong> {fmtTime(current.ts)}</span>
              {current.page && <span><strong style={{ color: 'var(--text)' }}>Page</strong> {current.page}</span>}
              {current.narrator && <span><strong style={{ color: 'var(--text)' }}>Narrator</strong> {current.narrator}</span>}
              {current.type && <span><strong style={{ color: 'var(--text)' }}>Type</strong> {current.type}</span>}
            </div>
            <div style={{ marginBottom: 14 }}>
              {/* Marie 2026-06-09 v4.0.11: word-following highlight
                  runs through every visible paragraph, not just the
                  target. Target word = amber (matches the yellow
                  quote band underneath). Before / after words = pastel
                  lilac so context paragraphs look "lighter than the
                  issue". No paragraph-level background blob — the
                  moving word IS the visual cue. */}
              {context.before && (
                <p style={{ margin: '0 0 6px', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  <LiveTargetParagraph
                    target={context.before}
                    paragraphStartWordIdx={context.beforeStartWordIdx}
                    currentChapterMsIdx={currentMsIdx}
                    audioPlaying={audioPlaying}
                    tone="context"
                  />
                </p>
              )}
              <p style={{ margin: '0 0 6px', fontSize: '0.92rem', color: 'var(--text)', lineHeight: 1.55 }}>
                <LiveTargetParagraph
                  target={context.target}
                  quote={current?.quote}
                  paragraphStartWordIdx={context.targetStartWordIdx}
                  currentChapterMsIdx={currentMsIdx}
                  audioPlaying={audioPlaying}
                  tone="target"
                />
              </p>
              {context.after && (
                <p style={{ margin: '0', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  <LiveTargetParagraph
                    target={context.after}
                    paragraphStartWordIdx={context.afterStartWordIdx}
                    currentChapterMsIdx={currentMsIdx}
                    audioPlaying={audioPlaying}
                    tone="context"
                  />
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Sticky bottom stack — Comment, then Player, then Prev/Next.
          All flex-shrink so they always stay in view while the
          manuscript context above scrolls. */}
      {total > 0 && current && (
        <div style={{ flexShrink: 0, background: 'white', borderTop: '1px solid var(--border-light)' }}>
          {current.should && (
            <div style={{ background: '#eef7ef', border: '1px solid #c2dec5', borderRadius: 8, padding: '10px 12px', fontSize: '0.86rem', lineHeight: 1.5, margin: '12px 18px 8px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b6a3f', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Comment</div>
              {current.should}
            </div>
          )}
          <div style={{ padding: '0 18px 8px' }}>
            {audioUrl ? (
              <AudioDock
                audioRef={audioRef}
                audioUrl={audioUrl}
                label={sectionInfo.section?.audioFileName || ''}
                floating={false}
                showJumps
                contentWidth="100%"
              />
            ) : (
              <div style={{ background: '#f7f7f5', border: '1px dashed var(--border)', borderRadius: 8, padding: '14px', textAlign: 'center', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                {current.unmatched
                  ? 'Match a chapter to play audio (chapter title from the CSV didn\'t match any chapter in this book).'
                  : 'No audio attached to this chapter yet — attach it on the book detail page, then re-open this popup.'}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border-light)', background: 'white', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!total || cursor <= 0}
          style={{ padding: '8px 14px', fontSize: '0.86rem', border: '1px solid var(--border)', background: 'white', borderRadius: 8, cursor: (!total || cursor <= 0) ? 'not-allowed' : 'pointer', opacity: (!total || cursor <= 0) ? 0.5 : 1 }}
        >Previous</button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!total || cursor >= total - 1}
          style={{ padding: '8px 18px', fontSize: '0.86rem', fontWeight: 600, border: 'none', background: 'var(--accent)', color: 'white', borderRadius: 8, cursor: (!total || cursor >= total - 1) ? 'not-allowed' : 'pointer', opacity: (!total || cursor >= total - 1) ? 0.5 : 1 }}
        >Next →</button>
      </div>
    </AppDialog>
  );
}
