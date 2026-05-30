# App Structure - StJohn Author Studio 4.0

Source goals checked before writing this file:

- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`

Template note: `.codex/templates/APP_STRUCTURE.md` was not present in this
repo. This file was created from the existing source-goal and structure docs.

## Product Shape

StJohn Author Studio 4.0 started from Script and Sync 3.0. The goal is one
desktop app plus one phone companion, with four desktop modes:

- Proof Listen
- Prep Manuscript
- Duet Prep
- Quill & Ink

The key architecture goal is shared systems: one reader direction, one audio
engine, one manuscript engine, and one cloud-sync path. Audio files must stay
local. Supabase is for small text and metadata only.

## Do Not Treat These As Source

These folders are generated output, packaged releases, dependencies, or user
data. Audit them only when the specific task is release/package/save-data
verification.

- `node_modules/`
- `.next/`
- `out/`
- `dist/`
- `Script and Sync Releases/`
- `Save Data/`

The real user-facing packaged app lives in `Script and Sync Releases/`. Do not
tell users to open builds from `dist/`.

## Main Source Areas

| Path | Role |
|---|---|
| `app/page.js` | Desktop shell, mode switcher, auth, cloud orchestration, settings, project lists. |
| `app/phone/page.js` | Phone companion for Script flags and Quill annotations. |
| `main.js` | Electron main process, local files, save folders, exports, audio paths, Whisper subprocess, backup snapshots. |
| `preload.js` | Electron bridge exposed as `window.electron`. |
| `app/components/` | Desktop UI components and mode screens. |
| `app/lib/` | Browser-side manuscript, PDF, transcription, and alignment helpers. |
| `app/phone/_components/` | Phone reader UI. |
| `app/phone/_lib/` | Phone audio library, project cache, reader settings. |
| `packages/audio-engine/` | Audio helpers and Whisper JSON parsing. |
| `packages/backups/` | Drive snapshot orchestration. |
| `packages/cloud-sync/` | Supabase client, Proof sync, Quill sync, audio stripping, tombstones, offline flag queue. |
| `packages/manuscript-engine/` | Word import, dialogue detection, dialogue safety checks, text normalization. |
| `packages/quill-engine/` | Quill annotations, selection, CSV export, InDesign JSX export. |
| `scripts/` | Build, release, guardrail, sandbox, and diagnostic helpers. |
| `tests/` | Node test suite for cloud, exports, manuscript, and Whisper JSON helpers. |

## Desktop Modes

### Proof Listen

Primary files:

- `app/page.js`
- `app/components/ManuscriptSetup.js`
- `app/components/SessionsView.js`
- `app/components/ProofingReader.js`
- `app/lib/fuzzyMatcher.js`
- `app/lib/manuscriptPaging.js`
- `app/lib/pdfPaging.js`
- `packages/cloud-sync/proof-sync.js`

Major user flows:

- Create a book.
- Import a `.docx` manuscript.
- Map character and narrator names.
- Save the book locally.
- Attach audio to chapters or sections.
- Transcribe audio with local Whisper.
- Open the proofing reader.
- Play audio, change speed, and follow word sync.
- Add, edit, delete, and export flags.
- Rescan page maps from DOCX or PDF.
- Export backup JSON or transfer bundles.

### Prep Manuscript

Primary files:

- `app/components/PrepManuscriptMode.js`
- `app/components/ImportFlow.js`
- `app/components/prepExport.js`
- `packages/manuscript-engine/dialogue-detection/index.js`
- `packages/manuscript-engine/dialogue-safety-check/index.js`

Major user flows:

- Import manuscript.
- Detect dialogue groups.
- Assign main and side characters.
- Use the safety panel.
- Export highlighted DOCX.
- Export narrator chapter list.

Prep is local-only in the current plan.

### Duet Prep

Primary files:

- `app/components/PrebuildMode.js`
- `app/components/ImportFlow.js`
- `main.js` export marker handlers

Major user flows:

- Import manuscript.
- Detect or insert duet markers.
- Edit marker data.
- Export marker lists/folders.

Duet is local-only in the current plan.

### Quill & Ink

Primary files:

- `app/components/QuillAndInkMode.js`
- `app/components/BookDetail.js`
- `app/components/ChapterReader.js`
- `packages/quill-engine/`
- `packages/cloud-sync/quill-sync.js`

Major user flows:

- Import manuscript.
- Open chapter reader.
- Select words or ranges.
- Add, edit, and delete annotations.
- Use class, option, character, timestamp, and note fields.
- Export annotations to CSV.
- Export InDesign JSX.
- Sync annotation metadata to Supabase.

## Phone Companion

Primary files:

- `app/phone/page.js`
- `app/phone/_components/PhoneReader.js`
- `app/phone/_components/PhoneReaderSettings.js`
- `app/phone/_components/renderReaderContent.js`
- `app/phone/_lib/audioLibrary.js`
- `app/phone/_lib/projectCache.js`
- `app/phone/_lib/readerSettings.js`

Phone modes:

- Script mode: sign in, load Proof projects, pick local phone audio, add flags,
  edit/delete where implemented, export CSV.
- Quill mode: load Quill projects, pick local phone audio, select text, add
  annotations, export CSV.

Phone must not upload audio files. It should only sync text and metadata.

## Local Save Files

The app stores local data in `Save Data/`. Important JSON files include:

- `books.json`
- `prebuild-projects.json`
- `prep-manuscript-projects.json`
- `quill-projects.json`

Manuscript source files live under `Save Data/Manuscript Sources/`.

Audits must protect this folder. Do not delete, move, or overwrite Marie's
real saved data.

## Electron Bridge

The bridge is defined in `preload.js` and handled in `main.js`.

Major bridge groups:

- Local read/write: `readData`, `writeData`, `readPrepData`,
  `writePrepData`, `readQuillData`, `writeQuillProject`
- Save folder: `getDataLocation`, `chooseDataLocation`
- Audio: `openAudioDialog`, `getAudioUrl`, `readAudioFile`
- Exports/imports: `exportBackup`, `importBackup`, `exportCsv`,
  `exportMarkersFolder`, `exportTransferBundle`, `importTransferBundle`
- Page maps: `convertDocxToPdf`, `convertDocxToPageMap`,
  `extractPdfPaging`, `rescanBookPdf`, `rescanBookPageMap`
- Whisper: `whisperGetInfo`, `whisperSetArch`, `whisperTranscribe`,
  `whisperCancel`
- Drive snapshots: `makeBackupSnapshot`, `getBackupInfo`, `pruneBackups`

## Cloud Shape

Supabase sync is owned by `packages/cloud-sync/`.

Proof tables:

- `script_sync_projects`
- `script_sync_section_transcriptions`
- `script_sync_flags`

Quill tables:

- `quill_projects`
- `quill_chapters`
- `quill_annotations`

Prep and Duet do not have cloud tables in the current plan.

## Audit Rule

When auditing external behavior, use these docs together:

- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

Before each audit step, re-check the source goals and this structure map.
After each step, update the audit report with what was actually verified and
what remains uncertain.
