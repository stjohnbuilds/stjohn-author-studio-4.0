# Zone Checker - Zone 02 Cloud, Auth, Audio Privacy, Save Data, and Backups

- Date/time: 2026-06-02 15:34 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for
  the cloud/auth/audio-privacy/save-data/backups zone only; preserve
  disagreements; run focused read-only follow-up where needed; dedupe before
  touching the master report or bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-cloud-auth-audio-privacy-save-data-and-backups/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-cloud-auth-audio-privacy-save-data-and-backups/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-cloud-auth-audio-privacy-save-data-and-backups/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main disagreements around:

- `packages/cloud-sync/proof-sync.js`
- `packages/cloud-sync/quill-sync.js`
- `packages/backups/index.js`
- `packages/cloud-sync/tombstones.js`
- `app/page.js`
- `app/components/QuillAndInkMode.js`
- `main.js`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p'` on the three cloud-zone inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba packages/cloud-sync/proof-sync.js \| sed -n '200,320p'` | 0 |
| `nl -ba packages/cloud-sync/quill-sync.js \| sed -n '90,290p'` | 0 |
| `nl -ba packages/backups/index.js \| sed -n '68,120p'` | 0 |
| `nl -ba main.js \| sed -n '2065,2095p'` | 0 |
| `nl -ba app/page.js \| sed -n '390,430p;639,655p'` | 0 |
| `nl -ba app/components/QuillAndInkMode.js \| sed -n '340,370p;500,515p'` | 0 |
| `nl -ba packages/cloud-sync/tombstones.js \| sed -n '1,220p'` | 0 |
| `rg -n "pullProofProjects\|pullQuillProjects\|buildCloudSnapshot\|cloudIncluded\|mergeProofBookLists\|mergeProjectLists" docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |

## Merged Findings

### PASS - The main cloud privacy and table-boundary guardrails remain in place

The three inspectors agreed on the core safety shape, and the checker
follow-up did not find a contradiction:

- Supabase access is still hard-whitelisted to the six approved StJohn tables.
- `.rpc(...)` calls are still blocked at the shared client boundary.
- Proof and Quill still strip audio paths/blob-style fields before cloud write.

Evidence:

- `packages/cloud-sync/client.js:22-60`
- `packages/cloud-sync/audio-guard.js:12-79`
- `packages/cloud-sync/proof-sync.js:46-58`
- `packages/cloud-sync/quill-sync.js:27-36`

### CONFIRMED BUG - Proof and Quill cloud pulls can silently rebuild partial or stale data when secondary queries fail

Inspector A raised this as the main fail item. The checker follow-up confirms
the silent failure pattern in both pull helpers:

- `pullProofProjects(...)` throws only for the top-level
  `script_sync_projects` query.
- The later `script_sync_section_transcriptions` and `script_sync_flags`
  queries do not check `error` before the merge continues.
- `pullQuillProjects(...)` throws only for the top-level `quill_projects`
  query.
- The later `quill_chapters` and `quill_annotations` queries do not check
  `error` before reconstruction continues.
- When those later queries fail, the current code can still return a
  superficially successful project list with missing rows or stale blob
  fallbacks instead of surfacing a sync error.

Checker assessment: confirmed cloud sync integrity bug. This is not just a test
gap; the current pull helpers visibly ignore later query failures.

Evidence:

- `packages/cloud-sync/proof-sync.js:216-231`
- `packages/cloud-sync/proof-sync.js:233-286`
- `packages/cloud-sync/quill-sync.js:162-177`
- `packages/cloud-sync/quill-sync.js:179-285`

### CONFIRMED BUG - Backup snapshots can claim cloud coverage even when cloud reads failed

Inspector B raised this as a fail item. The checker follow-up confirms the
backup completeness problem:

- `buildCloudSnapshot()` catches Proof and Quill pull failures and turns them
  into empty arrays.
- `takeSnapshotNow()` still forwards the resulting snapshot object to Electron.
- `main.js` writes `cloudIncluded: true` whenever any `cloudSnapshot` object
  exists, even if the cloud reads silently failed and the snapshot contains
  only empty arrays.

Checker assessment: confirmed backup-trust bug. The current manifest can say
cloud data was included when the cloud portion is actually empty because the
read failed.

Evidence:

- `packages/backups/index.js:73-83`
- `packages/backups/index.js:100-109`
- `main.js:2076-2091`

### CONFIRMED BUG - Quill push can ignore critical Supabase errors and still mark a partial sync successful

Inspector B raised this as a fail item. The checker follow-up confirms the
error-handling gap:

- The chapter-prune delete runs without checking the returned `error`.
- The chapter-id lookup also ignores the returned `error`.
- The annotation-prune delete likewise ignores the returned `error`.
- If the chapter-id lookup fails, annotation rows fall back to
  `chapter_id: null`.
- The helper still records the last push hash after those unchecked calls,
  which can let a later save short-circuit as though the cloud sync finished
  cleanly.

Checker assessment: confirmed Quill cloud-push bug. The current push path can
hide partial failure and store a false success state.

Evidence:

- `packages/cloud-sync/quill-sync.js:101-116`
- `packages/cloud-sync/quill-sync.js:119-156`

### CONFIRMED BUG - Desktop cloud refresh can keep remotely deleted Proof books and Quill projects locally

Inspector C raised this as the main fail item. The checker follow-up confirms
the stale-local behavior for both desktop modes:

- Proof merge starts from all local books, overlays cloud matches, and never
  prunes local-only survivors.
- Proof resync also skips `setBooks(...)` entirely when the post-tombstone
  cloud list is empty.
- Quill merge starts from all local projects, overlays cloud matches, and never
  prunes local-only survivors.
- Quill hydrate returns early when the pulled cloud list is empty, so a fully
  deleted remote set leaves stale local projects untouched.
- The tombstone helper only protects locally initiated deletes from being
  re-pulled; it does not remove items that were deleted elsewhere and are now
  simply absent from the cloud list.

Checker assessment: confirmed cross-device delete-sync bug. The current desktop
hydrate logic can leave remotely deleted items visible locally and available
for later re-save.

Evidence:

- `app/page.js:399-416`
- `app/page.js:639-650`
- `app/components/QuillAndInkMode.js:350-370`
- `app/components/QuillAndInkMode.js:504-512`
- `packages/cloud-sync/tombstones.js:152-171`

### RESOLVED - Existing Phone Quill and Proof pending-state watchlist items remain watchlist-only

Inspectors B and C both carried forward the existing phone-sync watchlist
items, and Inspector A did not contradict them:

- Phone Quill still lacks a confirmed offline queue/pending-state proof.
- The visible Proof pending count still looks global rather than clearly
  user-scoped.

Checker assessment: no new bug-log entry here. Keep these under existing
watchlist items `SAS-AUD-20260602-002` and `SAS-AUD-20260602-003` until a safe
live repro either confirms or dismisses them.

Evidence:

- `app/phone/page.js:877-886`
- `packages/cloud-sync/flag-queue.js:23-57`
- `packages/cloud-sync/flag-queue.js:149-159`

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: searched existing items and found
  no exact match for the combined secondary-query pull failure, the backup
  snapshot `cloudIncluded` masking bug, or the combined remote-delete stale
  local bug.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: found adjacent but non-duplicate
  overlap between the Quill push error-handling bug and existing item
  `SAS-AUD-20260602-007`; both involve stale Quill annotation state, but this
  new finding is a different cloud-sync failure path and needs its own entry.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed the phone pending-state
  concerns already belong to existing watchlist items
  `SAS-AUD-20260602-002` and `SAS-AUD-20260602-003`, so no new bug-log entry
  was created for them here.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: found no earlier checked
  cloud-zone checker section, so this run appends one new checker section
  rather than updating an older zone-checker entry.

## Overall Assessment

- Zone status: checked
- Audit result: four new confirmed cloud/sync/backups bugs; no product-code
  edits; existing phone watchlist items preserved without promotion
- Confidence: high
- Why not higher: this zone stayed static/read-only, so there was no live
  Supabase account run, live two-device delete repro, or real backup zip open
  check

## Next Steps

- Later safe cloud test: force or mock secondary-query failures for Proof and
  Quill pulls and confirm the UI surfaces a real sync failure instead of
  quietly rebuilding partial data.
- Later safe backup test: create a signed-in snapshot while one cloud pull is
  forced to fail, then inspect the zip manifest and `cloud/cloud-snapshot.json`
  together.
- Later safe desktop two-device test: delete one Proof book and one Quill
  project on Device A, refresh Device B, and confirm the deleted item does not
  remain locally or re-push.
- Later targeted Quill sync test: simulate failed chapter prune, failed
  chapter-id lookup, and failed annotation prune so the push helper cannot mark
  success on partial failure.
- No later checker-ready zone currently exists. Wait for the first later
  active-priority zone where `inspector-a.md`, `inspector-b.md`, and
  `inspector-c.md` all exist and no `checker.md` exists.
