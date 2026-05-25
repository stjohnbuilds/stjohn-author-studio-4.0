'use client';

// Shared manuscript reader. Owns the chrome (sticky bar, paper, bottom
// dock slot), HTML walking, word splitting, and selection geometry.
// Modes pass per-word decoration + interaction callbacks.
//
// Used by: Quill (drag-select + annotation popover), Proof (double-click
// word for Jump/Flag, audio-synced highlight) — Proof migration is
// staged for the next session.
//
// NOT used by:
//   • Prep — operates on detected dialogue spans, not individual words.
//     Different selection model.
//   • Duet — read-only block-highlight display with insertion-time
//     labels above each highlight block. Different rendering model.
// Forcing either into this primitive would fork it. Same reasoning as
// `BookDetail` skipping Prep.
//
// API design notes
// ----------------
// Selection state is CONTROLLED (parent passes selectedRange + handles
// pointer events). That way each mode picks the gesture model
// (drag-select for Quill, double-click for Proof) without ChapterReader
// having to know about either. ChapterReader supplies the geometry
// helpers (`computeSelectionActionPos`, etc.) so mode-side code stays
// tiny.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  HomeBackPill,
  MODE_TOKENS,
  READER_PAGE_BG,
  READER_FONT_SIZE,
  READER_LINE_HEIGHT,
  READER_WIDTH,
  SaveBadge,
  StickyTopBar,
  topBtnStyle,
} from './ReaderChrome.js';

// ---------------------------------------------------------------------------
// Geometry helpers — exported so modes can use them for popover placement.
// ---------------------------------------------------------------------------

export const READER_BODY_CLASS = 'chapter-reader-body';
export const READER_UNIT_ATTR = 'data-cr-unit';

export function getChapterReaderWordEl(unitIndex) {
  if (typeof document === 'undefined' || unitIndex == null) return null;
  return document.querySelector(`[data-cr-unit="${unitIndex}"]`);
}

// Where to float a left-margin action button (Quill's +/✎): in the
// LEFT MARGIN of the line that the selection starts on, vertically
// centered on the first unit. Returns viewport coords.
export function computeChapterReaderActionPos(wordEl) {
  if (!wordEl) return null;
  const wordRect = wordEl.getBoundingClientRect();
  const block = wordEl.closest(`p, h1, h2, h3, h4, h5, h6, blockquote, li, .${READER_BODY_CLASS}`);
  const blockRect = block?.getBoundingClientRect();
  const reader = wordEl.closest(`.${READER_BODY_CLASS}`);
  const readerRect = reader?.getBoundingClientRect();
  if (readerRect && (wordRect.bottom < readerRect.top + 4 || wordRect.top > readerRect.bottom - 4)) {
    return null;
  }
  const controlSize = 32;
  const gap = 12;
  const lineLeft = blockRect ? blockRect.left : wordRect.left;
  const left = Math.max(8, lineLeft - controlSize - gap);
  const top = wordRect.top + wordRect.height / 2 - controlSize / 2;
  return { top, left };
}

// Where to float a popover (annotation form, flag form): above the
// selected word if there's room, otherwise below. Anchored to the
// block's left edge so the popover doesn't fall off near the right
// edge. Viewport coords — render with position: fixed.
export function computeChapterReaderPopoverPos(wordEl, options = {}) {
  if (!wordEl || typeof window === 'undefined') return null;
  const anchorRect = wordEl.getBoundingClientRect();
  const block = wordEl.closest(`p, h1, h2, h3, h4, h5, h6, blockquote, li, .${READER_BODY_CLASS}`);
  const blockRect = block?.getBoundingClientRect();
  const viewportW = window.innerWidth || 800;
  const viewportH = window.innerHeight || 600;
  const desiredWidth = options.width ?? 340;
  const estHeight = options.estHeight ?? 240;
  const gap = 14;
  const width = Math.min(desiredWidth, viewportW - 24);
  let left = blockRect ? blockRect.left : anchorRect.left;
  let top = anchorRect.top - estHeight - gap;
  if (top < 12) top = anchorRect.bottom + gap;
  left = Math.max(12, Math.min(left, viewportW - width - 12));
  top = Math.max(12, Math.min(top, viewportH - estHeight - 12));
  return { top, left, width };
}

// ---------------------------------------------------------------------------
// HTML walking + word splitting (shared across every word-render mode).
// ---------------------------------------------------------------------------

function isBlockTag(tagName) {
  return ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'LI'].includes(tagName);
}

// Default unit splitter — words. Pure function so modes can swap in
// their own splitter later (Prep would pass a dialogue-span splitter
// if it ever joined). Returns the indices of unit starts/ends in the
// source string + the unit text.
const DEFAULT_WORD_RE = /[A-Za-z0-9']+/g;

// ---------------------------------------------------------------------------
// Renderer — walks the chapter HTML and replaces each text token with
// a clickable span. Memoizable via the props that affect output.
// ---------------------------------------------------------------------------

// Exported so Proof's reader can render the same word-wrapped manuscript
// without losing its custom layout (3-column top bar, narrator chip row,
// search bar, persistent audio dock). Proof reads/writes the resulting
// DOM via getChapterReaderWordEl + document.querySelector('.' + READER_BODY_CLASS).
export function renderChapterBody(opts) { return renderChapter(opts); }

function renderChapter({
  chapter,
  selectedRange,
  unitDecoration,
  renderUnitOverlay,
  onUnitPointerDown,
  onUnitPointerEnter,
  onUnitDoubleClick,
  tone,
}) {
  if (!chapter || typeof document === 'undefined') return null;
  const html = chapter.textHtml || chapter.html || '';
  const host = document.createElement('div');
  host.innerHTML = html;
  const token = MODE_TOKENS[tone] || MODE_TOKENS.prep;
  let unitIndex = 0;

  function renderText(text, keyPrefix) {
    const pieces = [];
    const matches = [];
    const source = String(text || '');
    const re = new RegExp(DEFAULT_WORD_RE.source, 'g');
    let m;
    while ((m = re.exec(source)) !== null) {
      matches.push({ value: m[0], start: m.index, end: m.index + m[0].length });
    }
    matches.forEach((it, i) => {
      if (it.start > (pieces._last || 0)) {
        pieces.push(source.slice(pieces._last || 0, it.start));
      }
      const idx = unitIndex;
      unitIndex += 1;
      const next = matches[i + 1];
      const after = source.slice(it.end, next ? next.start : source.length);
      pieces.push(renderUnit(it.value, after, idx, `${keyPrefix}-w-${idx}`));
      pieces._last = next ? next.start : source.length;
    });
    if (!matches.length && source) pieces.push(source);
    return pieces;
  }

  function renderNode(node, key) {
    if (node.nodeType === 3) return renderText(node.textContent || '', key);
    if (node.nodeType !== 1) return null;
    const tag = node.tagName;
    if (tag === 'BR') return <br key={key} />;
    const children = Array.from(node.childNodes).flatMap((c, i) => renderNode(c, `${key}-${i}`));
    if (!children.length && !isBlockTag(tag)) return null;
    if (tag === 'H1') return <h1 key={key} style={{ fontSize: '1.4rem', fontWeight: 600, margin: '1.2rem 0 0.4rem', color: token.ink }}>{children}</h1>;
    if (tag === 'H2') return <h2 key={key} style={{ fontSize: '1.18rem', fontWeight: 600, margin: '1rem 0 0.4rem', color: token.ink }}>{children}</h2>;
    if (tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') return <h3 key={key} style={{ fontSize: '1.02rem', fontWeight: 600, margin: '0.9rem 0 0.3rem', color: token.ink }}>{children}</h3>;
    if (tag === 'P') return <p key={key} style={{ margin: '0 0 0.9rem' }}>{children}</p>;
    if (tag === 'BLOCKQUOTE') return <blockquote key={key} style={{ margin: '0.6rem 0 0.6rem 1rem', borderLeft: '3px solid ' + token.pastel, paddingLeft: '0.8rem', color: 'var(--text-muted)' }}>{children}</blockquote>;
    if (tag === 'UL') return <ul key={key}>{children}</ul>;
    if (tag === 'OL') return <ol key={key}>{children}</ol>;
    if (tag === 'LI') return <li key={key}>{children}</li>;
    if (tag === 'STRONG' || tag === 'B') return <strong key={key}>{children}</strong>;
    if (tag === 'EM' || tag === 'I') return <em key={key}>{children}</em>;
    return isBlockTag(tag) ? <div key={key}>{children}</div> : <span key={key}>{children}</span>;
  }

  function renderUnit(text, after, idx, key) {
    const inSelection = !!selectedRange && idx >= selectedRange.start && idx <= selectedRange.end;
    const decoration = unitDecoration ? unitDecoration(idx) : null;

    // No horizontal padding — `padding: 0 1px` used to add visible 2px
    // gaps between adjacent words, breaking what should be one
    // continuous highlight band into N stripes. The trailing whitespace
    // (`after`) lives INSIDE this span, so when adjacent annotated
    // words have the same background / underline they appear as a
    // single uninterrupted band.
    const style = {
      cursor: 'pointer',
      transition: 'background-color 0.1s ease',
      position: 'relative',
    };
    if (decoration && !inSelection) Object.assign(style, decoration);
    if (inSelection) {
      style.background = token.pastel;
      style.boxShadow = `inset 0 -2px 0 ${token.ink}`;
    }

    const overlay = renderUnitOverlay ? renderUnitOverlay(idx) : null;

    return (
      <span
        key={key}
        data-cr-unit={idx}
        onPointerDown={onUnitPointerDown ? (e) => onUnitPointerDown(idx, e) : undefined}
        onPointerEnter={onUnitPointerEnter ? () => onUnitPointerEnter(idx) : undefined}
        onDoubleClick={onUnitDoubleClick ? (e) => onUnitDoubleClick(idx, e) : undefined}
        style={style}
      >
        {text}{after}
        {overlay}
      </span>
    );
  }

  const out = Array.from(host.childNodes).flatMap((node, i) => renderNode(node, `n-${i}`));
  return out;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChapterReader({
  tone = 'prep',
  chapter,
  chapters = [],
  chapterIndex = 0,
  onChangeChapter,
  saveStatus,
  usesCustomDragRegion = false,
  onBack,

  // Per-unit visual decoration. Receives the unit index; returns a
  // style object merged onto the unit's span (background, borderBottom,
  // color, etc.) or null.
  unitDecoration,

  // Optional per-unit overlay (flag pin, marker dot). Returns JSX or
  // null. Rendered inside the unit's relative span — use absolute
  // positioning if you need to escape the line.
  renderUnitOverlay,

  // Interaction callbacks — mode picks what each gesture means.
  onUnitPointerDown,
  onUnitPointerEnter,
  onUnitDoubleClick,

  // Controlled selection. Parent computes the range from pointer
  // events; ChapterReader shows the left-margin action button when
  // this is non-null.
  selectedRange = null,
  onSelectionAction,                // user clicked the +/✎ button
  actionButtonIcon = '+',
  showActionButton = true,

  // Slots
  topActions = null,                // right side of sticky bar
  headerExtra = null,               // BELOW sticky bar, ABOVE paper (narrator/character chip strip etc.)
  bottomDock = null,                // fixed dock at bottom
  paperPaddingBottom = 200,         // leave room for the dock
}) {
  const token = MODE_TOKENS[tone] || MODE_TOKENS.prep;
  const [actionPos, setActionPos] = useState(null);
  const draggingClearRef = useRef(false);

  // Keep the action button aligned to the first selected unit as the
  // layout shifts (scroll, resize, content changes). rAF gives React
  // a tick to commit the new selectedRange to the DOM before measure.
  useEffect(() => {
    if (!selectedRange || !showActionButton) {
      setActionPos(null);
      return undefined;
    }
    function update() {
      const el = getChapterReaderWordEl(selectedRange.start);
      setActionPos(computeChapterReaderActionPos(el));
    }
    const raf = requestAnimationFrame(update);
    window.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [selectedRange?.start, selectedRange?.end, showActionButton]);

  const renderedContent = useMemo(
    () => renderChapter({
      chapter,
      selectedRange,
      unitDecoration,
      renderUnitOverlay,
      onUnitPointerDown,
      onUnitPointerEnter,
      onUnitDoubleClick,
      tone,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter?.id, chapter?.textHtml, chapter?.html, selectedRange?.start, selectedRange?.end, unitDecoration, renderUnitOverlay, tone]
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
      {usesCustomDragRegion && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 1100 }} />
      )}
      {onBack && (
        <HomeBackPill icon="←" tone={tone} usesCustomDragRegion={usesCustomDragRegion} onClick={onBack} />
      )}
      <StickyTopBar
        tone={tone}
        usesCustomDragRegion={usesCustomDragRegion}
        title={`Chapter ${chapterIndex + 1} of ${chapters.length}`}
        subtitle={chapter.title}
      >
        {chapters.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => onChangeChapter?.(chapters[Math.max(0, chapterIndex - 1)]?.id)}
              disabled={chapterIndex <= 0}
              style={{ ...topBtnStyle(tone, 'ghost'), opacity: chapterIndex <= 0 ? 0.3 : 1 }}
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => onChangeChapter?.(chapters[Math.min(chapters.length - 1, chapterIndex + 1)]?.id)}
              disabled={chapterIndex >= chapters.length - 1}
              style={{ ...topBtnStyle(tone, 'ghost'), opacity: chapterIndex >= chapters.length - 1 ? 0.3 : 1 }}
            >
              Next →
            </button>
          </>
        )}
        {topActions}
        {saveStatus !== undefined && <SaveBadge status={saveStatus} tone={tone} />}
      </StickyTopBar>

      {/* Top padding clears the sticky bar (~54px + 40px drag offset).
          20px was too tight — the first lines of the chapter hid
          under the sticky bar (bug Marie screenshotted). */}
      <div style={{ width: READER_WIDTH, margin: '0 auto', padding: `90px 0 ${paperPaddingBottom}px` }}>
        <div
          className={READER_BODY_CLASS}
          style={{
            background: READER_PAGE_BG,
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: '1.8rem 2.2rem',
            fontSize: READER_FONT_SIZE,
            lineHeight: READER_LINE_HEIGHT,
            minHeight: '60vh',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {renderedContent}
        </div>
      </div>

      {showActionButton && selectedRange && actionPos && onSelectionAction && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onSelectionAction}
          style={{
            position: 'fixed',
            top: actionPos.top,
            left: actionPos.left,
            width: 32,
            height: 32,
            borderRadius: 999,
            background: 'white',
            color: token.ink,
            border: '1px solid ' + token.ink + '66',
            cursor: 'pointer',
            fontSize: '1.1rem',
            fontWeight: 700,
            lineHeight: 1,
            boxShadow: '0 6px 18px rgba(76,72,70,0.18)',
            zIndex: 1550,
            display: 'grid',
            placeItems: 'center',
            WebkitAppRegion: 'no-drag',
          }}
          aria-label={actionButtonIcon === '✎' ? 'Edit annotation' : 'Add annotation'}
          title={actionButtonIcon === '✎' ? 'Edit annotation' : 'Add annotation'}
        >
          {actionButtonIcon}
        </button>
      )}

      {bottomDock}
    </div>
  );
}
