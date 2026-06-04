# Zone Checker - Zone 4 Prep Manuscript

- Date/time: 2026-06-02 13:06 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for Zone 4 only; preserve disagreements; run focused read-only follow-up where needed; dedupe before touching the master report or bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-prep-manuscript/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-prep-manuscript/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-prep-manuscript/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main disagreements around:

- `app/components/PrepManuscriptMode.js`
- `app/components/ImportFlow.js`
- `app/components/prepExport.js`
- `docs/WIRING_MATRIX.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p'` on the three Zone 4 inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba app/components/PrepManuscriptMode.js \| sed -n '300,380p'`, `500,560p`, `688,710p`, `880,1010p` | 0 |
| `nl -ba app/components/ImportFlow.js \| sed -n '480,535p'` | 0 |
| `nl -ba app/components/prepExport.js \| sed -n '500,590p'` | 0 |
| `nl -ba docs/WIRING_MATRIX.md \| sed -n '49,58p'` | 0 |
| `nl -ba docs/INTERNAL_FUNCTION_TREE.md \| sed -n '24,38p'` | 0 |
| `rg -n "updateSectionHtml\|oldByText\|pdfPageMap\|manualEdits\|duplicate\|occurrence"` across Prep source, tests, bug log, report, and checked outputs | 0 |

## Merged Findings

### PASS - Prep Manuscript remains a real local mode with import, assignment, safety, and export wiring

All three inspectors agreed on the baseline shape, and the checker follow-up
did not find a contradiction:

- Prep hydrates and saves through its own local IPC path.
- Import commits chapters into section-based Prep state and runs dialogue
  detection.
- The mode exposes highlighted DOCX export plus both CSV export actions.
- Existing helper coverage still gives useful evidence for dialogue parsing and
  duplicate-aware DOCX export anchoring.

Evidence:

- `app/components/PrepManuscriptMode.js:309-399`, `582-630`
- `app/components/ImportFlow.js:498-530`
- `preload.js:11-12`
- `main.js:1294-1310`
- `tests/prep-export.test.mjs:120-213`
- `tests/manuscript-engine.test.mjs:12-38`

### CONFIRMED BUG - Prep Fix/rescan can collapse distinct assignments on repeated dialogue

Inspector A raised a specific failure in the Prep Fix flow. The checker
follow-up confirms the current logic:

- `updateSectionHtml()` reruns dialogue detection after Marie edits a warning
  paragraph.
- It builds `oldByText` from the prior spans and keeps only the first old span
  for each repeated quote text.
- It then reapplies assignments to every new matching span by `sp.text` alone.

Checker assessment: this is a confirmed Prep assignment bug, not just a
coverage gap. If the same quote text appears multiple times in one section and
Marie had assigned those duplicates differently, using the Fix/rescan path can
silently copy the first assignment onto later duplicates.

Evidence:

- `app/components/PrepManuscriptMode.js:517-535`
- `app/components/PrepManuscriptMode.js:561-579`
- `app/components/PrepManuscriptMode.js:759-763`
- `tests/prep-export.test.mjs:120-213`

### RESOLVED - Prep wiring-matrix and helper-path drift belongs under the existing docs bug

Inspectors B and C treated the stale Prep docs as a fail item. The checker
follow-up confirms the drift is real, but it overlaps the existing
documentation-drift bug rather than needing a new entry:

- `docs/WIRING_MATRIX.md` still marks Prep controls as `MISSING`.
- `docs/INTERNAL_FUNCTION_TREE.md` still points at top-level `lib/...` helper
  paths while current repo structure and `docs/APP_STRUCTURE.md` use `app/lib/...`.

Checker assessment: update existing bug `SAS-AUD-20260602-001` with this new
Prep-specific evidence; do not create a separate Zone 4 docs bug.

Evidence:

- `docs/WIRING_MATRIX.md:49-57`
- `docs/FRONT_FUNCTION_TREE.md:52-62`
- `docs/INTERNAL_FUNCTION_TREE.md:32-35`
- `docs/APP_STRUCTURE.md`

### AUDIT UNCLEAR - Prep page-map handoff has real code drift, but current user impact is still unproven

Inspector A flagged the import/post-import page-map path. The checker
follow-up confirms the code mismatch:

- `ImportFlow` passes `pdfPageMap` in the import payload.
- `commitImport()` does not store `payload.pdfPageMap` on the Prep project.
- The later post-import PDF upload tries to rebuild from `ch?.html`, but Prep
  chapters currently store HTML under `sections[0].html`.

Checker assessment: the mismatch is real, but this run did not find a current
Prep consumer of `project.pdfPageMap` in the zone. The page-number banner uses
`pdfPaging`, not the slim map. Keep this visible as `audit unclear`; do not add
a new bug-log item yet.

Evidence:

- `app/components/ImportFlow.js:513-530`
- `app/components/PrepManuscriptMode.js:316-347`
- `app/components/PrepManuscriptMode.js:923-959`

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: searched existing items and found
  no matching Prep Fix/rescan duplicate-dialogue bug, so one new bug-log entry
  was needed.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed the Prep doc drift
  overlaps existing item `SAS-AUD-20260602-001`, so that item was updated
  instead of adding a duplicate docs bug.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: found no checked Zone 4 entry
  yet, so this run appends one new checker section rather than duplicating an
  older Prep result.
- Existing environment blocker `SAS-AUD-20260530-001` already covers the
  broader dev-mode mirror-save risk, so no new blocker was added for Prep.

## Overall Assessment

- Zone status: checked
- Audit result: one new confirmed Prep assignment bug; existing docs-drift bug
  expanded; page-map concern kept visible but unconfirmed
- Confidence: medium-high
- Why not higher: the zone stayed static/read-only, so no live Electron Prep
  session, live DOCX import, or live export open-check was run

## Next Steps

- Reproduce the new Prep bug later inside an isolated safe desktop run using a
  section with repeated quote text and different assignments before the Fix flow.
- Add targeted coverage for the `updateSectionHtml()` reassignment path so
  duplicate quotes keep their assignment by occurrence, not text alone.
- In a later safe Prep check, verify whether import-time or post-import page
  scans actually preserve usable page numbers end-to-end.
- The next zone-checker run should move to the first later zone where all three
  inspector reports exist and no `checker.md` exists, which is now Zone 5 -
  Duet Prep.
