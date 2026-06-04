# Inspector A - Zone 12 - Internal architecture

- Date: 2026-06-02 16:09:34 PDT
- Campaign: `2026-06-02-manual-start`
- Status: complete

## Scope

Read-only internal-architecture audit of shared readers, shared components,
cloud/client boundaries, IPC bridge ownership, and doc-to-tree drift. No
product code edits. No Electron launch. No real Save Data, real manuscript, or
real cloud mutation testing.

## Source docs checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/monitors/_run_state/inspector-a.lock.md`

## Commands run with exit codes

| Command | Exit |
|---|---:|
| `date -u +"%Y-%m-%dT%H:%M:%SZ"` | 0 |
| `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` | 0 |
| `sed -n '1,260p' docs/BUILD_PLAN_V4.md` | 0 |
| `sed -n '1,260p' docs/APP_STRUCTURE.md` | 0 |
| `sed -n '1,220p' docs/audits/monitors/_run_state/inspector-a.lock.md` | 0 |
| `find docs/audits/monitors -maxdepth 3 -type f \| sort` | 0 |
| `git status --short` | 0 |
| `sed -n '1,260p' docs/INTERNAL_FUNCTION_TREE.md` | 0 |
| `sed -n '1,260p' docs/FRONT_FUNCTION_TREE.md` | 0 |
| `sed -n '1,260p' docs/SHARED_COMPONENTS.md` | 0 |
| `sed -n '1,260p' docs/WIRING_MATRIX.md` | 0 |
| `rg --files app packages tests \| sort` | 0 |
| `wc -l app/page.js app/components/ProofingReader.js app/components/ChapterReader.js app/components/BookDetail.js app/components/ImportFlow.js app/components/ReaderChrome.js app/components/PrepManuscriptMode.js app/components/PrebuildMode.js app/components/QuillAndInkMode.js app/phone/page.js preload.js main.js` | 0 |
| `find packages -maxdepth 2 -type d \| sort` | 0 |
| `rg -n "getSupabaseClient\|createClient\(" app packages main.js preload.js` | 0 |
| `rg -n "ProofingReader\|ChapterReader\|PhoneReader\|renderReaderContent\|ReaderChrome\|BookDetail\|ImportFlow" app app/phone packages` | 0 |
| `sed -n '1,220p' preload.js` | 0 |
| `rg -n "ipcMain\\.handle\|contextBridge\\.exposeInMainWorld\|ipcRenderer\\.invoke\|window\\.electron\\." main.js preload.js app` | 0 |
| `npm test -- --test-reporter=spec` | 0 |
| `rg -n "\\.from\\(\|\\.auth\\." app packages` | 0 |
| `test -e packages/reader-engine; echo reader:$?; test -e packages/exports; echo exports:$?; test -d app/components/Reader; echo readerdir:$?` | 0 |
| `test -f .env.local; echo .env.local:$?; test -d "Script and Sync Releases"; echo releases_dir:$?; find "Script and Sync Releases" -maxdepth 3 \( -name '*.app' -o -name '*.exe' -o -name '*.zip' -o -name '*.dmg' \) 2>/dev/null \| sed -n '1,40p'` | 0 |

## Evidence paths

- `docs/BUILD_PLAN_V4.md:122-133`
- `docs/SHARED_COMPONENTS.md:3-15`
- `docs/SHARED_COMPONENTS.md:23-42`
- `app/components/ProofingReader.js:8-20`
- `app/components/ProofingReader.js:438-457`
- `app/components/ChapterReader.js:3-17`
- `app/components/ChapterReader.js:236-315`
- `app/phone/_components/PhoneReader.js:1-15`
- `app/phone/_components/PhoneReader.js:220-226`
- `app/phone/_components/renderReaderContent.js:1-79`
- `app/components/ManuscriptSetup.js:450-453`
- `app/components/ManuscriptSetup.js:968-980`
- `app/components/SessionsView.js:2403-2417`
- `app/components/PrebuildMode.js:5-7`
- `app/components/PrebuildMode.js:1155-1174`
- `app/components/PrepManuscriptMode.js:881-917`
- `app/components/QuillAndInkMode.js:20-26`
- `app/components/QuillAndInkMode.js:499-505`
- `app/components/QuillAndInkMode.js:540-552`
- `app/page.js:14-35`
- `app/page.js:577-609`
- `app/page.js:639-666`
- `app/phone/page.js:30-59`
- `app/phone/page.js:575-605`
- `app/phone/page.js:801-804`
- `app/phone/page.js:883-886`
- `app/phone/page.js:1520-1523`
- `app/phone/page.js:1653-1717`
- `packages/cloud-sync/client.js:1-79`
- `packages/cloud-sync/index.js:1-14`
- `preload.js:4-54`
- `main.js:1248-1457`
- `main.js:1472-1740`
- `main.js:1820-2046`

## Pass items

1. Shared component reuse is partly real. Proof uses `renderChapterBody()`
   from `ChapterReader`, Quill uses `ChapterReader` directly, Proof uses
   `ImportFlow` through `ManuscriptSetup`, and Duet/Quill both reuse the shared
   `SessionsView`/`BookDetail` layer instead of maintaining fully separate
   copies.
2. IPC ownership is consistent in the current tree. `preload.js` exposes the
   same bridge families that `main.js` handles for local data, exports, page
   maps, Whisper, and backups. I did not find orphaned exposed methods in this
   pass.
3. Cloud table access is still fenced inside `packages/cloud-sync/`. The app
   files call `getSupabaseClient()` and package helpers, but the `.from(...)`
   table calls remain inside `packages/cloud-sync/proof-sync.js` and
   `packages/cloud-sync/quill-sync.js`.
4. Read-only tests passed: `13` passed, `0` failed. `.env.local` exists.

## Fail items

1. The source-goal single-reader architecture is still not implemented as
   declared. `docs/BUILD_PLAN_V4.md` says the one shared reader should live in
   `packages/reader-engine/` plus `app/components/Reader/`, but neither path
   exists. The live tree still splits reader behavior across
   `app/components/ProofingReader.js`, `app/components/ChapterReader.js`, and
   `app/phone/_components/PhoneReader.js` plus its separate
   `renderReaderContent.js` walker. This keeps the repo in a mixed
   pre-migration state.
2. The shared-component rule is still bypassed in the book-detail layer.
   `docs/SHARED_COMPONENTS.md` says not to create fresh inline mode-specific
   copies, but Prep still defines an inline `BookDetailView()` inside
   `PrepManuscriptMode.js`, while Duet and Quill still adapt through legacy
   `SessionsView` wrappers (`ProofBookDetail`) instead of one clearly shared
   book-detail contract. That leaves three different book-detail shapes active
   in the same codebase.

## Watchlist items

1. Auth/session orchestration is duplicated across the desktop shell, phone
   shell, and Quill mode. `app/page.js`, `app/phone/page.js`, and
   `app/components/QuillAndInkMode.js` each call
   `supabase.auth.getSession()` and/or `supabase.auth.onAuthStateChange()`
   directly even though the shared cloud package already centralizes the client
   and account helpers. This is not a confirmed bug, but it weakens the
   "one cloud-sync path" goal and makes auth behavior easier to drift.
2. The test run emits repeated `[MODULE_TYPELESS_PACKAGE_JSON]` warnings for
   ESM-shaped files in `packages/cloud-sync/`, `packages/quill-engine/`, and
   `app/components/prepExport.js`. Nothing failed in this pass, but the current
   module posture is ambiguous and could become brittle as more tooling depends
   on explicit module mode.
3. File-size concentration remains high in core mode files:
   `app/phone/page.js` `3581` lines, `app/page.js` `2883`,
   `main.js` `2115`, `app/components/QuillAndInkMode.js` `2010`,
   `app/components/PrepManuscriptMode.js` `1835`,
   `app/components/PrebuildMode.js` `1458`, and
   `app/components/ProofingReader.js` `1468`. That is not a bug by itself, but
   it is a maintenance risk for the shared-architecture goal.

## What was not tested

- No live Electron launch.
- No packaged app launch.
- No phone browser/manual UI run.
- No real manuscript or audio imports.
- No real Save Data reads or writes.
- No live Supabase mutation or account-switch reproduction.
- No `npm run guardrails:check:all` or production build in this zone.

## Possible duplicate bug references

- `SAS-AUD-20260602-001` because this zone's shared-reader and shared-doc
  drift overlaps the existing doc-drift family around target-state vs
  present-state structure docs.
- `SAS-AUD-20260602-002` because the phone/Quill cloud path still shows a
  different safety shape from phone/Proof, and this zone confirms that the
  split is structural rather than just UI wording.

## Next checks

1. Inspector B and Inspector C should audit Zone 12 independently without using
   this report as source.
2. Zone Checker should decide whether the duplicated auth/session handling is
   only a watchlist architecture risk or whether another zone found a concrete
   user-facing failure tied to it.
3. If Inspector A wakes again and no higher-priority zone is reopened, the next
   safest target is `Tests, scripts, hooks, and coverage gaps`.
