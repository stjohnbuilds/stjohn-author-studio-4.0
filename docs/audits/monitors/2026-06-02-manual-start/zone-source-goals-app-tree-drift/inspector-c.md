# Inspector C - Zone 1 Source Goals And App Tree Drift

- Date/time: 2026-06-02 00:35 PDT
- Role: Inspector C
- Scope: Read-only static audit of source goals and app tree drift only.
- Write boundary honored: wrote only this report and `docs/audits/monitors/_run_state/inspector-c.lock.md`.
- Product code changed: no.
- Real Save Data changed: no. I listed filenames only; I did not open or edit saved JSON contents.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- Also checked for Zone 1 context: `READ ME FIRST - OPEN THIS.txt`, `HANDOFF.md`, `CLAUDE.md`, `TODO.md`, `docs/FRONT_FUNCTION_TREE.md`, `docs/INTERNAL_FUNCTION_TREE.md`, `docs/SHARED_COMPONENTS.md`, `docs/WIRING_MATRIX.md`, `docs/CLOUD_SCHEMA.md`, `docs/CLOUD_SAFETY_AUDIT.md`, `package.json`.

## Commands Run

All commands were read-only except the allowed lock/report writes.

| Command | Exit |
|---|---:|
| `pwd && git status --short` | 0 |
| `sed -n ...` on required source docs | 0 |
| `sed -n '1,180p' docs/audits/monitors/_run_state/inspector-c.lock.md` | 1, file did not exist |
| `test -d .../zone-source-goals-app-tree-drift` | 0 |
| `test -d docs/audits/monitors/_run_state` | 0 |
| `date '+%Y-%m-%d %H:%M:%S %Z'` | 0 |
| `apply_patch` add Inspector C lock | 0 |
| `find app -maxdepth 3 -type f \| sort` | 0 |
| `find packages -maxdepth 3 -type f \| sort` | 0 |
| `find scripts tests supabase -maxdepth 3 -type f \| sort` | 1, because `supabase/` is missing |
| `find 'Save Data' -maxdepth 2 -type f \| sort \| sed -n '1,80p'` | 0 |
| `find 'Script and Sync Releases' -maxdepth 2 ...` | 0 |
| `rg --files -g '!node_modules' -g '!.next' -g '!out' -g '!dist'` | 0 |
| `rg -n "sample|mock|demo|fake|dummy|placeholder|seed" ...` | 0 |
| `rg -n "supabase.from|storage|upload|audioPath..." ...` | 0 |
| `rg -n "script_sync_projects|...|prep_projects|loveworn|app_data|godmode" ...` | 0 |
| `rg -n "packages/reader-engine|app/components/Reader|...|supabase/" docs CLAUDE.md HANDOFF.md` | 0 |
| `test -d packages/reader-engine; ... test -d app/quill` | 0, individual tested dirs returned exit 1/missing |
| `find .../zone-source-goals-app-tree-drift -maxdepth 1 -type f` | 0 |
| `nl -ba ... \| sed ...` evidence extracts | 0 |
| `node -e "const p=require('./package.json')..."` | 0 |
| `rg -n "pushProofProject|pullProofProjects|..." ...` | 0 |
| `rg -n "readData|writeData|..." preload.js main.js` | 0 |
| `rg -n "quill-project-list|quill-projects|..." main.js app packages docs` | 0 |
| `rg -n "SAS-AUD-20260602-001|..." docs/audits docs/dev/active TODO.md HANDOFF.md CLAUDE.md` | 0 |
| `wc -l app/page.js ... app/phone/page.js` | 0 |
| `rg -n "Audit Zones|..." docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md ...` | 0 |

`npm test` was not run because Zone 1 was a static docs/tree drift audit, and no product behavior was changed.

## Evidence Paths

- Current tree has core app files: `app/page.js`, `app/phone/page.js`, `app/components/PrepManuscriptMode.js`, `app/components/PrebuildMode.js`, `app/components/QuillAndInkMode.js`.
- `app/page.js:7-9` imports Duet, Prep, and Quill mode files; `app/page.js:1520-1601` renders those modes; `app/page.js:1699-1701` has enabled Prep/Quill mode entries.
- `docs/BUILD_PLAN_V4.md:3` says Phase 1 is still in progress, while `docs/FRONT_FUNCTION_TREE.md:24-108` says shell, desktop modes, and phone rows are mostly real.
- `docs/WIRING_MATRIX.md:3-4` says skeleton/Phase 1, and `docs/WIRING_MATRIX.md:28`, `53-57`, `63-75`, `81-96` still mark implemented/currently documented areas as missing.
- `docs/BUILD_PLAN_V4.md:128-129` says the one reader lives under `packages/reader-engine/` plus `app/components/Reader/`; both directories are missing. Actual shared reader file is `app/components/ChapterReader.js`, and Proof still uses `app/components/ProofingReader.js`.
- `docs/INTERNAL_FUNCTION_TREE.md:68-72`, `74-89`, `103-114`, and `118-123` are labeled target, but name missing packages/routes and old helper names. Good as target notes, risky if read as current tree.
- `docs/CLOUD_SAFETY_AUDIT.md:37` tells auditors to inspect `supabase/`, but `supabase/` does not exist in this repo.
- `docs/APP_STRUCTURE.md:175-183` lists the main save files but omits `quill-project-list.json`; `main.js:235-239` defines it and `main.js:1056-1068` writes Quill summaries.
- `packages/cloud-sync/client.js:22-37` whitelists the six approved Supabase tables; `packages/cloud-sync/audio-guard.js:12-84` strips audio path/blob fields.
- `app/components/LoginScreen.js:313-346` has a dev-only fake login button; `packages/cloud-sync/proof-sync.js:36-44` guards an old `demo-book-1` cloud id.

## Findings

### PASS - Current app tree covers the intended product shape

The actual tree includes the desktop shell, all four desktop mode files, phone page/components/libs, shared cloud sync, audio engine, manuscript engine, Quill engine, backups, scripts, and tests. This matches the broad StJohn 4.0 product shape in `docs/APP_STRUCTURE.md`.

### PASS - Audit zones broadly cover the app

The source-of-truth zones cover source docs, shell/settings, Proof, Prep, Duet, Quill, both phone modes, cloud/auth/audio/save/backups, exports/imports/releases, and tests/scripts. I did not see a major app area outside the zone list.

### DOC-DRIFT - Phase/status docs disagree

`docs/BUILD_PLAN_V4.md` and `docs/WIRING_MATRIX.md` still read like Phase 1/early missing-state documents. `docs/FRONT_FUNCTION_TREE.md`, `docs/APP_STRUCTURE.md`, and the actual tree show the app is much further along. This duplicates existing bug-log item `SAS-AUD-20260602-001`.

### DOC-DRIFT - Shared reader architecture claim is stale

The plan says the one reader lives in `packages/reader-engine/` and `app/components/Reader/`, but those folders do not exist. Current docs/code show the real shared reader is `app/components/ChapterReader.js`, while Proof still has `ProofingReader.js`. This is likely documentation/target drift, not a confirmed product failure.

### DOC-DRIFT - Cloud safety doc points to missing `supabase/`

`docs/CLOUD_SAFETY_AUDIT.md` tells reviewers to inspect `supabase/`, but the folder is absent. Cloud schema appears documented in `docs/CLOUD_SCHEMA.md` instead. The six-table and audio-never-cloud claims are supported by current `packages/cloud-sync/` code.

### WATCHLIST - Fake/sample data risk appears contained, but dev fake login is visible in source

No product `sampleProjects` style app data was found in `app/` or `packages/`. The notable items are a non-production fake login button and an old `demo-book-1` cloud-id guard. These look intentional/dev-only, but a release/build check should confirm the fake login never appears in production packages.

### WATCHLIST - `APP_STRUCTURE.md` omits one real save/index file

`quill-project-list.json` is part of the actual Quill summary cache path but is not listed in the App Structure save-file section. This is low risk, but it matters for backup/save-data audits.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` already covers the main app-tree status drift.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` and `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md` also reference that same doc-drift item.
- `SAS-AUD-20260530-001` is related only to Save Data audit safety, not this Zone 1 tree drift.

## What Was Not Tested

- No UI navigation.
- No Electron launch.
- No Supabase live access.
- No real phone test.
- No export/import/package execution.
- No `npm test`, build, guardrails, or release commands.
- No real Save Data JSON contents opened or modified.

## Next Checks

- Zone checker should compare this against Inspector A/B and preserve any disagreement.
- A docs-only refresh should split historical plan/target notes from current tree status.
- Later zones should verify the dev fake login is absent from production build output.
- Save-data/backups zone should include `quill-project-list.json` in the file coverage check.
- Cloud zone should decide whether to create/restore `supabase/` docs or update `CLOUD_SAFETY_AUDIT.md` to point only at current schema docs.
