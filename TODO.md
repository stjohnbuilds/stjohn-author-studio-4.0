# TODO — StJohn Author Studio 4.0

Active and recently archived tasks. Rules for this file are in
`CLAUDE.md` under "TODO.md rules".

## Active Tasks

### Phase 1 — Bootstrap (in progress)

- [x] Create `~/Dev/StJohn-Author-Studio-4.0/` and copy Script and Sync
      3.0 in as the base — completed 2026-05-23
- [x] Set up `.claude/` with scope-locked hooks per bible Step 2.5 —
      completed 2026-05-23
- [x] Write `CLAUDE.md` — completed 2026-05-23
- [ ] Write `docs/BUILD_PLAN_V4.md` — phased plan, definition of done
      per phase, shared-reader rule baked in.
- [ ] Write truth tree skeletons (`docs/FRONT_FUNCTION_TREE.md`,
      `docs/INTERNAL_FUNCTION_TREE.md`, `docs/WIRING_MATRIX.md`)
      populated from Script and Sync 3.0 as the baseline, with empty
      rows for Prep / Duet / Quill / Phone to fill in as each is added.

### Phase 2 — Git + GitHub

- [x] `git init`, first commit "4.0 bootstrap from Script and Sync 3.0"
      — completed 2026-05-23
- [x] Create GitHub repo `stjohn-author-studio-4.0`, push main —
      completed 2026-05-23
      → https://github.com/stjohnbuilds/stjohn-author-studio-4.0
- [x] Confirm hooks fire after the push — log entry present —
      completed 2026-05-23

### Phase 3 — Archive the dead

- [x] Rename in Google Drive (added `-ARCHIVED-2026-05-23` suffix):
      `StJohn Author Apps/apps/phone`,
      `StJohn Author Apps/apps/quill-and-ink`,
      `StJohn Author Apps/apps/script-and-sync`,
      `Script and Sync` (older proofer) — completed 2026-05-23
      (`StJohn Author Studio 2.0` was already archived in Google Drive.)
- [x] Archive `stjohnbuilds/stjohn-author-studio-2.0` on GitHub —
      completed 2026-05-23
- [ ] Confirm with Marie which other GitHub repos to archive (likely
      candidates: `Audioproofer`, `Audioproofer-Electron`,
      `loveworn-design-studio`). Skipped until she confirms.

### Phase 4 — Rebrand the base

- [x] Renamed npm package, app id, productName, window title, Save Data
      folder, AppUserModelId, layout metadata — completed 2026-05-23
- [x] Home-screen 4-mode segmented switcher added
      (`app/components/ModeSwitcher.js`). Proof Listen active; Prep,
      Duet, Quill show ComingSoonPanel with phase number — completed
      2026-05-23
- [ ] Marie opens the new 4.0 app, sees the 4-mode switcher, clicks
      each tab, confirms it looks right. (Run `npm install` first, then
      `npm start`.)
- [ ] First Mac packaged build to confirm rebrand works end-to-end.
- [ ] Migrate (optional): point Save Folder at the old `Script and Sync`
      data location if Marie wants her existing books in 4.0.

### Prep export — preserve original manuscript layout

- [ ] **Highlighted .docx — preserve the ORIGINAL .docx exactly**
      v6.4 reproduces the paragraph + heading structure of the
      manuscript and highlights only the dialogue runs. v6.5 added a
      Garamond-based styles.xml so the result reads like a novel
      manuscript instead of Calibri. But it still loses italics,
      bold, the user's actual fonts, page numbers, and any custom
      formatting from the source .docx.
      The proper fix is to store the imported .docx bytes alongside
      the project and, on export, patch THAT document's
      `word/document.xml` to wrap the detected dialogue spans with
      highlight runs (and side voices with `<w:commentReference>`).
      That keeps 100% of the source formatting because we never
      rebuild — we only inject. Approach:
        1. Save `fileBytes` (Uint8Array) on the project at import.
        2. On export: JSZip.loadAsync the bytes, parse document.xml,
           map our (sectionIndex, spanIndex) to XML positions
           (need to walk paragraphs in document order and match by
           text content), wrap the matched runs.
        3. Prepend our narrator-breakdown paragraphs to the body.
        4. Add comments.xml + content-type + commentReference for
           side voices.
      Probably ~300-400 lines of focused code; biggest risk is
      position-mapping between our HTML view and OOXML.

### UI / architecture follow-ups discovered during Phase 6

- [ ] **Studio landing page (4-mode picker)** — first screen on launch
      should be a small picker for Proof / Prep / Duet / Quill, not
      dropping the user straight into Proof. Marie flagged this; lives
      in `app/page.js` `HomePage`. Keep the existing in-mode home pages
      as the second screen.
- [ ] **Migrate ProofingReader to use `app/components/ReaderChrome.js`**
      — Prep now uses the shared `ChapterContextPill`, `StickyTopBar`,
      `SaveBadge`, `HomePill`, button-style factories, and the
      `useDismissable` popover-close hook. ProofingReader still has its
      own copies of all of these. When that 2600-line component is
      refactored, swap them out so a single visual edit propagates to
      every mode.
- [ ] **Same for Duet `PrebuildMode`** — uses its own AppModeToggle
      placement, no shared chrome yet.
- [ ] **Migrate Proof's `BookSetup` to use `ImportFlow`** — Prep + Duet
      now share `app/components/ImportFlow.js` for the upload + chapter
      checkbox list. Proof's `ManuscriptSetup.js` still has its own copy
      because it layers PDF paging + narrator colour mapping on top. The
      goal is for BookSetup to use `ImportFlow` for the upload/chapter
      piece and add the Proof-only steps as panels around it. Marie's
      "use the baseline" rule applies here too; this is the last
      duplicate of the upload flow.
- [ ] **Quote-insert fixes should patch the original .docx export too**
      — the SectionFixer in Prep now rewrites `section.html` so the
      dialogue detector reruns and the warning clears, but the saved
      `sourceDocxBase64` (used by the in-place export) isn't touched.
      For most fixes this is fine because the dialogue text doesn't
      change. But if Marie actually adds new text (not just a close
      quote), the export will not reflect it. Track manual edits as a
      side list and replay them into the source XML during export.

### Phase 5 — Mode 1: Proof Listen working on real file

- [ ] Mark every Proof Listen button as `verified live` in
      `WIRING_MATRIX.md` after Marie clicks it on her real audiobook.
- [ ] Confirm Save Data lands in the right folder.

### Phase 6 — Mode 2: Prep Manuscript

- [ ] Port from current `packages/manuscript-engine/` (real, working).
- [ ] Build the dialogue-assignment UI on top of the shared reader.
- [ ] Export highlighted DOCX + narrator chapter list.

### Phase 7 — Mode 3: Duet Prep

- [ ] Port marker logic from `Timestamp Finder Duet Edition 2.0`
      reference.
- [ ] Reuse shared reader + audio engine.

### Phase 8 — Mode 4: Quill & Ink

- [ ] Port annotation list UI (the + and edit icons Marie liked) from
      the alpha Quill reference.
- [ ] Reuse shared reader.
- [ ] Wire InDesign export.

### Phase 9 — Phone companion

- [ ] Port phone Next.js scaffold from
      `StJohn Author Apps/apps/phone` reference.
- [ ] Login (Supabase auth).
- [ ] Project list + chapter open + transcript text.
- [ ] Local audio picker + matching.
- [ ] Script flags + Quill annotations save to cloud.
- [ ] CSV export from phone.
- [ ] Deploy to Vercel.

### Phase 10 — Real-file end-to-end pass

- [ ] Marie runs every minimum-release check on her actual books +
      audiobooks. Every row in `WIRING_MATRIX.md` flips to
      `verified live`.
- [ ] Phone signed-in proof: real flag + real annotation saved from
      phone, seen on desktop.

### Phase 11 — Release

- [ ] Mac + Windows packaged builds.
- [ ] Phone deploy live.
- [ ] First user release.

## Archived

(empty — Phase 1 still in progress)
