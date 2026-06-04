# Inspector A — Zone 8: Phone Quill

- Campaign: `2026-06-02-manual-start`
- Zone: `Phone Quill`
- Inspector: `A`
- Date: `2026-06-02`
- Result: `fail`
- Audit style: read-only static audit plus safe baseline test run

## Scope

Read-only inspection of the Phone Quill flow: cloud refresh/cache shape,
local-audio boundary, chapter reader selection and annotation save flow, export
path, and current test/documentation coverage.

## Source docs checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `CLAUDE.md`
- `TODO.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands run with exit codes

- `pwd && date -u && date` → exit `0`
- `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` plus later
  drift-reset rereads → exit `0`
- `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` → exit `0`
- `sed -n '1,220p' docs/BUILD_PLAN_V4.md` and `docs/APP_STRUCTURE.md` →
  exit `0`
- `sed -n '1,220p' 'READ ME FIRST - OPEN THIS.txt'` plus `HANDOFF.md`,
  `CLAUDE.md`, and `TODO.md` → exit `0`
- `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` plus targeted
  `nl -ba ... | sed -n '740,810p'` duplicate-check read → exit `0`
- `find docs/audits/monitors -maxdepth 3 -type f | sort` → exit `0`
- `git status --short` → exit `0`
- `npm test -- --test-reporter=spec` → exit `0`
- `sed -n '1,260p' docs/audits/monitors/2026-06-02-manual-start/zone-phone-script/inspector-a.md`
  → exit `0`
- `rg -n "Phone Quill|quill|annotation|BookAudioFolderPicker|PhoneReader|selectionMeta|export CSV|audio_file_name|pick local phone audio|Quill mode"` across
  `app/phone/`, `packages/cloud-sync/`, `packages/quill-engine/`, `tests/`,
  and relevant docs → exit `0`
- `sed -n '1,220p' docs/CLOUD_SCHEMA.md` plus `docs/FRONT_FUNCTION_TREE.md`
  and `docs/SHARED_COMPONENTS.md` → exit `0`
- `nl -ba app/phone/page.js | sed -n '775,1108p'` plus
  `sed -n '1109,1475p'` → exit `0`
- `nl -ba packages/cloud-sync/quill-sync.js | sed -n '1,320p'` → exit `0`
- `nl -ba app/phone/_lib/audioLibrary.js | sed -n '1,220p'` → exit `0`
- `rg -n "pullQuillProjects|pushQuillProject|buildAnnotationsCsv|edit / delete|delete annotation|annotationOptions|Phone Quill|BookAudioFolderPicker"`
  across source/tests/docs → exit `0`
- `nl -ba docs/WIRING_MATRIX.md | sed -n '82,96p'` → exit `0`
- `rg -n "Phone Quill edit/delete|Phone Quill|edit/delete annotations|annotation.*delete|delete annotation"`
  across `TODO.md`, `HANDOFF.md`, master report, and bug log → exit `0`
- `nl -ba app/phone/page.js | sed -n '1,280p'` → exit `0`
- `nl -ba app/phone/_lib/projectCache.js | sed -n '1,220p'` → exit `0`
- `rg -n "readPhoneProjectCache\\('quill'|writePhoneProjectCache\\('quill'|No projects saved to the cloud yet|Never wipe a populated local cache with an empty cloud pull|deleteQuillProject|tombstone"`
  across `app/phone/page.js` and `packages/cloud-sync` → exit `0`
- `nl -ba docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md | sed -n '312,324p'`
  → exit `0`
- `rg -n "pushQuillProject\\(|console.warn\\('\\[Phone\\] Quill push failed|retryFlagQueue|recordPendingFlag|clearPendingFlag|countAllFlagQueues"`
  across `app/phone/page.js` and `packages/cloud-sync` → exit `0`
- `rg -n "edit / delete annotation|Edit / delete annotation|MISSING|No annotations to export yet|Save annotation|Annotations ·"`
  across `app/phone/page.js`, `docs/FRONT_FUNCTION_TREE.md`, and `TODO.md`
  → exit `0`
- `rg -n "buildAnnotationsCsv|buildQuillExportZip|buildInDesignJsx"` across
  `tests`, `app/phone/page.js`, and `packages/quill-engine` → exit `0`
- `rg -n "SAS-AUD-20260602-001"` across the bug log and master report →
  exit `0`

## Evidence paths

- `app/phone/page.js`
- `app/phone/_lib/audioLibrary.js`
- `app/phone/_lib/projectCache.js`
- `packages/cloud-sync/quill-sync.js`
- `packages/cloud-sync/audio-guard.js`
- `packages/quill-engine/exporters.js`
- `tests/quill-exporters.test.mjs`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Pass items

1. Phone Quill still respects the intended audio/privacy boundary in the code I
   checked. The plan says phone audio stays local, the phone matcher works from
   filenames only, and Quill cloud push strips audio paths before upload.
   Evidence: `docs/BUILD_PLAN_V4.md:93-108`,
   `docs/APP_STRUCTURE.md:121-143`,
   `docs/CLOUD_SCHEMA.md:59-66`,
   `app/phone/_lib/audioLibrary.js:1-10,79-117`,
   `packages/cloud-sync/quill-sync.js:12-18,27-35`.

2. Phone Quill has real project-list, chapter-open, add-annotation, and export
   wiring rather than placeholder buttons. The refresh path pulls Quill
   projects, chapter view builds annotation payloads from reader selections,
   and export uses the shared CSV + InDesign exporters.
   Evidence: `app/phone/page.js:791-818,893-977,1227-1279`,
   `packages/cloud-sync/quill-sync.js:159-285`,
   `app/phone/page.js:244-257`,
   `packages/quill-engine/exporters.js:11-71`.

3. The current baseline test suite passed in this run, and the shared Quill
   exporter helpers used by the phone export path do have targeted automated
   coverage.
   Evidence: `npm test -- --test-reporter=spec` exited `0` with `13` passing
   tests and `0` failures; `tests/quill-exporters.test.mjs:39-105`.

## Fail items

1. Phone Quill still has no end-user edit or delete path for existing
   annotations. The chapter view renders existing annotations as read-only
   cards, the popover only supports creating a `New annotation`, and I found no
   phone-side handler that updates or removes an existing Quill annotation.
   Evidence: `docs/FRONT_FUNCTION_TREE.md:97-108` marks `Edit / delete annotation`
   as `MISSING`; `TODO.md:164-170,235-236` still tracks Phone Quill
   edit/delete as unfinished; `app/phone/page.js:1326-1457` shows display cards
   plus a create-only save path with no edit/delete controls or handler.
   Status note: code-traced fail; no live phone tap sequence was run in this
   zone.

## Watchlist items

1. Phone Quill saves still look fire-and-forget. `pushProject()` writes local
   cache, then calls `pushQuillProject(...)` and only logs a console warning if
   the push fails. I found no Quill equivalent of Proof's pending queue or
   retry banner.
   Evidence: `app/phone/page.js:877-887`,
   `app/phone/page.js:40-47,1557-1570,1709-1761`,
   `packages/cloud-sync/quill-sync.js:27-157`.
   Status note: code-traced risk only; this appears to overlap existing
   watchlist item `SAS-AUD-20260602-002`.

2. The Quill refresh path intentionally refuses to replace a populated local
   cache with an empty cloud result. That protects against transient wipes or a
   wrong-account pull, but it also means a genuine "all Quill projects deleted
   on desktop" state may stay visible on the phone until some manual reset.
   Evidence: `app/phone/page.js:803-817,1073-1077`,
   `app/phone/_lib/projectCache.js:30-68`.
   Status note: code-traced only; no live delete/re-pull run was performed.

3. The app-tree docs still drift for Phone Quill. `docs/FRONT_FUNCTION_TREE.md`
   shows real project/open/add/export paths with only edit/delete missing, but
   `docs/WIRING_MATRIX.md` still leaves the entire Phone Quill block as
   `MISSING`.
   Evidence: `docs/FRONT_FUNCTION_TREE.md:97-108`,
   `docs/WIRING_MATRIX.md:89-96`.
   Status note: duplicate doc-drift evidence likely belongs under existing item
   `SAS-AUD-20260602-001`.

4. I found no phone-Quill-specific automated coverage for refresh/cache,
   reader selection save flow, local audio matching in Quill mode, or the
   chapter/project list UI. Current test coverage here is limited to the shared
   exporter package.
   Evidence: `rg -n "pullQuillProjects|pushQuillProject|buildAnnotationsCsv|edit / delete|delete annotation|annotationOptions|Phone Quill|BookAudioFolderPicker" tests ...`
   only found the shared exporter test plus source references; phone-Quill UI
   flows were absent from `tests/`.

## What was not tested

- No live phone browser session.
- No real Supabase sign-in or refresh against a live Quill account.
- No live phone audio folder pick or playback check.
- No live annotation add/edit/delete/export round-trip.
- No live phone-to-desktop or desktop-to-phone Quill sync check.
- No offline/reconnect Quill save recovery test.
- No real or temp `Save Data/` mutation.
- No packaged app launch.

## Possible duplicate bug references

- `SAS-AUD-20260602-002` already covers the Phone Quill offline-save /
  no-pending-state risk; this zone adds fresher source evidence only.
- `SAS-AUD-20260602-001` likely already covers the Phone Quill
  `FRONT_FUNCTION_TREE` vs `WIRING_MATRIX` docs drift.
- I did not find a matching existing bug id for the missing Phone Quill
  edit/delete path; today it appears to live only in `TODO.md` and the master
  report's known-missing-feature note.

## Next checks

1. Run a safe live phone Quill session and confirm whether edit/delete is truly
   absent in the shipped UI, not just hidden behind a gesture I could not see
   statically.
2. In that same safe run, force an offline Quill annotation save, reconnect,
   refresh desktop, and confirm whether the annotation survives or gets lost.
3. Add targeted tests for phone Quill refresh/cache behavior, annotation create
   flow, and the local-audio matching path used by chapter open.
