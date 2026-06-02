# Copy-Paste Prompt For Another App Monitor

Use this prompt when asking another Codex automation to monitor a different app.
Replace the bracketed parts first.

```text
I want a READ-ONLY project monitor automation for this app:

[FULL PROJECT PATH]

Your job is to act like a senior coder with a small team of read-only audit
agents. Do not fix code. Do not refactor. Do not overwrite user data. The only
files you may create or edit are audit docs, monitor reports, generated test
artifacts, and bug logs.

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

Then split the app into audit zones and launch separate read-only agents if
agent tools are available:

1. Source goals and app tree drift.
2. Main desktop/web user flows.
3. Mobile/phone flows if present.
4. Data storage, cloud sync, auth, privacy, and backups.
5. Exports/imports and release packaging.
6. Existing tests, scripts, hooks, and prior audit patterns.
7. Bug-log curator.

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
- docs/audits/PROJECT_MONITOR_AUTOMATION.md
- docs/audits/PROJECT_MONITOR_REPORT.md

Before archiving or closing the monitor plan, ask me.
```

