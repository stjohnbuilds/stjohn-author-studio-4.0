# Script and Sync Audit Bug Log

This is the live bug queue for the Script and Sync / StJohn Author Studio 4.0
audit. It is for documentation only. Do not fix items while auditing unless
Marie explicitly switches the task from audit to repair.

Source goals checked before starting this log:

- `READ ME FIRST - OPEN THIS.txt`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

Runbook: `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`

## Status Key

- `open`
- `needs-navigation-proof`
- `needs-real-file`
- `environment-blocked`
- `ready-for-fix`
- `fix-in-progress`
- `fixed-awaiting-verification`
- `fixed-archived`

## Active Confirmed Bugs

### SAS-AUD-20260602-004 - Proof flag exports label the quote column as `Note`

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P2
- Area: Proof / Export
- Plain-English summary: Proof exports and the reader row preview put the
  quoted misread text under a column labeled `Note`, so the output headings do
  not match the actual data.
- Source goal or expected behavior: `app/page.js:2349` says each Proof flag
  captures the misread quote plus the user's note, so export and preview labels
  should clearly separate quote text from the `Should say / note` correction.
- Navigation path tried: Static read-only audit only. Compared the desktop
  book-detail export, the desktop reader export, the desktop reader row preview,
  and the phone Proof CSV builder. No live CSV file was opened in this run.
- Exact test data used: Source only. No live manuscript, audio, or cloud test
  data used.
- Expected result: Proof exports and preview should show the quote under a
  quote-specific label and the correction note under `Should Say` or another
  matching correction label.
- Actual result: The desktop book-detail CSV export, desktop in-reader CSV
  export, desktop in-reader row preview, and phone Proof CSV export all label
  the seventh column `Note` while writing `sentPlain` / `quote` into that
  column. The eighth `Should Say` column receives the correction note.
- Evidence:
  - `app/components/SessionsView.js:306-313`, `385-387`
  - `app/components/ProofingReader.js:872-883`, `1091-1095`, `1292-1333`
  - `app/phone/page.js:152-170`
  - `app/page.js:2349`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and existing checked zone
  outputs. No matching Proof export-label bug was already logged.
- Why this is not tester confusion: The header/value mismatch is visible
  directly in the current source for all live Proof export paths and the
  reader's own preview row.
- Likely files to inspect: `app/components/SessionsView.js`,
  `app/components/ProofingReader.js`, `app/phone/page.js`.
- Suggested fix direction: Align the Proof export and preview headers with the
  current flag schema so the quote column is labeled as quote text and the
  correction note stays clearly labeled `Should Say` or equivalent across
  desktop and phone.
- Verification needed after fix: Export one Proof CSV from the desktop book
  view, one from the desktop reader, and one from phone, then confirm the
  headers match the actual quote/correction fields and the reader preview
  matches the file output.
- Archive notes:

### SAS-AUD-20260602-005 - Prep Fix/rescan can reassign later duplicate quotes to the first match

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P1
- Area: Prep / Fix Flow / Assignment
- Plain-English summary: In Prep Manuscript, if the same quote text appears
  more than once in one section and Marie uses the Fix button on a warning,
  the rescan logic can silently copy the first duplicate's narrator assignment
  onto later duplicates.
- Source goal or expected behavior: Prep's Fix flow should preserve existing
  line assignments when it rescans edited paragraph text, especially when the
  rest of the mode and the export tests already treat repeated dialogue by
  occurrence, not text alone.
- Navigation path tried: Static read-only audit only. Compared the Fix/rescan
  merge path, assignment path, current span lookup, and duplicate-aware export
  tests. No live Electron session was run in this zone.
- Exact test data used: Source only. No live manuscript, audio, or Save Data
  used.
- Expected result: After editing a warning paragraph, each repeated dialogue
  line should keep its own prior character/side-voice assignment.
- Actual result: `updateSectionHtml()` builds a map keyed only by `sp.text`,
  keeps the first old span for each repeated quote text, and reapplies that one
  prior assignment to every new span with the same text after the rescan.
- Evidence:
  - `app/components/PrepManuscriptMode.js:517-535`
  - `app/components/PrepManuscriptMode.js:561-579`
  - `app/components/PrepManuscriptMode.js:759-763`
  - `tests/prep-export.test.mjs:120-213`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. No matching Prep Fix/rescan duplicate-assignment bug was already
  logged.
- Why this is not tester confusion: The current merge logic deterministically
  keys prior assignments by quote text only, so repeated identical text cannot
  keep distinct assignments through the Fix/rescan path.
- Likely files to inspect: `app/components/PrepManuscriptMode.js` and any new
  targeted tests for the Fix/rescan merge path.
- Suggested fix direction: Preserve reassigned spans by occurrence/context
  instead of first-text-match only, using the same duplicate-aware thinking the
  Prep DOCX export tests already require.
- Verification needed after fix: In a safe isolated Prep run, assign two
  identical quotes differently, use the Fix flow on the section, save, and
  confirm both duplicates keep the correct assignments in the reader and
  exports.
- Archive notes:

### SAS-AUD-20260602-006 - Quill annotation delete can leave same-range character markers behind

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P2
- Area: Quill / Reader / Annotation Delete
- Plain-English summary: In Quill & Ink, deleting an annotation that has
  attached character markers can remove only the main annotation and leave the
  same-range character markers behind.
- Source goal or expected behavior: The Quill reader edit flow should treat the
  main annotation plus its attached same-range character markers as one cleanup
  unit when Marie deletes that annotation, so the dock, exports, and sync state
  do not keep stale leftovers.
- Navigation path tried: Static read-only audit only. Compared the Quill edit
  popover load/save/delete paths, the bottom annotation-dock delete path, and
  the exporter/cloud consumers. No live Electron Quill run was performed in
  this zone.
- Exact test data used: Source only. No live manuscript, audio, cloud, or Save
  Data used.
- Expected result: Deleting a Quill annotation should also remove any
  same-range attached character markers that the same edit session loaded and
  would otherwise rebuild on save.
- Actual result: `openExistingAnnotation()` preloads same-range character
  markers into the current edit session and `saveAnnotation()` drops and
  recreates them as a grouped edit, but `deleteEditingAnnotation()` and
  `deleteAnnotation()` each filter only one annotation id, leaving same-range
  character markers behind.
- Evidence:
  - `app/components/QuillAndInkMode.js:1456-1464`
  - `app/components/QuillAndInkMode.js:1484-1541`
  - `app/components/QuillAndInkMode.js:1545-1558`
  - `app/components/QuillAndInkMode.js:1916-1984`
  - `packages/quill-engine/annotations.js:121-152`
  - `packages/quill-engine/exporters.js:11-26`, `61-71`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. No matching Quill grouped-delete / orphaned-character-marker bug was
  already logged.
- Why this is not tester confusion: The current edit flow already treats those
  character markers as part of the same edit session on load and save, but the
  delete paths deterministically skip that grouped cleanup.
- Likely files to inspect: `app/components/QuillAndInkMode.js` and any new
  targeted Quill reader tests for grouped delete behavior.
- Suggested fix direction: Make the Quill delete paths mirror the grouped
  cleanup already used by `saveAnnotation()`, so deleting an annotation clears
  its same-range character-marker companions too.
- Verification needed after fix: In a safe isolated Quill run, create an
  annotation with attached character markers, delete it from both the popover
  and the bottom dock, then confirm no leftover markers remain in the dock,
  export output, or sync payload.
- Archive notes:

### SAS-AUD-20260602-007 - Removing a Quill chapter can leave stale annotations that still export or sync

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P1
- Area: Quill / Book Detail / Chapter Removal
- Plain-English summary: In Quill & Ink, removing a chapter from book detail
  can leave that chapter's annotations behind, so stale annotations can still
  export or sync after the chapter is gone.
- Source goal or expected behavior: Removing a chapter should also remove or
  otherwise neutralize annotations that belong only to that removed chapter, so
  saved state, exports, and cloud sync stay aligned with the visible chapter
  list.
- Navigation path tried: Static read-only audit only. Compared the Quill
  book-detail adapter, the `onUpdateBook` handoff, the cloud chapter-id map,
  and the exporter inputs. No live Electron Quill run was performed in this
  zone.
- Exact test data used: Source only. No live manuscript, audio, cloud, or Save
  Data used.
- Expected result: After Marie removes a Quill chapter, annotations for that
  chapter should not remain in the saved project or later export/sync paths.
- Actual result: The `onUpdateBook` bridge filters kept chapters and audio by
  `keptIds`, but it never filters `p.annotations` for removed chapter ids.
  Later cloud push maps unknown chapter ids to `chapter_id: null`, and the
  exporters still iterate the full remaining annotations array.
- Evidence:
  - `app/components/QuillAndInkMode.js:821-828`
  - `app/components/QuillAndInkMode.js:891-948`
  - `app/components/QuillAndInkMode.js:961-969`
  - `packages/cloud-sync/quill-sync.js:111-123`
  - `packages/quill-engine/exporters.js:11-26`, `38-46`, `61-71`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. No matching Quill removed-chapter / stale-annotation cleanup bug was
  already logged.
- Why this is not tester confusion: The current bridge-back update path
  deterministically prunes chapters and audio but not annotations, and the
  downstream cloud/export code paths continue consuming the leftover
  annotations.
- Likely files to inspect: `app/components/QuillAndInkMode.js`,
  `packages/cloud-sync/quill-sync.js`, `packages/quill-engine/exporters.js`,
  and any new tests that cover chapter removal cleanup.
- Suggested fix direction: Prune or remap annotations when the Quill chapter
  list changes so removed-chapter annotations cannot remain in local state,
  exports, or cloud payloads.
- Verification needed after fix: In a safe isolated Quill run, annotate a
  chapter, remove that chapter from book detail, save, then confirm the
  annotation is gone from the reader state, export output, and cloud payload.
- Archive notes:

### SAS-AUD-20260602-008 - Duet scans can still show as incomplete in the shared book-detail flow

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P2
- Area: Duet Prep / Book Detail / Scan Status
- Plain-English summary: In Duet Prep, a chapter can finish scanning but still
  appear incomplete in the shared chapter list and completion counts until
  Marie manually toggles it done.
- Source goal or expected behavior: A successful Duet scan should carry its
  finished state into the shared book-detail progress view unless Marie has
  explicitly overridden that chapter's completion state.
- Navigation path tried: Static read-only audit only. Compared the Duet scan
  path, Duet progress counters, the shared book-detail adapter, and the manual
  completion-toggle handoff. No live Electron Duet session was run in this
  zone.
- Exact test data used: Source only. No live manuscript, audio, export, or
  Save Data used.
- Expected result: After a successful Duet chapter scan, the shared chapter
  list and completion totals should reflect that finished scan without requiring
  a manual checkbox click.
- Actual result: `scanChapterIntoProject()` writes `transcribed: true`, and
  Duet's own counters and scan badges read that property, but the shared
  book-detail adapter falls back to `!!ch.scanned` for `completed`. Because the
  Duet scan path never writes `scanned`, a freshly scanned chapter can still
  show incomplete until Marie manually toggles completion.
- Evidence:
  - `app/components/PrebuildMode.js:505-515`
  - `app/components/PrebuildMode.js:766-805`
  - `app/components/PrebuildMode.js:1129-1143`
  - `app/components/PrebuildMode.js:1195-1220`
  - `app/components/SessionsView.js:518-520`, `2826-2829`, `3098-3100`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. No matching Duet scan/completion-state bug was already logged.
- Why this is not tester confusion: The current source uses `transcribed` as
  the Duet scan-state flag and then switches to a different never-written
  `scanned` property when adapting that same data into the shared completion
  view.
- Likely files to inspect: `app/components/PrebuildMode.js`,
  `app/components/SessionsView.js`, and any new Duet scan-status tests.
- Suggested fix direction: Align the shared completion fallback with Duet's
  actual scan-state field or write the shared completion field during scan,
  while preserving the existing manual completion override.
- Verification needed after fix: In a safe isolated Duet run, scan one
  chapter, return to the shared book-detail list, and confirm the chapter count
  and completion indicator update before any manual toggle.
- Archive notes:

### SAS-AUD-20260602-009 - Duet marker export can emit invalid `...1000` millisecond start times

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P2
- Area: Duet Prep / Export / Marker Files
- Plain-English summary: Duet marker export can write start times like
  `1:01.1000` instead of rolling that rounding overflow into the next second.
- Source goal or expected behavior: Audition marker exports should always emit
  valid decimal time strings with three-digit milliseconds in the `Start`
  column.
- Navigation path tried: Static read-only audit only. Compared the Duet marker
  formatter and export row builder, then ran a read-only Node reproduction of
  the formatter. No live marker file was exported from the app in this zone.
- Exact test data used: Source only plus a read-only formatter reproduction
  using boundary-case seconds values `61.9996` and `3599.9996`.
- Expected result: Boundary-case marker times should roll cleanly to the next
  second and stay in valid `M:SS.mmm` or `H:MM:SS.mmm` format.
- Actual result: `formatAuditionTime()` rounds milliseconds but never carries
  `1000` milliseconds into the next second, and the export path writes that
  raw formatter output straight into the marker `Start` column. The read-only
  reproduction returned `1:01.1000` for `61.9996` and `59:59.1000` for
  `3599.9996`.
- Evidence:
  - `app/components/PrebuildMode.js:196-204`
  - `app/components/PrebuildMode.js:941-965`
  - Read-only reproduction command output:
    - `61.9996 => 1:01.1000`
    - `3599.9996 => 59:59.1000`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. No matching Duet marker-time overflow bug was already logged.
- Why this is not tester confusion: The formatter behavior is deterministic in
  source and reproduces directly in a read-only Node check without any live UI
  or export dialog.
- Likely files to inspect: `app/components/PrebuildMode.js` and any new Duet
  marker-export or formatter unit tests.
- Suggested fix direction: Carry millisecond rounding overflow into the next
  second before building the export string, and add a targeted test for values
  that currently round to `...1000`.
- Verification needed after fix: Export a safe Duet marker file that includes a
  boundary-case insertion time and confirm the written `Start` value stays
  valid in the file and any downstream Audition import check.
- Archive notes:

### SAS-AUD-20260602-010 - Proof and Quill cloud pulls can silently rebuild partial or stale data after secondary query failures

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P1
- Area: Cloud / Proof Pull / Quill Pull
- Plain-English summary: If later Proof or Quill cloud queries fail after the
  top-level project list loads, the app can still return a project list that
  looks successful while flags, transcriptions, chapters, or annotations are
  missing or stale.
- Source goal or expected behavior: Cloud pulls should surface a real sync
  failure when required secondary data cannot be read, rather than rebuilding a
  partial project silently.
- Navigation path tried: Static read-only audit only. Compared the Proof and
  Quill pull helpers and the later merge/rebuild logic. No live Supabase pull
  was run in this zone.
- Exact test data used: Source only. No live account, cloud rows, audio, or
  Save Data used.
- Expected result: If the secondary Proof or Quill pull queries fail, the pull
  should throw or clearly report sync failure instead of returning a partial or
  stale project list.
- Actual result: `pullProofProjects()` checks only the
  `script_sync_projects` query error and ignores later
  `script_sync_section_transcriptions` and `script_sync_flags` errors.
  `pullQuillProjects()` checks only the `quill_projects` query error and
  ignores later `quill_chapters` and `quill_annotations` errors before
  rebuilding the project list.
- Evidence:
  - `packages/cloud-sync/proof-sync.js:216-231`
  - `packages/cloud-sync/proof-sync.js:233-286`
  - `packages/cloud-sync/quill-sync.js:162-177`
  - `packages/cloud-sync/quill-sync.js:179-285`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. No exact existing bug covered the shared secondary-query pull
  failure pattern across Proof and Quill.
- Why this is not tester confusion: The current pull helpers visibly ignore the
  later query `error` values in source, so they can keep rebuilding data after
  a failed secondary read.
- Likely files to inspect: `packages/cloud-sync/proof-sync.js`,
  `packages/cloud-sync/quill-sync.js`, and any new targeted cloud-pull failure
  tests.
- Suggested fix direction: Treat required secondary-query failures as real pull
  failures, and add targeted regression coverage for Proof and Quill partial
  read errors.
- Verification needed after fix: In a safe signed-in test or targeted mocked
  test, force a secondary Proof pull failure and a secondary Quill pull
  failure, then confirm the UI surfaces sync failure instead of partial data.
- Archive notes:

### SAS-AUD-20260602-011 - Backup snapshots can claim cloud data was included even when cloud reads failed

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P1
- Area: Backups / Cloud Snapshot
- Plain-English summary: A backup zip can say cloud data was included even when
  the Proof or Quill cloud reads failed and the cloud snapshot content is just
  empty fallback arrays.
- Source goal or expected behavior: Backup manifests should describe cloud
  coverage truthfully so Marie can trust whether a snapshot actually includes
  cloud data.
- Navigation path tried: Static read-only audit only. Compared cloud snapshot
  build, snapshot handoff, and zip manifest writing. No live backup zip was
  created in this zone.
- Exact test data used: Source only. No live Drive snapshot, account, or Save
  Data writes used.
- Expected result: If the backup cannot read cloud data successfully, the
  snapshot should either surface a failure or avoid claiming cloud coverage in
  the manifest.
- Actual result: `buildCloudSnapshot()` converts Proof and Quill pull failures
  into empty arrays, `takeSnapshotNow()` still passes that object to Electron,
  and `main.js` writes `cloudIncluded: true` whenever a `cloudSnapshot` object
  exists.
- Evidence:
  - `packages/backups/index.js:73-83`
  - `packages/backups/index.js:100-109`
  - `main.js:2076-2091`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. No existing bug already captured this backup-manifest masking
  behavior.
- Why this is not tester confusion: The manifest writes `cloudIncluded` from
  object presence rather than read success, and the snapshot builder explicitly
  converts read failures into empty arrays.
- Likely files to inspect: `packages/backups/index.js`, `main.js`, and any new
  backup snapshot integrity tests.
- Suggested fix direction: Keep explicit success/failure metadata for the cloud
  snapshot and avoid claiming cloud coverage when those reads failed.
- Verification needed after fix: In a safe signed-in backup test, force one
  cloud pull failure, create a snapshot, and confirm the zip manifest and cloud
  snapshot contents describe the failure honestly.
- Archive notes:

### SAS-AUD-20260602-012 - Quill push can ignore critical Supabase errors and still mark a partial sync successful

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P1
- Area: Quill / Cloud Push
- Plain-English summary: Quill cloud push can skip important Supabase errors,
  fall back to bad chapter links, and still remember the push as if it
  succeeded.
- Source goal or expected behavior: Quill sync should fail loudly when prune or
  chapter-id lookup steps fail, and it should not cache a success hash for a
  partial push.
- Navigation path tried: Static read-only audit only. Compared the Quill push,
  chapter-id mapping, and final push-hash logic. No live Supabase push was run
  in this zone.
- Exact test data used: Source only. No live cloud project, annotation, or
  Save Data used.
- Expected result: If chapter prune, chapter-id lookup, or annotation prune
  fails, the push should error and avoid marking the sync complete.
- Actual result: The chapter-prune delete, chapter-id lookup, and
  annotation-prune delete all run without checking returned `error`. If the
  chapter-id lookup fails, later annotation rows can fall back to
  `chapter_id: null`, and the helper still records the last push hash.
- Evidence:
  - `packages/cloud-sync/quill-sync.js:101-116`
  - `packages/cloud-sync/quill-sync.js:119-156`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. Existing item `SAS-AUD-20260602-007` is adjacent symptom overlap,
  but it covers removed-chapter cleanup inside local project state rather than
  this cloud-push error-handling failure path.
- Why this is not tester confusion: The unchecked Supabase calls and final hash
  write are visible directly in the current source.
- Likely files to inspect: `packages/cloud-sync/quill-sync.js` and any new
  targeted Quill sync failure tests.
- Suggested fix direction: Check and propagate all required Supabase errors in
  the Quill push path before any success hash is stored.
- Verification needed after fix: In a safe signed-in or mocked sync test, force
  chapter prune, chapter-id lookup, and annotation prune failures and confirm
  the push reports failure without storing a success hash.
- Archive notes:

### SAS-AUD-20260602-013 - Desktop cloud refresh can keep remotely deleted Proof books and Quill projects locally

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P1
- Area: Cloud / Proof Desktop / Quill Desktop
- Plain-English summary: If a Proof book or Quill project is deleted on another
  device, the desktop refresh logic can keep the old local item instead of
  removing it.
- Source goal or expected behavior: Cross-device cloud refresh should clear
  items that disappeared from the cloud unless a deliberate local-conflict rule
  says they must stay.
- Navigation path tried: Static read-only audit only. Compared desktop Proof
  and Quill merge/hydrate paths plus the tombstone helper. No live two-device
  delete test was run in this zone.
- Exact test data used: Source only. No live account, real cloud rows, or Save
  Data used.
- Expected result: After a remote delete, the next desktop refresh should
  remove the missing Proof book or Quill project locally instead of keeping it
  around for later re-save.
- Actual result: Proof `mergeProofBookLists()` seeds the merge from all local
  books and never prunes local-only survivors, and `resyncProof()` skips
  `setBooks()` entirely when the cloud list is empty. Quill `mergeProjectLists()`
  likewise seeds from all local projects and never prunes local-only
  survivors, while the cloud hydrate returns early on empty cloud lists. The
  tombstone helper only filters items the same device deleted locally.
- Evidence:
  - `app/page.js:399-416`
  - `app/page.js:639-650`
  - `app/components/QuillAndInkMode.js:350-370`
  - `app/components/QuillAndInkMode.js:504-512`
  - `packages/cloud-sync/tombstones.js:152-171`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. No existing bug already covered the shared remote-delete stale-local
  behavior across both desktop sync paths.
- Why this is not tester confusion: The current merge and hydrate logic
  deterministically preserve local-only items, and the tombstone helper is
  explicitly scoped to locally initiated deletes.
- Likely files to inspect: `app/page.js`,
  `app/components/QuillAndInkMode.js`,
  `packages/cloud-sync/tombstones.js`, and any new cross-device delete tests.
- Suggested fix direction: Decide and implement an explicit remote-delete merge
  rule for cloud-owned desktop items instead of silently preserving all
  local-only survivors.
- Verification needed after fix: In a safe two-device test, delete one Proof
  book and one Quill project on Device A, refresh Device B, and confirm the
  deleted items disappear locally and do not re-push.
- Archive notes:

### SAS-AUD-20260602-014 - Backup and transfer exports still ship old `Script and Sync` / `Audiobook Proofer` branding

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P2
- Area: Export / Import / Release
- Plain-English summary: The app now ships as `StJohn Author Studio`, but
  backup exports and transfer-folder export/import still generate old
  `Script and Sync` / `Audiobook Proofer` filenames and wording.
- Source goal or expected behavior: The release/package boundary and the app's
  visible export/import handoff should use the current product identity shown
  by `electron-builder.yml`, `package.json`, and the packaged release files,
  while preserving compatibility with older bundles where needed.
- Navigation path tried: Static read-only audit only. Compared the desktop
  backup export name, browser fallback backup export name, transfer bundle
  manifest/README generation, transfer import dialog copy, and current packaged
  release names. No live Electron export or import was run in this zone.
- Exact test data used: Source only plus current packaged artifact names under
  `Script and Sync Releases/` and `dist/`. No live manuscript, audio, cloud,
  or Save Data used.
- Expected result: Backup filenames, transfer-bundle filenames, README text,
  dialog copy, and visible metadata should use `StJohn Author Studio` or other
  clearly current handoff wording, with any backward-compatibility identifiers
  handled safely behind the scenes.
- Actual result: Desktop backup export still defaults to
  `audiobook-proofer-backup.json`; the browser fallback export uses the same
  old filename; transfer export still writes `script-and-sync-transfer.json`,
  sets `app: 'Script and Sync'`, and writes a `README.txt` headed
  `Script and Sync Transfer Folder`; transfer import still shows
  `Select Script and Sync transfer folder` and can reject with
  `That folder is not an Audiobook Proofer transfer folder.`
- Evidence:
  - `app/page.js:1207-1211`
  - `main.js:1417-1419`
  - `main.js:1572-1603`
  - `main.js:1618-1633`
  - `electron-builder.yml:1-2`, `45-49`
  - `Script and Sync Releases/StJohn Author Studio.app`
  - `Script and Sync Releases/StJohn Author Studio (Windows).exe`
  - `Script and Sync Releases/StJohn Author Studio Setup.exe`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and the earlier checked-zone
  outputs. Existing item `SAS-AUD-20260602-001` already covered the old
  release note in `READ ME FIRST - OPEN THIS.txt`, so that docs overlap stayed
  deduped there. No existing confirmed-bug entry covered the generated backup
  filename plus transfer-bundle naming/copy drift, so this item was added as a
  separate export/import bug.
- Why this is not tester confusion: The stale names are hard-coded directly in
  the current backup and transfer export/import paths, independent of any live
  runtime state.
- Likely files to inspect: `app/page.js`, `main.js`, and any later
  compatibility tests for old transfer bundles.
- Suggested fix direction: Rebrand the user-facing backup and transfer naming
  surface to `StJohn Author Studio`, while keeping transfer import compatible
  with older bundle filenames or manifest identifiers if that compatibility is
  still required.
- Verification needed after fix: In a safe isolated Electron run, export one
  backup and one transfer folder, open the generated files, then import the
  transfer folder back and confirm the filenames, README, dialog copy, and
  compatibility handling all behave as intended.
- Archive notes:

### SAS-AUD-20260602-015 - Electron audio bridge and `localfile://` protocol can expose arbitrary local files to the renderer

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P0
- Area: Shell / Privacy
- Plain-English summary: The desktop shell turns off normal browser security
  and exposes audio helpers that will read or serve any existing local path, so
  crafted project data or a renderer compromise can turn the app into a local
  file reader instead of an audio-only player.
- Source goal or expected behavior: Audio files must stay local, but the
  renderer should only be able to open approved audio sources or app-owned
  paths, not arbitrary readable files on disk.
- Navigation path tried: Static read-only security audit only. Compared the
  Electron window settings, preload bridge, `localfile://` protocol handler,
  audio IPC calls, and desktop backup import path. No live Electron exploit was
  run in this zone.
- Exact test data used: Source only plus a read-only `node` path-join check.
  No real Save Data, real audio, or real local documents were opened.
- Expected result: The desktop window should keep normal browser protections on
  and the audio bridge should reject non-audio or out-of-scope local paths.
- Actual result: `webSecurity` is disabled, preload exposes `getAudioUrl()` and
  `readAudioFile()`, `decodeStoredFilePath()` returns raw absolute paths,
  `localfile://` serves them without root checks, and backup import merges raw
  stored audio paths directly into app state.
- Evidence:
  - `main.js:367-385`
  - `main.js:1179-1190`
  - `main.js:1225-1228`
  - `main.js:1408-1442`
  - `preload.js:4-29`
  - `app/page.js:1198-1204`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and the current checked-zone
  outputs for `webSecurity`, `localfile`, `get-audio-url`, and
  `read-audio-file`. No exact existing bug matched this renderer/file-bridge
  exposure.
- Why this is not tester confusion: The current source deterministically
  accepts and serves any existing resolved path; this is not a timing-only or
  environment-only guess.
- Likely files to inspect: `main.js`, `preload.js`, and `app/page.js`.
- Suggested fix direction: Re-enable normal browser security and narrow the
  bridge to validated audio-only roots or validated object-URL generation, with
  explicit allowlists instead of raw-path pass-through.
- Verification needed after fix: In a safe temp-only Electron run, import a
  crafted book that points `audioPath` at a non-audio local file and confirm
  the renderer cannot fetch or read it while normal attached audio still plays
  and transcribes.
- Archive notes:

### SAS-AUD-20260602-016 - Transfer import manifest paths can escape the copied transfer folder

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P0
- Area: Export / Import / Privacy
- Plain-English summary: A crafted transfer folder can use `../` path segments
  so imported audio or manuscript references point outside the copied transfer
  folder.
- Source goal or expected behavior: Transfer import should rebuild only files
  that stay inside the copied transfer folder and reject any manifest path that
  escapes that boundary.
- Navigation path tried: Static read-only security audit only. Compared the
  transfer audio rewrite helper, manuscript import helper, and a focused
  read-only `node` path-join check. No live Electron import was run in this
  zone.
- Exact test data used: Source only plus a read-only `node` path-join check.
  No real transfer folders or local files were imported.
- Expected result: Relative transfer paths should be normalized, root-checked,
  and rejected if they resolve outside `importDir`.
- Actual result: The current helpers split manifest paths on `/` and drop empty
  segments, but they do not reject `..`. `path.join(importDir, ...)` can escape
  the copied folder, and the manuscript path is then read immediately if it
  exists.
- Evidence:
  - `main.js:323-327`
  - `main.js:444-463`
  - `main.js:1654-1662`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked-zone
  outputs for transfer-manifest path handling terms. No exact existing bug
  matched this import-boundary failure.
- Why this is not tester confusion: The current helper logic and the checker's
  read-only `path.join(...)` receipt both show the escape path without needing
  a speculative runtime assumption.
- Likely files to inspect: `main.js` transfer import helpers.
- Suggested fix direction: Normalize the rebuilt paths, reject any `..`
  traversal, and prove the resolved audio/manuscript path stays inside
  `importDir` before the app trusts it.
- Verification needed after fix: In a safe temp-only Electron run, import a
  crafted transfer bundle with `../` audio and manuscript paths and confirm the
  app blocks the import instead of reading outside the copied folder.
- Archive notes:

### SAS-AUD-20260602-017 - Raw backup book ids can escape manuscript-source storage paths

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P0
- Area: Save-Restart / Privacy
- Plain-English summary: Backup-imported book ids are not sanitized before the
  manuscript-source helpers build file paths, so crafted ids can escape the
  `Manuscript Sources` directory during save, read, or rescan flows.
- Source goal or expected behavior: Manuscript source storage should stay
  inside `Save Data/Manuscript Sources/` regardless of imported backup data or
  later rescan requests.
- Navigation path tried: Static read-only security audit only. Compared backup
  import, book normalization, manuscript-source path building, and rescan IPC
  handlers, plus a focused read-only `node` path-join check. No live Electron
  repro was run in this zone.
- Exact test data used: Source only plus a read-only `node` path-join check.
  No real Save Data or manuscript files were read.
- Expected result: Book ids should be normalized or rejected before they are
  used in manuscript-source paths, and read/write/rescan helpers should verify
  the resolved path stays inside `Manuscript Sources`.
- Actual result: Backup import merges raw book objects into state,
  `normalizeBookPaging()` preserves the imported `id`,
  `getManuscriptSourcePath()` joins the raw `bookId` into the target path, and
  `save-manuscript-source` plus the two rescan handlers use that path without a
  root check.
- Evidence:
  - `app/page.js:1198-1204`
  - `app/lib/manuscriptPaging.js:173-197`
  - `main.js:1078-1094`
  - `main.js:1721-1742`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked-zone
  outputs for manuscript-source path terms. No exact existing bug matched this
  raw-book-id path escape.
- Why this is not tester confusion: The current path builder and handlers
  deterministically trust imported ids; the escape route is visible directly in
  source and in the checker's read-only `path.join(...)` receipt.
- Likely files to inspect: `main.js`, `app/page.js`, and
  `app/lib/manuscriptPaging.js`.
- Suggested fix direction: Validate or regenerate imported book ids, then add
  resolved-path root checks around manuscript-source save/read/rescan helpers
  before any file access occurs.
- Verification needed after fix: In a safe temp-only Electron run, import a
  crafted backup with a path-segment book id, trigger manuscript rescan or
  reattach, and confirm the app rejects any path outside
  `Save Data/Manuscript Sources/`.
- Archive notes:

## Needs Navigation Proof

Use this section when the tester could not find a control or workflow. This is
not a bug until the real UI path has been found and tested.

No navigation-proof items logged yet.

## Needs Real Files Or Account Access

Use this section when generated files are not enough to prove the workflow.

No real-file items logged yet.

## Environment Blockers

Use this section for missing login, missing Whisper model, blocked network,
permissions, or app launch issues.

### SAS-AUD-20260530-001 - Electron dev run mirrors audit data into Documents

- Date found: 2026-05-30
- Type: environment-blocked
- Status: mitigated for future audit runs; code/process risk remains open
- Severity: P0 for audit safety; not yet classified as a product bug
- Area: Save-Restart / Audit environment
- Plain-English summary: Running the Electron app from a temp copy still wrote
  the audit book into `~/Documents/StJohn Author Studio/Save Data/books.json`
  because dev mode writes a mirror save outside the temp project folder.
- Source goal or expected behavior: Audit runs must not alter Marie's real
  `Save Data/` or mirror save locations. `docs/BUILD_PLAN_V4.md` also treats
  real saved data as a core safety boundary.
- Navigation path tried: Temp copy at `/tmp/stjohn-author-studio-audit-run`,
  launched with `PORT=3017 npm start`, dev skip login, created `Audit Proof
  Book`, imported the generated DOCX, attached generated audio, saved one flag.
- Exact test data used:
  `docs/audits/artifacts/2026-05-30-generated-files/audit-proof-manuscript.docx`
  and
  `docs/audits/artifacts/2026-05-30-generated-files/audio/chapter-01.m4a`.
- Expected result: Only
  `/tmp/stjohn-author-studio-audit-run/Save Data/books.json` changes.
- Actual result:
  `/Users/mariemackay/Documents/StJohn Author Studio/Save Data/books.json`
  also matched the temp `books.json` after the run.
- Evidence:
  - `cmp` returned `0` between the temp `books.json` and Documents mirror before cleanup.
  - The Documents mirror contained `Audit Proof Book` plus the existing
    `Anarchy` project.
  - The original repo file
    `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Save Data/books.json`
    was not changed.
- Cleanup already done: The temp Electron session was stopped and only the
  `Audit Proof Book` entry was removed from the Documents mirror. The existing
  `Anarchy` project remained.
- Mitigation checked: A fresh Electron run launched with
  `HOME=/tmp/stjohn-author-studio-audit-home` displayed the save path under
  `/private/tmp/stjohn-author-studio-audit-run-iso/Save Data/books.json`, and
  the real Documents mirror timestamp did not change.
- Why this is not tester confusion: Source reading confirms dev mode writes
  primary data to `__dirname/Save Data` and mirrors `books.json` to
  `app.getPath('documents')/StJohn Author Studio/Save Data/books.json`.
- Likely files to inspect: `main.js` data path helpers and `write-data` IPC.
- Suggested fix direction: For further audit runs, launch Electron with an
  isolated `HOME` so `app.getPath('documents')` resolves under `/tmp`. For code
  hardening later, consider an explicit audit/dev data-directory override or a
  safer dev mirror switch.
- Verification needed after fix: Start Electron from a temp copy, create a
  test book, save a flag, and confirm no file under
  `/Users/mariemackay/Documents/StJohn Author Studio/Save Data/` changes.
- Archive notes:

## Documentation Drift

Use this section when the docs and current app disagree. These are not product
bugs unless the mismatch causes a real user failure.

### SAS-AUD-20260602-001 - App tree docs disagree about current mode status

- Date found: 2026-06-02
- Type: doc-drift
- Status: open
- Severity: P2
- Area: Shell / Docs
- Plain-English summary: Some source docs still describe early-phase or missing
  features, older paths, or old naming even though the current code and other
  docs show all four desktop modes plus phone files exist.
- Source goal or expected behavior: `docs/APP_STRUCTURE.md` says audits should
  use the app tree and wiring docs together. `docs/BUILD_PLAN_V4.md`,
  `docs/FRONT_FUNCTION_TREE.md`, and `docs/WIRING_MATRIX.md` should not give
  conflicting status for the same user-facing controls.
- Navigation path tried: Static read-only audit only. No UI navigation.
- Exact test data used: Source docs and repository tree.
- Expected result: The build plan, front function tree, internal tree, and
  wiring matrix agree on current status or clearly mark old notes as stale.
- Actual result: `docs/BUILD_PLAN_V4.md` still says Phase 1 active;
  `docs/WIRING_MATRIX.md` marks several mode/phone rows missing; current source
  files and `docs/FRONT_FUNCTION_TREE.md` say many of those areas exist. The
  same drift family also includes a stale shared-reader target in
  `docs/BUILD_PLAN_V4.md`, a missing `supabase/` reference in
  `docs/CLOUD_SAFETY_AUDIT.md`, a `docs/CLOUD_SCHEMA.md` header that says
  "four" tables while documenting six, and old product naming/release wording
  in `READ ME FIRST - OPEN THIS.txt`. Zone 2 shell follow-up on 2026-06-02
  also confirmed that `docs/WIRING_MATRIX.md` still says the four-mode shell
  switcher is missing and still names the old `changeSaveFolder` bridge, while
  the current shell uses `getDataLocation` / `chooseDataLocation`. The same
  shell follow-up confirmed `READ ME FIRST - OPEN THIS.txt` still points users
  at old `AUDIoproofer 5.0` / `Script and Sync` release wording and an older
  save-location expectation even though `main.js` now brands the app as
  `StJohn Author Studio` and can default the save path to Google Drive or
  Electron userData. Zone 4 Prep follow-up on 2026-06-02 also confirmed that
  `docs/INTERNAL_FUNCTION_TREE.md` still points at top-level `lib/...` helper
  paths even though the current repo and `docs/APP_STRUCTURE.md` use
  `app/lib/...`. Zone 5 Quill follow-up on 2026-06-02 also confirmed that
  `docs/WIRING_MATRIX.md:68-75` still marks live Quill desktop rows as
  `MISSING` while `docs/FRONT_FUNCTION_TREE.md:73-82` and the current Quill
  source files show real import, reader, export, and cloud wiring. Zone 11
  Duet follow-up on 2026-06-02 also confirmed that
  `docs/WIRING_MATRIX.md:59-66` still marks live Duet rows as `MISSING` while
  `docs/FRONT_FUNCTION_TREE.md:64-71` and the current Duet source files show
  real import, scan, and marker-export wiring. Zone 10 export/release follow-up
  on 2026-06-02 also confirmed that the same handoff note still tells users to
  open `Script and Sync.app`, `Script and Sync (Windows).exe`, and
  `Script and Sync Setup.exe` even though `Script and Sync Releases/` now ships
  `StJohn Author Studio.app`, `StJohn Author Studio (Windows).exe`, and
  `StJohn Author Studio Setup.exe`. Zone 12 internal-architecture follow-up on
  2026-06-02 also confirmed that `CLAUDE.md` and
  `docs/SHARED_COMPONENTS.md` still present a one-reader / one-book-detail
  contract that the current source only partially follows: phone still uses its
  own `PhoneReader` plus `renderReaderContent`, Quill and Duet still route book
  detail through `SessionsView`, and Prep still keeps an inline
  `BookDetailView`. Zone 8 Phone Quill follow-up on 2026-06-02 also confirmed
  that `docs/WIRING_MATRIX.md:89-96` still marks Phone Quill rows `MISSING`
  even though `docs/FRONT_FUNCTION_TREE.md:97-108` and the current phone Quill
  source already show live project-list, chapter-open, add-annotation, and
  export wiring.
- Evidence:
  - Code-traced by read-only source map audit on 2026-06-02. Main files seen:
    `app/page.js`, `app/phone/page.js`,
    `app/components/PrepManuscriptMode.js`,
    `app/components/PrebuildMode.js`,
    `app/components/QuillAndInkMode.js`.
  - Zone-checker follow-up on 2026-06-02 confirmed:
    - `docs/BUILD_PLAN_V4.md:3` still says Phase 1 active.
    - `docs/WIRING_MATRIX.md:28`, `53-57`, `63-75`, `81-96` still mark current shell, Prep, Duet, Quill, and phone rows as missing.
    - `docs/WIRING_MATRIX.md:28-30` still says the shell mode switcher is missing and still points to `window.electron.changeSaveFolder()` instead of the live `getDataLocation` / `chooseDataLocation` bridge.
    - `docs/BUILD_PLAN_V4.md:128-129` points to `packages/reader-engine/` and `app/components/Reader/`, while `docs/SHARED_COMPONENTS.md:23-33`, `36-41` and current files show a mixed present-state reader setup instead.
    - `docs/CLOUD_SAFETY_AUDIT.md:37` still points to `supabase/`, which is absent in this repo.
    - `docs/CLOUD_SCHEMA.md:6-8` says "four" tables while the same file documents six table names.
    - `READ ME FIRST - OPEN THIS.txt:1`, `6`, `23`, `29`, `35-49` still use old `AUDIoproofer 5.0` / `Script and Sync` release wording.
    - `READ ME FIRST - OPEN THIS.txt:53-55` still tells users the home-screen save location should point inside the main Script and Sync folder, while `main.js:139-143` can now default the save path to Google Drive or Electron userData.
    - `docs/INTERNAL_FUNCTION_TREE.md:32-35` still points at `lib/transcriptionWorker.js`, `lib/manuscriptPaging.js`, `lib/pdfPaging.js`, and `lib/fuzzyMatcher.js`, while the current repo structure and `docs/APP_STRUCTURE.md` place those browser helpers under `app/lib/`.
    - `docs/FRONT_FUNCTION_TREE.md:73-82` marks Quill desktop flows `REAL`, while `docs/WIRING_MATRIX.md:68-75` still marks the same Quill rows `MISSING` even though the current source tree contains `app/components/QuillAndInkMode.js`, `packages/quill-engine/exporters.js`, and `packages/cloud-sync/quill-sync.js`.
    - `docs/FRONT_FUNCTION_TREE.md:64-71` marks Duet desktop flows `REAL`, while `docs/WIRING_MATRIX.md:59-66` still marks the same Duet rows `MISSING` even though the current source tree contains `app/components/PrebuildMode.js` and the live marker-export bridge.
    - Zone 10 follow-up also confirmed `READ ME FIRST - OPEN THIS.txt:28-30`, `35-49` still tells users to open old `Script and Sync` app names even though the current packaged outputs are `Script and Sync Releases/StJohn Author Studio.app`, `Script and Sync Releases/StJohn Author Studio (Windows).exe`, and `Script and Sync Releases/StJohn Author Studio Setup.exe`.
    - Zone 12 follow-up also confirmed `CLAUDE.md:5-16`, `97-106` and `docs/SHARED_COMPONENTS.md:21-30`, `36-41`, `46-55` still describe one shared book-detail / reader direction while the current source keeps phone reader logic in `app/phone/_components/PhoneReader.js` plus `app/phone/_components/renderReaderContent.js`, still routes Quill and Duet book detail through `app/components/SessionsView.js`, and still keeps Prep's inline `BookDetailView` in `app/components/PrepManuscriptMode.js`.
    - Zone 8 follow-up also confirmed `docs/WIRING_MATRIX.md:89-96` still marks Phone Quill rows `MISSING`, while `docs/FRONT_FUNCTION_TREE.md:97-108` plus `app/phone/page.js:244-257`, `791-977`, and `1128-1279` show live project-list, chapter-open, add-annotation, and export wiring.
- Why this is not tester confusion: This is a doc-to-doc and doc-to-tree
  mismatch, not a hidden UI control.
- Likely files to inspect: `docs/BUILD_PLAN_V4.md`,
  `CLAUDE.md`, `docs/WIRING_MATRIX.md`, `docs/FRONT_FUNCTION_TREE.md`,
  `docs/APP_STRUCTURE.md`, `docs/SHARED_COMPONENTS.md`,
  `docs/CLOUD_SAFETY_AUDIT.md`, `docs/CLOUD_SCHEMA.md`,
  `READ ME FIRST - OPEN THIS.txt`.
- Suggested fix direction: Do a docs-only tree refresh after the monitor pass,
  keeping historical plan notes but clearly separating old phase status and
  target-state notes from current app status, and align the release-handoff and
  cloud-reference docs with the current repo.
- Verification needed after fix: Re-run the source map audit and confirm no row
  calls an implemented/currently documented control missing without a note, and
  no current reference doc points auditors to absent paths without marking them
  historical or target-only.
- Archive notes:

## Watchlist Risks

Use this section for code-traced risks that are not reproduced yet.

### SAS-AUD-20260602-002 - Phone Quill saves have no offline queue or visible pending state

- Date found: 2026-06-02
- Type: watchlist-risk
- Status: open
- Severity: P1 if reproduced; currently code-traced only
- Area: Phone Quill / Cloud
- Plain-English summary: Phone Proof has an offline flag queue, but Phone Quill
  appears to save by pushing the whole project and logging failures. If a Quill
  phone save fails, a later refresh might lose an unsynced annotation.
- Source goal or expected behavior: Phone Quill should safely round-trip
  annotation metadata to desktop. Audio stays local; annotation text and
  metadata sync to cloud.
- Navigation path tried: Static code trace only. Not reproduced live.
- Exact test data used: None; no live test data used.
- Expected result: Failed phone Quill annotation saves should either queue,
  show a clear pending warning, or keep a recoverable local backup until cloud
  catches up.
- Actual result: Code trace suggests failed pushes are logged, but no Quill
  phone pending queue/banner was found.
- Evidence: Code-traced areas: `app/phone/page.js` Quill save path and
  `packages/cloud-sync/quill-sync.js`.
- Why this is not tester confusion: This is not a confirmed UI failure. It is a
  risk found by static reading.
- Likely files to inspect: `app/phone/page.js`,
  `packages/cloud-sync/quill-sync.js`, `packages/cloud-sync/flag-queue.js`.
- Suggested fix direction: If live testing reproduces the risk, add a Quill
  single-annotation queue or a clear recoverable pending state similar to Proof
  flags.
- Verification needed after fix: Phone Quill offline annotation save, reconnect,
  refresh desktop, confirm the final annotation appears and no duplicate is
  created.
- Archive notes:

### SAS-AUD-20260602-003 - Pending Proof flag queue count may not be user-scoped

- Date found: 2026-06-02
- Type: watchlist-risk
- Status: open
- Severity: P2 if reproduced; currently code-traced only
- Area: Phone Script / Cloud
- Plain-English summary: The phone may show a pending flag count from another
  account because the queue count appears global rather than scoped to the
  signed-in Supabase user.
- Source goal or expected behavior: Account A data must not appear when Account
  B signs in. Phone cache and pending sync state should be user-scoped.
- Navigation path tried: Static code trace only. Not reproduced live.
- Exact test data used: None; no live test data used.
- Expected result: Signing out of one account and into another should show only
  the second account's projects, flags, pending counts, and cache.
- Actual result: Code trace suggests the pending flag queue count may be global.
- Evidence: Code-traced area: `packages/cloud-sync/flag-queue.js`.
- Why this is not tester confusion: This is not a confirmed UI failure. It is a
  risk found by static reading.
- Likely files to inspect: `packages/cloud-sync/flag-queue.js`,
  `app/phone/page.js`.
- Suggested fix direction: If live testing reproduces it, scope pending queue
  counts and storage keys by user id and project id.
- Verification needed after fix: Create a pending flag in Account A, sign out,
  sign into Account B, confirm no Account A pending count or project data is
  visible.
- Archive notes:

### SAS-AUD-20260602-018 - Phone Script refresh can keep stale cached books when the cloud list is empty

- Date found: 2026-06-02
- Type: watchlist-risk
- Status: open
- Severity: P1 if reproduced; currently code-traced only
- Area: Phone Script / Cloud / Cache
- Plain-English summary: A successful phone refresh that returns zero Proof
  books can keep showing old cached books instead of clearing the list, which
  could leave stale or wrong-account books visible on the phone.
- Source goal or expected behavior: A successful empty Proof pull should clear
  the current Phone Script book list and its per-user cache so the phone view
  matches the actual cloud state.
- Navigation path tried: Static read-only Phone Script checker follow-up only.
  No live phone browser, Supabase account, or account-swap run was used.
- Exact test data used: Source only. No live account, cloud rows, audio, or
  Save Data used.
- Expected result: When `pullProofProjects()` succeeds with an empty array, the
  phone should replace any current cached books with `[]` and write that empty
  result to the signed-in user's phone cache.
- Actual result: `refresh()` only replaces state when `list?.length` is truthy.
  If the pull succeeds with `[]` while `current` already contains cached books,
  the function returns `current` and leaves the stale list in state; the empty
  cache write path runs only when `current` was already empty.
- Evidence:
  - `app/phone/page.js:1522-1550`
  - `app/phone/page.js:1593-1599`
  - `app/phone/_lib/projectCache.js:34-68`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. No exact existing item matched the empty-successful-pull stale-cache
  risk. Existing item `SAS-AUD-20260602-003` is adjacent but different because
  it covers the pending-count banner looking global rather than this empty-pull
  cache-clearing path.
- Why this is not tester confusion: The current refresh branch is explicit in
  source and deterministically returns the existing book list on a successful
  empty pull whenever local state already contains cached books.
- Likely files to inspect: `app/phone/page.js`,
  `app/phone/_lib/projectCache.js`, and any targeted tests around empty Proof
  refresh results.
- Suggested fix direction: If live testing reproduces the risk, treat a
  successful empty Proof pull as authoritative, clear the current list, and
  rewrite the signed-in user's phone cache to `[]` while keeping the existing
  error/timeout protection paths intact.
- Verification needed after fix: In a safe signed-in phone run, start with
  cached books, make the cloud Proof list empty, refresh, and confirm the list
  clears both immediately and after a sign-out/sign-in cycle.
- Archive notes:

### SAS-AUD-20260602-019 - Phone Quill no-match audio guidance contradicts the actual reader path

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P2
- Area: Phone Quill / Audio / Reader
- Plain-English summary: When Phone Quill loads audio files but none of them
  match a chapter, the project screen tells Marie she can still pick audio
  inside the reader, but the reader disables manual picking and sends her back
  to the chapter list instead.
- Source goal or expected behavior: If the Phone Quill no-match path promises
  in-reader audio picking, the reader should actually expose that picker. If
  the intended flow is chapter-list-only, the project screen should say that
  clearly instead of promising a reader action that is disabled.
- Navigation path tried: Static read-only Phone Quill checker follow-up only.
  No live `/phone` browser run or real audio pick was performed in this pass.
- Exact test data used: Source only. No live phone files, account, or Save
  Data used.
- Expected result: The no-match guidance on the Phone Quill project screen and
  the chapter reader audio dock should describe the same next step.
- Actual result: The project screen sets the no-match status to `No filenames
  matched. You can still pick audio inside the reader.` but the chapter reader
  passes `allowManualPick={false}` to `PhoneAudioDock`, and that dock then
  tells the user `Back to the chapter list to pick the audio folder.`
- Evidence:
  - `app/phone/page.js:952-960`
  - `app/phone/page.js:1460-1471`
  - `app/phone/page.js:2673-2693`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. No exact existing bug covered this Phone Quill no-match audio
  guidance contradiction. Existing item `SAS-AUD-20260602-001` is adjacent
  docs drift only, and `SAS-AUD-20260602-002` covers sync/pending-state risk
  rather than this reader guidance bug.
- Why this is not tester confusion: The contradiction is hardcoded in the
  current source. One path explicitly promises an in-reader picker while the
  reader path explicitly disables it and shows the opposite instruction.
- Likely files to inspect: `app/phone/page.js` and the `PhoneAudioDock` logic
  defined there.
- Suggested fix direction: Make the no-match guidance and the reader behavior
  agree, either by enabling manual audio pick inside the Quill reader or by
  changing the project-screen copy to direct the user back to the chapter list.
- Verification needed after fix: In a safe live `/phone` Quill run, load audio
  files that do not match any chapter, open a chapter, and confirm the visible
  guidance and actual picker path now agree.
- Archive notes:

### SAS-AUD-20260602-020 - Phone Quill refresh can keep stale cached projects when the cloud list is empty

- Date found: 2026-06-02
- Type: watchlist-risk
- Status: open
- Severity: P1 if reproduced; currently code-traced only
- Area: Phone Quill / Cloud / Cache
- Plain-English summary: A successful phone Quill refresh that returns zero
  cloud projects can keep showing old cached projects instead of clearing the
  list, which could leave stale or wrong-account projects visible on the
  phone.
- Source goal or expected behavior: A successful empty Quill pull should clear
  the current Phone Quill project list and rewrite that signed-in user's phone
  cache to `[]` so the phone matches the actual cloud state.
- Navigation path tried: Static read-only Phone Quill checker follow-up only.
  No live phone browser, Supabase account, or account-swap run was used.
- Exact test data used: Source only. No live account, cloud rows, audio, or
  Save Data used.
- Expected result: When `pullQuillProjects()` succeeds with an empty array, the
  phone should replace any current cached projects with `[]` and write that
  empty result to the signed-in user's Quill phone cache.
- Actual result: `refreshFromCloud()` only replaces state when `list?.length`
  is truthy. If the pull succeeds with `[]` while `current` already contains
  cached projects, the function returns `current` and leaves the stale list in
  state; the empty-cache write path runs only when `current` was already empty.
- Evidence:
  - `app/phone/page.js:791-818`
  - `app/phone/page.js:1073-1077`
  - `app/phone/_lib/projectCache.js:34-68`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current checked zone
  outputs. No exact existing item matched the empty-successful-pull Phone Quill
  stale-cache path. Existing item `SAS-AUD-20260602-013` is adjacent but covers
  desktop remote-delete refresh behavior, `SAS-AUD-20260602-002` covers
  Phone Quill pending-state safety, and `SAS-AUD-20260602-018` covers the same
  stale-cache pattern on Phone Script rather than Phone Quill.
- Why this is not tester confusion: The current refresh branch explicitly keeps
  the existing project list on a successful empty pull whenever local state
  already contains cached projects.
- Likely files to inspect: `app/phone/page.js`,
  `app/phone/_lib/projectCache.js`, and any targeted tests around empty Quill
  refresh results.
- Suggested fix direction: If live testing reproduces the risk, treat a
  successful empty Quill pull as authoritative, clear the current project list,
  and rewrite the signed-in user's Quill phone cache to `[]` while keeping the
  existing error/timeout protection path intact.
- Verification needed after fix: In a safe signed-in phone Quill run, start
  with cached projects, make the cloud Quill list empty, refresh, and confirm
  the list clears both immediately and after a sign-out/sign-in cycle.
- Archive notes:

### SAS-AUD-20260602-021 - Cross-mode overlay panels lack dialog semantics and focus management

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P2
- Area: Shell / Proof / Prep / Duet / Quill
- Plain-English summary: Several current help/settings/modal overlays still
  behave like plain floating boxes instead of accessible dialogs, so keyboard
  and assistive-tech users do not get clear dialog semantics or proven focus
  containment.
- Source goal or expected behavior: User-facing overlays that take over the
  screen should expose dialog semantics, keep focus inside while open, and
  return focus safely when dismissed.
- Navigation path tried: Static read-only Zone 13 checker follow-up only. No
  live browser, Electron, keyboard-only, or screen-reader run was performed in
  this pass.
- Exact test data used: Source only. No real Save Data, cloud data, or live
  user files used.
- Expected result: Current cross-mode overlays should expose at least
  `role="dialog"` plus `aria-modal` or an equivalent accessible pattern, along
  with clear focus-management behavior.
- Actual result: The inspected overlays are rendered as fixed `div` stacks with
  outside-click close behavior. The checker follow-up did not find dialog
  semantics, a focus trap, or a focus-return path on the inspected surfaces.
- Evidence:
  - `app/page.js:2329-2340`
  - `app/components/PrebuildMode.js:381-392`
  - `app/components/PrepManuscriptMode.js:780-791`
  - `app/components/QuillAndInkMode.js:1051-1062`
  - `app/components/ReaderChrome.js:542-555`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and the current checked-zone
  outputs. No exact existing item matched this cross-mode dialog-semantics and
  focus-management issue.
- Why this is not tester confusion: The missing semantics and focus-management
  hooks are directly visible in the current source. This item does not depend
  on timing or external services.
- Likely files to inspect: `app/page.js`,
  `app/components/PrebuildMode.js`,
  `app/components/PrepManuscriptMode.js`,
  `app/components/QuillAndInkMode.js`, and shared overlay helpers such as
  `app/components/ReaderChrome.js`.
- Suggested fix direction: Route these overlays through one shared dialog
  pattern that provides accessible semantics, focus containment, and focus
  return consistently across modes.
- Verification needed after fix: In a safe live desktop run, open each current
  overlay, tab through it, press `Escape`, and confirm focus stays inside while
  open and returns to the trigger after close.
- Archive notes:

### SAS-AUD-20260602-022 - Core reader word actions are pointer-only across desktop, phone, and Proof

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P1
- Area: Proof / Quill / Phone Quill / Reader
- Plain-English summary: The main word-level reader actions still depend on
  pointer gestures and double-clicks, leaving keyboard-only users without a
  real path for several core read/select/action flows.
- Source goal or expected behavior: Core reader text should expose a keyboard
  path for word or range targeting wherever the app expects users to select
  text, open per-word actions, or create annotations/flags.
- Navigation path tried: Static read-only Zone 13 checker follow-up only. No
  live browser, Electron, or keyboard-only walkthrough was performed in this
  pass.
- Exact test data used: Source only. No real Save Data, cloud data, or live
  user files used.
- Expected result: Users should be able to reach and trigger core reader word
  actions without a pointer, especially in the shared Quill reader, phone
  reader, and Proof word-action flow.
- Actual result: The shared chapter reader and phone reader expose pointer
  handlers on word spans, the chapter reader disables native text selection,
  and the Proof word-action menu opens from `onDoubleClick` on a word target.
- Evidence:
  - `app/components/ChapterReader.js:214-225`
  - `app/components/ChapterReader.js:374-386`
  - `app/phone/_components/PhoneReader.js:184-216`
  - `app/components/ProofingReader.js:1223-1229`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and the current checked-zone
  outputs. No exact existing item matched this shared keyboard-access gap.
- Why this is not tester confusion: The current source explicitly wires these
  reader actions through pointer and double-click handlers without a matching
  keyboard path.
- Likely files to inspect: `app/components/ChapterReader.js`,
  `app/phone/_components/PhoneReader.js`, `app/components/ProofingReader.js`,
  and any shared reader interaction helpers.
- Suggested fix direction: Add one shared keyboard interaction model for word
  targeting and per-word actions, then reuse it in the shared desktop reader,
  phone reader, and Proof reader paths.
- Verification needed after fix: In a safe live keyboard-only run, create or
  open a Quill annotation, open a Proof word-action menu, and confirm the same
  actions work on phone and desktop without a pointer.
- Archive notes:

### SAS-AUD-20260602-023 - Several disclosure and icon-only controls lack accessible state or names

- Date found: 2026-06-02
- Type: confirmed-bug
- Status: open
- Severity: P2
- Area: Proof / Shell / Quill / Phone Quill
- Plain-English summary: Multiple current controls still rely on arrow or
  symbol glyphs without exposing the expanded state or a clear accessible name,
  so assistive tech can miss what the control does or whether it is open.
- Source goal or expected behavior: Disclosure controls should expose expanded
  state, and icon-only buttons should carry an explicit accessible name instead
  of relying only on visible glyphs or `title`.
- Navigation path tried: Static read-only Zone 13 checker follow-up only. No
  live screen-reader or accessibility-tree run was performed in this pass.
- Exact test data used: Source only. No real Save Data, cloud data, or live
  user files used.
- Expected result: Proof expanders should expose expanded state, and current
  glyph-only buttons should announce a clear action name.
- Actual result: The checker found Proof chapter and section expanders that
  only swap `▲` / `▼`, a shared Home/Back pill with only a glyph plus `title`,
  and multiple `✕`, `+`, and arrow buttons in reader/settings/custom-option
  flows with no explicit accessible label.
- Evidence:
  - `app/components/SessionsView.js:2946-2954`
  - `app/components/SessionsView.js:3141-3144`
  - `app/components/ReaderChrome.js:270-287`
  - `app/components/ProofingReader.js:1165-1169`
  - `app/components/ProofingReader.js:1205-1207`
  - `app/page.js:1905-1908`
  - `app/components/QuillAndInkMode.js:1691-1693`
  - `app/components/QuillAndInkMode.js:1814-1828`
  - `app/components/QuillAndInkMode.js:1855-1870`
  - `app/phone/page.js:1388-1401`
  - `app/phone/page.js:1429-1444`
- Duplicate check result: Searched
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`,
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and the current checked-zone
  outputs. No exact existing item matched this control naming/state seam.
- Why this is not tester confusion: The missing `aria-expanded` and explicit
  labels are directly visible in the current source. These findings do not rely
  on timing or environment behavior.
- Likely files to inspect: `app/components/SessionsView.js`,
  `app/components/ReaderChrome.js`, `app/components/ProofingReader.js`,
  `app/components/QuillAndInkMode.js`, `app/phone/page.js`, and `app/page.js`.
- Suggested fix direction: Apply one shared control standard for disclosure
  state and icon-only button labeling, then reuse it across Proof, shared
  reader chrome, Quill, phone Quill, and settings surfaces.
- Verification needed after fix: In a safe live screen-reader or accessibility
  tree pass, confirm the current expanders announce open/closed state and the
  glyph-only buttons announce a clear action name.
- Archive notes:

## Entry Template

Copy this template for every new item.

```md
### SAS-AUD-YYYYMMDD-001 - <short title>

- Date found:
- Type: confirmed-bug / needs-navigation-proof / needs-real-file / environment-blocked / doc-drift / watchlist-risk
- Status:
- Severity: P0 / P1 / P2 / P3
- Area: Shell / Proof / Prep / Duet / Quill / Phone Script / Phone Quill / Cloud / Export / Save-Restart / Release
- Plain-English summary:
- Source goal or expected behavior:
- Navigation path tried:
- Exact test data used:
- Expected result:
- Actual result:
- Evidence:
- Why this is not tester confusion:
- Likely files to inspect:
- Suggested fix direction:
- Verification needed after fix:
- Archive notes:
```

## Fixed / Archived

Move fixed items here. Do not delete the original details.

No fixed items archived yet.
