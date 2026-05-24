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

// Per-mode color tokens. Three colors each:
//   pastel — very light fill (chips, active tab background)
//   accent — mid-tone button fill (replaces the old "ink" on solid
//            buttons; ink itself was too wine-y for Marie's taste)
//   ink    — dark text + border accent
// Pastel palette per mode. The `accent` is the mid-tone used as the
// primary-button fill — it MUST stay light/desaturated enough that
// "pastel" still reads when you see a wall of buttons in that color.
//
// History of palette pain Marie has flagged:
//   • Prep was a deep mustard (#D9BE4E) — "horrible mustard yellow."
//   • Then a lighter cream-mustard (#E8D27A) — still yellow, still bad.
//   • Now: sage green, no yellow anywhere.
//   • Quill pink read as red on solid buttons — lightened the accent.
//
// Rule of thumb: keep accent at L > 70% in HSL so white-on-accent reads
// as pastel, not as a strong colored chip. If a future accent needs to
// be darker, switch the button to pastel-bg + ink-text via pickContrast.
export const MODE_TOKENS = {
  proof: { ink: '#5C4A78', accent: '#B8A0D4', pastel: '#EBDEF6' },   // pastel lilac
  prep:  { ink: '#5D7548', accent: '#B5D3A4', pastel: '#E4F0D8' },   // pastel sage (was yellow)
  duet:  { ink: '#3F5772', accent: '#A6BFD9', pastel: '#DEE9F5' },   // pastel blue
  quill: { ink: '#834D5C', accent: '#E2B4C5', pastel: '#F8E2E8' },   // pastel pink (lightened)
};

// Pick black/white text for a given hex background so contrast holds
// when the accent gets pushed lighter. Uses WCAG relative luminance.
// Returns a hex string usable as a CSS color.
export function pickContrastText(hex) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return '#1a1a1a';
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // Lighter accent → use the mode's dark ink; darker accent → white.
  return L > 0.6 ? '#3a2f33' : '#ffffff';
}

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
  // Solid buttons fill with the pastel accent. Text color is picked by
  // luminance so when the accent is light enough that white disappears
  // (Quill pink, Prep sage), we fall back to the dark ink automatically.
  if (variant === 'solid') {
    const bg = token.accent || token.ink;
    return { ...base, background: bg, border: '1px solid ' + bg, color: pickContrastText(bg) };
  }
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

export function StickyTopBar({ onBack, title, subtitle, tone = 'prep', usesCustomDragRegion = false, children }) {
  // The bar sticks DOWN to the same vertical level the home-view's
  // 4-mode pill sits at, so the eye sees one continuous nav row.
  // top:40 leaves room for the macOS traffic-light buttons + the
  // custom drag region; without that the back button hid under the
  // window's red/yellow/green dots (Marie's complaint).
  // Left padding leaves room for the HomeBackPill that floats at
  // left:16 — they share the same row so the pill looks built-in.
  const topOffset = usesCustomDragRegion ? 40 : 16;
  return (
    <div style={{
      position: 'sticky', top: topOffset, zIndex: 1400,
      background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border-light)',
      padding: '10px 16px 10px 92px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minHeight: 54,
      WebkitAppRegion: 'no-drag',
    }}>
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

// HomeBackPill — the single nav pill on the top-left that morphs based
// on where you are. On home view we don't render it (the 4-mode toggle
// occupies the same spot). Inside a project it shows ⌂ and goes home.
// Inside the reader it shows ← and goes back to the book detail. Marie
// wanted the *same container* — same position, same shape — between
// these states so the UI doesn't appear to jump when you navigate.
export function HomeBackPill({ icon = '⌂', onClick, usesCustomDragRegion = false, tone = 'prep' }) {
  const token = MODE_TOKENS[tone] || MODE_TOKENS.prep;
  return (
    <div style={{
      position: 'fixed',
      top: usesCustomDragRegion ? 40 : 16,
      left: 16,
      zIndex: 1500,
      padding: 5,
      borderRadius: 999,
      border: '1px solid var(--accent-border)',
      background: 'rgba(255,255,255,0.92)',
      boxShadow: '0 10px 26px var(--accent-shadow)',
      backdropFilter: 'blur(12px)',
      WebkitAppRegion: 'no-drag',
    }}>
      <button
        type="button"
        onClick={onClick}
        title={icon === '⌂' ? 'Back to your projects' : 'Back to the book'}
        style={{
          border: 'none',
          background: 'transparent',
          padding: '8px 16px',
          borderRadius: 999,
          cursor: 'pointer',
          fontSize: '1.05rem',
          fontWeight: 700,
          color: token.ink,
          lineHeight: 1,
          WebkitAppRegion: 'no-drag',
        }}
      >
        {icon}
      </button>
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
