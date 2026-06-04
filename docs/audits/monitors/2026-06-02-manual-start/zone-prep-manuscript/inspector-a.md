# Inspector A — Zone 4: Prep Manuscript

- Campaign: `2026-06-02-manual-start`
- Zone: `Prep Manuscript`
- Inspector: `A`
- Date: `2026-06-02`
- Result: `fail`
- Audit style: read-only static audit plus safe targeted test run

## Scope

Read-only inspection of the Prep Manuscript desktop flow: local project
persistence, manuscript import and dialogue scan wiring, safety/fix flow,
highlighted DOCX export, narrator CSV export, and page-number handoff paths.

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
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands run with exit codes

- `if [ -f "$CODEX_HOME/automations/stjohn-inspector-a/memory.md" ]; then sed -n '1,220p' "$CODEX_HOME/automations/stjohn-inspector-a/memory.md"; else echo '__NO_MEMORY__'; fi` → exit `0`
- `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` → exit `0`
- `sed -n '1,260p' docs/BUILD_PLAN_V4.md` → exit `0`
- `sed -n '1,260p' docs/APP_STRUCTURE.md` → exit `0`
- `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` → exit `0`
- `find docs/audits/monitors -maxdepth 3 -type f | sort` → exit `0`
- `cat -vet docs/audits/monitors/_run_state/inspector-a.lock.md` → exit `0`
- `sed -n '1,220p' 'READ ME FIRST - OPEN THIS.txt'` → exit `0`
- `sed -n '1,220p' HANDOFF.md` → exit `0`
- `sed -n '1,220p' CLAUDE.md && sed -n '1,220p' TODO.md` → exit `0`
- `sed -n '1,260p' docs/FRONT_FUNCTION_TREE.md` → exit `0`
- `sed -n '1,260p' docs/INTERNAL_FUNCTION_TREE.md` → exit `0`
- `sed -n '1,260p' docs/SHARED_COMPONENTS.md && sed -n '1,260p' docs/WIRING_MATRIX.md` → exit `0`
- `sed -n '1,260p' app/components/PrepManuscriptMode.js` → exit `0`
- `sed -n '260,620p' app/components/PrepManuscriptMode.js` → exit `0`
- `sed -n '620,980p' app/components/PrepManuscriptMode.js` → exit `0`
- `sed -n '980,1380p' app/components/PrepManuscriptMode.js` → exit `0`
- `sed -n '1,260p' app/components/prepExport.js` → exit `0`
- `sed -n '1,240p' app/components/ImportFlow.js` → exit `0`
- `sed -n '1,220p' packages/manuscript-engine/dialogue-detection/index.js && sed -n '1,220p' packages/manuscript-engine/dialogue-safety-check/index.js` → exit `0`
- `sed -n '1,260p' tests/prep-export.test.mjs` → exit `0`
- `sed -n '1,220p' tests/manuscript-engine.test.mjs` → exit `0`
- `rg -n "readPrepData|writePrepData|export|safety|dialogueSpans|narrator|onConfirm|ImportFlow|download" app/components/PrepManuscriptMode.js` → exit `0`
- `rg -n "pdfPageMap|pdfPaging|pageNumberAdjustment|extractManuscriptWordsFromHtml|buildSlimPageMap" app/components/PrepManuscriptMode.js app/components/prepExport.js app/components/ImportFlow.js` → exit `0`
- `rg -n "readPrepData|writePrepData|prep-manuscript-projects|write-prep|read-prep" preload.js main.js app -g '!node_modules'` → exit `0`
- `head -n 30 preload.js` → exit `0`
- `npm test -- --test-reporter=spec tests/prep-export.test.mjs tests/manuscript-engine.test.mjs` → exit `0`
- Read-only line-numbered evidence views via `nl -ba ... | sed -n ...` on `app/components/PrepManuscriptMode.js`, `app/components/ImportFlow.js`, `app/components/prepExport.js`, `tests/prep-export.test.mjs`, `tests/manuscript-engine.test.mjs`, `main.js`, and `preload.js` → exit `0`

Repeated drift-reset rereads of the source-of-truth, app structure, and bug log
also returned exit code `0`.

## Evidence paths

- `app/components/PrepManuscriptMode.js`
- `app/components/ImportFlow.js`
- `app/components/prepExport.js`
- `packages/manuscript-engine/dialogue-detection/index.js`
- `packages/manuscript-engine/dialogue-safety-check/index.js`
- `main.js`
- `preload.js`
- `tests/prep-export.test.mjs`
- `tests/manuscript-engine.test.mjs`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Pass items

1. Prep local persistence is real, with a dedicated renderer bridge and
   dedicated Electron read/write handlers for
   `prep-manuscript-projects.json`. Evidence:
   `app/components/PrepManuscriptMode.js:261-287`,
   `preload.js:11-12`, and `main.js:237,251-254,1294-1310`.

2. The core Prep workflow is wired as a real local feature: import commits
   projects into chapter/section state, runs dialogue detection, surfaces
   warning banners, and exposes an inline paragraph fix path that re-scans the
   section and stores manual edits for export replay. Evidence:
   `app/components/PrepManuscriptMode.js:309-384`,
   `1311-1360`, `1486-1520`, and
   `packages/manuscript-engine/dialogue-detection/index.js:248-293`.

3. Export wiring is real, not placeholder-only. The mode builds a full export
   payload for highlighted DOCX and both CSV variants, and the current test
   suite covers highlight insertion, side-voice comments, duplicate-occurrence
   anchoring, and split-run safety. Evidence:
   `app/components/PrepManuscriptMode.js:582-630`,
   `tests/prep-export.test.mjs:95-117`, `153-167`, `203-213`, and `250-255`.

4. The manuscript-engine tests that back Prep’s quote scanning passed in the
   same run. Evidence:
   `tests/manuscript-engine.test.mjs:12-38` and the passing `npm test ...`
   command, which completed with `13` passing tests and `0` failures.

## Fail items

1. The Prep “Fix” rescan path can mis-assign repeated dialogue lines because it
   preserves assignments by `sp.text` only. If the same quote appears twice in
   one section and Marie fixes a warning, the re-scan can apply the first
   prior assignment to later duplicate lines. Evidence:
   `app/components/PrepManuscriptMode.js:527-535`. The exporter tests show the
   codebase already needs occurrence-aware handling for duplicate dialogue in
   DOCX export (`tests/prep-export.test.mjs:120-167` and `170-213`), but the
   in-app rescan merge does not use that same care.
   Status note: code-traced fail; not live-reproduced.

## Watchlist items

1. Prep’s page-number handoff looks incomplete. `ImportFlow` builds a
   `pdfPageMap` and passes it to `onConfirm`
   (`app/components/ImportFlow.js:498-523`), but `commitImport` stores
   `pdfPaging`, `pdfFileName`, `pdfSource`, and `pageNumberAdjustment` without
   storing `payload.pdfPageMap`
   (`app/components/PrepManuscriptMode.js:330-347`). The later “Upload PDF”
   path then tries to rebuild the slim map from `ch?.html`, even though Prep
   chapter HTML is stored inside `sections[0].html`
   (`app/components/PrepManuscriptMode.js:311-323` and `948-955`).
   I did not find an exact live consumer in this file, so I am keeping this as
   a watchlist gap rather than a confirmed user-facing bug.

2. This zone still lacks direct automated coverage for persistence/restart
   behavior, the inline Fix/rescan merge path, and page-number handoff. The
   passing tests focus on export structure and quote-detection helpers, not
   on reload safety or warning-edit round trips.

3. No live Word, LibreOffice, or desktop app open-check was done in this run,
   so the current export confidence is structural rather than live visual.

## What was not tested

- No live Electron launch.
- No live manuscript import.
- No live save/restart/reload of a Prep project.
- No live PDF upload or page-number check.
- No live DOCX or CSV file opened in Word/LibreOffice/Excel.
- No real `Save Data/` mutation.
- No phone or cloud behavior, because Prep is local-only in the current plan.
- No packaged build check.

## Possible duplicate bug references

- No exact existing bug-log duplicate was found for the duplicate-dialogue
  reassignment risk in the Prep Fix/rescan path.
- No exact existing bug-log duplicate was found for the incomplete Prep
  `pdfPageMap` handoff path.
- Related environment blocker for any future live desktop verification:
  `SAS-AUD-20260530-001`.
- Related documentation drift family, not a direct Prep code duplicate:
  `SAS-AUD-20260602-001`.

## Next checks

1. In a safe isolated desktop audit run, reproduce the duplicate-dialogue case:
   import a chapter with two identical quotes, assign them differently, trigger
   the Prep Fix flow, save/rescan, and confirm whether the later duplicate
   keeps its assignment.
2. Add a targeted test around `updateSectionHtml` so duplicate dialogue text is
   preserved by occurrence, not just by text match.
3. In the same safe setup, verify whether initial Prep import and post-import
   PDF upload actually retain usable page anchors, or whether the `pdfPageMap`
   data is dropped as the static trace suggests.
4. Open a generated Prep `.docx` in real Word or LibreOffice and confirm the
   comment/highlight behavior still matches the passing OOXML-level tests.
