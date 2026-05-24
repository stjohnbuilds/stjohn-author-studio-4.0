# Tasks — Phase 6 Prep Manuscript

Checklist for the five passes from the plan. **Nothing here starts
until Marie says go on the plan.**

## Pass 1 — Port the engine

- [ ] Copy `packages/manuscript-engine/dialogue-detection/index.js`
      from 2.0 → 4.0.
- [ ] Copy `packages/manuscript-engine/dialogue-safety-check/index.js`
      from 2.0 → 4.0.
- [ ] Create `packages/manuscript-engine/index.js` re-export.
- [ ] Add a small smoke test under `tests/`.
- [ ] Commit: `Phase 6 pass 1 — port dialogue-detection engine`.

## Pass 2 — Route + empty screen

- [ ] Create `app/prep-manuscript/page.js` with empty state +
      "Import manuscript" button.
- [ ] Flip Prep mode `enabled: true` in `APP_MODES`.
- [ ] Route `appMode === 'prep-manuscript'` to render the new page
      (replace the ComingSoonScreen branch for Prep).
- [ ] Marie opens app, clicks Prep tab, sees empty state, no crash.
- [ ] Commit: `Phase 6 pass 2 — empty Prep screen + tab wiring`.

## Pass 3 — Import + detection (read-only)

- [ ] Wire Import button → `window.electron.readManuscriptFile()`.
- [ ] Run result through `detectDialogueSpans`.
- [ ] Render chapter-grouped list of dialogue lines with context.
- [ ] Marie clicks Import on a real manuscript, sees correct lines.
- [ ] Commit: `Phase 6 pass 3 — dialogue detection display`.

## Pass 4 — Character + narrator assignment

- [ ] Sidebar to add/edit/remove characters with color swatch.
- [ ] Per-row character + narrator dropdown.
- [ ] Persist to `prebuild-projects.json` via existing IPC.
- [ ] Tint each row by assigned character color.
- [ ] Marie assigns characters on a real file, saves, reopens, sees
      assignments restored.
- [ ] Commit: `Phase 6 pass 4 — character assignment`.

## Pass 5 — Export

- [ ] Port `packages/exports/docx/` from 2.0.
- [ ] Add `prep:export-docx` IPC handler + `prepExportDocx` bridge.
- [ ] "Export highlighted .docx" button.
- [ ] "Export narrator chapter list (CSV)" button.
- [ ] Marie exports, opens in Word, colors right.
- [ ] Commit: `Phase 6 pass 5 — Prep exports`.

## Close-out

- [ ] Move this folder to `dev/archived/phase-6-prep-manuscript/`.
- [ ] Mark Phase 6 row complete in `TODO.md` with date + time.
- [ ] Flip every Prep row in `docs/WIRING_MATRIX.md` to verified-live.
