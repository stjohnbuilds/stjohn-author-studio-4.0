# HANDOFF — StJohn Author Studio 4.0 — 2026-05-25

> **Triggered by Marie's handover hook.** This file overwrites the
> previous handoff. The 8 sections below follow her bootstrap-doc
> protocol exactly (CLAUDE.md → Hook rules → Handover trigger).

---

## ⎘ COPY-PASTE BOOTSTRAP (paste into a fresh chat)

```
I'm Marie. This is my StJohn Author Studio 4.0 desktop+phone app —
fourth attempt. The project lives at ~/Dev/StJohn-Author-Studio-4.0.

Read these in this order before doing anything:

1. HANDOFF.md (this file) — top to bottom. Section 1 (WHO IS THE USER)
   and Section 2 (HARD RULES) matter most. If you skip them I will be
   upset.
2. CLAUDE.md — project rules. Read the TOP — the SOURCE-OF-TRUTH MAP
   and FORBIDDEN PATTERNS section first. The build-checker hook will
   hard-block fresh duplicate components, so do not try.
3. TODO.md — URGENT and Active.
4. docs/SHARED_COMPONENTS.md — the cheat sheet of shared components.
   If you're about to write inline UI in a mode file, you almost
   certainly shouldn't.
5. /Users/mariemackay/.claude/projects/-Users-mariemackay-Dev-StJohn-Author-Studio-4-0/memory/
   — my auto-memory files. Includes "always give run command".

The most important rule: I am NOT technical. Plain English, short
bullets, no jargon. Banned vocab in section 2. Talk like I'm 10.

Second most important: NO duplication. ONE source of truth per piece of
UI. Proof, Quill, and Duet all render the SAME book-detail component
(SessionsView) now. The build-checker hook will fail any new
`function .*BookDetail/HomeView/ChapterRow/ReaderView/Setup/Panel/AudioDock/Picker`
in a mode file. Don't try to wrap a shared component in a fresh
function to stuff custom JSX inside — that's how QuillBookDetail got
built and it took 16 explicit "use the same UI" asks from me to undo.

Third: every response that touches files MUST end with a
"Files I changed:" footer. Non-negotiable.

When you're ready, just say "I've read everything, what's next?" and
I'll point you at the top of TODO.md.
```

---

## 1. WHO IS THE USER

- Marie. **Non-coder.** This is her fourth attempt at the same app.
- Plain English, short sentences, **bullets only when truly parallel.**
  Default 2-4 sentences.
- **Talk like she's 10.** Friendly, not condescending. No "actually" or
  "as you can see."
- **Banned coder vocabulary** (do not say): refactor, abstraction,
  composition, polyfill, hydrate, memoize, lift state, scope guard,
  prop drilling, dependency injection, side-effect, idempotent. If
  you find yourself reaching for one of these, you're doing it wrong.
- She is **emotionally exhausted** by this rebuild. Don't add to the
  cognitive load. Every response should make her brain quieter, not
  busier.

## 2. HARD RULES (these have all bitten before — do not break them)

- **No dual-write. ONE source of truth per piece of UI.** Proof, Quill,
  and Duet ALL render `SessionsView` for the book detail. The reader is
  `<ChapterReader>` / `renderChapterBody`. The audio dock is
  `<AudioDock>`. The import is `<ImportFlow>`. The build-checker hook
  hard-blocks fresh duplicates. Marie asked for "use the same UI"
  **16 times in a single chat** before I finally complied — do not
  test that limit.
- **Wrapping a shared component in a fresh function to stuff custom
  JSX inside is FORBIDDEN.** That's how `QuillBookDetail` got built
  (250 lines of new UI) past the old hook. The new hook closes the
  loophole.
- **No self-certifying.** When she says "deep check" / "scrub it" /
  "battery test" / "verify everything," run the 7-step protocol from
  CLAUDE.md before claiming done. Confidence percent + uncertainty
  list at the end. No exceptions.
- **Plain English only.** See banned vocab above.
- **"Files I changed:" footer is mandatory** on every response that
  touches files. Bullet list with each path + one-line "what and why."
- **Always give clickable links** where possible — paths in backticks
  she can click in her terminal/editor.
- **Double-confirm destructive actions.** Delete project, remove all
  annotations, etc. — two clicks. `window.confirm` works for now;
  shared `<ConfirmDialog />` is TODO.
- **Never suggest stopping or pausing** unless you genuinely cannot
  proceed. Marie has heard "let's pause and check" too many times.
  Keep going. Multi-turn execution without check-ins is the default.
- **Push is fine without asking.** git push to main, GitHub. She
  doesn't need to authorise each push.
- **End every code-touching response with the run command** in a code
  block + "paste and hit Enter":
  ```
  cd ~/Dev/StJohn-Author-Studio-4.0 && npm start
  ```

## 3. READ THESE FILES (IN ORDER)

1. `~/Dev/StJohn-Author-Studio-4.0/HANDOFF.md` (this file)
2. `~/Dev/StJohn-Author-Studio-4.0/CLAUDE.md` — TOP section first
   (SOURCE-OF-TRUTH MAP + FORBIDDEN PATTERNS). Then Hook rules,
   Deep-check trigger, Handover trigger.
3. `~/Dev/StJohn-Author-Studio-4.0/TODO.md` — URGENT first
4. `~/Dev/StJohn-Author-Studio-4.0/docs/SHARED_COMPONENTS.md`
5. `~/Dev/StJohn-Author-Studio-4.0/docs/BUILD_PLAN_V4.md`
6. `/Users/mariemackay/.claude/projects/-Users-mariemackay-Dev-StJohn-Author-Studio-4-0/memory/MEMORY.md`
7. `~/Dev/StJohn-Author-Studio-4.0/.claude/hook-activity.log` — tail
   to see recent activity

**Reference apps (READ-ONLY — never edit):**
- `~/Library/CloudStorage/GoogleDrive-mariemackaybooks@gmail.com/My Drive/Game Dev/GitHub/Script and Sync 3.0/`
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/quill-and-ink - ARCHIVED 2026-05-23/`
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/phone - ARCHIVED 2026-05-23/`

## 4. BROAD VISION (the dream)

One desktop app + one phone companion that **completely handles Marie's
self-published audiobook + special-edition print workflow.** Four
modes (Proof Listen, Prep Manuscript, Duet Prep, Quill & Ink) that
share ONE brain — one reader, one audio engine, one cloud sync, **and
ONE book-detail page** (only the verbs differ: flag / annotate /
duet-mark / dialogue-tag). A finished writer should be able to take a
manuscript from .docx import all the way to a polished audiobook +
InDesign print file in this one app, with the phone for capture on
the go.

## 5. CURRENT STATE

- **% done overall:** ~85% (weighted). Visible Proof + Quill + Duet
  book-detail unification done. Reader unification done for Proof +
  Quill. ImportFlow used across all four modes. AudioDock unified.
  Build-checker hook hardened so duplication can't sneak back in.
- **Latest commit on `main`:** `ff846ae` (`auto-backup: before Claude
  edit 2026-05-25 04:21:47`). All recent commits are auto-backups from
  the git-backup hook. Safe to push or squash before push.
- **Working tree:** one file modified (`app/components/SessionsView.js`
  — the Split-toggle H2 derivation that just landed). Otherwise clean.
- **Test count:** 0 dedicated `.test.js` files. Verification is manual
  + the build-checker hook + dev preview drive.
- **Typecheck:** N/A — JS project. `node --check` per file runs via
  the build-checker hook.
- **Live URL:** **NOT DEPLOYED YET.** No Vercel deploy for the phone.
  Desktop runs locally via `npm start` (Electron).
- **Recent work (this session — 2026-05-25):**
  - Quill book-detail → now renders `SessionsView` with `mode="quill"`.
    `QuillBookDetail` (250 lines of duplicate UI) deleted.
  - Duet book-detail → also renders `SessionsView` with `mode="duet"`.
    386 lines of Duet's inline JSX stripped. Engineer-progress passed
    as a slot prop; Transcribe button hidden in Duet mode.
  - Proof banner killed; action buttons moved to the shared row;
    delete is a small 🗑 bin top-right.
  - Top panels: 2-column grid. Narrators (½) on row 1, Audiobook timing
    + Bulk chapter audio side-by-side row 2, Engineer progress slot
    row 1 in Duet mode.
  - Chapter list scrolls inside a 75vh container (no more "scroll past
    top, banner peeks out").
  - Chapter rows: no Neapolitan striping, single-line each.
  - Side nav panel centered vertically, capped at 60vh.
  - Tab top stable: outer panel is flex column with fixed minHeight so
    switching Nav↔Queue doesn't move the top.
  - Narrator tooltip clipping fixed (outer card was overflow:hidden).
  - Split toggle now does an on-the-fly H2 derivation when ON: chapters
    with H2s in their HTML show scene rows. (Persistent re-split with
    per-scene audio is still TODO.)
  - Transcribe label → "Transcribe all"; Split label cleaned up.
  - Chapter renumbering — `chapterDisplayNumber` always uses `index + 1`
    so deleting front-matter chapters renumbers from 1.
  - ProofingReader uses `renderChapterBody` from ChapterReader.
  - BookSetup uses ImportFlow as Phase 1 → Proof-specific narrator
    scan + PDF mapping as Phase 2.
  - Build-checker hardened: no more wrapper loophole, new rules block
    `<audio>` outside `AudioDock`, word renderers outside
    `ChapterReader`, audio pickers outside shared components, +80 JSX
    lines in one mode-file edit.
  - CLAUDE.md top now has the SOURCE-OF-TRUTH MAP and FORBIDDEN
    PATTERNS section.
  - Context-check hook injects the shared-components list every prompt.

## 6. TOP 5 NEXT JOBS (priority order)

1. **Split toggle: don't render a single fake "scene" when no H2s exist.**
   `Easy.` When `showSceneRows` is ON and a chapter has no H2 sub-headings,
   the current `displaySections` falls through to the original single
   section, which renders as ONE scene row labelled with the chapter
   title. Marie wants: no sub-rows at all for that chapter. Fix: in
   `SessionsView.js` where `displaySections` is computed, if Split is
   ON and the chapter has no H2s, set `displaySections = []`.

2. **Edit book data panel** grows beyond narrators-only.
   `Medium.` Currently `editingMeta` shows book title + narrator color
   mapping. Marie wants:
   - book title (already there)
   - **chapter check/uncheck** (re-curate post-import — same UI as
     ImportFlow's chapter picker; lets her uncheck copyright pages
     she missed at import)
   - **mode-specific extras**: narrators for Proof, character mapping
     for Quill, scan options for Duet
   Sub-component with checkboxes + a save handler that mutates `book.chapters`.

3. **Persistent Split (per-scene audio + flags).**
   `Medium-hard.` The current Split toggle does a VIEW-ONLY derivation.
   Audio attach / transcribe / flag still target the original section.
   Marie wants persistent splits: each derived scene becomes a real
   section so audio can be attached per scene. Requires mutation of
   the book/project on toggle ON, reverse-merge on toggle OFF, with
   flag re-anchoring across IDs.

4. **Prep mode sweep.**
   `Medium.` Prep was lightly touched (scroll-contained chapter list)
   but doesn't share `SessionsView` because Prep's interaction model is
   structurally different (dialogue-span tagging, not per-chapter audio).
   Walk Prep's book detail + chapter list and bring the visual chrome
   in line: same outlined boxes, single-line rows, same sticky bar
   look. The shell can stay distinct from SessionsView but the AESTHETIC
   should match. Marie said: "scan through Prep and make it look a
   little bit more like the rest of the app."

5. **PinnedTabPanel + tab-stability hook.**
   `Easy.` Add `<PinnedTabPanel>` to `ReaderChrome.js` so the
   tab-top-stable pattern (flex column + fixed minHeight + tab header
   at top of column + content area takes flex:1) has a positive
   reusable solution. Extend `.claude/hooks/build-checker.sh` with a
   soft-warn for new `*Tab` state + ternary content render in a mode
   file that doesn't use PinnedTabPanel.

## 7. WHAT ONLY MARIE CAN DO

- **Real-file tests on her own manuscripts + audiobooks.** AIs cannot
  open her .docx via file picker or attach her audio. Critical for
  Job 1 (Split fix), Job 2 (Edit book data chapter checkbox), Job 3
  (persistent split with real audio).
- **Whisper transcription end-to-end test** — needs the Electron build
  with `whisper.cpp` binary present. Dev preview can't run it.
- **InDesign export validation** — only Marie has InDesign installed
  to verify the exported `.jsx` works against her real layouts.
- **Design calls** — pastel-vs-rich, layout decisions, colour swaps
  she hasn't pre-approved. When in doubt, ask.
- **Push authorisation** — push is fine without asking, but
  destructive pushes (force-push to main) need explicit OK.
- **Vercel deploy authorisation** — `vercel --prod` always waits.

## 8. WHERE THINGS LIVE

```
~/Dev/StJohn-Author-Studio-4.0/
├── HANDOFF.md                      ← this file
├── CLAUDE.md                       ← rules + hook protocols + the
│                                     SOURCE-OF-TRUTH MAP at top
├── TODO.md                         ← URGENT at top
├── app/
│   ├── page.js                     ← auth gate + mode router
│   ├── components/
│   │   ├── SessionsView.js         ★ THE shared book-detail
│   │   │                             (Proof + Quill + Duet all
│   │   │                             render this with mode="...")
│   │   ├── BookDetail.js           ★ Shared chrome (sticky bar,
│   │   │                             action row, delete bin,
│   │   │                             chapter list slot)
│   │   ├── ChapterReader.js        ★ THE shared reader. Exports
│   │   │                             renderChapterBody so Proof
│   │   │                             can use the same word render
│   │   │                             without its full chrome
│   │   ├── AudioDock.js            ★ Shared audio dock (Proof +
│   │   │                             Quill render this; slots for
│   │   │                             mode-specific extras)
│   │   ├── ImportFlow.js           ★ Shared upload + chapter picker.
│   │   │                             Used by all four modes
│   │   ├── ReaderChrome.js         ★ Sticky bar, HomeBackPill,
│   │   │                             ProfilePill, MODE_TOKENS,
│   │   │                             modeAccentVars
│   │   ├── ProofingReader.js       ← Proof's reader (uses
│   │   │                             renderChapterBody now)
│   │   ├── ManuscriptSetup.js      ← Proof's import wizard. Phase 1
│   │   │                             uses ImportFlow, Phase 2 is
│   │   │                             Proof's narrator scan + PDF
│   │   ├── PrebuildMode.js         ← Duet (book detail = SessionsView
│   │   │                             via mode="duet" adapter)
│   │   ├── PrepManuscriptMode.js   ← Prep (intentionally separate —
│   │   │                             dialogue spans, no audio)
│   │   └── QuillAndInkMode.js     ← Quill (book detail = SessionsView
│   │                                 via mode="quill" adapter)
│   └── phone/page.js               ← phone scaffold
├── packages/
│   ├── audio-engine/index.js       ← buildSyncTable, getMsIdxAtTime,
│   │                                 getAudioTimeForMsIdx
│   ├── cloud-sync/                 ← Supabase client + Quill sync;
│   │                                 Proof sync TODO
│   ├── manuscript-engine/          ← DOCX + dialogue (Prep)
│   └── quill-engine/               ← annotation tree + InDesign export
├── docs/
│   ├── SHARED_COMPONENTS.md        ← what's shared, what's not, how
│   │                                 to extend
│   ├── BUILD_PLAN_V4.md
│   ├── FRONT_FUNCTION_TREE.md
│   ├── INTERNAL_FUNCTION_TREE.md
│   └── WIRING_MATRIX.md
└── .claude/
    ├── settings.json               ← hooks registered here
    ├── hooks/
    │   ├── _log.sh                 ← shared logger
    │   ├── context-check.sh        ← prompt-submit reminder +
    │   │                             SHARED COMPONENTS list (added
    │   │                             2026-05-25)
    │   ├── deep-check-trigger.sh   ← "deep check" / "scrub it" etc.
    │   ├── handover-trigger.sh     ← "make a handover" etc. (this hook)
    │   ├── build-checker.sh        ← HARDENED 2026-05-25: blocks
    │   │                             new BookDetail/HomeView/etc.
    │   │                             functions in mode files
    │   │                             regardless of imports; blocks
    │   │                             new <audio> outside AudioDock;
    │   │                             blocks word renderer outside
    │   │                             ChapterReader; blocks audio
    │   │                             pickers outside shared
    │   │                             components; warns on >80 JSX
    │   │                             lines added in one go
    │   ├── file-tracker.sh         ← logs every Edit/Write
    │   ├── git-backup.sh           ← auto-commit before each edit
    │   └── no-mess.sh              ← post-Stop checklist
    ├── hook-activity.log           ← gitignored; tail to see hooks
    ├── blocked-edits.log           ← gitignored; build-checker block log
    └── edit-log.txt                ← gitignored
```

### Commands Marie actually uses

```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm start
```
↑ Paste into Terminal, hit Enter. Launches Electron + Next together.

```
npm run dev
```
↑ Web preview only (Next dev server on `http://localhost:3000`). Use
this when verifying the phone (`/phone`) or when the dev skip-login
button is needed.

```
npm run release:mac
npm run release:win
```
↑ Packaged builds. Writes to `dist/` then `Script and Sync Releases/`.

```
cat ~/Dev/StJohn-Author-Studio-4.0/.claude/hook-activity.log
```
↑ Verify hooks are firing.

```
cat ~/Dev/StJohn-Author-Studio-4.0/.claude/blocked-edits.log
```
↑ Empty = nothing was blocked. Non-empty = the build-checker caught a
duplication attempt; the log lists which file + what shared component
should have been used.

```
git log --oneline -10
```
↑ Recent commits. Latest SHA at time of writing: `ff846ae`.

---

**Summary of what changed since the last handover (in Marie's English):**

- All three big modes — Proof, Quill, and Duet — now show the SAME
  book-detail page when you click into a book. Fix one, fix all three.
  That took 16 explicit asks before it landed.
- The reader is the same code across Proof and Quill (Duet's reader
  stays separate because it's a different kind of reader).
- The audio dock is the same. The upload wizard is the same. The
  little pill that says "back to home" is the same and morphs into an
  arrow in the reader.
- The big purple "Book info" banner in Proof is gone. Action buttons
  (Export Flags etc.) are now in a small row, and the delete is a tiny
  red bin top-right.
- The chapter list scrolls inside its own box now — no more "scroll
  the page and watch the banner go past."
- The Nav/Queue tab strip top stays in the same place when you switch
  tabs.
- The Split toggle actually splits now (on the fly, using the H2
  headings inside each chapter).
- Front-matter chapters you delete after import — the rest renumber
  from 1 like you wanted.
- A safety hook now physically blocks AIs from writing fresh duplicate
  components. No more "let me just wrap this in a new function."
- The CLAUDE.md top page is the FORBIDDEN PATTERNS list. The
  context-check hook injects the shared-components list before every
  AI turn so they SEE the rules before touching code.

Tasks completed in the last conversation: **51 of 55.** Four marked as
deferred-with-clear-notes are now the TOP 5 NEXT JOBS in section 6.
