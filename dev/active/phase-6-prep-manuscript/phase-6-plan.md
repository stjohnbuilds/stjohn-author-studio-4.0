# Plan — Phase 6: Prep Manuscript mode

**Status:** DRAFT. Waiting on Marie's go.

## Goal

Build the Prep Manuscript mode end-to-end so Marie can: import a Word
manuscript → see every line of dialogue automatically detected → assign
each line to a character/narrator → export a highlighted .docx + a
narrator-by-chapter list.

This is the mode the 2.0 rebuild tried to build and never finished
(SAMPLE-only). We are building it for real, on top of the working SaS
3.0 base + the proven dialogue-detection engine from 2.0.

## What this mode does (in 5 plain bullets)

1. **Import** a `.docx` manuscript.
2. **Detect** every dialogue span automatically (quoted speech).
3. **Show** the dialogue list grouped by chapter, with each line on a
   row alongside its surrounding context.
4. **Assign** each line to a character/narrator (color-coded). Add new
   side characters on the fly.
5. **Export** a highlighted `.docx` (Word can open it) + a narrator
   chapter list (CSV).

## What we already have

- **Dialogue-detection engine** lives in 2.0 at
  `~/Dev/StJohn-Author-Studio-2.0/packages/manuscript-engine/dialogue-detection/index.js`
  — 324 lines, pure function, tested. Port it.
- **Safety-check engine** at the same place
  (`dialogue-safety-check/index.js`, 91 lines). Catches missing quotes,
  ambiguous attributions. Port it.
- **DOCX import** — SaS 3.0 has working DOCX read via Mammoth in
  `main.js` (`window.electron.readManuscriptFile`). Reuse, don't rebuild.
- **DOCX export with highlights** — SaS 3.0 doesn't have it. The 2.0
  rebuild had `packages/exports/docx/`. Port that.
- **Save Data / projects persistence** — SaS 3.0 has working
  `writeData` IPC. Reuse for `prebuild-projects.json` (already exists).

## What we are NOT doing in Phase 6

- Audio attachment to Prep projects (Prep is text-only).
- Cloud sync for Prep (desktop-only per the build plan).
- Editing the manuscript text (we never edit — only tag).
- The shared reader (Prep doesn't render the manuscript as a Kindle
  page; it shows a dialogue LIST, not the full text).

## Approach — five passes

Each pass commits cleanly, builds cleanly, and is small enough to
review.

### Pass 1 — Port the engine (no UI)

- Copy `packages/manuscript-engine/dialogue-detection/` from 2.0 →
  `packages/manuscript-engine/dialogue-detection/` in 4.0.
- Same for `dialogue-safety-check/`.
- Add a small `packages/manuscript-engine/index.js` re-export so we
  can `import { detectDialogueSpans } from '@/packages/manuscript-engine'`.
- Write 1–2 unit-style smoke tests under `tests/` (text in →
  expected spans out).

### Pass 2 — Route + empty screen

- Add `app/prep-manuscript/page.js` with the matching scaffold (empty
  state + Import button).
- Wire the Prep mode tab: flip `enabled: true` for `prep-manuscript`
  in `APP_MODES`; when selected, render the new page (replace the
  current ComingSoonScreen branch for Prep).

### Pass 3 — Import + detection display (read-only)

- Click Import → run SaS 3.0's existing `readManuscriptFile` IPC →
  feed result into `detectDialogueSpans`.
- Render a chapter-grouped list: each detected dialogue line on its
  own row with 3–5 words of surrounding context shown in dim text.
- No assignment UI yet — just the list. This proves detection works
  on Marie's real files.

### Pass 4 — Character / narrator assignment

- Per-row dropdown for character + narrator.
- Sidebar to add/edit/remove characters (with color swatch).
- Persist to `prebuild-projects.json` via the existing IPC.
- Re-render the list with each row tinted by its assigned character's
  color.

### Pass 5 — Export

- "Export highlighted .docx" button → uses the dialogue spans +
  assignments to build a Word doc where each line is highlighted in
  its character's color.
- "Export narrator chapter list (CSV)" button → one row per chapter
  with the narrators used.

## Risks + how we handle them

- **Dialogue detection isn't perfect on every manuscript.** We don't
  paper over this. The list shows what we detected and gives Marie an
  "add manual dialogue" affordance (Pass 4).
- **Engine drift.** Once dialogue-detection is in `packages/`, every
  mode that uses it (Prep today, maybe Quill later for quote spans)
  uses the same version. Fix once = fixed everywhere — same rule as
  the shared reader.
- **No shell of an app.** Each pass produces a working, testable
  surface. No "looks great, buttons don't work."

## Definition of done

- Marie imports one of her real manuscripts in Prep mode.
- The dialogue list shows the right lines.
- She assigns characters to a few rows.
- She exports the highlighted .docx and opens it in Word — colors are
  right.
- She exports the CSV chapter list.
- Each verified click flips a row in `docs/WIRING_MATRIX.md` to
  `verified live` with date + filename.
