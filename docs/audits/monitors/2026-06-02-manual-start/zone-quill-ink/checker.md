# Zone Checker - Zone 5 Quill & Ink

- Date/time: 2026-06-02 14:33 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for the Quill & Ink zone only; preserve disagreements; run focused read-only follow-up where needed; dedupe before touching the master report or bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-quill-ink/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-quill-ink/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-quill-ink/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main disagreements around:

- `app/components/QuillAndInkMode.js`
- `packages/quill-engine/exporters.js`
- `packages/cloud-sync/quill-sync.js`
- `docs/WIRING_MATRIX.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p'` on the three Zone 5 inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba app/components/QuillAndInkMode.js \| sed -n '780,860p'`, `860,940p`, `1448,1565p`, `1888,1998p` | 0 |
| `nl -ba packages/quill-engine/exporters.js \| sed -n '1,110p'` | 0 |
| `nl -ba packages/cloud-sync/quill-sync.js \| sed -n '90,140p'` | 0 |
| `rg -n "chapter remove\|remove.*chapter\|keptIds\|characterIds\|deleteEditingAnnotation\|deleteAnnotation"` across Quill source, tests, bug log, and report | 0 |

## Merged Findings

### PASS - Quill & Ink remains a real desktop mode with import, reader, export, and cloud wiring

All three inspectors agreed on the baseline shape, and the checker follow-up
did not find a contradiction:

- Quill routes from the main shell into a real desktop mode.
- The mode adapts the shared book-detail flow, opens a chapter reader, and
  persists projects through the Electron Quill IPC path.
- Quill export wiring exists for CSV, Word, InDesign, backup zip, and raw JSON.
- Quill cloud push still strips audio paths before upload.

Evidence:

- `app/page.js:1578-1600`
- `app/components/QuillAndInkMode.js:677-740`, `786-948`, `1183-1990`
- `preload.js:14-18`
- `main.js:1312-1344`
- `packages/cloud-sync/quill-sync.js:27-156`
- `tests/quill-exporters.test.mjs:39-109`
- `tests/cloud-slim.test.mjs:6-55`

### CONFIRMED BUG - Deleting a Quill annotation can leave same-range character markers behind

Inspectors A and C raised this as a fail item, while Inspector B kept it as a
watchlist risk. The checker follow-up confirms the current logic:

- `openExistingAnnotation()` preloads same-range character markers into the
  current edit session.
- `saveAnnotation()` explicitly removes and rebuilds those same-range marker
  companions as one grouped edit operation.
- Both delete paths remove only the clicked annotation id and do not mirror
  the grouped cleanup used on save.

Checker assessment: this is a confirmed Quill state-cleanup bug, not just a
coverage gap. If Marie deletes an annotation that had attached characters, the
main annotation can disappear while same-range character markers remain in the
project, the bottom annotation dock, exports, and later cloud payloads.

Evidence:

- `app/components/QuillAndInkMode.js:1456-1464`
- `app/components/QuillAndInkMode.js:1484-1541`
- `app/components/QuillAndInkMode.js:1545-1558`
- `app/components/QuillAndInkMode.js:1916-1984`
- `packages/quill-engine/annotations.js:121-152`
- `packages/quill-engine/exporters.js:11-26`, `61-71`

### CONFIRMED BUG - Removing a Quill chapter can leave stale annotations that still export or sync

Only Inspector C raised this as a fail item. The checker follow-up confirms
the current handoff:

- The book-detail adapter feeds chapter-specific annotations into the shared
  chapter editor.
- When the editor sends back a reduced chapter list, Quill filters kept
  chapters and dropped audio entries by `keptIds`.
- That same update path never filters `p.annotations` for removed chapter ids.
- Later cloud push maps any annotation whose `sectionId` no longer matches a
  kept chapter to `chapter_id: null`, and the exporters still iterate the full
  remaining annotations array.

Checker assessment: this is a confirmed Quill cleanup bug. Removing a chapter
from book detail can leave stale annotations behind, and those leftovers can
still appear in exports or sync detached from the removed chapter.

Evidence:

- `app/components/QuillAndInkMode.js:821-828`
- `app/components/QuillAndInkMode.js:891-948`
- `app/components/QuillAndInkMode.js:961-969`
- `packages/cloud-sync/quill-sync.js:111-123`
- `packages/quill-engine/exporters.js:11-26`, `38-46`, `61-71`

### RESOLVED - Quill wiring/doc mismatch belongs under the existing docs-drift bug

All three inspectors saw the Quill docs mismatch, but they did not agree on
whether it was a fail item or only context. The checker follow-up confirms the
drift is real, but it overlaps the existing documentation-drift bug rather than
needing a new Quill-specific docs entry:

- `docs/FRONT_FUNCTION_TREE.md` marks Quill desktop flows `REAL`.
- `docs/WIRING_MATRIX.md` still marks the same Quill rows `MISSING`.
- The current source tree has live Quill mode files and exporter/cloud wiring.

Checker assessment: update existing bug `SAS-AUD-20260602-001` with this
Quill-specific evidence; do not create a separate docs bug for Zone 5.

Evidence:

- `docs/FRONT_FUNCTION_TREE.md:73-82`
- `docs/WIRING_MATRIX.md:68-75`
- `docs/APP_STRUCTURE.md`
- `app/components/QuillAndInkMode.js`
- `packages/quill-engine/exporters.js`

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: searched existing items and found
  no matching Quill grouped-delete or chapter-removal cleanup bug, so two new
  bug-log entries were needed.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed the Quill wiring/docs
  mismatch overlaps existing item `SAS-AUD-20260602-001`, so that item was
  updated instead of adding a duplicate docs bug.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: found no checked Quill zone
  entry yet, so this run appends one new checker section rather than
  duplicating an older Quill result.
- Existing environment blocker `SAS-AUD-20260530-001` still covers the audit
  safety rules for any future live Electron Quill run, so no new blocker was
  added in this static checker pass.

## Overall Assessment

- Zone status: checked
- Audit result: two new confirmed Quill cleanup bugs; existing docs-drift bug
  expanded with Quill-specific evidence
- Confidence: medium-high
- Why not higher: the zone stayed static/read-only, so no live Electron Quill
  session, live export open-check, or live Supabase verification was run

## Next Steps

- Reproduce the grouped-delete bug later inside an isolated safe Quill desktop
  run by adding an annotation with attached character markers, then deleting it
  from both the popover and the bottom dock.
- Reproduce the chapter-removal cleanup bug later inside an isolated safe
  Quill desktop run by annotating a chapter, removing that chapter from book
  detail, then checking saved state, exports, and cloud payload shape.
- Add targeted tests later for grouped delete, chapter-removal cleanup, and the
  Quill Word export path when the task switches from audit to repair.
- The next zone-checker run should move to the first later zone where all three
  inspector reports exist and no `checker.md` exists, which is now Duet Prep.
