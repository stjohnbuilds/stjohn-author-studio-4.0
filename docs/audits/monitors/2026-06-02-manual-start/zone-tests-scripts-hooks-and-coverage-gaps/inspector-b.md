# Inspector B - Zone 07 - Tests, Scripts, Hooks, and Coverage Gaps

- Date: 2026-06-02 19:01-19:07 PDT
- Campaign: `2026-06-02-manual-start`
- Inspector: B
- Status: complete

## Scope

Read-only static audit of the test surface, guardrail scripts, git hook wiring,
Claude hook wiring, and coverage gaps for the current StJohn 4.0 repo state.
No product-code edits, no real Save Data access, no staged-commit simulation,
and no Electron/live UI run.

## Source Docs Checked

1. `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
2. `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
3. `docs/BUILD_PLAN_V4.md`
4. `docs/APP_STRUCTURE.md`
5. `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
6. `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
7. `package.json`
8. `.claude/README.md`
9. `.claude/settings.json`

## Commands Run With Exit Codes

| Command | Exit |
|---|---:|
| `date '+%Y-%m-%d %H:%M:%S %Z'` | 0 |
| `test -f docs/audits/monitors/_run_state/inspector-b.lock.md && sed -n '1,220p' docs/audits/monitors/_run_state/inspector-b.lock.md || echo '__MISSING_LOCK__'` | 0 |
| `rg --files docs/audits/monitors/2026-06-02-manual-start \| sort` | 0 |
| `git status --short` plus `.env.local` / release / `rg --files tests scripts .claude` inventory | 0 |
| `npm test -- --test-reporter=spec` | 0 |
| `npm run guardrails:check:all` | 0 |
| `sed -n '1,220p' .claude/settings.json` | 0 |
| `sed -n '1,260p' scripts/install-git-hooks.sh` | 0 |
| `sed -n '1,260p' scripts/check-protected-changes.js` | 0 |
| `sed -n '1,260p' scripts/check-sync-scope.js` | 0 |
| `sed -n '1,220p' .claude/README.md` | 0 |
| `sed -n '1,220p' scripts/set-guardrails-mode.js` plus `cat scripts/guardrails-mode.json` plus `cat scripts/sync-allowed-paths.json` | 0 |
| `sed -n '1,220p' .githooks/pre-commit` | 0 |
| `rg -n "sync-only\|guardrails:sync:on\|set-guardrails-mode\|ALLOW_SYNC_SCOPE_OVERRIDE\|SYNC_SCOPE_REASON" -S .` | 0 |
| `nl -ba package.json`, `.claude/settings.json`, `.githooks/pre-commit` | 0 |
| `nl -ba scripts/install-git-hooks.sh`, `scripts/check-protected-changes.js`, `scripts/check-sync-scope.js`, `scripts/set-guardrails-mode.js` | 0 |
| `rg -n "check-sync-scope\|check-protected-changes\|install-git-hooks\|set-guardrails-mode\|guardrails:sync:on\|guardrails:check" tests .` plus file counts | 0 |
| `nl -ba .claude/hooks/build-checker.sh`, `_log.sh`, `no-mess.sh` | 0 |
| `node --check app/phone/page.js` | 0 |
| `node --check app/components/ProofingReader.js` | 0 |
| `node --check app/components/QuillAndInkMode.js` | 0 |
| `rg -n "guardrail\|pre-commit\|hook-activity\|build-checker\|sync scope\|protected changes\|tests, scripts, hooks\|coverage gap" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` | 0 |

## Evidence Paths

- `package.json:6-26`
- `.claude/settings.json:2-42`
- `.claude/README.md:1-77`
- `.claude/hooks/build-checker.sh:1-186`
- `.claude/hooks/no-mess.sh:1-35`
- `.claude/hooks/_log.sh:1-23`
- `.claude/hook-activity.log`
- `.githooks/pre-commit:1-5`
- `scripts/install-git-hooks.sh:1-10`
- `scripts/check-protected-changes.js:1-76`
- `scripts/check-sync-scope.js:1-76`
- `scripts/set-guardrails-mode.js:1-17`
- `scripts/guardrails-mode.json`
- `scripts/sync-allowed-paths.json`
- `tests/cloud-error-message.test.mjs`
- `tests/cloud-slim.test.mjs`
- `tests/manuscript-engine.test.mjs`
- `tests/prep-export.test.mjs`
- `tests/quill-exporters.test.mjs`
- `tests/whisper-json.test.mjs`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md:301-305`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md:748-753`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md:1978-1980`

## Pass Items

1. `npm test -- --test-reporter=spec` passed with 13/13 tests green across the
   current six Node test files. Core covered areas include cloud error
   formatting, cloud slimming, manuscript dialogue detection, Prep export,
   Quill export, and Whisper JSON parsing.
2. Guardrail wiring exists in both expected layers: Claude lifecycle hooks are
   configured in `.claude/settings.json`, and git commit guardrails are wired
   through `.githooks/pre-commit` plus `scripts/install-git-hooks.sh`.
3. Hook activity evidence is present in `.claude/hook-activity.log`, including
   recent `git-backup`, `file-tracker`, `no-mess`, `build-checker`, and prompt
   reminder entries.
4. Representative `node --check` runs passed on `app/phone/page.js`,
   `app/components/ProofingReader.js`, and `app/components/QuillAndInkMode.js`,
   so the current stop-hook syntax strategy is compatible with those live JS
   files.

## Fail Items

1. No new confirmed functional failure was proven in this read-only zone audit.

## Watchlist Items

1. `npm run guardrails:check:all` is weaker than it looks as a monitor
   preflight when nothing is staged. Both guardrail scripts inspect only
   `git diff --cached` (`scripts/check-protected-changes.js:30-58`,
   `scripts/check-sync-scope.js:28-56`), so the command can return success in a
   dirty but unstaged working tree without evaluating those changes.
2. Direct automated coverage for guardrail and hook behavior is thin. The repo
   currently has 25 top-level `scripts/*` files and 14 `.claude/hooks/*` shell
   files, but only 6 `tests/*.test.mjs` files, and the test search found no
   direct automated coverage for `check-sync-scope`, `check-protected-changes`,
   `install-git-hooks`, or `set-guardrails-mode`. The stop-hook test trigger in
   `.claude/hooks/build-checker.sh:166-183` also excludes `scripts/`,
   `.githooks/`, and `.claude/hooks/`, so those paths can change without any
   automatic regression run.
3. `npm test` emits repeated `[MODULE_TYPELESS_PACKAGE_JSON]` warnings for
   ESM-style files under the current package layout. Tests still pass, but the
   warnings add noise to health checks and can hide more important failures in
   long command output.

## What Was Not Tested

1. No files were staged, so the blocking and override branches inside
   `check-protected-changes.js` and `check-sync-scope.js` were not exercised.
2. No actual `git commit` was attempted, so `.githooks/pre-commit` was checked
   by source read only.
3. `scripts/install-git-hooks.sh` was not executed because this run was
   restricted to read-only audit work.
4. No `npm run build`, Electron launch, release build, or live package test was
   run in this zone.
5. I did not execute every standalone helper under `scripts/`; this run focused
   on the guardrail / hook layer plus the declared automated test surface.

## Possible Duplicate Bug References

1. `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md:748-753` already mentions a
   generic direct-test coverage gap in the master checker notes, but it does
   not appear to cover this zone's specific guardrail/hook observations.
2. `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md:1978-1980` explicitly marks
   this zone as the next unchecked area.
3. No exact matching bug-log entry was found for guardrail preflight weakness,
   hook-script coverage gaps, or the typeless-package warning noise.

## Next Checks

1. A later safe follow-up should stage one allowed file and one blocked file in
   an isolated throwaway commit flow to prove `check-sync-scope.js` and
   `check-protected-changes.js` block as intended.
2. Add targeted automated tests or harness coverage for the guardrail scripts
   and hook shell scripts before treating this safety layer as fully covered.
3. If a repair pass is approved later, decide whether the repeated
   `MODULE_TYPELESS_PACKAGE_JSON` warnings should be removed or documented as an
   accepted tradeoff.
