# Inspector B - Zone 1 Source Goals And App Tree Drift

- Date: 2026-06-02
- Role: Inspector B
- Scope: read-only audit of source goals and app tree drift only.
- Product code changed: no.
- Real Save Data touched: no.
- Files written by this role: this report and `docs/audits/monitors/_run_state/inspector-b.lock.md`.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- Also checked for Zone 1 context: `READ ME FIRST - OPEN THIS.txt`, `HANDOFF.md`, `CLAUDE.md`, `TODO.md`, `docs/FRONT_FUNCTION_TREE.md`, `docs/INTERNAL_FUNCTION_TREE.md`, `docs/SHARED_COMPONENTS.md`, `docs/WIRING_MATRIX.md`, `docs/CLOUD_SCHEMA.md`, `docs/CLOUD_SAFETY_AUDIT.md`, `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, `package.json`.

## Commands Run

- `pwd` - exit 0.
- `git status --short` - exit 0. Output before audit writes: `M TODO.md`, `?? docs/audits/monitors/`.
- `sed -n ...` / `nl -ba ...` source-doc reads listed above - exit 0.
- `test -f docs/audits/monitors/_run_state/inspector-b.lock.md && sed ... || true` - exit 0; no existing lock content returned.
- `mkdir -p docs/audits/monitors/_run_state docs/audits/monitors/2026-06-02-manual-start/zone-source-goals-app-tree-drift` - exit 0.
- `rg --files app packages docs tests scripts supabase | sort` - exit 2 because `supabase/` is absent; other paths still printed.
- `find app -maxdepth 3 -type f | sort` - exit 0.
- `find packages -maxdepth 3 -type f | sort` - exit 0.
- `find tests -maxdepth 2 -type f | sort` - exit 0.
- `rg --files app packages docs tests scripts | sort` - exit 0.
- `rg -n "sample|fake|mock|demo|dummy|placeholder|Phase [0-9]|MISSING|not built|target layout|moving toward|packages/reader-engine|packages/exports|supabase/" docs app packages tests scripts package.json` - exit 0.
- `rg -n "ProofingReader|PrepManuscriptMode|PrebuildMode|QuillAndInkMode|PhoneReader|audioFolderMemory|packages/backups|pushProofProject|pushQuillProject|pullProofProjects|pullQuillProjects" ...` - exit 0.
- `rg -n "supabase\\.storage|storage\\.from|\\.from\\(['\"][^'\"]+['\"]\\)|\\.rpc\\(" app packages main.js preload.js` - exit 0.
- `rg -n "audioPath|audioPaths|audioBlob|audioUrl|audioBuffer|audioBytes|audioBase64|sourceAudioPath|sourceAudioBytes|audio_file_name|stripAudioPaths|slimBookForCloud|slimProjectForCloud" packages/cloud-sync app/phone app/page.js docs/CLOUD_SCHEMA.md docs/CLOUD_SAFETY_AUDIT.md` - exit 0.
- `rg -n "function AppModeToggle|const AppModeToggle|AppModeToggle|proof|prep-manuscript|prebuild|quill" app/page.js` - exit 0.
- `rg -n "readPrepData|writePrepData|readQuillData|writeQuillProject|exportMarkersFolder|makeBackupSnapshot|getBackupInfo|pruneBackups|chooseDataLocation|whisperTranscribe" main.js preload.js` - exit 0.
- `rg -n "inspector|zone|Audit Zones|Desktop shell|Proof Listen|Prep Manuscript|Duet Prep|Quill|Phone|Cloud|Exports|Tests" docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` - exit 0.
- `sed -n '1,140p' package.json` - exit 0.

## Evidence Paths

- Current app tree: `app/page.js`, `app/phone/page.js`, `app/components/PrepManuscriptMode.js`, `app/components/PrebuildMode.js`, `app/components/QuillAndInkMode.js`, `app/components/ProofingReader.js`.
- Shared/package tree: `packages/audio-engine/`, `packages/backups/`, `packages/cloud-sync/`, `packages/manuscript-engine/`, `packages/quill-engine/`.
- Phone tree: `app/phone/_components/PhoneReader.js`, `app/phone/_lib/audioFolderMemory.js`, `app/phone/_lib/audioLibrary.js`, `app/phone/_lib/projectCache.js`, `app/phone/_lib/readerSettings.js`.
- Tests present: `tests/cloud-error-message.test.mjs`, `tests/cloud-slim.test.mjs`, `tests/manuscript-engine.test.mjs`, `tests/prep-export.test.mjs`, `tests/quill-exporters.test.mjs`, `tests/whisper-json.test.mjs`.

## Findings

### Pass - Actual tree broadly matches the current app shape

The repo contains the four desktop modes and phone companion described by `docs/APP_STRUCTURE.md`: `app/page.js` imports Proof, Prep, Duet, and Quill mode components at lines 3-10 and renders those modes at lines 1518-1654. The phone route exists at `app/phone/page.js`, with shared phone reader/settings files under `app/phone/_components/`.

### Doc-Drift - `WIRING_MATRIX.md` is stale against the app tree

`docs/WIRING_MATRIX.md` still says the 4-mode switcher is "Phase 4 - not built" and `MISSING` at line 28. It also marks Prep, Duet, Quill, Phone Script, and Phone Quill rows as `MISSING` at lines 49-96. This conflicts with `docs/FRONT_FUNCTION_TREE.md`, which marks those areas real or partial at lines 24-108, and with the actual tree.

Possible duplicate: `SAS-AUD-20260602-001`.

### Doc-Drift - `BUILD_PLAN_V4.md` still reads like an early-phase plan

`docs/BUILD_PLAN_V4.md` says "Phase 1 in progress" at line 3, but the tree now contains later-phase components and packages. It also says the one reader lives under `packages/reader-engine/` plus `app/components/Reader/` at lines 128-129, but those paths were not present in the clean tree scan. Current shared-reader reality is closer to `docs/SHARED_COMPONENTS.md`: Quill uses `ChapterReader`, Proof still has `ProofingReader`, and Prep/Duet have different reader models.

Possible duplicate: `SAS-AUD-20260602-001`.

### Doc-Drift - brand/release source docs can cause old-build confusion

`READ ME FIRST - OPEN THIS.txt` starts with `AUDIoproofer 5.0` and says the code lives in `Script and Sync 3.0` at lines 1 and 6, while this audit is in `StJohn-Author-Studio-4.0`. The same file still tells users to open `Script and Sync.app` and Windows `Script and Sync` files at lines 29 and 35-49. This may be intentionally historical until packaging/rebrand is finished, but it is risky as a user-facing handoff doc.

### Watchlist - target architecture wording mixes actual and aspirational paths

`docs/INTERNAL_FUNCTION_TREE.md` has a "Today" section that matches the app better at lines 12-58, but its target section still lists missing/aspirational paths such as `packages/reader-engine`, `packages/exports`, route folders like `app/proof-listen/[id]/page.js`, and cloud names like `payload-guards` / `supabase-client` at lines 62-123. It is marked as target, so not a product bug, but future auditors could mistake those paths for current files.

### Watchlist - `APP_STRUCTURE.md` is mostly current but slightly behind phone files

`docs/APP_STRUCTURE.md` matches the main app tree well and covers backups, cloud-sync, manuscript, Quill, phone, and tests at lines 46-64. Its phone primary-file list at lines 156-164 does not include the newer `app/phone/_lib/audioFolderMemory.js`, even though TODO and the tree show that file exists.

### Pass With Static Evidence - cloud/audio safety docs match the current cloud path

Direct `.from(...)` scans found only the six approved tables in `packages/cloud-sync/proof-sync.js` and `packages/cloud-sync/quill-sync.js`. `packages/cloud-sync/client.js` hard-whitelists the same six tables at lines 22-37 and blocks RPC calls at lines 52-57. `packages/cloud-sync/audio-guard.js` strips audio path/blob/base64 keys at lines 12-24 and recursively strips them at lines 56-84. Proof and Quill push paths call `stripAudioPaths` before slimming/upload at `proof-sync.js` lines 46-57 and `quill-sync.js` lines 27-35.

This was static only. No live Supabase write/pull was tested.

### Pass / Watchlist - no product sample-data injection found in this zone

The fake/sample scan did not find app-level fake project arrays being loaded as product data. It did find a non-production `Dev - skip login (fake session)` button in `app/components/LoginScreen.js` lines 313-346 and a `demo-book-1` cleanup guard comment in `packages/cloud-sync/proof-sync.js` lines 36-41. The dev login path is explicitly guarded by `process.env.NODE_ENV !== 'production'`; still worth checking in packaged builds.

### Pass - audit zones cover the whole app at a high level

`docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` lists zones for shell/settings, all four desktop modes, both phone modes, cloud/auth/audio/save/backups, exports/imports/release confusion, and tests/scripts/hooks at lines 204-218. That covers the app tree found in this zone. Backups are not a separate zone, but they are included in Zone 9.

## What Was Not Tested

- No `npm test` run in this Inspector B pass; Zone 1 was static doc/tree comparison.
- No `npm run build`, guardrail run, Electron launch, browser test, packaged-app test, or live UI navigation.
- No Supabase live write/read, phone round-trip, offline queue, account swap, Drive snapshot, export, import, Whisper, Word, InDesign, or real-file test.
- No real Save Data was opened or changed.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` - same core documentation drift: build plan/wiring matrix/current tree disagree.
- `SAS-AUD-20260530-001` - not reproduced here; relevant only because it explains why no Electron/live save testing was done without an isolated `HOME`.
- `SAS-AUD-20260602-002` and `SAS-AUD-20260602-003` - seen in bug log but outside Zone 1 except as evidence that phone/cloud watchlist items already exist.

## Next Checks

- Checker should compare Inspector A/B/C for whether `READ ME FIRST - OPEN THIS.txt` old branding is in scope for the existing doc-drift bug or deserves a separate release-doc drift item.
- Refresh `WIRING_MATRIX.md` after the monitor campaign, keeping verified-live blank where Marie has not tested real files.
- Decide whether `BUILD_PLAN_V4.md` should remain historical or gain a clear "current implementation status" note.
- In later zones, verify the dev fake-login button is absent from production/package builds.
- In Zone 9, live-test the static cloud/audio assumptions with safe generated data and isolated environment only.
