# Context - Project Monitor Automation

Marie wants a small team of Codex agents to keep auditing StJohn Author Studio
4.0 while her remaining Codex time is available.

This is not a fix task. It is a read-only health, function, and safety audit.

## Source Goals Read

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

## Important Existing Audit Rules

- Missing navigation is not automatically a bug.
- Confirmed bugs need evidence, navigation path, expected result, actual result,
  likely files, and verification needed.
- Electron file/save tests must launch with an isolated `/tmp` `HOME`.
- Generated data is enough for button/export smoke tests.
- Real audiobook alignment needs Marie's real file package.
- Existing bug entries must be updated instead of duplicated.

## Current Repo State

Initial `git status --short` during this planning task showed an existing
modified file:

- `app/phone/page.js`

That file is not part of this documentation-only monitor setup and must not be
reverted or overwritten.

## Existing Useful Commands

- `npm test -- --test-reporter=spec`
- `npm run build`
- `npm run guardrails:check:all`
- `npm run start`
- `npm run sandbox:pac3:start`
- `npm run whisper:model`

Electron live tests must use an isolated `HOME` and must not touch Marie's real
save data.

## Prior Audit Material To Reuse

- `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`
- `docs/audits/SCRIPT_AND_SYNC_FULL_APP_AUDIT_PROMPT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/dev/active/script-sync-full-app-audit-plan/`
- `docs/dev/active/distribution-readiness-audit-2026-05-27/REPORT.md`

Typing and Tomes reference used only for audit style:

- `/Users/mariemackay/Dev/Typing-and-Tomes-3.3-active/docs/ai-instructions/live-testing/SCENARIO_TESTING.md`
- `/Users/mariemackay/Dev/Typing-and-Tomes-3.3-active/docs/dev/active/data-store-duplication-audit.md`

## Plain-English Summary

The monitor is a rotating inspection team. One bot checks the map, one checks
desktop, one checks phone, one checks cloud/save safety, one checks tests and
old audit patterns, and the main monitor keeps the bug log tidy.

They do not repair the app. They collect proof.

