# Inspector C - Zone 11 - Tests, scripts, hooks, and coverage gaps

- Campaign: `2026-06-02-manual-start`
- Role: `Inspector C`
- Date: `2026-06-02`
- Local time: `16:05-16:06 PDT`
- Zone: `Tests, scripts, hooks, and coverage gaps`

## Scope

Read-only inspection of the current automated test surface, release/guardrail
scripts, and Claude/git hook wiring. This run checked what is actually covered,
what passed today, and where the current script/test setup still leaves blind
spots. No product code, packaged app, real Save Data, cloud write, or live
phone/Electron run was touched.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` via targeted duplicate search
- `package.json`
- `.claude/settings.json`
- `.claude/README.md`

## Commands Run With Exit Codes

| Command | Exit |
|---|---:|
| `date '+%Y-%m-%d %H:%M:%S %Z'` | 0 |
| `git status --short` | 0 |
| `sed -n '1,260p' package.json` | 0 |
| `find tests -maxdepth 2 -type f \| sort` | 0 |
| `find scripts -maxdepth 2 -type f \| sort` | 0 |
| `tail -n 60 .claude/hook-activity.log` | 0 |
| `npm test -- --test-reporter=spec` | 0 |
| `npm run guardrails:check:all` | 0 |
| `rg -n "phone\|Phone\|electron\|guardrail\|hook\|Quill\|Prep\|Proof\|Duet\|whisper\|cloud\|backup\|export\|sync" tests scripts .claude -g '!**/node_modules/**'` | 0 |
| `sed -n '1,240p' scripts/install-git-hooks.sh` | 0 |
| `sed -n '1,260p' scripts/check-protected-changes.js` | 0 |
| `sed -n '1,260p' scripts/check-sync-scope.js` | 0 |
| `rg -n "coverage gap\|tests, scripts, hooks\|hook\|guardrail\|phone.*test\|electron.*test\|release.*test\|offline queue\|no offline queue\|WIRING_MATRIX\|doc-drift" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start -g '!**/node_modules/**'` | 0 |
| `rg -n "Phone\|phone\|electron\|release\|guardrail\|hook\|backup\|sync-only\|pre-commit" tests scripts .githooks .claude/settings.json .claude/README.md -g '!**/node_modules/**'` | 0 |
| `sed -n '1,220p' .githooks/pre-commit` | 0 |
| `nl -ba package.json \| sed -n '1,80p'` | 0 |
| `nl -ba scripts/check-protected-changes.js \| sed -n '1,220p'` | 0 |
| `nl -ba scripts/check-sync-scope.js \| sed -n '1,220p'` | 0 |
| `nl -ba .claude/settings.json \| sed -n '1,120p'; nl -ba .githooks/pre-commit \| sed -n '1,80p'` | 0 |

## Evidence Paths

- `package.json:6-26`
- `tests/cloud-error-message.test.mjs`
- `tests/cloud-slim.test.mjs`
- `tests/manuscript-engine.test.mjs`
- `tests/prep-export.test.mjs`
- `tests/quill-exporters.test.mjs`
- `tests/whisper-json.test.mjs`
- `scripts/check-protected-changes.js:30-76`
- `scripts/check-sync-scope.js:28-76`
- `scripts/install-git-hooks.sh:1-10`
- `.githooks/pre-commit:1-5`
- `.claude/settings.json:2-42`
- `.claude/hook-activity.log` tail read during this run

## Pass Items

1. The repo's current automated suite passed cleanly today: `npm test -- --test-reporter=spec` reported 13 passing tests, 0 failures, across cloud message handling, cloud slimming, manuscript dialogue detection, Prep export, Quill export, and Whisper JSON parsing.
2. Hook wiring is present in two layers: Claude lifecycle hooks are configured in `.claude/settings.json:2-42`, and git pre-commit guardrails are wired through `.githooks/pre-commit:1-5` plus `scripts/install-git-hooks.sh:1-10`.
3. Recent hook receipts exist. The `.claude/hook-activity.log` tail showed fresh `context-check`, `progress`, `git-backup`, `file-tracker`, `no-mess`, `no-self-cert`, and `build-checker` entries from June 1-2, so the hook trail is not stale.

## Fail Items

1. Coverage gap: the committed Node test suite is still narrow relative to the app surface described in `docs/BUILD_PLAN_V4.md` and `docs/APP_STRUCTURE.md`. `package.json:9` runs only `tests/**/*.test.mjs`, and the current test tree contains six files limited to cloud helpers, manuscript parsing, Prep export, Quill export, and Whisper JSON. This run found no direct automated tests for phone flows, Electron bridge/save flows, release packaging, backup scripts, or hook/guardrail behavior.

## Watchlist Items

1. `npm run guardrails:check:all` passed in a dirty tree because both guardrail scripts only inspect staged files via `git diff --cached` (`scripts/check-protected-changes.js:30-58`, `scripts/check-sync-scope.js:28-56`). That is valid for pre-commit use, but it means the monitor preflight command is weaker than it looks when nothing is staged.
2. The passing test run emitted repeated Node `MODULE_TYPELESS_PACKAGE_JSON` warnings while importing ESM-style files from `packages/cloud-sync`, `app/components/prepExport.js`, and `packages/quill-engine`. The suite still passed, but the warning noise can hide more useful script/test output during future audits.

## What Was Not Tested

- No live Electron launch, restart, save, export, or packaged build.
- No `npm run build`, `npm run electron-build-*`, `npm run release:*`, or `npm run whisper:model`.
- No phone browser run, phone round-trip, offline retry, or Supabase live sync.
- No real manuscript, audio, backup, or Save Data operation.
- No direct execution of the standalone diagnostic scripts under `scripts/`.
- No deliberate hook-trigger exercise in this run; only existing log evidence was read.

## Possible Duplicate Bug References

- No direct duplicate confirmed-bug entry was found for this exact Zone 11 coverage result.
- Related prior coverage-risk evidence already exists in:
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` around the earlier coverage-gap summary for phone/cloud edges and test surface.
  - `docs/audits/monitors/2026-06-02-manual-start/zone-phone-script/inspector-a.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-phone-script/inspector-b.md`
- Related product-risk item, but not a duplicate of this report: `SAS-AUD-20260602-002` (Phone Quill offline save / pending-state risk) still sits partly behind missing direct phone coverage.

## Next Checks

1. Add a focused Zone 11 follow-up for live-safe script execution in temp space: `npm run build`, `npm run release:mac`/`release:win` dry evidence if environment-safe, and a guarded Electron smoke path that proves temp-only save locations.
2. Add targeted automated coverage for phone save/export flows, Electron bridge save/export handlers, and the release-copy scripts so the test surface matches the documented product scope more closely.
3. If Marie wants stronger preflight guardrail evidence during audits, add a separate read-only working-tree scan instead of relying only on staged-file commit hooks.
