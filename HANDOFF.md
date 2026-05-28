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
Deep-check the Prep Manuscript Word-with-comments export fix that was just patched in /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/app/components/prepExport.js.

Specific thing to verify:
When the same dialogue text appears more than once, the exporter should use nearby plain-text context only for repeated matches, so a side-character Word comment lands on the correct assigned line. Unique dialogue text should keep using the normal simpler path. The fix must not make Word export fragile around quotes, Word XML, or text split across runs.

Do not tell Marie this is fully safe until you have checked the generated .docx structure and, ideally, opened a real exported file in Microsoft Word or LibreOffice.

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

- Dirty. Many files are modified/untracked from the active fix work.
- Do not reset or revert without Marie's explicit instruction.
- `.env.local` is deleted in git status, intentionally part of earlier tracked-env cleanup.

Latest verified tests:

- `npm test -- --test-reporter=spec` passed.
- Result: 11 tests passed, 0 failed.

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
