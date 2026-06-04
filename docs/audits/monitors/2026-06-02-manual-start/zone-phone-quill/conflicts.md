# Conflict Ledger - Zone 8 Phone Quill

The three inspectors agreed that Phone Quill is live code, keeps phone audio
local, and still carries the already-known save-safety and doc-drift overlaps.
The main differences were whether the audio guidance contradiction was distinct
enough for a new bug, whether the absent edit/delete path should become a bug,
and whether the empty-pull cache branch was separate from earlier cloud items.

## Conflict 1 - Is the Phone Quill audio guidance contradiction a distinct bug?

- Original Inspector A claim: did not raise the no-match audio guidance path as
  a fail item.
- Original Inspector B claim: the project screen says Marie can still pick
  audio inside the reader, but the reader disables manual pick and tells her to
  go back to the chapter list instead.
- Original Inspector C claim: the same no-match path is a new confirmed UI
  mismatch because the source hardcodes both conflicting messages.
- Evidence:
  - `app/phone/page.js:952-960`
  - `app/phone/page.js:1460-1471`
  - `app/phone/page.js:2673-2693`
- Checker follow-up audit: confirmed the exact contradiction in current source.
  The project-level no-match status promises in-reader picking, while the
  reader passes `allowManualPick={false}` and the dock directs the user back to
  the chapter list.
- Checker assessment: distinct confirmed Phone Quill bug. Logged as
  `SAS-AUD-20260602-019`.
- Status: `resolved`
- Next check needed: safe live `/phone` Quill run with unmatched audio files,
  then confirm the visible text and missing picker match the current source.

## Conflict 2 - Should the current Phone Quill edit/delete gap become a new bug?

- Original Inspector A claim: current source appears to have no end-user edit
  or delete path for existing phone Quill annotations.
- Original Inspector B claim: the phone Quill reader still lacks edit/delete,
  but this looks like an already-known unfinished feature rather than a new
  duplicate bug-log item.
- Original Inspector C claim: did not raise the edit/delete gap as a fail item.
- Evidence:
  - `docs/FRONT_FUNCTION_TREE.md:97-108`
  - `TODO.md:164-168`, `235-236`
  - `HANDOFF.md:42-43`
  - `app/phone/page.js:1326-1457`
- Checker follow-up audit: confirmed that current source renders existing
  annotations as read-only cards and exposes a create-only `New annotation`
  popover. The same gap is already marked missing in docs and handoff notes.
- Checker assessment: keep it visible as a known missing feature, not a new
  bug-log item in this checker pass.
- Status: `resolved`
- Next check needed: safe live phone run if the release decision later needs
  proof of how noticeable or blocking the missing feature is in the current UI.

## Conflict 3 - Does the Phone Quill docs mismatch need a separate zone bug?

- Original Inspector A claim: treated the Phone Quill docs mismatch as a
  watchlist/doc-drift note.
- Original Inspector B claim: raised the same docs mismatch as a fail item.
- Original Inspector C claim: raised the same docs mismatch as a fail item and
  tied it directly to live source paths.
- Evidence:
  - `docs/FRONT_FUNCTION_TREE.md:97-108`
  - `docs/WIRING_MATRIX.md:89-96`
  - `app/phone/page.js:244-257`
  - `app/phone/page.js:791-977`
  - `app/phone/page.js:1128-1279`
- Checker follow-up audit: confirmed the docs drift is real, but also confirmed
  it already belongs under the existing umbrella docs item
  `SAS-AUD-20260602-001`.
- Checker assessment: keep this visible as overlap under the existing doc-drift
  bug; do not create a duplicate Phone Quill docs entry.
- Status: `resolved`
- Next check needed: docs-only cleanup later should update the Phone Quill rows
  in `docs/WIRING_MATRIX.md` to match the current source and the front
  function tree.

## Conflict 4 - Is the empty successful Phone Quill pull a distinct stale-cache risk?

- Original Inspector A claim: an empty Quill cloud result can leave old phone
  Quill projects visible until some manual reset or later state change.
- Original Inspector B claim: the same empty-pull branch is a code-traced risk,
  adjacent to the desktop remote-delete bug but not clearly the same issue.
- Original Inspector C claim: the same refresh logic can leave stale cached
  Quill projects visible after a legitimate all-projects delete or account
  mismatch.
- Evidence:
  - `app/phone/page.js:791-818`
  - `app/phone/page.js:1073-1077`
  - `app/phone/_lib/projectCache.js:34-68`
- Checker follow-up audit: confirmed that the current refresh branch only trusts
  non-empty pulls. If Supabase returns a successful empty array while local
  state already contains cached projects, the function returns `current` and
  does not rewrite the cache to `[]`.
- Checker assessment: distinct code-traced watchlist risk. Logged as
  `SAS-AUD-20260602-020`.
- Status: `likely`
- Next check needed: safe signed-in phone refresh test with cached Quill
  projects plus an intentionally empty cloud list, then confirm whether the
  stale cards remain after Refresh and after account switching.
