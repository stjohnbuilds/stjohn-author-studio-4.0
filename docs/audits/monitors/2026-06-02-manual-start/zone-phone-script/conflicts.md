# Conflict Ledger - Zone 7 Phone Script

The three inspectors agreed that Phone Script is live code, keeps phone audio
local, and still carries the already-known Proof export header mismatch. The
differences were about which phone-specific risks are distinct enough to log
separately and whether the current surface truly lacks an edit path.

## Conflict 1 - Does a successful empty cloud pull leave stale phone books visible?

- Original Inspector A claim: did not raise a separate stale-cache-on-empty-pull
  item.
- Original Inspector B claim: an empty successful refresh appears unable to
  clear stale cached books because `refresh()` returns `current` when the pull
  result is `[]`.
- Original Inspector C claim: successful empty cloud pulls appear unable to
  clear stale cached books and may leave old phone books visible until some
  other state change happens.
- Evidence:
  - `app/phone/page.js:1522-1550`
  - `app/phone/page.js:1593-1599`
  - `app/phone/_lib/projectCache.js:34-68`
- Checker follow-up audit: confirmed that the current refresh path only replaces
  state when `list?.length` is truthy. If the cloud returns a successful empty
  array while local state already contains cached books, the function returns
  `current` and does not rewrite the cache to `[]`.
- Checker assessment: distinct code-traced watchlist risk. Logged as
  `SAS-AUD-20260602-018`.
- Status: `likely`
- Next check needed: safe signed-in phone refresh test with cached books plus
  an intentionally empty cloud list, then confirm whether the stale list stays
  visible after Refresh and after account switching.

## Conflict 2 - Should the Phone Script docs mismatch become a separate zone bug?

- Original Inspector A claim: treated the Phone Script docs mismatch as a
  watchlist/doc-drift note.
- Original Inspector B claim: raised the Phone Script docs mismatch as a fail
  item because `docs/WIRING_MATRIX.md` still marks the rows `MISSING`.
- Original Inspector C claim: raised the same docs mismatch as a fail item and
  tied it to the live source.
- Evidence:
  - `docs/FRONT_FUNCTION_TREE.md:88-95`
  - `docs/WIRING_MATRIX.md:81-87`
  - `app/phone/page.js:1481-1959`
  - `app/phone/page.js:1997-2535`
- Checker follow-up audit: confirmed the drift is real, but also confirmed it
  already belongs under existing umbrella docs item `SAS-AUD-20260602-001`.
- Checker assessment: keep this visible as overlap under the existing doc-drift
  bug; do not create a duplicate Phone Script docs entry.
- Status: `resolved`
- Next check needed: docs-only cleanup later should explicitly update the Phone
  Script rows in `docs/WIRING_MATRIX.md` to match the live source and the front
  function tree.

## Conflict 3 - Does the pending phone flag banner concern need a new bug?

- Original Inspector A claim: the pending banner/count still looks tied to a
  global queue store rather than the signed-in user.
- Original Inspector B claim: did not raise the pending-banner concern as a
  fail or watchlist item.
- Original Inspector C claim: the queue key is shared and the total pending
  count still looks global rather than user-scoped.
- Evidence:
  - `packages/cloud-sync/flag-queue.js:23-25`
  - `packages/cloud-sync/flag-queue.js:149-159`
  - `app/phone/page.js:1596-1598`
  - `app/phone/page.js:1824-1829`
- Checker follow-up audit: confirmed the same code-traced concern remains, but
  found no new evidence that promotes it past the existing watchlist.
- Checker assessment: keep this under `SAS-AUD-20260602-003`; do not add a new
  bug or promote it to confirmed without a safe two-account live repro.
- Status: `resolved`
- Next check needed: two-account phone test with one queued pending flag in
  Account A, then sign into Account B and confirm the banner stays scoped.

## Conflict 4 - Does Phone Script currently lack an end-user edit path for existing flags?

- Original Inspector A claim: current source appears to expose delete actions
  for existing flags, but no obvious edit affordance.
- Original Inspector B claim: did not raise a missing edit path as a fail item.
- Original Inspector C claim: did not raise a missing edit path as a fail item.
- Evidence:
  - `docs/APP_STRUCTURE.md:145-149`
  - `app/phone/page.js:2209-2274`
  - `app/phone/page.js:2338-2355`
  - `app/phone/page.js:3073-3106`
- Checker follow-up audit: confirmed add plus delete paths are explicit in
  source and no obvious edit handler for an existing flag was found in this
  static read. The source goals phrase the area as `edit/delete where
  implemented`, so this run does not yet prove a shipped-feature regression.
- Checker assessment: do not open a separate bug-log item yet.
- Status: `audit unclear`
- Next check needed: safe live phone navigation check to confirm whether edit
  is intentionally absent, hidden behind another gesture, or expected but
  missing.
