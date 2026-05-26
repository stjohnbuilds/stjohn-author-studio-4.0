# Phase H18 — 26-test run results

Run started: 2026-05-26 evening
Driver: Claude via Preview server on localhost:3000/phone (mobile viewport 375x812)
Approach: Walk every test, report ✓ pass / ⚠ minor / ❌ broken. Fix anything broken inline.

## Phone (14 tests)

| # | Test | Status | Notes |
|---|---|---|---|
| 1 | Service picker + cog | ✓ | Quill + Proof + cog + profile pill all present after dev-skip login |
| 2 | Settings cog opens | — | |
| 3 | Sign out → sign in | — | |
| 4 | Proof book list empty state | — | |
| 5 | Proof book list with data | — | |
| 6 | Open book → chapter list | — | |
| 7 | Tabs Chapters / Flags | — | |
| 8 | Open chapter → reader renders | — | |
| 9 | Reader settings persist | — | |
| 10 | Page Swipe mode | — | |
| 11 | Pick audio for chapter | — | |
| 12 | Tap-word → flag form | — | |
| 13 | Save flag → appears in Flags tab | — | |
| 14 | Delete flag → gone after refresh | — | |

## Desktop (8 tests)

| # | Test | Status | Notes |
|---|---|---|---|
| 15 | Home → book list, last-touched first | — | |
| 16 | Resync button + last-synced text | — | |
| 17 | Open book → no banner, inline title | — | |
| 18 | Tutorial pill clickable | — | |
| 19 | Side nav: Nav / Flags / Queue tabs | — | |
| 20 | Flags tab — all flags listed | — | |
| 21 | Delete flag from desktop | — | |
| 22 | Home → back, audio dock survives | — | |

## Cross-device (4 simulated tests)

| # | Test | Status | Notes |
|---|---|---|---|
| 23 | Phone save → desktop refresh sees it | — | |
| 24 | Phone delete → desktop refresh loses it | — | |
| 25 | Desktop delete book → phone loses it | — | |
| 26 | Phone offline save → online retry | — | |

## Fixes applied this run

(filled as we go)
