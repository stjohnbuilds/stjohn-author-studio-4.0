# Zone Checker - Zone 10 Exports, Imports, Release Packages, and Old-Build Confusion

- Date/time: 2026-06-02 17:04 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for
  the exports/imports/release-packages/old-build-confusion zone only; preserve
  disagreements; run focused read-only follow-up where needed; dedupe before
  touching the master report or bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-exports-imports-release-packages-and-old-build-confusion/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-exports-imports-release-packages-and-old-build-confusion/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-exports-imports-release-packages-and-old-build-confusion/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main disagreements around:

- `scripts/copy-release.js`
- `electron-builder.yml`
- `main.js`
- `app/page.js`
- `READ ME FIRST - OPEN THIS.txt`
- `TODAY-CHANGES-2026-05-23.md`
- `DEVELOPER ONLY - EDIT AND BUILD HERE.txt`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p'` on the three Zone 10 inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba scripts/copy-release.js \| sed -n '1,240p'` | 0 |
| `nl -ba electron-builder.yml \| sed -n '1,120p'` | 0 |
| `nl -ba main.js \| sed -n '1410,1665p'` | 0 |
| `nl -ba app/page.js \| sed -n '1198,1215p'` | 0 |
| `nl -ba 'READ ME FIRST - OPEN THIS.txt' \| sed -n '24,60p'` | 0 |
| `rg -n "SAS-AUD-20260602-001\|audiobook-proofer-backup\|script-and-sync-transfer\|Script and Sync Transfer Folder\|Audiobook Proofer transfer folder\|portable" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` | 0 |
| `rg -n "StJohn Author Studio \\(Portable\\)\|Script and Sync \\(Windows\\)\|StJohn Author Studio \\(Windows\\)\|portable build" . -g '!node_modules' -g '!docs/audits/monitors/**'` | 0 |
| `ls -1 'Script and Sync Releases'` | 0 |
| `find dist -maxdepth 1 -type f \| sort` | 0 |
| `nl -ba TODAY-CHANGES-2026-05-23.md \| sed -n '64,71p'` | 0 |
| `nl -ba 'DEVELOPER ONLY - EDIT AND BUILD HERE.txt' \| sed -n '87,93p'` | 0 |

## Merged Findings

### PASS - The release handoff still uses a separate user-facing folder and the expected current artifacts are present

The three inspectors agreed on the core package shape, and the checker
follow-up did not find a contradiction:

- `electron-builder.yml` still builds into `dist/`.
- `scripts/copy-release.js` still promotes current artifacts into
  `Script and Sync Releases/`, which `docs/APP_STRUCTURE.md` treats as the
  real user-facing handoff folder.
- The release folder currently contains the branded Mac app, Windows runnable
  `.exe`, and Windows setup `.exe`.
- Export flows still use collision-safe naming instead of silently overwriting
  existing files.

Evidence:

- `electron-builder.yml:5-7`, `36-49`
- `scripts/copy-release.js:6-19`, `109-168`
- `docs/APP_STRUCTURE.md:25-34`
- `main.js:1417-1485`
- `Script and Sync Releases/StJohn Author Studio.app`
- `Script and Sync Releases/StJohn Author Studio (Windows).exe`
- `Script and Sync Releases/StJohn Author Studio Setup.exe`

### CONFIRMED BUG - Backup and transfer export/import surfaces still ship old `Script and Sync` / `Audiobook Proofer` branding

All three inspectors found stale branding in at least part of the
export/import surface, and the checker follow-up confirms it across both
backup and transfer flows:

- Desktop backup export still defaults to
  `audiobook-proofer-backup.json`.
- Browser fallback backup export uses the same old filename.
- Transfer export still writes `script-and-sync-transfer.json`, sets
  `app: 'Script and Sync'`, and writes a `README.txt` headed
  `Script and Sync Transfer Folder`.
- Transfer import still shows `Select Script and Sync transfer folder` and can
  reject with `That folder is not an Audiobook Proofer transfer folder.`

Checker assessment: confirmed export/import rebrand bug. The current package
name is `StJohn Author Studio`, but several shipped export/import filenames and
user-visible strings still present the older product identity. The
`manifestType` / `projectType` compatibility slugs may need backward-safe
handling later, but the user-visible naming problem is already confirmed from
current source.

Evidence:

- `app/page.js:1207-1211`
- `main.js:1417-1419`
- `main.js:1572-1603`
- `main.js:1618-1633`

### RESOLVED - The old app names in `READ ME FIRST - OPEN THIS.txt` stay under the existing doc-drift bug, not as a separate Zone 10 product bug

Inspectors B and C treated the release handoff note as a zone fail, while
Inspector A treated it as overlap with the existing doc-drift family. The
checker follow-up confirms this is real and user-facing, but it is already
covered by the existing documentation-drift item rather than a new separate
export bug:

- The note still tells users to open `Script and Sync.app`,
  `Script and Sync (Windows).exe`, and `Script and Sync Setup.exe`.
- The current release folder now contains `StJohn Author Studio.app`,
  `StJohn Author Studio (Windows).exe`, and
  `StJohn Author Studio Setup.exe`.

Checker assessment: resolved as duplicate overlap with
`SAS-AUD-20260602-001`. The checker kept the release-note mismatch visible by
expanding the existing doc-drift evidence instead of creating a second bug for
the same handoff note.

Evidence:

- `READ ME FIRST - OPEN THIS.txt:28-30`
- `READ ME FIRST - OPEN THIS.txt:35-49`
- `Script and Sync Releases/StJohn Author Studio.app`
- `Script and Sync Releases/StJohn Author Studio (Windows).exe`
- `Script and Sync Releases/StJohn Author Studio Setup.exe`

### RESOLVED - The Windows `Portable` to `(Windows)` release-folder rename looks intentional, not like a confirmed packaging failure

Inspector A flagged the rename mismatch between `dist/` and the final release
folder. The checker follow-up confirms the mismatch exists, but the current
repo intent points to it being a user-facing alias rather than a broken copy
step:

- `electron-builder.yml` emits `StJohn Author Studio (Portable).exe` in
  `dist/`.
- `scripts/copy-release.js` deliberately copies that file into
  `Script and Sync Releases/StJohn Author Studio (Windows).exe`.
- Earlier repo notes already describe the final user-facing Windows portable
  build as the `(Windows).exe` name.

Checker assessment: no separate bug added for the rename alone. The monitored
handoff boundary is `Script and Sync Releases/`, and the current repo history
shows intent to present the portable build there under the `(Windows).exe`
name. Old archive labels inside `Old/` remain naming drift, but they are not a
confirmed active release failure from this read-only slice.

Evidence:

- `electron-builder.yml:45-49`
- `scripts/copy-release.js:16-18`
- `scripts/copy-release.js:113-139`
- `TODAY-CHANGES-2026-05-23.md:69-71`
- `DEVELOPER ONLY - EDIT AND BUILD HERE.txt:87-93`
- `dist/StJohn Author Studio (Portable).exe`
- `Script and Sync Releases/StJohn Author Studio (Windows).exe`

### LIKELY - Release-copy and transfer flows still lack targeted automated coverage

Inspectors B and C both raised the weak coverage story, and Inspector A did
not contradict it:

- The current passing suite does not cover backup export/import.
- No targeted automated checks were found for transfer bundle export/import.
- No targeted automated checks were found for `scripts/copy-release.js`.

Checker assessment: likely tooling gap, but not a product bug by itself.
Keep it visible as a follow-up risk for later test work rather than a new bug
entry in this audit pass.

Evidence:

- `tests/`
- `scripts/copy-release.js`
- Inspector B and Inspector C report evidence lists

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed the old
  `READ ME FIRST - OPEN THIS.txt` release-handoff wording already belongs to
  existing doc-drift item `SAS-AUD-20260602-001`, so this checker pass updated
  that item instead of duplicating it.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: found no existing confirmed-bug
  entry for the backup filename plus transfer-bundle naming/copy drift, so
  this pass adds a new bug entry for that distinct generated-artifact surface.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: found no earlier Zone 10
  checker section, so this run appends one new checker section rather than
  updating an older zone-checker entry.

## Overall Assessment

- Zone status: checked
- Audit result: one new confirmed export/import branding bug; one existing
  doc-drift item expanded; Windows portable release-name mismatch treated as
  intentional release alias rather than a new packaging bug
- Confidence: high
- Why not higher: this zone stayed static/read-only, so there was no live
  Electron backup export, transfer round trip, or isolated `release:win`
  execution

## Next Steps

- Later safe Electron export/import test: export one backup and one transfer
  folder from temp data, open the generated files, then import the transfer
  folder back and confirm the user-visible naming matches the intended
  `StJohn Author Studio` handoff.
- Later safe release test: run `npm run release:win` in an isolated audit copy
  and confirm the final user-facing release folder still contains the intended
  Windows executable names.
- Later test-coverage follow-up: add targeted checks for backup filename
  generation, transfer manifest/README/dialog copy, and the release-copy
  selection path.
- Next later checker-ready zone is `zone-internal-architecture`; if that zone
  is still unchanged on the next wake-up, merge it next.
