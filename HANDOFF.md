# HANDOFF — StJohn Author Studio 4.0

Last refreshed: 2026-06-04. Focus: Next-chapter transcription drop bug.

## Copy-Paste Bootstrap For Next Chat

```text
You are continuing work on StJohn Author Studio 4.0 for Marie Mackay.

Marie is a non-coder. Plain English, short sentences. No walls of text.
No jargon. No "X% confident" — banned phrase. Always end every response
that touched files with a "Files I changed:" footer. Talk like she's 10.

Current top-priority bug:
Hitting "Next chapter" in the Proof Listen reader does not pick up
transcription that completed in the background. Going back to book
detail and clicking Proof on the same chapter DOES show the
transcription. Root cause: two parallel "audio key" functions
(sectionAudioKey in app/page.js:90 vs getSectionAudioKey in
app/components/SessionsView.js:441) produce different string shapes
("path:..." vs raw). The Next-chapter path uses the wrong one;
hasCurrentSectionTranscription returns false; reader gets empty
whisperWords/whisperAlignment. See docs/audits/
STJOHN_NEXT_CHAPTER_BUG_AUDIT_PROMPT.md for the verifier prompt.

Marie has NOT approved code edits for this yet. She wants an
independent audit first. Don't touch app/page.js or SessionsView.js
until she says go.

Read in this exact order before doing anything:
1. HANDOFF.md (this file)
2. CLAUDE.md (project rules)
3. ~/.claude/CLAUDE.md (Marie-wide rules)
4. docs/audits/STJOHN_NEXT_CHAPTER_BUG_AUDIT_PROMPT.md
5. docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md (existing fix roadmap)
6. docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md (live bug log)
7. docs/APP_STRUCTURE.md (current source layout)
8. docs/SHARED_COMPONENTS.md (one-of-each rule)
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
- Edits only reach Marie's installed app after `npm run release:mac` and `npm run release:win` AND copying the new .app/.exe into place. Dev mode (`npm start`) shows changes without rebuild.
- Code edits need a git diff + a unit test + a sandbox proof per block (Marie's safety pattern from the 12-block audit). One source for both app and tests.

## 3. READ THESE FILES (IN ORDER)

1. `HANDOFF.md` (this file)
2. `CLAUDE.md` (project rules + SHARED COMPONENTS list)
3. `~/.claude/CLAUDE.md` (Marie-wide rules)
4. `docs/audits/STJOHN_NEXT_CHAPTER_BUG_AUDIT_PROMPT.md` (current top bug)
5. `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md` (12-block fix roadmap)
6. `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` (live bug log)
7. `docs/APP_STRUCTURE.md` (current source layout)
8. `docs/SHARED_COMPONENTS.md` (one-of-each rule + new helpers list)

## 4. BROAD VISION

THE DREAM: one desktop app + one phone companion for Marie's
self-published audiobook + print workflow. Four desktop modes (Proof
Listen, Prep Manuscript, Duet Prep, Quill & Ink), two phone modes
(Script, Quill), one shared reader brain, one shared cloud-sync. Audio
stays local (never uploaded). One mode-switching home. No fake data.

## 5. CURRENT STATE

- Build state: clean. 81/81 unit tests pass.
- Audit campaign: 9 of 12 blocks shipped this session (1, 2, 3a, 4, 5,
  6, 7, 9, 10, 11). 3 blocks pending Marie's hands (3b audio bridge
  packaged test, 8 phone live tests, 12 manual visual checks).
- Latest commit pushed: `6ba40de` — default page-number adjustment to
  -1 on import (Marie's request).
- Latest packaged Mac app: `Script and Sync Releases/StJohn Author
  Studio.app`, built 14:56 today.
- Latest packaged Windows installer: `Script and Sync Releases/StJohn
  Author Studio Setup.exe`, built 13:04 today (no portable, dropped
  per Marie's request).

NEW BUG SURFACED THIS TURN (the focus of this handover):
- Hitting "Next chapter" in the Proof Listen reader does not pick up
  background-completed transcription. Out-and-back-in via Proof button
  works. Root cause documented in
  `docs/audits/STJOHN_NEXT_CHAPTER_BUG_AUDIT_PROMPT.md`. Marie wants
  independent verification before any code edit.

Marie also said earlier: "all the pages are blank" when her friend
uploaded a manuscript. Separate issue, blocked on a manuscript file or
screenshot from Marie to diagnose. Not yet in the bug log.

## 6. TOP 5 NEXT JOBS

In priority order. Effort tags: Easy / Marie / Design call /
Big multi-week.

1. **Get an independent AI to verify the next-chapter bug diagnosis.**
   Easy + Marie (Marie pastes the prompt into a fresh AI chat). Prompt
   is at `docs/audits/STJOHN_NEXT_CHAPTER_BUG_AUDIT_PROMPT.md`. They
   write the report to `docs/audits/STJOHN_NEXT_CHAPTER_BUG_AUDIT_REPORT.md`.

2. **After audit clears: kill `sectionAudioKey` in `app/page.js` and
   route Next/Prev chapter through `buildContinuousProofSection` (or
   factor out a single shared helper).** Easy (1 line + a few caller
   updates). Marie has signalled the architectural preference: Next/
   Prev should just change which chapter is active, not rebuild the
   section. So the real cleanup is also: drop the rebuild,
   `setActiveChapterId(next)`, let the reader re-derive. Slightly
   bigger refactor — propose to Marie which version she wants.

3. **Investigate the "blank pages" report from Marie's friend.** Marie.
   Needs the manuscript file or a screenshot of one blank page to
   reproduce. Likely candidates: page-map extraction failed, PDF
   conversion produced empty pages, HTML import didn't parse
   paragraphs.

4. **Block 3b — Audio bridge lockdown (security).** Marie + Easy code,
   but high regression risk on audio playback. Needs the packaged Mac
   app + Marie's real Drive audio to verify before shipping.
   `STJOHN_FIX_STRATEGY_QUEUE.md` items 10.1.

5. **Block 8 — Phone test-first items (5 items).** Marie. Live phone
   tests against a safe Supabase account. Recipes in
   `docs/audits/STJOHN_FIX_PLAN_VERIFICATION_REPORT.md` Block 8.

## 7. WHAT ONLY MARIE CAN DO

- Approve each code-edit block (per-block, never bulk).
- Live phone tests on her actual phone with a safe Supabase account.
- Visual verification in real Word / InDesign of the export output.
- Push authorisation for anything destructive.
- Pick between alternatives where there is no obviously-correct answer
  (e.g. minimal one-line fix vs full architectural refactor).
- Supply real manuscripts / real audio when needed for repro.

## 8. WHERE THINGS LIVE

```
~/Dev/StJohn-Author-Studio-4.0/
├── app/
│   ├── page.js                          ← Proof shell, navigation, audio
│   │                                      Contains the WRONG sectionAudioKey()
│   ├── phone/page.js                    ← Phone Script + Quill
│   ├── components/
│   │   ├── SessionsView.js              ← The "book detail + reader entry"
│   │   │                                  used by Proof AND Quill (mode prop).
│   │   │                                  Contains the RIGHT getSectionAudioKey()
│   │   │                                  AND the transcription writer.
│   │   ├── ProofingReader.js            ← The Proof reader (own reader, not shared)
│   │   ├── PrepManuscriptMode.js        ← Prep
│   │   ├── PrebuildMode.js              ← Duet
│   │   ├── QuillAndInkMode.js           ← Quill
│   │   ├── ChapterReader.js             ← SHARED reader (Quill uses it; Proof doesn't yet)
│   │   ├── AppDialog.js                 ← Shared modal primitive (Block 9)
│   │   └── ImportFlow.js                ← Shared .docx import flow
│   └── lib/                             ← Browser-side helpers
├── packages/
│   ├── cloud-sync/                      ← Supabase client + Proof/Quill sync
│   │   ├── proof-sync.js                ← Has Block 1 error throws
│   │   ├── quill-sync.js                ← Has Block 1 error throws
│   │   ├── path-safety.cjs              ← Block 3a — bundled into Electron
│   │   ├── cross-device-prune.js        ← Block 2 — shared by Proof+Quill
│   │   └── ...
│   ├── audio-engine/
│   │   ├── audition-time.js             ← Block 6 — Duet marker time
│   │   └── whisper-json.cjs             ← Whisper output parser (Electron-side)
│   ├── manuscript-engine/
│   │   ├── merge-dialogue-assignments.js ← Block 5 — Prep duplicate-line merge
│   │   └── ...
│   └── quill-engine/
│       ├── annotations.js               ← Includes idsForAnnotationBundle (Block 4)
│       └── exporters.js                 ← CSV + InDesign + DOCX exporters
├── main.js                              ← Electron main process
├── preload.js                           ← Electron bridge
├── electron-builder.yml                 ← Build config (path-safety.cjs IS bundled now)
├── tests/                               ← 81 tests
│   ├── prep-export.test.mjs             ← 4 tests cover Prep Word export
│   ├── quill-exporters.test.mjs         ← Quill InDesign/CSV/DOCX
│   ├── indesign-jsx-structure.test.mjs  ← 14 tests added this session
│   ├── cloud-sync-error-throws.test.mjs ← Block 1 regression
│   ├── path-boundary.test.mjs           ← Block 3a regression
│   ├── audition-time.test.mjs           ← Block 6 regression
│   ├── cross-device-prune.test.mjs      ← Block 2 regression
│   ├── prep-merge-assignments.test.mjs  ← Block 5 regression
│   └── quill-annotation-bundle.test.mjs ← Block 4 regression
├── docs/audits/                         ← All audit + bug log + roadmap docs
│   ├── STJOHN_NEXT_CHAPTER_BUG_AUDIT_PROMPT.md   ← THIS BUG
│   ├── STJOHN_FIX_PLAN_VERIFICATION_PROMPT.md    ← Block-roadmap audit prompt
│   ├── STJOHN_FIX_PLAN_VERIFICATION_REPORT.md    ← Block-roadmap audit results
│   ├── STJOHN_FIX_STRATEGY_QUEUE.md              ← 12-block fix roadmap
│   ├── SCRIPT_AND_SYNC_BUG_LOG.md                ← Live bug log
│   └── STJOHN_PROJECT_MONITOR_REPORT.md          ← Audit campaign log
├── scripts/
│   └── generate-prep-sample.mjs         ← Generates a sample Prep .docx
│                                          for visual inspection
└── Script and Sync Releases/            ← Packaged Mac .app + Windows .exe
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

# Generate a sample Prep export (writes to ~/Downloads)
cd ~/Dev/StJohn-Author-Studio-4.0 && node scripts/generate-prep-sample.mjs
```

---

This is a handover doc. If you're a fresh AI reading this: do NOT
edit app/page.js or app/components/SessionsView.js for the next-
chapter bug until Marie has the audit report and says go.
