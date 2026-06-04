# Conflict Ledger - Zone 02 Cloud, Auth, Audio Privacy, Save Data, and Backups

The three inspectors agreed that the six-table cloud fence and audio-stripping
boundary are still present. The differences were about which cloud failure
paths were serious enough to call out in this zone and which existing risks
should remain watchlist-only.

## Conflict 1 - Can Proof and Quill pulls silently succeed after later cloud queries fail?

- Original Inspector A claim: Proof and Quill pull helpers check only the
  top-level project-row query and can quietly rebuild incomplete data if later
  transcription/flag or chapter/annotation queries fail.
- Original Inspector B claim: did not raise this as a fail item.
- Original Inspector C claim: did not raise this as a fail item.
- Evidence:
  - `packages/cloud-sync/proof-sync.js:216-231`
  - `packages/cloud-sync/proof-sync.js:233-286`
  - `packages/cloud-sync/quill-sync.js:162-177`
  - `packages/cloud-sync/quill-sync.js:179-285`
- Checker follow-up audit: confirmed that the secondary Proof and Quill pull
  queries do not check `error` before the merge/rebuild continues.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-010`.
- Status: `resolved`
- Next check needed: safe cloud test or targeted regression that forces the
  secondary queries to fail and confirms the app surfaces a sync error instead
  of partial/stale data.

## Conflict 2 - Can backup snapshots claim cloud data even when the cloud reads failed?

- Original Inspector A claim: did not raise this as a fail item.
- Original Inspector B claim: backup snapshots can still record cloud coverage
  as present even when Proof or Quill cloud reads failed.
- Original Inspector C claim: did not raise this as a fail item.
- Evidence:
  - `packages/backups/index.js:73-83`
  - `packages/backups/index.js:100-109`
  - `main.js:2076-2091`
- Checker follow-up audit: confirmed that failed cloud pulls are converted to
  empty arrays, the snapshot object still gets passed to Electron, and the zip
  manifest still writes `cloudIncluded: true` whenever that object exists.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-011`.
- Status: `resolved`
- Next check needed: safe signed-in snapshot repro that forces one cloud pull
  to fail and then inspects both `manifest.json` and
  `cloud/cloud-snapshot.json`.

## Conflict 3 - Can Quill push hide critical Supabase errors and still mark the sync finished?

- Original Inspector A claim: did not raise this as a fail item.
- Original Inspector B claim: the Quill push helper ignores chapter-prune,
  chapter-id lookup, and annotation-prune errors, can fall back to
  `chapter_id: null`, and still records a success hash.
- Original Inspector C claim: did not raise this as a fail item.
- Evidence:
  - `packages/cloud-sync/quill-sync.js:101-116`
  - `packages/cloud-sync/quill-sync.js:119-156`
- Checker follow-up audit: confirmed that those calls are awaited without
  checking the returned `error` and that the final hash write still runs after
  them.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-012`.
- Status: `resolved`
- Next check needed: targeted sync regression that forces those Supabase calls
  to fail and confirms the helper does not mark a partial push successful.

## Conflict 4 - Do remotely deleted Proof books and Quill projects stay on the desktop after refresh?

- Original Inspector A claim: did not raise this as a fail item.
- Original Inspector B claim: did not raise this as a fail item.
- Original Inspector C claim: desktop Proof and Quill merge logic keeps
  local-only items even when they disappeared from the cloud, so remote deletes
  can stay visible locally.
- Evidence:
  - `app/page.js:399-416`
  - `app/page.js:639-650`
  - `app/components/QuillAndInkMode.js:350-370`
  - `app/components/QuillAndInkMode.js:504-512`
  - `packages/cloud-sync/tombstones.js:152-171`
- Checker follow-up audit: confirmed that both desktop merge paths seed from
  the full local list, never prune absent cloud items, and early-return on
  empty cloud results; the tombstone helper only protects locally initiated
  deletes from being re-pulled.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-013`.
- Status: `resolved`
- Next check needed: safe two-device delete test that removes one Proof book
  and one Quill project on Device A, then refreshes Device B.

## Conflict 5 - Should the phone pending-state concerns become new confirmed bugs in this zone?

- Original Inspector A claim: did not raise a new pending-state bug.
- Original Inspector B claim: Phone Quill still has no confirmed offline queue
  or visible pending state; keep it visible.
- Original Inspector C claim: the Proof pending-count user-scope concern still
  looks plausible in source; keep it visible.
- Evidence:
  - `app/phone/page.js:877-886`
  - `packages/cloud-sync/flag-queue.js:23-57`
  - `packages/cloud-sync/flag-queue.js:149-159`
- Checker follow-up audit: confirmed that these are still the same existing
  code-traced risks already logged elsewhere, but this checker pass did not add
  any new proof that would promote them to confirmed bugs.
- Checker assessment: keep under existing watchlist entries
  `SAS-AUD-20260602-002` and `SAS-AUD-20260602-003`.
- Status: `likely`
- Next check needed: safe live offline/reconnect and account-swap tests for
  the existing phone watchlist items.
