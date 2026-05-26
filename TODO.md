# TODO — StJohn Author Studio 4.0

Active and archived tasks. New work goes under **Active**. Completed
work moves to **Archived** with a date.

Format: `- [x] Task name — completed YYYY-MM-DD`. Never leave a task
as 2–3 words. Add context.

Always read `HANDOFF.md` first, then this file.

---

## Active

### ⭐ PRIMARY — Final round bug-fix assessment

**The active checklist lives in
`dev/active/FINAL-ROUND-checklist.md`** (created 2026-05-26).

Part A is hands-on for Marie (every mode, real books, real audio).
Part B is the deep dive for Claude (cloud round-trip, edge cases,
code health, hook health). Part C is the watch list.

When this checklist is fully ticked, archive it under `dev/archive/`
with the run date and open a fresh TODO.md.

Everything below this line was the OLD active list, kept here for
context until the final-round walkthrough closes.

---

### OLD — Marie's testing checklist (superseded by FINAL-ROUND-checklist.md)

- [x] **Sign in** — completed 2026-05-25. Supabase project
      `evcusovtjfypfyfvnooy` wired; Marie signs in with her existing
      account.
- [x] **Four mode colours look right** — completed 2026-05-25.
      Verified live: each mode wears its own pastel, no purple leak,
      card headers flat.
- [ ] **Re-test a real Proof audiobook on the NEW unified UI.**
      The book detail is now SessionsView (same component Quill +
      Duet use). Walk through the usual flow — confirm title, action
      buttons, side nav, chapter list, audio panels, delete still
      work. The big purple banner is gone; deleted is now a tiny 🗑
      top-right. **If anything's broken vs the last build, tell me.**
- [ ] **Re-test Quill on a real .docx on the NEW unified UI.**
      Quill book-detail is also SessionsView now (mode="quill"). New
      project → upload a manuscript → open a chapter → drag across
      words → tap pink + → pick a class → save. Confirm the pink
      underline + sidebar entry. Also: Split toggle ON should now
      reveal scene rows from H2 sub-headings.
- [ ] **Test the InDesign export.** Book detail → Export CSV +
      InDesign. Open the .jsx in InDesign and run against a real
      layout. Eyes-on check: are character styles created? Are
      highlights underlined? Marie is the only one who can verify
      "right" for her print workflow.
- [ ] **Test the phone scaffold.** Browser to `http://localhost:3000/phone`
      while `npm run dev` is running. Sign in with the same account.
      Quill project from the desktop should appear. Open a chapter,
      tap a word, add an annotation. Reload the desktop — annotation
      should appear there too. (Cloud round-trip confirmation.)

### Next up after Marie's checklist

- [x] **Cloud sync for Proof Listen.** Built — packages/cloud-sync/proof-sync.js
      with push/pull/delete, wired into app/page.js with debounced push
      and on-load merge. Audio paths flow through audio-guard.js. —
      completed 2026-05-25 (overnight)

- [x] **Phone Script mode (Proof Listen on phone).** Built — phone has
      both Quill and Script services now. Script flow: project list
      from `pullProofProjects` → chapter list → section reader → tap to
      select word → flag panel with type dropdown + note + save. Saved
      flags push to cloud via `pushProofProject`. — completed 2026-05-25
      (overnight)

- [x] **Phone CSV export.** Built — Export CSV button on both Quill
      (annotations) and Script (flags) project views. Inline
      `buildFlagsCsv` for now; tracked under "Export helpers
      consolidation" if you ever want it lifted to `packages/exports/`. —
      completed 2026-05-25 (overnight)

- [x] **Phone audio playback in Quill mode.** Built —
      `<PhoneAudioDock>` is a small fixed-bottom dock with file picker,
      play/pause, scrubber, speed, close. Shared by Quill and Script.
      Audio stays on the phone. Script reader captures the current
      audio time as the flag's `ts`. — completed 2026-05-25 (overnight)

- [x] **Deploy phone to Vercel.** Live at
      **https://stjohn-author-studio-4.vercel.app/phone**. Linked to the
      Vercel project `marie-mackays-projects/stjohn-author-studio-4`,
      env vars (`NEXT_PUBLIC_SUPABASE_URL` +
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) set in production scope,
      first deploy ready. Both `/` and `/phone` return 200. —
      completed 2026-05-25

- [x] **Phone IS the root on Vercel.** Added build-time swap script
      `scripts/vercel-root-to-phone.js` that copies the phone HTML
      over `out/index.html` when `VERCEL=1`. URL bar stays as `/`,
      no bounce, no redirect. Electron's release scripts call
      `next build` directly so the swap doesn't run there — Electron
      keeps the desktop UI at `/`. (First attempt used `vercel.json`
      rewrites but static-export `index.html` was served before the
      rewrite could apply.) — completed 2026-05-26

- [ ] **Audio sync in Quill desktop reader.** Optional. Quill works
      without audio. If Marie wants audio while annotating on the
      desktop, port the audio dock from the alpha reader.

- [ ] **Search inside chapter in Quill desktop.** Optional. ProofingReader
      has search; port it over.

### Smaller cleanup (low priority, low risk)

- [ ] **Migrate `ProofingReader.js` to use `ReaderChrome.js`** — Prep
      already does. Pure refactor, no behaviour change.

- [ ] **Migrate Duet `PrebuildMode.js` to use `ReaderChrome.js`** —
      uses its own AppModeToggle placement; no shared chrome yet.

- [ ] **Migrate Proof's `BookSetup` to use `ImportFlow`** — Last
      duplicate of the upload flow. Layered with PDF paging + narrator
      colour mapping, so the goal is for BookSetup to render
      `ImportFlow` plus the Proof-only panels.

### ✅ URGENT — Full app unification — DONE 2026-05-25

**Outcome achieved.** Proof + Quill + Duet all now render `SessionsView`
for the book detail. Proof + Quill use `ChapterReader` / `renderChapterBody`
for the reader. `AudioDock` and `ImportFlow` are shared by all modes.
The build-checker hook hard-blocks fresh duplicate components.

**Architectural note:** the plan was to extract each panel (NarratorPanel,
AudiobookTimingPanel, BulkAudioPanel, TranscriptionQueueIndicator) as
its own file. **That isn't what shipped.** Instead, those panels live
INLINE inside SessionsView, and all three modes share the panels by
rendering SessionsView with a `mode` prop. Same user outcome (one UI
everywhere, fix once = fix everywhere) via different architecture.
Phase A items A3–A8 and Phase B1 are NOT extracted as files.

If a future session wants to extract them into separate components for
code-organisation reasons, that's tracked under "Smaller cleanup."

### Code-health audit pass (after reader unification, before phone work)

Same-source mandate applied to the WHOLE codebase, not just BookDetail
and Reader. Sweep:

- [ ] **Extract shared `ModeHome` (project library) component.** Each
      mode has its own home view (project cards + "+ New" button).
      Quill's is the simplest baseline. Same pattern as `BookDetail`:
      take title + accent + project list + onNew/onOpen handlers,
      with a slot for mode-specific tiles (Prep's "scanning" badge,
      Proof's audio-bookmark indicator). Migrate Proof, Duet, Quill,
      and Prep to it. Add to `SHARED_COMPONENTS.md`. Tighten the
      build-checker hook to block new inline `*HomeView` declarations
      that don't import `./ModeHome`.

- [ ] **Shared `<ConfirmDialog />`.** Every mode uses native
      `window.confirm()` which looks like a browser alert and breaks
      the visual language. Build a themed modal with the mode-tone
      accent. Replace every `window.confirm` call across all mode
      files. Add to `SHARED_COMPONENTS.md`. Hook: block new
      `window.confirm(` additions in mode files.

- [ ] **Cloud-sync helpers parity — Proof only.** `packages/cloud-sync/`
      has Quill wired (`quill-sync.js`). Build `proof-sync.js` (push/pull
      for `script_sync_projects`, `script_sync_section_transcriptions`,
      `script_sync_flags`) mirroring `quill-sync.js`'s shape. Audio
      paths flow through `audio-guard.js` before any upload (already
      enforced). **Prep and Duet stay desktop-only** — they don't go to
      phone so they don't need cloud sync. Only Proof + Quill ship to
      phone.

- [ ] **Export helpers consolidation.** Quill has CSV + InDesign export
      in `packages/quill-engine/exporters.js`. Prep has CSV + DOCX in
      `app/components/prepExport.js`. Both should live under a single
      `packages/exports/` with one consistent file pattern (one file
      per export format, shared `downloadBlob` / `safeFileName`
      helpers). Phone's CSV export later imports from the same place.

- [ ] **Inline-style sweep.** Walk every mode file (and shared
      components) and look for:
      - inline `position: 'sticky'` → use `<StickyTopBar />`
      - inline hex color codes → use `MODE_TOKENS[tone]`
      - inline button `style={{ padding, border, background ... }}` →
        use `topBtnStyle(tone, variant)` or `pillBtnStyle(tone)`
      - direct `getSupabaseClient()` calls → must go through
        `packages/cloud-sync/`
      - direct `fs.writeFile` / `window.electron.*` calls outside
        `packages/` — should be wrapped in a typed helper
      Each pattern gets a build-checker hook rule blocking new
      additions.

- [ ] **`.claude/hooks/` health check.** Verify every hook handles
      edge cases robustly: missing edit-log, missing git binary, large
      file lists, log rotation past `MAX_LINES`, permission errors
      writing logs, hook running outside project root. Verify
      `settings.json` registers each hook on the right events. Run a
      synthetic edit (touch a known mode file) and confirm
      `hook-activity.log` shows the expected sequence:
      `file-tracker` → `git-backup` → `build-checker` →
      `context-check` → `no-mess`. Add a `.claude/hooks/_test.sh`
      script that exercises each hook against a fake edit-log and
      reports pass/fail.

- [ ] **`packages/` audit.** Look for duplication BETWEEN packages.
      `packages/manuscript-engine` does DOCX import and dialogue
      detection; `packages/quill-engine` has its own DOCX-related
      helpers (annotation export to InDesign reads DOCX structure
      indirectly). Both should depend on a single canonical
      manuscript-engine if there's overlap. Document the package
      graph in `SHARED_COMPONENTS.md`.

### Same-source consolidation pass — mostly done 2026-05-25

- [x] **Refactor Duet's view==='project' to render shared
      `BookDetail`.** Done — Duet renders `SessionsView` with
      mode="duet" + engineerProgress slot. Inline 386-line custom
      JSX stripped.
- [x] **Refactor Proof's `SessionsView.js` to render shared
      `BookDetail`.** Done — Proof's banner killed, action buttons
      moved to the shared row, side-nav + chapter list inside
      SessionsView are the shared surface that Quill + Duet now
      share too.
- [x] **Unify the reader.** Done for Proof + Quill via
      `renderChapterBody` from `ChapterReader.js`. Prep stays
      separate (dialogue spans, different model). Duet's reader
      stays separate (block-display, different model) — by design.

- [ ] **Extract shared `ModeHome` (project library) component.** Each
      mode has its own home view (project cards + "+ New" button).
      Quill's is the simplest baseline. Same pattern as BookDetail.
      Still not done.

- [ ] **Replace `window.confirm()` with a shared `<ConfirmDialog />`.**
      Every mode uses native confirm. A shared themed dialog would
      look consistent. Still not done.

### Phase 10 — real-file end-to-end pass

- [ ] Marie runs every minimum-release check on her actual books +
      audiobooks. Every row in `WIRING_MATRIX.md` flips to `verified
      live`.
- [ ] Phone signed-in proof: real flag + real annotation saved from
      phone, seen on desktop.

### Phase 11 — release

- [ ] Mac packaged build.
- [ ] Windows packaged build.
- [ ] Phone deploy live on Vercel.
- [ ] First user release.

---

## Archived

### 2026-05-25 overnight session 2 — phone v1 functionality parity

Marie's ask after seeing the deployed phone: "It's 80% there. Pull
EVERYTHING from the original Studio app phone — double-tap to highlight,
drag handles, block highlight, settings (font/size/mode/bg/etc.),
Scroll vs Page Swipe, popover matches reader width. It's already
thoroughly debugged there — pull it in, don't re-invent it." Result:

- [x] **Universal reader settings** — cog icon top-right of every
      screen opens a full-page Settings panel. Eight fields, all
      from the v1 Studio phone reference: Font (5 options), Text
      size (16–28), Reader mode (**Scroll | Page Swipe**), Line
      spacing, Margins, Paragraphs, Alignment, Background (8 swatches).
      Persisted in localStorage as `stjohn-phone-reader-settings-v1`.
      Settings apply to BOTH Quill and Script readers, settings panel
      renders as an overlay (so closing returns to the exact previous
      view). New module: `app/phone/_lib/readerSettings.js` +
      `app/phone/_components/PhoneReaderSettings.js`. — completed
      2026-05-25 (overnight 2)
- [x] **HTML-preserving reader** — replaced the naive word-span
      renderer with the v1 Studio walker. Italics, paragraphs, h2/h3
      scene-break headings, paragraph indentation all preserved.
      New module: `app/phone/_components/renderReaderContent.js`. —
      completed 2026-05-25 (overnight 2)
- [x] **Double-tap to highlight + drag handles + block highlight** —
      ported the v1 Studio phone selection model. Single tap is a
      soft tap; second tap within 420ms on the same word opens a
      selection. Two circular drag handles appear at each end; drag
      to extend. Each word segment includes its trailing whitespace,
      so consecutive selected words read as one continuous highlight
      block (not individual words). New module:
      `app/phone/_components/PhoneReader.js`. — completed 2026-05-25
      (overnight 2)
- [x] **Page Swipe reader mode** — when Reader mode is Page Swipe,
      the reader becomes a horizontal CSS-column scroll container
      with `scroll-snap-type: x mandatory`. Swipe left/right to
      flip pages. Scroll mode falls back to normal vertical scroll. —
      completed 2026-05-25 (overnight 2)
- [x] **Popover matches reader width** — annotation popover (Quill)
      and flag popover (Script) are now constrained to the reader's
      column width (centered, max 620px). No more full-viewport
      system-sheet look. — completed 2026-05-25 (overnight 2)
- [x] **Audio Sync mode** — when the desktop has transcribed a
      section (whisperAlignment with word-level timestamps), a Sync
      toggle in the phone audio dock lights up the current word as
      audio plays and auto-scrolls to keep it in view. — completed
      2026-05-25 (overnight 2)
- [x] **IndexedDB project cache + reader-location memory** — phone
      shows last-known project list instantly from cache while the
      cloud pull spins up. Last-opened chapter per project is
      remembered so reopening a project jumps straight back to where
      Marie left off. Cache is no-overwrite-with-empty (so a
      transient cloud failure can't "delete" everything). New
      module: `app/phone/_lib/projectCache.js`. — completed 2026-05-25
      (overnight 2)
- [x] **Redeployed to Vercel** — fresh build pushed. Live at
      **https://stjohn-author-studio-4.vercel.app/phone**. — completed
      2026-05-25 (overnight 2)

### 2026-05-25 overnight session — phone feature parity + desktop polish

- [x] **Visual polish — chapters page top panels.** Removed the outer
      white card that was wrapping the 3 inner pastel cards (the
      card-inside-card was wasting ~190px of vertical space). Tightened
      Audiobook timing to one row (label + Total + Left pills). Tightened
      Bulk audio to one row (label + Start-chapter select + Import button).
      Collapsed the "Manuscript / Chapters" 2-line header into a single
      tight line. Fixed the "· undefined" in the sticky-bar subtitle when
      a book has no fileName. Changed the side-nav incomplete indicator
      from a red × (read as "delete") to a quiet grey ○. The whole top
      band is now ~80px instead of ~270px — five chapters fit above the
      fold instead of three. — completed 2026-05-25 (overnight)


- [x] **Split toggle — no fake scene when chapter has no H2s.** Fixed
      in `app/components/SessionsView.js`. Battery-tested 11 edge cases
      (no h2, h2 only, multi-h2, h2 at start, h2 at end, multi-section,
      empty html, null html, missing section, attribute variants).
      All pass. — completed 2026-05-25 (overnight)
- [x] **PinnedTabPanel shared component + tab-stability hook rule.**
      Added `<PinnedTabPanel>` to `ReaderChrome.js`. Extended
      `.claude/hooks/build-checker.sh` with a soft warn (Rule 6) when
      a mode file adds new `*Tab` state + ternary content render
      without using it. — completed 2026-05-25 (overnight)
- [x] **Edit book data panel — chapter check/uncheck + mode extras.**
      Edit panel in SessionsView now has chapter checkboxes (uncheck
      to remove copyright pages etc.), mode-specific labels (Proof:
      "narrator mapping", Quill: "characters", Duet: book + chapters
      only), and a confirm prompt before destructive removals. —
      completed 2026-05-25 (overnight)
- [x] **Cloud sync for Proof Listen.** (see Active section) —
      completed 2026-05-25 (overnight)
- [x] **Phone Script mode (Proof on phone).** (see Active section) —
      completed 2026-05-25 (overnight)
- [x] **Phone CSV export.** (see Active section) — completed 2026-05-25
      (overnight)
- [x] **Phone audio playback (shared by Quill + Script).** (see Active
      section) — completed 2026-05-25 (overnight)
- [x] **Deep-dive batteries.** Sandbox + pure-function batteries for
      A1 Split toggle (11/11), A3 chapter filter (6/6), A4 audio guard
      (9/9), A4 sync helpers (6/6), A6 buildFlagsCsv (10/10). Live UI
      smoke for phone Script flow (loads, navigates, empty state).
      All passed. — completed 2026-05-25 (overnight)
- [x] **Bug-fix sweep.** Renamed shadowing `flagCount` variable in
      phone page. Added `onError` handler to PhoneAudioDock for
      unsupported audio files. Added confirm guard to chapter-removal
      save flow. — completed 2026-05-25 (overnight)

### 2026-05-24 overnight session — login + Quill + cloud-sync + phone

- [x] **Studio landing page + Supabase login** — Sign in, create
      account, forgot password, show/hide eye icon. Pastel mauve
      aesthetic to match the home. Sign-out lives at the bottom of the
      home page. Auth gate sits in front of the whole app via a
      session check in `app/page.js`. Files: new
      `app/components/LoginScreen.js`, new
      `packages/cloud-sync/account.js`, new
      `packages/cloud-sync/client.js`, gated in `app/page.js`. —
      completed 2026-05-24 (overnight)

- [x] **Shared cloud-sync package** —
      `packages/cloud-sync/` is now the single place every mode talks
      to Supabase. `client.js`, `account.js`, `audio-guard.js`
      (strips audio paths before any upload — CLAUDE.md emphasizes
      this), `quill-sync.js` (push/pull/delete for the three Quill
      tables). Re-exported from `index.js`. — completed 2026-05-24
      (overnight)

- [x] **Quill & Ink desktop mode** — Full port from the alpha.
      4-mode toggle now has Quill enabled. Home → project list →
      ImportFlow → book detail → reader. Reader has word-by-word
      rendering, drag-to-highlight, annotation popover with Image /
      Highlight / Emotion + custom emotions + custom characters,
      inline note, save with delete option. Annotation sidebar with
      jump-to. Local persistence via Electron file system
      (`read-quill-data` / `write-quill-data` handlers in `main.js`
      + `preload.js`, written to `quill-projects.json`). CSV + full
      InDesign JSX exporter ported byte-for-byte. Cloud sync fires
      after every save when signed in. Files: new
      `app/components/QuillAndInkMode.js`, new
      `packages/quill-engine/` (normalize, annotations, exporters,
      index). — completed 2026-05-24 (overnight)

- [x] **Phone scaffold** — `app/phone/page.js`. Login (reused
      LoginScreen), service picker (Quill + Proof placeholder),
      project list pulled from cloud, chapter list, chapter reader
      with tap-to-annotate. Mobile-first layout (max-width 480, sticky
      header). Annotations save to Supabase via the shared cloud-sync
      helpers. — completed 2026-05-24 (overnight)

### 2026-05-24 day session — Prep polish + export pass

- [x] **Header refactor — single nav button on the top-left** —
      previously the Back button and HomePill were fighting for the
      same screen position and the back button hid under the Mac
      traffic lights. Now there's ONE `HomeBackPill` that morphs:
      ⌂ in book detail (goes home), ← in reader (goes back to book
      detail). It sits at top:40 with custom drag region, same level
      as the 4-mode toggle on home. The `StickyTopBar` aligns to that
      row so the eye sees one continuous nav. — completed 2026-05-24

- [x] **One dialogue warning rule** — engine used to emit 7 issue
      types. Now emits one: `missing-closing-quote`, only when no
      follow-up quote within ~3 paragraphs. Marie can't see the noise
      she didn't want. — completed 2026-05-24

- [x] **Section Fixer (per-paragraph editor)** — Fix button on each
      amber warning opens just that paragraph in a textarea with an
      "Insert " here" button at the cursor. Save reruns dialogue
      detection. Edits also recorded so the export replays them. —
      completed 2026-05-24

- [x] **Header confusion fix** — reader top bar title was "Chapter 1
      of 61 · Chapter 2" because it concatenated nav position with
      source heading. Now title is just nav position; source heading
      moves to subtitle and only when it differs. Same fix applied to
      the chapter dropdown and book-detail chapter list. — completed
      2026-05-24

- [x] **Edit chapters cog** — gear button next to Chapters header.
      Toggles edit mode where each chapter row gets a trash X to
      remove it. Chapter numbers re-flow automatically. Marie can fix
      "I accidentally left a chapter in" without re-importing. —
      completed 2026-05-24

- [x] **Auto-assign on character add (in reader)** — when a dialogue
      is selected and Marie adds a new character via the chip, the
      new character is immediately assigned to that dialogue.
      `addCharacter` mints the id synchronously so the caller can
      chain. — completed 2026-05-24

- [x] **Side-voice dialogues carry inline Word comments** — for every
      dialogue assigned to a side voice, the exported .docx has a
      real Word comment with each piece of info on its own line:
      Character, Narrator, Side voice of <character>, Notes,
      [Recurring]/[One time]. Main-character lines stay clean.
      `word/comments.xml` with proper namespaces, content-types +
      rels patched, `<w:commentRangeStart>`/`<w:commentRangeEnd>`/
      `<w:commentReference>` wrapped around each dialogue run. Word
      no longer flags the file as "unreadable". — completed 2026-05-24

- [x] **Pastel palette + Prep is yellow** — `MODE_TOKENS` now has
      `pastel` (very light) + `accent` (mid-tone) + `ink` (dark) per
      mode. Solid buttons use `accent` so the UI reads as pastel-y
      instead of wine. Prep switched from green to yellow. 10-colour
      `CHARACTER_PALETTE` in Marie's preferred order. — completed
      2026-05-24

- [x] **Show sub-headings toggle in ImportFlow** — `allowSceneSplitting`
      prop. When on, Duet sees split groups; Prep keeps it off by
      default. — completed 2026-05-24

- [x] **Duplicate narrator breakdown fix** — `stripPreviousNarratorBreakdown`
      removes any previously-injected breakdown before adding the new
      one. Re-importing an exported file no longer piles up six
      copies. — completed 2026-05-24

- [x] **Fix-quote replays into the exported .docx** — paragraph edits
      from the Section Fixer are recorded on `section.manualEdits`
      and replayed onto the source XML at export time. The missing
      close-quote Marie typed in actually shows up in the downloaded
      file. — completed 2026-05-24

- [x] **`applyHighlightsInPlace` regex constrained** — the `rPr`
      capture used to backtrack across `<w:r>` boundaries when a
      dialogue text only appeared in a later paragraph, which made
      the export inject the narrator breakdown six times. Now the
      capture refuses to cross run boundaries. — completed 2026-05-24

- [x] **Next button bug — actual root cause found** — italic-mid-quote
      dialogues like `"<em>Really</em>?"` made the engine's stripHtml
      produce "Really ?" (with a space) while the reader's stripTags
      produced "Really?" (no space). indexOf returned -1, the span
      didn't render, the cursor got stuck on it, and every dialogue
      AFTER also failed to render. Fixed by importing the engine's
      `stripHtml` into the reader's `paragraphsFromHtml`. — completed
      2026-05-24

### 2026-05-23 session — Prep refactor + shared upload

- [x] **Shared `ImportFlow` for Prep + Duet** — built
      `app/components/ImportFlow.js`. Prep's old inline `SetupView`
      and Duet's `PrebuildManuscriptUpload` both deleted; both now
      render `<ImportFlow ... />`. — completed 2026-05-23

- [x] **Narrator breakdown styling** — switched from `<w:pStyle>`
      references to inline run-property styling so it renders the
      same in any source .docx. — completed 2026-05-23

### Phase 1–4 (bootstrap + base)

- [x] Create `~/Dev/StJohn-Author-Studio-4.0/` and copy Script and
      Sync 3.0 in as the base — completed 2026-05-23
- [x] Set up `.claude/` with scope-locked hooks per bible Step 2.5 —
      completed 2026-05-23
- [x] Write `CLAUDE.md` — completed 2026-05-23
- [x] `git init`, first commit, push to GitHub
      (`stjohnbuilds/stjohn-author-studio-4.0`) — completed 2026-05-23
- [x] Archive old GitHub repos + Google Drive folders — completed
      2026-05-23
- [x] Rebrand npm package, app id, productName, window title, Save
      Data folder — completed 2026-05-23
- [x] Home-screen 4-mode segmented switcher (`AppModeToggle` in
      `app/page.js`) — completed 2026-05-23
