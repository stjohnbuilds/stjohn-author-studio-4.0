# Inspector A - Zone 11 - Tests, scripts, hooks, and coverage gaps

- Date: 2026-06-02 19:04:56 PDT
- Campaign: `2026-06-02-manual-start`
- Status: complete

## Scope

Read-only audit of automated test coverage, build/release/support scripts,
guardrail wiring, and hook coverage claims. No product code edits. No Electron
launch. No real Save Data, real manuscript, real cloud, or packaged app run.

## Source docs checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `CLAUDE.md`
- `TODO.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/monitors/_run_state/inspector-a.lock.md`

## Commands run with exit codes

| Command | Exit |
|---|---:|
| `date -u +%Y-%m-%dT%H:%M:%SZ && date +%Y-%m-%dT%H:%M:%S%z` | 0 |
| `sed -n '1,520p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` | 0 |
| `sed -n '1,260p' docs/BUILD_PLAN_V4.md` | 0 |
| `sed -n '1,260p' docs/APP_STRUCTURE.md` | 0 |
| `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `test -f docs/audits/monitors/_run_state/inspector-a.lock.md && sed -n '1,220p' docs/audits/monitors/_run_state/inspector-a.lock.md` | 0 |
| `find docs/audits/monitors -maxdepth 3 -type f \( -name 'inspector-a.md' -o -name 'checker.md' \) \| sort` | 0 |
| `git status --short` | 0 |
| `npm test -- --test-reporter=spec` | 0 |
| `test -f .env.local; ... ; tail -n 20 .claude/hook-activity.log` | 0 |
| `sed -n '1,240p' package.json && find tests ... && find scripts ...` | 0 |
| `sed -n '1,220p' 'READ ME FIRST - OPEN THIS.txt' && sed -n '1,220p' HANDOFF.md && sed -n '1,220p' CLAUDE.md && sed -n '1,220p' TODO.md` | 0 |
| `sed -n '1,260p' scripts/install-git-hooks.sh && sed -n '1,220p' scripts/start-electron-dev.js && sed -n '1,240p' scripts/check-protected-changes.js && sed -n '1,240p' scripts/check-sync-scope.js` | 0 |
| `for f in tests/*.test.mjs; do sed -n '1,220p' "$f"; done` | 0 |
| `sed -n '1,260p' .githooks/pre-commit && find .claude -maxdepth 2 -type f` | 0 |
| `npm run guardrails:check:all` | 0 |
| `rg -n "node:test\|--test\|describe\\(|test\\(" tests scripts app packages main.js preload.js .githooks .claude` | 0 |
| `sed -n '1,260p' docs/INTERNAL_FUNCTION_TREE.md && sed -n '1,260p' docs/FRONT_FUNCTION_TREE.md` | 0 |
| `sed -n '1,240p' .claude/settings.json && sed -n '1,240p' .claude/README.md && sed -n '1,240p' .claude/hooks/build-checker.sh && sed -n '1,220p' .claude/hooks/file-tracker.sh` | 0 |
| `rg -n "backups\|snapshot\|copy-release\|install-git-hooks\|start-electron-dev\|seed-pac3\|guardrails:install\|release:mac\|release:win\|electron-build\|phone/page\|ProofingReader\|SessionsView\|main\\.js\|preload\\.js" tests scripts package.json docs` | 0 |
| `sed -n '1,240p' packages/backups/index.js && sed -n '1,240p' scripts/copy-release.js` | 0 |
| `nl -ba .githooks/pre-commit && nl -ba .claude/settings.json` | 0 |
| `rg -n "makeBackupSnapshot\|getBackupInfo\|pruneBackups\|runDailySnapshotIfDue\|takeSnapshotNow" tests; printf 'exit=%s\n' $?` | 1 |
| `rg -n "audioFolderMemory\|PhoneReader\|phone/page\|retryPendingAnnotation\|retryPendingFlag\|setSelectedBookAudioFiles\|selectionMeta" tests; printf 'exit=%s\n' $?` | 1 |
| `rg -n "main\\.js\|preload\\.js\|window\\.electron\|ipcMain\|contextBridge\|whisperTranscribe\|makeBackupSnapshot" tests; printf 'exit=%s\n' $?` | 1 |
| `rg -n "copy-release\|start-electron-dev\|install-git-hooks\|check-protected-changes\|check-sync-scope" tests; printf 'exit=%s\n' $?` | 1 |
| `nl -ba package.json` | 0 |
| `nl -ba packages/backups/index.js && nl -ba app/phone/page.js && nl -ba preload.js && nl -ba main.js` | 0 |
| `nl -ba scripts/copy-release.js && nl -ba scripts/install-git-hooks.sh` | 0 |
| `for f in tests/*.test.mjs; do nl -ba "$f"; done` | 0 |
| `date +'%Y-%m-%d %H:%M:%S %Z'` | 0 |

## Evidence paths

- `package.json:6-26`
- `tests/cloud-error-message.test.mjs:1-14`
- `tests/cloud-slim.test.mjs:1-55`
- `tests/manuscript-engine.test.mjs:1-38`
- `tests/prep-export.test.mjs:1-118`
- `tests/quill-exporters.test.mjs:1-109`
- `tests/whisper-json.test.mjs:1-47`
- `packages/backups/index.js:1-135`
- `app/phone/page.js:1-170`
- `preload.js:1-55`
- `main.js:1978-2115`
- `scripts/copy-release.js:1-168`
- `scripts/install-git-hooks.sh:1-10`
- `.githooks/pre-commit:1-5`
- `.claude/settings.json:1-43`
- `.claude/README.md:1-50`
- `.claude/hooks/build-checker.sh:1-180`
- `docs/APP_STRUCTURE.md:51-64`
- `docs/APP_STRUCTURE.md:191-205`
- `docs/BUILD_PLAN_V4.md:15-20`
- `TODO.md:110-133`

## Pass items

1. The baseline read-only checks are healthy. `npm test -- --test-reporter=spec`
   passed all 13 tests, and `npm run guardrails:check:all` also passed in this
   run.
2. The repo does have an active automated test suite with real assertions
   around some high-risk helper paths: cloud error wording, cloud payload
   slimming/audio stripping, manuscript dialogue detection, Prep DOCX export,
   Quill export formatting, and Whisper JSON parsing.
3. Git guardrails are at least partly enforced outside the editor. The install
   script sets `core.hooksPath` to `.githooks`, and the live pre-commit hook
   runs both `check-sync-scope.js` and `check-protected-changes.js`.
4. Hook activity is still live in the project safety net. `.claude/hook-activity.log`
   had current entries for context checks, no-mess, no-self-cert, build-checker,
   and file tracking during the recent phone/cloud work.

## Fail items

1. The automated test suite covers only a narrow slice of the product despite
   the app structure declaring critical surfaces in phone, Electron, backups,
   and release tooling. `package.json` points `npm test` only at
   `tests/**/*.test.mjs`, and the current six test files cover cloud helpers,
   manuscript detection, Prep export, Quill export, and Whisper JSON only.
   I found no test references for backup snapshot flows, phone-specific logic,
   Electron bridge/main-process handlers, or script-level release/guardrail
   paths. Evidence: `package.json:6-26`, the six `tests/*.test.mjs` files
   listed above, plus these absence receipts from this run:
   `makeBackupSnapshot|getBackupInfo|pruneBackups` -> exit `1`,
   `audioFolderMemory|PhoneReader|phone/page|retryPendingAnnotation|retryPendingFlag|selectionMeta`
   -> exit `1`,
   `main.js|preload.js|window.electron|ipcMain|contextBridge|whisperTranscribe|makeBackupSnapshot`
   -> exit `1`,
   `copy-release|start-electron-dev|install-git-hooks|check-protected-changes|check-sync-scope`
   -> exit `1`.
2. The project’s richer safety hooks are not the same thing as the git hook
   path. `.githooks/pre-commit` runs only two node scripts, while the broader
   protections Marie’s docs describe (`no-mess`, `build-checker`,
   `stop-no-self-cert`, file tracking, auto-backup, UI/deep-check triggers)
   live under `.claude/settings.json` and depend on the Claude lifecycle. That
   means syntax checks, risky-path auto-tests, duplication blocks, and
   self-cert warnings are not part of the plain git pre-commit enforcement
   surface. Evidence: `.githooks/pre-commit:1-5`,
   `.claude/settings.json:2-41`, `.claude/README.md:3-50`,
   `.claude/hooks/build-checker.sh:1-180`.

## Watchlist items

1. The test run emits repeated `[MODULE_TYPELESS_PACKAGE_JSON]` warnings for
   ESM-shaped files in `packages/cloud-sync/`, `packages/quill-engine/`, and
   `app/components/prepExport.js`. Nothing failed in this pass, but the module
   boundary is still ambiguous and could become more brittle as tooling grows.
2. Backup snapshots remain a critical but thinly protected surface. The live
   code path spans renderer logic in `packages/backups/index.js`, bridge
   exposure in `preload.js`, and zip/manifest writing in `main.js`, yet this
   zone found no automated tests covering those paths. Existing bug
   `SAS-AUD-20260602-011` already proves this area can drift into misleading
   success states.
3. Release/archive tooling is still largely manual and untested in automation.
   `scripts/copy-release.js` moves old artifacts, renames outputs, and repairs
   the Mac bundle, but this zone found no automated regression coverage for it.
   Existing bug `SAS-AUD-20260602-014` already shows release naming/confusion
   can slip through.
4. Only old packaged apps were visible from the read-only release directory
   scan during this run. That is not a new bug in this zone, but it means I
   could not verify current release-script behavior against a fresh build.

## What was not tested

- No live Electron or packaged app launch.
- No live phone browser run.
- No real manuscript, audio, Save Data, or cloud account.
- No `npm run build`, `release:mac`, or `release:win`.
- No live execution of `scripts/copy-release.js`, `scripts/start-electron-dev.js`,
  or sandbox scripts.
- No direct validation that `core.hooksPath` is currently set in local git
  config for this clone.
- No forced hook failure test to prove the pre-commit block path end to end.

## Possible duplicate bug references

- `SAS-AUD-20260602-011` because this zone confirms the backup snapshot path is
  still under-tested relative to its risk and prior integrity failure.
- `SAS-AUD-20260602-014` because this zone confirms the release/copy path still
  lacks automated regression coverage and remains vulnerable to packaging/name
  drift.

## Next checks

1. Inspector B should finish an independent Zone 11 pass without using this
   report as a source.
2. Inspector C already has a Zone 11 report path for this campaign; the checker
   can compare once Inspector B is present.
3. If Inspector A wakes again and no higher-priority zone is reopened, the next
   safest target is `Security and privacy`.
