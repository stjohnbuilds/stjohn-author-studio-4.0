# Conflict Ledger - Zone 11 Duet Prep

The three inspectors agreed that Duet Prep is a real current desktop mode and
that live desktop/export verification is still limited by the read-only wall.
The remaining differences were about whether specific static Duet findings are
confirmed bugs, likely risks, or docs-only overlap.

## Conflict 1 - Does a successful Duet scan also mark the shared chapter list complete?

- Original Inspector A claim: Duet's shared book-detail completion fallback
  appears to read the wrong property after a successful scan, so scanned
  chapters may still show incomplete unless Marie manually toggles completion.
- Original Inspector B claim: this is a confirmed code-traced implementation
  bug because the scan path writes `transcribed: true` while the adapter falls
  back to `!!ch.scanned`.
- Original Inspector C claim: did not raise this as a failure.
- Evidence:
  - `app/components/PrebuildMode.js:505-515`
  - `app/components/PrebuildMode.js:766-805`
  - `app/components/PrebuildMode.js:1129-1143`
  - `app/components/SessionsView.js:518-520`, `2826-2829`, `3098-3100`
- Checker follow-up audit: confirmed that Duet scan state is tracked via
  `transcribed`, the scan path sets `transcribed: true`, and no scanned Duet
  path writes `scanned`, yet the shared book-detail adapter still falls back to
  `!!ch.scanned` for `completed`.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-008`.
- Status: `resolved`
- Next check needed: safe isolated live Duet run that scans one chapter and
  confirms the shared completion count and checkbox update automatically.

## Conflict 2 - Can Duet marker export emit invalid `...1000` millisecond start times?

- Original Inspector A claim: did not raise this as a failure.
- Original Inspector B claim: did not raise this as a failure.
- Original Inspector C claim: the Audition marker formatter can output invalid
  `...1000` millisecond values because it rounds milliseconds without carrying
  overflow into the next second.
- Evidence:
  - `app/components/PrebuildMode.js:196-204`
  - `app/components/PrebuildMode.js:941-965`
  - Read-only reproduction output:
    - `61.9996 => 1:01.1000`
    - `3599.9996 => 59:59.1000`
- Checker follow-up audit: confirmed the formatter behavior directly and
  confirmed the export path writes the formatter result into the marker `Start`
  column without a later normalization step.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-009`.
- Status: `resolved`
- Next check needed: safe isolated live export that includes a boundary-case
  marker time and verifies the emitted start string stays valid.

## Conflict 3 - Is manuscript re-upload by chapter position a confirmed bug or only a likely risk?

- Original Inspector A claim: manuscript re-upload preserves audio and
  alignment by chapter position only, which can mis-attach old data if chapter
  order or split structure changes.
- Original Inspector B claim: the re-upload path keeps prior audio and scan
  data by position only, so corrected manuscripts that insert, remove, or shift
  split scenes can move old data onto the wrong chapter entry.
- Original Inspector C claim: did not raise this as a failure.
- Evidence:
  - `app/components/PrebuildMode.js:1017-1030`
- Checker follow-up audit: confirmed the current code matches new chapters to
  old chapters by array index and copies prior audio/transcription state from
  that positional match.
- Checker assessment: likely risk, not a confirmed bug yet. The code path is
  brittle, but this checker pass did not prove a present user-facing failure,
  and the source comment still frames the path as same-order manuscript
  replacement.
- Status: `likely`
- Next check needed: safe manuscript re-upload test where split scenes are
  inserted, removed, or reordered so the carry-over behavior can be observed
  directly.

## Conflict 4 - Is the Duet wiring/docs mismatch a separate Zone 11 bug or part of the existing docs-drift family?

- Original Inspector A claim: the Duet docs mismatch is doc drift and not a
  confirmed product failure.
- Original Inspector B claim: the mismatch is a fail item because
  `docs/WIRING_MATRIX.md` still marks the Duet rows missing.
- Original Inspector C claim: the mismatch is real, but it fits the broader
  docs-drift family rather than needing a Duet-specific bug.
- Evidence:
  - `docs/FRONT_FUNCTION_TREE.md:64-71`
  - `docs/WIRING_MATRIX.md:59-66`
  - `app/components/PrebuildMode.js`
- Checker follow-up audit: confirmed the live Duet source tree and the stale
  Duet rows in the wiring docs.
- Checker assessment: real docs drift, but it belongs under existing bug
  `SAS-AUD-20260602-001`.
- Status: `resolved`
- Next check needed: docs-only cleanup after the monitor pass.
