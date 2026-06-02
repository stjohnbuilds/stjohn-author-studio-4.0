# StJohn Project Monitor Report

This is the living report for recurring read-only monitor runs.

Master instructions:

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Current Status

Status: first monitor setup pass completed; recurring automation active.

Product code changes: none from this monitor setup.

Dirty app files seen during setup:

- `app/phone/page.js` was reported by early read-only agents.
- Current main-thread `git status --short` later showed
  `app/phone/_lib/audioLibrary.js`.
- The monitor setup did not touch or revert either app file.

Recurring automation:

- ID: `stjohn-read-only-project-health-monitor`
- Name: `StJohn read-only project health monitor`
- Schedule: every 4 hours, 12 runs total
- Workspace: `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0`
- Rule: read-only for product code; audit docs and generated audit artifacts
  only.
- Drift reset: reread `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`,
  `docs/APP_STRUCTURE.md`, and `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` before
  each zone, before bug-log edits, after 30 minutes, or after 3 tool-heavy
  actions/agent reports.
- Endpoint: each run completes one assigned zone, updates the report, and lists
  the next safest zone. The scheduled campaign ends after 12 runs, or sooner
  only if every zone has a current report and the remaining P0/P1/blockers are
  clearly queued.

## Bug Dedupe Rule

Do not create duplicate bugs.

If a new finding overlaps an old bug, append:

- New date.
- New evidence.
- Whether it is worse, better, unchanged, or now fixed.
- Any new likely files.
- Any new verification needed.

## Existing Bug Index

### SAS-AUD-20260530-001 - Electron dev run mirrors audit data into Documents

Source:

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

Current monitor action:

- Treat as a known environment safety issue.
- Any future Electron test must use isolated `/tmp` `HOME`.
- Do not create another bug for this same issue.
- Append new evidence to the existing bug if it recurs.

### SAS-AUD-20260602-001 - App tree docs disagree about current mode status

Source:

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

Current monitor action:

- Treat as documentation drift.
- Do not treat as a product bug unless it causes a real audit or user failure.

### SAS-AUD-20260602-002 - Phone Quill saves have no offline queue or visible pending state

Source:

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

Current monitor action:

- Treat as code-traced watchlist risk.
- Needs live offline/reconnect test before it becomes a confirmed bug.

### SAS-AUD-20260602-003 - Pending Proof flag queue count may not be user-scoped

Source:

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

Current monitor action:

- Treat as code-traced watchlist risk.
- Needs account-swap live test before it becomes a confirmed bug.

## Run 2026-06-02 - Setup And First Read-Only Slice

### Summary

- Result: setup pass complete; no confirmed product bugs from this slice.
- Product code changed: no.
- Audit docs changed: yes, monitor plan/report docs were created and bug log
  was updated with one doc-drift item and two watchlist risks.
- Agents used: source map, desktop modes, phone, cloud/save safety, and
  test-pattern/reference audit.

### Preflight

- Git status before main documentation edits: dirty app file was already
  present. The exact dirty app file changed during the audit; current app-file
  status showed `app/phone/_lib/audioLibrary.js`.
- Existing user/app code was not reverted or edited.
- `.env.local`: not rechecked in main thread.
- Mac app / Windows app: not rechecked in main thread.
- Hook log: read; recent hook activity existed from previous phone/cloud work.

### Commands Run In Main Thread

```bash
npm test -- --test-reporter=spec
node scripts/cloud-safety-test.mjs
npm run guardrails:check:all
rg -n "supabase\\.storage|storage\\.from" packages app main.js preload.js
rg -n "\\.from\\('(script_sync_projects|script_sync_section_transcriptions|script_sync_flags|quill_projects|quill_chapters|quill_annotations)'\\)|\\.from\\(\"(script_sync_projects|script_sync_section_transcriptions|script_sync_flags|quill_projects|quill_chapters|quill_annotations)\"\\)" packages/cloud-sync app main.js preload.js
rg -n "\\.from\\(['\\\"]([^'\\\"]+)['\\\"]\\)|\\.rpc\\(" packages/cloud-sync app main.js preload.js
```

Results:

- `npm test -- --test-reporter=spec`: passed, 13/13 tests.
- `node scripts/cloud-safety-test.mjs`: passed, 6/6 tombstone/cache checks.
- `npm run guardrails:check:all`: completed without errors.
- Supabase storage scan: no `supabase.storage` or `storage.from` call found.
- Supabase table scan: direct `.from(...)` calls found only for the six approved
  StJohn tables in `packages/cloud-sync/`.
- RPC scan: no live RPC call found; only guard comments/messages in
  `packages/cloud-sync/client.js`.

### Checks Completed

- Source map: code-traced by agent. App has all four desktop modes plus phone,
  but some docs still show older phase/missing status.
- Desktop modes: code-traced by agent. Critical flows and missing test coverage
  mapped for Proof, Prep, Duet, and Quill.
- Phone: code-traced by agent. Expected Proof/Quill phone flows and likely risk
  zones mapped.
- Cloud and save safety: code-traced by agent and command-checked. Core test
  suite, cloud safety script, and guardrails passed.
- Export and package: partially code-traced only. Existing tests cover Quill
  exporter and Prep Word export, but live Word/InDesign/package checks remain
  untested in this run.
- Tests and scripts: mapped by agent. Existing commands listed in monitor
  instructions.

### Results

- Passed: unit tests, cloud safety tombstone checks, guardrails, static scan for
  obvious Supabase storage calls.
- Failed: no live failures reproduced in this monitor setup pass.
- Code-traced only: desktop mode flows, phone flows, cloud edge cases, export
  coverage gaps.
- Needs real file: audiobook transcription/alignment accuracy, real Word visual
  open check, real InDesign JSX application, real two-device phone/desktop
  round-trip.
- Needs navigation proof: none added this run.
- Environment blocked: no new blocker. Existing Electron dev mirror issue
  remains tracked as `SAS-AUD-20260530-001`.

### Specialist Findings Folded In

- Source map: `docs/BUILD_PLAN_V4.md` and `docs/WIRING_MATRIX.md` are stale
  against current source and `docs/FRONT_FUNCTION_TREE.md`.
- Desktop modes: Proof, Prep, Duet, and Quill have clear critical flows, but
  missing UI-level and live-export tests remain.
- Phone: Phone Quill edit/delete is still a known missing feature, already in
  TODO; not logged as a new bug. Phone Quill offline save safety needs a live
  test.
- Cloud/save safety: command checks passed, but automated coverage does not yet
  fully prove Proof push/pull, Quill push/pull, backup zip contents, or Electron
  bridge path safety.
- Prior audit pattern: StJohn should reuse its existing audit runbook, plus the
  Typing and Tomes tester/fixer wall and trip-wire rule.

### Bug Log Updates

- Existing bugs updated: none.
- New bugs added: none.
- New doc-drift items added: `SAS-AUD-20260602-001`.
- New watchlist risks added: `SAS-AUD-20260602-002`,
  `SAS-AUD-20260602-003`.
- Duplicate findings merged: Electron dev mirror safety folded into existing
  `SAS-AUD-20260530-001`; no duplicate created.

### Evidence

- Command output exists in Codex run context for this setup pass.
- No screenshots or live UI artifacts were created in this setup pass.
- No generated manuscripts/audio were created in this setup pass.

### Top 3 Risks

1. Live phone/cloud edge cases are not fully tested yet: offline Quill save,
   account swap, and two-device conflicts.
2. Export confidence is uneven: unit tests exist, but real Word/InDesign/package
   checks still need live verification.
3. Docs drift can mislead future audits because the wiring matrix still marks
   some current app areas as missing.

### Pause Or Next Step

- Next safe step: let the recurring Codex automation run the monitor prompt.
- First recurring run should create
  `docs/audits/monitors/YYYY-MM-DD-codex-monitor/` and start with source-map
  drift, phone cloud edge cases, and export/package evidence.

## Run Template

Copy this for each monitor run.

```md
## Run YYYY-MM-DD HH:MM

### Summary

- Result:
- Product code changed: no
- Audit docs changed:
- Commands run:
- Agents used:

### Preflight

- Git status before:
- `.env.local`:
- Mac app:
- Windows app:
- Hook log:

### Checks Completed

- Source map:
- Desktop modes:
- Phone:
- Cloud and save safety:
- Export and package:
- Tests and scripts:

### Results

- Passed:
- Failed:
- Code-traced only:
- Needs real file:
- Needs navigation proof:
- Environment blocked:

### Bug Log Updates

- Existing bugs updated:
- New bugs added:
- Duplicate findings merged:

### Evidence

- Screenshots:
- Artifacts:
- Console/log snippets:
- Export files:

### Top 3 Risks

1.
2.
3.

### Pause Or Next Step

-
```
