# StJohn Project Monitor Automation

Purpose: repeat the full read-only health audit for StJohn Author Studio 4.0.

This is a monitor, not a fixer. It may run tests and use safe generated data.
It may update audit docs and bug logs. It must not change product code.

## Read First Every Run

1. `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
2. `READ ME FIRST - OPEN THIS.txt`
3. `HANDOFF.md`
4. `CLAUDE.md`
5. `TODO.md`
6. `docs/BUILD_PLAN_V4.md`
7. `docs/APP_STRUCTURE.md`
8. `docs/SHARED_COMPONENTS.md`
9. `docs/FRONT_FUNCTION_TREE.md`
10. `docs/INTERNAL_FUNCTION_TREE.md`
11. `docs/WIRING_MATRIX.md`
12. `docs/CLOUD_SCHEMA.md`
13. `docs/CLOUD_SAFETY_AUDIT.md`
14. `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`
15. `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
16. `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
17. `package.json`

At the start and end of each major section, re-check the source goals and
`docs/APP_STRUCTURE.md`.

## Drift Reset Rule

The monitor must re-anchor by rereading
`docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`,
`docs/APP_STRUCTURE.md`, and `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`:

- At the start of every run.
- Before each major audit zone.
- After every 30 minutes of work.
- After every 3 tool-heavy actions or agent reports.
- Before adding or changing any bug-log entry.
- Before any Electron, cloud, phone, export, or real-file test.
- Before writing the final run summary.

If the monitor cannot name the audit zone it is currently in, it must stop,
reread the source-of-truth file, and write the next safest step.

## Team Roles

### 1. Lead Monitor

Owns the final report. Keeps the bug log organized. Decides whether a finding
updates an existing item or needs a new item.

### 2. Source Map Auditor

Checks whether the docs match the actual tree. Looks for doc drift, duplicate
readers, duplicate cloud clients, duplicate import/export paths, and fake sample
data.

### 3. Desktop Modes Auditor

Checks Proof Listen, Prep Manuscript, Duet Prep, and Quill & Ink. Uses the app
tree and existing test assets to build a mode-by-mode health picture.

### 4. Phone Auditor

Checks phone Script and phone Quill. Focuses on safe login flow, project list,
audio matching, flag/annotation save, export, reload, and phone-specific edge
cases.

### 5. Cloud And Save Safety Auditor

Checks Supabase, local save data, backups, audio privacy, tombstones, queues,
sign-out, account swap, and two-device risks.

### 6. Export And Package Auditor

Checks CSV, DOCX, InDesign JSX, backup JSON, transfer bundles, release folder
rules, Mac/Windows package state, and old-build confusion.

### 7. Test Infrastructure Auditor

Checks existing tests, scripts, hooks, prior audit artifacts, and whether the
test suite still covers the riskiest behavior.

## Run Cycle

### A. Preflight

Run and record:

```bash
git status --short
npm test -- --test-reporter=spec
```

If useful and safe for the current run, also run:

```bash
npm run guardrails:check:all
npm run build
```

Record:

- Date and local time.
- Dirty files before the monitor started.
- Test commands and exit codes.
- Whether `.env.local` exists.
- Whether the packaged Mac app exists.
- Whether the Windows release exists.
- Any hook log activity relevant to the audit.

### B. Static App Tree Check

Compare real files against:

- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`

Look for:

- Docs claiming a feature is live when it is not.
- Buttons listed as missing when code now exists.
- Duplicate UI or data systems.
- New source files that are not reflected in the app tree.

### C. Safe Scenario Checks

Use generated audit data under:

```txt
docs/audits/artifacts/project-monitor-<date>/
```

Safe generated data should include:

- A `.docx` with chapters, scene breaks, repeated short dialogue, curly and
  straight quotes, one long paragraph, one very short chapter, and one chapter
  without audio.
- Audio files with matching and wrong names.
- Expected-result notes.

Do not use Marie's real books unless Marie explicitly gives a test package.

If Marie gives manuscript/audio links, copy those files into the dated audit
artifact folder, create a manifest, and test only that copy. Do not move,
rename, or overwrite the originals.

### D. Electron Safety

Electron tests may write outside a temp repo unless isolated.

Before any Electron save/export/restart test:

1. Use a temp project copy.
2. Launch with `HOME=/tmp/<audit-home>`.
3. Confirm the displayed save path is under the temp area.
4. Confirm the real Documents mirror did not change.

If that cannot be proven, stop Electron testing and log
`environment-blocked`.

### E. Cloud Safety

Must check these invariants:

- Audio files and audio paths never upload to Supabase.
- Proof and Quill use only the six approved tables.
- Prep and Duet stay local unless a new approved cloud plan exists.
- Sign-out/account swap cannot show old-account data.
- Offline flag queue retries safely.
- Tombstones prevent deleted projects returning.
- Big projects do not push huge cloud blobs without hash/slim guards.

### F. Bug Log Organization

Before adding a new bug, search:

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- active audit reports under `docs/dev/active/`

Update an existing bug when it has the same user-facing failure, same feature
area, or same likely root cause.

Create a new bug only when it is genuinely different.

Use these sections:

- P0 data loss, privacy, app launch, release blocker.
- P1 core workflow broken.
- P2 partial feature failure.
- P3 polish or wording.
- Needs navigation proof.
- Needs real file.
- Environment blocked.
- Watchlist risk.
- Fixed or archived.

Each entry must include:

- ID
- Date found
- Type
- Status
- Severity
- Area
- Plain-English summary
- Source goal or expected behavior
- Navigation path
- Test data
- Expected result
- Actual result
- Evidence
- Duplicate check result
- Likely files
- Verification needed

## Report Format

Write each run to `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`.

Each run should include:

- What was checked.
- What passed.
- What failed.
- What was code-traced only.
- What was not tested.
- What changed since the previous run.
- Existing bugs updated.
- New bugs added.
- Top 3 risks.
- Exact next step if the monitor pauses.

## Stop Rules

Stop and mark the run blocked if:

- The monitor cannot protect real `Save Data/`.
- A login or test account is missing.
- The app tries to upload audio.
- A command asks for destructive cleanup.
- The monitor hits context or time limit.

When stopping, write:

- Last completed section.
- Current blocker.
- Files already checked.
- Commands already run.
- Next safest step.

## Clear Endpoint

Each run stops when it has completed one assigned audit zone, updated the report,
and listed the next safest zone.

The whole monitor campaign is ready to pause when every audit zone has a current
report, all P0/P1 confirmed bugs are either fixed later or clearly queued, all
blocked checks say what is missing, and the monitor report has a short
release-risk summary.

Do not archive, close, pause, or delete the monitor plan until Marie says to.
