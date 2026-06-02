# Project Monitor Automation Plan - StJohn Author Studio 4.0

Source goals checked before writing:

- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `CLAUDE.md`
- `TODO.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Goal

Set up a read-only project monitor that repeatedly audits the app's health,
feature wiring, data safety, cloud safety, phone behavior, exports, and release
readiness.

The monitor may run tests, inspect code, use generated audit files, and drive
safe test accounts. It must not fix code during the audit.

## Non-Negotiable Rules

- Product code is read-only.
- Marie's real `Save Data/` is protected.
- Audit artifacts belong under `docs/audits/artifacts/`.
- The only allowed file edits are audit docs, monitor reports, and bug-log
  updates.
- Audio must never be uploaded to Supabase.
- Generated files are allowed for button and export checks.
- Real manuscript/audio proof must be labelled as Marie-only unless Marie gives
  a package.
- Overlapping bugs must update the existing bug entry instead of creating a
  duplicate.
- If the monitor hits context or time limits, it pauses with the exact next
  step, open questions, and files already checked.

## Step 1 - Re-check Goals And Structure

What to do:

- Read the source-goal docs and app tree docs.
- Read the existing audit runbook and bug log.
- Check git status before any report edit.

What to verify:

- The monitor is testing the real 4.0 goals: shared reader direction, shared
  audio, shared manuscript, shared cloud sync, no fake product data, audio
  privacy, and real-file verification.

Before moving on:

- Re-check source goals and `docs/APP_STRUCTURE.md`.

## Step 2 - Split The App Into Audit Zones

What to do:

- Assign separate read-only agents to:
  - Source goals and app tree drift.
  - Desktop modes.
  - Phone companion.
  - Cloud, save data, backups, and audio privacy.
  - Existing tests, scripts, and prior audit patterns.
  - Bug-log organization.

What to verify:

- Each agent has a narrow job and does not duplicate another agent's work.
- No agent is asked to fix code.

Before moving on:

- Re-check source goals and `docs/APP_STRUCTURE.md`.

## Step 3 - Run The Safe Health Checks

What to do:

- Run the test suite.
- Run build/guardrail checks where useful.
- Inspect hooks and audit logs.
- Use generated manuscripts/audio for safe import/export checks.
- Use isolated Electron runs only with a temp `HOME`.

What to verify:

- Test result, command, exit code, and date are recorded.
- Any live test states what account/data was used.
- Any untested area is labelled honestly.

Before moving on:

- Re-check source goals and `docs/APP_STRUCTURE.md`.

## Step 4 - Update One Organized Report

What to do:

- Write findings into the monitor report.
- Search existing bug IDs before adding any new item.
- Append new evidence to old bugs when the user-facing failure overlaps.

What to verify:

- The bug log is grouped by severity and area.
- Each finding says whether it was live-tested, code-traced only, blocked, or
  unknown.

Before moving on:

- Re-check source goals and `docs/APP_STRUCTURE.md`.

## Step 5 - Schedule Recurring Monitor Runs

What to do:

- Create a recurring Codex automation that runs this read-only audit cycle.
- Keep the prompt self-contained so it can continue even after chat context is
  gone.
- Report only meaningful changes, failures, new evidence, or blocked checks.

What to verify:

- The automation points at the StJohn workspace.
- The automation prompt repeats the read-only rule and bug dedupe rule.

Before moving on:

- Re-check source goals and `docs/APP_STRUCTURE.md`.

## Step 6 - Give Marie A Reusable Prompt For Other Apps

What to do:

- Create a copy-paste instruction file for another app monitor.
- Keep it generic enough for Typing and Tomes or any future app.

What to verify:

- The prompt tells the other automation to read that app's source goals first.
- It has the same read-only, safe-account, organized-bug-log, and pause-on-limit
  rules.

Before closing:

- Ask Marie before archiving or closing this plan.

## Step 7 - Web-Informed Logic Hardening

What to do:

- Compare the monitor design against current multi-agent/orchestration and
  agent-evaluation guidance.
- Check for obvious bot failure modes: drift, duplicate bugs, runaway scope,
  unclear manager, missing evidence, missing human gates, and no endpoint.
- Update the source-of-truth anchor and other-app prompt with any missing
  guardrails.

What to verify:

- The Lead Monitor owns synthesis and dedupe.
- Worker agents have narrow zones.
- Every finding needs evidence.
- Real data and destructive actions are human-gated.
- The automation has a bounded run count.

Before moving on:

- Re-check source goals and structure docs.

## Step 8 - Prepare Fix Strategy Queue

What to do:

- Create a read-only fix strategy queue.
- For confirmed bugs and strong watchlist risks, create cards with possible
  approaches, recommended approach, likely files, edge cases, tests, and Marie
  approval needed.
- Keep fix planning separate from code fixing.

What to verify:

- No product code is edited.
- The queue makes future approved fixes faster.
- The queue does not mark anything fixed.

Before moving on:

- Re-check source goals and structure docs.
