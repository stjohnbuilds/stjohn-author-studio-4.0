# Build Plan v4 — StJohn Author Studio

Status: ACTIVE. Phase 1 in progress.
Author: Marie + Claude (Opus 4.7).
Replaces every previous plan (2.0 docs are archived).

## Why a fourth attempt

- **1.0:** original separate apps (Script and Sync, Quill, Phone). Each
  works in isolation, no shared brain.
- **2.0:** Codex tried to merge everything into one app from scratch. UI
  looked unified, but the renderer drifted into a 4,577-line file with
  fake sample data; ~52 of 78 buttons did nothing on real files.
  ARCHIVED 2026-05-23.
- **3.0 (proofer only):** Script and Sync 3.0 — actually works. This is
  our anchor.
- **4.0 (this plan):** start FROM 3.0, add the other modes on top
  inside the same Next.js + Electron shell, with one shared reader.

## Non-negotiable rules

1. One shared reader for desktop + phone, all four modes.
2. One shared audio engine. One shared manuscript engine. One shared
   cloud-sync.
3. Audio never goes to Supabase.
4. No fake sample data anywhere.
5. A feature is "done" only after Marie clicks it on a real file.
6. Plan first. Review. Then go.
7. Hooks fire and log to `.claude/hook-activity.log`.

## Phases

### Phase 1 — Bootstrap

- Folder created at `~/Dev/StJohn-Author-Studio-4.0/`.
- Script and Sync 3.0 copied in as the base (no node_modules / dist /
  .next / Save Data).
- `.claude/` with bible Step 2.5 scope-locked hooks.
- CLAUDE.md, TODO.md, this plan.
- Truth tree skeletons populated from 3.0.
- **End:** check-in with Marie.

### Phase 2 — Git + GitHub

- `git init`, initial commit "4.0 bootstrap from Script and Sync 3.0".
- `gh repo create stjohn-author-studio-4.0 --private --source=. --push`.
- Confirm the next hook cycle writes a fresh entry to
  `.claude/hook-activity.log`.

### Phase 3 — Archive the dead

(Marie has approved.)

- Rename in Google Drive with `-ARCHIVED-2026-05-23` suffix:
  - `StJohn Author Studio 2.0`
  - `Script and Sync` (the older one — NOT `Script and Sync 3.0`)
  - `Quill and Ink`
  - `Phone`
- Run `gh repo archive` on matching GitHub repos.
- **Leave `Script and Sync 3.0` alone** — still the reference.

### Phase 4 — Rebrand the base

- Rename npm package, app id, productName, window title.
- Replace home-screen mode switcher with the 4-mode segmented switcher
  (use the colored tabs from the 2.0 rebuild as the visual reference).
- First Mac packaged build to confirm rebrand works.

### Phase 5 — Mode 1: Proof Listen working on real file

- Walk every Proof Listen button on a real audiobook. Each verified
  click flips a row in `WIRING_MATRIX.md` to `verified live`.

### Phase 6 — Mode 2: Prep Manuscript

- Use existing `packages/manuscript-engine/` from 2.0 (real engine).
- Dialogue-assignment UI lives on top of the shared reader.
- Export highlighted DOCX + narrator chapter list.

### Phase 7 — Mode 3: Duet Prep

- Port marker logic from the `Timestamp Finder Duet Edition 2.0`
  reference.
- Reuse shared reader + audio engine.

### Phase 8 — Mode 4: Quill & Ink

- Port annotation list UI (`+` and edit icons) from the alpha Quill
  reference (`StJohn Author Apps/apps/quill-and-ink`).
- Reuse shared reader.
- Wire InDesign export.

### Phase 9 — Phone companion

- Port Next.js scaffold from `StJohn Author Apps/apps/phone`.
- Phone scope (deliberately small):
  - Email/password login (Supabase auth).
  - Project list (text only — no images).
  - Open a chapter, see manuscript + transcript text.
  - Pick an audio file from the phone (audio stays local; the engine
    matches the file by name).
  - Listen / read.
  - Tap to add a flag (Script) or annotation (Quill).
  - Save: only flag/annotation text + timestamp + position go to cloud.
  - CSV export button (download to phone).
- **Phone does NOT:** transcribe, edit text, upload audio.

### Phase 10 — Real-file end-to-end pass

- Marie runs every minimum-release check on her own books + audio.
- Every row in `WIRING_MATRIX.md` flips to `verified live`.
- Phone signed-in proof: a real flag from the phone shows up on the
  desktop, and a real Quill annotation from the phone shows up on the
  desktop.

### Phase 11 — Release

- Mac + Windows packaged builds.
- Phone Vercel deploy.
- First user release.

## Shared-reader rule (the most important architectural decision)

Today, Script and Sync 3.0 has `app/components/ProofingReader.js` (2600+
lines) and the 2.0 rebuild has its own reader logic in `preview.js`. The
alpha Quill has another reader. Three readers, three sets of bugs.

**4.0 has ONE reader.** Lives under `packages/reader-engine/` (logic) +
`app/components/Reader/` (presentation). Every mode + phone imports it.
Mode-specific behavior (what happens on tap, what's highlighted, which
panel opens) is passed in as props, not baked in. When Marie says "fix
how the highlight works", the fix lands once and shows up in all four
modes plus the phone.

## Definition of done (per phase)

A phase is "done" only when:

1. The phase's TODO rows are checked off.
2. CLAUDE.md is up to date.
3. Hook log has fresh entries from real edits (not just from this doc).
4. Marie has clicked the new feature on a real file (Phase 5+).
5. Git is clean (no uncommitted changes); pushed to GitHub.

## What we are NOT building

- We are not re-implementing things that already work in Script and
  Sync 3.0. We copy them once and extend.
- We are not building a per-mode renderer. One shared shell, four mode
  routes.
- We are not adding cloud sync for Prep or Duet in v4.0 (desktop-only).
- We are not building any editing UI (none of the four modes edits the
  manuscript — they all just tag it).
