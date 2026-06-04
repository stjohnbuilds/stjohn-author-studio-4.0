# Inspector C - Zone 10

## Scope

Independent read-only audit of Zone 10: exports, imports, release packages, and
old-build confusion.

This run stayed static/read-only. I did not read Inspector A/B reports, did
not run Electron, did not build packages, and did not touch real Save Data.

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

| Command | Exit |
|---|---:|
| `git status --short` | 0 |
| `sed -n '1,220p' package.json` | 0 |
| `rg -n "exportBackup|importBackup|exportTransferBundle|importTransferBundle|exportCsv|exportMarkersFolder|Script and Sync Releases|dist/|dist\\b|electron-builder|artifactName|release" main.js preload.js app packages scripts docs -g '!node_modules'` | 0 |
| `find . -maxdepth 2 \( -path './Script and Sync Releases' -o -path './dist' -o -path './out' \) -print` | 0 |
| `nl -ba main.js | sed -n '180,260p'; ... '1180,1715p'` | 0 |
| `nl -ba scripts/copy-release.js | sed -n '1,240p'; nl -ba electron-builder.yml | sed -n '1,240p'` | 0 |
| `nl -ba 'READ ME FIRST - OPEN THIS.txt' | sed -n '1,220p'; ls -1 'Script and Sync Releases'` | 0 |
| `rg -n "transfer bundle|export-backup|import-backup|export-csv|markers-folder|backup|csv|transfer" tests scripts -g '!node_modules'` | 0 |
| `rg -n "audiobook-proofer|Script and Sync Transfer Folder|Import from other account|Script and Sync.app|Script and Sync \\(Windows\\)|audiobook-proofer-backup|StJohn Author Studio" app main.js preload.js scripts 'READ ME FIRST - OPEN THIS.txt' docs tests -g '!node_modules'` | 0 |
| `test -d 'Script and Sync Releases/StJohn Author Studio.app' ...` plus Windows release presence checks | 0 |

## Evidence Paths

- `main.js`
- `preload.js`
- `app/page.js`
- `app/components/QuillAndInkMode.js`
- `app/components/PrebuildMode.js`
- `app/components/SessionsView.js`
- `scripts/copy-release.js`
- `package.json`
- `electron-builder.yml`
- `READ ME FIRST - OPEN THIS.txt`
- `Script and Sync Releases/`

## Pass Items

1. Release staging is clearly separated from the user-facing handoff folder.
   Evidence: `electron-builder.yml:5-7` still builds into `dist`; `package.json:12-19`
   sends release flows through `scripts/copy-release.js`; `scripts/copy-release.js:7-19`
   and `109-168` copy/move current artifacts into `Script and Sync Releases/`; the
   folder currently contains `StJohn Author Studio.app`,
   `StJohn Author Studio (Windows).exe`, and `StJohn Author Studio Setup.exe`.

2. Export/download collision protection is present across Electron save flows
   and browser-triggered downloads.
   Evidence: `main.js:88-104` defines `uniqueExportPath`; `main.js:1193-1204`
   applies it to all browser downloads; `main.js:1417-1464` and `1481-1485`
   apply it to backup, CSV, marker-folder, and transfer-folder exports.

## Fail Items

1. The user-facing release handoff note still tells people to open old
   `Script and Sync` app names that do not match the current packaged files.
   Evidence: `READ ME FIRST - OPEN THIS.txt:29-49` tells users to open
   `Script and Sync.app`, `Script and Sync (Windows).exe`, and
   `Script and Sync Setup.exe`, while the actual packaged outputs under
   `Script and Sync Releases/` are `StJohn Author Studio.app`,
   `StJohn Author Studio (Windows).exe`, and `StJohn Author Studio Setup.exe`.

2. App-generated export/import artifacts still ship old `Script and Sync` /
   `audiobook-proofer` branding, so transfer and backup handoff text is still
   out of sync with the current app name.
   Evidence:
   - `main.js:1416-1423` saves backups as `audiobook-proofer-backup.json`.
   - `app/page.js:1207-1211` uses the same old backup filename in the web fallback.
   - `main.js:1572-1603` writes a transfer manifest with
     `app: 'Script and Sync'`, `projectType: 'audiobook-proofer'`, and a
     `README.txt` headed `Script and Sync Transfer Folder`.
   - `main.js:1617-1632` labels the import picker and errors as
     `Script and Sync transfer folder` / `Audiobook Proofer transfer folder`.
   - `scripts/copy-release.js:113-123` and `160-163` still archive older
     release artifacts under `Script and Sync ... old ...` names.

## Watchlist Items

1. I found almost no automated coverage for backup export/import, transfer
   bundle export/import, or release-copy behavior.
   Evidence: `rg -n "transfer bundle|export-backup|import-backup|export-csv|markers-folder|backup|csv|transfer" tests scripts -g '!node_modules'`
   only surfaced Quill exporter assertions in `tests/quill-exporters.test.mjs:78-91`;
   no targeted automated checks were found for the backup/transfer IPC paths or
   `scripts/copy-release.js`.

## What Was Not Tested

- No live Electron export/import flow.
- No real backup JSON export or import.
- No real transfer-folder export or import.
- No Mac app launch from `Script and Sync Releases/StJohn Author Studio.app`.
- No Windows portable or installer launch.
- No `npm test`, `npm run build`, `npm run release:mac`, or `npm run release:win`.
- No real Save Data reads or writes.

## Possible Duplicate Bug References

- Likely duplicate or extension of `SAS-AUD-20260602-001` for old
  release-handoff wording in `READ ME FIRST - OPEN THIS.txt`.
- The transfer/backup naming drift may belong under the same release-confusion
  family, but it reaches beyond docs into app-generated bundle text and dialog
  copy. The checker/lead should decide whether that stays folded into
  `SAS-AUD-20260602-001` or becomes a separate Zone 10 item.

## Next Checks

- Live-test one backup export/import in an isolated Electron run.
- Live-test one transfer-folder export/import in an isolated Electron run.
- Confirm whether the shipped `README.txt` inside transfer bundles should now
  say `StJohn Author Studio`.
- After any wording fix, verify `READ ME FIRST - OPEN THIS.txt`, backup
  filenames, transfer manifest metadata, transfer README text, and import
  dialog copy all match the packaged release names.
