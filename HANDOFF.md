# HANDOFF — 2026-05-26 (after H18 partial test run)

## 📋 COPY-PASTE BLOCK — paste this verbatim into a fresh chat to bootstrap

```
You're continuing work on StJohn Author Studio 4.0 for Marie.

Before you do ANYTHING:
1. Read /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/CLAUDE.md (top to bottom).
2. Read /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/HANDOFF.md (this file).
3. Read /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/TODO.md.
4. Read /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/SHARED_COMPONENTS.md.

Marie is a NON-CODER. Plain English, 2-4 sentences default. Banned words:
refactor, abstraction, composition, polyfill, hydrate, memoize, lift state,
scope guard, prop drilling, dependency injection, side-effect, idempotent.

Mandatory on every response that touches files:
- "Files I changed:" footer at the end.
- Run command in a code block: `cd ~/Dev/StJohn-Author-Studio-4.0 && npm start`
  followed by "paste and hit Enter".

Your job for this session: the 26-test plan from Section 6 below. Run it
FROM SCRATCH — don't trust anyone else's pass/fail notes. Fix anything
that breaks before declaring a test done. Confidence % at the end, list
what you're still unsure about. No self-certifying.
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
  `CLAUDE.md` at the top. The build-checker hook will hard-block any
  new inline `function .*BookDetail/HomeView/ChapterRow/ReaderView/
  Setup/Panel/AudioDock/Picker` in a mode file.
- **No self-certifying.** Battery-test on real files before saying
  "done". End with a confidence % and a list of what you're unsure of.
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

---

## 3. READ THESE FILES (IN ORDER)

1. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/CLAUDE.md`
2. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/HANDOFF.md` (this file)
3. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/TODO.md`
4. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/SHARED_COMPONENTS.md`
5. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/CLOUD_SCHEMA.md`
6. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/dev/active/H18-26-test-run/RESULTS.md`
   — empty test scaffolding. Fill in from scratch as you run.

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

- **% done:** ~85% overall. Phone Script mode + desktop Proof + cloud
  round-trip are working end-to-end. Quill is wired but the
  flag-field metadata mirror (Phase H6) hasn't been done.
- **Latest pushed commit (remote `main`):** `e506fd0`
- **Local HEAD:** `c47e613` — auto-backup commits from the pre-edit
  hook. **NOT pushed.** Local is ahead of remote.
- **Working tree dirty:** `app/phone/page.js` has uncommitted changes
  (Phase H18a fix — see Section 6 issue list).
- **Tests:** `npm test` runs Node's built-in test runner; suite is
  small. Run it after any cloud-sync edit.
- **Live phone URL:** `https://stjohn-author-studio-4.vercel.app/phone`
  — last deployed earlier this session.
- **Vercel root = phone:** `scripts/vercel-root-to-phone.js` runs in
  the build step (only when `VERCEL=1`) and overwrites `out/index.html`
  with the phone page. URL bar stays as `/`, no bounce, no separate
  rewrite needed. Electron's build scripts (`electron-build-mac`,
  `electron-build-win`) call `next build` directly instead of `npm run
  build`, so the swap doesn't run there — Electron keeps the desktop
  UI at `/`.
- **Local dev:** `npm start` runs Next + Electron together. Phone
  preview at `http://localhost:3000/phone`.

---

## 6. TOP 5 NEXT JOBS

### ⭐ Job 0 — Walk the FINAL ROUND checklist

`dev/active/FINAL-ROUND-checklist.md` (created 2026-05-26). Part A
is Marie's hands-on across every mode with real files. Part B is
Claude's deep dive (Supabase round-trip, edge cases, code health,
hook health). Part C is the watch list. When that's all ticked,
this app is done. Everything else below this line is older.

### Job 1 — Re-run the 26-test plan from scratch ⚠️ Marie + Easy

The full plan lives in
`/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/dev/active/H18-26-test-run/RESULTS.md`
(empty table). Walk every row. Mark ✓ pass / ⚠ minor / ❌ broken
with a one-line note. Don't trust the previous session — re-test
everything.

**14 phone tests:** service picker + cog → settings → sign-out →
empty book list → book list with data → open book → Chapters/Flags
tabs → open chapter → reader settings persist → Page Swipe mode →
pick audio → tap-word → save flag → delete flag.

**8 desktop tests:** home book list (last-touched first) → Resync
button + last-synced text → open book (no banner) → Tutorial pill
clickable → side nav Nav/Flags/Queue → Flags tab all-flags listed
→ delete flag from desktop → home/back audio survives.

**4 cross-device tests:** phone save → desktop refresh sees it →
phone delete → desktop refresh loses it → desktop delete book →
phone loses it → phone offline save → online retry.

### Job 2 — Phase H6: Quill annotation flag-field metadata ⚠️ Big

The desktop Quill annotation panel and the phone Quill annotation
panel don't share the same field shape as the Proof flag form.
Mirror the H7 work (page from page map, narrator priority, time
from whisper alignment) into the Quill side so a phone Quill save
produces the same metadata a desktop Quill save would.

### Job 3 — Build a proper Windows .ico + NSIS Setup installer ⚠️ Easy

The portable .exe works (268 MB, see Section 8). The NSIS Setup
wizard installer failed because `build/icon.ico` doesn't exist.
Either generate a 256×256 ICO from the existing macOS .icns, or
add a placeholder. Then `npm run release:win` will emit BOTH a
portable AND a Setup installer.

### Job 4 — Redeploy phone to Vercel ⚠️ Easy (needs Marie's OK)

After the test run + Phase H18a confirmation, push the fix to
`main` and trigger a Vercel deploy. Marie's husband may also
want the desktop EXE (portable is ready now).

### Job 5 — Phone reader location memory restore ⚠️ Easy

`packages/cloud-sync/flag-queue.js` and `stjohn-phone-reader-
location-v1` localStorage key — confirm that re-opening a book
puts Marie back where she was reading.

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
- **Push authorisation.** Push is fine without asking, but if
  it's force-push or a migration push, ask first.
- **InDesign export verification.** Marie is the only one who can
  open the .jsx in InDesign and confirm it lines up.

---

## 8. WHERE THINGS LIVE

### Code (write here)

| What | Where |
|---|---|
| Phone app (Script + Quill) | `app/phone/page.js` |
| Desktop home + mode switcher | `app/page.js` |
| Shared book detail (sticky bar + chapters) | `app/components/BookDetail.js` |
| Shared manuscript reader | `app/components/ChapterReader.js` |
| Shared audio dock | `app/components/AudioDock.js` |
| Shared import flow (.docx upload) | `app/components/ImportFlow.js` |
| Top-bar pills + save badge + mode tokens | `app/components/ReaderChrome.js` |
| Phone reader (HTML-preserving word walker) | `app/phone/_components/PhoneReader.js` |
| Cloud sync (Supabase) | `packages/cloud-sync/` |
| Audio engine | `packages/audio-engine/` |
| Manuscript engine (.docx parse) | `packages/manuscript-engine/` |
| Quill annotation engine | `packages/quill-engine/` |

### Reference-only (READ but never edit)

- `~/Library/CloudStorage/.../Script and Sync 3.0` — Proof base
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/script-and-sync`
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/quill-and-ink`
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/phone`

### Hooks + safety nets

- `.claude/settings.json` — wires hooks
- `.claude/hooks/_log.sh` — shared audit logger
- `.claude/hooks/context-check.sh` — UserPromptSubmit reminder
- `.claude/hooks/deep-check-trigger.sh` — Marie's "deep check" 7-step
- `.claude/hooks/handover-trigger.sh` — this template
- `.claude/hooks/ui-check-trigger.sh` — 24-point usability check
- `.claude/hooks/git-backup.sh` — auto-commits before edits
- `.claude/hooks/file-tracker.sh` — logs every edited file
- `.claude/hooks/no-mess.sh` — Stop-hook warning
- `.claude/hooks/build-checker.sh` — Stop-hook duplication guard
- `.claude/hook-activity.log` — Marie verifies hooks ran by
  reading this

### Builds

- **Windows portable EXE (ready to ship to Marie's husband):**
  `dist/StJohn Author Studio (Portable).exe` (268 MB, single file,
  double-click to run, no install wizard).
- Mac dist: `dist/mac-arm64/StJohn Author Studio.app`.

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

## ISSUES TO LOOK INTO (don't trust — verify as you re-test)

The previous session got partway through the 26-test plan and stopped.
Re-run the FULL plan from scratch. While you do, keep an eye out for
these specific things that came up:

1. **Phone book-detail crash on open** — was fixed in
   `app/phone/page.js` but the fix is uncommitted and unpushed.
   A `useMemo` was sitting in the wrong place so React got
   confused about how many hooks the component had. Confirm the
   crash is gone before pushing.
2. **Pick audio dock overlapping inline-flag card** in Page Swipe
   mode — minor cosmetic. The bottom audio pill seems to overlap
   the top of the inline flags list.
3. **Phone auth safety timer** — 8s timeout was added on
   `supabase.auth.getSession()` so the phone can't hang forever
   on "Checking your account…". Confirm it kicks in by killing
   network and reloading the phone — login form should appear
   after 8 seconds at the latest.
4. **Tap-to-flag via browser automation didn't fire.** The
   double-tap-to-select code in `PhoneReader.js` uses
   `pointerdown` with a 420ms window. Synthetic PointerEvents
   from the browser preview tool didn't register — needs a real
   finger / touch device or a `dblclick` MouseEvent path. May
   need a tiny tweak so e2e tooling can drive it.
5. **Sign-out + sign-in flow** isn't testable in dev-skip mode —
   needs Marie's real Supabase credentials.
6. **Empty book list state** wasn't observed — would need to
   clear `stjohn-author-phone-project-cache-v1` to see it.

---

## SUMMARY FOR MARIE (plain English)

- **Caught a crash on the phone book detail.** When you tapped
  into a book, the phone showed a red error screen instead of
  the book. I tracked down why and moved one piece of code so
  React stops getting confused. The fix is in your phone code
  but isn't pushed to Vercel yet.
- **Built the Windows EXE for your husband.** It's at
  `dist/StJohn Author Studio (Portable).exe` (268 MB). One
  file, he double-clicks it, no install wizard. The proper
  wizard installer didn't build because we don't have a
  Windows icon file yet — next session can fix that.
- **Started the 26-test plan but didn't finish.** Next session
  will re-run the whole thing from scratch. The empty test
  table is at
  `dev/active/H18-26-test-run/RESULTS.md`.
