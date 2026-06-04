# Conflict Ledger - Zone 3 Proof Listen

The inspectors agreed that Proof Listen still exists as a mapped workflow
surface and that the zone remains mostly static-only in this run. The main
differences were about the exact export failure, whether phone-created flags
lose their ids on desktop, and whether missing direct tests should become a
bug-log item.

## Conflict 1 - What exactly is wrong in the Proof export output?

- Original Inspector A claim: Proof flag CSV exports swap the last two columns,
  so `Note` contains the quote and `Should Say` contains the correction note.
- Original Inspector B claim: did not raise a separate export bug.
- Original Inspector C claim: Proof CSV exports and the reader sheet preview
  swap the last two columns in the same way.
- Evidence:
  - `app/components/SessionsView.js:306-313`, `385-387`
  - `app/components/ProofingReader.js:872-883`, `1091-1095`, `1292-1333`
  - `app/phone/page.js:152-170`
  - `app/page.js:2349`
- Checker follow-up audit: confirmed the user-facing output is wrong, but
  narrowed the root cause. The correction note still lands under `Should Say`.
  The broken part is that the quote text is exported and previewed under a
  column labeled `Note` instead of a quote-specific label.
- Checker assessment: confirmed export/preview labeling bug.
- Status: `resolved`
- Next check needed: live CSV export from desktop and phone, then open the file
  and confirm the headers now match the actual quote/correction fields.

## Conflict 2 - Do pulled phone-created Proof flags lose their stable ids on desktop?

- Original Inspector A claim: cloud-pulled phone flags do not restore the
  stored `local_id` as `id`, so a later desktop edit/delete can target the
  wrong cloud row.
- Original Inspector B claim: did not raise this item.
- Original Inspector C claim: desktop Proof saves/deletes are wired through
  stable ids, queue storage, and single-row helpers; did not report an id-loss
  bug.
- Evidence:
  - `app/phone/page.js:2213-2233`
  - `packages/cloud-sync/proof-sync.js:150-165`, `276-280`, `299-327`
  - `app/page.js:126-137`, `1135-1169`
- Checker follow-up audit: confirmed that current rows already carry `flag.id`
  inside the stored `flag` payload, and the pull path spreads that payload back
  into the in-app flag. That means `stableFlagId()` reuses the existing id for
  current rows. An explicit `local_id` to `id` remap is absent, but it was not
  enough to confirm the claimed current bug.
- Checker assessment: not confirmed as a current bug; legacy cloud rows without
  embedded `flag.id` may still deserve a later safe round-trip check.
- Status: `resolved`
- Next check needed: safe live phone-to-desktop edit/delete test, ideally with
  one newly created phone flag and one legacy-style row if such data exists in
  a disposable audit account.

## Conflict 3 - Should the missing direct Proof export/sync tests become a separate bug-log item?

- Original Inspector A claim: treated the missing export/id coverage as a
  watchlist item and next-step gap.
- Original Inspector B claim: the missing `proof-sync` / `flag-queue` test
  coverage is a fail item for this zone.
- Original Inspector C claim: the missing Proof export and reader coverage is a
  watchlist item that likely explains why the export issue slipped through.
- Evidence:
  - `tests/cloud-slim.test.mjs`
  - `tests/whisper-json.test.mjs`
  - `packages/cloud-sync/proof-sync.js`
  - `packages/cloud-sync/flag-queue.js`
  - `app/components/ProofingReader.js`
  - `app/components/SessionsView.js`
- Checker follow-up audit: confirmed the coverage gap is real, but the checker
  only logged the user-facing export bug that the code proves today.
- Checker assessment: keep the coverage gap in the checked report and next-step
  notes; do not create a separate bug-log item for test absence alone.
- Status: `resolved`
- Next check needed: add focused tests for Proof export header/value alignment
  and Proof cloud/queue round trips after the audit wave moves into fix work.
