# Inspector A - Zone 10

- Campaign: `2026-06-02-manual-start`
- Audit zone: `Exports, imports, release packages, and old-build confusion`
- Run date: `2026-06-02 15:29-15:32 PDT`
- Audit style: Static, read-only source and artifact review only

## Scope

- Checked desktop export/import flows tied to `exportBackup`, `importBackup`,
  `exportCsv`, `exportMarkersFolder`, `exportTransferBundle`, and
  `importTransferBundle`.
- Checked release/package handoff paths in `electron-builder.yml`,
  `scripts/copy-release.js`, `dist/`, and `Script and Sync Releases/`.
- Checked release-facing docs for handoff wording that can affect package or
  transfer use.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/WIRING_MATRIX.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `READ ME FIRST - OPEN THIS.txt`

## Commands Run With Exit Codes

| Command | Exit |
|---|---:|
| `git status --short` | 0 |
| `npm test -- --test-reporter=spec` | 0 |
| `find "Script and Sync Releases" -maxdepth 3 -type f | sort | sed -n '1,120p'` | 0 |
| `find dist -maxdepth 2 -type f | sort | sed -n '1,120p'` | 0 |
| `sed -n '1,220p' electron-builder.yml` | 0 |
| `sed -n '1,220p' package.json` | 0 |
| `plutil -p "Script and Sync Releases/StJohn Author Studio.app/Contents/Info.plist"` | 0 |
| `nl -ba scripts/copy-release.js | sed -n '1,260p'` | 0 |
| `nl -ba main.js | sed -n '1410,1665p'` | 0 |
| `nl -ba app/page.js | sed -n '1190,1275p'` | 0 |
| `rg -n "export-backup|import-backup|export-csv|export-markers-folder|export-transfer-bundle|import-transfer-bundle" main.js preload.js` | 0 |
| `rg -n "copy-release|StJohn Author Studio \\(Portable\\)|Windows portable|portable build|StJohn Author Studio \\(Windows\\)" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` | 1 |
| `rg -n "transfer manifest|audiobook-proofer|Script and Sync Transfer Folder|Import from other account|Audiobook Proofer transfer folder" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` | 1 |

## Evidence Paths

- `electron-builder.yml`
- `scripts/copy-release.js`
- `main.js`
- `preload.js`
- `app/page.js`
- `app/components/SessionsView.js`
- `app/components/PrebuildMode.js`
- `app/components/QuillAndInkMode.js`
- `dist/StJohn Author Studio (Portable).exe`
- `dist/StJohn Author Studio Setup.exe`
- `Script and Sync Releases/StJohn Author Studio (Windows).exe`
- `Script and Sync Releases/StJohn Author Studio Setup.exe`
- `Script and Sync Releases/StJohn Author Studio.app/Contents/Info.plist`
- `READ ME FIRST - OPEN THIS.txt`

## Pass Items

1. Current branded packaged outputs exist in the user-facing release folder for
   Mac and Windows setup/exe handoff. Evidence:
   `Script and Sync Releases/StJohn Author Studio.app`,
   `Script and Sync Releases/StJohn Author Studio (Windows).exe`,
   `Script and Sync Releases/StJohn Author Studio Setup.exe`,
   and `Info.plist` all show `StJohn Author Studio`.
2. The Electron bridge still exposes the expected export/import surface for
   backup JSON, CSV, marker folders, and transfer bundles. Evidence:
   `preload.js:23-28`, `main.js:1416-1470`, `main.js:1472-1665`,
   `app/page.js:1207-1264`, `app/components/SessionsView.js:367-379`,
   `app/components/PrebuildMode.js:978-981`,
   `app/components/QuillAndInkMode.js:699-717`.
3. Read-only test coverage stayed green during this zone. `npm test -- --test-reporter=spec`
   passed `13/13`, including cloud, Prep export, Quill export, and Whisper JSON
   helper tests.

## Fail Items

1. Windows release copy flow drops the portable artifact's real published name
   and rewrites it as `StJohn Author Studio (Windows).exe`. This creates a
   release-handoff mismatch between the build output and the packaged release
   folder.
   Evidence:
   `electron-builder.yml:40-49` emits `StJohn Author Studio (Portable).exe` and
   `StJohn Author Studio Setup.exe`.
   `scripts/copy-release.js:16-18` defines both portable and setup names, but
   `scripts/copy-release.js:127-139` copies the portable build into
   `WINDOWS_RELEASE_NAME` instead of `WINDOWS_PORTABLE_BUILD_NAME`.
   `dist/` contains `StJohn Author Studio (Portable).exe`, while
   `Script and Sync Releases/` does not; it contains only
   `StJohn Author Studio (Windows).exe` and setup.
   Result:
   the release script archives a portable slot but never republishes the
   portable artifact under that same name.
2. Transfer export/import still exposes old `Script and Sync` /
   `Audiobook Proofer` branding in user-facing transfer artifacts and errors.
   Evidence:
   `main.js:1572-1603` writes a manifest with `app: 'Script and Sync'`,
   `projectType: 'audiobook-proofer'`, and a `README.txt` headed
   `Script and Sync Transfer Folder` with `In Script and Sync...`.
   `main.js:1619-1633` still titles the picker `Select Script and Sync transfer folder`
   and throws `That folder is not an Audiobook Proofer transfer folder.`
   Result:
   export/import handoff can still present the old product identity even though
   the packaged app and current release branding are `StJohn Author Studio`.

## Watchlist Items

1. `READ ME FIRST - OPEN THIS.txt` still tells users to open
   `Script and Sync.app` / `Script and Sync (Windows).exe` and still frames the
   main folder as `Script and Sync 3.0`. This is already consistent with the
   open doc-drift family and should stay deduped unless the checker decides the
   release-handoff impact is severe enough to split it.
2. The release root folder is still named `Script and Sync Releases/`. Current
   source docs treat that folder as the official handoff location, so this run
   left it as a watchlist naming issue rather than calling it a separate new
   product bug.
3. `npm test` showed repeated `[MODULE_TYPELESS_PACKAGE_JSON]` warnings. This
   did not fail the zone, but it remains a packaging/runtime noise watch item.

## What Was Not Tested

- No live Electron export or import was run.
- No live backup JSON file was written or re-imported.
- No live transfer bundle was exported from temp data or imported back.
- No packaged Mac or Windows app was launched.
- No release script (`release:mac` / `release:win`) was executed in this run.
- No real `Save Data/` content was opened, changed, or compared.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` already covers the doc-drift family around old release
  wording in `READ ME FIRST - OPEN THIS.txt`.
- No existing bug-log or master-report entry was found for the Windows portable
  rename mismatch in `scripts/copy-release.js`.
- No existing bug-log or master-report entry was found for the stale
  `Script and Sync` / `Audiobook Proofer` branding inside transfer
  export/import artifacts.

## Next Checks

1. Checker should compare whether the Windows portable rename is intentional or
   whether Zone 10 should log it as a confirmed packaging bug.
2. A later safe isolated release audit should run `npm run release:win` against
   a temp audit copy and confirm the exact final contents of
   `Script and Sync Releases/`.
3. A later safe isolated Electron audit should export one transfer bundle from
   temp data, open the generated `README.txt` and manifest, then import that
   folder and confirm the user-facing wording and relink behavior.
