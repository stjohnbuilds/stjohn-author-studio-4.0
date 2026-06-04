# Zone Checker - Zone 7 Phone Script

- Date/time: 2026-06-02 20:40 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for
  the Phone Script zone only; preserve disagreements; run focused read-only
  follow-up where needed; dedupe before touching the master report or bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-phone-script/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-phone-script/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-phone-script/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main disagreements around:

- `app/phone/page.js`
- `app/phone/_lib/projectCache.js`
- `packages/cloud-sync/flag-queue.js`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p'` on the three Phone Script inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba app/phone/page.js \| sed -n '1488,1565p;1568,1660p;2200,2365p;3028,3120p'` | 0 |
| `nl -ba app/phone/_lib/projectCache.js \| sed -n '1,120p'` | 0 |
| `rg -n "updateFlag\|edit flag\|saveFlagToCloud\|removeFlagFromCloud\|buildFlagsCsv\|pullProofProjects\|countAllFlagQueues" app/phone/page.js packages/cloud-sync/flag-queue.js` | 0 |
| `rg -n "SAS-AUD-20260602-001\|SAS-AUD-20260602-003\|stale cached\|empty cloud pull\|cached books" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` | 0 |

## Merged Findings

### PASS - Phone Script still has a real auth, cache, refresh, and local-audio boundary

All three inspectors agreed that the current Phone Script surface is not a
placeholder:

- the shell reads Supabase auth state
- phone projects are cached per user in IndexedDB
- refresh has a timeout plus single-flight guard
- local audio stays on-device while cloud payloads keep only metadata
- phone flags have real save/delete paths plus an offline retry queue

Evidence:

- `app/phone/page.js:571-627`
- `app/phone/page.js:1502-1578`
- `app/phone/page.js:1668-1761`
- `app/phone/page.js:1831-1858`
- `app/phone/_lib/projectCache.js:34-68`
- `packages/cloud-sync/proof-sync.js:46-57`
- `packages/cloud-sync/flag-queue.js:87-239`

### CONFIRMED OVERLAP - Phone Proof export still matches existing bug `SAS-AUD-20260602-004`

All three inspectors independently found the same export-header mismatch, and
the checker follow-up confirms it remains present in the phone CSV builder:

- `buildFlagsCsv()` still emits `Type, Note, Should Say`
- the seventh column still writes `fl.sentPlain`
- the eighth column still writes `fl.note`

Checker assessment: do not add a duplicate bug. Keep this under the existing
confirmed Proof export item `SAS-AUD-20260602-004`.

Evidence:

- `app/phone/page.js:152-170`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` entry `SAS-AUD-20260602-004`

### CONFIRMED OVERLAP - Phone Script status drift still stays under `SAS-AUD-20260602-001`

All three inspectors raised the same underlying docs mismatch, even though they
classified it a little differently:

- current Phone Script source has live sign-in, project list, chapter open,
  audio pick/play, flag save/delete, and CSV export paths
- `docs/FRONT_FUNCTION_TREE.md` marks the same area `REAL` / `PARTIAL`
- `docs/WIRING_MATRIX.md` still leaves the Phone Script rows in the old
  `MISSING` state

Checker assessment: this is still real doc drift, but it already belongs under
the existing umbrella docs item `SAS-AUD-20260602-001`. Do not add a duplicate
Phone Script docs bug.

Evidence:

- `docs/FRONT_FUNCTION_TREE.md:88-95`
- `docs/WIRING_MATRIX.md:81-87`
- `app/phone/page.js:1481-1959`
- `app/phone/page.js:1997-2535`

### WATCHLIST RISK - Empty successful phone refreshes can preserve stale cached books

Inspectors B and C both raised this as a distinct concern, and the checker
follow-up confirms the source behavior:

- `refresh()` only replaces state when `list?.length` is truthy
- if Supabase returns a successful empty array and `current` already holds
  cached books, the function returns `current` instead of `[]`
- the empty-cache write path only runs when `current` is already empty

Checker assessment: new code-traced watchlist risk, not a confirmed live bug
yet. Logged as `SAS-AUD-20260602-018`.

Evidence:

- `app/phone/page.js:1522-1550`
- `app/phone/page.js:1593-1599`
- `app/phone/_lib/projectCache.js:34-68`

### CONFIRMED OVERLAP - The pending phone flag banner still looks global rather than user-scoped

Inspectors A and C called this out directly, and Inspector B did not disprove
it. The checker follow-up confirms the same static concern remains:

- queue storage is still shared under one browser key
- `countAllFlagQueues()` still sums every bucket
- Phone Script still shows that total directly in its pending banner

Checker assessment: keep this under the existing watchlist item
`SAS-AUD-20260602-003`. Do not promote it to a confirmed bug without a safe
two-account live repro.

Evidence:

- `packages/cloud-sync/flag-queue.js:23-25`
- `packages/cloud-sync/flag-queue.js:149-159`
- `app/phone/page.js:1596-1598`
- `app/phone/page.js:1824-1829`

### AUDIT UNCLEAR - No separate phone-flag edit-path bug is opened in this checker pass

Inspector A noted that they could not find a current end-user edit affordance
for existing phone Script flags. The checker follow-up confirms the current
source has visible delete paths but no obvious edit handler for existing flags.
This run does not promote that to a separate bug because:

- `docs/APP_STRUCTURE.md` describes phone Script as `edit/delete where implemented`
- the current source clearly implements add plus delete
- this checker pass did not run a live phone UI session to rule out any hidden
  or gesture-driven edit path

Checker assessment: keep this out of the bug log for now and revisit only with
safe live navigation proof if the current product goal is supposed to include
editing existing phone Script flags.

Evidence:

- `docs/APP_STRUCTURE.md:145-149`
- `app/phone/page.js:2209-2274`
- `app/phone/page.js:2338-2355`
- `app/phone/page.js:3073-3106`

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed the phone Proof export
  mismatch is already covered by `SAS-AUD-20260602-004`.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed the Phone Script status
  drift is already covered by `SAS-AUD-20260602-001`.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed the pending queue scoping
  concern is already covered by `SAS-AUD-20260602-003`.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` and
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: no exact existing item
  matched the empty-successful-pull stale-cache risk, so that concern was added
  as new watchlist item `SAS-AUD-20260602-018`.

## Overall Assessment

- Zone status: checked
- Audit result: no new confirmed Phone Script bug beyond existing overlaps;
  one new code-traced watchlist risk added; no product-code edits; no live
  phone or cloud run in this checker pass
- Confidence: medium-high
- Why not higher: the stale-cache and pending-banner concerns remain static
  source findings until a safe live phone/account repro is run

## Next Steps

- Safe live phone Proof check: start with cached books, make the cloud library
  empty, refresh, and confirm whether the stale list persists.
- Safe two-account phone check: create a queued pending flag in Account A,
  sign out, sign into Account B, and confirm the pending banner does not carry
  over.
- Safe phone CSV export check: export one real Phone Script CSV and confirm the
  visible header mismatch from `buildFlagsCsv()`.
- The next later checker-ready zone is now `zone-phone-quill`, because
  `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` all exist there and
  no `checker.md` exists yet.
