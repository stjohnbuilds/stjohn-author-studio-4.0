# Inspector C - Zone 3 - Proof Listen

## Scope

Read-only audit of the Proof Listen desktop flow in the current source tree.
This run covered source docs, Proof Listen source paths, safe grep/snippet
inspection, and a targeted safe test run. No product code was edited. No real
Save Data was touched. No live Electron or real-file workflow was run in this
zone.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `CLAUDE.md`
- `TODO.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands Run With Exit Codes

- `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` -> exit `0`
- `sed -n '1,220p' docs/BUILD_PLAN_V4.md` -> exit `0`
- `sed -n '1,220p' docs/APP_STRUCTURE.md` -> exit `0`
- `sed -n '1,260p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> exit `0`
- `sed -n '1,220p' docs/audits/monitors/_run_state/inspector-c.lock.md` -> exit `0`
- `rg --files docs/audits/monitors | sort` -> exit `0`
- `rg -n "Proof Listen|ProofingReader|ManuscriptSetup|SessionsView|script_sync|flag|transcribe|Whisper" ...` -> exit `2` because `README.md` does not exist in this repo; remaining target files still returned usable matches
- `sed -n '1,220p' package.json` -> exit `0`
- `sed -n '1,260p' app/components/ManuscriptSetup.js` -> exit `0`
- `sed -n '1,260p' app/components/SessionsView.js` -> exit `0`
- `sed -n '1,260p' app/components/ProofingReader.js` -> exit `0`
- `rg --files tests | sort` -> exit `0`
- `rg -n "proof|flag|whisper|page map|pdf|transcrib|alignment|csv|queue" tests app/components/ProofingReader.js app/components/SessionsView.js app/components/ManuscriptSetup.js app/lib/fuzzyMatcher.js app/lib/manuscriptPaging.js app/lib/pdfPaging.js packages/cloud-sync/proof-sync.js packages/cloud-sync/flag-queue.js main.js preload.js` -> exit `0`
- `npm test -- --test-name-pattern='proof|flag|whisper|page|pdf|cloud|csv'` -> exit `0`
- `nl -ba app/components/ProofingReader.js | sed -n '780,1035p'` -> exit `0`
- `nl -ba app/components/ProofingReader.js | sed -n '1060,1110p'` -> exit `0`
- `nl -ba app/components/SessionsView.js | sed -n '2920,3185p'` -> exit `0`
- `nl -ba packages/cloud-sync/proof-sync.js | sed -n '1,320p'` -> exit `0`
- `rg -n "upsertProofFlag|deleteProofFlag|recordPendingFlag|retryFlagQueue|pushProofProject|onSaveFlags|saveFlag|delete flag|flag queue" app/components/SessionsView.js app/page.js packages/cloud-sync/proof-sync.js packages/cloud-sync/flag-queue.js` -> exit `0`
- `nl -ba app/page.js | sed -n '1120,1198p'` -> exit `0`
- `nl -ba packages/cloud-sync/flag-queue.js | sed -n '140,245p'` -> exit `0`
- `nl -ba tests/cloud-slim.test.mjs | sed -n '1,240p'` -> exit `0`
- `rg -n "CSV|Should say|Should Say|sentPlain|flag export|export flags" TODO.md docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` -> exit `0`
- `nl -ba app/components/SessionsView.js | sed -n '372,398p'` -> exit `0`
- `nl -ba app/components/ProofingReader.js | sed -n '1088,1096p'` -> exit `0`
- `nl -ba app/components/ProofingReader.js | sed -n '1288,1338p'` -> exit `0`
- `rg -n "Quote|Should say|quote|note" app/components/ProofingReader.js | sed -n '1,40p'` -> exit `0`
- `nl -ba docs/FRONT_FUNCTION_TREE.md | sed -n '29,54p'` -> exit `0`
- `nl -ba app/page.js | sed -n '640,670p'` -> exit `0`
- `nl -ba tests/whisper-json.test.mjs | sed -n '1,220p'` -> exit `0`

## Evidence Paths

- `app/components/ProofingReader.js:872-883`
- `app/components/ProofingReader.js:1091-1095`
- `app/components/ProofingReader.js:1292-1333`
- `app/components/ProofingReader.js:1424-1425`
- `app/components/SessionsView.js:384-387`
- `app/page.js:645-661`
- `app/page.js:1135-1186`
- `packages/cloud-sync/proof-sync.js:295-332`
- `packages/cloud-sync/flag-queue.js:141-239`
- `docs/FRONT_FUNCTION_TREE.md:34-50`
- `tests/cloud-slim.test.mjs:1-55`
- `tests/whisper-json.test.mjs:1-47`

## Pass Items

- Desktop Proof flag saves and deletes are wired through stable per-flag ids,
  local retry queue storage, and single-row cloud helpers instead of relying
  only on a later full-book push. Evidence: `app/page.js:1135-1186`,
  `packages/cloud-sync/flag-queue.js:141-239`,
  `packages/cloud-sync/proof-sync.js:295-332`.
- Proof page lookup now uses PDF quote search first, then falls back to the
  slim map and DOCX page map, and shows a hard warning when the page still
  cannot be resolved. Evidence: `app/components/ProofingReader.js:814-869`,
  `app/components/ProofingReader.js:1300-1307`.
- Targeted safe tests passed for cloud slimming and Whisper JSON parsing, which
  supports parts of the Proof flow but does not cover the reader/export UI.
  Evidence: `npm test -- --test-name-pattern='proof|flag|whisper|page|pdf|cloud|csv'`
  exit `0`, `tests/cloud-slim.test.mjs:1-55`,
  `tests/whisper-json.test.mjs:1-47`.

## Fail Items

- Proof CSV exports currently swap the last two columns. Both section export
  and reader export label columns as `Note` then `Should Say`, but write
  `sentPlain`/quote first and `note` second. The reader's Sheets preview uses
  the same mismatched order, so the wrong column mapping is visible before
  export too. Evidence: `app/components/SessionsView.js:384-387`,
  `app/components/ProofingReader.js:872-883`,
  `app/components/ProofingReader.js:1091-1095`,
  `app/components/ProofingReader.js:1292-1333`,
  `app/components/ProofingReader.js:1424-1425`.

## Watchlist Items

- Proof export and reader flows have no dedicated automated tests in
  `tests/`; the current safe run passed, but it did not exercise
  `ProofingReader.js`, `SessionsView.js`, or CSV column ordering. That gap is
  likely why the export-column mismatch slipped through. Evidence:
  `rg --files tests | sort` returned only five test files, and the targeted
  test run covered cloud helpers, manuscript, prep export, quill exporters,
  and Whisper parsing only.
- Some in-source comments around desktop Proof flag behavior still describe the
  older full-book push path even though the live wiring now uses single-row
  queue writes. I did not treat this as a product bug for Zone 3, but it is a
  comment-drift risk that can mislead later audits. Evidence:
  `app/components/SessionsView.js:986-989` versus `app/page.js:1135-1186`.

## What Was Not Tested

- No live Electron launch in this zone.
- No real manuscript import, real audio attach, or real Whisper transcription.
- No Supabase-authenticated push/pull against a live account.
- No CSV file was opened in Excel/Numbers/Sheets after export.
- No restart/reopen persistence check for the Proof reader.

## Possible Duplicate Bug References

- No matching existing bug-log entry was found for the swapped Proof CSV
  columns.
- The stale desktop-flag-flow comments appear related to the broader
  documentation/comment drift family already tracked as
  `SAS-AUD-20260602-001`, but this run did not add or change that log.

## Next Checks

- Run an isolated-home Electron audit for Proof Listen and export CSV from both
  the book-detail button and the in-reader button, then open the files to
  confirm the visible column swap.
- Add targeted automated coverage for Proof CSV row/header ordering and the
  reader Sheets preview row order.
- If the export bug is fixed later, verify both export entry points because the
  same mismatch exists in two files today.
