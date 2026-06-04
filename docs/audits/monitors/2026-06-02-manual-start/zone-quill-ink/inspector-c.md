# Inspector C - Zone 6 - Quill & Ink

## Scope

Read-only audit of the desktop Quill & Ink mode only.

Focus:

- Local Quill persistence and Electron bridge wiring.
- Quill reader add/edit/delete annotation flows.
- Book-detail chapter edit/remove flow as it affects annotations.
- Export wiring for CSV, Word, and InDesign.
- Quill cloud push/pull paths and audio privacy boundaries.
- Existing Quill-targeted automated coverage.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| `sed -n '1,260p' docs/BUILD_PLAN_V4.md` | 0 |
| `sed -n '1,260p' docs/APP_STRUCTURE.md` | 0 |
| `sed -n '1,260p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `find docs/audits/monitors -maxdepth 3 -type f | sort` | 0 |
| `ls -ld docs/audits/monitors/2026-06-02-manual-start/zone-quill-ink` | 1 |
| `rg -n "Quill|annotation|InDesign|quill" app/components/QuillAndInkMode.js app/components/BookDetail.js app/components/ChapterReader.js packages/quill-engine packages/cloud-sync/quill-sync.js tests app/page.js main.js` | 0 |
| `rg -n "Quill|quill|annotation|InDesign" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start -g '!**/inspector-c.md'` | 0 |
| `rg -n "orphan|chapter remove|delete annotation|character marker|Attach characters|Quill.*delete|Quill.*chapter" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start` | 0 |
| `node --test tests/quill-exporters.test.mjs tests/cloud-slim.test.mjs` | 0 |
| `date '+%Y-%m-%d %H:%M:%S %Z'` | 0 |

## Evidence Paths

- `app/components/QuillAndInkMode.js`
- `app/components/ChapterReader.js`
- `app/components/BookDetail.js`
- `app/page.js`
- `main.js`
- `preload.js`
- `packages/cloud-sync/quill-sync.js`
- `packages/cloud-sync/cloud-slim.js`
- `packages/quill-engine/exporters.js`
- `tests/quill-exporters.test.mjs`
- `tests/cloud-slim.test.mjs`

## Pass

1. Quill is materially wired, not a placeholder.
   Evidence:
   - `app/page.js:1578-1600`
   - `app/components/QuillAndInkMode.js:483-568`, `677-740`, `770-1016`
   - `main.js:1312-1344`

2. Quill local persistence has a real full-project plus summary-list path through Electron IPC, which matches the current home/open behavior.
   Evidence:
   - `preload.js:14-18`
   - `main.js:238-239`, `974-1069`, `1312-1344`
   - `app/components/QuillAndInkMode.js:66-110`, `593-613`, `1125-1167`

3. Quill cloud push strips audio data before upload and slims duplicate chapter/alignment payloads into dedicated tables.
   Evidence:
   - `packages/cloud-sync/quill-sync.js:27-35`, `55-156`
   - `packages/cloud-sync/cloud-slim.js:84-100`
   - `tests/cloud-slim.test.mjs:6-55`

4. Quill export controls are all wired from book detail, and the targeted exporter tests passed in this run.
   Evidence:
   - `app/components/QuillAndInkMode.js:677-740`, `1004-1015`
   - `packages/quill-engine/exporters.js:11-32`, `61-71`, `606-682`
   - `tests/quill-exporters.test.mjs:39-109`
   - `node --test tests/quill-exporters.test.mjs tests/cloud-slim.test.mjs` exit `0`

## Fail

1. Deleting a Quill annotation leaves attached character markers behind.
   Why it fails:
   - The editor treats attached characters as parallel annotations on the same range, not as display-only metadata. `saveAnnotation()` recreates the main annotation plus one character annotation per selected character.
   - The delete paths only remove the clicked annotation id. They do not also remove same-range character markers created with it.
   - Result: a delete from the popover or bottom chip strip can leave orphaned character annotations still in the project, exports, and cloud payload.
   Evidence:
   - Attached character markers are created in parallel at `app/components/QuillAndInkMode.js:1518-1536`.
   - Edit-state loading already treats same-range character markers as tied to the main annotation at `app/components/QuillAndInkMode.js:1456-1464`.
   - Delete only filters one id at `app/components/QuillAndInkMode.js:1545-1558`.
   - The bottom annotation strip renders every annotation, including leftovers, at `app/components/QuillAndInkMode.js:1916-1984`.
   - CSV and InDesign exporters iterate the whole `project.annotations` array at `packages/quill-engine/exporters.js:11-26`, `61-71`.
   Impact:
   - Stale character markers can survive after the user believes the annotation is gone.
   - Exports and cloud sync can continue carrying those leftovers.

2. Removing a Quill chapter from book detail does not prune annotations that belong to the removed chapter.
   Why it fails:
   - The bridge back from `SessionsView` updates the kept chapter list, audio state, and transcript state, but it never filters `project.annotations` against the new `keptIds` set.
   - Result: annotations for a removed chapter can remain in the saved project.
   - On cloud push, those stale annotations can lose their chapter foreign key because `chapterIdByLocal.get(a.sectionId)` falls back to `null`.
   - CSV and JSX exporters still walk every annotation, so removed-chapter annotations can continue exporting with fallback titles/context.
   Evidence:
   - Kept chapter ids are computed at `app/components/QuillAndInkMode.js:907-947`, but no annotation cleanup is performed in that path.
   - Cloud push maps unknown chapter ids to `null` at `packages/cloud-sync/quill-sync.js:111-123`.
   - CSV exporter still emits every annotation at `packages/quill-engine/exporters.js:11-26`.
   - InDesign context fallback uses chapter id, chapter number, or the first remaining chapter at `packages/quill-engine/exporters.js:38-46`.
   Impact:
   - A removed chapter can leave behind stale annotations that still sync or export.
   - Cloud data can end up with detached Quill annotation rows.

## Watchlist

1. Quill mode comments are behind the live implementation.
   - `app/components/QuillAndInkMode.js:14-17` still says cloud sync is a separate later task, but the mode now pulls and pushes cloud data at `app/components/QuillAndInkMode.js:499-568`.
   - This is doc/code drift, not a separate product bug by itself.

2. Coverage is still narrow for Quill behavior.
   - The tests exercised here only cover exporter output and cloud slimming:
     `tests/quill-exporters.test.mjs` and `tests/cloud-slim.test.mjs`.
   - I did not find targeted coverage for grouped-character deletion, chapter removal cleanup, local/cloud merge edge cases, or Quill book-detail adapter flows.

3. Broader Quill status docs still drift from the live tree.
   - `docs/FRONT_FUNCTION_TREE.md` marks Quill controls real, while `docs/WIRING_MATRIX.md` still leaves Quill rows as `MISSING`.
   - This appears to be part of existing doc-drift bug `SAS-AUD-20260602-001`, not a new item.

## What Was Not Tested

- No live Electron launch.
- No real manuscript import.
- No real Save Data writes.
- No live Supabase account or two-device sync check.
- No live Word `.docx` open.
- No live InDesign `.jsx` execution.
- No phone Quill flow; that belongs to later phone zones.

## Possible Duplicate Bug References

- Existing likely overlap only for documentation drift:
  `SAS-AUD-20260602-001` in `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`.
- I did not find an existing logged bug for:
  - Quill grouped annotation delete leaving character markers behind.
  - Quill chapter removal leaving stale annotations behind.

## Next Checks

1. Zone checker should compare whether Inspectors A and B also saw the two Quill state-cleanup failures above.
2. A later safe live audit should verify both failures in an isolated Quill project:
   - add annotation + attached characters, then delete it;
   - annotate a chapter, remove that chapter from book detail, then inspect exports and cloud payload behavior.
3. Zone 8 and Zone 9 should specifically watch for how stale Quill annotations behave once phone/cloud flows are exercised live.
