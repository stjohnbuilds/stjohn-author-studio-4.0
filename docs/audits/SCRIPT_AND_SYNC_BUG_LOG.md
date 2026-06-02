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

## Documentation Drift

Use this section when the docs and current app disagree. These are not product
bugs unless the mismatch causes a real user failure.

### SAS-AUD-20260602-001 - App tree docs disagree about current mode status

- Date found: 2026-06-02
- Type: doc-drift
- Status: open
- Severity: P2
- Area: Shell / Docs
- Plain-English summary: Some source docs still describe early-phase or missing
  features even though the current code and other docs show all four desktop
  modes plus phone files exist.
- Source goal or expected behavior: `docs/APP_STRUCTURE.md` says audits should
  use the app tree and wiring docs together. `docs/BUILD_PLAN_V4.md`,
  `docs/FRONT_FUNCTION_TREE.md`, and `docs/WIRING_MATRIX.md` should not give
  conflicting status for the same user-facing controls.
- Navigation path tried: Static read-only audit only. No UI navigation.
- Exact test data used: Source docs and repository tree.
- Expected result: The build plan, front function tree, internal tree, and
  wiring matrix agree on current status or clearly mark old notes as stale.
- Actual result: `docs/BUILD_PLAN_V4.md` still says Phase 1 active;
  `docs/WIRING_MATRIX.md` marks several mode/phone rows missing; current source
  files and `docs/FRONT_FUNCTION_TREE.md` say many of those areas exist.
- Evidence: Code-traced by read-only source map audit on 2026-06-02. Main files
  seen: `app/page.js`, `app/phone/page.js`, `app/components/PrepManuscriptMode.js`,
  `app/components/PrebuildMode.js`, `app/components/QuillAndInkMode.js`.
- Why this is not tester confusion: This is a doc-to-doc and doc-to-tree
  mismatch, not a hidden UI control.
- Likely files to inspect: `docs/BUILD_PLAN_V4.md`,
  `docs/WIRING_MATRIX.md`, `docs/FRONT_FUNCTION_TREE.md`,
  `docs/APP_STRUCTURE.md`.
- Suggested fix direction: Do a docs-only tree refresh after the monitor pass,
  keeping historical plan notes but clearly separating old phase status from
  current app status.
- Verification needed after fix: Re-run the source map audit and confirm no row
  calls an implemented/currently documented control missing without a note.
- Archive notes:

## Watchlist Risks

Use this section for code-traced risks that are not reproduced yet.

### SAS-AUD-20260602-002 - Phone Quill saves have no offline queue or visible pending state

- Date found: 2026-06-02
- Type: watchlist-risk
- Status: open
- Severity: P1 if reproduced; currently code-traced only
- Area: Phone Quill / Cloud
- Plain-English summary: Phone Proof has an offline flag queue, but Phone Quill
  appears to save by pushing the whole project and logging failures. If a Quill
  phone save fails, a later refresh might lose an unsynced annotation.
- Source goal or expected behavior: Phone Quill should safely round-trip
  annotation metadata to desktop. Audio stays local; annotation text and
  metadata sync to cloud.
- Navigation path tried: Static code trace only. Not reproduced live.
- Exact test data used: None; no live test data used.
- Expected result: Failed phone Quill annotation saves should either queue,
  show a clear pending warning, or keep a recoverable local backup until cloud
  catches up.
- Actual result: Code trace suggests failed pushes are logged, but no Quill
  phone pending queue/banner was found.
- Evidence: Code-traced areas: `app/phone/page.js` Quill save path and
  `packages/cloud-sync/quill-sync.js`.
- Why this is not tester confusion: This is not a confirmed UI failure. It is a
  risk found by static reading.
- Likely files to inspect: `app/phone/page.js`,
  `packages/cloud-sync/quill-sync.js`, `packages/cloud-sync/flag-queue.js`.
- Suggested fix direction: If live testing reproduces the risk, add a Quill
  single-annotation queue or a clear recoverable pending state similar to Proof
  flags.
- Verification needed after fix: Phone Quill offline annotation save, reconnect,
  refresh desktop, confirm the final annotation appears and no duplicate is
  created.
- Archive notes:

### SAS-AUD-20260602-003 - Pending Proof flag queue count may not be user-scoped

- Date found: 2026-06-02
- Type: watchlist-risk
- Status: open
- Severity: P2 if reproduced; currently code-traced only
- Area: Phone Script / Cloud
- Plain-English summary: The phone may show a pending flag count from another
  account because the queue count appears global rather than scoped to the
  signed-in Supabase user.
- Source goal or expected behavior: Account A data must not appear when Account
  B signs in. Phone cache and pending sync state should be user-scoped.
- Navigation path tried: Static code trace only. Not reproduced live.
- Exact test data used: None; no live test data used.
- Expected result: Signing out of one account and into another should show only
  the second account's projects, flags, pending counts, and cache.
- Actual result: Code trace suggests the pending flag queue count may be global.
- Evidence: Code-traced area: `packages/cloud-sync/flag-queue.js`.
- Why this is not tester confusion: This is not a confirmed UI failure. It is a
  risk found by static reading.
- Likely files to inspect: `packages/cloud-sync/flag-queue.js`,
  `app/phone/page.js`.
- Suggested fix direction: If live testing reproduces it, scope pending queue
  counts and storage keys by user id and project id.
- Verification needed after fix: Create a pending flag in Account A, sign out,
  sign into Account B, confirm no Account A pending count or project data is
  visible.
- Archive notes:

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
