'use client';

// StJohn Author Studio 4.0 — shared reader / chrome primitives.
//
// Single source of truth for the visual language Marie wants
// reused across every mode (Proof Listen, Prep Manuscript, Duet
// Prep, Quill & Ink, phone). When she says "use the same chapter
// header in every mode" — this is the file.
//
// Today: Prep uses these. Proof Listen still has its own copies
// inside ProofingReader.js because that 2600-line component is a
// separate refactor (tracked in TODO under "shared-reader extraction").
// Migrating Proof to import from here is the next architectural step.

import React from 'react';

// ---------------------------------------------------------------------------
// Paper / reader page
// ---------------------------------------------------------------------------

export const READER_WIDTH = 'min(740px, calc(100vw - 40px))';
export const READER_PAGE_BG = 'linear-gradient(180deg, #fbfaf7 0%, #ffffff 16%, #ffffff 100%)';
export const READER_FONT_SIZE = '16.5px';
export const READER_LINE_HEIGHT = 1.92;
export const HOME_CONTAINER = 640;

// Per-mode ink color tokens. Add more as modes come online.
export const MODE_TOKENS = {
  proof: { ink: '#5C4A78', pastel: '#E5DCEF' },   // pastel purple
  prep:  { ink: '#3F6A52', pastel: '#DCEBE0' },   // pastel green
  duet:  { ink: '#3F5772', pastel: '#DCE6F0' },   // pastel blue
  quill: { ink: '#834D5C', pastel: '#F4DCE0' },   // pastel pink
};

// ---------------------------------------------------------------------------
// ChapterContextPill — small uppercase pill that sits at the top of
// the reader page, showing chapter context (chapter title + optional
// character / narrator labels). Matches the ProofingReader pattern at
// lines 1206-1216 of ProofingReader.js.
// ---------------------------------------------------------------------------

export function ChapterContextPill({ chapterLabel, sectionLabel, extraLabels = [], tone = 'prep' }) {
  const token = MODE_TOKENS[tone] || MODE_TOKENS.prep;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 13px',
        borderRadius: 999,
        background: token.pastel,
        border: '1px solid ' + token.ink + '33',
        fontSize: '0.73rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: token.ink,
        maxWidth: '100%',
      }}
    >
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {chapterLabel}
      </span>
      {sectionLabel && (
        <>
          <span style={{ width: 1, height: 14, background: token.ink + '33' }} />
          <strong style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sectionLabel}</strong>
        </>
      )}
      {extraLabels.filter(Boolean).map((label, i) => (
        <React.Fragment key={i}>
          <span style={{ width: 1, height: 14, background: token.ink + '33' }} />
          <em style={{ fontStyle: 'normal', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</em>
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SaveBadge — small dot + label, used in every mode's sticky top bar.
// ---------------------------------------------------------------------------

export function SaveBadge({ status, tone = 'prep' }) {
  const token = MODE_TOKENS[tone] || MODE_TOKENS.prep;
  const map = {
    idle:   { label: 'Saved',   color: 'var(--text-light)', dot: '#b5cbb9' },
    saving: { label: 'Saving…', color: token.ink,           dot: '#f3c93a' },
    saved:  { label: 'Saved',   color: token.ink,           dot: '#3F8F65' },
  };
  const m = map[status] || map.idle;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.66rem', fontWeight: 600, color: m.color }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot }} />
      {m.label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button factories — keeps every mode's pills sized/coloured the same.
// ---------------------------------------------------------------------------

export function topBtnStyle(tone = 'prep', variant = 'outline') {
  const token = MODE_TOKENS[tone] || MODE_TOKENS.prep;
  const base = {
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
  };
  if (variant === 'ghost') return { ...base, background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)' };
  if (variant === 'danger') return { ...base, background: 'white', border: '1px solid var(--danger)', color: 'var(--danger)' };
  if (variant === 'solid') return { ...base, background: token.ink, border: '1px solid ' + token.ink, color: 'white' };
  return { ...base, background: 'white', border: '1px solid ' + token.ink, color: token.ink };
}

export function pillBtnStyle(tone = 'prep') {
  const token = MODE_TOKENS[tone] || MODE_TOKENS.prep;
  return {
    padding: '5px 11px',
    background: 'white',
    color: token.ink,
    border: '1px solid ' + token.ink,
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}

// ---------------------------------------------------------------------------
// StickyTopBar — universal top chrome for any mode's "inside a project"
// screens. Leaves room on the left for the Home pill.
// ---------------------------------------------------------------------------

export function StickyTopBar({ onBack, title, subtitle, tone = 'prep', leftPad = 16, children }) {
  // Title is absolutely positioned at 50% of the viewport so it stays
  // truly centered no matter how wide the right-side controls are
  // (Marie noticed the reader title sat off-centre while the home title
  // looked right — that was the grid's middle column shrinking).
  // WebkitAppRegion: 'no-drag' opts the whole bar out of Electron's
  // draggable title-strip, so the Back button keeps registering clicks
  // even when the user has scrolled — the top 38px drag region was
  // eating clicks on the back button after scroll.
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 1400,
      background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-light)',
      padding: `10px 16px 10px ${leftPad}px`,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minHeight: 54,
      WebkitAppRegion: 'no-drag',
    }}>
      <button type="button" onClick={onBack} style={{ ...topBtnStyle(tone, 'ghost'), WebkitAppRegion: 'no-drag', position: 'relative', zIndex: 2 }}>← Back</button>
      <div style={{
        position: 'absolute',
        left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        maxWidth: '55%',
        pointerEvents: 'none',
        zIndex: 1,
      }}>
        <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{subtitle}</div>
        )}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 2, WebkitAppRegion: 'no-drag' }}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HomePill — when inside a project, replaces the 4-mode pill with a
// single "⌂ Home" button that returns to that mode's library.
// ---------------------------------------------------------------------------

export function HomePill({ onClick, tone = 'prep', usesCustomDragRegion }) {
  const token = MODE_TOKENS[tone] || MODE_TOKENS.prep;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Back to library"
      style={{
        position: 'fixed',
        top: usesCustomDragRegion ? 44 : 18,
        left: 16,
        zIndex: 1300,
        padding: '9px 16px',
        borderRadius: 999,
        border: '1px solid ' + token.ink,
        background: 'white',
        color: token.ink,
        fontSize: '0.74rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        boxShadow: '0 10px 26px var(--accent-shadow)',
        WebkitAppRegion: 'no-drag',
      }}
    >
      ⌂ Home
    </button>
  );
}

// ---------------------------------------------------------------------------
// useDismissable — close-on-outside-click + Escape, used everywhere a
// popover or inline editor lives.
// ---------------------------------------------------------------------------

export function useDismissable(open, onClose, ignoreRef) {
  React.useEffect(() => {
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
