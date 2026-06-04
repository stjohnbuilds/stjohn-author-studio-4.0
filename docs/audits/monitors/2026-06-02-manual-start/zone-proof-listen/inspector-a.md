# Inspector A — Zone 3: Proof Listen

- Campaign: `2026-06-02-manual-start`
- Zone: `Proof Listen`
- Inspector: `A`
- Date: `2026-06-02`
- Result: `fail`
- Audit style: read-only static audit plus safe targeted test run

## Scope

Read-only inspection of the Proof Listen desktop flow and its cross-cutting
cloud/phone/export edges: book save state, flag save/delete paths, CSV export,
page-map rescan wiring, transcription plumbing, and audio/privacy guards.

## Source docs checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands run with exit codes

- `date -u '+%Y-%m-%dT%H:%M:%SZ'` → exit `0`
- `date '+%Y-%m-%d %H:%M:%S %Z'` → exit `0`
- `rg --files docs/audits/monitors | sed -n '1,240p'` → exit `0`
- `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` → exit `0`
- `sed -n '1,260p' docs/BUILD_PLAN_V4.md` → exit `0`
- `sed -n '1,260p' docs/APP_STRUCTURE.md` → exit `0`
- `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` → exit `0`
- `sed -n '1,260p' docs/FRONT_FUNCTION_TREE.md` → exit `0`
- `sed -n '1,260p' docs/INTERNAL_FUNCTION_TREE.md` → exit `0`
- `sed -n '1,260p' docs/SHARED_COMPONENTS.md` → exit `0`
- `sed -n '1,260p' docs/WIRING_MATRIX.md` → exit `0`
- `rg -n "Proof Listen|ProofingReader|ManuscriptSetup|SessionsView|script_sync|flag|whisper|rescan|transfer bundle|backup" app packages tests main.js preload.js docs | sed -n '1,260p'` → exit `0`
- `rg -n "startProofing|writeData|readData|saveBook|pushProof|pullProof|flag|retryFlagQueue|recordPendingFlag|rescan|exportCsv|exportBackup|importBackup|transfer bundle" app/page.js app/components/SessionsView.js app/components/ProofingReader.js app/components/ManuscriptSetup.js packages/cloud-sync/proof-sync.js packages/cloud-sync/flag-queue.js main.js preload.js | sed -n '1,260p'` → exit `0`
- `sed -n '1,260p' app/page.js` → exit `0`
- `sed -n '1,260p' packages/cloud-sync/proof-sync.js` → exit `0`
- `sed -n '1,260p' packages/cloud-sync/flag-queue.js` → exit `0`
- `sed -n '340,460p' app/page.js` → exit `0`
- `sed -n '619,840p' app/page.js` → exit `0`
- `sed -n '1128,1198p' app/page.js` → exit `0`
- `sed -n '260,420p' app/components/SessionsView.js` → exit `0`
- `sed -n '820,930p' app/components/SessionsView.js` → exit `0`
- `sed -n '1410,1650p' main.js` → exit `0`
- `sed -n '1680,1760p' main.js` → exit `0`
- `rg --files tests | sed -n '1,220p'` → exit `0`
- `node --test tests/whisper-json.test.mjs tests/cloud-slim.test.mjs` → exit `0`
- `rg -n "CSV|flags.csv|Should Say|Narrator/Engineer|sentPlain|note" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start -g '!**/inspector-a.md' | sed -n '1,220p'` → exit `0`
- Read-only line-numbered evidence views via `nl -ba ... | sed -n ...` on `app/page.js`, `app/components/SessionsView.js`, `app/phone/page.js`, `packages/cloud-sync/proof-sync.js`, `packages/cloud-sync/flag-queue.js`, and `main.js` → exit `0`

Repeated drift-reset rereads of the source-of-truth, app structure, and bug log
also returned exit code `0`.

## Evidence paths

- `app/page.js`
- `app/components/SessionsView.js`
- `app/components/ProofingReader.js`
- `app/phone/page.js`
- `packages/cloud-sync/proof-sync.js`
- `packages/cloud-sync/flag-queue.js`
- `main.js`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Pass items

1. Proof cloud push does enforce the core audio/privacy boundary and stores
   flags/transcriptions in separate tables instead of bloating the project blob.
   Evidence: `packages/cloud-sync/proof-sync.js` lines 46-57, 79-110, and
   138-204.

2. Proof has real offline/retry queue plumbing for flag saves and deletes on
   both desktop and phone.
   Evidence: `packages/cloud-sync/flag-queue.js` lines 87-120 and 162-233;
   `app/page.js` lines 1140-1186; `app/phone/page.js` lines 1668-1718.

3. The page-map rescan path is wired from the desktop Proof UI into Electron,
   with stored-manuscript support rather than a blind in-memory-only flow.
   Evidence: `app/page.js` lines 944-972 and `main.js` lines 1721-1756.

4. Safe targeted proof-adjacent tests passed, but only for Whisper parsing and
   cloud-slim helper behavior.
   Evidence: `node --test tests/whisper-json.test.mjs tests/cloud-slim.test.mjs`
   exited `0`.

## Fail items

1. Proof flag CSV exports swap the last two columns, so the data under
   `Note` is actually the quote (`sentPlain`) and the data under `Should Say`
   is actually the correction note.
   Evidence: desktop CSV builders in `app/components/SessionsView.js` lines
   305-313 and 384-387 declare the header as `Note, Should Say` but write
   `sentPlain` first and `note` second. The phone CSV builder repeats the same
   mapping in `app/phone/page.js` lines 152-170. Phone flag creation comments
   also define `sentPlain` as the quote and `note` as the correction in
   `app/phone/page.js` lines 2222-2230.
   Status note: code-traced fail; not live-exported.

2. Cloud-pulled Proof flags do not preserve their stored `local_id` as `id`,
   so desktop edits/deletes of phone-created flags rebuild a different id and
   target the wrong cloud row in the single-flag save/delete path.
   Evidence: phone Proof flags are created with explicit ids like
   `phone-flag-*` in `app/phone/page.js` lines 2213-2215. The cloud pull maps
   pulled flags to `{ ...flag, cloudLocalId }` instead of restoring `id` in
   `packages/cloud-sync/proof-sync.js` lines 276-280. Desktop flag writes then
   regenerate ids with `stableFlagId(...)` in `app/page.js` lines 1140-1177,
   and `upsertProofFlag` / `deleteProofFlag` use that `flag.id` as the cloud
   `local_id` in `packages/cloud-sync/proof-sync.js` lines 299-326 and 332-339.
   Likely effect: a desktop edit/delete of a phone-created flag can insert or
   delete under a synthetic id until a later full-book push happens to clean
   it up, which is especially risky when offline or when the full push fails.
   Status note: code-traced fail; not live round-tripped.

## Watchlist items

1. This zone has no direct automated coverage for Proof CSV column order or for
   preserving pulled flag ids across phone-to-desktop edits/deletes.
   Evidence: `rg --files tests` found only whisper, manuscript, cloud-message,
   prep export, quill export, and cloud-slim suites; the passing targeted test
   run did not touch these Proof flows.

2. Live Proof Listen verification remains constrained by the known Electron
   mirror-write safety blocker.
   Related evidence: existing blocker `SAS-AUD-20260530-001` in
   `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`.

## What was not tested

- No live Electron launch.
- No manuscript import, audio attach, or Whisper transcription run.
- No live CSV export file opened or compared.
- No live Supabase sign-in or push/pull round-trip.
- No live phone-to-desktop resync.
- No real or temp `Save Data/` mutation.
- No packaged build check.

## Possible duplicate bug references

- No exact existing bug-log duplicate was found for the swapped Proof CSV
  columns.
- No exact existing bug-log duplicate was found for the dropped pulled-flag
  `local_id` / `id` mismatch.
- `SAS-AUD-20260530-001` remains the related environment blocker for any future
  live Electron Proof test.

## Next checks

1. In a safe isolated Electron/phone audit workspace, export one Proof flag
   CSV from desktop and one from phone and confirm the column swap in the file
   output.
2. In the same safe setup, save a phone flag, resync desktop, then edit and
   delete that same flag on desktop and confirm whether duplicates or reappears
   happen after the next cloud pull.
3. Add targeted tests for Proof CSV column order and for preserving
   `script_sync_flags.local_id` as the in-app `flag.id` after cloud pull.
