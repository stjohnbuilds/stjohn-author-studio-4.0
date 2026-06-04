# Inspector A - Zone 1 Source Goals And App Tree Drift

- Role: Inspector A
- Date: 2026-06-02 00:33 PDT
- Scope: Read-only Zone 1 only. Compared source goals/docs to the current source tree. No product code was edited. No Electron app run. No Save Data touched.
- Output ownership: This file only. Lock file only.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `CLAUDE.md`
- `TODO.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `package.json`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,240p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| `sed -n '241,520p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| `sed -n '1,260p' docs/BUILD_PLAN_V4.md` | 0 |
| `sed -n '1,260p' docs/APP_STRUCTURE.md` | 0 |
| `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` | 0 |
| `sed -n '1,260p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `git status --short` | 0 |
| `if [ -f docs/audits/monitors/_run_state/inspector-a.lock.md ]; then sed -n '1,220p' ...; else printf 'NO_LOCK\n'; fi` | 0 |
| `rg --files ...source-doc list...` | 0 |
| `date '+%Y-%m-%d %H:%M:%S %Z'` | 0 |
| `ls -ld docs/audits/monitors/_run_state docs/audits/monitors/2026-06-02-manual-start/zone-source-goals-app-tree-drift` | 1 |
| `mkdir -p docs/audits/monitors/_run_state docs/audits/monitors/2026-06-02-manual-start/zone-source-goals-app-tree-drift` | 0 |
| `sed -n '1,220p' 'READ ME FIRST - OPEN THIS.txt'` | 0 |
| `sed -n '1,240p' HANDOFF.md` | 0 |
| `sed -n '1,260p' CLAUDE.md` | 0 |
| `sed -n '1,260p' TODO.md` | 0 |
| `sed -n '1,260p' docs/FRONT_FUNCTION_TREE.md` | 0 |
| `sed -n '1,260p' docs/INTERNAL_FUNCTION_TREE.md` | 0 |
| `sed -n '1,260p' docs/SHARED_COMPONENTS.md` | 0 |
| `sed -n '1,260p' docs/WIRING_MATRIX.md` | 0 |
| `sed -n '1,260p' docs/CLOUD_SCHEMA.md` | 0 |
| `sed -n '1,300p' docs/CLOUD_SAFETY_AUDIT.md` | 0 |
| `rg -n "Phase 1|Phase 4|...|out" docs/...` | 0 |
| `rg -n "sampleProjects|...|Audit Proof Book" app packages lib main.js preload.js scripts tests docs ...` | 2 |
| `rg -n "sampleProjects|...|Audit Proof Book" app packages main.js preload.js scripts tests docs ...` | 0 |
| `sed -n '280,370p' app/components/LoginScreen.js` | 0 |
| `sed -n '1,80p' packages/cloud-sync/proof-sync.js` | 0 |
| `find app packages scripts tests supabase -maxdepth 3 -type f \| sort` | 1 |
| `node -e "const fs=require('fs'); ... package.json scripts ..."` | 0 |
| `find . -maxdepth 2 -type d ... -print \| sort` | 0 |
| `rg -n "\\.from\\(['\\\"]|supabase\\.storage|upload\\(" packages/cloud-sync app/page.js app/phone/page.js main.js preload.js` | 0 |
| `for p in app/page.js ... supabase; do ...; done` | 0 |
| `rg -n "PrepManuscriptMode|PrebuildMode|..." app/page.js app/components/*.js app/phone/page.js` | 0 |
| `rg -n "reader-engine|app/components/Reader|..." docs/... CLAUDE.md` | 0 |
| `rg -n "stripAudioPaths|slimBookForCloud|..." packages/cloud-sync app/page.js app/phone/page.js` | 0 |
| `rg -n "edit.*annotation|delete.*annotation|..." app/phone/page.js packages/cloud-sync/*.js app/page.js` | 0 |
| Final re-anchor: `sed -n '1,520p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| Final re-anchor: `sed -n '1,280p' docs/APP_STRUCTURE.md` | 0 |
| Final re-anchor: `sed -n '1,260p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| Final `git status --short` before writing report | 0 |

Notes:
- The first fake-data `rg` failed because there is no top-level `lib/` directory. It was rerun against existing paths.
- The `find app packages scripts tests supabase ...` command failed because `supabase/` does not exist.
- `npm test` was not run because this zone was a static docs/tree audit and no behavior or product code was changed.

## Evidence Paths

- Current mode shell/code: `app/page.js`, `app/components/PrepManuscriptMode.js`, `app/components/PrebuildMode.js`, `app/components/QuillAndInkMode.js`
- Current phone code: `app/phone/page.js`, `app/phone/_components/`, `app/phone/_lib/`
- Current shared components: `app/components/BookDetail.js`, `app/components/ChapterReader.js`, `app/components/AudioDock.js`, `app/components/ReaderChrome.js`, `app/components/ImportFlow.js`
- Current cloud code: `packages/cloud-sync/client.js`, `packages/cloud-sync/audio-guard.js`, `packages/cloud-sync/proof-sync.js`, `packages/cloud-sync/quill-sync.js`, `packages/cloud-sync/flag-queue.js`
- Current engines: `packages/audio-engine/`, `packages/manuscript-engine/`, `packages/quill-engine/`, `packages/backups/`
- Missing paths found by static check: `supabase/`, `packages/reader-engine/`, `packages/exports/`, `app/components/Reader/`, top-level `lib/`

## Findings

### PASS - Main app tree mostly matches `APP_STRUCTURE.md`

`APP_STRUCTURE.md` describes one desktop app, one phone companion, four desktop modes, cloud-sync under `packages/cloud-sync/`, backups under `packages/backups/`, and local Save Data protection. The actual tree contains the named primary files for Proof, Prep, Duet, Quill, phone, cloud sync, audio engine, manuscript engine, quill engine, backups, scripts, and tests.

Evidence: `find`/path loop found the expected `app/page.js`, `app/phone/page.js`, mode components, shared components, and packages.

### DOC-DRIFT - Build phase and wiring status disagree with current tree

`docs/BUILD_PLAN_V4.md` still says "Phase 1 in progress." `docs/WIRING_MATRIX.md` still says skeleton/Phase 1 and marks the 4-mode switcher, Prep, Duet, Quill, and phone rows as missing. Current tree and `docs/FRONT_FUNCTION_TREE.md` show those areas have real source files and many rows marked REAL/PARTIAL.

This looks like the same family as existing bug-log item `SAS-AUD-20260602-001`.

### DOC-DRIFT - Shared-reader architecture claims are not consistently current

`docs/BUILD_PLAN_V4.md` says 4.0 has one reader living under `packages/reader-engine/` plus `app/components/Reader/`, imported by every mode and phone. Those folders do not exist. Current docs/code show a more mixed reality: `ChapterReader.js` is shared for Quill and some word-render behavior, `ProofingReader.js` still exists, and `SHARED_COMPONENTS.md` says Proof migration is pending while Prep/Duet intentionally use different readers.

This is probably a sub-case of `SAS-AUD-20260602-001`, but it is important because "one shared reader" is a core source goal.

### DOC-DRIFT - Several structure docs point to target or missing paths

`INTERNAL_FUNCTION_TREE.md` lists top-level `lib/transcriptionWorker.js`, `lib/manuscriptPaging.js`, `lib/pdfPaging.js`, and `lib/fuzzyMatcher.js`; actual files are under `app/lib/`. It also lists `packages/reader-engine` and `packages/exports` as target packages, but those folders are absent. `CLOUD_SAFETY_AUDIT.md` tells reviewers to inspect `supabase/`, but there is no `supabase/` directory. `CLOUD_SCHEMA.md` says "The four StJohn 4.0 tables" while describing six StJohn tables.

This is doc-drift, not a confirmed product bug.

### PASS WITH WATCHLIST - Fake sample-data risk

No active `sampleProjects`/mock product dataset was found in app/package code by static search. Hits were mostly docs/tests/placeholders. Two items need care:

- `app/components/LoginScreen.js` has a non-production "Dev - skip login (fake session)" button. It is gated by `process.env.NODE_ENV !== 'production'`, so I did not classify it as product fake data.
- `packages/cloud-sync/proof-sync.js` has a guard for an old `demo-book-1` cloudId. This appears to prevent a stale demo id from breaking sync, not to seed fake data.

Next auditors should not use the dev fake session for cloud, account-swap, or release proof.

### PASS WITH WATCHLIST - Cloud/audio safety docs broadly match code

Static search found Supabase `.from(...)` calls only for the six approved Proof/Quill tables in the checked paths. `packages/cloud-sync/client.js` has an allowed-table guard. `proof-sync.js` and `quill-sync.js` call `stripAudioPaths` before slimming/upload. I did not see `supabase.storage` or upload calls in the checked cloud/app paths.

This was not a full cloud audit and was not live-tested.

### WATCHLIST - Existing Save Data audit safety risk remains relevant

Existing bug-log item `SAS-AUD-20260530-001` says Electron dev runs can mirror audit data into `~/Documents/StJohn Author Studio/Save Data/books.json`. I did not run Electron or touch Save Data. Future live tests must keep using isolated `HOME=/tmp/...` until this is fixed or reclassified.

### PASS - Audit zones cover the app at a high level

The 11 zones cover source/docs, desktop shell/settings, all four desktop modes, phone Script, phone Quill, cloud/auth/audio/privacy/save/backups, exports/imports/release packages, and tests/scripts/hooks/coverage. I did not find an obvious major app area outside the zone list. Settings and backups are split across Zone 2 and Zone 9, which is acceptable but should be kept explicit in checker planning.

## What Was Not Tested

- No UI was launched.
- No Electron run.
- No browser run.
- No Supabase login or live cloud query.
- No phone device test.
- No exports/imports.
- No Save Data read/write verification.
- No package/release verification.
- No `npm test`, `npm run build`, or guardrails commands.

## Possible Duplicate Bug References

- Likely duplicate / expansion: `SAS-AUD-20260602-001 - App tree docs disagree about current mode status`.
- Related safety blocker: `SAS-AUD-20260530-001 - Electron dev run mirrors audit data into Documents`.
- Related watchlist context, not directly Zone 1: `SAS-AUD-20260602-002` and `SAS-AUD-20260602-003`.

No new bug-log item was written by Inspector A.

## Next Checks

- Checker should compare Inspector B/C reports before deciding whether to merge these doc-drift details into `SAS-AUD-20260602-001` or split out a smaller "shared-reader architecture docs are stale" doc item.
- Do a docs-only refresh later that separates historical plan targets from current app-tree truth.
- In Zone 2+, do not run Electron unless the save path is proven isolated from Marie's real Documents/Save Data.
- In Zone 9, perform the full cloud/audio safety audit separately; this Zone 1 pass only checked tree/doc alignment.
