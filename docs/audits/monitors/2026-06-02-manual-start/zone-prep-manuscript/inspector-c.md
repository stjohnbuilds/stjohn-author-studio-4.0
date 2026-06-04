# Inspector C - Zone 4 Prep Manuscript

- Role: Inspector C
- Date: 2026-06-02 19:15 UTC
- Scope: Read-only Zone 4 only. Static source/doc audit plus safe automated tests for Prep Manuscript helpers. No product code edits. No Electron launch. No Save Data touched.
- Output ownership: This file only. Lock file only.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `date -u +"%Y-%m-%dT%H:%M:%SZ"` | 0 |
| `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| `sed -n '1,260p' docs/BUILD_PLAN_V4.md` | 0 |
| `sed -n '1,260p' docs/APP_STRUCTURE.md` | 0 |
| `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `find docs/audits/monitors -maxdepth 3 -type f | sort` | 0 |
| `find docs/audits/monitors -maxdepth 2 -type d | sort` | 0 |
| `rg -n "Prep Manuscript|prep manuscript|prep-manuscript" docs/FRONT_FUNCTION_TREE.md docs/INTERNAL_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/CLOUD_SCHEMA.md docs/CLOUD_SAFETY_AUDIT.md` | 0 |
| `sed -n '1,260p' app/components/PrepManuscriptMode.js` | 0 |
| `sed -n '1,260p' app/components/ImportFlow.js` | 0 |
| `sed -n '1,260p' app/components/prepExport.js` | 0 |
| `sed -n '1,260p' packages/manuscript-engine/dialogue-detection/index.js` | 0 |
| `sed -n '1,260p' packages/manuscript-engine/dialogue-safety-check/index.js` | 0 |
| `sed -n '45,95p' docs/FRONT_FUNCTION_TREE.md` | 0 |
| `sed -n '20,95p' docs/INTERNAL_FUNCTION_TREE.md` | 0 |
| `sed -n '1,140p' docs/SHARED_COMPONENTS.md` | 0 |
| `sed -n '45,90p' docs/WIRING_MATRIX.md` | 0 |
| `rg -n "readPrepData|writePrepData|prep-manuscript-projects|buildPrep|Narrator" app/components/PrepManuscriptMode.js main.js preload.js tests packages -g '!node_modules'` | 0 |
| `rg --files tests packages app/components | rg "prep|manuscript|dialogue"` | 0 |
| `npm test -- --runInBand tests/prep-export.test.mjs tests/manuscript-engine.test.mjs` | 0 |
| `nl -ba docs/WIRING_MATRIX.md | sed -n '49,60p'` | 0 |
| `nl -ba docs/FRONT_FUNCTION_TREE.md | sed -n '48,84p'` | 0 |
| `nl -ba docs/INTERNAL_FUNCTION_TREE.md | sed -n '24,38p'` | 0 |
| `nl -ba app/components/PrepManuscriptMode.js | sed -n '258,314p'` | 0 |
| `nl -ba app/components/PrepManuscriptMode.js | sed -n '585,636p'` | 0 |
| `nl -ba main.js | sed -n '237,260p'` | 0 |
| `nl -ba main.js | sed -n '1290,1322p'` | 0 |
| `nl -ba tests/prep-export.test.mjs | sed -n '1,280p'` | 0 |
| `nl -ba tests/manuscript-engine.test.mjs | sed -n '1,220p'` | 0 |

Notes:

- The `npm test -- --runInBand ...` command went through the repo `test` script, so Node ran the current `tests/**/*.test.mjs` suite. The Prep export and manuscript-engine checks were included and passed.
- No Electron, browser, cloud, or real-file commands were run in this zone because of the read-only wall and the existing save-path safety blocker.

## Evidence Paths

- Zone docs: `docs/APP_STRUCTURE.md`, `docs/FRONT_FUNCTION_TREE.md`, `docs/INTERNAL_FUNCTION_TREE.md`, `docs/SHARED_COMPONENTS.md`, `docs/WIRING_MATRIX.md`
- Prep mode renderer: `app/components/PrepManuscriptMode.js`
- Shared manuscript import flow: `app/components/ImportFlow.js`
- Prep export helpers: `app/components/prepExport.js`
- Prep persistence bridge: `preload.js`, `main.js`
- Manuscript engine: `packages/manuscript-engine/dialogue-detection/index.js`, `packages/manuscript-engine/dialogue-safety-check/index.js`
- Automated checks: `tests/prep-export.test.mjs`, `tests/manuscript-engine.test.mjs`

## Pass Items

### PASS - Prep Manuscript is a real current mode, not a placeholder

The current source tree shows a real Prep Manuscript flow with local project hydration, debounced local save, chapter-level import commit, dialogue scanning, character and side-voice assignment, safety handling, and three export actions. This matches the high-level source docs in `docs/APP_STRUCTURE.md` and `docs/FRONT_FUNCTION_TREE.md`.

Key receipts:

- `docs/FRONT_FUNCTION_TREE.md:52-62` marks import, dialogue groups, assignment, safety, and export actions as `REAL`.
- `app/components/PrepManuscriptMode.js:258-314` hydrates from `window.electron.readPrepData()`, autosaves with `writePrepData()`, and commits imported chapters into Prep project state.
- `app/components/PrepManuscriptMode.js:585-630` builds the export payload and exposes highlighted DOCX, full dialogue CSV, and narrator chapter CSV actions.
- `preload.js:11-12` and `main.js:1294-1309` expose and handle the Prep read/write IPC path.

### PASS - Prep export and dialogue-engine checks passed in automated coverage

The tested Prep helpers passed without failures in this run. That gives real evidence for the export layer and the manuscript dialogue parser, even though it does not prove the full renderer flow.

Key receipts:

- `npm test -- --runInBand tests/prep-export.test.mjs tests/manuscript-engine.test.mjs` exited `0`.
- Test output reported `13` passing tests and `0` failures.
- `tests/prep-export.test.mjs:54-256` covers highlighted DOCX export, narrator breakdown insertion, duplicate dialogue anchoring, preserved comments, and split-run safety behavior.
- `tests/manuscript-engine.test.mjs:12-38` covers straight quotes, curly quotes, HTML-wrapped dialogue, and quote-mark collection.

## Fail Items

### FAIL - Prep Manuscript rows in the wiring matrix are stale and contradict current source

`docs/WIRING_MATRIX.md` still says the Prep Manuscript section is "Phase 6 — empty rows for now" and marks every listed Prep control as `MISSING`. That conflicts with the current tree docs and the live source files for the mode.

Key receipts:

- `docs/WIRING_MATRIX.md:49-57` marks Import, Dialogue groups list, Assign character, Safety panel, and Export highlighted DOCX as `MISSING`.
- `docs/FRONT_FUNCTION_TREE.md:52-62` marks the same Prep controls as `REAL`.
- `app/components/PrepManuscriptMode.js` contains the current import, assignment, safety, and export logic.

This looks like the same doc-drift family as `SAS-AUD-20260602-001`.

## Watchlist Items

### WATCHLIST - Prep likely shares the same dev-mode mirror-save risk as the existing audit blocker

I did not run Electron because the repo already has a confirmed audit-safety blocker for dev-mode mirror writes. The Prep-specific IPC path shows the same mirror pattern: read from the mirror if primary is absent, and write to both primary and mirror on save. That makes live Prep testing unsafe unless the run is isolated from Marie's real Documents path.

Key receipts:

- `main.js:251-254` defines `prepMirrorDataPath()` under `app.getPath('documents')` in dev mode.
- `main.js:1294-1309` reads from the mirror when needed and writes to both `prepDataPath()` and `prepMirrorDataPath()`.

This is not confirmed as a new live bug in this run because it was not reproduced. Treat it as a likely duplicate or root-cause sibling of `SAS-AUD-20260530-001`.

### WATCHLIST - Renderer and IPC coverage is still thin compared with helper coverage

I found solid tests for the export helper and the manuscript dialogue engine, but no direct automated coverage for the Prep renderer, replace-manuscript flow, or the Prep IPC round-trip itself.

Key receipts:

- `rg --files tests packages app/components | rg "prep|manuscript|dialogue"` returned `tests/prep-export.test.mjs` and `tests/manuscript-engine.test.mjs`, but no dedicated test file for `app/components/PrepManuscriptMode.js`, `app/components/ImportFlow.js`, or the Prep IPC handlers.
- The core UI logic still lives in the large mode file `app/components/PrepManuscriptMode.js`.

That means chapter navigation, autosave timing, replace-and-rescan behavior, and safety-panel interactions are still mostly code-traced here, not proven end-to-end.

### WATCHLIST - Internal tree docs still point at old helper paths around the same mode family

This did not block the zone audit, but the structure docs still point at top-level `lib/` helper paths even though `docs/APP_STRUCTURE.md` and the current repo use `app/lib/`. That adds extra confusion when tracing Prep dependencies like page mapping and import helpers.

Key receipts:

- `docs/INTERNAL_FUNCTION_TREE.md:32-35` lists `lib/transcriptionWorker.js`, `lib/manuscriptPaging.js`, `lib/pdfPaging.js`, and `lib/fuzzyMatcher.js`.
- `docs/APP_STRUCTURE.md` shows those browser helpers under `app/lib/`.

This also fits the broader `SAS-AUD-20260602-001` doc-drift family.

## What Was Not Tested

- No Electron app launch.
- No browser or visual UI run.
- No real `.docx` import in a live session.
- No live save/reload round-trip for `prep-manuscript-projects.json`.
- No live export download/open check.
- No manual paragraph-fix flow inside the safety tooling.
- No packaged build or release artifact test.
- No Supabase/cloud behavior, because Prep is local-only in the current plan.

## Possible Duplicate Bug References

- Likely duplicate / expansion: `SAS-AUD-20260602-001 - App tree docs disagree about current mode status`
- Related environment blocker: `SAS-AUD-20260530-001 - Electron dev run mirrors audit data into Documents`

No bug-log files were edited by Inspector C.

## Next Checks

- Checker should compare this with Inspectors A and B and decide whether the Prep-specific wiring-matrix mismatch stays under `SAS-AUD-20260602-001` or deserves a smaller zone-specific doc-drift note.
- Any later live Prep audit should launch with isolated `HOME=/tmp/...` first, then verify import -> save -> reload -> export without touching Marie's real Documents or Save Data paths.
- A later safe test pass should add focused coverage for `PrepManuscriptMode.js`, `ImportFlow.js`, and the `read-prep-data` / `write-prep-data` IPC path.
