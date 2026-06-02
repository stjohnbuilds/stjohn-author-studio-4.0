# StJohn Monitor Source Of Truth

This is the anchor file for all read-only project monitor runs.

If an audit agent gets lost, uncertain, too broad, or tempted to fix code, it
must return here before continuing.

## Mission

Audit StJohn Author Studio 4.0 like a careful user and a careful coder.

The monitor checks health, function, data safety, cloud safety, phone behavior,
exports, package readiness, and documentation drift.

It does not fix product code.

## Read-Only Wall

Allowed:

- Read source code and docs.
- Run safe tests and read-only scans.
- Use generated audit files.
- Use Marie-approved real test files only in a safe audit workspace.
- Update audit docs, monitor reports, bug logs, and generated evidence.

Not allowed:

- Fix code.
- Refactor code.
- Revert user work.
- Delete, move, overwrite, or rename Marie's real data.
- Upload audio to Supabase.
- Treat code-traced risks as confirmed live bugs.

## Primary Source Docs

Every run starts here, then reads these:

1. `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
2. `READ ME FIRST - OPEN THIS.txt`
3. `HANDOFF.md`
4. `CLAUDE.md`
5. `TODO.md`
6. `docs/BUILD_PLAN_V4.md`
7. `docs/APP_STRUCTURE.md`
8. `docs/FRONT_FUNCTION_TREE.md`
9. `docs/INTERNAL_FUNCTION_TREE.md`
10. `docs/SHARED_COMPONENTS.md`
11. `docs/WIRING_MATRIX.md`
12. `docs/CLOUD_SCHEMA.md`
13. `docs/CLOUD_SAFETY_AUDIT.md`
14. `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
15. `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
16. `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`
17. `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

If these disagree, log `doc-drift`. Do not guess which one is true without
checking the current source tree.

## Drift Reset Rule

The monitor must re-anchor by rereading this file plus
`docs/APP_STRUCTURE.md` and `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`:

- At the start of every run.
- Before each major audit zone.
- After every 30 minutes of work.
- After every 3 tool-heavy actions or agent reports.
- Before adding or changing any bug-log entry.
- Before any Electron, cloud, phone, export, or real-file test.
- Before writing the final run summary.

If the agent cannot say which audit zone it is in, it must stop, reread this
file, and write the next safest step.

## Audit Zones

Run one zone at a time.

1. Source goals and app tree drift.
2. Desktop shell and settings.
3. Proof Listen.
4. Prep Manuscript.
5. Duet Prep.
6. Quill & Ink.
7. Phone Script.
8. Phone Quill.
9. Cloud, auth, audio privacy, save data, and backups.
10. Exports, imports, release packages, and old-build confusion.
11. Tests, scripts, hooks, and coverage gaps.

## User-Like Testing

The monitor should behave like a real user where safe:

- Click real UI controls when using a safe app run.
- Import generated manuscripts.
- Attach generated or Marie-approved copied audio.
- Save, refresh, restart, export, and compare output files.
- Check phone-to-desktop and desktop-to-phone round trips.
- Check failure recovery: offline, wrong audio, missing audio, account swap,
  duplicate text, huge projects, and export counts.

If Marie provides real manuscript/audio links, the monitor must:

- Copy them into a dated audit artifact folder.
- Record the source, filename, and purpose in a manifest.
- Never move or overwrite the originals.
- Never upload audio.
- Mark every result as `real-file tested` only for the exact file used.

## Bug Log Discipline

Before adding a new item, search existing logs.

Update an old item instead of duplicating it when:

- The same user-facing feature fails.
- The same workflow fails.
- The same likely root cause is involved.
- The new result only adds evidence to an old bug.

Create a new item only when it is genuinely different.

Labels:

- `confirmed-bug`
- `needs-navigation-proof`
- `needs-real-file`
- `environment-blocked`
- `doc-drift`
- `watchlist-risk`
- `fixed-archived`

## Run Endpoint

Each monitor run ends when it has:

1. Rechecked the source docs.
2. Checked git status.
3. Completed one assigned audit zone or clearly logged why it is blocked.
4. Updated the monitor report.
5. Updated or deduped the bug log if needed.
6. Listed the next safest zone.

The full monitor campaign is ready to pause when:

- Every audit zone has a current report.
- P0/P1 confirmed bugs are either fixed later or clearly queued for fixing.
- All blocked items say what Marie or the environment must provide.
- The report has a short release-risk summary.

Do not archive, close, or delete the monitor plan until Marie says to.

