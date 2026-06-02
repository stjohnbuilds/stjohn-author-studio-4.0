# HANDOFF - StJohn Author Studio 4.0

## Copy-Paste Bootstrap For Next Chat

```text
You are continuing work on StJohn Author Studio 4.0 for Marie Mackay.

Before touching code, read these files in this order:
1. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/HANDOFF.md
2. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/CLAUDE.md
3. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/TODO.md
4. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md
5. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md
6. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md
7. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/BUILD_PLAN_V4.md
8. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/APP_STRUCTURE.md
9. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/SHARED_COMPONENTS.md
10. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/INTERNAL_FUNCTION_TREE.md
11. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/FRONT_FUNCTION_TREE.md

Current top priority:
Keep the read-only project monitor on track. The active automation is
`stjohn-read-only-project-health-monitor`, scheduled every 4 hours for
12 total runs. Every monitor run must start from
`docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, complete one audit
zone, update the monitor report, dedupe the bug log, and list the next
safest zone.

Also outstanding from earlier sessions:
- Drive snapshot backup system still needs packaged Mac verification.
- Prep Word repeat/context export fix (`app/components/prepExport.js`) —
  open the generated `.docx` in real Microsoft Word/LibreOffice and
  confirm side-voice comments land on the correct line.
- Phone Quill edit/delete annotations (Marie requested 2026-05-27, not
  yet built).
- Add Prep to cloud as `prep_projects` table (Marie requested
  2026-05-27, not yet built).

Marie is not a coder. Explain in simple terms. Be direct, calm, and specific.
```

## 1. Who Marie Is And How To Talk To Her

Marie is a non-coder author building this app for her audiobook proofing, manuscript prep, Quill annotation, special-edition print, and phone-companion workflow.

She is exhausted from repeated regressions. Keep replies short, plain, and concrete. Say what was checked, what changed, what remains uncertain, and what she should test next.

Do not use coder jargon unless necessary. Avoid long explanations by default. If something is risky, say so plainly.

Never self-certify. Tests passing is useful, but the app is only truly confirmed when Marie or the next AI checks the real user flow.

## 2. Hard Rules That The Next AI Must Follow

- Read `CLAUDE.md`, `TODO.md`, and the source-goal docs before changing code.
- Use existing app structures. Do not create duplicate readers, book-detail pages, pickers, modals, or exporters.
- Do not wipe, rename, move, delete, or reset Marie's saved data.
- Do not revert other uncommitted work unless Marie explicitly asks.
- Audio files and PDF files must not upload to Supabase.
- Phone cannot rely on Mac local paths.
- Page numbers, flags, annotations, timestamps, Word comments, and InDesign annotations are critical output data.
- If changing an export, test the generated file structure, not only the button.
- After code edits, run `npm test -- --test-reporter=spec`.
- If the app build surface changed, run `npm run build`.
- If packaging is needed, ask or run the existing release commands.
- Keep `HANDOFF.md` as the single handover file. Do not create dated copies unless Marie asks.
- For monitor/audit work, product code is read-only. Only audit docs, monitor
  reports, generated evidence, and organized bug-log entries may be written.
- Monitor agents must re-anchor to
  `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` before every audit zone,
  after 30 minutes, after every 3 heavy actions/reports, before bug-log edits,
  and before live/cloud/export/real-file tests.

## 3. Files To Read First, With Exact Paths

Read these first:

1. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/HANDOFF.md`
2. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/CLAUDE.md`
3. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/TODO.md`
4. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
5. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
6. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
7. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/audits/STJOHN_MONITOR_LOGIC_REVIEW.md`
8. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/BUILD_PLAN_V4.md`
9. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/APP_STRUCTURE.md`
10. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/SHARED_COMPONENTS.md`
11. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/INTERNAL_FUNCTION_TREE.md`
12. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/FRONT_FUNCTION_TREE.md`
13. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/CLOUD_SCHEMA.md`
14. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/audits/OTHER_APP_PROJECT_MONITOR_PROMPT.md`

For the current top issue, inspect:

- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/app/components/prepExport.js`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/tests/prep-export.test.mjs`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/app/components/PrepManuscriptMode.js`
- `/Users/mariemackay/Documents/StJohn Author Studio/Save Data/prep-manuscript-projects.json`

For Quill/InDesign export context comparison:

- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/packages/quill-engine/exporters.js`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/tests/quill-exporters.test.mjs`

## 4. Broad Vision Of The App

StJohn Author Studio 4.0 is one desktop app plus one phone companion.

Desktop modes:

- **Proof Listen:** listen to audiobook audio against the manuscript, add flags, export CSV/engineer markers.
- **Prep Manuscript:** assign dialogue to characters/narrators, export highlighted Word doc with side-voice comments and narrator files.
- **Duet Prep:** support multi-cast/duet prep and marker generation.
- **Quill & Ink:** annotate manuscript for special-edition design, export CSV and InDesign JSX.

Phone modes:

- **Script phone:** load cloud project, pick local phone audio, add proof flags.
- **Quill phone:** load cloud Quill project, pick local phone audio, add annotations.

Cloud goal:

- Supabase stores small text/metadata only: projects, chapters, flags, annotations, alignment/transcription metadata.
- Audio/PDF bytes and local Mac paths must stay local.

## 5. Current State, Latest Commit, Test Status, Build Status, Live URL

Latest local commit:

- `1e96a97`

Working tree:

- Dirty. Do not reset or revert without Marie's explicit instruction.
- At the time of this handover update, `git status --short` showed
  `REVIEW_PROMPT_phone-fixes.md` modified before the monitor prompt edits.
  After the monitor/handover update, docs listed in this section are also
  modified/untracked. Do not reset or revert without Marie's explicit
  instruction.
- `.env.local` was not rechecked in this handover update.

Latest verified tests:

- `npm test -- --test-reporter=spec` passed in the monitor setup pass.
- Result: **13 tests passed**, 0 failed.
- `node scripts/cloud-safety-test.mjs` passed 6/6 tombstone/cache checks.
- `npm run guardrails:check:all` completed without errors.

Latest monitor state:

- Created source-of-truth anchor:
  `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`.
- Created web-informed logic review:
  `docs/audits/STJOHN_MONITOR_LOGIC_REVIEW.md`.
- Strengthened reusable other-app prompt:
  `docs/audits/OTHER_APP_PROJECT_MONITOR_PROMPT.md`.
- Recurring automation:
  `stjohn-read-only-project-health-monitor`, every 4 hours, 12 runs total.
- Fix roadmap planner:
  `stjohn-fix-roadmap-planner`, every 30 minutes, 24 checks total. It may only
  update `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md` with numbered roadmap
  items like `1.1`, `1.2`, `2.1`. It may offer code logic or snippets inside
  the roadmap doc, but it must not edit app code.
- Current endpoint: each run completes one audit zone; campaign ends after
  12 runs or once all zones have reports and P0/P1/blockers are queued.

## 5.a. New since previous handover — Drive snapshot backups

Marie 2026-05-27 confirmed she's on the **Supabase Pro plan** ($25
USD/mo) and may downgrade to Free since her DB is 28 MB of 500 MB and
her real backup is the local Save Data folder. To make Free-tier
downgrade safe she asked for in-app weekly-ish snapshots into Drive.
Built per her spec:

- **Trigger:** first app-open per local day. Skips if not opened.
- **Per-user opt-in:** Settings → "Drive snapshots" card → toggle
  "On for this account". Stored in localStorage per Supabase user id,
  so husband signing in on the same Mac does NOT trigger backups for
  his account.
- **Path:** `My Drive/Game Dev/GitHub/App Backups/<ISO-timestamp>.zip`
  (auto-resolves via existing `getGoogleDriveCandidates` in main.js).
- **Skip-silently-if-no-Drive:** no local fallback. Settings card shows
  "⚠ Google Drive not detected on this Mac. Backups paused." otherwise.
- **Contents:** all four local JSON saves (books, prebuild, prep,
  quill) PLUS a cloud snapshot built from `pullProofProjects` +
  `pullQuillProjects`. Zipped with jszip (DEFLATE level 6).
- **Retention:** keep newest 25, drop oldest. Caller passes
  `keepCount: MAX_SNAPSHOTS` from `packages/backups/index.js`.
- **Manual button:** "Snapshot now" in the same Settings card.
- **Toast:** "✓ Backup saved to Drive" fades after 2.4 s on success.

Files added / changed:

- `main.js` — IPC handlers `backup-make-snapshot`, `backup-get-info`,
  `backup-prune` near the file end.
- `preload.js` — exposes `makeBackupSnapshot`, `getBackupInfo`,
  `pruneBackups` on `window.electron`.
- `packages/backups/index.js` — orchestrator. Exports
  `isBackupEnabledForUser`, `setBackupEnabledForUser`,
  `needsSnapshotToday`, `runDailySnapshotIfDue`, `takeSnapshotNow`,
  `getBackupInfo`, `MAX_SNAPSHOTS`.
- `app/page.js` — adds backup state, daily-snapshot effect tied to
  sign-in, manual snapshot handler, and a `DriveSnapshotsCard`
  component rendered inside `SettingsCog` for every mode.

To port this to **Typing and Tomes** and **Script and Sync 3.0** in
their own Claude sessions: copy the three core files
(`main.js` IPC block, `preload.js` additions, `packages/backups/`)
and the small page.js wiring + Settings card. The orchestrator's
`buildCloudSnapshot` should swap to whichever cloud-sync pulls those
apps use.

Not yet verified live in the packaged Electron app — needs a
`npm run release:mac` rebuild and Marie's hands. Tests still pass
(13/13). The browser preview confirmed the existing Settings panel
still renders cleanly; the new card only appears in Electron + signed
in, which the preview can't exercise.

Latest verified build:

- Previous handover said `npm run build` passed.
- This handover update did not rerun `npm run build`.
- No fresh packaged Mac/Windows release was built in this handover update.

Known live URL:

- Prior known Vercel URL: `https://stjohn-author-studio-4.vercel.app/`
- Phone route: `https://stjohn-author-studio-4.vercel.app/phone`
- These URLs were not re-verified in this handover turn.

Current important export work:

- Quill/InDesign export was deep-checked with generated and real local Quill save data.
- Real Quill save data had 11 annotations; exporter generated 11 CSV rows and 11 InDesign annotation entries.
- Fake yellow/gold test style was not present in the real Quill export path.
- Added `tests/quill-exporters.test.mjs`.
- Prep Word-with-comments export had real bugs and was patched:
  - existing Word comments are now preserved;
  - new comments use safe next IDs;
  - repeated short dialogue no longer gets comments applied to every copy;
  - repeated dialogue now gets a nearby plain-text context check, but only when repeated matches exist.
- Added `tests/prep-export.test.mjs`.
- Real `Anarchy` Prep data was checked by generating `.docx` in memory and inspecting the zip/XML:
  - output comments: 3;
  - comment starts: 3;
  - comment ends: 3;
  - comment references: 3;
  - narrator breakdown present.
- The export has not yet been opened visually in Microsoft Word.

## 6. Top 5 Next Jobs In Priority Order

1. **Let the read-only monitor complete its 12-run pass.**

   Each run should start from `STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, complete one
   audit zone, update the monitor report, and dedupe the bug log. Do not let
   monitor agents fix code.

2. **Give the monitor safe real-file test inputs if Marie wants stronger proof.**

   Marie can provide manuscript/audio links. The monitor must copy them into a
   dated audit artifact folder, write a manifest, test only the copy, and never
   upload audio.

3. **Review the fix roadmap before starting any code fixes.**

   The roadmap lives at `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md`. It should
   show numbered items like `1.1`, `1.2`, `2.1`, with likely files, strategy
   options, suggested code logic if useful, edge cases, and Marie approval
   needed.

4. **Verify the Prep Word repeat/context export fix.**

   This is still important. Create or use a real-ish Prep export with repeated short dialogue, existing Word comments, side voices, curly/straight quotes, and text split by formatting if possible. Confirm the generated `.docx` opens cleanly in Word/LibreOffice and the side-voice comments land on the correct line.

5. **Improve/report Prep export uncertainty if needed.**

   If context cannot prove a repeated match, decide whether the app should silently use in-order fallback, warn Marie, or create an export log. Current behavior falls back to in-order so it does not become fragile.


## 7. What Only Marie Can Decide Or Do

- Marie must choose which real book/docx export matters most for final confidence.
- Marie must decide whether opening the generated Word export herself is enough, or whether another AI should inspect it visually too.
- Marie must decide whether uncertain repeated Prep matches should be skipped, warned, or allowed via in-order fallback.
- Marie must test real InDesign if the machine/app state requires her setup.
- Marie must decide when to package Mac/Windows for actual use.
- Marie must decide whether to provide real manuscript/audio links for the
  read-only monitor and which book is safe to use.
- Marie must decide when the 12-run monitor campaign is enough and whether to
  switch from audit mode to fix mode.

## 8. Where Things Live And The Commands She Actually Uses

Project root:

```bash
cd "/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
```

Start app in dev:

```bash
npm start
```

Run tests:

```bash
npm test -- --test-reporter=spec
```

Run cloud safety checks:

```bash
node scripts/cloud-safety-test.mjs
```

Run guardrails:

```bash
npm run guardrails:check:all
```

Monitor source of truth:

```txt
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md
```

Fix roadmap:

```txt
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md
```

Paste-ready prompt for another app monitor:

```txt
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/audits/OTHER_APP_PROJECT_MONITOR_PROMPT.md
```

Run production build:

```bash
npm run build
```

Build Mac release:

```bash
npm run release:mac
```

Build Windows release:

```bash
npm run release:win
```

Packaged app folder:

```text
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Script and Sync Releases/
```

Important local data:

```text
/Users/mariemackay/Documents/StJohn Author Studio/Save Data/prep-manuscript-projects.json
/Users/mariemackay/Documents/StJohn Author Studio/Save Data/quill-projects.json
/Users/mariemackay/Documents/StJohn Author Studio/Save Data/books.json
```

Also present inside project folder:

```text
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Save Data/
```

Main export files:

```text
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/app/components/prepExport.js
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/packages/quill-engine/exporters.js
```

Export tests:

```text
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/tests/prep-export.test.mjs
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/tests/quill-exporters.test.mjs
```
