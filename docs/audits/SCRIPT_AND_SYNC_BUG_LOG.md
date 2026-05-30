# Script and Sync Audit Bug Log

This is the live bug queue for the Script and Sync / StJohn Author Studio 4.0
audit. It is for documentation only. Do not fix items while auditing unless
Marie explicitly switches the task from audit to repair.

Source goals checked before starting this log:

- `READ ME FIRST - OPEN THIS.txt`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

Runbook: `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`

## Status Key

- `open`
- `needs-navigation-proof`
- `needs-real-file`
- `environment-blocked`
- `ready-for-fix`
- `fix-in-progress`
- `fixed-awaiting-verification`
- `fixed-archived`

## Active Confirmed Bugs

No confirmed bugs logged yet.

## Needs Navigation Proof

Use this section when the tester could not find a control or workflow. This is
not a bug until the real UI path has been found and tested.

No navigation-proof items logged yet.

## Needs Real Files Or Account Access

Use this section when generated files are not enough to prove the workflow.

No real-file items logged yet.

## Environment Blockers

Use this section for missing login, missing Whisper model, blocked network,
permissions, or app launch issues.

### SAS-AUD-20260530-001 - Electron dev run mirrors audit data into Documents

- Date found: 2026-05-30
- Type: environment-blocked
- Status: mitigated for future audit runs; code/process risk remains open
- Severity: P0 for audit safety; not yet classified as a product bug
- Area: Save-Restart / Audit environment
- Plain-English summary: Running the Electron app from a temp copy still wrote
  the audit book into `~/Documents/StJohn Author Studio/Save Data/books.json`
  because dev mode writes a mirror save outside the temp project folder.
- Source goal or expected behavior: Audit runs must not alter Marie's real
  `Save Data/` or mirror save locations. `docs/BUILD_PLAN_V4.md` also treats
  real saved data as a core safety boundary.
- Navigation path tried: Temp copy at `/tmp/stjohn-author-studio-audit-run`,
  launched with `PORT=3017 npm start`, dev skip login, created `Audit Proof
  Book`, imported the generated DOCX, attached generated audio, saved one flag.
- Exact test data used:
  `docs/audits/artifacts/2026-05-30-generated-files/audit-proof-manuscript.docx`
  and
  `docs/audits/artifacts/2026-05-30-generated-files/audio/chapter-01.m4a`.
- Expected result: Only
  `/tmp/stjohn-author-studio-audit-run/Save Data/books.json` changes.
- Actual result:
  `/Users/mariemackay/Documents/StJohn Author Studio/Save Data/books.json`
  also matched the temp `books.json` after the run.
- Evidence:
  - `cmp` returned `0` between the temp `books.json` and Documents mirror before cleanup.
  - The Documents mirror contained `Audit Proof Book` plus the existing
    `Anarchy` project.
  - The original repo file
    `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Save Data/books.json`
    was not changed.
- Cleanup already done: The temp Electron session was stopped and only the
  `Audit Proof Book` entry was removed from the Documents mirror. The existing
  `Anarchy` project remained.
- Mitigation checked: A fresh Electron run launched with
  `HOME=/tmp/stjohn-author-studio-audit-home` displayed the save path under
  `/private/tmp/stjohn-author-studio-audit-run-iso/Save Data/books.json`, and
  the real Documents mirror timestamp did not change.
- Why this is not tester confusion: Source reading confirms dev mode writes
  primary data to `__dirname/Save Data` and mirrors `books.json` to
  `app.getPath('documents')/StJohn Author Studio/Save Data/books.json`.
- Likely files to inspect: `main.js` data path helpers and `write-data` IPC.
- Suggested fix direction: For further audit runs, launch Electron with an
  isolated `HOME` so `app.getPath('documents')` resolves under `/tmp`. For code
  hardening later, consider an explicit audit/dev data-directory override or a
  safer dev mirror switch.
- Verification needed after fix: Start Electron from a temp copy, create a
  test book, save a flag, and confirm no file under
  `/Users/mariemackay/Documents/StJohn Author Studio/Save Data/` changes.
- Archive notes:

## Watchlist Risks

Use this section for code-traced risks that are not reproduced yet.

No watchlist risks logged yet.

## Entry Template

Copy this template for every new item.

```md
### SAS-AUD-YYYYMMDD-001 - <short title>

- Date found:
- Type: confirmed-bug / needs-navigation-proof / needs-real-file / environment-blocked / doc-drift / watchlist-risk
- Status:
- Severity: P0 / P1 / P2 / P3
- Area: Shell / Proof / Prep / Duet / Quill / Phone Script / Phone Quill / Cloud / Export / Save-Restart / Release
- Plain-English summary:
- Source goal or expected behavior:
- Navigation path tried:
- Exact test data used:
- Expected result:
- Actual result:
- Evidence:
- Why this is not tester confusion:
- Likely files to inspect:
- Suggested fix direction:
- Verification needed after fix:
- Archive notes:
```

## Fixed / Archived

Move fixed items here. Do not delete the original details.

No fixed items archived yet.
