# Conflict Ledger - Zone 10 Exports, Imports, Release Packages, and Old-Build Confusion

The three inspectors agreed that current packaged artifacts exist and that the
release folder is still the user-facing handoff boundary. The differences were
about which stale names should count as a new product bug, which ones were
already covered by doc drift, and whether the Windows portable rename was
intentional.

## Conflict 1 - Is the old release handoff note in `READ ME FIRST - OPEN THIS.txt` a new Zone 10 bug?

- Original Inspector A claim: the old release note belongs under the existing
  doc-drift family unless the checker finds a stronger package failure.
- Original Inspector B claim: the note is a deterministic release confusion
  failure because it tells users to open app names that no longer exist in the
  release folder.
- Original Inspector C claim: the note is a release-package fail because the
  file names in the note do not match the current packaged outputs.
- Evidence:
  - `READ ME FIRST - OPEN THIS.txt:28-30`
  - `READ ME FIRST - OPEN THIS.txt:35-49`
  - `Script and Sync Releases/StJohn Author Studio.app`
  - `Script and Sync Releases/StJohn Author Studio (Windows).exe`
  - `Script and Sync Releases/StJohn Author Studio Setup.exe`
- Checker follow-up audit: confirmed the mismatch is real and user-facing, but
  it is the same release-wording drift family already logged under
  `SAS-AUD-20260602-001`.
- Checker assessment: keep visible under the existing doc-drift item instead of
  creating a duplicate Zone 10 bug.
- Status: `resolved`
- Next check needed: docs-only cleanup later should align the release handoff
  note with the current package names.

## Conflict 2 - Do backup and transfer export/import flows still ship the old product identity?

- Original Inspector A claim: transfer export/import still exposes old
  `Script and Sync` / `Audiobook Proofer` branding in bundle artifacts and
  errors.
- Original Inspector B claim: backup and transfer export/import still expose
  old app names and mode identity in user-visible files and copy.
- Original Inspector C claim: app-generated backup and transfer artifacts still
  ship old `Script and Sync` / `audiobook-proofer` branding.
- Evidence:
  - `app/page.js:1207-1211`
  - `main.js:1417-1419`
  - `main.js:1572-1603`
  - `main.js:1618-1633`
- Checker follow-up audit: confirmed the old backup filename, transfer manifest
  filename/copy, transfer README heading, and transfer import dialog/error
  strings directly in the live source.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-014`.
- Status: `resolved`
- Next check needed: safe isolated backup export plus transfer export/import
  round trip to verify filenames, README text, and dialog wording after the
  later fix.

## Conflict 3 - Is the Windows `Portable` artifact being renamed incorrectly during release copy?

- Original Inspector A claim: the release copy flow drops the portable
  artifact's published name and turns it into
  `StJohn Author Studio (Windows).exe`, so the release handoff no longer
  matches the real built artifact name.
- Original Inspector B claim: did not raise this as a fail item.
- Original Inspector C claim: did not raise this exact rename as a fail item.
- Evidence:
  - `electron-builder.yml:45-49`
  - `scripts/copy-release.js:127-139`
  - `dist/StJohn Author Studio (Portable).exe`
  - `Script and Sync Releases/StJohn Author Studio (Windows).exe`
  - `TODAY-CHANGES-2026-05-23.md:69-71`
  - `DEVELOPER ONLY - EDIT AND BUILD HERE.txt:87-93`
- Checker follow-up audit: confirmed the rename happens on purpose and found
  current repo notes describing the final user-facing Windows portable build
  under the `(Windows).exe` name.
- Checker assessment: no new bug from the rename alone; treat it as current
  release intent unless a later isolated `release:win` run shows a real handoff
  failure.
- Status: `resolved`
- Next check needed: isolated `npm run release:win` verification to confirm
  the final release folder contents still match the intended handoff contract.

## Conflict 4 - Should missing automated coverage for release-copy and transfer flows become a bug?

- Original Inspector A claim: did not raise this as a fail item.
- Original Inspector B claim: no targeted automated coverage was found for
  backup export/import, transfer export/import, or `copy-release.js`.
- Original Inspector C claim: the same coverage gap remains visible and should
  stay on the follow-up list.
- Evidence:
  - `tests/`
  - `scripts/copy-release.js`
  - Inspector B and Inspector C report command output
- Checker follow-up audit: confirmed that the current test set does not target
  those flows, but this checker pass did not find a deterministic user-facing
  failure from the missing tests alone.
- Checker assessment: keep as a likely follow-up risk, not as a new bug entry
  in this zone.
- Status: `likely`
- Next check needed: add targeted tests later for backup naming, transfer
  bundle generation/import validation, and release-copy selection.
