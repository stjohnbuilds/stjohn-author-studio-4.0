# HANDOFF — 2026-05-26 (after Quill polish + final-round checklist landed)

## 📋 COPY-PASTE BLOCK — paste this verbatim into a fresh chat to bootstrap

```
You're continuing work on StJohn Author Studio 4.0 for Marie.

Before you do ANYTHING:
1. Read /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/CLAUDE.md (top to bottom).
2. Read /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/HANDOFF.md (this file).
3. Read /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/TODO.md.
4. Read /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/dev/active/FINAL-ROUND-checklist.md.
5. Read /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/SHARED_COMPONENTS.md.

Marie is a NON-CODER. Plain English, 2-4 sentences default. Banned words:
refactor, abstraction, composition, polyfill, hydrate, memoize, lift state,
scope guard, prop drilling, dependency injection, side-effect, idempotent.

Mandatory on every response that touches files:
- "Files I changed:" footer at the end.
- Run command in a code block: `cd ~/Dev/StJohn-Author-Studio-4.0 && npm start`
  followed by "paste and hit Enter".

The active list is dev/active/FINAL-ROUND-checklist.md. Part B is yours
(deep dive, no code changes until you flag something to Marie). Part A
is Marie's hands-on. When Marie flags a bug from Part A, fix that one
thing — don't go rogue.

Two Stop hooks now bounce instead of warn:
- build-checker.sh: syntax errors exit 1; risky-path edits run npm test
  (one retry) and exit 1 on second failure.
- stop-no-self-cert.sh: blocks self-certifying phrases ("95% confident",
  "self-certify", "trust me it works", "gate at X%", "grade myself").
  Mark deliberate stubs with "// intentional:" within 5 lines above.
```

---

## 1. WHO IS THE USER

**Marie.** Self-published author. Non-coder. Plain English only.
Talk to her like she's 10 — short sentences, no jargon, no "three
options with paragraphs". She's been burned by AI helpers building
things that don't actually work on her real files. Trust = earned by
showing what changed and running it on real data.

**Banned coder vocab:** refactor, abstraction, composition, polyfill,
hydrate, memoize, lift state, scope guard, prop drilling, dependency
injection, side-effect, idempotent. Say what changed in normal words.

---

## 2. HARD RULES (these have bitten before)

- **No dual-write.** ONE shared component per job — the list is in
  `CLAUDE.md` at the top. The build-checker hook hard-blocks any
  new inline `function .*BookDetail/HomeView/ChapterRow/ReaderView/
  Setup/Panel/AudioDock/Picker` in a mode file.
- **No self-certifying.** The `stop-no-self-cert.sh` Stop hook now
  hard-blocks responses that contain "95% confident", "self-certify",
  "trust me it works", "gate at X%", "grade myself". Mark exceptions
  with `// intentional:` in code. In replies: state what you checked,
  what passed, what failed, what's still uncertain.
- **Plain English only.** See Section 1.
- **"Files I changed:" footer is MANDATORY** on every response that
  edits files. The Stop-hook output gets swallowed by the UI — the
  footer is the only way Marie sees what was touched.
- **Always give the run command** at the end of any code-touching
  reply: `cd ~/Dev/StJohn-Author-Studio-4.0 && npm start` in a code
  block + "paste and hit Enter".
- **Clickable links wherever possible** (file paths, URLs).
- **Bottom toolbar is sacred** — that's the audio dock. Do not pile
  other stuff there.
- **Double-confirm destructive actions** (delete, overwrite, send).
- **Never suggest stopping or pausing** — keep going to the end.
- **Push is fine without asking.**
- **Audio NEVER touches Supabase.** `audio-guard.js` strips audio
  paths recursively before any upload.
- **No fake data.** Empty state says "Import a manuscript". No
  `sampleProjects` shim, ever.
- **Never guess about the app.** Read the file end-to-end or drive
  the UI before saying how it behaves. A single grep is not enough.

---

## 3. READ THESE FILES (IN ORDER)

1. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/CLAUDE.md`
2. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/HANDOFF.md` (this file)
3. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/TODO.md`
4. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/dev/active/FINAL-ROUND-checklist.md`
5. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/SHARED_COMPONENTS.md`
6. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/CLOUD_SCHEMA.md`

---

## 4. BROAD VISION

One desktop app + one phone companion for Marie's self-published
audiobook and special-edition print workflow. Four desktop modes
(Proof Listen / Prep Manuscript / Duet Prep / Quill & Ink) and two
phone modes (Script / Quill) share ONE reader brain, ONE cloud sync,
ONE audio engine. This is attempt #4 — the previous one died because
the renderer turned into a 2000-line file with fake data and half the
buttons did nothing on real files. We're not doing that again.

---

## 5. CURRENT STATE

- **% done:** functionally the build list is closed. Last 3% is
  Marie's real-file walkthrough finding nothing broken. Edge-case
  scan (Part B of the final-round checklist) sits alongside it.
- **Latest pushed commit (origin/main):** `ca1c00c` — "Add FINAL
  ROUND checklist as the primary active list". Local HEAD = remote.
- **Working tree:** clean.
- **Tests:** `npm test` runs `node --test 'tests/**/*.test.mjs'` —
  small suite (manuscript-engine.test.mjs). The build-checker Stop
  hook now runs this suite automatically when edits touch
  `packages/`, `lib/`, `tests/`, `supabase/`, `main.js`, or
  `preload.js`, with one retry on flake and exit 1 on second
  failure.
- **Typecheck:** no separate typecheck step — project is plain JS.
  The Stop hook does `node --check` on each edited file.
- **Live URLs:**
  - Phone is the root: `https://stjohn-author-studio-4.vercel.app/`
  - Direct: `https://stjohn-author-studio-4.vercel.app/phone`
  - The root rewrite happens at build time via
    `scripts/vercel-root-to-phone.js`, which runs only when
    `VERCEL=1`. Electron's release scripts call `next build`
    directly so the swap doesn't run there — Electron desktop
    still serves `/` as the desktop UI.
- **Stop hooks (bouncers, not signs on the wall):**
  - `build-checker.sh` — syntax error exit 1; risky-path test
    failure exit 1; shared-component duplication exit 2.
  - `stop-no-self-cert.sh` — Tier A self-cert phrases exit 1;
    Tier B soft warn (exit 0 + note). Mark deliberate
    exceptions with `// intentional:` within 5 lines above.
- **PostToolUse hooks:** `cross-mode-parity.sh` runs after every
  edit to a mode file. Catches empty stubs AND missing branches in
  selective handlers.
- **Local dev:** `npm start` runs Next + Electron together. Phone
  preview at `http://localhost:3000/`.

---

## 6. TOP 5 NEXT JOBS

### ⭐ Job 0 — Walk the FINAL ROUND checklist

`dev/active/FINAL-ROUND-checklist.md`. Three parts:
- **Part A** — Marie's hands-on across every mode with real files.
- **Part B** — Claude's deep dive (Supabase round-trip, edge cases,
  code health, hook health). No code changes until something
  surfaces.
- **Part C** — watch list.

When this is fully ticked, archive it under `dev/archive/` with the
run date and open a fresh `TODO.md`.

### Job 1 — Fix anything Part A surfaces

Whatever bug Marie finds gets fixed one at a time. Don't bundle.

### Job 2 — Fix anything Part B surfaces

Same rule. Each finding gets its own commit. Each commit gets a
short reason in the message.

### Job 3 — Build the Windows .ico + NSIS Setup installer

After Parts A + B close. The portable EXE already ships
(`dist/StJohn Author Studio (Portable).exe`, 268 MB). The proper
NSIS Setup wizard needs `build/icon.ico` — generate one from the
existing macOS .icns, then `npm run release:win` emits both.

### Job 4 — Phase H6 (only if Marie asks)

Quill annotation flag-field metadata mirror — adds page number +
narrator priority + whisper time to Quill annotations so the phone
and desktop carry the same depth as Proof flags. Big work. Skip
until requested.

### Job 5 — Extract shared HTML walker (cleanup)

Desktop `ChapterReader.js` and phone `PhoneReader.js` each have
their own HTML walker. Both already use the engine helpers from
`packages/quill-engine` for word splitting + selection context.
The walker itself could move there too. ~1 hour. Lowest priority.

---

## 7. WHAT ONLY MARIE CAN DO

- **Hands-on testing on real audiobook files + real .docx
  manuscripts.** Whisper alignment, character voice mapping, the
  feel of double-tap selection, narrator picker UX — these need a
  human with real data.
- **Supabase migrations.** Only Marie has the dashboard access /
  service-role key. Project: `evcusovtjfypfyfvnooy` ("Typing and
  Tomes 2.0 DATA").
- **Design calls.** Colours, layout polish, "does this look
  right" — Marie decides.
- **Push authorisation for force-push or migrations.** Regular
  push is fine without asking. Force-push or schema migration —
  ask first.
- **InDesign export verification.** Marie is the only one who can
  open the .jsx in InDesign and confirm it lines up.
- **Windows install verification.** Marie's husband runs the
  installer on his Windows machine. We can't simulate that here.

---

## 8. WHERE THINGS LIVE

### Code (write here)

| What | Where |
|---|---|
| Phone app (Script + Quill) | `app/phone/page.js` |
| Desktop home + mode switcher | `app/page.js` |
| Shared book detail | `app/components/SessionsView.js` |
| Original BookDetail (Quill home only) | `app/components/BookDetail.js` |
| Shared manuscript reader (desktop) | `app/components/ChapterReader.js` |
| Shared audio dock | `app/components/AudioDock.js` |
| Shared import flow (.docx upload) | `app/components/ImportFlow.js` |
| Top-bar pills + save badge + mode tokens | `app/components/ReaderChrome.js` |
| Phone reader (HTML-preserving word walker) | `app/phone/_components/PhoneReader.js` |
| Phone reader settings panel | `app/phone/_components/PhoneReaderSettings.js` |
| Cloud sync (Supabase) | `packages/cloud-sync/` |
| Audio engine | `packages/audio-engine/` |
| Manuscript engine (.docx parse) | `packages/manuscript-engine/` |
| Quill annotation engine | `packages/quill-engine/` |
| Vercel-only root-to-phone swap | `scripts/vercel-root-to-phone.js` |

### Reference-only (READ but never edit)

- `~/Library/CloudStorage/.../Script and Sync 3.0` — Proof base
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/script-and-sync`
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/quill-and-ink`
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/phone`

### Hooks + safety nets

- `.claude/settings.json` — wires hooks
- `.claude/hooks/_log.sh` — shared audit logger
- `.claude/hooks/context-check.sh` — UserPromptSubmit reminder
- `.claude/hooks/deep-check-trigger.sh` — "deep check" 7-step
- `.claude/hooks/handover-trigger.sh` — this template
- `.claude/hooks/ui-check-trigger.sh` — 24-point usability check
- `.claude/hooks/git-backup.sh` — auto-commits before edits
- `.claude/hooks/file-tracker.sh` — logs every edited file
- `.claude/hooks/cross-mode-parity.sh` — empty stubs + missing
  branches in selective handlers
- `.claude/hooks/no-mess.sh` — Stop-hook checklist
- `.claude/hooks/build-checker.sh` — Stop-hook bouncer (syntax +
  duplication + risky-path tests)
- `.claude/hooks/stop-no-self-cert.sh` — Stop-hook bouncer
  (transcript scan, Tier A blocks, Tier B warns)
- `.claude/hook-activity.log` — Marie verifies hooks ran by
  reading this

### Builds

- **Windows portable EXE (ready to ship to Marie's husband):**
  `dist/StJohn Author Studio (Portable).exe` (268 MB, single file,
  double-click to run, no install wizard).
- Mac dist: `dist/mac-arm64/StJohn Author Studio.app`.
- **Windows NSIS Setup wizard:** not yet built — needs
  `build/icon.ico`. See Job 3.

### Commands Marie actually uses (paste-ready)

```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm start
```

```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm run dev
```

```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm test
```

```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm run release:mac
```

```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm run release:win
```

```
cat ~/Dev/StJohn-Author-Studio-4.0/.claude/hook-activity.log
```

---

## RECENT SESSION HISTORY (so the next AI knows what just happened)

### 2026-05-26 session (this one) — Quill polish + Stop hook bouncers

- Fixed Quill's missing chapter handler — unticks, bulk audio, audio paths now propagate to disk + Supabase + phone
- Fixed Duet's identical bug (chapter done tick + bulk audio path persistence)
- Added the Split scenes toggle to Quill's import (was hidden)
- Brought back "Edit book data" in Quill (was wiped by an actionButtonsOverride)
- Replaced the "Beginning" label — pre-H2 text now folds into the first H2 scene
- Added scene-level untick checkboxes inside Edit book data (expandable per chapter)
- Added the round done-tick on each phone chapter card; syncs phone ↔ desktop via the desktop_project JSONB blob
- Built `scripts/vercel-root-to-phone.js` — phone serves at `/` on Vercel without a redirect; Electron still serves desktop at `/` locally
- Added `.claude/hooks/cross-mode-parity.sh` — catches empty stubs AND missing-branch bugs in selective handlers
- Hardened `build-checker.sh` — syntax errors exit 1; risky-path test failures exit 1 after one retry
- Added `.claude/hooks/stop-no-self-cert.sh` — bouncer for self-cert phrases
- Saved memory rule: "never guess about the app" — read file end-to-end or drive the UI before claiming behaviour
- Wrote `dev/active/FINAL-ROUND-checklist.md` — the primary active list going forward

Latest commit: `ca1c00c` (pushed to `origin/main`).

---

## SUMMARY FOR MARIE (plain English)

- The full final-round checklist is at
  `dev/active/FINAL-ROUND-checklist.md`. Part A is yours. Part B
  is the AI's deep dive.
- Phone is at the root URL now (no `/phone` needed).
- Quill on phone has a round tick next to each chapter — tap to
  mark done, syncs to desktop.
- Quill on desktop has the Split toggle back, Edit book data is
  back, scene-level unticking is new.
- "Beginning" label is gone. Pre-H2 text reads inside the first
  H2 scene.
- The Stop hooks now BLOCK responses with bad code or self-cert
  phrasing, not just warn.
