// Phone reader — the canonical word render + double-tap + drag-handle +
// block-highlight + scroll-vs-page-swipe surface. Used by both Quill
// (annotations) and Script (flags) on the phone.
//
// Ported from the v1 Studio phone, which Marie said was "thoroughly
// debugged — pull it in, don't re-invent it." The selection model:
//   • single tap on a word = soft tap, stored
//   • second tap within 420ms on same word = double-tap = open selection
//   • drag the start/end handle (little circle pins) to extend
//   • each selected word's span includes its trailing whitespace, so
//     consecutive selected words look like one continuous block
//
// The reader is presentation-only. Selection state is controlled by the
// parent, so the parent can also open/close popovers, save annotations,
// save flags, etc.

'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { renderReaderContent } from './renderReaderContent.js';
import {
  getPhoneReaderBackgroundColor,
  getPhoneReaderLineHeight,
  getPhoneReaderMargin,
} from '../_lib/readerSettings.js';

const DOUBLE_TAP_MS = 420;

export default function PhoneReader({
  html,                  // section/chapter rich-text HTML
  plainText,             // fallback plain text (for SSR + word-count)
  words,                 // pre-computed buildWordSpans result
  settings,              // PhoneReader settings (font, size, mode, etc.)
  selectedRange,         // { start, end } | null — controlled
  onSelectionChange,     // (range | null) => void
  wordDecoration,        // optional (idx) => { background?, borderBottom?, color? }
  syncWordIndex = -1,    // current audio-synced word index, or -1
  tone = { ink: '#834D5C', accent: '#E2B4C5', pastel: '#F8E2E8' },
  selectionTone,         // optional override { background, handleBg, handleBorder }
}) {
  const articleRef = useRef(null);
  const dragHandleRef = useRef('');          // 'start' | 'end' | ''
  const lastTapRef = useRef({ index: -1, time: 0 });

  const margin = getPhoneReaderMargin(settings.margin);
  const lineHeight = getPhoneReaderLineHeight(settings.lineHeight);
  const bgColor = getPhoneReaderBackgroundColor(settings.background);
  const isPageMode = settings.readerMode === 'page';
  const paragraphIndent = settings.paragraphStyle === 'indent';
  const align = settings.alignment === 'justify' ? 'justify' : 'left';
  const selBg = selectionTone?.background || hexWithAlpha(tone.ink, 0.22);
  const handleBg = selectionTone?.handleBg || 'white';
  const handleBorder = selectionTone?.handleBorder || tone.ink;

  // Clear drag flag on window pointer release.
  useEffect(() => {
    const clear = () => { dragHandleRef.current = ''; };
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, []);

  // While dragging a handle, block page scroll so the drag tracks.
  useEffect(() => {
    if (!selectedRange) return undefined;
    const onPointerMove = (event) => {
      if (!dragHandleRef.current) return;
      event.preventDefault();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-word-index]');
      const idx = Number(target?.getAttribute('data-word-index'));
      if (Number.isFinite(idx)) {
        const edge = dragHandleRef.current;
        const range = selectedRange;
        const next = edge === 'start'
          ? { start: idx, end: range.end }
          : { start: range.start, end: idx };
        onSelectionChange(normalizeRange(next));
      }
    };
    const preventScroll = (event) => {
      if (dragHandleRef.current) event.preventDefault();
    };
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', preventScroll);
    };
  }, [selectedRange, onSelectionChange]);

  // Auto-scroll to keep the synced word in view (when sync is on + no
  // active selection). Avoids horizontal scroll-jumps in page mode.
  useEffect(() => {
    if (selectedRange || syncWordIndex < 0) return;
    const node = articleRef.current?.querySelector(`[data-word-index="${syncWordIndex}"]`);
    if (!node) return;
    node.scrollIntoView(isPageMode
      ? { block: 'nearest', inline: 'center', behavior: 'smooth' }
      : { block: 'center', behavior: 'smooth' });
  }, [syncWordIndex, selectedRange, isPageMode]);

  const normalized = useMemo(() => selectedRange ? normalizeRange(selectedRange) : null, [selectedRange]);

  function handleWordPointerDown(index, event) {
    if (dragHandleRef.current) return;
    if (event.shiftKey && normalized) {
      onSelectionChange(normalizeRange({ start: normalized.start, end: index }));
      return;
    }
    const now = Date.now();
    const last = lastTapRef.current;
    const isDouble = last.index === index && now - last.time < DOUBLE_TAP_MS;
    lastTapRef.current = isDouble ? { index: -1, time: 0 } : { index, time: now };
    if (isDouble) {
      event.preventDefault?.();
      onSelectionChange({ start: index, end: index });
    }
  }

  function handleWordPointerEnter(index) {
    if (!dragHandleRef.current || !normalized) return;
    const edge = dragHandleRef.current;
    const next = edge === 'start' ? { start: index, end: normalized.end } : { start: normalized.start, end: index };
    onSelectionChange(normalizeRange(next));
  }

  function handleWordDoubleClick(index, event) {
    event.preventDefault?.();
    onSelectionChange({ start: index, end: index });
  }

  function onHandlePointerDown(edge, event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragHandleRef.current = edge;
  }

  function onHandlePointerMove(event) {
    if (!dragHandleRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-word-index]');
    const idx = Number(target?.getAttribute('data-word-index'));
    if (!Number.isFinite(idx) || !normalized) return;
    const edge = dragHandleRef.current;
    const next = edge === 'start' ? { start: idx, end: normalized.end } : { start: normalized.start, end: idx };
    onSelectionChange(normalizeRange(next));
  }

  function onHandlePointerUp(event) {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragHandleRef.current = '';
  }

  // Word renderer — block highlight is achieved by putting the trailing
  // whitespace INSIDE the segment span so the background colour bleeds
  // across word breaks for consecutive selected words.
  function renderWord({ word, after, index, key }) {
    const inSel = !!normalized && index >= normalized.start && index <= normalized.end;
    const isStart = !!normalized && index === normalized.start;
    const isEnd = !!normalized && index === normalized.end;
    const isSync = syncWordIndex === index && !inSel;
    const deco = wordDecoration ? (wordDecoration(index) || {}) : {};
    const segStyle = {
      position: 'relative',
      padding: '0 1px',
      borderRadius: 3,
      cursor: 'pointer',
      whiteSpace: 'pre-wrap',
    };
    if (deco.borderBottom) segStyle.borderBottom = deco.borderBottom;
    if (deco.background && !inSel) segStyle.background = deco.background;
    if (deco.color) segStyle.color = deco.color;
    if (isSync) segStyle.background = hexWithAlpha(tone.ink, 0.16);
    if (inSel) {
      segStyle.background = selBg;
      segStyle.boxShadow = `inset 0 -2px 0 ${tone.ink}`;
    }
    return (
      <span
        key={key}
        data-word-index={index}
        onPointerDown={(e) => handleWordPointerDown(index, e)}
        onPointerEnter={() => handleWordPointerEnter(index)}
        onDoubleClick={(e) => handleWordDoubleClick(index, e)}
        style={segStyle}
      >
        {isStart && (
          <button
            type="button"
            aria-label="Drag selection start"
            onPointerDown={(e) => onHandlePointerDown('start', e)}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
            style={handleStyle('start', handleBg, handleBorder)}
          />
        )}
        {word}
        {isEnd && (
          <button
            type="button"
            aria-label="Drag selection end"
            onPointerDown={(e) => onHandlePointerDown('end', e)}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
            style={handleStyle('end', handleBg, handleBorder)}
          />
        )}
        {after}
      </span>
    );
  }

  const content = useMemo(
    () => renderReaderContent({ html, words, renderWord, keyPrefix: 'phone' }),
    // We deliberately re-run on selection / sync / settings changes so
    // word styling stays accurate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [html, words, normalized?.start, normalized?.end, syncWordIndex, settings.font, settings.readerSize, settings.background, settings.alignment, settings.paragraphStyle, settings.lineHeight, settings.margin, settings.readerMode]
  );

  const baseStyle = {
    background: bgColor,
    color: '#3a2f33',
    fontFamily: settings.font,
    fontSize: `${settings.readerSize}px`,
    lineHeight,
    textAlign: align,
    hyphens: 'auto',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    padding: `${margin.y} ${margin.x}`,
    borderRadius: 14,
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 14px 34px rgba(76,72,70,0.07)',
  };

  if (isPageMode) {
    Object.assign(baseStyle, {
      height: 'calc(100svh - 220px)',
      minHeight: 'min(560px, calc(100svh - 220px))',
      overflowX: 'auto',
      overflowY: 'hidden',
      columnWidth: 'min(620px, calc(100vw - 60px))',
      columnGap: 'clamp(40px, 12vw, 96px)',
      columnFill: 'auto',
      scrollSnapType: 'x mandatory',
      scrollPaddingInline: margin.x,
      overscrollBehaviorX: 'contain',
      touchAction: 'pan-x',
      WebkitOverflowScrolling: 'touch',
    });
  }

  const paragraphStyleTag = (
    <style>{`
      .phone-reader-article > * { break-inside: avoid; ${isPageMode ? 'scroll-snap-align: start;' : ''} }
      .phone-reader-article h1, .phone-reader-article h2, .phone-reader-article h3 { margin: 0 0 0.85rem; line-height: 1.2; color: ${tone.ink}; }
      .phone-reader-article p { margin: 0 0 0.9rem; }
      ${paragraphIndent
        ? `.phone-reader-article p { text-indent: 1.6em; margin-top: 0; margin-bottom: 0; }
           .phone-reader-article p:first-of-type,
           .phone-reader-article h1 + p,
           .phone-reader-article h2 + p,
           .phone-reader-article h3 + p { text-indent: 0; }`
        : ''}
      .phone-reader-article em { font-style: italic; }
      .phone-reader-article strong { font-weight: 700; }
    `}</style>
  );

  return (
    <div ref={articleRef} className="phone-reader-article" style={baseStyle} data-reader-mode={settings.readerMode}>
      {paragraphStyleTag}
      {(!words || !words.length) ? (
        <p style={{ color: '#9B928E', fontSize: '0.86rem' }}>No text in this section.</p>
      ) : content}
    </div>
  );
}

// Width of the reader's outer column. Used by the caller's popovers so
// they line up with the reader.
export const PHONE_READER_MAX_WIDTH = 620;

function normalizeRange(range) {
  if (!range) return null;
  const start = Math.min(range.start, range.end);
  const end = Math.max(range.start, range.end);
  return { start, end };
}

function handleStyle(edge, bg, border) {
  return {
    position: 'absolute',
    zIndex: 4,
    [edge === 'start' ? 'left' : 'right']: -10,
    bottom: '-0.95em',
    width: 22,
    height: 22,
    border: `2px solid ${border}`,
    borderRadius: '50%',
    background: bg,
    boxShadow: '0 4px 12px rgba(76,72,70,0.16)',
    cursor: 'grab',
    touchAction: 'none',
    padding: 0,
    WebkitUserSelect: 'none',
    userSelect: 'none',
  };
}

function hexWithAlpha(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return `rgba(131,77,92,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
