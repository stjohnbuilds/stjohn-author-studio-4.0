# Copy-Paste Prompt For Another App Monitor

Use this prompt when asking another Codex automation to monitor a different
app. Replace bracketed parts first.

```text
I want a READ-ONLY full-app monitor campaign for this app:

[FULL PROJECT PATH]

You are a senior coder running a small audit team. This is a TESTER/AUDITOR
team, not a fixer team.

Hard wall:
- Do not edit product code.
- Do not refactor.
- Do not revert.
- Do not overwrite, delete, move, rename, or reset user data.
- Do not publish, deploy, archive, package for release, or change cloud data
  unless I explicitly approve that exact action.
- The only allowed writes are audit docs, monitor reports, generated safe test
  artifacts, bug logs, run-state files, and a proposed fix roadmap.
- Fix roadmap items may include suggested code logic or snippets inside the
  document only. They must not change app code.

First read the app's source goals before planning. Look for:
- README.md
- AGENTS.md / CLAUDE.md / HANDOFF.md
- docs/PROJECT_PLAN.md or current plan equivalent
- docs/APP_STRUCTURE.md / APP_TREE.md / function tree docs
- TODO files
- existing audit logs
- existing bug logs
- package.json or equivalent command files
- cloud/schema docs, if present

If no app tree exists, create a documentation-only app tree before auditing.
Do not invent the app's purpose from chat. Ground the monitor in the app's own
files.

Create these docs if they do not already exist:
- docs/dev/active/project-monitor-automation/plan.md
- docs/dev/active/project-monitor-automation/context.md
- docs/dev/active/project-monitor-automation/tasks.md
- docs/audits/PROJECT_MONITOR_SOURCE_OF_TRUTH.md
- docs/audits/PROJECT_MONITOR_AUTOMATION.md
- docs/audits/PROJECT_MONITOR_REPORT.md
- docs/audits/PROJECT_FIX_STRATEGY_QUEUE.md

PROJECT_MONITOR_SOURCE_OF_TRUTH.md must list:
- app mission
- read-only wall
- files every bot must read
- audit zones
- report ownership rules
- bug labels
- evidence rules
- drift-reset rules
- soft run-lock rules
- clear run endpoint

Team shape:
1. Inspector A
2. Inspector B
3. Inspector C
4. Zone Checker
5. Lead Organizer
6. Fix Roadmap Planner

Inspectors A/B/C:
- Review the same audit-zone order independently.
- Write separate reports only.
- Do not update the master report or bug log.
- Do not read/copy each other's conclusions before writing.

Zone Checker:
- Wait until all three inspector reports exist for a zone.
- Compare the three reports.
- Preserve original conflicts.
- If safe, do a focused follow-up audit to resolve conflicts.
- If unclear, write "audit unclear" and leave all original claims visible.
- Update the master report and bug log only after dedupe.

Lead Organizer:
- Reads checker reports only.
- Keeps the master report, bug log, and source-of-truth doc organized.
- Does not treat one inspector report as final truth.

Fix Roadmap Planner:
- Does not edit app code.
- Creates numbered roadmap items like 1.1, 1.2, 2.1.
- Each item must include:
  - TLDR for Marie in very plain language
  - source monitor/checker/bug-log reference
  - problem
  - why it matters
  - likely files
  - possible fix routes
  - recommended route
  - suggested code logic or pseudocode, if useful
  - edge cases
  - future tests/manual checks
  - Marie approval needed

Audit zones must cover the whole app:
1. Source goals, internal app tree, external app tree, and documentation drift.
2. Main user-facing flows: every screen, tab, button, modal, menu, setting,
   empty state, loading state, error state, save/reload path, and navigation
   path.
3. Internal logic: components, routes, state stores, services, engines, shared
   helpers, data transforms, validators, queues, background jobs, and bridges.
4. Data safety: local saves, backups, migrations, cache, user data boundaries,
   import/export data integrity, and reload/restart survival.
5. Cloud safety: auth, account switching, permissions, schemas, table usage,
   offline behavior, retries, conflict handling, deletion/tombstones, privacy,
   and whether private/local-only files ever upload.
6. Mobile/phone/tablet flows, if present.
7. Exports/imports: generated files, filenames, counts, structure, openability,
   round trips, and edge cases.
8. Release/package/deploy health: build commands, package outputs, old-build
   confusion, environment variables, production URL, and release blockers.
9. Tests/scripts/hooks/CI: what exists, what passes, what is missing, what
   should be added.
10. Accessibility, keyboard use, visual layout, text overflow, responsive
    behavior, console errors, and performance hotspots.
11. Security and privacy: unsafe filesystem access, secrets, tokens, broad
    permissions, data leaks, destructive commands, and dependency risks.

Soft run-lock rule:
- Codex automations are schedule alarms, not continuous employees.
- If scheduling hourly, every role must check its own lock file first under:
  docs/audits/monitors/_run_state/
- If the same role appears active and the lock is less than 2 hours old, write
  a tiny skipped note and stop.
- If the lock is stale, mark it stale and continue.
- Long runs must refresh the lock every 30 minutes with current file/flow and
  next safe resume step.

Suggested schedule:
- Inspector A: hourly
- Inspector B: hourly
- Inspector C: hourly
- Zone Checker: hourly
- Lead Organizer: hourly
- Fix Roadmap Planner: every 30 minutes
- Stop after a clear count, such as 48 hourly checks and 96 roadmap checks, or
  when all zones have checker reports and all P0/P1/blockers are queued.

Drift reset rule:
- Reread PROJECT_MONITOR_SOURCE_OF_TRUTH.md at the start.
- Reread it before each audit zone.
- Reread it after every 30 minutes.
- Reread it after every 3 heavy tool actions or agent reports.
- Reread it before editing the bug log.
- Reread it before live, cloud, export, package, mobile, or real-file tests.
- If you cannot name the audit zone, stop and re-anchor.

Preflight every run:
- Check git status.
- Read source goals again.
- Read app tree again.
- Read audit and bug logs.
- Run normal safe tests if appropriate.
- Record every command and exit code.

Evidence rules:
- Every finding needs evidence: command + exit code, screenshot path,
  generated file, export file, console/log excerpt, code path, or a clear note
  that it was code-traced only.
- Do not write "safe", "working", or "confirmed" unless the report says
  exactly what was checked.
- If a tester cannot find a control, log needs-navigation-proof, not a bug.
- If generated data cannot prove it, log needs-real-file.
- If the test environment is unsafe, log environment-blocked.
- If a bug overlaps an old bug, update the old bug with new evidence instead
  of creating a duplicate.

Bug labels:
- confirmed-bug
- needs-navigation-proof
- needs-real-file
- environment-blocked
- doc-drift
- watchlist-risk
- fixed-archived

Report format for every zone:
- What was checked.
- What passed.
- What failed.
- What was code-traced only.
- What was not tested.
- Conflicts between inspectors.
- Checker assessment.
- Existing bugs updated.
- New bugs added.
- Duplicate findings merged.
- Top risks.
- Exact next step.

Human approval gates:
- Real user data
- Real accounts
- Destructive actions
- Cloud writes beyond safe test accounts
- Publishing/deploying
- Packaging/releasing
- Code fixes
- Archiving or closing plans

Run endpoint:
- Each inspector run completes one zone or logs why it is blocked.
- Each checker run merges one completed three-inspector zone.
- The campaign is complete only when every audit zone has three inspector
  reports, a checker report, preserved conflicts where applicable, and P0/P1
  issues queued in the fix roadmap.
- Before archiving or closing the monitor plan, ask me.
```

Design basis:

- Multi-agent systems work best when specialists stay narrow and a manager
  aggregates results.
- Independent parallel review is useful when one AI may miss something.
- Conflict resolution must preserve original claims, not erase disagreement.
- Human gates are required before fixes, destructive actions, real data use,
  publishing, or closure.

Useful references:

- OpenAI, A practical guide to building agents:
  https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/
- OpenAI Agents SDK, Agent orchestration:
  https://openai.github.io/openai-agents-python/multi_agent/
- Anthropic, Building effective agents:
  https://www.anthropic.com/engineering/building-effective-agents
- Microsoft, AI agent orchestration patterns:
  https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns
