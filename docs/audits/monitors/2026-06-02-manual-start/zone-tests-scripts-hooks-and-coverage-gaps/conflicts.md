# Conflict Ledger - Zone 11 Tests, Scripts, Hooks, and Coverage Gaps

The three inspectors agreed that the current tests and guardrails pass, that
the automated coverage surface is thinner than the repo surface, and that the
test run still emits repeated Node module-type warnings. The disagreements were
about severity and bug-log action.

## Conflict 1 - Should the narrow test surface become a new bug or stay a coverage risk?

- Original Inspector A claim: the automated suite covers only a narrow slice of
  the app and leaves phone, Electron, backups, and release scripts without
  direct tests, so this counts as a zone fail.
- Original Inspector B claim: no new confirmed functional failure was proven;
  the thin script/hook coverage is a watchlist item.
- Original Inspector C claim: the committed test surface is materially narrower
  than the documented app/script surface, so this counts as the zone's main
  fail item.
- Evidence:
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
- Checker follow-up audit: confirmed the coverage gap is real and specific, but
  also confirmed this zone did not reproduce a deterministic new user-facing
  defect.
- Checker assessment: keep visible as a checker-confirmed coverage risk in the
  zone checker and master report, not as a new bug-log item.
- Status: `resolved`
- Next check needed: later add targeted tests or safe repro runs for phone,
  Electron, backup, release, and guardrail paths.

## Conflict 2 - Does the current guardrail wiring count as a pass or a fail?

- Original Inspector A claim: the broader Claude safety hooks are not the same
  as git-hook enforcement, so the current setup leaves meaningful protection
  outside the plain pre-commit path.
- Original Inspector B claim: guardrail wiring exists, but
  `npm run guardrails:check:all` is weaker than it looks when nothing is staged
  because both scripts only inspect `git diff --cached`.
- Original Inspector C claim: the staged-only behavior is real, so the current
  guardrail pass should not be read as general working-tree proof.
- Evidence:
  - `scripts/check-protected-changes.js:30-76`
  - `scripts/check-sync-scope.js:28-76`
  - `.githooks/pre-commit:1-5`
  - `.claude/settings.json:2-42`
  - `.claude/hooks/build-checker.sh:160-183`
- Checker follow-up audit: confirmed the pass/fail split is mostly about scope
  language. The staged-file commit guardrails are present and passed, but they
  do not prove dirty-tree safety, and the broader Claude hook safety net is a
  separate layer.
- Checker assessment: keep as a resolved tooling-risk note. Do not create a
  new bug; do update the master report language so the guardrail pass is not
  overstated.
- Status: `resolved`
- Next check needed: later isolated staged-file commit drill to prove the block
  path and override path end to end.

## Conflict 3 - Should backup/release under-testing create new overlapping bugs?

- Original Inspector A claim: the thin backup and release-script coverage keeps
  pressure on areas already implicated by `SAS-AUD-20260602-011` and
  `SAS-AUD-20260602-014`.
- Original Inspector B claim: no exact matching bug-log item exists for this
  zone's guardrail/hook/test observations.
- Original Inspector C claim: the zone should push for better coverage, but did
  not frame backup/release under-testing as a separate confirmed defect.
- Evidence:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
  - `packages/backups/index.js`
  - `scripts/copy-release.js`
  - Inspector A overlap notes
- Checker follow-up audit: confirmed the overlap is real, but this zone added
  only coverage evidence, not a new broken behavior.
- Checker assessment: no new bug-log entry. Keep the product failures under the
  existing backup and export/release bugs, and keep Zone 11's contribution as
  coverage-risk context.
- Status: `resolved`
- Next check needed: later targeted regression tests or safe isolated live runs
  around backup snapshots and release-copy flows.

## Conflict 4 - Do the repeated `MODULE_TYPELESS_PACKAGE_JSON` warnings need a bug entry now?

- Original Inspector A claim: the warnings are watchlist noise and could become
  brittle as tooling grows.
- Original Inspector B claim: the warning family is real and worth future
  cleanup or documentation, but not proven as a functional failure here.
- Original Inspector C claim: the warning noise can hide more useful command
  output during future audits.
- Evidence:
  - `npm test -- --test-reporter=spec` output during this checker pass
  - Warning paths surfaced for:
    - `packages/cloud-sync/error-message.js`
    - `packages/cloud-sync/audio-guard.js`
    - `app/components/prepExport.js`
    - `packages/quill-engine/index.js`
- Checker follow-up audit: reran the suite and reproduced the warnings while
  keeping all 13 tests green.
- Checker assessment: keep as a likely tooling-cleanup item only, not a new bug
  entry from this zone.
- Status: `likely`
- Next check needed: decide later whether to remove the warnings or document
  them as an accepted package-layout tradeoff.
