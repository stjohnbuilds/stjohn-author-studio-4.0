# Project: StJohn Author Studio 4.0

## What this app is

One desktop app + one phone companion for Marie's self-published audiobook
and print workflow. **Four desktop modes**, **two phone modes**, **one
shared reader brain**, **one shared cloud**.

This is the **fourth** attempt. Built fresh from the working **Script and
Sync 3.0** proofer as the base. Previous attempt (2.0) was archived
because the renderer drifted into a giant single file with fake sample
data and ~52 of 78 buttons did nothing on real files. We're not doing
that again.

## The four desktop modes

- **Proof Listen** — listen to audiobook audio against the manuscript,
  flag mistakes for the engineer. (This is what Script and Sync 3.0
  already does — our anchor mode.)
- **Prep Manuscript** — assign dialogue to characters/narrators before
  recording, export a highlighted Word doc + narrator chapter list.
- **Duet Prep** — find duet/engineer markers in audio.
- **Quill & Ink** — add annotations to a manuscript for special-edition
  print design (InDesign export).

## The two phone modes

- **Script mode** — phone companion to Proof Listen. Tap to add flags
  while listening.
- **Quill mode** — phone companion to Quill & Ink. Tap to add
  annotations while reading.

Phone scope (deliberately small):

- Log in with email/password (Supabase auth)
- See project list (text only)
- Open a chapter, see manuscript + transcript text
- Pick an audio file from the phone (audio stays local on phone, NEVER
  uploaded to the cloud — the engine matches the file by name)
- Listen / read; tap to add a flag (Script) or annotation (Quill)
- Save: only the flag/annotation text + timestamp + position go to cloud
- Export: a button to dump flags/annotations to CSV (download to phone)
- **No** transcribing on phone, **no** manuscript editing anywhere

## Non-negotiable architecture rules

1. **One shared reader.** Every mode that does word-level interaction
   (Proof, Quill — and the phone) renders the manuscript through
   `app/components/ChapterReader.js`. Modes pass `unitDecoration(idx)`
   for per-word styling and pointer callbacks for interaction.
   **Never copy the reader.** Fix once = fixed everywhere. The
   build-checker hook hard-blocks any new inline `function .*Reader`
   in a mode file that doesn't import `./ChapterReader`. Prep
   (dialogue spans) and Duet (read-only block-highlight) keep their
   own readers because their interaction models are structurally
   different — documented in `docs/SHARED_COMPONENTS.md`.
2. **One shared cloud-sync.** Every Supabase call goes through one
   package. Per-table CRUD helpers, not per-mode duplicates.
3. **One shared audio engine.** Whisper, file matching, alignment,
   playback control — all in one place.
4. **One shared manuscript engine.** DOCX import, narrator extraction,
   chapter detection, dialogue detection — all in one place.
5. **Audio NEVER touches Supabase.** Audio files stay on whichever
   device played them. Cloud-sync has guards that strip audio paths
   before any upload.
6. **No fake data.** Empty state = "Import a manuscript". No
   `sampleProjects` shim. Ever.
7. **A feature is "done" only after Marie clicks it on a real file** and
   it works. Tests passing is not enough.

## Stack

Same as Script and Sync 3.0 (proven, working):

- **Framework:** Next.js 14 (app router)
- **Desktop shell:** Electron
- **Cloud + auth:** Supabase
- **UI:** Tailwind CSS
- **Transcription:** whisper.cpp via spawned process, `bin/ggml-base.en.bin`
- **DOCX:** mammoth.js
- **PDF:** pdfjs-dist
- **Zip (DOCX/CSV export bundles):** jszip
- **Local persistence:** filesystem under `Save Data/` (set by user)

## Where things live (target layout)

This is the layout we're moving toward. **At this commit the repo is a
straight copy of Script and Sync 3.0**; the other modes will be added
phase by phase.

```
app/                          Next.js app router
  page.js                     Home / mode switcher / book list (4 modes)
  proof-listen/               Proof Listen mode pages
  prep-manuscript/            Prep Manuscript mode pages
  duet-prep/                  Duet Prep mode pages
  quill/                      Quill & Ink mode pages
  phone/                      Phone companion routes (script + quill)
  components/
    Reader/                   THE shared reader. One file, four modes.
    SessionsView.js           Book detail (chapters, audio, queue)
    ManuscriptSetup.js        Import + narrator mapping
    ProofingReader.js         (to be merged into shared Reader)
  api/                        Server routes (Supabase, signed URLs)

packages/                     Shared engines (no mode-specific code)
  audio-engine/               file matching, playback, whisper, timing
  manuscript-engine/          docx import, narrator extract, dialogue
  reader-engine/              shared word rendering / selection / scroll
  cloud-sync/                 Supabase client + per-table CRUD
  exports/                    CSV / DOCX / InDesign / backup writers

lib/                          Node-side helpers (electron main, etc.)
main.js                       Electron main process
preload.js                    Electron preload bridge

supabase/                     Migrations + schema notes
scripts/                      Build / release / sandbox helpers
docs/                         Build plan + truth trees + specs
dev/active/<task>/            Bible Step 5 three-file folders
.claude/                      Hooks + settings (per Marie's bible)
Save Data/                    Local user data (gitignored)
```

## Data structure — Supabase tables

Reusing the six tables from the 2.0 Supabase project
`evcusovtjfypfyfvnooy` ("Typing and Tomes 2.0 DATA"). All have RLS.

- `script_sync_projects`
- `script_sync_section_transcriptions`
- `script_sync_flags`
- `quill_projects`
- `quill_chapters`
- `quill_annotations`

Prep and Duet have **no** Supabase tables yet — desktop-only for v4.0.

## Rules — Claude must follow these always

### Project rules (from Marie)

- **Reference apps are read-only.** Claude MAY `ls`, `find`, `grep`,
  and `Read` files inside the reference folders listed below. Claude
  MUST NOT edit, write, move, or delete anything inside them.
- Known reference folders:
  - `~/Library/CloudStorage/.../Script and Sync 3.0` — primary base /
    source of truth for Proof Listen UI + flow.
  - `~/Library/CloudStorage/.../StJohn Author Apps/apps/script-and-sync`
    — older proofer. Cross-reference only.
  - `~/Library/CloudStorage/.../StJohn Author Apps/apps/quill-and-ink`
    — alpha Quill reference. Port the annotation list (+ and edit icons).
  - `~/Library/CloudStorage/.../StJohn Author Apps/apps/phone`
    — phone reference. Use as the Next.js phone-app blueprint.
- Never edit anything else outside this project root unless Marie
  explicitly asks.
- Never copy-paste old code blindly. Port behavior through the shared
  engines under `packages/`.
- **Never duplicate the reader.** Fix once, fixed everywhere.
- Audio files (`.mp3`, `.m4a`, `.m4b`, `.wav`, `.flac`, `.opus`) must
  not be uploaded to Supabase.
- Speak in plain English. Marie is non-technical. Short bullet points.

### Bible's golden rules

- Plan before building. Review the plan. Then say go.
- One thing at a time.
- Update this `CLAUDE.md` when structure changes.
- Update `TODO.md` every session.

### Hook rules (bible Step 2.5)

- Every hook calls `bash .claude/hooks/_log.sh` so activity shows up in
  `.claude/hook-activity.log`.
- Every hook has a scope guard pinned to
  `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0`.
- Marie verifies with `cat .claude/hook-activity.log`.

### Deep-check trigger (Marie's battery-test protocol)

When Marie's prompt contains any of these phrases (case-insensitive):
**deep check / deep scrub / deep test, battery test / battery check,
verify everything, really test this, really thorough, thoroughly check,
thoroughly test, thorough check, thorough test, scrub it, trigger the
hook (check/test/hook), find the hook, do a proper test/check, test it
properly, give it the works, run the battery / run the deep / run the
thorough** — the `.claude/hooks/deep-check-trigger.sh` hook fires and
injects the 7-step protocol. The model MUST run all 7 steps before
declaring anything done:

1. Boot preview, confirm no console errors.
2. Build SANDBOX tests (off-screen DOM, never Marie's real data),
   grouped as "batteries," each with a structured pass/fail.
3. Drive the LIVE UI end-to-end with REAL events (click / mousemove /
   key) — not just module function calls. Pure tests miss
   React-state and browser-quirk bugs.
4. For any failure: reproduce in a clean sandbox, fix, re-run entire
   battery.
5. Sweep browser console for errors at the very end.
6. Clean up everything touched in Marie's real data.
7. Report a confidence percentage AND list of what's still uncertain.
   Do not self-certify.

The protocol exists because AIs keep declaring "fixed" when it isn't.
The battery method catches React/browser bugs unit tests miss.

### Handover trigger (Marie's bootstrap-doc protocol)

When Marie's prompt contains any of these phrases (case-insensitive):
**make handover / make a handover, write the handover, update the
handover, do a handover, give me a handover, trigger the handover
hook, find the handover hook, build a handover, generate a handover,
fresh handover, new handover, handoff note / handoff doc / handoff
file** — the `.claude/hooks/handover-trigger.sh` hook fires and
injects the 8-section template. The model MUST produce a complete
handover doc BEFORE doing anything else this turn. Write it to
`HANDOFF.md` at the project root (overwrite).

The 8 sections, in this exact order:

1. **WHO IS THE USER** — Marie. Non-coder. Plain English, short
   sentences, no jargon. Banned coder vocabulary. Talk like she's 10.
2. **HARD RULES** — bullet list of rules that have bitten before:
   no dual-write, no self-certifying, plain English, "Files I
   changed" footer mandatory, always give clickable links, bottom
   toolbar is sacred, double-confirm destructive actions, never
   suggest stopping/pausing, push is fine without asking.
3. **READ THESE FILES (IN ORDER)** — exact paths of bootstrap docs.
4. **BROAD VISION** — 2-3 sentences. THE DREAM.
5. **CURRENT STATE** — % done, latest pushed commit SHA, test count,
   typecheck status, CORRECT live URL (warn about stale).
6. **TOP 5 NEXT JOBS** — priority order with effort tag (Easy /
   Marie / Design call / Big multi-week).
7. **WHAT ONLY MARIE CAN DO** — migrations, hands-tests, design
   calls, push authorisation.
8. **WHERE THINGS LIVE** — file map + the commands she actually uses
   (paste-ready).

Plus a COPY-PASTE block at the very top that bootstraps a fresh chat.

The protocol exists because handovers between AI sessions keep losing
critical Marie-context (non-coder, banned vocab, the live URL keeps
going stale, etc.).

## Commands

```
# Next dev server (browser) — the fastest way to iterate
npm run dev

# Electron in dev (runs Next + Electron together)
npm start

# Package the Mac app (writes to dist/, then Script and Sync Releases/)
npm run release:mac

# Package the Windows app
npm run release:win

# Verify Whisper model is present (downloads if missing)
npm run whisper:model
```

## TODO.md rules (from bible)

- Every new task needs: what it is, why, and relevant files/context.
- When a task is done: move it to `## Archived` with date and time.
- Format: `- [x] Task name — completed 2026-05-23 14:32`
- Never leave a task description as 2–3 words. Add context.
- Check `TODO.md` at the start and end of every session.

## Start here (in order)

1. Read this file.
2. Read `docs/SHARED_COMPONENTS.md` — the cheat sheet of shared UI
   components every mode should import from. If you're tempted to
   write an inline `function SomeModeBookDetail`, you almost certainly
   shouldn't — `BookDetail` already exists. The post-edit
   build-checker hook will warn if it sees a new inline duplicate.
3. Read `docs/BUILD_PLAN_V4.md`.
4. Read `TODO.md`.
5. Read the relevant truth tree under `docs/` if your task touches one
   mode (`FRONT_FUNCTION_TREE.md`, `INTERNAL_FUNCTION_TREE.md`,
   `WIRING_MATRIX.md`).
