# Inspector B - Zone 6 - Internal architecture

## Scope

- Static read-only audit of the internal architecture zone for campaign `2026-06-02-manual-start`.
- Focus: shared-reader direction, book-detail reuse, shared cloud/bridge boundaries, route shape, and current automated coverage around those seams.
- No product-code edits. No Save Data writes. No live Electron, phone, cloud, or export run.

## Source Docs Checked

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
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run With Exit Codes

- `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` -> `0`
- `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` -> `0`
- `sed -n '1,260p' docs/BUILD_PLAN_V4.md` -> `0`
- `sed -n '1,260p' docs/APP_STRUCTURE.md` -> `0`
- `sed -n '1,220p' docs/audits/monitors/_run_state/inspector-b.lock.md` -> `0`
- `rg --files docs/audits/monitors | sort` -> `0`
- `date '+%Y-%m-%d %H:%M:%S %Z'` -> `0`
- `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> `0`
- `git status --short` -> `0`
- `npm test -- --test-reporter=spec` -> `0`
- `printf '.env.local '; if [ -e .env.local ]; then echo exists; else echo missing; fi ...` -> `0`
- `sed -n '1,260p' docs/INTERNAL_FUNCTION_TREE.md && ... && sed -n '1,260p' docs/WIRING_MATRIX.md` -> `0`
- `rg --files packages | rg '^packages/reader-engine|^packages/audio-engine|^packages/manuscript-engine|^packages/cloud-sync|^packages/quill-engine|^packages/backups'` -> `0`
- `rg -n "createClient\\(|getSupabaseClient\\(|supabaseUrl|supabaseAnonKey" app packages main.js preload.js` -> `0`
- `rg -n "ProofingReader|ChapterReader|BookDetail|ImportFlow|ReaderChrome|PinnedTabPanel" app packages` -> `0`
- `find app -maxdepth 3 \\( -name 'page.js' -o -name 'layout.js' \\) | sort` -> `0`
- `rg -n "contextBridge|ipcRenderer|invoke\\(|on\\(|exposeInMainWorld|electronAPI|window\\.electron" preload.js main.js app packages` -> `0`
- `rg -n "reader-engine|ProofingReader|ChapterReader|PhoneReader|SessionsView|BookDetail|internal architecture|doc-drift" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` -> `0`
- `nl -ba app/page.js | sed -n '1,40p'; ...` -> `0`
- `nl -ba app/components/ProofingReader.js | sed -n '1,30p'; ...` -> `0`
- `nl -ba app/components/QuillAndInkMode.js | sed -n '18,30p'; ...` -> `0`
- `nl -ba app/components/PrebuildMode.js | sed -n '1,16p'; ...` -> `0`
- `nl -ba packages/cloud-sync/client.js | sed -n '1,120p'; ...` -> `0`
- `nl -ba app/components/ChapterReader.js | sed -n '1,120p'` -> `0`
- `find app/components -maxdepth 1 -type f | sort` -> `0`
- `nl -ba docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md | sed -n '600,690p'` -> `0`
- `nl -ba app/components/SessionsView.js | sed -n '1,40p'; ...` -> `0`
- `rg -n "renderReaderContent|PhoneReader" app/phone/page.js app/phone/_components app/phone/_lib` -> `0`
- `rg -n "SessionsView|BookDetail|PhoneReader|MODULE_TYPELESS|cloud guard|getSupabaseClient" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` -> `0`
- `nl -ba app/components/BookDetail.js | sed -n '1,80p'` -> `0`
- `sed -n '1,180p' 'READ ME FIRST - OPEN THIS.txt'` -> `0`
- `sed -n '1,200p' HANDOFF.md` -> `0`
- `sed -n '1,200p' CLAUDE.md` -> `0`
- `sed -n '1,220p' TODO.md` -> `0`
- `sed -n '1,120p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md && ... && sed -n '600,760p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> `0`
- `rg -n "ProofingReader|ChapterReader|PhoneReader|BookDetail|SessionsView|renderReaderContent" tests app/components app/phone/_components` -> `0`
- `find tests -maxdepth 2 -type f | sort` -> `0`
- `nl -ba app/components/PrepManuscriptMode.js | sed -n '688,706p'; ...` -> `0`
- `rg -n "ONE component per job|Book detail page|ChapterReader|ChapterRow|duplicate readers|don't write a new one" CLAUDE.md` -> `0`

## Evidence Paths

- `CLAUDE.md:5-13`
- `CLAUDE.md:29-38`
- `CLAUDE.md:99-104`
- `docs/BUILD_PLAN_V4.md:67-71`
- `docs/APP_STRUCTURE.md:18-25`
- `app/page.js:3-5`
- `app/page.js:1653-1654`
- `app/components/ChapterReader.js:3-17`
- `app/components/ChapterReader.js:97-109`
- `app/components/ProofingReader.js:8-20`
- `app/components/ProofingReader.js:438-445`
- `app/phone/_components/PhoneReader.js:1-20`
- `app/phone/_components/renderReaderContent.js:1-18`
- `app/components/BookDetail.js:3-16`
- `app/components/SessionsView.js:8-9`
- `app/components/SessionsView.js:492`
- `app/components/SessionsView.js:2403-2412`
- `app/components/QuillAndInkMode.js:21-23`
- `app/components/QuillAndInkMode.js:858-870`
- `app/components/PrebuildMode.js:5-7`
- `app/components/PrebuildMode.js:1155-1164`
- `app/components/PrepManuscriptMode.js:694-706`
- `app/components/PrepManuscriptMode.js:881-919`
- `packages/cloud-sync/client.js:1-79`
- `preload.js:4-54`
- `tests/cloud-error-message.test.mjs`
- `tests/cloud-slim.test.mjs`
- `tests/manuscript-engine.test.mjs`
- `tests/prep-export.test.mjs`
- `tests/quill-exporters.test.mjs`
- `tests/whisper-json.test.mjs`

## Pass Items

1. Shared cloud access is centralized and guarded. `packages/cloud-sync/client.js:1-79` exposes one cached Supabase client with a table whitelist and RPC block, and the current desktop/phone callers pull that client through `getSupabaseClient()` rather than instantiating ad hoc mode-specific clients.
2. The Electron boundary is still centralized in the preload bridge. `preload.js:4-54` exposes the filesystem/export/Whisper APIs through `window.electron`, and the app code reads those bridge methods rather than importing Electron directly into mode files.

## Fail Items

1. The shared-reader architecture is still split across multiple live implementations. The source goal says one shared reader direction (`docs/BUILD_PLAN_V4.md:67-71`, `docs/APP_STRUCTURE.md:18-25`, `CLAUDE.md:99-104`), but the current code still divides the work across desktop Proof shell code in `app/components/ProofingReader.js:8-20`, desktop shared body code in `app/components/ChapterReader.js:3-17`, and a separate phone renderer in `app/phone/_components/PhoneReader.js:1-20` plus `app/phone/_components/renderReaderContent.js:1-18`. No `packages/reader-engine/` package exists in the current tree. Expected impact: reader fixes still require coordinated changes across multiple surfaces, so desktop/phone parity can drift. Possible duplicate bug reference: `SAS-AUD-20260602-001` already covers the target/doc mismatch, but not this code-side split as a standalone bug item.
2. The book-detail surface is fragmented across three implementations instead of one. `CLAUDE.md:5-13` says the one book-detail component is `app/components/BookDetail.js`, but Proof still mounts `SessionsView` from `app/page.js:3-5`, `1653-1654`; Quill and Duet both import `ProofBookDetail` from `SessionsView` and adapt their data into it (`app/components/QuillAndInkMode.js:21-23`, `858-870`; `app/components/PrebuildMode.js:5-7`, `1155-1164`); and Prep still renders its own `BookDetailView` (`app/components/PrepManuscriptMode.js:694-706`, `881-919`). Expected impact: changes to chapter-list, header, paging-banner, and action-strip behavior still have multiple maintenance paths and can diverge mode by mode. Possible duplicate bug reference: none found in the live bug log; nearest overlap is the existing doc-drift family plus TODO comments about future Proof reader/detail consolidation.

## Watchlist Items

1. Coverage gap: this run found no targeted automated tests for reader-shell parity or book-detail reuse. The current test suite only contains cloud, manuscript, prep-export, Quill-exporter, and Whisper-json coverage (`tests/cloud-error-message.test.mjs`, `tests/cloud-slim.test.mjs`, `tests/manuscript-engine.test.mjs`, `tests/prep-export.test.mjs`, `tests/quill-exporters.test.mjs`, `tests/whisper-json.test.mjs`), and the reader/detail symbols only showed up in source files during the search pass. That means the architecture drift above is mostly guarded by manual discipline, not tests.
2. Low-severity packaging watchlist: `npm test -- --test-reporter=spec` passed, but it emitted `[MODULE_TYPELESS_PACKAGE_JSON]` warnings while loading ESM-style files from `packages/cloud-sync/`, `packages/quill-engine/`, and `app/components/prepExport.js`. This did not fail the run, but it does show mixed module-format boundaries that add avoidable runtime noise and overhead.

## What Was Not Tested

- No Electron UI launch.
- No live desktop navigation between Proof, Prep, Duet, or Quill screens.
- No live phone workflow.
- No real Save Data reads or writes.
- No real Supabase sign-in, pull, push, or delete.
- No live CSV, DOCX, JSX, ZIP, or package build verification beyond the existing tree checks.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` for the already logged shared-reader target/doc drift family.
- No exact existing bug-log item was found for the three-way book-detail split or the broader live reader split.

## Next Checks

1. In a safe isolated UI audit, compare one identical chapter across Proof desktop, Quill desktop, and phone to see whether sentence boundaries, word indexing, selection geometry, page cues, and narrator cues stay in parity across the split reader surfaces.
2. When the task switches from audit to repair, map a consolidation plan for book-detail surfaces first. Prep `BookDetailView`, Proof `SessionsView`, and the Quill/Duet adapters are the highest-leverage duplication seam found in this run.
3. Add targeted automated coverage for reader/body parity and shared book-detail behavior before any large reader/detail refactor, so architecture cleanup does not rely only on manual spot checks.
