# Zone Checker - Zone 8 Phone Quill

- Date/time: 2026-06-02 21:08 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for
  the Phone Quill zone only; preserve disagreements; run focused read-only
  follow-up where needed; dedupe before touching the master report or bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-phone-quill/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-phone-quill/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-phone-quill/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main disagreements around:

- `app/phone/page.js`
- `app/phone/_lib/projectCache.js`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/WIRING_MATRIX.md`
- `TODO.md`
- `HANDOFF.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p'` on the three Phone Quill inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `rg -n "Phone Quill\|audio inside the reader\|No filenames matched\|allowManualPick\|edit/delete annotation\|Edit / delete annotation" docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md TODO.md HANDOFF.md docs/FRONT_FUNCTION_TREE.md docs/WIRING_MATRIX.md` | 0 |
| `nl -ba app/phone/page.js \| sed -n '930,970p;1326,1475p;2665,2695p'` | 0 |
| `nl -ba app/phone/page.js \| sed -n '791,818p;1070,1078p'` | 0 |
| `nl -ba app/phone/_lib/projectCache.js \| sed -n '30,68p'` | 0 |
| `rg -n "SAS-AUD-20260602-001\|SAS-AUD-20260602-002\|SAS-AUD-20260602-010\|SAS-AUD-20260602-012\|SAS-AUD-20260602-013\|SAS-AUD-20260602-018\|No filenames matched\|inside the reader\|allowManualPick\|audio folder" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` | 0 |

## Merged Findings

### PASS - Phone Quill still has a real project, chapter, create-annotation, and export flow

All three inspectors agreed the current Phone Quill surface is real code rather
than a placeholder:

- project refresh pulls Quill projects into the phone list
- chapters open into a reader with range selection and create-annotation wiring
- export still uses the shared Quill CSV plus InDesign helpers
- the phone audio/cloud boundary still keeps audio local and sends only metadata

Evidence:

- `app/phone/page.js:791-818`
- `app/phone/page.js:1128-1279`
- `app/phone/page.js:1326-1457`
- `app/phone/page.js:244-257`
- `app/phone/_lib/audioLibrary.js:1-117`
- `packages/cloud-sync/quill-sync.js:12-18`

### CONFIRMED BUG - Phone Quill tells the user to pick audio inside the reader while the reader disables manual pick

Inspectors B and C independently raised the same user-facing contradiction, and
the checker follow-up confirms it in current source:

- the project-level no-match message says `You can still pick audio inside the reader.`
- the chapter reader passes `allowManualPick={false}` to `PhoneAudioDock`
- the dock then tells the user `Back to the chapter list to pick the audio folder.`

Checker assessment: distinct confirmed Phone Quill UI bug. Logged as
`SAS-AUD-20260602-019`.

Evidence:

- `app/phone/page.js:952-960`
- `app/phone/page.js:1460-1471`
- `app/phone/page.js:2673-2693`

### RESOLVED OVERLAP - Phone Quill edit/delete is still absent in current source, but this checker keeps it as a known missing feature rather than a new bug

Inspectors A and B both called out the lack of an end-user edit/delete path for
existing phone Quill annotations. The checker follow-up confirms the current
source still shows:

- existing annotations as read-only cards
- a `New annotation` popover
- a create-only `saveAnnotation()` path

The same gap is already described as missing in product docs and handoff notes.
Checker assessment: keep this visible as a known missing feature, not a new
bug-log entry in this pass.

Evidence:

- `docs/FRONT_FUNCTION_TREE.md:97-108`
- `TODO.md:164-168`, `235-236`
- `HANDOFF.md:42-43`
- `app/phone/page.js:1326-1457`

### CONFIRMED OVERLAP - Phone Quill docs drift still belongs under `SAS-AUD-20260602-001`

All three inspectors found the same docs mismatch with slightly different
severity labels:

- `docs/FRONT_FUNCTION_TREE.md` marks the core Phone Quill rows as live
- `docs/WIRING_MATRIX.md` still marks the same Phone Quill block `MISSING`
- current source contains live project-list, chapter-open, add-annotation, and
  export wiring

Checker assessment: real docs drift, but not a new zone-specific bug. The
existing umbrella docs item `SAS-AUD-20260602-001` was updated with the Phone
Quill evidence.

Evidence:

- `docs/FRONT_FUNCTION_TREE.md:97-108`
- `docs/WIRING_MATRIX.md:89-96`
- `app/phone/page.js:244-257`
- `app/phone/page.js:791-977`
- `app/phone/page.js:1128-1279`

### CONFIRMED OVERLAP - Phone Quill save-safety concerns still stay under the existing cloud watchlist and Quill sync bugs

The inspectors agreed the phone Quill save path still looks optimistic and does
not show a Proof-style pending banner or retry queue. Inspector C also tied the
same phone surface back to the already-logged Quill pull/push helper bugs.

Checker assessment:

- keep the no-pending-state risk under existing watchlist `SAS-AUD-20260602-002`
- keep the pull-helper overlap under `SAS-AUD-20260602-010`
- keep the push-helper overlap under `SAS-AUD-20260602-012`

No duplicate bug was added for those already-logged cloud-helper paths.

Evidence:

- `app/phone/page.js:877-887`
- `packages/cloud-sync/quill-sync.js:27-157`
- `packages/cloud-sync/quill-sync.js:162-177`
- `packages/cloud-sync/quill-sync.js:179-285`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` entries `SAS-AUD-20260602-002`, `SAS-AUD-20260602-010`, and `SAS-AUD-20260602-012`

### WATCHLIST RISK - Empty successful Phone Quill refreshes can preserve stale cached projects

All three inspectors raised the same underlying refresh/cache branch, and the
checker follow-up confirms the current behavior:

- `refreshFromCloud()` only replaces state when `list?.length` is truthy
- a successful empty Quill pull returns the existing `current` list instead of `[]`
- the empty-cache write path runs only when `current` was already empty

Checker assessment: distinct code-traced watchlist risk, not a confirmed live
bug yet. Logged as `SAS-AUD-20260602-020`.

Evidence:

- `app/phone/page.js:791-818`
- `app/phone/page.js:1073-1077`
- `app/phone/_lib/projectCache.js:34-68`

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` and
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: confirmed the Phone Quill
  docs mismatch still belongs under `SAS-AUD-20260602-001`.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed the Phone Quill
  no-pending-state concern is already covered by `SAS-AUD-20260602-002`.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed the shared Quill pull and
  push helper risks already belong under `SAS-AUD-20260602-010` and
  `SAS-AUD-20260602-012`.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` and
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: no exact existing item
  matched the audio-guidance contradiction or the empty-successful-pull Phone
  Quill stale-cache risk, so those were added as `SAS-AUD-20260602-019` and
  `SAS-AUD-20260602-020`.

## Overall Assessment

- Zone status: checked
- Audit result: one new confirmed Phone Quill UI bug, one new code-traced
  Phone Quill cache watchlist risk, existing docs/cloud overlaps preserved, no
  product-code edits, and no live phone or cloud run in this checker pass
- Confidence: medium-high
- Why not higher: the new stale-cache risk and the known no-pending-state risk
  still need safe live phone/cloud proof, and the edit/delete gap was not
  retested in a live phone session

## Next Steps

- Safe live phone Quill check: load audio files that do not match any chapter,
  open a chapter, and confirm the current project-screen message contradicts
  the reader audio dock.
- Safe signed-in phone Quill check: start with cached projects, make the cloud
  Quill list empty, refresh, and confirm whether stale projects remain visible.
- Safe offline Quill save check: create one phone annotation offline or during
  a forced push failure, reconnect, then confirm whether the final annotation
  survives to desktop without duplication or loss.
- The next checker-ready zone is now
  `docs/audits/monitors/2026-06-02-manual-start/zone-user-experience-quality/`,
  because Inspector A, Inspector B, and Inspector C reports now all exist there
  and no `checker.md` exists yet.
