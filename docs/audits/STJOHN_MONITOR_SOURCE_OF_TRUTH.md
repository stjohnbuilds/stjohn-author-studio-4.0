# StJohn Monitor Source Of Truth

This is the anchor file for all read-only project monitor runs.

If an audit agent gets lost, uncertain, too broad, or tempted to fix code, it
must return here before continuing.

## Mission

Audit StJohn Author Studio 4.0 like a careful user and a careful coder.

The monitor checks health, function, data safety, cloud safety, phone behavior,
exports, package readiness, and documentation drift.

It does not fix product code.

## Team Shape

Use a small review team, not one lonely monitor.

Current target shape:

1. Three independent inspectors review each audit zone.
2. One zone checker compares the three inspector reports.
3. One lead organizer keeps the master report, bug log, and source of truth
   clean.
4. One fix-roadmap planner turns confirmed issues into numbered, readable fix
   plans. It does not edit product code.

Inspectors must stay independent. They should not copy each other's wording or
decisions. The point is to catch what one AI misses.

Inspectors do not update the master report or bug log directly. They write only
their own separate report. The checker merges findings after comparing all
three reports.

The checker must preserve disagreements. If Inspector A says a flow passed and
Inspector B says it failed, the checker records both original claims, performs a
focused audit if safe, gives an assessment, and marks the conflict as resolved,
likely, or unclear. If still unsure, it must say `audit unclear` and leave the
conflict for a later run.

## Read-Only Wall

Allowed:

- Read source code and docs.
- Run safe tests and read-only scans.
- Use generated audit files.
- Use Marie-approved real test files only in a safe audit workspace.
- Update audit docs, monitor reports, bug logs, and generated evidence.
- Create numbered fix roadmap items in
  `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md`.

Not allowed:

- Fix code.
- Stage proposed code patches inside product files.
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

## Thirty-Minute Run Lock Rule

Codex automations are schedule-based. They do not expose a visible
`skip if previous run is still active` setting.

To avoid duplicate work, every recurring monitor must use a soft run lock under:

```txt
docs/audits/monitors/_run_state/
```

Each recurring role has its own lock file:

- `inspector-a.lock.md`
- `inspector-b.lock.md`
- `inspector-c.lock.md`
- `zone-checker.lock.md`
- `lead-organizer.lock.md`
- `fix-roadmap-planner.lock.md`

Paused extra-lane lock files, used only if Marie re-approves the second lane:

- `inspector-d.lock.md`
- `inspector-e.lock.md`
- `inspector-f.lock.md`
- `zone-checker-b.lock.md`

At run start:

1. Read this file.
2. Read the role's lock file if it exists.
3. If the lock says the same role is still running and is less than 2 hours
   old, write a tiny skipped note and stop.
4. If the lock is older than 2 hours, mark it stale, then continue.
5. Write a fresh lock with date, role, audit zone, and intended output file.

During a long run:

1. Refresh the same lock after every 30 minutes of work.
2. Record the current file/flow being checked.
3. Record the next safe resume step.

At run end:

1. Update the lock to `complete`.
2. Record output files and next safest step.
3. If context/time runs out, update the lock to `paused` with the next step.

This is a safety guard, not a perfect operating-system lock. Because product
code is read-only and each role writes separate audit files, this is enough for
the monitor campaign.

## Report Ownership

Inspectors write only to separate files:

```txt
docs/audits/monitors/<campaign>/zone-<zone-slug>/inspector-a.md
docs/audits/monitors/<campaign>/zone-<zone-slug>/inspector-b.md
docs/audits/monitors/<campaign>/zone-<zone-slug>/inspector-c.md
```

The checker writes:

```txt
docs/audits/monitors/<campaign>/zone-<zone-slug>/checker.md
docs/audits/monitors/<campaign>/zone-<zone-slug>/conflicts.md
```

The lead organizer may update:

- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`

The fix-roadmap planner may update only:

- `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md`

## Marie Progress Update Rule

Any user-facing monitor update, chat status reply, lead-organizer summary, or
fix-roadmap status reply must end with a short progress footer for Marie:

```txt
Audit completion: <percent>% checked/usable; <percent>% raw inspector coverage if different.
ETA: <best realistic remaining time>, with the current local time used for the estimate.
```

Use checker-confirmed zones as the main completion percent because those are
the usable audit results. If lead custody is behind checker output, say so in
plain language. If the raw inspector percent is more than 10 points different,
include both numbers so Marie can see that work is happening before it is fully
filed.

Do not invent precision. Round to the nearest 5% unless the exact zone count is
important. If the ETA is uncertain because locks are running or a checker is
waiting, give a realistic range and explain the bottleneck in one sentence.

## Zone Assignment Rule

Updated 2026-06-02 for Marie's subscription window.

Use one active audit lane with 30-minute wake-ups while preserving the
three-inspector quality bar.

The active lane uses Inspector A, Inspector B, Inspector C, and the Zone
Checker.

The earlier second-lane idea is paused to avoid coordination risk. Inspector D,
Inspector E, Inspector F, and Zone Checker B must not create active campaign
reports unless Marie explicitly re-approves the second lane.

Do not create ad hoc folders like `zone-05a`, `zone-05b`, or `zone-05c`
unless this source-of-truth file defines exactly what the split means and how
the checker/lead must merge it.

Folders are not the problem. Untracked slices are the problem.

Every completed zone must have:

- A declared slug.
- Three independent inspector reports.
- A checker report.
- Conflicts preserved where applicable.
- Lead merge into the master report before it counts as complete.

Active priority order:

1. Proof Listen.
2. Cloud, auth, audio privacy, save data, and backups.
3. Exports, imports, release packages, and old-build confusion.
4. Prep Manuscript.
5. Quill & Ink.
6. Internal architecture.
7. Tests, scripts, hooks, and coverage gaps.
8. Security and privacy.
9. Phone Script.
10. Phone Quill.
11. Duet Prep.
12. Desktop shell and settings.
13. User experience quality.

Inspectors A, B, and C use the active priority order. On each wake-up, each
inspector chooses the first active zone that does not yet have that inspector's
report for the current campaign.

The checker chooses the first active zone where Inspector A, B, and C reports
exist and no checker report exists.

The lead organizer chooses the first checked zone that has not yet been merged
into the master report.

## Evidence Rule

Every result needs a receipt:

- Command and exit code.
- Screenshot path.
- Generated file path.
- Export path.
- Console/log excerpt.
- Code path with file references.
- Clear note that it was not tested live.

No result may be marked confirmed from confidence alone.

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
12. Internal architecture: components, routes, stores, services, helpers,
    engines, queues, bridges, and duplicated logic.
13. User experience quality: accessibility, keyboard use, layout, responsive
    behavior, text overflow, console errors, and performance hotspots.
14. Security and privacy: filesystem access, secrets, tokens, broad
    permissions, destructive commands, dependency risks, and data leaks.

Cross-cutting checks from Zones 12-14 should also be considered inside every
user-facing zone. For example, Proof Listen should be checked as a workflow,
but also for layout, console errors, local-save safety, and privacy boundaries.

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

## Fix Strategy Queue

Confirmed bugs and strong watchlist risks may get a numbered roadmap item in:

- `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md`

Roadmap items use numbers like `1.1`, `1.2`, `2.1`, and may include likely
files, possible strategies, recommended approach, edge cases, commands a future
fixer should run, and suggested code logic/snippets inside the document only.

Roadmap items are not approval to edit code. Marie must approve a separate fix
task before any product code changes.

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
