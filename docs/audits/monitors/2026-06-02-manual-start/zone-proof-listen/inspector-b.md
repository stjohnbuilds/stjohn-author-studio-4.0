# Inspector B - Zone 3 - Proof Listen

- Date: 2026-06-02
- Inspector: B
- Campaign: `2026-06-02-manual-start`
- Audit mode: read-only docs + source + safe tests only

## Scope

Proof Listen only:

- manuscript import and narrator mapping
- chapter audio attachment and restore
- transcription queue and Whisper handoff
- reader playback / sync / flag save paths
- Proof cloud sync shape and offline flag queue
- proof exports/rescan entry points

This run did not launch Electron or touch real Save Data.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

## Commands Run

- `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` -> exit `0`
- `sed -n '1,260p' docs/BUILD_PLAN_V4.md` -> exit `0`
- `sed -n '1,260p' docs/APP_STRUCTURE.md` -> exit `0`
- `sed -n '1,260p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> exit `0`
- `find docs/audits/monitors/2026-06-02-manual-start -maxdepth 2 -type d | sort` -> exit `0`
- `find docs/audits/monitors/2026-06-02-manual-start/zone-proof-listen -maxdepth 1 -type f | sort` -> exit `0`
- `rg -n "Proof Listen|ProofingReader|ManuscriptSetup|SessionsView|script_sync|proof-sync|flag|transcrib|rescan|transfer bundle|backup" docs/FRONT_FUNCTION_TREE.md docs/INTERNAL_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/CLOUD_SCHEMA.md docs/CLOUD_SAFETY_AUDIT.md` -> exit `0`
- `rg -n "ProofingReader|ManuscriptSetup|SessionsView|whisper|transcrib|exportBackup|importBackup|exportTransferBundle|importTransferBundle|rescanBook|rescanBookPageMap|rescanBookPdf|flag|script_sync" app/page.js main.js preload.js app/components/ManuscriptSetup.js app/components/SessionsView.js app/components/ProofingReader.js packages/cloud-sync/proof-sync.js app/lib/fuzzyMatcher.js app/lib/manuscriptPaging.js app/lib/pdfPaging.js` -> exit `0`
- `nl -ba app/page.js | sed -n '1080,1285p'` -> exit `0`
- `nl -ba app/page.js | sed -n '620,835p'` -> exit `0`
- `nl -ba app/page.js | sed -n '360,480p'` -> exit `0`
- `nl -ba app/components/SessionsView.js | sed -n '1160,1315p'` -> exit `0`
- `nl -ba app/components/SessionsView.js | sed -n '1360,1825p'` -> exit `0`
- `nl -ba app/components/ProofingReader.js | sed -n '360,760p'` -> exit `0`
- `nl -ba app/components/ManuscriptSetup.js | sed -n '1,260p'` -> exit `0`
- `nl -ba packages/cloud-sync/proof-sync.js | sed -n '1,360p'` -> exit `0`
- `nl -ba packages/cloud-sync/flag-queue.js | sed -n '1,320p'` -> exit `0`
- `nl -ba packages/cloud-sync/cloud-slim.js | sed -n '1,260p'` -> exit `0`
- `nl -ba app/lib/transcriptionWorker.js | sed -n '1,260p'` -> exit `0`
- `nl -ba app/phone/page.js | sed -n '1660,1775p'` -> exit `0`
- `cat package.json` -> exit `0`
- `npm test -- --runInBand tests/cloud-slim.test.mjs tests/whisper-json.test.mjs` -> exit `0`
- `rg -n "proof-sync|flag-queue|script_sync_flags|script_sync_projects" tests` -> exit `1`

## Evidence Paths

- `docs/FRONT_FUNCTION_TREE.md:29-50`
- `docs/INTERNAL_FUNCTION_TREE.md:25-27,48-58,69-72,95-107`
- `docs/SHARED_COMPONENTS.md:25,30,40`
- `docs/WIRING_MATRIX.md:32-47,86`
- `docs/CLOUD_SCHEMA.md:10-18,23-49,93-121`
- `docs/CLOUD_SAFETY_AUDIT.md:31-32,58-65,73-101`
- `app/page.js:387-458,639-670,780-819,944-978,1135-1285`
- `app/components/ManuscriptSetup.js:208-260,511-574,675-703,751-874`
- `app/components/SessionsView.js:425-444,493,1168-1234,1369-1805`
- `app/components/ProofingReader.js:369-705`
- `app/lib/transcriptionWorker.js:6-32,83-173`
- `packages/cloud-sync/proof-sync.js:46-210,213-340`
- `packages/cloud-sync/flag-queue.js:23-239`
- `packages/cloud-sync/cloud-slim.js:25-82`
- `tests/cloud-slim.test.mjs:1-55`
- `tests/whisper-json.test.mjs:1-44`

## Pass Items

1. Proof Listen still has a complete mapped source path for the main desktop workflow.
   Evidence: docs and code line up for manuscript import, audio attach, transcription, reader playback, flagging, CSV export, transfer bundle export/import, and page-map rescan in `docs/FRONT_FUNCTION_TREE.md:37-50`, `docs/WIRING_MATRIX.md:39-47`, `app/page.js:944-978,1207-1285`, `app/components/SessionsView.js:1168-1234,1369-1805`, and `app/components/ProofingReader.js:369-705`.
   Evidence level: code-traced, not live-tested.

2. Proof cloud sync is shaped to keep audio out of Supabase and split large proof data into dedicated tables.
   Evidence: `packages/cloud-sync/proof-sync.js:51-57` strips audio paths and slims the book before upload; `packages/cloud-sync/cloud-slim.js:25-82` removes section flag/transcription fields from `desktop_book`; `docs/CLOUD_SCHEMA.md:10-18,23-49` matches the three-table Proof shape.
   Evidence level: code-traced, not live-tested.

3. Safe helper tests passed in this repo during the run.
   Evidence: `npm test -- --runInBand tests/cloud-slim.test.mjs tests/whisper-json.test.mjs` exited `0` and ran 13 passing node tests, including `tests/whisper-json.test.mjs` and `tests/cloud-slim.test.mjs`.
   Evidence level: test-backed.

## Fail Items

1. Proof Listen cloud sync and offline flag queue have no direct automated test coverage in `tests/`, even though the cloud safety docs call for Proof push/pull/offline verification.
   Evidence: `rg -n "proof-sync|flag-queue|script_sync_flags|script_sync_projects" tests` exited `1`; the node test run completed with 13 passing tests but none targeted `packages/cloud-sync/proof-sync.js` or `packages/cloud-sync/flag-queue.js`; the checklist still expects Proof push/pull/offline checks in `docs/CLOUD_SAFETY_AUDIT.md:58-65,73-101`.
   Why this matters: the most failure-prone Proof paths here are sync merge, retry queue, and cloud round-trip, and they are not covered by the current safe suite.
   Evidence level: confirmed coverage gap, not a reproduced runtime bug.

## Watchlist Items

1. `pushProofProject()` deletes all proof transcription rows before inserting the replacement set.
   Evidence: `packages/cloud-sync/proof-sync.js:97-135`.
   Risk: if the insert step fails after delete, the cloud copy can lose all section transcriptions until a later successful push.
   Evidence level: code-traced only.

2. Proof reader remains a large standalone high-risk surface instead of the shared reader path the docs still target.
   Evidence: `docs/SHARED_COMPONENTS.md:40` calls `ProofingReader.js` migration pending; current proof reader still carries its own sync/flag logic in `app/components/ProofingReader.js:369-705`.
   Risk: proof-only regressions can hide in a large component that does not share the newer reader shell.
   Evidence level: code-traced only.

3. Phone Proof pending-queue state still looks globally counted rather than user-scoped.
   Evidence: `packages/cloud-sync/flag-queue.js:149-159` plus phone use sites in `app/phone/page.js:1714-1722,1752-1761`.
   Risk: likely same family as the existing phone pending-count watchlist.
   Evidence level: code-traced only.

## What Was Not Tested

- No live Electron Proof Listen run.
- No real manuscript import.
- No real audio attach or restore.
- No live Whisper transcription.
- No live page-map rescan.
- No live CSV or transfer bundle export.
- No live Supabase push/pull.
- No live offline flag retry.

Reason: the run stayed behind the read-only wall and avoided real Save Data after the known dev-mode mirror-write risk in `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` (`SAS-AUD-20260530-001`).

## Possible Duplicate Bug References

- `SAS-AUD-20260530-001` - relevant blocker for any future live Proof Listen Electron audit.
- `SAS-AUD-20260602-003` - likely same family as the phone Proof pending-count watchlist noted above.

## Next Checks

1. Run a future Proof Listen live audit only inside an isolated Electron home/data sandbox that cannot touch Marie's real Documents mirror.
2. Add direct tests for `packages/cloud-sync/proof-sync.js` and `packages/cloud-sync/flag-queue.js`, especially push/pull merge, offline save retry, offline delete retry, and cloud-newer/local-audio merge.
3. Live-verify one full Proof round trip: import manuscript, attach audio, transcribe, save/edit/delete flags, resync from phone, export CSV, then re-open the book and confirm audio/path/page-map persistence.
