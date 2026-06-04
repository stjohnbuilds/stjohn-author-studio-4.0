# Inspector B - Zone 4 - Prep Manuscript

- Date: 2026-06-02
- Inspector: B
- Campaign: `2026-06-02-manual-start`
- Audit mode: read-only docs + source + safe tests only

## Scope

Prep Manuscript only:

- manuscript import flow and chapter shaping
- dialogue span detection and assignment paths
- safety-warning handling
- local save/load shape for prep projects
- highlighted DOCX and CSV export paths

This run did not launch Electron, open Microsoft Word/LibreOffice, or touch real Save Data.

## Source Docs Checked

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
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands Run

- `printf '%s\n' "$CODEX_HOME/automations/stjohn-inspector-b/memory.md" && if [ -f "$CODEX_HOME/automations/stjohn-inspector-b/memory.md" ]; then sed -n '1,220p' "$CODEX_HOME/automations/stjohn-inspector-b/memory.md"; fi` -> exit `0`
- `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` -> exit `0`
- `sed -n '1,260p' docs/BUILD_PLAN_V4.md` -> exit `0`
- `sed -n '1,260p' docs/APP_STRUCTURE.md` -> exit `0`
- `if [ -f docs/audits/monitors/_run_state/inspector-b.lock.md ]; then sed -n '1,220p' docs/audits/monitors/_run_state/inspector-b.lock.md; else echo '__MISSING__'; fi` -> exit `0`
- `find docs/audits/monitors -maxdepth 3 -type f \( -name 'inspector-a.md' -o -name 'inspector-b.md' -o -name 'inspector-c.md' -o -name 'checker.md' \) | sort` -> exit `0`
- `find docs/audits/monitors -maxdepth 2 -type d | sort` -> exit `0`
- `date '+%Y-%m-%d %H:%M:%S %Z'` -> exit `0`
- `sed -n '1,260p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> exit `0`
- `sed -n '1,220p' 'READ ME FIRST - OPEN THIS.txt'` -> exit `0`
- `sed -n '1,220p' HANDOFF.md` -> exit `0`
- `sed -n '1,220p' TODO.md` -> exit `0`
- `wc -c docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md && sed -n '1,160p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> exit `0`
- `sed -n '1,220p' CLAUDE.md` -> exit `0`
- `sed -n '1,220p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` -> exit `0`
- `git status --short` -> exit `0`
- `sed -n '1,220p' package.json` -> exit `0`
- `rg -n "Prep Manuscript|prep|prepExport|ImportFlow|dialogue|narrator chapter" docs/FRONT_FUNCTION_TREE.md docs/INTERNAL_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/CLOUD_SCHEMA.md docs/CLOUD_SAFETY_AUDIT.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md` -> exit `0`
- `nl -ba app/components/PrepManuscriptMode.js | sed -n '1,260p'` -> exit `0`
- `nl -ba app/components/prepExport.js | sed -n '1,260p'` -> exit `0`
- `rg -n "buildPrepCsv|buildPrepNarratorChapterCsv|buildPrepHighlightedDocxBlob|exportFileNames|downloadBlob|downloadText|spans\b|dialogueSpans\b|narratorOverride|sideVoiceId|characterId" app/components/PrepManuscriptMode.js app/components/prepExport.js tests/prep-export.test.mjs packages/manuscript-engine -g '!node_modules'` -> exit `0`
- `nl -ba app/components/ImportFlow.js | sed -n '1,260p'` -> exit `0`
- `nl -ba tests/prep-export.test.mjs | sed -n '1,260p'` -> exit `0`
- `nl -ba packages/manuscript-engine/index.js | sed -n '1,260p'` -> exit `0`
- `npm test -- --test-reporter=spec` -> exit `0`
- `rg -n "buildPrepCsv|buildPrepNarratorChapterCsv|buildPrepHighlightedDocxBlob|downloadBlob|downloadText|exportFileNames|sections\b|dialogueSpans\b|spans\b" app/components/PrepManuscriptMode.js app/components/prepExport.js tests/prep-export.test.mjs` -> exit `0`
- `nl -ba app/components/PrepManuscriptMode.js | sed -n '260,760p'` -> exit `0`
- `nl -ba docs/WIRING_MATRIX.md | sed -n '45,70p'
nl -ba docs/FRONT_FUNCTION_TREE.md | sed -n '50,68p'
nl -ba docs/INTERNAL_FUNCTION_TREE.md | sed -n '24,36p'` -> exit `0`
- `sed -n '1,260p' docs/audits/monitors/2026-06-02-manual-start/zone-proof-listen/inspector-b.md` -> exit `0`
- `if [ -d docs/audits/monitors/2026-06-02-manual-start/zone-prep-manuscript ]; then find docs/audits/monitors/2026-06-02-manual-start/zone-prep-manuscript -maxdepth 1 -type f | sort; else echo '__ZONE_DIR_MISSING__'; fi` -> exit `0`

## Evidence Paths

- `docs/WIRING_MATRIX.md:49-58`
- `docs/FRONT_FUNCTION_TREE.md:52-62`
- `docs/INTERNAL_FUNCTION_TREE.md:28-29`
- `app/components/ImportFlow.js:3-20,128-221,234-259`
- `app/components/PrepManuscriptMode.js:203-205,238-399,511-558,582-630`
- `app/components/prepExport.js:139-171`
- `tests/prep-export.test.mjs:54-256`
- `packages/manuscript-engine/index.js:1-7`

## Pass Items

1. Prep Manuscript has a real, current source path for import, dialogue scanning, assignment, safety data, and export wiring.
   Evidence: `docs/FRONT_FUNCTION_TREE.md:52-62` marks the user-facing Prep actions as real; `docs/INTERNAL_FUNCTION_TREE.md:28-29` maps the mode to `app/components/PrepManuscriptMode.js`; `app/components/ImportFlow.js:3-20,128-221,234-259` and `app/components/PrepManuscriptMode.js:238-399,582-630` show the import-to-project and export wiring.
   Evidence level: code-traced, not live-tested.

2. The current Prep project shape is internally consistent between the reader-facing section tree and the export helpers.
   Evidence: `app/components/PrepManuscriptMode.js:203-205` accepts section-based prep projects; `app/components/PrepManuscriptMode.js:582-630` keeps `sections` for the DOCX export while also flattening `spans` for the CSV helpers; `app/components/prepExport.js:139-171` consumes that flat CSV shape.
   Evidence level: code-traced, not live-tested.

3. Safe automated tests passed for the current Prep Word export path, including side-voice comments, duplicate dialogue targeting, and split-run safety.
   Evidence: `npm test -- --test-reporter=spec` exited `0` with 13 passing tests; targeted Prep coverage appears in `tests/prep-export.test.mjs:54-256`.
   Evidence level: test-backed.

## Fail Items

1. The Prep section of `docs/WIRING_MATRIX.md` still says the whole mode is missing even though other source docs and current code show a live implementation.
   Evidence: `docs/WIRING_MATRIX.md:49-58` marks Prep import, dialogue groups, assignment, safety panel, and highlighted DOCX export as `MISSING`; `docs/FRONT_FUNCTION_TREE.md:52-62` marks the same Prep controls as `REAL`; `app/components/PrepManuscriptMode.js:238-399,582-630` and `app/components/ImportFlow.js:128-221` show current implementation paths.
   Why this matters: the monitor docs can misroute later auditors and make real regressions harder to separate from stale documentation.
   Evidence level: confirmed documentation drift, not a reproduced runtime bug.

## Watchlist Items

1. I did not find direct automated coverage for the two Prep CSV exporters during this run.
   Evidence: `tests/prep-export.test.mjs:6` imports only `buildPrepHighlightedDocxBlob`; the targeted Prep tests at `tests/prep-export.test.mjs:54-256` cover DOCX behavior only; CSV helpers live at `app/components/prepExport.js:139-171`.
   Risk: the narrator-chapter CSV and full-dialogue CSV could drift without a test failure.
   Evidence level: confirmed coverage gap, not a reproduced runtime bug.

2. The current Prep export path is still missing a live file-open check in Microsoft Word or LibreOffice after export.
   Evidence: this run stayed read-only and did not open generated files; `HANDOFF.md` still calls out the real-app verification need for `app/components/prepExport.js`.
   Risk: a structurally valid export can still place comments or highlights wrong in real Word.
   Evidence level: unverified live behavior.

## What Was Not Tested

- No live Electron Prep run.
- No real `.docx` import through the app UI.
- No real local save/reload cycle.
- No live safety-panel interaction.
- No live highlighted DOCX export download/open.
- No live narrator chapter CSV export download/open.
- No Word or LibreOffice verification.

Reason: the run stayed behind the read-only wall and avoided any action that could touch real Save Data or require a live desktop export path.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` - same documentation-drift family; this Prep wiring mismatch appears to be part of that existing docs issue rather than a new bug family.

## Next Checks

1. Zone checker should compare this report with Inspector A and Inspector C once their Zone 4 Prep reports exist.
2. Run a future live Prep export audit only inside an isolated Electron home/data sandbox, then open the exported `.docx` in Word or LibreOffice and verify repeated short dialogue plus side-voice comments land on the correct lines.
3. Add direct tests for `buildPrepCsv()` and `buildPrepNarratorChapterCsv()` so Prep export coverage is not only on the DOCX path.
