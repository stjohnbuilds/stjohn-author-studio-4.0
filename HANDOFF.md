# HANDOFF — StJohn Author Studio 4.0

Last refreshed: 2026-07-12. App is on **v4.0.31**. The June bug this file
used to focus on (Breakdown "Unsure" word counts) is FIXED — do not
re-open it.

## Copy-Paste Bootstrap For Next Chat

```text
You are continuing work on StJohn Author Studio 4.0 for Marie Mackay.

Marie is a non-coder. Plain English, short sentences. No walls of text.
No jargon. No "X% confident" — banned phrase. Always end every response
that touched files with a "Files I changed:" footer. Talk like she's 10.

Where things stand (2026-07-12):
- v4.0.31, 163/163 tests pass, latest pushed commit 76e0221.
- Mac .app in "Script and Sync Releases/" is current (built 2026-07-08).
- GitHub Releases stop at v4.0.25 — installed apps that auto-update
  CANNOT see v4.0.26–v4.0.31 yet. Publishing a release is likely due.
- Windows Setup.exe in the releases folder is from 2026-06-09 (old).

Top open problems, in order:
1. Transcription queue: an individual transcribe threw "Failed
   invoking remote method" (chapter 13), app briefly froze, retry
   worked. Marie also believes she LOST already-done transcriptions.
   Needs its own session: reproduce individual-transcribe during a
   running queue, check transcribe IPC error handling in main.js,
   and where whisperAlignment is persisted/lost.
2. Transcriptions sometimes vanish. No repro yet. Next time it
   happens, FIRST check whether script_sync_section_transcriptions
   (Supabase) still has rows for the book vs local Save Data —
   before re-transcribing anything.
3. Split arrows still appear and do nothing when Split is off
   (proofer). Likely: hide/disable the nudge arrows when split
   mode is off. Easy.

Read in this exact order before doing anything:
1. HANDOFF.md (this file)
2. CLAUDE.md (project rules + SHARED COMPONENTS list)
3. ~/.claude/CLAUDE.md (Marie-wide rules)
4. TODO.md — the 2026-07-08 sections at the bottom are the freshest
   context on the open bugs above
```

## 1. WHO IS THE USER

Marie Mackay. Non-coder. Self-publishes audiobooks and special-edition
prints. Writes the books, narrates them, proofs the audio.

Talk like she's 10. Plain English. No jargon. No code-paste unless she
asks. Short sentences. Bullets only when truly parallel. Always end
file-touching turns with `**Files I changed:**` footer — without it
she has no way to see what shifted.

Banned phrases (her no-self-cert Stop hook will block them): "X%
confident", "self-certify", "trust me it works", "fully tested",
"verified" without evidence.

## 2. HARD RULES

- No dual-write. One source of truth per concept.
- No self-certifying anything as done — Marie reviews everything.
- Plain English in chat replies.
- "Files I changed:" footer on every file-touching turn.
- Always give the run command at the end: `cd ~/Dev/StJohn-Author-Studio-4.0 && npm start` and "paste and hit Enter".
- Bottom toolbar in the reader is sacred — do not move it.
- Double-confirm destructive actions before running.
- Never suggest stopping or pausing — keep momentum.
- Push without asking is fine. Force-push to main is NOT.
- Edits reach Marie's installed app two ways: publish a GitHub Release
  (installed app auto-updates) or rebuild + copy the .app/.exe. Dev
  mode (`npm start`) shows changes without any rebuild.
- Every export/download must never overwrite — uniqueExportPath adds
  (1)/(2)/(3). Central will-download hook in main.js.
- New main.js requires MUST be added to electron-builder's `files:`
  whitelist, then launch-test the packaged .app (next build won't
  catch a missing main-process module — v4.0.19 shipped broken this way).
- ONE component per job. Don't write fresh `BookDetail` /
  `ChapterReader` / `AudioDock` / `ImportFlow` / `ReaderChrome` —
  extend the existing ones (CLAUDE.md SHARED COMPONENTS list).
- Never create new database tables / data structures if one already exists.
- Deleting/creating an app/ route while `next dev` runs corrupts its
  cache (stale HTML, 404 JS chunks, no hydration). Fix: stop server,
  `rm -rf .next`, restart.

## 3. READ THESE FILES (IN ORDER)

1. `HANDOFF.md` (this file)
2. `CLAUDE.md` (project rules + SHARED COMPONENTS list)
3. `~/.claude/CLAUDE.md` (Marie-wide rules)
4. `TODO.md` — bottom sections (2026-07-08) hold the freshest bug notes
5. If touching the transcription bugs: `main.js` (transcribe IPC +
   error handling), `app/lib/transcriptionWorker.js`,
   `app/components/SessionsView.js` (queue UI)
6. If touching the proofer: `app/components/ProofingReader.js`
   (selection popup, clip preview, See Errors, word-follow)

## 4. BROAD VISION

THE DREAM: one desktop app + one phone companion for Marie's
self-published audiobook + print workflow. Four desktop modes (Proof
Listen, Prep Manuscript, Duet Prep, Quill & Ink), two phone modes
(Script, Quill), one shared reader brain, one shared cloud-sync. Audio
stays local (never uploaded). One mode-switching home. No fake data.

## 5. CURRENT STATE

- Version: **v4.0.31** ("Proofer highlights use true Word colours" 🌈).
- Build state: clean. **163/163 unit tests pass** (`npm test`,
  node:test). No typecheck step in this project.
- Latest commit pushed: `76e0221`.
- TODO.md progress: 117 / 171 tasks done (68%).
- Packaged builds in `Script and Sync Releases/`:
  - `StJohn Author Studio.app` — **v4.0.31**, built 2026-07-08 ✓ current
  - `StJohn Author Studio Setup.exe` — built 2026-06-09 ⚠ stale
- **GitHub Releases stop at v4.0.25 (2026-06-28).** The installed app's
  auto-updater feeds from GitHub Releases, so installs are stuck at
  v4.0.25 until someone publishes v4.0.31. Six versions of work
  (clip download + preview, unified Jump/Flag/Clip popup, true Word
  colours) are only visible in dev mode / the local Mac .app.
- No live web URL — this is a desktop app. The phone companion is NOT
  deployed to Vercel yet (release-checklist item, not started).
- Shipped since the last handover (June 6 → July 8): ACX scanner
  (proof-screen button, room-tone check, exports, native Apple-silicon
  ffmpeg), auto-update from GitHub Releases + always-visible version
  stamp, See Errors overhaul (fuzzy quote match, word-follow, yellow
  bands), teaser-clip download with mini preview player, one unified
  proofer popup (Jump / Flag / Download clip), true Word colours for
  proofer highlights, plain-paragraph POV-name detection in both
  breakdown walkers (the old handover's bug — done).

## 6. TOP 5 NEXT JOBS

In priority order. Effort tags: Easy / Marie / Design call /
Big multi-week.

1. **Transcription queue: individual transcribe error + freeze.**
   Big-ish, own session. Chapter 13 threw "Failed invoking remote
   method", app briefly froze, retry worked; odd "reselect audio"
   state seen too. Reproduce an individual transcribe while a queue is
   running; check transcribe IPC error handling in `main.js` and where
   whisperAlignment is persisted/lost.

2. **Transcriptions sometimes vanish.** Marie + diagnosis. No repro
   yet. The moment it happens again: check whether
   `script_sync_section_transcriptions` (Supabase) still has the rows
   vs local Save Data, BEFORE re-transcribing. That tells us if it's a
   cloud-pull overwrite or local loss.

3. **Publish v4.0.31 to GitHub Releases + fresh Windows build.** Easy +
   Marie says when. Until published, her installed apps can't
   auto-update past v4.0.25, and the Setup.exe on disk is a month old
   (`npm run release:win`).

4. **Split arrows do nothing when Split is off.** Easy. In the
   proofer, the scene/split nudge arrows still pop up and down when
   clicked with Split off, but nothing moves. Hide or disable them
   when split mode is off.

5. **Phone items Marie asked for.** Marie + code. Remember the picked
   audio folder per book; edit/delete Quill annotations on phone;
   attribute the flag narrator to the tapped word. Plus the standing
   two-device flag round-trip test.

## 7. WHAT ONLY MARIE CAN DO

- Approve each code-edit block (per-block, never bulk).
- Reproduce the transcription bugs on her real books (nobody else has
  her data or her timing).
- Live phone tests on her actual phone with a safe Supabase account.
- Visual verification in real Word / Adobe Audition / InDesign of the
  export output.
- Say when to publish the v4.0.31 release (job #3) — it changes what
  her installed apps run.
- Pick between alternatives where there is no obviously-correct answer.
- Sign packaged builds (Apple Developer ID / Windows EV cert) — not
  done yet; first-launch warnings are the cost of that being unset.

## 8. WHERE THINGS LIVE

```
~/Dev/StJohn-Author-Studio-4.0/
├── app/
│   ├── page.js                          ← Proof shell, mode switch
│   ├── phone/page.js                    ← Phone Script + Quill
│   ├── components/
│   │   ├── SessionsView.js              ← Proof book detail, breakdown
│   │   │                                  popup, transcription queue UI,
│   │   │                                  markers from CSV, See errors
│   │   ├── ProofingReader.js            ← Proof reader: audio sync,
│   │   │                                  selection popup (Jump/Flag/
│   │   │                                  Clip), clip preview player,
│   │   │                                  word-follow
│   │   ├── CheckErrorsDialog.js         ← See errors popup
│   │   ├── AcxScanDialog.js             ← ACX file checker popup
│   │   ├── PrepManuscriptMode.js        ← Prep mode + per-character
│   │   │                                  breakdown
│   │   ├── PrebuildMode.js              ← Duet
│   │   ├── QuillAndInkMode.js           ← Quill
│   │   ├── BookDetail.js                ← SHARED book detail chrome
│   │   ├── ChapterReader.js             ← SHARED reader
│   │   ├── AudioDock.js                 ← SHARED player
│   │   ├── AppDialog.js                 ← SHARED modal primitive
│   │   ├── ImportFlow.js                ← SHARED .docx import
│   │   ├── ReaderChrome.js              ← MODE_TOKENS, sticky top bar
│   │   └── icons.js                     ← line SVG icons (no emojis)
│   └── lib/
│       ├── transcriptionWorker.js       ← whisper transcribe driver
│       ├── csvFlagImport.js             ← position-based CSV parser
│       ├── csvAuditionMarkers.js        ← Marker_[…].csv writer
│       ├── fuzzyMatcher.js              ← See Errors quote matching
│       └── narratorSpeedMemory.js       ← per-narrator playback memory
├── packages/
│   ├── acx-engine/                      ← ACX audio checks (ffmpeg)
│   ├── audio-engine/                    ← whisper-json, sync table
│   ├── cloud-sync/                      ← Supabase + slim push/pull
│   ├── manuscript-engine/               ← docx, dialogue, tallies
│   ├── quill-engine/
│   └── backups/                         ← Drive snapshot system
├── main.js                              ← Electron main (transcribe +
│                                          clip/ACX ffmpeg IPC lives here)
├── preload.js                           ← Electron bridge
├── electron-builder.yml                 ← Build config + files: whitelist
├── tests/                               ← 163 tests, node:test
└── Script and Sync Releases/
    ├── StJohn Author Studio.app         ← v4.0.31 Mac build (2026-07-08)
    └── StJohn Author Studio Setup.exe   ← 2026-06-09 (STALE)
```

### Commands Marie actually uses (paste-ready)

```bash
# Dev mode (fast iteration)
cd ~/Dev/StJohn-Author-Studio-4.0 && npm start

# Run the tests
cd ~/Dev/StJohn-Author-Studio-4.0 && npm test

# Build Mac app
cd ~/Dev/StJohn-Author-Studio-4.0 && npm run release:mac

# Build Windows installer (on the Mac via Wine)
cd ~/Dev/StJohn-Author-Studio-4.0 && npm run release:win
```

---

This is a handover doc. If you're a fresh AI reading this: the thing
Marie is most likely waiting on is the transcription bug pair (TOP 5
jobs #1 and #2) — her transcriptions error, freeze, and sometimes
disappear. Diagnose before touching anything; do not re-transcribe
her real books as a "fix".
