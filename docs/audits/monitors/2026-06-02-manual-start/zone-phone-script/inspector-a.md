# Inspector A — Zone 7: Phone Script

- Campaign: `2026-06-02-manual-start`
- Zone: `Phone Script`
- Inspector: `A`
- Date: `2026-06-02`
- Result: `fail`
- Audit style: read-only static audit plus safe baseline test run

## Scope

Read-only inspection of the Phone Script flow: auth/project refresh shape,
local-audio boundary, phone flag create/delete/export behavior, cloud flag
queue/retry behavior, and phone-specific test/documentation coverage.

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
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `package.json`

## Commands run with exit codes

- `test -f docs/audits/monitors/_run_state/inspector-a.lock.md && sed -n '1,220p' docs/audits/monitors/_run_state/inspector-a.lock.md || true` → exit `0`
- `find docs/audits/monitors -maxdepth 3 -type f \( -name 'inspector-a.md' -o -name 'checker.md' -o -name 'inspector-b.md' -o -name 'inspector-c.md' \) | sort` → exit `0`
- `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` → exit `0`
- `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` → exit `0`
- `sed -n '1,260p' docs/BUILD_PLAN_V4.md` → exit `0`
- `sed -n '1,260p' docs/APP_STRUCTURE.md` → exit `0`
- `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` → exit `0`
- `sed -n '1,180p' 'READ ME FIRST - OPEN THIS.txt'` plus `HANDOFF.md`, `CLAUDE.md`, and `TODO.md` reads → exit `0`
- `sed -n '1,220p' docs/FRONT_FUNCTION_TREE.md` plus `docs/INTERNAL_FUNCTION_TREE.md`, `docs/SHARED_COMPONENTS.md`, and `docs/WIRING_MATRIX.md` → exit `0`
- `date '+%Y-%m-%d %H:%M:%S %Z'` → exit `0`
- `git status --short` → exit `0`
- `test -f .env.local && echo '.env.local: present' || echo '.env.local: missing'` plus packaged-build listing under `Script and Sync Releases/` → exit `0`
- `cat package.json` → exit `0`
- `npm test -- --test-reporter=spec` → exit `0`
- `rg -n "signIn|signUp|resendConfirmation|pullProofProjects|export.*CSV|audio_file_name|selectionMeta|flag|deleteFlag|updateFlag|quote|Narrator|Enginee|audio folder|pickAudioFile|PhoneAudioDock|BookAudioFolderPicker" app/phone/page.js packages/cloud-sync/proof-sync.js app/phone/_lib/audioLibrary.js app/phone/_lib/projectCache.js app/phone/_lib/readerSettings.js` → exit `0`
- `sed -n '1,260p' packages/cloud-sync/proof-sync.js` → exit `0`
- `sed -n '1,260p' app/phone/_lib/audioLibrary.js` plus `app/phone/_lib/projectCache.js` → exit `0`
- `sed -n '1,320p' app/phone/page.js` → exit `0`
- `sed -n '258,360p' packages/cloud-sync/proof-sync.js` → exit `0`
- `sed -n '1650,1775p' app/phone/page.js` plus `sed -n '2000,2505p'` and `sed -n '3034,3112p'` → exit `0`
- `sed -n '1,240p' packages/cloud-sync/audio-guard.js` plus `sed -n '1,260p' packages/cloud-sync/cloud-slim.js` → exit `0`
- `sed -n '1,260p' packages/cloud-sync/index.js` → exit `0`
- `rg -n "phone|proof-sync|audioLibrary|flag-queue|script_sync_flags|buildFlagsCsv|pullProofProjects|upsertProofFlag|deleteProofFlag" tests app/phone packages/cloud-sync -g 'tests/**/*.mjs'` → exit `1`
- `sed -n '300,380p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` → exit `0`
- `rg -n "buildFlagsCsv|pullProofProjects|flag queue|audioLibrary|PhoneAudioDock|BookAudioFolderPicker|saveFlagToCloud|removeFlagFromCloud|selectionMeta|sentenceTextBetween" tests app/phone packages/cloud-sync` → exit `0`
- `sed -n '1480,1668p' app/phone/page.js` → exit `0`
- `nl -ba app/phone/page.js | sed -n '148,175p'` plus `2338,2495p` and `3038,3110p` → exit `0`
- `nl -ba packages/cloud-sync/proof-sync.js | sed -n '1,120p'` plus `213,340p` → exit `0`
- `nl -ba packages/cloud-sync/flag-queue.js | sed -n '1,240p'` → exit `0`
- `nl -ba docs/FRONT_FUNCTION_TREE.md | sed -n '88,100p'` → exit `0`
- `nl -ba docs/WIRING_MATRIX.md | sed -n '71,81p'` → exit `0`
- `rg -n "pullProofProjects|buildFlagsCsv|saveFlagToCloud|removeFlagFromCloud|flag-queue|audioLibrary|PhoneAudioDock|BookAudioFolderPicker|sentenceTextBetween" tests` → exit `1`
- `rg -n "Phone companion|Pick an audio file|Tap to add a flag|audio stays local|Save: only flag" docs/BUILD_PLAN_V4.md docs/APP_STRUCTURE.md` → exit `0`
- `nl -ba docs/BUILD_PLAN_V4.md | sed -n '93,108p'` → exit `0`
- `nl -ba docs/APP_STRUCTURE.md | sed -n '154,175p'` → exit `0`
- Final drift-reset rereads of `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, and `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` → exit `0`

## Evidence paths

- `app/phone/page.js`
- `app/phone/_lib/audioLibrary.js`
- `app/phone/_lib/projectCache.js`
- `packages/cloud-sync/proof-sync.js`
- `packages/cloud-sync/flag-queue.js`
- `packages/cloud-sync/audio-guard.js`
- `packages/cloud-sync/cloud-slim.js`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Pass items

1. Phone Script does preserve the intended audio/privacy boundary in the code
   I checked: the plan says phone audio stays local, the audio matcher only
   works from filenames, and Proof cloud push strips audio paths before upload.
   Evidence: `docs/BUILD_PLAN_V4.md:96-106`,
   `docs/APP_STRUCTURE.md:168-173`,
   `app/phone/_lib/audioLibrary.js:1-10,79-117`,
   `packages/cloud-sync/proof-sync.js:14-16,46-57`.

2. The phone Proof refresh path has real cloud pull, cache, timeout, and
   offline-queue merge behavior rather than a dead placeholder.
   Evidence: `app/phone/page.js:1511-1577`,
   `app/phone/_lib/projectCache.js:1-54`,
   `packages/cloud-sync/proof-sync.js:213-286`,
   `packages/cloud-sync/flag-queue.js:1-240`.

3. Phone Script does have a real add-flag path that captures quote/page/
   narrator/type/note and saves through the single-row Proof flag helper.
   Evidence: `app/phone/page.js:2069-2132,2210-2243`,
   `packages/cloud-sync/proof-sync.js:295-327`.

4. The current baseline test suite passed cleanly in this run.
   Evidence: `npm test -- --test-reporter=spec` exited `0` with `13` passing
   tests and `0` failures.

## Fail items

1. Phone Proof CSV export still labels the quote column as `Note` even though
   the exported value in that column is `sentPlain`, with the actual
   correction note written under `Should Say`.
   Evidence: `app/phone/page.js:152-170` declares the header row as
   `..., Type, Note, Should Say` but writes `fl.sentPlain` first and `fl.note`
   second. This matches the already logged cross-Proof export bug.
   Status note: code-traced fail; no live export file opened in this zone.

## Watchlist items

1. Phone Script currently shows delete actions for existing flags, but I did
   not find any current edit affordance in either the chapter flag cards or the
   all-book flag list. This may be intentional partial scope, but it matches
   the docs calling the area only `PARTIAL`.
   Evidence: `docs/APP_STRUCTURE.md:168-169`,
   `docs/FRONT_FUNCTION_TREE.md:88-95`,
   `app/phone/page.js:2338-2355`,
   `app/phone/page.js:3073-3106`.

2. Phone Script docs still drift against the wiring matrix: the front function
   tree marks sign-in/project list/open chapter/add flag/export as real or
   partial, while the wiring matrix still leaves the Phone Script rows in the
   old phase-placeholder `MISSING` state.
   Evidence: `docs/FRONT_FUNCTION_TREE.md:88-95`,
   `docs/WIRING_MATRIX.md:77-81`.

3. I found no dedicated automated coverage for the phone-specific Script code
   paths I traced here: refresh/pull, local audio matching, phone flag save/
   delete, CSV export, or the retry queue UI wiring.
   Evidence: `rg -n "pullProofProjects|buildFlagsCsv|saveFlagToCloud|removeFlagFromCloud|flag-queue|audioLibrary|PhoneAudioDock|BookAudioFolderPicker|sentenceTextBetween" tests`
   exited `1`.

4. The pending-flag banner/count still looks tied to the global queue store
   rather than a user-scoped queue, which matches an existing open watchlist
   risk and was not disproved in this zone.
   Evidence: `app/phone/page.js:1554-1570,1596-1598,1714-1717,1752-1756`,
   `packages/cloud-sync/flag-queue.js:23,130-159`.

## What was not tested

- No live phone browser session.
- No real Supabase sign-in, resend-confirmation, or sign-out run.
- No live phone audio folder pick or playback check.
- No live flag create/delete/export round-trip.
- No live desktop-to-phone or phone-to-desktop sync check.
- No real or temp `Save Data/` mutation.
- No packaged app launch.

## Possible duplicate bug references

- `SAS-AUD-20260602-004` is the matching existing bug for the swapped Proof
  export columns; this zone adds phone-specific evidence only.
- `SAS-AUD-20260602-003` is the matching existing watchlist risk for the
  non-user-scoped pending flag queue count.
- `SAS-AUD-20260602-001` likely already covers the Phone Script doc-drift
  between `docs/FRONT_FUNCTION_TREE.md` and `docs/WIRING_MATRIX.md`.

## Next checks

1. In a safe live phone run, export a Script CSV and confirm the column mismatch
   is visible in the downloaded file, not just in source.
2. In the same safe run, verify whether current phone Script truly lacks
   end-user edit for existing flags or whether the path is hidden behind a
   gesture not visible in static reading.
3. Add targeted tests for phone Proof CSV headers, flag save/delete queue
   behavior, and the local-audio matching helper.
