# Inspector C - Zone 8 - Phone Quill

## Scope

- Independent read-only audit of the Phone Quill flow in `app/phone/page.js`,
  its shared phone reader pieces, Quill cloud sync helpers, export helpers, and
  source-goal docs.
- Focused on project load, chapter open, annotation create flow, export path,
  local-audio rules, and cloud/cache safety.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/WIRING_MATRIX.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands Run

- `date -u '+%Y-%m-%dT%H:%M:%SZ'` -> exit `0`
- `date '+%Y-%m-%d %H:%M:%S %Z'` -> exit `0`
- `git status --short` -> exit `0`
- `npm test -- --test-reporter=spec` -> exit `0`
- `rg -n "Phone Quill|phone quill|Quill mode|quill" docs/WIRING_MATRIX.md docs/FRONT_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/CLOUD_SCHEMA.md docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> exit `0`
- `rg -n "buildAnnotationsCsv|exportCsv|annotation|selectedText|quill" app/phone/page.js app/phone/_components/PhoneReader.js app/phone/_components/renderReaderContent.js app/phone/_lib/projectCache.js app/phone/_lib/audioLibrary.js app/phone/_lib/readerSettings.js packages/cloud-sync/quill-sync.js packages/quill-engine/exporters.js tests` -> exit `0`
- `rg -n "allowManualPick|You can still pick audio inside the reader|PhoneAudioDock" app/phone/page.js` -> exit `0`
- `rg -n "pick audio|Pick files|Pick folder|No filenames matched|inside the reader|Back to the chapter list to pick the audio folder|audio folder" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` -> exit `1`

## Evidence Paths

- `app/phone/page.js:244-257`
- `app/phone/page.js:778-888`
- `app/phone/page.js:930-1100`
- `app/phone/page.js:1107-1472`
- `app/phone/page.js:2538-2775`
- `app/phone/page.js:3121-3385`
- `app/phone/_components/PhoneReader.js:1-226`
- `app/phone/_lib/projectCache.js:1-69`
- `packages/cloud-sync/quill-sync.js:27-285`
- `packages/quill-engine/exporters.js:11-31`
- `docs/FRONT_FUNCTION_TREE.md:97-108`
- `docs/WIRING_MATRIX.md:89-96`
- `docs/CLOUD_SCHEMA.md:52-145`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md:340-384`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md:432-472`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md:476-520`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md:816-944`

## Pass Items

- Phone Quill has a real project-list -> chapter-list -> chapter-reader flow
  with a cached startup path and guarded refresh path, not just placeholder
  wiring.
- The chapter reader supports word-range selection plus annotation creation with
  class, option, attached character markers, timestamp capture, and note text.
- Phone Quill export is wired: the export ZIP includes the annotations CSV, the
  InDesign JSX file, and a raw JSON backup of the current project.
- Audio privacy boundaries are still respected in the Quill cloud path: upload
  code strips audio paths/blobs and persists only filename metadata.
- Audio-word sync is present when chapter alignment exists; the phone reader can
  highlight the current word while audio plays.
- Repo tests passed in this run: `13` passing, `0` failing.

## Fail Items

- New confirmed UI mismatch: when the Quill project-level picker loads files but
  matches none, the status text says "You can still pick audio inside the
  reader," but the Quill reader disables manual picking and instead tells the
  user to go back to the chapter list. Evidence:
  `app/phone/page.js:952-960`, `app/phone/page.js:1460-1472`,
  `app/phone/page.js:2675-2693`.
- Existing doc drift still applies to Phone Quill: `docs/FRONT_FUNCTION_TREE.md`
  marks project list, open chapter, add annotation, and export as `REAL`, while
  `docs/WIRING_MATRIX.md` still marks the same Phone Quill rows `MISSING` even
  though the current source contains the live route and export wiring. Evidence:
  `docs/FRONT_FUNCTION_TREE.md:97-108`, `docs/WIRING_MATRIX.md:89-96`,
  `app/phone/page.js:244-257`, `app/phone/page.js:778-1100`.

## Watchlist Items

- Existing watchlist `SAS-AUD-20260602-002` still stands: Phone Quill saves
  optimistically mutate local state and fire a whole-project push, but failed
  pushes only `console.warn` and do not surface a pending banner, retry queue,
  or local recovery note. Evidence: `app/phone/page.js:877-887`,
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md:912-944`.
- Phone Quill refresh intentionally refuses to replace a populated current list
  with an empty cloud result, which protects against transient pulls but also
  risks leaving stale cached projects visible after a legitimate all-projects
  delete or account-state mismatch. Evidence: `app/phone/page.js:803-817`,
  `app/phone/_lib/projectCache.js:30-68`. This was not live-reproduced in this
  run.
- Existing cloud-helper risks under the same phone surface remain relevant:
  `pullQuillProjects()` still ignores secondary query errors, and
  `pushQuillProject()` still skips several Supabase error checks before caching
  a successful push hash. Evidence:
  `packages/cloud-sync/quill-sync.js:101-156`,
  `packages/cloud-sync/quill-sync.js:162-177`,
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md:340-384`,
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md:432-472`.

## What Was Not Tested

- No live `/phone` browser session.
- No real Supabase sign-in, pull, push, offline, or reconnect check.
- No live phone audio pick, playback, or sync-highlight run.
- No export ZIP opened after generation.
- No Save Data, packaged app, or real Marie project files touched.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` - existing app-tree / wiring doc drift already covers
  the stale Phone Quill `WIRING_MATRIX.md` rows.
- `SAS-AUD-20260602-002` - existing Phone Quill offline-save / no-pending-state
  watchlist overlaps the save-safety concerns seen here.
- `SAS-AUD-20260602-010` - existing Quill pull helper partial-read failure bug
  overlaps the refresh path used by phone.
- `SAS-AUD-20260602-012` - existing Quill push error-handling bug overlaps the
  phone save path because phone uses `pushQuillProject(...)`.
- `SAS-AUD-20260602-013` - adjacent stale-local-after-delete behavior on
  desktop is similar to the phone empty-pull cache risk, but this report did
  not confirm they are the same bug.

## Next Checks

- Live-check the new audio guidance mismatch on `/phone`: load Quill audio files
  that do not filename-match a chapter, open the chapter, and confirm the reader
  offers no manual file picker.
- Reproduce `SAS-AUD-20260602-002` with a forced offline/failed Quill save and
  verify whether an unsynced annotation can disappear on refresh.
- If the phone empty-pull cache risk is triaged later, test with a safe account
  that goes from one Quill project to zero cloud projects and confirm whether
  refresh clears the stale cached card.
