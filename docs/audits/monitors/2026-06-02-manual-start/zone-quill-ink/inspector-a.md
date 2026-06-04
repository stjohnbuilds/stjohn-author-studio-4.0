# Inspector A - Zone 6 - Quill & Ink

## Scope

- Static read-only audit of desktop Quill & Ink.
- Focused on import-to-reader flow, annotation add/edit/delete behavior, export paths, cloud sync shape, and test coverage.
- No Electron launch, no Supabase login, no phone run, no real manuscript/audio, no Save Data writes.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands Run With Exit Codes

- `sed -n '1,220p' docs/BUILD_PLAN_V4.md` -> exit `0`
- `sed -n '1,220p' docs/APP_STRUCTURE.md` -> exit `0`
- `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> exit `0`
- `sed -n '1,220p' docs/audits/monitors/_run_state/inspector-a.lock.md` -> exit `0`
- `rg --files docs/audits/monitors` -> exit `0`
- `rg -n "Quill|quill|annotation|InDesign|CSV" docs/FRONT_FUNCTION_TREE.md docs/INTERNAL_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/CLOUD_SCHEMA.md docs/CLOUD_SAFETY_AUDIT.md` -> exit `0`
- `rg --files app/components packages/quill-engine packages/cloud-sync tests | rg "QuillAndInkMode|BookDetail|ChapterReader|quill|annotation|csv|indesign"` -> exit `0`
- `rg -n "readQuillData|writeQuillProject|quill" preload.js main.js app/page.js` -> exit `0`
- `nl -ba app/components/QuillAndInkMode.js | sed -n '260,380p'` -> exit `0`
- `nl -ba app/components/QuillAndInkMode.js | sed -n '480,610p'` -> exit `0`
- `nl -ba app/components/QuillAndInkMode.js | sed -n '640,760p'` -> exit `0`
- `nl -ba app/components/QuillAndInkMode.js | sed -n '1388,1565p'` -> exit `0`
- `nl -ba app/components/QuillAndInkMode.js | sed -n '1888,1995p'` -> exit `0`
- `nl -ba app/components/BookDetail.js | sed -n '1,220p'` -> exit `0`
- `nl -ba app/components/ChapterReader.js | sed -n '1,420p'` -> exit `0`
- `nl -ba packages/cloud-sync/quill-sync.js | sed -n '1,360p'` -> exit `0`
- `nl -ba packages/cloud-sync/cloud-slim.js | sed -n '1,260p'` -> exit `0`
- `nl -ba packages/quill-engine/annotations.js | sed -n '1,260p'` -> exit `0`
- `nl -ba packages/quill-engine/exporters.js | sed -n '1,320p'` -> exit `0`
- `nl -ba tests/quill-exporters.test.mjs | sed -n '1,280p'` -> exit `0`
- `nl -ba tests/cloud-slim.test.mjs | sed -n '1,240p'` -> exit `0`
- `node --test tests/quill-exporters.test.mjs` -> exit `0`
- `node --test tests/cloud-slim.test.mjs` -> exit `0`

## Evidence Paths

- `app/components/QuillAndInkMode.js`
- `app/components/BookDetail.js`
- `app/components/ChapterReader.js`
- `packages/quill-engine/annotations.js`
- `packages/quill-engine/exporters.js`
- `packages/cloud-sync/quill-sync.js`
- `packages/cloud-sync/cloud-slim.js`
- `tests/quill-exporters.test.mjs`
- `tests/cloud-slim.test.mjs`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

## Pass

### Pass 1 - Quill desktop has a real local import -> reader -> export -> sync code path

- `app/page.js:1578-1582` routes the shell into Quill mode.
- `app/components/QuillAndInkMode.js:755-760` uses `ImportFlow` for manuscript import.
- `app/components/QuillAndInkMode.js:999-1013` exposes Word, CSV, InDesign, zip, and raw JSON backup exports from the book detail view.
- `app/components/QuillAndInkMode.js:1183-1990` implements the chapter reader, drag selection, popover editing, annotation dock, audio-follow UI, and delete actions.
- `packages/cloud-sync/quill-sync.js:27-157` and `159-285` implement Quill push/pull against `quill_projects`, `quill_chapters`, and `quill_annotations`.
- This supports `docs/APP_STRUCTURE.md`, `docs/CLOUD_SCHEMA.md`, and `docs/CLOUD_SAFETY_AUDIT.md` claims that Quill desktop exists as a real mode and syncs metadata only, not audio paths.

### Pass 2 - Quill export and cloud-slim tests exist and passed in this run

- `tests/quill-exporters.test.mjs:39-109` covers CSV and InDesign export payload shape across highlight, image, emotion, and character annotations.
- `tests/cloud-slim.test.mjs:6-54` covers Quill cloud slimming, including stripping audio paths while preserving `completed` and transcription metadata.
- Both tests passed in this run via `node --test tests/quill-exporters.test.mjs` and `node --test tests/cloud-slim.test.mjs`.

## Fail

### Fail 1 - Deleting a Quill annotation from the edit popover can leave same-range character markers behind

- Severity: `P2`
- Confidence: source-confirmed, not live-tested
- Expected result: When the popover loads an existing annotation plus the character markers attached to the same word range, the popover delete action should clear that whole grouped annotation state or otherwise avoid leaving orphaned same-range character markers behind.
- Actual result: `openExistingAnnotation()` preloads all same-range character markers into the editor state, and `saveAnnotation()` explicitly removes and rebuilds those markers on resave, but `deleteEditingAnnotation()` deletes only `editingAnnotationId`. Any same-range character markers remain in `project.annotations`.
- Evidence:
  - `app/components/QuillAndInkMode.js:1448-1464` loads same-range character markers into `characterIds` for the current edit session.
  - `app/components/QuillAndInkMode.js:1484-1541` treats those markers as part of the same edited selection by dropping and recreating them on save.
  - `app/components/QuillAndInkMode.js:1545-1550` deletes only the single edited annotation id, not the same-range marker companions.
  - `packages/quill-engine/annotations.js:121-153` shows character markers are stored as ordinary annotations with their own ids, so they will persist unless explicitly removed.
- Why this is not tester confusion: The editor itself groups same-range character markers into the current edit session, but the delete path does not mirror the save path's grouped cleanup.

## Watchlist

### Watchlist 1 - Quill docs disagree on whether the desktop Quill buttons are real or still missing

- `docs/FRONT_FUNCTION_TREE.md:73-82` marks Quill import, annotation list, add/edit/delete, and InDesign export as `REAL`.
- `docs/WIRING_MATRIX.md:68-75` still labels the same Quill desktop rows as `MISSING` and phase-placeholder wiring.
- This looks like doc drift, not a fresh product failure by itself.

### Watchlist 2 - Quill has source and exporter/cloud-slim tests, but no dedicated tests for reader editing or cloud merge/delete behavior

- The only Quill-specific test file found was `tests/quill-exporters.test.mjs`.
- The only adjacent cloud test found was `tests/cloud-slim.test.mjs`.
- I found no dedicated automated coverage for `deleteEditingAnnotation()`, `mergeProjectLists()`, tombstone-based delete behavior, or reader edit interactions.

## What Was Not Tested

- No live Electron desktop session.
- No actual `.docx` import run.
- No real or generated audio attachment/transcription run.
- No Supabase sign-in, push, pull, or delete against a live backend.
- No phone Quill check.
- No generated CSV, DOCX, JSX, or zip file was opened after export because exports were not run live in this read-only zone.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` may already cover the Quill doc-drift mismatch between `docs/FRONT_FUNCTION_TREE.md` and `docs/WIRING_MATRIX.md`.
- I did not find an existing logged item for the Quill popover-delete / orphaned-character-marker behavior.

## Next Checks

- Run a safe isolated live Quill session and verify whether deleting an edited annotation leaves same-range character markers visible in the bottom annotation dock and in export output.
- Compare this report with Inspector B and Inspector C to see whether they also treat the Quill delete path as a grouped-delete bug or only a UX ambiguity.
- In a later cloud-safe audit zone, test Quill desktop delete, tombstone pull, and same-range annotation sync behavior against Supabase with isolated data only.
