# Zone Checker - Zone 3 Proof Listen

- Date/time: 2026-06-02 12:28 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for Zone 3 only; preserve disagreements; run focused read-only follow-up where needed; dedupe before touching the master report or bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-proof-listen/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-proof-listen/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-proof-listen/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main disagreements around:

- `app/components/SessionsView.js`
- `app/components/ProofingReader.js`
- `app/phone/page.js`
- `app/page.js`
- `packages/cloud-sync/proof-sync.js`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p'` on the three Zone 3 inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba app/components/SessionsView.js \| sed -n '300,395p'` | 0 |
| `nl -ba app/components/ProofingReader.js \| sed -n '860,895p'`, `1086,1098p`, `1288,1338p`, `1420,1428p` | 0 |
| `nl -ba app/phone/page.js \| sed -n '150,170p'` and `2206,2236p` | 0 |
| `nl -ba app/page.js \| sed -n '118,145p'`, `1132,1188p`, `2340,2352p` | 0 |
| `nl -ba packages/cloud-sync/proof-sync.js \| sed -n '150,175p'` and `264,339p` | 0 |
| `rg -n "local_id\|phone-flag\|sentPlain\|Should Say\|proof-sync\|csv"` across the bug log, report, and existing checked outputs | 0 |

## Merged Findings

### PASS - Proof Listen still has the expected static workflow surface

The inspectors agree on the core static shape: Proof Listen still has mapped
desktop entry points for manuscript import, audio attach, transcription,
reader flagging, CSV export, and page-map rescan. The checker follow-up did
not find a contradiction to that baseline.

Evidence:

- `app/page.js`
- `app/components/ManuscriptSetup.js`
- `app/components/SessionsView.js`
- `app/components/ProofingReader.js`
- `main.js`

### CONFIRMED BUG - Proof export output labels the quote column as `Note`

All three inspectors pointed at the same user-facing export problem, but the
checker follow-up narrows the exact failure:

- The current Proof data model uses `sentPlain` / `quote` for the misread text
  and `note` for the correction.
- Desktop book-detail CSV export, desktop in-reader CSV export, desktop
  in-reader sheet-row preview, and phone Proof CSV export all place the quote
  text in the seventh column while labeling that column `Note`.
- The eighth column remains labeled `Should Say` and receives the correction
  note.

Checker assessment: this is a confirmed Proof export/preview labeling bug, not
just a docs issue. The output headings do not match the actual data.

Evidence:

- `app/components/SessionsView.js:306-313`, `385-387`
- `app/components/ProofingReader.js:872-883`, `1091-1095`, `1292-1333`
- `app/phone/page.js:152-170`
- `app/page.js:2349`

### RESOLVED - Current pulled phone flags do not lose their stable ids in the normal round trip

Inspector A raised a likely desktop edit/delete bug for phone-created flags.
The checker follow-up does not confirm that as a current bug:

- Phone-created Proof flags are saved with an explicit `id`.
- `upsertProofFlag()` persists that `id` inside the stored `flag` payload as
  well as using `local_id`.
- `pullProofProjects()` spreads `f.flag`, so the pulled in-app flag keeps the
  saved `id` even though the function also adds `cloudLocalId`.
- Desktop `stableFlagId()` returns `flag.id` when present, so current rows keep
  the same stable id through desktop edits/deletes.

Checker assessment: the claimed current bug is not confirmed. The explicit
`local_id` to `id` remap is still missing, so a legacy cloud row without an
embedded `flag.id` could still deserve later checking, but that is not enough
to log a new bug from this run.

Evidence:

- `app/phone/page.js:2213-2233`
- `packages/cloud-sync/proof-sync.js:150-165`, `276-280`, `299-327`
- `app/page.js:126-137`, `1135-1169`

### RESOLVED - Proof export/sync automated coverage is a real gap, but not a new bug-log item by itself

Inspector B treated the missing tests as a fail item, while Inspectors A and C
kept it as a watchlist risk. The checker follow-up agrees the gap is real:

- the current `tests/` set does not directly cover Proof CSV header/value
  alignment, `proof-sync` round trips, or the flag queue retry path;
- but this run did not reproduce a separate product failure from the coverage
  gap beyond the export-label bug already logged.

Checker assessment: keep the coverage gap in this checked report and next-step
notes; do not create a separate bug-log item for test coverage alone.

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: searched existing items and found
  no matching bug for the Proof export-label mismatch, so a new bug-log entry
  was needed.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: searched existing runs and
  found no checked Zone 3 entry yet, so this run appends one new checker
  section rather than duplicating an older Proof result.
- Existing watchlist `SAS-AUD-20260602-003` already covers the phone pending
  queue-count concern, so no new bug was added for that overlap.

## Overall Assessment

- Zone status: checked
- Audit result: one new confirmed Proof export bug; no second confirmed Proof
  sync bug from this checker pass
- Confidence: medium-high
- Why not higher: the zone stayed static/read-only, so no live CSV file,
  live cloud round trip, or safe Electron Proof session was run

## Next Steps

- Verify the new bug later with live exports from the desktop book view, the
  desktop reader, and the phone Proof export path inside an isolated safe test
  environment.
- Add targeted tests for Proof export header/value alignment and for the
  `packages/cloud-sync/proof-sync.js` / `packages/cloud-sync/flag-queue.js`
  round-trip paths.
- The next zone-checker run should wait for the first later zone where all
  three inspector reports exist and no `checker.md` exists.
