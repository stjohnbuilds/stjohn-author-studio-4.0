# Inspector C — Zone 9: Cloud, Auth, Audio Privacy, Save Data, and Backups

## Scope

- Independent read-only audit of Proof and Quill cloud sync, auth/session handling, audio-to-cloud privacy boundaries, local save-data paths, and Drive snapshot backup paths.
- Static source review plus safe read-only test commands only.
- No product code edits. No real Save Data writes or live Supabase/Drive actions.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands Run With Exit Codes

| Command | Exit code |
|---|---:|
| `date '+%Y-%m-%d %H:%M:%S %Z'` | 0 |
| `git status --short` | 0 |
| `npm test -- --test-reporter=spec` | 0 |
| `find packages/cloud-sync -maxdepth 2 -type f | sort` | 0 |
| `find packages/backups -maxdepth 2 -type f | sort` | 0 |
| `rg -n "supabase|auth|signOut|signIn|audio|backup|tombstone|offline|queue|save data|documents|writeData|readData|exportBackup|importBackup" app main.js preload.js packages/cloud-sync packages/backups tests` | 0 |
| `node scripts/cloud-safety-test.mjs` | 0 |

## Evidence Paths

- `packages/cloud-sync/client.js`
- `packages/cloud-sync/audio-guard.js`
- `packages/cloud-sync/proof-sync.js`
- `packages/cloud-sync/quill-sync.js`
- `packages/cloud-sync/flag-queue.js`
- `packages/cloud-sync/tombstones.js`
- `packages/backups/index.js`
- `app/page.js`
- `app/phone/page.js`
- `app/components/QuillAndInkMode.js`
- `main.js`

## Pass Items

1. Cloud table access is hard-whitelisted to the six approved StJohn tables, and any `.rpc(...)` call is blocked loudly. This matches the source docs' single-cloud-boundary rule.
   - Evidence: `packages/cloud-sync/client.js:22-60`

2. Audio privacy boundary is present in both main push paths. `stripAudioPaths()` removes audio paths/blobs/buffers recursively, normalizes `whisperAudioKey`, keeps only filename metadata, and both Proof and Quill pushes call it before slimming or upload.
   - Evidence: `packages/cloud-sync/audio-guard.js:12-79`, `packages/cloud-sync/proof-sync.js:46-58`, `packages/cloud-sync/quill-sync.js:27-36`

3. Backup flow is desktop-only, opt-in per signed-in user, skips when Drive is not detected, packages local JSON plus an optional cloud snapshot into a zip, and prunes old snapshots after success.
   - Evidence: `packages/backups/index.js:68-135`, `main.js:2019-2090`

4. The dedicated cloud-safety script passed all six tombstone regression checks in this run.
   - Evidence: `node scripts/cloud-safety-test.mjs` exit `0`

## Fail Items

1. Proof cross-device deletes can remain locally and be re-saved because the desktop merge never removes local books that are missing from the cloud result, and the resync path does nothing when the cloud pull is empty.
   - Expected: If a Proof book is deleted on another device, desktop resync should remove that missing cloud project unless it is explicitly protected by a local pending state.
   - Actual: `mergeProofBookLists()` starts from all local books, overlays cloud matches, and returns the full local map without pruning extras. `resyncProof()` only calls `setBooks()` when `cloudBooks.length` is truthy, so an empty post-delete cloud result leaves stale local books untouched.
   - Evidence: `app/page.js:399-415`, `app/page.js:645-650`

2. Quill cross-device deletes have the same persistence problem on desktop. Local projects missing from the cloud list are kept during merge, and the initial cloud hydrate returns early when the cloud list is empty.
   - Expected: If a Quill project is deleted on another device, the next cloud hydrate should remove it locally unless a deliberate local-conflict rule says otherwise.
   - Actual: `mergeProjectLists()` seeds the map with all local projects and never prunes local-only entries. The hydrate flow returns early on `!rawCloudProjects.length` and again on `!cloudProjects.length`, so a fully deleted remote set leaves stale local projects in place.
   - Evidence: `app/components/QuillAndInkMode.js:350-367`, `app/components/QuillAndInkMode.js:504-511`

## Watchlist Items

1. Phone Quill still appears to rely on full-project push with logging only on failure, with no offline queue or visible pending state. This is not newly confirmed here, but the current code still reads that way.
   - Evidence: `app/phone/page.js:878-886`

2. Proof phone pending-flag queue storage is still keyed only by the global `stjohn-cloud-flag-queue-v1` store and per-project buckets, so the user-scope concern remains code-traceable.
   - Evidence: `packages/cloud-sync/flag-queue.js:23-57`

## What Was Not Tested

- No live Supabase sign-in, sign-out, account swap, or RLS behavior against a real backend.
- No live phone-to-desktop or desktop-to-phone deletion round trip.
- No real Google Drive snapshot creation.
- No Electron save-location mutation or real Save Data writes.
- No real audio files, manuscript files, or Marie data.

## Possible Duplicate Bug References

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` — `SAS-AUD-20260602-002` (Phone Quill has no offline queue / pending state)
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` — `SAS-AUD-20260602-003` (Proof pending queue may not be user-scoped)
- Possible related existing audit trail for cloud delete behavior: `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` and later checker review for this zone

## Next Checks

1. Live-verify the confirmed desktop delete-sync failures in a safe isolated account pair: delete one Proof book and one Quill project on Device A, refresh Device B, then confirm whether the stale local item remains or re-pushes.
2. If the delete-sync failures reproduce live, compare the safest fix rule for local-only items versus truly cloud-owned items before any repair work starts.
3. Run the same delete-sync check when the cloud result becomes fully empty, because the current early-return logic makes that edge case especially likely to fail.
