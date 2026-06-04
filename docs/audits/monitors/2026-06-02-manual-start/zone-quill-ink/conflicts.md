# Conflict Ledger - Zone 5 Quill & Ink

The three inspectors agreed that Quill & Ink is a real current desktop mode
and that live desktop/cloud/export verification is still limited by the
read-only wall. The remaining differences were about whether specific static
Quill cleanup findings are confirmed bugs or only code-traced risks, and
whether the Quill docs mismatch needs a new bug or belongs under the existing
docs-drift family.

## Conflict 1 - Does deleting a Quill annotation also need to remove same-range character markers?

- Original Inspector A claim: deleting an edited Quill annotation can leave
  same-range character markers behind because the editor groups them on save
  but the delete path removes only `editingAnnotationId`.
- Original Inspector B claim: this looks like a code-traced risk that likely
  leaves stale character markers behind, but it was kept as a watchlist item
  pending checker follow-up.
- Original Inspector C claim: deleting from either the popover or bottom dock
  leaves attached character markers behind because both delete paths remove only
  one annotation id.
- Evidence:
  - `app/components/QuillAndInkMode.js:1456-1464`
  - `app/components/QuillAndInkMode.js:1484-1541`
  - `app/components/QuillAndInkMode.js:1545-1558`
  - `packages/quill-engine/annotations.js:121-152`
- Checker follow-up audit: confirmed the editor already treats same-range
  character markers as part of the current edit session and explicitly rebuilds
  them on save, but neither delete path mirrors that grouped cleanup.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-006`.
- Status: `resolved`
- Next check needed: safe isolated live Quill run that deletes an annotation
  with attached character markers from both delete entry points.

## Conflict 2 - Does removing a Quill chapter also need to prune that chapter's annotations?

- Original Inspector A claim: did not raise this as a failure.
- Original Inspector B claim: did not raise this as a failure.
- Original Inspector C claim: removing a chapter from Quill book detail leaves
  stale annotations for that removed chapter in the saved project, exports, and
  later cloud payloads.
- Evidence:
  - `app/components/QuillAndInkMode.js:821-828`
  - `app/components/QuillAndInkMode.js:891-948`
  - `app/components/QuillAndInkMode.js:961-969`
  - `packages/cloud-sync/quill-sync.js:111-123`
  - `packages/quill-engine/exporters.js:11-26`
- Checker follow-up audit: confirmed the `onUpdateBook` bridge filters kept
  chapters and audio by `keptIds`, but never filters `p.annotations`, so
  removed-chapter annotations can remain and later map to `chapter_id: null`
  on cloud push.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-007`.
- Status: `resolved`
- Next check needed: safe isolated live Quill run that removes an annotated
  chapter, then checks project state, exports, and cloud payload behavior.

## Conflict 3 - Is the Quill wiring/docs mismatch a separate Zone 5 bug or part of the existing docs-drift family?

- Original Inspector A claim: the Quill docs mismatch looks like doc drift and
  was kept as watchlist context only.
- Original Inspector B claim: the mismatch is a fail item because
  `docs/WIRING_MATRIX.md` still marks live Quill rows as `MISSING`.
- Original Inspector C claim: the mismatch is real, but it fits the broader
  docs-drift family already tracked elsewhere.
- Evidence:
  - `docs/FRONT_FUNCTION_TREE.md:73-82`
  - `docs/WIRING_MATRIX.md:68-75`
  - `docs/APP_STRUCTURE.md`
  - `app/components/QuillAndInkMode.js`
- Checker follow-up audit: confirmed the live Quill tree and the stale Quill
  wiring rows.
- Checker assessment: real docs drift, but it belongs under existing bug
  `SAS-AUD-20260602-001`.
- Status: `resolved`
- Next check needed: docs-only cleanup after the monitor pass.
