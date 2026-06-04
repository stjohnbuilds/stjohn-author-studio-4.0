# Zone Checker - Zone 11 Tests, Scripts, Hooks, and Coverage Gaps

- Date/time: 2026-06-02 19:37 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for
  the tests/scripts/hooks zone only; preserve disagreements; run focused
  read-only follow-up where needed; dedupe before touching the master report or
  bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-tests-scripts-hooks-and-coverage-gaps/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-tests-scripts-hooks-and-coverage-gaps/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-tests-scripts-hooks-and-coverage-gaps/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main disagreements around:

- `package.json`
- `tests/`
- `scripts/check-protected-changes.js`
- `scripts/check-sync-scope.js`
- `.githooks/pre-commit`
- `.claude/settings.json`
- `.claude/hooks/build-checker.sh`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p'` on the three Zone 11 inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba package.json \| sed -n '1,40p'` | 0 |
| `nl -ba scripts/check-protected-changes.js \| sed -n '1,120p'` | 0 |
| `nl -ba scripts/check-sync-scope.js \| sed -n '1,120p'` | 0 |
| `nl -ba .githooks/pre-commit \| sed -n '1,40p'` | 0 |
| `nl -ba .claude/settings.json \| sed -n '1,120p'` | 0 |
| `nl -ba .claude/hooks/build-checker.sh \| sed -n '150,210p'` | 0 |
| `rg --files tests \| sort` | 0 |
| `rg -n "check-sync-scope\|check-protected-changes\|install-git-hooks\|set-guardrails-mode\|copy-release\|start-electron-dev\|makeBackupSnapshot\|getBackupInfo\|pruneBackups\|window\\.electron\|ipcMain\|contextBridge\|PhoneReader\|retryPendingAnnotation\|retryPendingFlag" tests` | 1 |
| `npm test -- --test-reporter=spec` | 0 |
| `npm run guardrails:check:all` | 0 |
| `find tests -maxdepth 1 -name '*.test.mjs' \| wc -l` | 0 |
| `find scripts -maxdepth 1 -type f \| wc -l` | 0 |
| `find .claude/hooks -maxdepth 1 -type f \| wc -l` | 0 |
| `find .githooks -maxdepth 1 -type f \| wc -l` | 0 |
| `rg -n "guardrails:check:all\|MODULE_TYPELESS_PACKAGE_JSON\|tests, scripts, hooks\|coverage gap\|build-checker" docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |

## Merged Findings

### PASS - The current automated suite and the current staged-file guardrails both run cleanly

The three inspectors agreed that the present read-only command surface is
healthy for what it actually covers, and the checker follow-up confirmed it:

- `npm test -- --test-reporter=spec` passed with 13 passing tests.
- `npm run guardrails:check:all` passed in the current repo state.
- Hook wiring exists in two layers: git pre-commit calls the two Node
  guardrail scripts, and Claude lifecycle hooks still configure broader
  reminders and stop checks.

Evidence:

- `package.json:6-26`
- `.githooks/pre-commit:1-5`
- `.claude/settings.json:2-42`
- Inspector A, B, and C command receipts

### RESOLVED - The narrow test surface is real, but this stays a checker-confirmed coverage risk rather than a new bug-log item

Inspectors A and C treated the current coverage gap as a zone fail, while
Inspector B kept it as watchlist only. The checker follow-up confirms the core
fact without promoting it into a new bug:

- `package.json` runs only `tests/**/*.test.mjs`.
- The current committed suite contains six top-level Node test files.
- The current app and support surface is materially larger than that suite:
  this follow-up counted 25 top-level `scripts/*` files, 14
  `.claude/hooks/*` files, one git hook file, plus major phone/Electron/backup
  paths documented in `docs/APP_STRUCTURE.md`.
- The targeted search found no direct tests for phone flows, Electron bridge
  handlers, backup snapshot helpers, or the guardrail/release scripts named in
  the inspectors' reports.

Checker assessment: resolved as a real coverage gap and release-readiness risk,
but not a confirmed product bug. The source-of-truth file forbids treating
code-traced risks as confirmed live bugs, and this zone did not reproduce a
deterministic new user-facing failure.

Evidence:

- `package.json:6-26`
- `docs/APP_STRUCTURE.md:33-47`, `154-184`
- `tests/cloud-error-message.test.mjs`
- `tests/cloud-slim.test.mjs`
- `tests/manuscript-engine.test.mjs`
- `tests/prep-export.test.mjs`
- `tests/quill-exporters.test.mjs`
- `tests/whisper-json.test.mjs`
- `find tests -maxdepth 1 -name '*.test.mjs'` => `6`
- `find scripts -maxdepth 1 -type f` => `25`
- `find .claude/hooks -maxdepth 1 -type f` => `14`
- `find .githooks -maxdepth 1 -type f` => `1`
- `rg ... tests` for phone/Electron/backup/guardrail keywords => exit `1`

### RESOLVED - `npm run guardrails:check:all` should not be treated as broad dirty-tree proof

Inspector A framed the hook split as a fail, while Inspectors B and C treated
it as a watchlist item. The checker follow-up confirms the narrower claim:

- `.githooks/pre-commit` runs only `check-sync-scope.js` and
  `check-protected-changes.js`.
- Both scripts inspect `git diff --cached`, so they validate staged commit
  scope, not the entire dirty working tree.
- The broader Claude stop-hook safety net lives in `.claude/settings.json` and
  `.claude/hooks/build-checker.sh`, not in the plain git pre-commit path.
- `build-checker.sh` auto-runs tests only for risky changes under `packages/`,
  `lib/`, `tests/`, `supabase/`, `main.js`, or `preload.js`, so script/hook
  edits can bypass that auto-test trigger.

Checker assessment: resolved as an audit-evidence limit and tooling-risk note,
not a new product bug. The current guardrails still behave as designed for
commit-time staged-file checks, but the monitor report should not overstate
that pass as full working-tree enforcement.

Evidence:

- `scripts/check-protected-changes.js:30-76`
- `scripts/check-sync-scope.js:28-76`
- `.githooks/pre-commit:1-5`
- `.claude/settings.json:2-42`
- `.claude/hooks/build-checker.sh:160-183`

### LIKELY - The repeated `MODULE_TYPELESS_PACKAGE_JSON` warnings remain real tooling noise, but not a new zone bug

All three inspectors noted the warning family, and the checker rerun reproduced
it while tests still passed.

Checker assessment: likely packaging/tooling cleanup item only. The warnings
add noise to audit command output, but this zone did not prove a new functional
failure from them.

Evidence:

- `npm test -- --test-reporter=spec` output during this checker pass
- Warning paths surfaced for:
  - `packages/cloud-sync/error-message.js`
  - `packages/cloud-sync/audio-guard.js`
  - `app/components/prepExport.js`
  - `packages/quill-engine/index.js`

### RESOLVED - Thin backup and release-script coverage overlaps existing risk areas, but this zone did not add new product-failure evidence for those bug families

Inspector A tied the backup and release test gaps to existing bugs
`SAS-AUD-20260602-011` and `SAS-AUD-20260602-014`. The checker follow-up agrees
that those are the same high-risk areas, but this zone still stops at coverage
evidence rather than a new symptom.

Checker assessment: no bug-log update in this zone. Existing bug IDs already
capture the live backup-manifest integrity failure and the export/rebrand
failure. Zone 11 adds follow-up pressure for better regression coverage, not a
separate defect record.

Evidence:

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `packages/backups/index.js`
- `scripts/copy-release.js`
- Inspector A report overlap notes

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: found no exact existing bug entry
  for the Zone 11 coverage-gap classification or the staged-only guardrail
  preflight limit. The checker did not add a new bug because these findings
  remain code-traced coverage/tooling risks rather than confirmed product
  failures.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed existing bugs
  `SAS-AUD-20260602-011` and `SAS-AUD-20260602-014` already cover the backup
  and release product-failure families mentioned by Inspector A, so no
  overlapping bug entry was added for those areas.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: found no earlier Zone 11
  checker section for tests/scripts/hooks, so this run appends one new
  zone-checker section rather than updating an older checker entry.

## Overall Assessment

- Zone status: checked
- Audit result: no new bug ID added; checker-confirmed coverage and tooling
  risks recorded in the zone checker and master report
- Confidence: high
- Why not higher: this zone stayed static/read-only, so the guardrail branches,
  git-hook blocking path, release scripts, backup flows, phone flows, and
  Electron handlers were not exercised in a safe live repro

## Next Steps

- Later safe follow-up: use an isolated throwaway commit flow to prove
  `check-sync-scope.js` and `check-protected-changes.js` block both allowed and
  blocked staged-file cases as intended.
- Later coverage follow-up: add targeted automated coverage for phone flows,
  Electron bridge/save-export handlers, backup snapshot helpers, release-copy
  scripts, and the hook/guardrail layer before treating release readiness as
  well defended.
- Next later checker-ready zone: wait for the first later active-priority zone
  where `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` all exist and
  no `checker.md` exists; no later zone is checker-ready right now.
