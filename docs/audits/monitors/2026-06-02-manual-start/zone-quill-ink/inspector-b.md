# Inspector B - Zone 6 - Quill & Ink

## Scope

- Static read-only audit of the desktop Quill & Ink zone for campaign `2026-06-02-manual-start`.
- Focus: source-goal drift, Quill annotation flows, export paths, cloud/privacy boundaries, and current automated coverage.
- No product-code edits. No Save Data writes. No live Electron run.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

## Commands Run With Exit Codes

- `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` -> `0`
- `sed -n '1,260p' docs/BUILD_PLAN_V4.md` -> `0`
- `sed -n '1,260p' docs/APP_STRUCTURE.md` -> `0`
- `sed -n '1,260p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> `0`
- `find docs/audits/monitors -path '*/inspector-b.md' | sort` -> `0`
- `rg -n "Quill|Quill & Ink|quill" docs/FRONT_FUNCTION_TREE.md docs/INTERNAL_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/CLOUD_SCHEMA.md docs/CLOUD_SAFETY_AUDIT.md` -> `0`
- `sed -n '73,120p' docs/FRONT_FUNCTION_TREE.md` -> `0`
- `sed -n '20,60p' docs/SHARED_COMPONENTS.md` -> `0`
- `sed -n '68,100p' docs/WIRING_MATRIX.md` -> `0`
- `sed -n '52,145p' docs/CLOUD_SCHEMA.md` -> `0`
- `rg -n "export|annotation|pushQuillProject|pullQuillProjects|deleteQuillProject|readQuillData|writeQuillProject|content_hash|completed|selectedText|timestamp|audio" app/components/QuillAndInkMode.js app/components/BookDetail.js app/components/ChapterReader.js app/phone/page.js packages/cloud-sync/quill-sync.js packages/quill-engine tests` -> `0`
- `rg -n "TODO|FIXME|MISSING|not implemented|coming soon|alert\\(|confirm\\(|buildAnnotationsCsv|buildInDesignJsx|buildAnnotationsDocxBlob|pushQuillProject|pullQuillProjects|deleteQuillProject|writeQuillProject|readQuillData|annotationOptions|completed|timestamp|selectedText" app/components/QuillAndInkMode.js packages/cloud-sync/quill-sync.js packages/quill-engine/exporters.js app/components/ChapterReader.js` -> `0`
- `sed -n '1,620p' app/components/QuillAndInkMode.js` -> `0`
- `sed -n '1,340p' packages/cloud-sync/quill-sync.js` -> `0`
- `sed -n '1,120p' packages/quill-engine/exporters.js` -> `0`
- `sed -n '493,720p' packages/quill-engine/exporters.js` -> `0`
- `sed -n '1,260p' packages/quill-engine/annotations.js` -> `0`
- `sed -n '1,220p' tests/quill-exporters.test.mjs` -> `0`
- `sed -n '1,220p' tests/cloud-slim.test.mjs` -> `0`
- `npm test -- --runInBand tests/quill-exporters.test.mjs tests/cloud-slim.test.mjs` -> `0`
- `rg -n "character marker|markerOnly|Delete annotation|orphan|same range|Quill.*delete|annotation delete|character.*delete" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start` -> `0`

## Evidence Paths

- `docs/FRONT_FUNCTION_TREE.md:73-108`
- `docs/SHARED_COMPONENTS.md:23-33`
- `docs/WIRING_MATRIX.md:68-96`
- `docs/CLOUD_SCHEMA.md:52-138`
- `app/components/QuillAndInkMode.js:1456-1558`
- `app/components/QuillAndInkMode.js:1966-1982`
- `packages/quill-engine/annotations.js:4-8`
- `packages/quill-engine/annotations.js:121-152`
- `packages/cloud-sync/quill-sync.js:27-156`
- `packages/quill-engine/exporters.js:11-29`
- `packages/quill-engine/exporters.js:606-679`
- `tests/quill-exporters.test.mjs:39-109`
- `tests/cloud-slim.test.mjs:6-44`

## Pass Items

1. Quill desktop implementation paths are present and coherent across the current app map. `docs/APP_STRUCTURE.md` points to `app/components/QuillAndInkMode.js`, `BookDetail.js`, `ChapterReader.js`, `packages/quill-engine/`, and `packages/cloud-sync/quill-sync.js`, and those source files do contain the documented import, reader, annotation, export, and cloud hooks.
2. Quill cloud privacy boundaries remain aligned with the source goals in this static read. `packages/cloud-sync/quill-sync.js:27-156` sends Quill data through `stripAudioPaths`, and `tests/cloud-slim.test.mjs:6-44` passed, confirming audio paths are stripped while chapter `completed` and Quill transcription metadata survive the slim/pull path.
3. Current automated Quill export coverage passed in this run. `npm test -- --runInBand tests/quill-exporters.test.mjs tests/cloud-slim.test.mjs` exited `0`, and `tests/quill-exporters.test.mjs:39-109` still covers CSV/InDesign export content for highlight, image, emotion, and character annotation categories.

## Fail Items

1. `doc-drift`: the Quill desktop rows are still marked `MISSING` in `docs/WIRING_MATRIX.md:68-75`, while `docs/FRONT_FUNCTION_TREE.md:73-82` marks the same Quill flows `REAL`, and the current source tree contains live Quill mode files. Possible duplicate bug reference: `SAS-AUD-20260602-001`.

## Watchlist Items

1. Code-traced risk, not live-confirmed: deleting a main Quill annotation appears to leave attached character markers behind. The editor treats characters as parallel same-range annotations during edit/save (`app/components/QuillAndInkMode.js:1456-1464`, `1477-1541`; `packages/quill-engine/annotations.js:40-45`, `121-152`), but both delete paths remove only the clicked annotation id (`app/components/QuillAndInkMode.js:1545-1558`, `1966-1982`). Expected user impact if confirmed live: a delete can leave stale character markers in the project, exports, or cloud payload.
2. Coverage gap: this run found no automated test for grouped annotation delete behavior or for the Quill Word export path `buildAnnotationsDocxBlob()` / `buildAnnotationsDocxParts()` in `packages/quill-engine/exporters.js:606-679`. Current Quill export tests only cover CSV/InDesign payloads in `tests/quill-exporters.test.mjs:39-109`.

## What Was Not Tested

- No Electron UI launch.
- No live Quill import flow with generated or real files.
- No live CSV, JSX, ZIP, or DOCX export opened after generation.
- No Supabase sign-in, push, pull, or delete against a real account.
- No phone Quill workflow.
- No real Save Data reads or writes.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` for the Quill wiring/doc drift family.
- Possible parallel-campaign duplicate for the grouped-delete watchlist: `docs/audits/monitors/2026-06-02-manual-start/zone-quill-ink/inspector-c.md`. This Inspector B watchlist item was derived from an independent source read before the duplicate search step.

## Next Checks

1. In a safe isolated Electron run, create one Quill annotation with attached character markers, then delete it from both the popover and the bottom chip strip and confirm whether any character markers remain.
2. If the grouped-delete behavior reproduces live, compare the leftover state in the chapter reader, CSV export, Word export, and Quill cloud payload.
3. Add focused automated coverage for grouped delete and the Word export path when the task switches from audit to repair.
