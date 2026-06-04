# Inspector B - Zone 7 - Phone Script

- Date: 2026-06-02
- Inspector: B
- Campaign: `2026-06-02-manual-start`
- Audit mode: read-only docs + source + safe tests only

## Scope

Phone Script only:

- phone sign-in and cached project list behavior
- Proof project pull / refresh / pending queue handling on phone
- local-audio-only boundary for phone Proof
- phone flag save / delete / CSV export paths
- phone-related doc drift and current safe test coverage

This run did not launch Electron, did not sign into Supabase, and did not touch
real Save Data.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
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
- `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` -> `0`
- `sed -n '1,240p' docs/BUILD_PLAN_V4.md` -> `0`
- `sed -n '1,240p' docs/APP_STRUCTURE.md` -> `0`
- `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> `0`
- `rg -n "Phone Script|PhoneReader|phone|flag|script mode|projectCache|readerSettings|audioLibrary|offline" docs/FRONT_FUNCTION_TREE.md docs/INTERNAL_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/CLOUD_SCHEMA.md docs/CLOUD_SAFETY_AUDIT.md` -> `0`
- `rg -n "buildFlagsCsv|exportCsv|script_sync_flags|pushProofProject|pullProofProjects|offline|PhoneReader|PhoneReaderSettings|renderReaderContent|projectCache|audioLibrary|readerSettings|pickAudio" app/phone/page.js app/phone/_components app/phone/_lib packages/cloud-sync tests` -> `0`
- `sed -n '1470,1855p' app/phone/page.js` -> `0`
- `sed -n '1990,2385p' app/phone/page.js` -> `0`
- `sed -n '1,260p' packages/cloud-sync/flag-queue.js` -> `0`
- `sed -n '1,240p' app/phone/_lib/projectCache.js` -> `0`
- `sed -n '1,220p' tests/cloud-error-message.test.mjs` -> `0`
- `rg -n "flag-queue|retryFlagQueue|applyFlagQueueToBook|pullProofProjects|phone" tests packages/cloud-sync app/phone/page.js` -> `0`
- `sed -n '1,260p' tests/cloud-slim.test.mjs` -> `0`
- `npm test -- --runInBand tests/cloud-slim.test.mjs tests/cloud-error-message.test.mjs` -> `0`
- `rg -n "stale.*phone|empty.*pull|empty.*project|cached.*book|refresh.*empty|project cache|Phone Script|phone.*stale|flag.*saved on this phone|Tap Refresh to retry" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start` -> `0`
- `nl -ba app/phone/page.js | sed -n '150,180p'` -> `0`
- `nl -ba app/phone/page.js | sed -n '1520,1560p'` -> `0`
- `nl -ba app/phone/page.js | sed -n '1690,1765p'` -> `0`
- `nl -ba app/phone/_lib/projectCache.js | sed -n '1,80p'` -> `0`
- `nl -ba docs/FRONT_FUNCTION_TREE.md | sed -n '88,98p'` -> `0`
- `nl -ba docs/WIRING_MATRIX.md | sed -n '82,88p'` -> `0`
- `nl -ba docs/CLOUD_SCHEMA.md | sed -n '38,75p'` -> `0`
- `nl -ba docs/CLOUD_SAFETY_AUDIT.md | sed -n '58,77p'` -> `0`
- `nl -ba packages/cloud-sync/flag-queue.js | sed -n '80,240p'` -> `0`
- `nl -ba app/phone/page.js | sed -n '1810,1840p'` -> `0`

## Evidence Paths

- `docs/FRONT_FUNCTION_TREE.md:88-95`
- `docs/WIRING_MATRIX.md:82-87`
- `docs/CLOUD_SCHEMA.md:38-49,68-75`
- `docs/CLOUD_SAFETY_AUDIT.md:62-77`
- `app/phone/page.js:152-170`
- `app/phone/page.js:1522-1560`
- `app/phone/page.js:1692-1760`
- `app/phone/page.js:1815-1834`
- `app/phone/_lib/projectCache.js:1-69`
- `packages/cloud-sync/flag-queue.js:87-239`
- `tests/cloud-slim.test.mjs:1-49`
- `tests/cloud-error-message.test.mjs:1-11`

## Pass Items

1. The Phone Script source map is present and coherent across the current app
   tree. `docs/APP_STRUCTURE.md` points to `app/phone/page.js`,
   `app/phone/_components/PhoneReader.js`, `app/phone/_lib/projectCache.js`,
   and `packages/cloud-sync/`, and those files contain the documented phone
   Proof pull, local audio matching, reader, flag save/delete, and CSV export
   paths.

2. The phone Proof cloud boundary still keeps audio local in this static read.
   `docs/CLOUD_SCHEMA.md:68-75` says only bare `audioFileName` crosses
   Supabase, and the Phone Script book view repeats that rule in
   `app/phone/page.js:1831-1834` while the export/save paths operate on flag
   text and metadata only.

3. Phone Proof includes a real pending-queue merge and retry path rather than a
   cloud-only overwrite path. `app/phone/page.js:1532-1558` folds queued saves
   and deletes back into the pulled books, and
   `packages/cloud-sync/flag-queue.js:162-239` retries pending upserts/deletes
   with backoff and single-flight guards.

4. Safe helper tests passed in this run. `npm test -- --runInBand
   tests/cloud-slim.test.mjs tests/cloud-error-message.test.mjs` exited `0`,
   though the package test script still ran the broader Node suite instead of
   just those two named files.

## Fail Items

1. `doc-drift`: Phone Script rows are still marked `MISSING` in
   `docs/WIRING_MATRIX.md:82-87` while `docs/FRONT_FUNCTION_TREE.md:88-95`
   marks the same flows `REAL` or `PARTIAL`, and the current source tree
   contains the documented phone Script implementation. Possible duplicate bug
   reference: `SAS-AUD-20260602-001`.

2. The phone Proof CSV export still uses the already-logged header/value
   mismatch. `app/phone/page.js:152-170` labels column seven `Note` while
   writing `fl.sentPlain` there and puts the actual correction note in column
   eight `Should Say`. Possible duplicate bug reference:
   `SAS-AUD-20260602-004`.

## Watchlist Items

1. Code-traced risk, not live-confirmed: an empty cloud refresh appears unable
   to clear stale cached phone books. In `app/phone/page.js:1522-1549`, a pull
   result only replaces state when `list?.length` is truthy; if Supabase
   returns an empty array and the phone already has cached books, the code
   returns `current` instead of `[]`. Likely user impact if reproduced live:
   Marie could still see an old project list on the phone after the cloud copy
   is emptied or after switching to an account with no Proof projects.

2. Coverage gap: this run found no direct automated tests for Phone Script
   refresh state, `projectCache`, or `flag-queue` behavior even though
   `docs/CLOUD_SAFETY_AUDIT.md:62-77` explicitly expects phone/desktop round
   trips and offline retry checks. The safe test run passed, but it covered
   generic cloud helpers and other repo suites rather than targeted phone
   refresh or queue cases.

## What Was Not Tested

- No live phone browser session.
- No Supabase sign-in or account switching.
- No live phone audio picker.
- No live flag add/edit/delete interaction.
- No live phone CSV export download/open.
- No real phone-to-desktop or desktop-to-phone cloud round trip.
- No real offline / reconnect retry flow.

Reason: this run stayed read-only and did not cross into live phone or cloud
testing.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` for the Phone Script wiring/doc drift family.
- `SAS-AUD-20260602-004` for the Proof CSV header mismatch, which also affects
  the phone export builder.
- `SAS-AUD-20260602-003` is adjacent but not identical; it tracks a global
  pending-count risk, while this report's stale-refresh watchlist is about
  empty pull results preserving cached books.

## Next Checks

1. In a safe signed-in phone/browser run, verify whether an empty Proof project
   pull clears the cached list after Refresh and after account switching.
2. Open one phone Proof CSV export and confirm the visible header mismatch
   matches the current source read.
3. Add targeted tests for Phone Script refresh-empty behavior, queue retry, and
   project-cache clearing when the cloud returns no books.
