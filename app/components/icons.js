'use client';

// Line-style SVG icons. No external dep. Use these instead of emojis
// for action buttons (Marie 2026-06-04: "all icons … line, clean
// icons, not emojis").
//
// Each icon takes { size = 16, stroke = 'currentColor', ...props }.
// Color comes from the surrounding text, so they just work inside any
// coloured button.

import React from 'react';

function svg(paths, opts = {}) {
  return function Icon({ size = 16, stroke = 'currentColor', strokeWidth = 1.75, style, ...rest }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, verticalAlign: '-2px', ...style }}
        {...rest}
      >
        {paths}
      </svg>
    );
  };
}

// Download arrow — for Export Flags / Export for Engineer
export const IconDownload = svg(
  <>
    <path d="M12 3v12" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 21h14" />
  </>
);

// Plus sign — for Make markers from CSV
export const IconPlus = svg(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
);

// Eye — for See errors
export const IconEye = svg(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

// Cycling arrows — for Transfer
export const IconTransfer = svg(
  <>
    <path d="M17 2l3 3-3 3" />
    <path d="M4 11V9a4 4 0 0 1 4-4h12" />
    <path d="M7 22l-3-3 3-3" />
    <path d="M20 13v2a4 4 0 0 1-4 4H4" />
  </>
);

// Trash — for delete buttons
export const IconTrash = svg(
  <>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>
);

// Flag — for replacing 🚩 (later sweep)
export const IconFlag = svg(
  <>
    <path d="M4 21V4" />
    <path d="M4 4h12l-2 4 2 4H4" />
  </>
);
