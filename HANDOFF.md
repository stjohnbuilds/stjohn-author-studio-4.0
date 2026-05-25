# HANDOFF — StJohn Author Studio 4.0 — 2026-05-24 (late evening)

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
2. CLAUDE.md — project rules. Read all of it including the Hook rules,
   the Deep-check trigger and the Handover trigger sections.
3. TODO.md — the URGENT section at top, then Active.
4. docs/SHARED_COMPONENTS.md — the cheat sheet of shared components.
   If you're about to write inline UI in a mode file, you almost
   certainly shouldn't.
5. /Users/mariemackay/.claude/projects/-Users-mariemackay-Dev-StJohn-Author-Studio-4-0/memory/
   — my auto-memory files. Includes "always give run command".

The most important rule: I am NOT technical. Plain English, short
bullets, no jargon. Banned vocab in section 2. Talk like I'm 10.

Second most important: NO duplication. One source of truth for
everything. Mode = verb only (flag / annotate / duet-mark /
dialogue-tag). The shared components live in app/components/ and
packages/ — use them, never copy them.

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

- **No dual-write.** ONE source of truth per piece of UI. Never copy
  a component "with small tweaks" into a mode file. If a shared
  component doesn't fit, extend it with a prop or a slot.
- **No self-certifying.** When she says "deep check" / "scrub it" /
  "battery test" / "verify everything," run the 7-step protocol from
  CLAUDE.md before claiming done. Confidence percent + uncertainty
  list at the end. No exceptions.
- **Plain English only.** See banned vocab above.
- **"Files I changed:" footer is mandatory** on every response that
  touches files. Bullet list with each path + one-line "what and why."
  This is how Marie tracks what's happening.
- **Always give clickable links** where possible — paths in backticks
  she can click in her terminal/editor.
- **Bottom toolbar is sacred** — it's the audio play/pause/scrub dock
  in the reader. Do NOT put annotation lists, flag lists, or any
  other secondary content there. Annotations / flags live in a
  popout button in the top nav.
- **Double-confirm destructive actions.** Delete project, remove all
  annotations, etc. — two clicks. `window.confirm` works for now;
  shared `<ConfirmDialog />` is TODO.
- **Never suggest stopping or pausing** unless you genuinely cannot
  proceed. Marie has heard "let's pause and check" too many times.
  Keep going. Multi-turn execution without check-ins is the default.
- **Push is fine without asking.** git push to main, GitHub. She
  doesn't need to authorise each push. (She DOES need to authorise
  Vercel deploys — only `vercel --prod` waits.)
- **End every code-touching response with the run command** in a code
  block + "paste and hit Enter":
  ```
  cd ~/Dev/StJohn-Author-Studio-4.0 && npm start
  ```

## 3. READ THESE FILES (IN ORDER)

1. `~/Dev/StJohn-Author-Studio-4.0/HANDOFF.md` (this file)
2. `~/Dev/StJohn-Author-Studio-4.0/CLAUDE.md` — project rules + Hook
   rules + Deep-check trigger + Handover trigger sections
3. `~/Dev/StJohn-Author-Studio-4.0/TODO.md` — start with URGENT section
4. `~/Dev/StJohn-Author-Studio-4.0/docs/SHARED_COMPONENTS.md` — what's
   already shared; what's NOT shared yet
5. `~/Dev/StJohn-Author-Studio-4.0/docs/BUILD_PLAN_V4.md` — the
   architectural plan
6. `/Users/mariemackay/.claude/projects/-Users-mariemackay-Dev-StJohn-Author-Studio-4-0/memory/MEMORY.md`
   — Marie's auto-memory (always-give-run-command feedback)
7. `~/Dev/StJohn-Author-Studio-4.0/.claude/hook-activity.log` — proof
   the hooks are running. Tail it to see recent activity.

**Reference apps (READ-ONLY — never edit):**
- `~/Library/CloudStorage/GoogleDrive-mariemackaybooks@gmail.com/My Drive/Game Dev/GitHub/Script and Sync 3.0/`
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/quill-and-ink - ARCHIVED 2026-05-23/`
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/phone - ARCHIVED 2026-05-23/`

## 4. BROAD VISION (the dream)

One desktop app + one phone companion that **completely handles Marie's
self-published audiobook + special-edition print workflow.** Four
modes (Proof Listen, Prep Manuscript, Duet Prep, Quill & Ink) that
share ONE brain — one reader, one audio engine, one cloud sync. The
mode is just a verb. **A finished writer should be able to take a
manuscript from .docx import all the way to a polished audiobook +
InDesign print file in this one app, with the phone for capture on the
go.**

## 5. CURRENT STATE

- **% done overall:** ~73% (weighted).
- **Latest commit SHA on `main`:** `6059f27` (`auto-backup: before
  Claude edit 2026-05-24 22:45:25`). All recent commits are auto-backups
  from the git-backup hook — Marie hasn't done a manual squash commit
  in a while; safe to push as-is or squash before push.
- **Branch state:** `M CLAUDE.md` (handover protocol section added
  this turn). Otherwise clean working tree.
- **Test count:** **0 dedicated `.test.js` files.** Verification has
  been manual + the build-checker hook + dev preview. Adding a real
  test suite is a future job (not on top-5).
- **Typecheck status:** **N/A** — JS project, no TypeScript.
  `node --check` runs via the build-checker hook on every edited .js
  file, but JSX isn't validated by `node --check` so it's a weak
  signal.
- **Live URL:** **NOT DEPLOYED YET.** No Vercel deploy exists for the
  phone. Desktop runs locally via `npm start` (Electron). When the
  phone deploy lands, the URL will be on Vercel — until then, anyone
  who tells you "the live URL is X" is wrong.
- **Recent work (this session):** Quill rebuilt around shared
  `ChapterReader` + `BookDetail`. Duet's book detail wrapped in the
  same `BookDetail`. Audio engine pure helpers extracted to
  `packages/audio-engine`. Deep-check + handover hooks installed.
  Dev skip-login button added so AIs can drive the app without
  Marie's password.

## 6. TOP 5 NEXT JOBS (priority order)

1. **Global accent override per active mode (kill purple leak).**
   `Easy.` Wrap each mode's render in a div that overrides
   `--accent` / `--accent-dark` / `--accent-soft` / `--accent-border`
   CSS vars with the mode's tokens from `MODE_TOKENS[tone]`. Right
   now Duet renders with the global purple `var(--accent)` instead
   of its blue. Marie sees the wrong colour on every `var(--accent)`
   button inside Duet (and same risk in Proof, Quill).

2. **Kill the inline-card gradient in Duet + Proof.**
   `Easy.` Every card header in `PrebuildMode.js` and
   `SessionsView.js` uses `linear-gradient(180deg, var(--accent-soft)
   0%, #ffffff 100%)`. Marie has said many times she wants the FLAT
   Quill look everywhere. Find-and-replace those gradients with flat
   `var(--accent-soft)` or flat white.

3. **Migrate Proof's `SessionsView` to render shared `BookDetail`.**
   `Big multi-week.` 2385 lines, anchor mode, deeply coupled to
   audio sync. Strategy: wrap shell in `<BookDetail>` (same as Duet
   just did), pass all the inline panels (audio queue, narrators,
   audiobook timing, bulk audio) via `prePanels`. Full real-file
   test pass required after. **Highest risk job in the queue.**

4. **Migrate Proof's reader to `<ChapterReader>`** + add shared
   `<AudioDock>` to ChapterReader's bottom slot. `Big multi-week.`
   Audio sync stays mode-side; ChapterReader handles word render +
   click. Once this lands, **Quill gains audio for free** because
   ChapterReader's AudioDock works for any mode.

5. **Marie's real-file end-to-end test pass on Quill** post-migration.
   `Marie.` She opens a real .docx, drag-selects, adds annotations,
   exports CSV + InDesign .jsx, runs the .jsx in InDesign. The only
   way to know the unification didn't regress Quill's actual
   workflow.

## 7. WHAT ONLY MARIE CAN DO

- **Sign up for the real Supabase account** (already done — `evcusovtjfypfyfvnooy`
  "Typing and Tomes 2.0 DATA"). Dev skip-login bypasses this for the
  AI but cloud sync still needs Marie's real auth.
- **Real-file tests on her own manuscripts + audiobooks.** AIs cannot
  open her .docx via file picker or attach her audio.
- **Design calls** — pastel-vs-rich, layout decisions, colour swaps
  she hasn't pre-approved. When in doubt, ask.
- **Push authorisation** — she's said push is fine without asking, but
  destructive pushes (force-push to main) still need explicit OK.
- **Vercel deploy authorisation** — `vercel --prod` always waits.
- **InDesign runs** — only Marie has InDesign installed to verify the
  exported `.jsx` actually does what she needs.
- **Approving the unification scope** — when the AI proposes a refactor
  that touches >1 mode file at once, get Marie's go before starting.

## 8. WHERE THINGS LIVE

```
~/Dev/StJohn-Author-Studio-4.0/
├── HANDOFF.md                      ← this file
├── CLAUDE.md                       ← rules + hook protocols
├── TODO.md                         ← URGENT section at top
├── app/
│   ├── page.js                     ← auth gate + mode router
│   ├── components/
│   │   ├── ChapterReader.js        ★ THE shared reader (Quill uses it,
│   │   │                             Proof migration pending)
│   │   ├── BookDetail.js           ★ THE shared book-detail page
│   │   │                             (Quill + Duet use it, Proof pending)
│   │   ├── ReaderChrome.js         ★ Shared sticky bar, save badge,
│   │   │                             MODE_TOKENS, pickContrastText,
│   │   │                             topBtnStyle
│   │   ├── ImportFlow.js           ★ Shared .docx upload + chapter picker
│   │   │                             (Quill, Prep, Duet use it; Proof has
│   │   │                             its own ManuscriptSetup.js — to migrate)
│   │   ├── LoginScreen.js          ← with dev skip-login button
│   │   ├── ProofingReader.js       ← Proof's reader (1546 lines, to migrate)
│   │   ├── SessionsView.js         ← Proof's book detail (2385 lines, to migrate)
│   │   ├── PrebuildMode.js         ← Duet (book detail uses shared BookDetail)
│   │   ├── PrepManuscriptMode.js   ← Prep (intentionally separate)
│   │   ├── QuillAndInkMode.js      ← Quill (fully on shared components)
│   │   └── ManuscriptSetup.js      ← Proof's BookSetup (to migrate to ImportFlow)
│   └── phone/page.js               ← phone scaffold
├── packages/
│   ├── audio-engine/index.js       ← buildSyncTable, getMsIdxAtTime,
│   │                                 getAudioTimeForMsIdx (pure helpers)
│   ├── cloud-sync/                 ← Supabase client + Quill sync wired;
│   │                                 Proof sync TODO
│   ├── manuscript-engine/          ← DOCX + dialogue detection (Prep)
│   └── quill-engine/               ← annotation tree + InDesign exporter
├── docs/
│   ├── SHARED_COMPONENTS.md        ← what's shared, what's not, how to extend
│   ├── BUILD_PLAN_V4.md
│   ├── FRONT_FUNCTION_TREE.md
│   ├── INTERNAL_FUNCTION_TREE.md
│   └── WIRING_MATRIX.md
└── .claude/
    ├── settings.json               ← hooks registered here
    ├── hooks/
    │   ├── _log.sh                 ← shared logger
    │   ├── context-check.sh        ← prompt-submit reminder
    │   ├── deep-check-trigger.sh   ← fires on "deep check" / "scrub it" etc.
    │   ├── handover-trigger.sh     ← fires on "make a handover" etc.
    │   ├── build-checker.sh        ← syntax check + duplication guard
    │   ├── file-tracker.sh         ← logs every Edit/Write
    │   ├── git-backup.sh           ← auto-commit before each edit
    │   └── no-mess.sh              ← post-Stop checklist
    ├── hook-activity.log           ← gitignored; tail to see hooks firing
    ├── blocked-edits.log           ← gitignored; build-checker block log
    └── edit-log.txt                ← gitignored
```

### Commands Marie actually uses

```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm start
```
↑ Paste into Terminal, hit Enter. Launches Electron + Next together.

```
npm test
```
↑ No tests yet (0 `.test.js` files). Currently a no-op for verification.

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
↑ Verify hooks are firing. Should show timestamps for every recent edit.

```
cat ~/Dev/StJohn-Author-Studio-4.0/.claude/blocked-edits.log
```
↑ Empty = nothing was blocked. Non-empty = the build-checker caught a
duplication attempt; the log lists which file + what shared component
should have been used.

```
git log --oneline -10
```
↑ Recent commits (mostly auto-backups). Latest SHA at time of writing:
`6059f27`.

---

**Summary of what changed since the last handover (in Marie's English):**

- One reader for Quill (and Proof later) — no more four copies.
- One book-detail page for Quill and Duet — Proof still has its own
  big one, that's the next big job.
- Quill loads fast now instead of taking ten minutes.
- Prep is sage green instead of mustard yellow.
- Quill highlights are pink not red, and now make ONE continuous
  underline instead of broken stripes per word.
- The image annotation isn't red anymore (it was ugly).
- The "Show sub-headings" button in Duet's upload now actually does
  something.
- A safety hook stops AIs writing fresh duplicate components — they
  get blocked at the door.
- A "deep check" hook stops AIs saying "fixed" when they haven't run
  the battery.
- A "handover" hook (this one) makes sure no AI session loses Marie's
  context.
- A dev skip-login button on the sign-in screen so AIs can drive the
  app without Marie's password (visible only outside production).
