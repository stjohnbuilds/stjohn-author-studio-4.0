# Conflict Ledger - Zone 4 Prep Manuscript

The three inspectors agreed that Prep Manuscript is a real current mode and
that live desktop/export verification is still limited by the read-only wall.
The remaining differences were about whether specific static findings are
confirmed bugs, overlapping docs drift, or risks that still need live proof.

## Conflict 1 - Does the Prep Fix/rescan flow misassign repeated dialogue lines?

- Original Inspector A claim: the Prep Fix rescan path can mis-assign repeated
  dialogue lines because it preserves assignments by `sp.text` only, so later
  duplicates can inherit the first duplicate's assignment.
- Original Inspector B claim: did not raise this as a failure.
- Original Inspector C claim: did not raise this as a failure.
- Evidence:
  - `app/components/PrepManuscriptMode.js:517-535`
  - `app/components/PrepManuscriptMode.js:561-579`
  - `tests/prep-export.test.mjs:120-213`
- Checker follow-up audit: confirmed `updateSectionHtml()` builds a map keyed by
  quote text only and reapplies the first prior assignment to every new span
  with the same text, even though the rest of the mode uses span position and
  the export tests already rely on occurrence-aware duplicate handling.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-005`.
- Status: `resolved`
- Next check needed: safe isolated live Prep run that edits a warning in a
  section with duplicate quotes assigned to different narrators.

## Conflict 2 - Is the Prep docs mismatch a separate Zone 4 bug or part of the existing docs-drift family?

- Original Inspector A claim: did not elevate the Prep docs mismatch as a new
  bug and treated it as related context only.
- Original Inspector B claim: the Prep section of `docs/WIRING_MATRIX.md`
  wrongly says the whole mode is missing even though current docs and code show
  a live implementation.
- Original Inspector C claim: the wiring matrix mismatch is real and the
  internal tree also still points at old helper paths around the same mode
  family.
- Evidence:
  - `docs/WIRING_MATRIX.md:49-57`
  - `docs/FRONT_FUNCTION_TREE.md:52-62`
  - `docs/INTERNAL_FUNCTION_TREE.md:32-35`
  - `docs/APP_STRUCTURE.md`
- Checker follow-up audit: confirmed both the stale Prep wiring rows and the
  stale `lib/...` helper-path references.
- Checker assessment: real docs drift, but it belongs under existing bug
  `SAS-AUD-20260602-001`.
- Status: `resolved`
- Next check needed: docs-only cleanup after the monitor pass.

## Conflict 3 - Does the Prep page-map handoff already break current page-number behavior?

- Original Inspector A claim: the initial import path drops `payload.pdfPageMap`
  and the post-import PDF upload rebuild path uses `ch?.html` even though Prep
  HTML currently lives under `sections[0].html`, so page-number handoff looks
  incomplete.
- Original Inspector B claim: did not raise this item.
- Original Inspector C claim: did not raise this item.
- Evidence:
  - `app/components/ImportFlow.js:513-530`
  - `app/components/PrepManuscriptMode.js:316-347`
  - `app/components/PrepManuscriptMode.js:923-959`
- Checker follow-up audit: confirmed the code mismatch, but did not find a
  current Prep reader/export consumer in this zone that reads
  `project.pdfPageMap`.
- Checker assessment: plausible bug, not confirmed enough to log yet.
- Status: `audit unclear`
- Next check needed: safe live Prep import plus post-import PDF upload to see
  whether any current page-number feature actually fails for users.
