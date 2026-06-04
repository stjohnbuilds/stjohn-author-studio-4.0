# Inspector B - Zone 5 - Duet Prep

- Date: 2026-06-02 12:55:08 PDT
- Campaign: `2026-06-02-manual-start`
- Zone: `duet-prep`
- Audit type: read-only static audit

## Scope

Checked the Duet Prep desktop mode against the current source tree and source docs:

- shared manuscript import path
- Duet project save/load path
- scan/alignment state flow
- shared book-detail adapter
- marker export folder flow
- Duet-specific doc drift and test coverage

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands Run With Exit Codes

1. Exit `0`
   `rg -n "Duet Prep|Prebuild|duet|marker|markers" docs/FRONT_FUNCTION_TREE.md docs/INTERNAL_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
2. Exit `0`
   `rg --files app/components tests packages | rg "PrebuildMode|marker|duet|prebuild|timestamp|export"`
3. Exit `0`
   `rg -n "exportMarkersFolder|marker|duet|prebuild|read-prebuild|write-prebuild|prebuild-projects|ImportFlow" preload.js main.js app/components/PrebuildMode.js tests`
4. Exit `0`
   `wc -l app/components/PrebuildMode.js && nl -ba app/components/PrebuildMode.js | sed -n '1,260p'`
5. Exit `0`
   `nl -ba app/components/PrebuildMode.js | sed -n '260,620p'`
6. Exit `0`
   `nl -ba app/components/PrebuildMode.js | sed -n '620,1045p'`
7. Exit `0`
   `nl -ba app/components/PrebuildMode.js | sed -n '1045,1260p'`
8. Exit `0`
   `nl -ba main.js | sed -n '1448,1505p'`
9. Exit `0`
   `rg -n "\\.scanned\\b|transcribed\\b|completed\\b" app/components/PrebuildMode.js app/components/SessionsView.js`
10. Exit `0`
    `node --test tests/quill-exporters.test.mjs`
11. Exit `1`
    `rg -n "ch\\.scanned|transcribed: true|completed: typeof ch\\.completed|Duet.*completed|Duet.*scanned|marker.*reupload|reupload.*chapter|position \\(primary\\)" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start`

## Evidence Paths

- `app/components/PrebuildMode.js:328-372` - Duet import path builds and saves project state from `ImportFlow`
- `app/components/PrebuildMode.js:766-804` - scan path writes `whisperWords`, `whisperAlignment`, `whisperMatchQuality`, and `transcribed: true`
- `app/components/PrebuildMode.js:899-991` - marker export builder and Electron handoff
- `app/components/PrebuildMode.js:1129-1143` - shared book-detail adapter computes section completion state
- `app/components/PrebuildMode.js:1001-1038` - manuscript re-upload keeps prior chapter data by position
- `preload.js:9-10,26` - Duet preload bridge for save/load and marker export
- `main.js:1268-1290` - Duet save/load handlers
- `main.js:1457-1469` - marker folder export handler
- `app/components/SessionsView.js:519,605,646,675,2826,3098-3100` - shared detail UI consumes `completed`

## Pass Items

1. Duet import and persistence are wired end-to-end in source. `ImportFlow` feeds `PrebuildMode`, and the mode saves through `window.electron.readPrebuildData` / `writePrebuildData` to `prebuild-projects.json`, with a browser-local fallback when Electron is absent.
2. Duet scan state is stored in a coherent shape. The chapter scan path writes transcript words, alignment, match quality, and `transcribed: true`, which gives the mode a stable base for later export and review.
3. Marker export has a complete static path. The renderer builds one sanitized chapter file per marker set and the Electron main process creates the chosen folder and writes each file.

## Fail Items

1. Code-traced implementation bug: scanned Duet chapters can still show as incomplete in the shared book-detail UI. The Duet adapter falls back to `!!ch.scanned` for `completed`, but the scan path writes `transcribed: true` and never sets `scanned`. Result: auto-complete from a finished scan will not survive the adapter unless Marie manually toggles the done state.
   - Evidence:
     - `app/components/PrebuildMode.js:796-801`
     - `app/components/PrebuildMode.js:1140-1143`
     - `app/components/SessionsView.js:519,2826,3098-3100`
   - Confidence: high, code-traced only, not live-reproduced in this run.

2. Zone-specific doc drift remains present for Duet. `docs/FRONT_FUNCTION_TREE.md` says the Duet controls are real, while `docs/WIRING_MATRIX.md` still marks the Duet rows missing.
   - Evidence:
     - `docs/FRONT_FUNCTION_TREE.md:64-71`
     - `docs/WIRING_MATRIX.md:59-66`
   - Confidence: high, docs-only mismatch.

## Watchlist Items

1. Code-traced risk: Duet manuscript re-upload preserves audio and scan data by chapter position only. If a corrected manuscript inserts, removes, or reorders split scenes, saved audio/alignment can move onto the wrong chapter entry.
   - Evidence:
     - `app/components/PrebuildMode.js:1017-1030`
   - Confidence: medium, not live-reproduced in this run.

2. Coverage gap: no Duet-specific automated test file was found in `tests/`. The only test run in this zone was `tests/quill-exporters.test.mjs`, which passed but does not exercise Duet import, scan, or marker export behavior.

## What Was Not Tested

- no live Electron navigation
- no real `.docx` import
- no real audio attach or Whisper scan
- no live marker folder export dialog
- no generated marker files opened in Audition
- no real save-data writes inspected
- no merge/unmerge flows exercised live

## Possible Duplicate Bug References

- Duet doc drift likely belongs to the existing doc-drift family already logged as `SAS-AUD-20260602-003`.
- No matching duplicate was found in the current bug log, monitor report, or existing zone outputs for the `transcribed` vs `scanned` completion-state bug.
- No matching duplicate was found for the positional re-upload risk.

## Next Checks

1. Live-test one Duet project with a highlighted manuscript and chapter audio, then confirm a freshly scanned chapter shows complete in the shared detail view before any manual checkbox toggle.
2. Export a real marker folder and open at least one generated chapter file to confirm file naming, delimiter format, and description payload match engineer expectations.
3. Re-upload a corrected manuscript that adds or shifts a split scene near the front of the book and verify audio/alignment stays attached to the intended chapter.
