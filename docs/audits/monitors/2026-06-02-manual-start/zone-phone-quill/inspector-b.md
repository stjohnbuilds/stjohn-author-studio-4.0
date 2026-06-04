# Inspector B - Zone 10 - Phone Quill

- Date: 2026-06-02
- Inspector: B
- Campaign: `2026-06-02-manual-start`
- Audit mode: read-only docs + source + safe tests only

## Scope

Phone Quill only:

- project pull / refresh / cached-list behavior on phone
- local-audio-only boundary and chapter audio attach path
- reader selection, add-annotation, and current annotation list behavior
- phone Quill export path
- phone Quill doc drift, duplicate-bug overlap, and current safe test coverage

This run did not launch a live phone browser session, did not sign into
Supabase, and did not touch real Save Data.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `HANDOFF.md`
- `TODO.md`

## Commands Run With Exit Codes

- `date '+%Y-%m-%d %H:%M:%S %Z'` -> `0`
- `git status --short` -> `0`
- `npm test -- --test-reporter=spec` -> `0`
- `test -f .env.local && echo '.env.local: present' || echo '.env.local: missing'` -> `0`
- `test -d 'Script and Sync Releases' && echo 'Script and Sync Releases: present' || echo 'Script and Sync Releases: missing'` -> `0`
- `rg -n "Phone Quill|Quill phone|phone quill|phone companion|annotation" docs/FRONT_FUNCTION_TREE.md docs/INTERNAL_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/CLOUD_SCHEMA.md docs/CLOUD_SAFETY_AUDIT.md app/phone/page.js app/phone/_components/PhoneReader.js app/phone/_components/renderReaderContent.js app/phone/_lib/audioLibrary.js app/phone/_lib/projectCache.js packages/cloud-sync/quill-sync.js packages/quill-engine/exporters.js tests/quill-exporters.test.mjs` -> `0`
- `sed -n '1,260p' docs/FRONT_FUNCTION_TREE.md` -> `0`
- `sed -n '1,260p' docs/CLOUD_SCHEMA.md` -> `0`
- `sed -n '1,260p' docs/SHARED_COMPONENTS.md` -> `0`
- `sed -n '760,1510p' app/phone/page.js` -> `0`
- `sed -n '1,260p' app/phone/_components/PhoneReader.js` -> `0`
- `sed -n '1,260p' app/phone/_components/renderReaderContent.js` -> `0`
- `sed -n '1,260p' app/phone/_lib/audioLibrary.js` -> `0`
- `sed -n '1,340p' packages/cloud-sync/quill-sync.js` -> `0`
- `rg -n "delete.*annotation|edit.*annotation|existing annotation|openExisting|saveAnnotation\\(|annotationsForChapter|setPanelOpen\\(|setSelectedRange\\(|createAnnotation\\(|buildQuillExportZip|downloadBlob|PhoneAudioDock|allowManualPick|audio_file_name|sectionId" app/phone/page.js` -> `0`
- `sed -n '220,320p' app/phone/page.js` -> `0`
- `sed -n '2538,2690p' app/phone/page.js` -> `0`
- `sed -n '3114,3255p' app/phone/page.js` -> `0`
- `sed -n '70,120p' docs/WIRING_MATRIX.md` -> `0`
- `sed -n '70,120p' docs/INTERNAL_FUNCTION_TREE.md` -> `0`
- `rg -n "Phone Quill|phone quill|edit/delete annotation|Edit / delete annotation|annotation delete|annotation edit|allowManualPick|inside the reader|No filenames matched|Pick audio inside the reader" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md TODO.md HANDOFF.md docs/audits/monitors/2026-06-02-manual-start` -> `0`
- `nl -ba app/phone/page.js | sed -n '240,280p'` -> `0`
- `nl -ba app/phone/page.js | sed -n '791,980p'` -> `0`
- `nl -ba app/phone/page.js | sed -n '1127,1472p'` -> `0`
- `nl -ba app/phone/page.js | sed -n '2541,2695p'` -> `0`
- `nl -ba packages/cloud-sync/quill-sync.js | sed -n '1,210p'` -> `0`
- `nl -ba app/phone/_lib/audioLibrary.js | sed -n '1,140p'` -> `0`
- `nl -ba docs/FRONT_FUNCTION_TREE.md | sed -n '96,110p'` -> `0`
- `nl -ba TODO.md | sed -n '156,172p'` -> `0`
- `nl -ba HANDOFF.md | sed -n '36,46p'` -> `0`

## Evidence Paths

- `docs/APP_STRUCTURE.md:16-59,117-132`
- `docs/FRONT_FUNCTION_TREE.md:97-108`
- `docs/SHARED_COMPONENTS.md:33-34`
- `HANDOFF.md:37-44`
- `TODO.md:164-168`
- `app/phone/page.js:244-257`
- `app/phone/page.js:791-818`
- `app/phone/page.js:877-977`
- `app/phone/page.js:1128-1279`
- `app/phone/page.js:1296-1471`
- `app/phone/page.js:2541-2693`
- `app/phone/_lib/audioLibrary.js:1-117`
- `packages/cloud-sync/quill-sync.js:1-18`
- `packages/cloud-sync/quill-sync.js:27-52`
- `packages/cloud-sync/quill-sync.js:55-156`
- `tests/quill-exporters.test.mjs:39-105`

## Pass Items

1. Phone Quill's main read path is real in the current source. The project
   list refreshes through `pullQuillProjects`, chapters open into
   `QuillChapterView`, selections can be saved as new annotations, and export
   is wired to a downloadable Quill zip using the shared exporters in
   `app/phone/page.js:791-977`, `1128-1279`, and `244-257`.

2. The phone Quill audio privacy boundary is still intact in this static read.
   The phone matcher works from local files only, `app/phone/_lib/audioLibrary.js:1-117`
   keeps matching on filenames/stems, and `packages/cloud-sync/quill-sync.js:1-18`
   still documents and enforces filename-only cloud travel with no audio paths
   or blobs.

3. Phone Quill still reuses the shared Quill engine instead of a separate phone
   export stack. The phone zip builder calls `buildAnnotationsCsv(project)` and
   `buildInDesignJsx(project)` directly in `app/phone/page.js:244-257`, and
   the existing Quill exporter test suite passed inside the repo-wide `npm test`
   run.

4. Safe preflight passed for this zone. `git status --short` showed only
   pre-existing dirty audit/docs state, `.env.local` exists, the release folder
   exists, and `npm test -- --test-reporter=spec` exited `0` with `13` passing
   tests.

## Fail Items

1. Phone Quill still has no edit/delete annotation flow in the shipped phone
   reader. The current docs already mark that button path `MISSING` in
   `docs/FRONT_FUNCTION_TREE.md:101-108`, and the live phone code matches that:
   `QuillChapterView` only opens a `New annotation` popover, only exposes
   `saveAnnotation()`, and renders existing annotations as non-interactive
   display cards in `app/phone/page.js:1227-1279` and `1326-1456`. This is a
   real gap, but not a new duplicate bug: it is already tracked as an
   outstanding build item in `TODO.md:164-168` and `HANDOFF.md:42-43`.

2. The phone Quill audio fallback message contradicts the actual reader
   behavior. When folder matching finds `0` chapter matches, the project screen
   tells Marie, `No filenames matched. You can still pick audio inside the
   reader.` in `app/phone/page.js:952-960`, but the chapter reader passes
   `allowManualPick={false}` to `PhoneAudioDock` in `app/phone/page.js:1460-1471`.
   The shared dock then hides the file picker entirely and instead tells her to
   go `Back to the chapter list to pick the audio folder.` in
   `app/phone/page.js:2673-2693`. I found no existing bug-log entry for this
   exact Quill audio-fallback contradiction.

## Watchlist Items

1. Existing watchlist risk remains present: Phone Quill still does optimistic
   local save plus `console.warn` on cloud failure, with no Proof-style offline
   queue or visible pending state in the phone Quill path. Evidence:
   `app/phone/page.js:877-887`. Possible duplicate bug reference:
   `SAS-AUD-20260602-002`.

2. Code-traced risk, not live-confirmed: an empty cloud pull still appears
   unable to clear a populated cached phone Quill project list. In
   `app/phone/page.js:803-817`, `refreshFromCloud()` keeps `current` whenever
   `list?.length` is falsy, so a true empty result from Supabase could leave
   stale phone projects visible after a remote delete or account swap. This is
   adjacent to, but not clearly identical with, desktop delete-sync bug
   `SAS-AUD-20260602-013`.

3. Coverage gap: this run found no targeted automated tests for phone Quill
   refresh behavior, reader add/edit/delete behavior, or phone-specific audio
   fallback. Current Quill tests cover exporter payloads in
   `tests/quill-exporters.test.mjs:39-105`, but not the phone state flow.

## What Was Not Tested

- No live phone browser session.
- No Supabase sign-in or account switching.
- No live phone annotation add/edit/delete interaction.
- No live phone audio-folder pick or no-match fallback interaction.
- No live Quill zip download/open.
- No real phone-to-desktop or desktop-to-phone annotation round trip.
- No real offline / reconnect save flow.

Reason: this run stayed read-only and did not cross into live phone, cloud, or
real-file testing.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-002` for the existing Phone Quill offline-save / pending-state risk.
- `SAS-AUD-20260602-013` as an adjacent delete-refresh pattern; this run only
  traced the phone Quill side and did not prove the same root cause.
- The phone Quill edit/delete gap is already tracked in `TODO.md` and
  `HANDOFF.md`; this report treats it as a known missing feature, not a new bug
  log entry.

## Next Checks

1. In a safe signed-in phone/browser run, verify whether a truly empty Quill
   cloud pull clears the cached project list after Refresh and after account
   switching.
2. Reproduce the no-audio-match path on phone Quill and confirm the user-facing
   message mismatch between the project screen and the reader dock.
3. In a safe live phone run, confirm the current edit/delete gap and decide
   whether it should stay as a TODO-only missing feature or be elevated into
   the bug log for release-risk tracking.
