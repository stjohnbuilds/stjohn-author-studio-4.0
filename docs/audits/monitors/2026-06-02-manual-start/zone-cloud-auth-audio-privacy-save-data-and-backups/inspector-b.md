# Inspector B - Zone 2 - Cloud, Auth, Audio Privacy, Save Data, and Backups

- Date: 2026-06-02
- Inspector: B
- Campaign: `2026-06-02-manual-start`
- Audit mode: read-only docs + source + safe tests only

## Scope

Cloud/auth/save-data/backups only:

- Supabase client guardrails and auth/session entry points
- Proof and Quill cloud push/pull/delete helpers
- phone Proof and phone Quill sync durability paths
- audio-to-cloud privacy boundary
- save-data path handling and Drive snapshot backup packaging

This run did not launch Electron, did not sign into Supabase, did not create a
real Drive snapshot, and did not touch real Save Data.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `package.json`

## Commands Run With Exit Codes

- `date '+%Y-%m-%d %H:%M:%S %Z'` -> `0`
- `git status --short` -> `0`
- `test -f .env.local && echo yes || echo no` -> `0`
- `test -d 'Script and Sync Releases' && echo yes || echo no` -> `0`
- `find 'Script and Sync Releases' -maxdepth 3 \( -iname '*.app' -o -iname '*.exe' -o -iname '*.msi' -o -iname '*.zip' \) 2>/dev/null | sort` -> `0`
- `npm test -- --test-reporter=spec` -> `0`
- `node scripts/cloud-safety-test.mjs` -> `0`
- `rg --files app packages tests | rg 'cloud-sync|proof-sync|quill-sync|supabase|backup|auth|phone/page|main\.js|preload\.js|projectCache|audioLibrary'` -> `0`
- `rg -n "createClient|signIn|signOut|forgot|auth|ownerId|storage|upload|audioPath|audioPaths|audioUrl|audioBlob|audioDataUrl|audioBuffer|audioBytes|audioBase64|sourceAudioPath|sourceAudioBytes|stripAudioPaths|slimBookForCloud|slimProjectForCloud|pushProofProject|pullProofProjects|deleteProofProject|upsertProofFlag|deleteProofFlag|pushQuillProject|pullQuillProjects|deleteQuillProject|makeBackupSnapshot|getBackupInfo|pruneBackups|getDataLocation|chooseDataLocation|writeData|readData|exportBackup|importBackup" packages/cloud-sync/*.js packages/backups/*.js app/page.js app/phone/page.js main.js preload.js` -> `0`
- `rg -n "supabase\.storage|storage\.from|storage\.upload|audioPath|audioPaths|audioUrl|audioBlob|audioDataUrl|audioBuffer|audioBytes|audioBase64|sourceAudioPath|sourceAudioBytes|\.(mp3|m4a|m4b|wav|flac|opus|ogg|aac)" app packages main.js preload.js` -> `0`
- `rg -n "\.from\(['\"]([^'\"]+)['\"]\)|\.rpc\(" packages/cloud-sync app/phone/page.js app/page.js main.js preload.js` -> `0`
- `nl -ba packages/cloud-sync/client.js | sed -n '1,220p'` -> `0`
- `nl -ba packages/cloud-sync/audio-guard.js | sed -n '1,120p'` -> `0`
- `nl -ba packages/cloud-sync/proof-sync.js | sed -n '1,260p'` -> `0`
- `nl -ba packages/cloud-sync/quill-sync.js | sed -n '1,320p'` -> `0`
- `nl -ba packages/cloud-sync/cloud-slim.js | sed -n '1,180p'` -> `0`
- `nl -ba packages/cloud-sync/flag-queue.js | sed -n '1,280p'` -> `0`
- `nl -ba packages/cloud-sync/account.js | sed -n '1,240p'` -> `0`
- `nl -ba packages/backups/index.js | sed -n '1,240p'` -> `0`
- `nl -ba app/page.js | sed -n '390,470p;560,860p'` -> `0`
- `nl -ba app/phone/page.js | sed -n '790,910p;1500,1765p'` -> `0`
- `nl -ba main.js | sed -n '280,420p;2046,2095p'` -> `0`
- `rg -n "snapshot|backup|cloudIncluded|buildCloudSnapshot|takeSnapshotNow|makeBackupSnapshot" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` -> `0`
- `rg -n "Quill|backup|snapshot|cloud|offline|queue|annotation|tombstone|account swap|auth" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start -g '!**/inspector-b.md'` -> `0`

## Evidence Paths

- `packages/cloud-sync/client.js:22-79`
- `packages/cloud-sync/audio-guard.js:12-79`
- `packages/cloud-sync/cloud-slim.js:84-100`
- `packages/cloud-sync/proof-sync.js:46-95,173-204`
- `packages/cloud-sync/quill-sync.js:27-72,99-156,159-290`
- `packages/cloud-sync/flag-queue.js:23-64,149-239`
- `packages/backups/index.js:73-115`
- `app/page.js:393-458,577-609,639-672,715-778,821-829`
- `app/phone/page.js:791-817,877-886,1522-1566,1647-1723,1745-1763`
- `main.js:292-303,330-385,2046-2092`

## Pass Items

1. The cloud client still enforces the six-table boundary and blocks all
   Supabase RPC calls. `packages/cloud-sync/client.js:22-60` hard-whitelists
   only the StJohn Proof and Quill tables, and the scan of current `.from(...)`
   usage stayed inside that list.

2. The audio privacy rule is still implemented in the live push paths.
   `stripAudioPaths()` recursively removes path/blob/buffer fields and keeps
   filename-only metadata, and both `pushProofProject()` and
   `pushQuillProject()` call it before slimming or upload. I also found no
   `supabase.storage` usage in the app/cloud code scan.

3. Backup scope is constrained to metadata JSON, not manuscript/audio payloads.
   `packages/backups/index.js:100-114` only hands a cloud snapshot plus user
   ids to Electron, and `main.js:2065-2077` zips the four local JSON files plus
   an optional `cloud/cloud-snapshot.json`.

4. Safe automated coverage passed in this run. `npm test -- --test-reporter=spec`
   completed `13` passes, `0` fails, and `node scripts/cloud-safety-test.mjs`
   completed `6` passes, `0` fails.

## Fail Items

1. Backup snapshots can silently claim cloud coverage even when one or both
   cloud reads failed. `buildCloudSnapshot()` converts Proof and Quill pull
   failures into empty arrays in `packages/backups/index.js:75-83`,
   `takeSnapshotNow()` always forwards that object in
   `packages/backups/index.js:100-109`, and the Electron writer records
   `cloudIncluded: true` whenever any snapshot object exists in
   `main.js:2076-2091`. If Supabase is partially unavailable during a backup,
   the zip can look complete while `cloud/cloud-snapshot.json` is empty or
   partial. I did not find an exact existing bug-log match for this backup
   completeness failure.

2. Quill cloud push ignores several critical Supabase errors and can treat a
   partial sync as success. In `packages/cloud-sync/quill-sync.js:101-116` the
   chapter-prune deletes and the `chapterIdRows` lookup are awaited without
   checking `error`; in `packages/cloud-sync/quill-sync.js:144-156` the
   annotation-prune deletes are also awaited without checking `error`. If the
   chapter-id lookup fails, later annotation rows fall back to
   `chapter_id: null` at `packages/cloud-sync/quill-sync.js:119-123`, and the
   helper still records the push hash as if the sync finished cleanly at
   `packages/cloud-sync/quill-sync.js:155`. Possible duplicate bug reference:
   `SAS-AUD-20260602-007` for the stale-annotation symptom family, though this
   report's root cause is the missing error handling inside Quill sync itself.

## Watchlist Items

1. Existing code-traced risk, still present: Phone Quill has no Proof-style
   offline queue or pending-state protection. `app/phone/page.js:877-886`
   writes local state then only logs a failed `pushQuillProject()`, while
   `app/phone/page.js:803-817` replaces the local project list with the pulled
   cloud list whenever `list?.length` is truthy. That means a later successful
   refresh can overwrite a locally cached unsynced annotation after an offline
   save failure. Possible duplicate bug reference: `SAS-AUD-20260602-002`.

2. Existing code-traced risk, still present: the Proof pending-count banner is
   still global rather than obviously user-scoped. `packages/cloud-sync/flag-queue.js:23-57`
   uses one shared localStorage key, and `countAllFlagQueues()` in
   `packages/cloud-sync/flag-queue.js:149-159` is what the phone uses for the
   visible pending count. Possible duplicate bug reference:
   `SAS-AUD-20260602-003`.

## What Was Not Tested

- No live Supabase sign-in, sign-out, password reset, or account swap.
- No real Proof or Quill push/pull against the backend.
- No live phone/browser session for Quill or Proof.
- No live Google Drive snapshot creation or zip inspection.
- No Electron save-folder mutation or backup restore flow.
- No real Save Data writes, manuscript imports, or audio files.
- No two-device conflict or delete race reproduction.

Reason: this run stayed inside the read-only wall and used static source reads
plus safe local test commands only.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-002` for Phone Quill offline-save durability.
- `SAS-AUD-20260602-003` for the global Proof pending-count risk.
- `SAS-AUD-20260602-007` for Quill stale-annotation behavior; my new Quill sync
  finding may feed the same symptom from a different failure path.
- No exact existing duplicate found for the backup snapshot `cloudIncluded`
  masking problem.

## Next Checks

1. In a safe signed-in desktop test, force one failed Proof or Quill cloud pull
   during `takeSnapshotNow()`, open the created zip, and confirm whether the
   manifest still claims cloud data was included.
2. Add a targeted Quill sync test that simulates failed chapter prune, failed
   chapter-id lookup, and failed annotation prune, then confirm the helper does
   not silently mark the push successful.
3. In a safe phone/browser run, reproduce the existing Phone Quill offline-save
   risk by saving an annotation offline, reconnecting, refreshing, and checking
   whether the local annotation survives.
