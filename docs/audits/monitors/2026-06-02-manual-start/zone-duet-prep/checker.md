# Zone Checker - Zone 11 Duet Prep

- Date/time: 2026-06-02 15:01 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for the Duet Prep zone only; preserve disagreements; run focused read-only follow-up where needed; dedupe before touching the master report or bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-duet-prep/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-duet-prep/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-duet-prep/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main disagreements around:

- `app/components/PrebuildMode.js`
- `app/components/SessionsView.js`
- `docs/WIRING_MATRIX.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p'` on the three Duet inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba app/components/PrebuildMode.js \| sed -n '180,210p;760,805p;930,970p;1008,1034p;1129,1144p'` | 0 |
| `rg -n "\\bscanned\\b\|\\btranscribed\\b\|\\bcompleted\\b" app/components/PrebuildMode.js` | 0 |
| `sed -n '1144,1218p' app/components/PrebuildMode.js` | 0 |
| `nl -ba app/components/SessionsView.js \| sed -n '500,525p;2818,2834p;3092,3104p'` | 0 |
| `node - <<'EOF' ... formatAuditionTime(61.9996) ... formatAuditionTime(3599.9996) ... EOF` | 0 |
| `rg -n "transcribed.*scanned\|marker.*1000\|formatAuditionTime\|by chapter position\|Duet" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start -g '!**/zone-duet-prep/*'` | 0 |

## Merged Findings

### PASS - Duet Prep remains a real desktop mode with local import, scan, save, and marker-export wiring

All three inspectors agreed on the baseline shape, and the checker follow-up
did not find a contradiction:

- Duet routes from the main shell into a real desktop mode.
- The mode persists local projects through the Electron Prebuild IPC path.
- The scan path stores transcript words, alignments, and match quality.
- The export path builds one marker file per chapter and hands the files to the
  Electron export-folder bridge.

Evidence:

- `app/page.js:1543`
- `app/components/PrebuildMode.js:336-370`, `766-805`, `935-967`
- `preload.js:9-10`, `26`
- `main.js:236-249`, `1287-1291`, `1457-1468`

### CONFIRMED BUG - Duet scans can still show as incomplete in the shared book-detail flow

Inspector B raised this as a fail item and Inspector A raised the same logic as
a watchlist risk. The checker follow-up confirms the mismatch:

- Duet scan status is tracked through `transcribed`.
- The scan path sets `transcribed: true` after a successful chapter scan.
- Duet's own counters and readiness badges also read `transcribed`.
- The shared book-detail adapter still derives `completed` from `!!ch.scanned`
  unless Marie manually toggled a completion override.
- No Duet scan path writes `scanned`, so a fresh scan can remain visually
  incomplete in the shared chapter list and completion counts until Marie
  toggles it by hand.

Checker assessment: this is a confirmed Duet status bug, not just a coverage
gap. The current source uses one scan flag almost everywhere and then switches
to a different never-written property at the shared book-detail handoff.

Evidence:

- `app/components/PrebuildMode.js:505-515`
- `app/components/PrebuildMode.js:766-805`
- `app/components/PrebuildMode.js:1129-1143`
- `app/components/PrebuildMode.js:1195-1220`
- `app/components/SessionsView.js:518-520`, `2826-2829`, `3098-3100`

### CONFIRMED BUG - Duet marker export can emit invalid `...1000` millisecond start times

Only Inspector C raised this as a fail item. The checker follow-up confirms the
formatter issue directly:

- `formatAuditionTime()` rounds milliseconds but never carries `1000`
  milliseconds into the next second.
- The export path writes that formatter result directly into the Audition
  marker `Start` column.
- A read-only Node reproduction returned `1:01.1000` for `61.9996` and
  `59:59.1000` for `3599.9996`.

Checker assessment: this is a confirmed Duet export bug. Near a second
boundary, the current formatter can emit an invalid decimal-time string instead
of rolling over cleanly to the next second.

Evidence:

- `app/components/PrebuildMode.js:196-204`
- `app/components/PrebuildMode.js:941-965`
- Read-only reproduction command output:
  - `61.9996 => 1:01.1000`
  - `3599.9996 => 59:59.1000`

### LIKELY RISK - Duet manuscript re-upload still carries old audio and scan data by chapter position only

Inspectors A and B both raised this as a watchlist risk. The checker follow-up
confirms the current carry-over rule:

- Re-upload matches each new chapter to the old project by array index.
- It then copies the old chapter's `audioFile`, `audioPath`,
  `whisperWords`, `whisperAlignment`, `whisperMatchQuality`, and
  `transcribed` fields onto the new chapter in that position.

Checker assessment: the risk is real in source, but this pass does not have
enough evidence to log it as a confirmed bug. The code comment says the main
assumption is re-uploading "the same manuscript" where chapter order stays the
same, and no live re-upload repro was run here to prove a current user-facing
failure when split structure changes. Keep it visible as a likely Duet
follow-up, not a new bug-log entry yet.

Evidence:

- `app/components/PrebuildMode.js:1017-1030`

### RESOLVED - Duet wiring/docs mismatch belongs under the existing docs-drift bug

All three inspectors saw the Duet docs mismatch, but they differed on whether
it needed its own zone-specific bug. The checker follow-up confirms the drift
is real and belongs under the existing docs-drift family:

- `docs/FRONT_FUNCTION_TREE.md` marks the Duet flows `REAL`.
- `docs/WIRING_MATRIX.md` still marks the Duet rows `MISSING`.
- The current source tree contains live Duet mode, scan, and export wiring.

Checker assessment: update existing bug `SAS-AUD-20260602-001` with this
Duet-specific evidence; do not create a separate Duet docs bug.

Evidence:

- `docs/FRONT_FUNCTION_TREE.md:64-71`
- `docs/WIRING_MATRIX.md:59-66`
- `app/components/PrebuildMode.js`

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: searched existing items and found
  no matching Duet completion-state or Audition timestamp bug, so two new
  bug-log entries were needed.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed the Duet wiring/docs
  mismatch overlaps existing item `SAS-AUD-20260602-001`, so that item was
  updated instead of adding a duplicate docs bug.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: the re-upload-by-position finding
  remains outside the bug log for now because this checker pass did not prove a
  current user-facing failure and the source comment still frames the path as
  same-order manuscript replacement.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: found no checked Duet zone
  entry yet, so this run appends one new checker section rather than
  duplicating an older Duet result.

## Overall Assessment

- Zone status: checked
- Audit result: two new confirmed Duet bugs; existing docs-drift bug expanded
  with Duet-specific evidence; one re-upload risk preserved as likely only
- Confidence: medium-high
- Why not higher: the zone stayed static/read-only, so no live Electron Duet
  session, live marker export open-check, or live manuscript re-upload repro
  was run

## Next Steps

- Reproduce the completion-state bug later inside an isolated safe Duet desktop
  run by scanning one chapter and confirming the shared chapter list stays in
  sync without needing a manual completion toggle.
- Reproduce the marker-time formatting bug later by exporting a marker file
  that contains a boundary-case insertion time and inspecting the output in a
  safe editor or Audition import check.
- Run a targeted safe re-upload test later where a manuscript gains, loses, or
  reorders split scenes near the front of the book to decide whether the
  position-only carry-over should become a confirmed bug.
- No later checker-ready zone currently exists. Wait for the first later active
  zone where `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` all exist
  and no `checker.md` exists.
