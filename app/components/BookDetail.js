'use client';

// Shared "book detail" page for every mode that opens a project.
// Marie's rule: when you click into a book, every mode should look the
// SAME. Quill's clean look is the baseline: no gradient, simple white
// rows, mode-toned accent text. Modes that need extra panels (Proof's
// audio queue, Duet's scan navigator) drop them into the prePanels /
// postPanels slots — they don't get to re-skin the chrome.
//
// Inputs are deliberately small. If you find yourself wanting a new
// prop that's specific to one mode, stop and use a slot instead.
//
// Currently used by: QuillAndInkMode, PrebuildMode (Duet).
// Not used by: PrepManuscriptMode (different feature surface — characters
//   + dialogue counts, no audio) or ProofingReader/SessionsView
//   (separate 2385-line refactor logged in TODO).

import React from 'react';
import {
  HomeBackPill,
  SaveBadge,
  StickyTopBar,
  topBtnStyle,
  MODE_TOKENS,
} from './ReaderChrome.js';

const BOOK_DETAIL_WIDTH = 'min(760px, calc(100vw - 32px))';

export default function BookDetail({
  tone = 'prep',
  title,
  subtitle,
  saveStatus,
  usesCustomDragRegion = false,
  onBackHome,
  // Buttons rendered between the sticky bar and the chapter list (the
  // "what can I do with this book" row — exports, replace, etc).
  actionButtons = null,
  // Optional panels above the chapter list (e.g. Proof's audio queue,
  // Duet's scan navigator). Stay null for the simplest Quill look.
  prePanels = null,
  // The chapter list itself. Modes render their own rows here using
  // either <ChapterRow /> or a fully custom row when they need more.
  children,
  // Optional panels below the chapter list.
  postPanels = null,
  // Delete button. We render the button + confirm — the mode handles
  // the actual delete. Pass null to hide.
  onDelete = null,
  deleteLabel = 'Delete project',
}) {
  const token = MODE_TOKENS[tone] || MODE_TOKENS.prep;

  return (
    <>
      {onBackHome && (
        <HomeBackPill
          icon="⌂"
          tone={tone}
          usesCustomDragRegion={usesCustomDragRegion}
          onClick={onBackHome}
        />
      )}
      <StickyTopBar
        tone={tone}
        usesCustomDragRegion={usesCustomDragRegion}
        title={title}
        subtitle={subtitle}
      >
        {saveStatus !== undefined && <SaveBadge status={saveStatus} tone={tone} />}
      </StickyTopBar>

      {/* Top padding 90px clears the sticky bar (~54px + 40px drag
          offset). Previously 20px let action buttons sit under the
          sticky bar — the bug Marie screenshotted on book detail. */}
      <div style={{ width: BOOK_DETAIL_WIDTH, margin: '0 auto', padding: '90px 0 80px' }}>
        {actionButtons && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            {actionButtons}
          </div>
        )}

        {prePanels}

        <section
          style={{
            background: 'rgba(255,255,255,0.86)',
            border: '1px solid var(--border)',
            borderRadius: 22,
            padding: '1rem',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: token.ink,
              }}
            >
              Chapters
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Click a chapter to open it
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: '60vh', overflowY: 'auto' }}>
            {children}
          </div>
        </section>

        {postPanels}

        {onDelete && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => {
                if (confirm(`${deleteLabel}?\nThis can't be undone.`)) onDelete();
              }}
              style={topBtnStyle(tone, 'danger')}
            >
              {deleteLabel}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// Standard chapter row. Use this for the simple case; modes that need
// audio-status icons / scan buttons / merge controls can render their
// own row instead.
export function ChapterRow({
  tone = 'prep',
  number,
  title,
  meta,                // small grey subtitle string under the title
  onClick,
  rightControls = null, // extra controls before the chevron (scan buttons, etc)
  chevron = true,
}) {
  const token = MODE_TOKENS[tone] || MODE_TOKENS.prep;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 14,
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {number != null && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 32,
            padding: '4px 9px',
            borderRadius: 999,
            background: token.pastel,
            color: token.ink,
            fontSize: '0.7rem',
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {number}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.92rem',
            color: 'var(--text)',
            marginBottom: meta ? 2 : 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        {meta && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{meta}</div>
        )}
      </div>
      {rightControls}
      {chevron && (
        <span style={{ color: 'var(--text-light)', fontSize: '1.2rem', paddingLeft: 6 }}>›</span>
      )}
    </button>
  );
}
