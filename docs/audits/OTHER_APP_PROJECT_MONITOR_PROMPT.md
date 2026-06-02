# Copy-Paste Prompt For Another App Monitor

Use this prompt when asking another Codex automation to monitor a different app.
Replace the bracketed parts first.

```text
I want a READ-ONLY project monitor automation for this app:

[FULL PROJECT PATH]

Your job is to act like a senior coder running a small read-only audit team.

This is a TESTER team, not a FIXER team.

Do not fix code. Do not refactor. Do not revert. Do not overwrite user data.
The only files you may create or edit are audit docs, monitor reports,
generated test artifacts, and bug logs.

Use one Lead Monitor as the manager. The Lead Monitor owns the final report,
bug-log dedupe, and the decision about whether a finding is confirmed,
blocked, or only a watchlist risk. Specialist agents may inspect narrow areas,
but they do not own the final truth alone.

First, read the app's own source goals before planning anything. Look for:

- README.md
- AGENTS.md / CLAUDE.md / HANDOFF.md
- docs/PROJECT_PLAN.md
- docs/APP_STRUCTURE.md
- docs/APP_TREE.md
- current TODO files
- existing audit logs
- existing bug logs
- package.json or equivalent test command files

If no app tree exists, create a documentation-only app tree before auditing.
Do not invent the app's purpose from chat. Ground the audit in the app's own
docs.

Create one source-of-truth anchor file first:

- docs/audits/PROJECT_MONITOR_SOURCE_OF_TRUTH.md

That file must list:

- the app's mission,
- read-only rules,
- files every bot must read,
- audit zones,
- bug labels,
- evidence rules,
- drift-reset rules,
- clear run endpoint.

Then split the app into audit zones and launch separate read-only agents if
agent tools are available:

1. Source goals and app tree drift.
2. Main desktop/web user flows.
3. Mobile/phone flows if present.
4. Data storage, cloud sync, auth, privacy, and backups.
5. Exports/imports and release packaging.
6. Existing tests, scripts, hooks, and prior audit patterns.
7. Bug-log curator.

Do not create extra agents unless the work is genuinely separate. More agents
can cause duplicated findings, higher cost, and drift.

Hard rules:

- This is read-only for product code.
- Do not touch real user data.
- Use safe/fake accounts only.
- Use generated files for smoke tests.
- Label real-account or real-file checks as Marie-only unless I provide test
  data.
- Do not call something a confirmed bug unless the expected behavior is clear,
  the navigation path is known, and there is evidence.
- If the tester cannot find a control, log it as needs-navigation-proof, not a
  bug.
- If generated data cannot prove it, log it as needs-real-file.
- If a test environment is unsafe, log it as environment-blocked.
- If a bug overlaps an old bug, update the old bug with new evidence instead of
  creating a duplicate.
- Keep the bug log organized by severity and area.
- If you hit a context or time limit, pause. Write exactly where to resume.
- Every result needs evidence. Evidence can be a command + exit code,
  screenshot, generated file, export file, console/log excerpt, code path, or a
  clear note that it was code-traced only.
- Do not write "safe", "working", or "confirmed" unless the report says exactly
  what was checked.
- Use human gates for real user data, real accounts, destructive actions,
  publishing, packaging, deleting, archiving, or closing plans.

Drift reset rule:

- Reread docs/audits/PROJECT_MONITOR_SOURCE_OF_TRUTH.md at the start.
- Reread it before each audit zone.
- Reread it after 30 minutes.
- Reread it after every 3 heavy tool actions or agent reports.
- Reread it before editing the bug log.
- Reread it before live, cloud, export, phone, or real-file tests.
- If you cannot name the audit zone you are in, stop and re-anchor.

Preflight every run:

- Check git status.
- Read the source goals again.
- Read the app tree again.
- Read existing audit and bug logs.
- Run the normal test command if safe.
- Record every command and exit code.

Report format:

- What was checked.
- What passed.
- What failed.
- What was code-traced only.
- What was not tested.
- Existing bugs updated.
- New bugs added.
- Duplicate findings merged.
- Top 3 risks.
- Exact next step.

Create these docs if they do not already exist:

- docs/dev/active/project-monitor-automation/plan.md
- docs/dev/active/project-monitor-automation/context.md
- docs/dev/active/project-monitor-automation/tasks.md
- docs/audits/PROJECT_MONITOR_SOURCE_OF_TRUTH.md
- docs/audits/PROJECT_MONITOR_AUTOMATION.md
- docs/audits/PROJECT_MONITOR_REPORT.md

Run endpoint:

- Each run should complete one audit zone, update the report, dedupe bugs, and
  list the next safest zone.
- The campaign should stop after the scheduled run count, or sooner only if all
  zones have current reports and all P0/P1/blockers are clearly queued.
- Do not run forever without a clear endpoint.

Before archiving or closing the monitor plan, ask me.
```
