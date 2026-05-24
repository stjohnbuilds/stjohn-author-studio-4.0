# TODO — StJohn Author Studio 4.0

Active and archived tasks. Cleaned up 2026-05-24. New work goes under
**Active**. Completed work moves to **Archived** with a date.

Format: `- [x] Task name — completed YYYY-MM-DD`. Never leave a task
as 2–3 words. Add context.

Always read `HANDOFF.md` first, then this file.

---

## Active

### Next up (in priority order)

- [ ] **Studio landing page + Supabase login** — first screen on
      launch is a login (email + password, show/hide password eye
      icon, "forgot password" link), then the 4-mode picker. NOT
      dropping straight into Proof like it does now. Match Marie's
      pastel aesthetic — no dark/wine colors. A similar login UI
      existed in a previous attempt (look in `Manuscript Prepper 1.0`
      or the archived apps before designing from scratch). Marie's
      Supabase project is `evcusovtjfypfyfvnooy`. URL + anon key:
      ask Marie or find in any archived `.env` / `supabase.js`. Do
      NOT commit credentials.

- [ ] **Quill & Ink mode** — port from the alpha at
      `~/Library/CloudStorage/.../StJohn Author Apps/apps/quill-and-ink - ARCHIVED 2026-05-23/`.
      Use the shared `ReaderChrome` + `ImportFlow` so it looks like
      Prep. Annotation list with `+` and ✏️ icons (Marie liked these
      from the alpha). Drag across text to highlight a range,
      double-click a word to jump. Tables already exist:
      `quill_projects`, `quill_chapters`, `quill_annotations` — all
      with RLS. Audio player from Proof gets reused. InDesign-friendly
      export (see the alpha's export code).

- [ ] **Supabase cloud-sync wiring** — single shared package every
      mode talks to. Per-table CRUD helpers, not per-mode duplicates.
      Audio NEVER goes to Supabase — the shared sync must have guards
      that strip audio paths before any upload. CLAUDE.md emphasizes
      this three times.

- [ ] **Phone companion** — port from
      `~/Library/CloudStorage/.../StJohn Author Apps/apps/phone - ARCHIVED 2026-05-23/`
      (also check `Manuscript Prepper 1.0/` for an even earlier
      attempt Marie thinks was solid). Login (Supabase), project list,
      open chapter, local audio picker (audio stays on phone),
      tap-to-flag (Script) or tap-to-annotate (Quill), CSV export. No
      transcribing on phone. No manuscript editing. Deploy to Vercel.

### Smaller cleanup (low priority, low risk)

- [ ] **Migrate `ProofingReader.js` to use `ReaderChrome.js`** — Prep
      already uses the shared `ChapterContextPill`, `StickyTopBar`,
      `SaveBadge`, `HomeBackPill`, button-style factories, and the
      `useDismissable` popover-close hook. ProofingReader still has
      its own copies of all of these. When that 2600-line component
      is refactored, swap them out so a single visual edit propagates
      to every mode. No behaviour change required.

- [ ] **Same for Duet `PrebuildMode.js`** — uses its own AppModeToggle
      placement; no shared chrome yet.

- [ ] **Migrate Proof's `BookSetup` to use `ImportFlow`** — Prep + Duet
      now share `app/components/ImportFlow.js` for the upload +
      chapter checkbox list. Proof's `ManuscriptSetup.js` still has
      its own copy because it layers PDF paging + narrator colour
      mapping on top. The goal is for BookSetup to use `ImportFlow`
      for the upload/chapter piece and add the Proof-only steps as
      panels around it. This is the LAST duplicate of the upload
      flow.

### Phase 10 — real-file end-to-end pass

- [ ] Marie runs every minimum-release check on her actual books +
      audiobooks. Every row in `WIRING_MATRIX.md` flips to
      `verified live`.
- [ ] Phone signed-in proof: real flag + real annotation saved from
      phone, seen on desktop.

### Phase 11 — release

- [ ] Mac packaged build.
- [ ] Windows packaged build.
- [ ] Phone deploy live on Vercel.
- [ ] First user release.

---

## Archived

### 2026-05-24 session — Prep polish + export pass

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
