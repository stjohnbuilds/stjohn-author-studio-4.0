# Conflict Ledger - Zone 13 User Experience Quality

The three inspectors agreed that the repo still has real user-facing surfaces,
some existing accessibility groundwork, and a clean safe test baseline. The
main differences were whether the current UX issues were distinct bugs versus
overlaps, and which ones were strong enough to promote without a live run.

## Conflict 1 - Is the custom overlay semantics gap a real bug or just an untested accessibility concern?

- Original Inspector A claim: repeated custom modal/help surfaces still lack
  dialog semantics and focus management.
- Original Inspector B claim: did not raise the overlay semantics seam as a
  fail item.
- Original Inspector C claim: did not raise the overlay semantics seam as a
  fail item.
- Evidence:
  - `app/page.js:2329-2340`
  - `app/components/PrebuildMode.js:381-392`
  - `app/components/PrepManuscriptMode.js:780-791`
  - `app/components/QuillAndInkMode.js:1051-1062`
  - `app/components/ReaderChrome.js:542-555`
- Checker follow-up audit: confirmed that the inspected surfaces use plain
  fixed-overlay `div` stacks with click-outside / `Escape` close behavior but
  no visible `role="dialog"`, `aria-modal`, focus trap, or focus-return path.
- Checker assessment: distinct source-traced bug. Logged as
  `SAS-AUD-20260602-021`.
- Status: `resolved`
- Next check needed: safe keyboard-only or accessibility-tree pass to verify
  the exact live impact on focus order and announcement.

## Conflict 2 - Are the Proof expanders and glyph-only buttons separate bugs or one broader control-semantics issue?

- Original Inspector A claim: Proof chapter and section disclosure controls
  lack `aria-expanded` or equivalent state.
- Original Inspector B claim: the shared Home/Back pill lacks an explicit
  accessible name.
- Original Inspector C claim: several current glyph-only controls across
  desktop and phone still ship without accessible names.
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
- Checker follow-up audit: confirmed the examples all belong to one broader
  control-level accessibility seam: current controls still miss accessible
  state, accessible names, or both.
- Checker assessment: merge these examples into one bug instead of splitting
  them into duplicate micro-items. Logged as `SAS-AUD-20260602-023`.
- Status: `resolved`
- Next check needed: safe screen-reader pass over Proof, settings, and Quill
  popovers to confirm the exact current announcements.

## Conflict 3 - Is the core reader interaction seam truly keyboard-blocking?

- Original Inspector A claim: did not raise the shared reader interaction seam
  as a fail item.
- Original Inspector B claim: the shared desktop reader, phone reader, and
  Proof word-action path are still effectively pointer-only.
- Original Inspector C claim: the desktop Proof reader still has no keyboard
  path to open the per-word action menu.
- Evidence:
  - `app/components/ChapterReader.js:214-225`
  - `app/components/ChapterReader.js:374-386`
  - `app/phone/_components/PhoneReader.js:184-216`
  - `app/components/ProofingReader.js:1223-1229`
- Checker follow-up audit: confirmed that the current source exposes pointer
  handlers and double-click hooks for the main word-selection flows without a
  matching focusable keyboard path.
- Checker assessment: distinct source-traced bug. Logged as
  `SAS-AUD-20260602-022`.
- Status: `resolved`
- Next check needed: safe live keyboard-only run through Quill, Phone Quill,
  and Proof to verify how fully blocked the current shipped flows feel.

## Conflict 4 - Should the Phone Quill no-match guidance issue become a second Zone 13 bug?

- Original Inspector A claim: did not raise the no-match Phone Quill guidance
  contradiction in this zone.
- Original Inspector B claim: the same contradictory guidance belongs in UX
  coverage because it is a user-facing instruction mismatch.
- Original Inspector C claim: did not raise the no-match guidance in this
  zone.
- Evidence:
  - `app/phone/page.js:952-960`
  - `app/phone/page.js:2673-2693`
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` entry `SAS-AUD-20260602-019`
- Checker follow-up audit: confirmed the contradiction is real, but also
  confirmed it was already logged in the dedicated Phone Quill checker pass.
- Checker assessment: keep it visible as an overlap under
  `SAS-AUD-20260602-019`; do not create a duplicate Zone 13 bug.
- Status: `resolved`
- Next check needed: safe live `/phone` Quill audio no-match repro after the
  future product fix.

## Conflict 5 - Should touch-dismiss and bundle-weight notes be promoted now?

- Original Inspector A claim: did not raise a touch-dismiss or bundle-weight
  watchlist item.
- Original Inspector B claim: outside-dismiss on touch remains unproven, and
  current first-load JS is still fairly heavy.
- Original Inspector C claim: narrow-width crowding or overflow still looks
  likely in parts of the Proof reader, but no live repro was done.
- Evidence:
  - `app/components/ReaderChrome.js:545-555`
  - Inspector B Zone 13 build notes for `/` and `/phone`
  - `app/components/ProofingReader.js:1307-1340`
- Checker follow-up audit: confirmed the underlying source signals are real,
  but this checker still lacks a safe live touch or narrow-window repro.
- Checker assessment: keep these as watchlist-only notes for now rather than
  promoting them to new bug-log items.
- Status: `likely`
- Next check needed: safe live touch-dismiss and narrow-width browser/Electron
  checks.
