# StJohn Fix Planner Automation

Purpose: keep a ready-to-approve numbered fix roadmap while the read-only
monitor runs.

This is not a fixer automation.

## Job

Every wake-up:

1. Re-read `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`.
2. Re-read `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`.
3. Re-read `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`.
4. Re-read `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md`.
5. Look for confirmed bugs or strong watchlist risks that do not yet have a
   roadmap item.
6. Create or update numbered roadmap items only, such as `1.1`, `1.2`, `2.1`.
7. If there is nothing new, write nothing and go back to sleep.

## Automation

- ID: `stjohn-fix-roadmap-planner`
- Schedule: every 30 minutes, 24 checks total
- Type: thread heartbeat
- Output-only file: `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md`

## Output

The fix roadmap lives in:

- `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md`

Each roadmap item should compare approaches where useful, recommend one, and
list edge cases, tests, likely files, risks, and Marie approval needed.

It may include suggested code logic or snippets inside the document, but it
must not change code.

## Hard Wall

Do not edit product code.

Do not apply patches.

Do not run a fixer.

Do not mark anything fixed.

Do not archive or close bugs.

## Endpoint

This planner is useful only while the monitor is producing findings. It should
stop after its scheduled run count or once there are no new confirmed bugs or
actionable watchlist risks.
