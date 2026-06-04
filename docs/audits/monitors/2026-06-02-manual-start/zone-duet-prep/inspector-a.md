# Inspector A - Zone 5 - Duet Prep

- Date: 2026-06-02
- Time: 2026-06-02 12:53:08 PDT
- Campaign: `2026-06-02-manual-start`
- Zone: `Duet Prep`
- Audit type: read-only static audit plus safe test/coverage check

## Scope

Checked whether Duet Prep is actually wired into the current desktop app, whether it can persist local projects, whether the import -> scan -> align -> export path exists in source, and whether any automated test coverage exists for Duet-specific behavior.

Did not launch Electron, did not attach or transcribe live audio, did not import a live manuscript, did not export marker files, and did not touch real `Save Data/`.

## Source docs checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `CLAUDE.md`
- `TODO.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands run

- `sed -n '1,220p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` -> exit `0`
- `sed -n '1,220p' docs/APP_STRUCTURE.md` -> exit `0`
- `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> exit `0`
- `rg -n "Duet Prep|duet|prebuild|marker|exportMarkersFolder|insert markers|detect markers" docs/FRONT_FUNCTION_TREE.md docs/INTERNAL_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/CLOUD_SAFETY_AUDIT.md docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md HANDOFF.md TODO.md` -> exit `0`
- `rg --files app/components tests scripts packages | rg 'PrebuildMode|prebuild|duet|marker'` -> exit `0`
- `sed -n '1,280p' app/components/PrebuildMode.js` -> exit `0`
- `sed -n '280,760p' app/components/PrebuildMode.js` -> exit `0`
- `sed -n '760,1320p' app/components/PrebuildMode.js` -> exit `0`
- `rg -n "readPrebuildData|writePrebuildData|exportMarkersFolder|prebuild-projects|marker" main.js preload.js app/page.js` -> exit `0`
- `npm test -- --test-reporter=spec tests/**/*.test.mjs` -> exit `0`
- `rg -n "scan|marker|exportMarkersFolder|writePrebuildData|readPrebuildData|openAudioDialog|whisper|saveStatus|alert\\(|window\\.confirm|console\\.warn|console\\.error|catch \\{|TODO|FIXME" app/components/PrebuildMode.js main.js preload.js` -> exit `0`
- `rg -n "PrebuildMode|exportMarkersFolder|duet|markers" tests scripts` -> exit `0`
- `rg -n "\\.scanned\\b|transcribed\\b|completed:" app/components/PrebuildMode.js` -> exit `0`
- `rg -n "scanned\\b" app/components/SessionsView.js app/components/BookDetail.js app/components/PrebuildMode.js app/page.js main.js tests` -> exit `0`
- `rg -n "PrebuildMode|duet-prep|mode=\\\"duet\\\"|appMode === 'duet'" app/page.js` -> exit `0`
- `date '+%Y-%m-%d %H:%M:%S %Z'` -> exit `0`
- `nl -ba app/page.js | sed -n '1528,1552p'` -> exit `0`
- `nl -ba app/components/PrebuildMode.js | sed -n '50,58p;296,302p;336,370p;766,805p;899,980p;1001,1038p;1129,1144p'` -> exit `0`
- `nl -ba main.js | sed -n '236,256p;1278,1292p;1457,1468p'` -> exit `0`
- `nl -ba preload.js | sed -n '1,40p'` -> exit `0`
- `nl -ba docs/FRONT_FUNCTION_TREE.md | sed -n '64,74p'` -> exit `0`
- `nl -ba docs/WIRING_MATRIX.md | sed -n '59,68p'` -> exit `0`

## Evidence paths

- `app/page.js:1543`
- `app/components/PrebuildMode.js:50-57`
- `app/components/PrebuildMode.js:336-370`
- `app/components/PrebuildMode.js:766-805`
- `app/components/PrebuildMode.js:899-980`
- `app/components/PrebuildMode.js:1001-1038`
- `app/components/PrebuildMode.js:1129-1144`
- `preload.js:9-10`
- `preload.js:21`
- `preload.js:26`
- `main.js:236-249`
- `main.js:1287-1291`
- `main.js:1457-1468`
- `docs/FRONT_FUNCTION_TREE.md:64-71`
- `docs/WIRING_MATRIX.md:59-66`

## Pass items

1. Duet Prep is mounted in the current desktop shell and is not a placeholder route.
   Evidence: `app/page.js:1543` mounts `PrebuildMode` for the Duet mode.

2. Duet has its own local persistence path and Electron bridge.
   Evidence: `app/components/PrebuildMode.js:50-57` loads and saves through `window.electron.readPrebuildData()` / `writePrebuildData()`. `preload.js:9-10` exposes those APIs. `main.js:236-249` and `main.js:1287-1291` define the dedicated `prebuild-projects.json` primary and mirror paths plus the IPC write handler.

3. The core Duet workflow exists in source: import manuscript, attach audio, transcribe, align, and build export rows from highlighted insertions.
   Evidence: `app/components/PrebuildMode.js:336-370` creates Duet projects from `ImportFlow`; `app/components/PrebuildMode.js:766-805` transcribes local audio and aligns it against manuscript words while skipping highlighted insertions; `app/components/PrebuildMode.js:899-980` builds per-chapter Audition marker files and sends them to `window.electron.exportMarkersFolder(...)`.

4. The Electron export handler exists for Duet marker-folder output.
   Evidence: `preload.js:26` exposes `exportMarkersFolder`, and `main.js:1457-1468` writes each generated marker file into the chosen export folder.

5. The full automated test suite passed in this run.
   Evidence: `npm test -- --test-reporter=spec tests/**/*.test.mjs` exited `0` with `13` passing tests and `0` failures.

## Fail items

1. `doc-drift`: Duet is still marked missing in the wiring matrix even though the front tree and current source show live Duet flows.
   Evidence: `docs/FRONT_FUNCTION_TREE.md:64-71` marks Duet import, detect/insert markers, edit marker, and export marker list as `REAL`, while `docs/WIRING_MATRIX.md:59-66` still labels the same Duet rows `MISSING`.
   Assessment: documentation failure, not a confirmed product failure.

## Watchlist items

1. Duet's shared book-detail completion fallback appears to read the wrong property after a successful scan.
   Evidence: `app/components/PrebuildMode.js:766-805` marks scanned chapters with `transcribed: true`, but `app/components/PrebuildMode.js:1140-1143` falls back to `!!ch.scanned` when setting the shared `completed` state.
   Assessment: strong code-traced logic mismatch; not navigation-tested live in this run.

2. Manuscript re-upload preserves audio and alignment by chapter position only, which can mis-attach old audio/transcription data if chapter order or split structure changes.
   Evidence: `app/components/PrebuildMode.js:1017-1030` explicitly matches new chapters to old chapters by index and then carries over `audioPath`, `whisperWords`, `whisperAlignment`, `whisperMatchQuality`, and `transcribed`.
   Assessment: code-traced workflow risk only; not reproduced live in this run.

3. No Duet-specific automated tests were found even though the feature has its own import/scan/export logic.
   Evidence: `rg -n "PrebuildMode|exportMarkersFolder|duet|markers" tests scripts` returned no Duet-focused tests, while the passing suite covered cloud, manuscript-engine, prep export, quill export, and whisper JSON only.
   Assessment: coverage gap, not a confirmed product bug.

## What was not tested

- No live Electron launch.
- No live `.docx` import through the Duet screen.
- No live audio attachment.
- No live Whisper transcription.
- No live marker export folder creation.
- No live manuscript re-upload.
- No real manuscript files or real audiobook files.
- No generated test manuscript/audio driven through the actual Duet UI.

## Possible duplicate bug references

- `SAS-AUD-20260602-001` for the broader doc-drift family; Duet is another clear case where `docs/WIRING_MATRIX.md` still disagrees with the current tree.
- `SAS-AUD-20260530-001` for the broader dev-mode mirror-save risk family if a later live Duet save test shows `prebuild-projects.json` touching the Documents mirror.

## Next checks

1. Safe isolated-home Electron run for Duet only, so manuscript import, audio attach, scan, and export can be tested without touching Marie's real save paths.
2. Live verification of these Duet flows: import highlighted manuscript, attach audio, scan one chapter, confirm insertion timestamps appear in the reader, export marker files, and inspect the output in a real editor.
3. Focused follow-up on the `transcribed` vs `scanned` completion-state mismatch and on re-upload behavior when a manuscript gains or loses split sections.
