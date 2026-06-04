# Inspector B - Zone 3 - Exports, Imports, Release Packages, and Old-Build Confusion

- Date: 2026-06-02
- Inspector: B
- Campaign: `2026-06-02-manual-start`
- Audit mode: read-only docs + source + safe tests only

## Scope

Exports/imports/release-packages/old-build confusion only:

- backup export/import naming and handoff
- transfer export/import naming, manifest, and README flow
- Electron export handlers and collision-safe output behavior
- packaged-release scripts and current packaged artifact names
- user-facing release handoff docs and old-build clutter

This run did not launch Electron, did not run `release:mac` or `release:win`,
did not import/export a live backup or transfer bundle, and did not touch real
Save Data.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `READ ME FIRST - OPEN THIS.txt`
- `package.json`
- `electron-builder.yml`

## Commands Run With Exit Codes

- `date '+%Y-%m-%d %H:%M:%S %Z'` -> `0`
- `git status --short` -> `0`
- `if [ -f .env.local ]; then echo '.env.local: present'; else echo '.env.local: missing'; fi ...` -> `0`
- `find docs/audits/monitors/2026-06-02-manual-start -maxdepth 1 -type d | sort` -> `0`
- `find docs/audits/monitors/2026-06-02-manual-start -maxdepth 2 -type f \( -name 'inspector-a.md' -o -name 'inspector-c.md' \) | sort` -> `0`
- `npm test -- --test-reporter=spec` -> `0`
- `rg -n "exportBackup|importBackup|exportCsv|exportTransferBundle|importTransferBundle|exportMarkersFolder|Script and Sync Releases|old-build|old build|release" app main.js preload.js package.json docs tests packages scripts` -> `0`
- `nl -ba app/page.js | sed -n '1180,1285p'` -> `0`
- `nl -ba app/page.js | sed -n '1640,1665p'` -> `0`
- `nl -ba main.js | sed -n '1,120p'` -> `0`
- `nl -ba main.js | sed -n '400,470p'` -> `0`
- `nl -ba main.js | sed -n '1180,1515p'` -> `0`
- `nl -ba main.js | sed -n '1515,1755p'` -> `0`
- `nl -ba preload.js | sed -n '1,80p'` -> `0`
- `nl -ba scripts/copy-release.js | sed -n '1,240p'` -> `0`
- `nl -ba 'READ ME FIRST - OPEN THIS.txt' | sed -n '1,140p'` -> `0`
- `nl -ba package.json | sed -n '1,120p'` -> `0`
- `nl -ba electron-builder.yml | sed -n '1,200p'` -> `0`
- `rg -n "audiobook-proofer|Audiobook imported|Transfer folder created|Script and Sync|StJohn Author Studio|transfer" app main.js scripts tests docs/APP_STRUCTURE.md docs/BUILD_PLAN_V4.md 'READ ME FIRST - OPEN THIS.txt' package.json --glob '!docs/audits/**'` -> `0`
- `find tests -maxdepth 2 -type f | sort | sed -n '1,200p'` -> `0`
- `du -sh 'Script and Sync Releases/Old'; find 'Script and Sync Releases/Old' -maxdepth 1 | wc -l` -> `0`
- `rg -n "audiobook-proofer|script-and-sync-transfer|READ ME FIRST|release wording|Script and Sync Releases|StJohn Author Studio" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> `0`

## Evidence Paths

- `package.json:15-19`
- `electron-builder.yml:1-55`
- `scripts/copy-release.js:8-19,109-168`
- `READ ME FIRST - OPEN THIS.txt:6-12,18-18,23-49,53-55`
- `app/page.js:1207-1212,1223-1284,1651-1653`
- `preload.js:23-28`
- `main.js:83-103,429-435,1415-1455,1472-1680`
- `Script and Sync Releases/StJohn Author Studio.app`
- `Script and Sync Releases/StJohn Author Studio (Windows).exe`
- `Script and Sync Releases/StJohn Author Studio Setup.exe`
- `Script and Sync Releases/Old/`

## Pass Items

1. The current build/release configuration and the current packaged artifacts
   agree on the `StJohn Author Studio` product name. `package.json:15-19`,
   `electron-builder.yml:1-55`, and `scripts/copy-release.js:16-19` all target
   `StJohn Author Studio` names, and the release folder currently contains
   `StJohn Author Studio.app`, `StJohn Author Studio (Windows).exe`, and
   `StJohn Author Studio Setup.exe`.

2. The desktop export paths still use collision-safe output naming instead of
   silently overwriting existing files. `main.js:83-103` defines
   `uniqueExportPath()`, `main.js:1201-1207` applies it to in-app downloads,
   and `main.js:1417-1454` plus `1472-1485` apply it to backup, CSV, marker,
   and transfer-folder save destinations.

3. The transfer import path has compatibility fallback for the manifest file
   location/name rather than assuming one exact filename. `main.js:429-435`
   looks for `script-and-sync-transfer.json`, `transfer-manifest.json`, and
   `data/script-and-sync-transfer.json` before import proceeds.

## Fail Items

1. The user-facing release handoff note still tells people to open old
   `Script and Sync` app names that no longer match the packaged artifacts.
   `READ ME FIRST - OPEN THIS.txt:28-30,35-49` tells users to open
   `Script and Sync.app`, `Script and Sync (Windows).exe`, and
   `Script and Sync Setup.exe`, but the actual release folder currently holds
   `StJohn Author Studio.app`, `StJohn Author Studio (Windows).exe`, and
   `StJohn Author Studio Setup.exe`. This is deterministic release confusion,
   not a hypothetical drift. Possible duplicate bug reference:
   `SAS-AUD-20260602-001`.

2. The backup and transfer export/import surfaces still expose old product
   names and old mode identity in user-visible files and copy. The web backup
   download name is `audiobook-proofer-backup.json` at
   `app/page.js:1209-1212`, the Electron backup default path is the same at
   `main.js:1417-1424`, the transfer manifest is written as
   `script-and-sync-transfer.json` with `app: 'Script and Sync'` and
   `projectType: 'audiobook-proofer'` at `main.js:1572-1596`, the bundled
   `README.txt` says `Script and Sync Transfer Folder` and tells the user
   `In Script and Sync...` at `main.js:1598-1603`, and the import dialog/error
   copy still says `Select Script and Sync transfer folder` /
   `Audiobook Proofer transfer folder` at `main.js:1618-1633`. The flow may
   still function, but the shipped export/import surfaces are not rebranded to
   the current app identity. No exact existing bug-log duplicate was found for
   the backup/transfer naming drift beyond the broader doc-drift family.

## Watchlist Items

1. I did not find targeted automated coverage for backup export/import,
   transfer export/import, or `copy-release.js`. The current passing suite is
   `tests/cloud-error-message.test.mjs`,
   `tests/cloud-slim.test.mjs`,
   `tests/manuscript-engine.test.mjs`,
   `tests/prep-export.test.mjs`,
   `tests/quill-exporters.test.mjs`, and
   `tests/whisper-json.test.mjs`; none exercise the release-package or
   transfer-bundle paths.

2. The old-build archive is still large enough to remain a release-hygiene and
   confusion risk even though the live release files are correct. This run's
   read-only disk check showed `Script and Sync Releases/Old/` at `39G` with
   `70` top-level entries. I did not treat size alone as a confirmed product
   bug, but it remains a practical old-build-risk surface for handoff and disk
   management.

## What Was Not Tested

- No live backup export or backup import file was created/opened.
- No live transfer-folder export or transfer-folder import was run.
- No Mac app launch from `Script and Sync Releases/StJohn Author Studio.app`.
- No Windows portable or installer launch.
- No `npm run release:mac` or `npm run release:win`.
- No verification that copied transfer audio/manuscript files round-trip on a
  second machine.
- No verification that old manifest compatibility works with a real legacy
  bundle.

Reason: this run stayed inside the read-only wall and used static source reads,
disk checks, and safe test commands only.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` for the existing doc-drift / release-wording family in
  `READ ME FIRST - OPEN THIS.txt`.
- No exact current bug-log duplicate found for the backup filename and
  transfer-surface old-branding drift.
- Similar old-build hygiene concerns were already raised in
  `docs/dev/active/distribution-readiness-audit-2026-05-27/REPORT.md`
  (`ISSUE-004` and `ISSUE-005`), but this run did not modify or merge that
  earlier audit.

## Next Checks

1. In a safe isolated Electron run, export one backup and one transfer folder,
   then confirm the filenames, README text, import dialog copy, and manifest
   fields all match the intended `StJohn Author Studio` handoff language.
2. Run a real transfer round trip using a copied test manuscript/audio set and
   confirm the current import path still works after any wording/filename
   cleanup needed for the rebrand.
3. Add targeted tests for transfer manifest generation/import validation and
   for `scripts/copy-release.js` output selection so future rebrand drift is
   caught automatically.
