# Inspector C - Zone 12

## Scope

Independent read-only audit of Zone 12: internal architecture.

This run stayed static/read-only. I did not read Inspector A/B reports, did
not run Electron, did not run live cloud flows, and did not touch real Save
Data.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `CLAUDE.md`
- `TODO.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`

## Commands Run With Exit Codes

| Command | Exit |
|---|---:|
| `sed -n '1,220p' 'READ ME FIRST - OPEN THIS.txt'` | 0 |
| `sed -n '1,220p' HANDOFF.md` | 0 |
| `sed -n '1,220p' CLAUDE.md` | 0 |
| `sed -n '1,220p' TODO.md` | 0 |
| `sed -n '1,240p' docs/BUILD_PLAN_V4.md` | 0 |
| `sed -n '1,240p' docs/APP_STRUCTURE.md` | 0 |
| `sed -n '1,220p' docs/FRONT_FUNCTION_TREE.md` | 0 |
| `sed -n '1,220p' docs/INTERNAL_FUNCTION_TREE.md` | 0 |
| `sed -n '1,220p' docs/SHARED_COMPONENTS.md` | 0 |
| `sed -n '1,220p' docs/WIRING_MATRIX.md` | 0 |
| `sed -n '1,220p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| `sed -n '1,220p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` | 0 |
| `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `git status --short` | 0 |
| `if [ -f .env.local ]; then echo '.env.local exists'; else echo '.env.local missing'; fi` | 0 |
| `find docs/audits/monitors -name 'inspector-c.md' | sort` | 0 |
| `rg -n "createClient\\(|@supabase|supabaseUrl|supabaseAnon" app packages main.js preload.js app/lib` | 0 |
| `rg -n "ChapterReader|BookDetail|ImportFlow|ReaderChrome|PinnedTabPanel|ProofingReader|SessionsView|PhoneReader|renderReaderContent" app/components app/phone packages` | 0 |
| `rg -n "function .*Reader|const .*Reader\\s*=|<audio |wrapWords|buildWordSpans|renderChapterBody|getSentence\\(" app/components app/phone packages` | 0 |
| `find app/components app/phone packages -maxdepth 2 \\( -name '*Reader*.js' -o -name '*sync*.js' -o -name '*export*.js' -o -name '*Mode.js' \\) | sort` | 0 |
| `nl -ba app/components/ChapterReader.js | sed -n '1,260p'` | 0 |
| `nl -ba app/phone/_components/PhoneReader.js | sed -n '1,260p'` | 0 |
| `nl -ba app/phone/_components/renderReaderContent.js | sed -n '1,240p'` | 0 |
| `nl -ba app/components/ProofingReader.js | sed -n '118,170p;430,470p'` | 0 |
| `nl -ba app/components/QuillAndInkMode.js | sed -n '780,910p'` | 0 |
| `nl -ba app/components/PrebuildMode.js | sed -n '1090,1175p'` | 0 |
| `nl -ba app/components/PrepManuscriptMode.js | sed -n '680,980p'` | 0 |
| `nl -ba packages/cloud-sync/client.js | sed -n '1,120p'` | 0 |
| `rg -n "shared reader|ChapterReader|PhoneReader|SessionsView|BookDetailView|internal architecture|reader-engine|BookDetail" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start` | 0 |

## Evidence Paths

- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `CLAUDE.md`
- `docs/SHARED_COMPONENTS.md`
- `app/components/ChapterReader.js`
- `app/components/ProofingReader.js`
- `app/phone/_components/PhoneReader.js`
- `app/phone/_components/renderReaderContent.js`
- `app/components/QuillAndInkMode.js`
- `app/components/PrebuildMode.js`
- `app/components/PrepManuscriptMode.js`
- `packages/cloud-sync/client.js`

## Pass Items

1. Shared cloud access is centralized correctly.
   Evidence: the only `createClient(...)` hit in the app tree is
   `packages/cloud-sync/client.js:12,69`, and that file installs a table
   whitelist plus RPC block at `packages/cloud-sync/client.js:22-60`. I did
   not find any second Supabase client path in `app/`, `packages/`,
   `main.js`, `preload.js`, or `app/lib/`.

2. Desktop reader sharing is partially real now, not just planned.
   Evidence: `app/components/ChapterReader.js:1-260` owns the shared word
   walker and reader chrome; Quill imports it directly in
   `app/components/QuillAndInkMode.js:23-26` and renders it at
   `app/components/QuillAndInkMode.js:1653`; Proof reuses the shared body
   renderer via `renderChapterBody` and the shared DOM selector helper in
   `app/components/ProofingReader.js:438-457` instead of wrapping the
   manuscript DOM itself.

## Fail Items

1. The phone still runs on a separate reader implementation instead of the one
   shared reader required by the source goals.
   Evidence:
   - `docs/BUILD_PLAN_V4.md:22-24,128-133` says there should be one shared
     reader for desktop + phone.
   - `CLAUDE.md:97-106` says word-level modes, including the phone, should
     render through `app/components/ChapterReader.js`.
   - Current phone code does not import `ChapterReader`. It renders through a
     separate `PhoneReader` surface in `app/phone/_components/PhoneReader.js:1-260`
     and a separate HTML walker in
     `app/phone/_components/renderReaderContent.js:1-80`.
   - `ChapterReader.js:109-188` and `renderReaderContent.js:15-79` each keep
     their own token-walking/render path, so a fix to token boundaries,
     spacing, selection visuals, or HTML handling can still diverge between
     desktop and phone.

2. Quill and Duet still depend on Proof's `SessionsView` book-detail surface
   through adapter layers instead of using the declared shared `BookDetail`
   path.
   Evidence:
   - `CLAUDE.md:11-16` names `app/components/BookDetail.js` as the one book
     detail component per job.
   - `docs/SHARED_COMPONENTS.md:23-30,46-55` says shared components should be
     extended via props/slots rather than forked through mode-side copies and
     adapters.
   - Quill imports `ProofBookDetail` from `./SessionsView` at
     `app/components/QuillAndInkMode.js:22`, builds a Proof-shaped
     `adaptedBook` at `app/components/QuillAndInkMode.js:787-852`, and renders
     `<ProofBookDetail />` at `app/components/QuillAndInkMode.js:858-869`.
   - Duet does the same at `app/components/PrebuildMode.js:7,1098-1158`.
   - That adapter layer is already producing mode-specific bugs in adjacent
     zones: Quill chapter removal stale-annotation fallout
     (`SAS-AUD-20260602-007`) and Duet completion-state mismatch in the shared
     detail flow (`SAS-AUD-20260602-008`) both sit on this cross-mode
     translation surface.

## Watchlist Items

1. Prep still keeps large inline `BookDetailView` and `ReaderView` surfaces
   inside `app/components/PrepManuscriptMode.js` rather than moving more of the
   book-detail shell into shared components.
   Evidence: `app/components/PrepManuscriptMode.js:695-753` renders
   `BookDetailView` and `ReaderView`; `BookDetailView` starts at
   `app/components/PrepManuscriptMode.js:881`. Prep's dialogue-span reader is
   intentionally different, so this is architecture debt rather than a
   confirmed product bug, but it keeps one of the largest mode files owning its
   own full-page surfaces.

2. Proof still keeps local sentence-expansion logic even after switching its
   manuscript body to the shared renderer.
   Evidence: `app/components/ProofingReader.js:132-137` still owns
   `getSentence(...)`, while the phone separately keeps its own sentence/quote
   expansion path in `app/phone/page.js`. The shared body render is progress,
   but text-selection semantics are not fully centralized yet.

## What Was Not Tested

- No live Electron session.
- No real phone browser session.
- No real manuscript/audio/project files.
- No real Supabase sign-in or sync call.
- No `npm test`, `npm run build`, or packaging command in this zone.
- No Save Data read/write.
- No visual comparison between desktop and phone readers on the same chapter.

## Possible Duplicate Bug References

- The missing `packages/reader-engine` / one-reader plan drift is likely still
  part of the existing docs/source-map family under `SAS-AUD-20260602-001`.
  I did not treat that older doc-path mismatch as a new Zone 12 bug here.
- The Quill/Duet `SessionsView` adapter coupling looks like an architectural
  parent cause behind `SAS-AUD-20260602-007` and `SAS-AUD-20260602-008`,
  rather than a fully separate user-facing bug by itself. The checker/lead
  should decide whether to keep it as cross-zone architecture debt only or
  promote it into its own tracked item.

## Next Checks

- Compare desktop `ChapterReader` and phone `PhoneReader` on the same generated
  chapter to see whether selection, spacing, and heading handling still differ
  in visible behavior.
- Trace whether Quill or Duet can move from `SessionsView` adapters onto the
  shared `BookDetail` without reopening the already logged Quill and Duet
  regressions.
- If a repair pass is approved later, audit whether shared reader logic can own
  sentence expansion too, not just word rendering.
