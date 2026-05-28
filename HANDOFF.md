# HANDOFF - StJohn Author Studio 4.0

## Copy-Paste Bootstrap For Next Chat

```text
You are continuing work on StJohn Author Studio 4.0 for Marie Mackay.

Before touching code, read these files in this order:
1. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/HANDOFF.md
2. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/CLAUDE.md
3. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/TODO.md
4. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/BUILD_PLAN_V4.md
5. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/SHARED_COMPONENTS.md
6. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/INTERNAL_FUNCTION_TREE.md
7. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/FRONT_FUNCTION_TREE.md

Current top priority:
Verify the Drive snapshot backup system added 2026-05-27. Section 5.a of
this handover lists exactly what was built and which files. Before
asking Marie to test, run `npm test`, then build the packaged Mac app
(`npm run release:mac`) and open Settings → Drive snapshots → toggle
"On for this account" → click "Snapshot now". Confirm a new zip lands
in `~/Library/CloudStorage/GoogleDrive-mariemackaybooks@gmail.com/My
Drive/Game Dev/GitHub/App Backups/` and contains the local JSON saves
plus a `cloud/cloud-snapshot.json`.

Also outstanding from earlier sessions:
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

## 3. Files To Read First, With Exact Paths

Read these first:

1. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/HANDOFF.md`
2. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/CLAUDE.md`
3. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/TODO.md`
4. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/BUILD_PLAN_V4.md`
5. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/SHARED_COMPONENTS.md`
6. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/INTERNAL_FUNCTION_TREE.md`
7. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/FRONT_FUNCTION_TREE.md`
8. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/CLOUD_SCHEMA.md`

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

- `b47e742 auto-backup: before Claude edit 2026-05-27 02:34:24`

Working tree:

- Dirty. Many files are modified/untracked from the active fix work, plus
  the **Drive snapshot backups** system just added 2026-05-27 (see below).
- Do not reset or revert without Marie's explicit instruction.
- `.env.local` is deleted in git status, intentionally part of earlier tracked-env cleanup.

Latest verified tests:

- `npm test -- --test-reporter=spec` passed.
- Result: **13 tests passed**, 0 failed (gained 2 tests since previous handover).

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

- `npm run build` passed.
- This is a Next.js production build, not a fresh packaged Mac/Windows release.

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

1. **Verify the Prep Word repeat/context export fix.**

   This is top priority. Create or use a real-ish Prep export with repeated short dialogue, existing Word comments, side voices, curly/straight quotes, and text split by formatting if possible. Confirm the generated `.docx` opens cleanly in Word/LibreOffice and the side-voice comments land on the correct line.

2. **Improve/report Prep export uncertainty if needed.**

   If context cannot prove a repeated match, decide whether the app should silently use in-order fallback, warn Marie, or create an export log. Current behavior falls back to in-order so it does not become fragile.

3. **Re-check Quill/InDesign export with a real InDesign run if possible.**

   Static checks passed, but InDesign itself was not opened. Verify the real JSX applies highlight, image marker, full spread marker, emotion, custom emotion, character marker, and duplicate text correctly.

4. **Update TODO/docs so the project state is not confusing.**

   The project has stale audit/checklist docs. Put the latest export fixes and remaining checks in `TODO.md` or the relevant active docs so future AIs do not chase old issues.

5. **Continue packaging/release cleanup after export verification.**

   Once export verification is done, package the Mac app again if Marie needs a fresh build. Windows packaging can wait unless she asks.

## 7. What Only Marie Can Decide Or Do

- Marie must choose which real book/docx export matters most for final confidence.
- Marie must decide whether opening the generated Word export herself is enough, or whether another AI should inspect it visually too.
- Marie must decide whether uncertain repeated Prep matches should be skipped, warned, or allowed via in-order fallback.
- Marie must test real InDesign if the machine/app state requires her setup.
- Marie must decide when to package Mac/Windows for actual use.

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
