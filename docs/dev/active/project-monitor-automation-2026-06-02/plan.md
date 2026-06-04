# Project Monitor Automation Plan - StJohn Author Studio 4.0

Source goals checked before writing:

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
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Goal

Set up a read-only project monitor that repeatedly audits the app's health,
feature wiring, data safety, cloud safety, phone behavior, exports, and release
readiness.

The monitor may run tests, inspect code, use generated audit files, and drive
safe test accounts. It must not fix code during the audit.

## Non-Negotiable Rules

- Product code is read-only.
- Marie's real `Save Data/` is protected.
- Audit artifacts belong under `docs/audits/artifacts/`.
- The only allowed file edits are audit docs, monitor reports, and bug-log
  updates.
- Audio must never be uploaded to Supabase.
- Generated files are allowed for button and export checks.
- Real manuscript/audio proof must be labelled as Marie-only unless Marie gives
  a package.
- Overlapping bugs must update the existing bug entry instead of creating a
  duplicate.
- If the monitor hits context or time limits, it pauses with the exact next
  step, open questions, and files already checked.

## Step 1 - Re-check Goals And Structure

What to do:

- Read the source-goal docs and app tree docs.
- Read the existing audit runbook and bug log.
- Check git status before any report edit.

What to verify:

- The monitor is testing the real 4.0 goals: shared reader direction, shared
  audio, shared manuscript, shared cloud sync, no fake product data, audio
  privacy, and real-file verification.

Before moving on:

- Re-check source goals and `docs/APP_STRUCTURE.md`.

## Step 2 - Split The App Into Audit Zones

What to do:

- Assign separate read-only agents to:
  - Source goals and app tree drift.
  - Desktop modes.
  - Phone companion.
  - Cloud, save data, backups, and audio privacy.
  - Existing tests, scripts, and prior audit patterns.
  - Bug-log organization.

What to verify:

- Each agent has a narrow job and does not duplicate another agent's work.
- No agent is asked to fix code.

Before moving on:

- Re-check source goals and `docs/APP_STRUCTURE.md`.

## Step 3 - Run The Safe Health Checks

What to do:

- Run the test suite.
- Run build/guardrail checks where useful.
- Inspect hooks and audit logs.
- Use generated manuscripts/audio for safe import/export checks.
- Use isolated Electron runs only with a temp `HOME`.

What to verify:

- Test result, command, exit code, and date are recorded.
- Any live test states what account/data was used.
- Any untested area is labelled honestly.

Before moving on:

- Re-check source goals and `docs/APP_STRUCTURE.md`.

## Step 4 - Update One Organized Report

What to do:

- Write findings into the monitor report.
- Search existing bug IDs before adding any new item.
- Append new evidence to old bugs when the user-facing failure overlaps.

What to verify:

- The bug log is grouped by severity and area.
- Each finding says whether it was live-tested, code-traced only, blocked, or
  unknown.

Before moving on:

- Re-check source goals and `docs/APP_STRUCTURE.md`.

## Step 5 - Schedule Recurring Monitor Runs

What to do:

- Create a recurring Codex automation that runs this read-only audit cycle.
- Keep the prompt self-contained so it can continue even after chat context is
  gone.
- Report only meaningful changes, failures, new evidence, or blocked checks.

What to verify:

- The automation points at the StJohn workspace.
- The automation prompt repeats the read-only rule and bug dedupe rule.

Before moving on:

- Re-check source goals and `docs/APP_STRUCTURE.md`.

## Step 6 - Give Marie A Reusable Prompt For Other Apps

What to do:

- Create a copy-paste instruction file for another app monitor.
- Keep it generic enough for Typing and Tomes or any future app.

What to verify:

- The prompt tells the other automation to read that app's source goals first.
- It has the same read-only, safe-account, organized-bug-log, and pause-on-limit
  rules.

Before closing:

- Ask Marie before archiving or closing this plan.

## Step 7 - Web-Informed Logic Hardening

What to do:

- Compare the monitor design against current multi-agent/orchestration and
  agent-evaluation guidance.
- Check for obvious bot failure modes: drift, duplicate bugs, runaway scope,
  unclear manager, missing evidence, missing human gates, and no endpoint.
- Update the source-of-truth anchor and other-app prompt with any missing
  guardrails.

What to verify:

- The Lead Monitor owns synthesis and dedupe.
- Worker agents have narrow zones.
- Every finding needs evidence.
- Real data and destructive actions are human-gated.
- The automation has a bounded run count.

Before moving on:

- Re-check source goals and structure docs.

## Step 8 - Prepare Fix Strategy Queue

What to do:

- Create a read-only fix strategy queue.
- For confirmed bugs and strong watchlist risks, create cards with possible
  approaches, recommended approach, likely files, edge cases, tests, and Marie
  approval needed.
- Keep fix planning separate from code fixing.

What to verify:

- No product code is edited.
- The queue makes future approved fixes faster.
- The queue does not mark anything fixed.

Before moving on:

- Re-check source goals and structure docs.

## Step 9 - Fix Roadmap Block By Block

Added 2026-06-03 after Marie asked for a most-important-to-least block list
of the audit findings.

This step orders confirmed and watchlist findings into 12 blocks. Each block
maps to existing items in `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md` and the
source bug IDs in `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`.

Hard rule: this is planning only. No product code may be edited until Marie
approves a separate fix task for that block. Per-block approval, not bulk.

Live-test gates: blocks marked `needs-proof` must run their safe live or
account test before any code edit.

### Block 1 - Cloud honesty (top priority)

- Why first: Three confirmed P1 cloud-integrity bugs that can quietly hide
  partial saves, partial backups, or partial Quill pushes from Marie. These
  are the riskiest items in the report because Marie cannot see them go
  wrong.
- Bugs covered: `SAS-AUD-20260602-010`, `SAS-AUD-20260602-011`,
  `SAS-AUD-20260602-012`
- Roadmap items: `8.1`, `8.2`, `8.3`
- Likely files:
  - `packages/cloud-sync/proof-sync.js`
  - `packages/cloud-sync/quill-sync.js`
  - `packages/backups/index.js`
  - `main.js`
- Approach summary: Add explicit error checks on each required secondary
  Supabase query before treating a pull, push, or snapshot as successful.
  Backup manifest must say `partial-or-failed` when any cloud read failed.
  Quill push must withhold the success hash until every required cloud step
  succeeds.
- Will this fix it: Yes if every required secondary query path (transcriptions,
  flags, chapters, annotations, chapter-id lookup, prunes) is covered. Risk
  of regression on the happy path is low if empty result sets are kept
  distinct from query errors.
- Verification before approval: run the verification prompt against the
  listed files; require a second AI to trace every fix point.

### Block 2 - Cross-device delete

- Why next: One confirmed P1 bug. Deleting a Proof book or Quill project on
  Device A may not remove it from Device B and can quietly re-upload it. Same
  surface area as Block 1.
- Bugs covered: `SAS-AUD-20260602-013`
- Roadmap items: `8.4`
- Likely files:
  - `app/page.js`
  - `app/components/QuillAndInkMode.js`
  - `packages/cloud-sync/tombstones.js`
- Approach summary: Treat cloud-owned local projects missing from a
  successful cloud pull as remotely deleted. Protect local-only drafts that
  never synced (no `cloudId`). Failed pulls must not delete anything.
- Will this fix it: Yes if the rule distinguishes empty successful pulls
  from failed pulls and respects local-only drafts.
- Verification before approval: require the second AI to walk the four
  edge cases listed in fix item 8.4 (signed out, draft survival, failed pull,
  tombstoned delete).

### Block 3 - Lock down file access (release blocker)

- Why next: Three confirmed P0 security/path-boundary bugs. Must be closed
  before any external release.
- Bugs covered: `SAS-AUD-20260602-015`, `SAS-AUD-20260602-016`,
  `SAS-AUD-20260602-017`
- Roadmap items: `10.1`, `10.2`, `10.3`
- Likely files:
  - `main.js`
  - `preload.js`
  - `app/page.js`
  - `app/lib/manuscriptPaging.js`
- Approach summary: Re-enable `webSecurity` and run the audio bridge against
  a main-process allowlist of user-chosen audio paths. Reject `..` segments
  during transfer import. Regenerate unsafe imported book ids and add a root
  check before every manuscript-source path operation.
- Will this fix it: Yes if (a) the allowlist is enforced inside `main.js`,
  (b) `path.resolve` is followed by an `assertInside(root, resolved)` check
  on every save/read/rescan, and (c) old transfer/backup compatibility is
  kept where Marie wants it.
- Verification before approval: require the second AI to write at least one
  crafted-input scenario per bug that exercises the boundary, then confirm
  the proposed fix would block it.

### Block 4 - Quill cleanup leftovers

- Why next: Two confirmed Quill bugs where delete and chapter-removal leave
  hidden data that can still export or sync.
- Bugs covered: `SAS-AUD-20260602-006`, `SAS-AUD-20260602-007`
- Roadmap items: `6.1`, `6.2`
- Likely files:
  - `app/components/QuillAndInkMode.js`
  - `packages/quill-engine/annotations.js`
  - `packages/quill-engine/exporters.js`
  - `packages/cloud-sync/quill-sync.js`
- Approach summary: Add a shared bundle helper that identifies an annotation
  plus its same-range character markers. Use it in load, save, popover
  delete, and dock delete. Also filter `p.annotations` against kept chapter
  ids in the `onUpdateBook` bridge, preserving reorder/rename.
- Will this fix it: Yes if the bundle helper is reused by both delete
  entry points, and the chapter filter distinguishes true removal from
  reorder.
- Verification before approval: require the second AI to trace both delete
  paths in `QuillAndInkMode.js` lines 1456-1558 and 1916-1984 and confirm
  the helper would cover both.

### Block 5 - Prep duplicate-line voices

- Why next: One confirmed P1 bug. Repeated identical dialogue lines lose
  their per-occurrence speaker/side-voice after the Fix/rescan flow.
- Bugs covered: `SAS-AUD-20260602-005`
- Roadmap items: `5.1`
- Likely files:
  - `app/components/PrepManuscriptMode.js`
  - `tests/prep-export.test.mjs`
- Approach summary: Change `updateSectionHtml()` so prior assignments are
  preserved by nearby context and span position, falling back to occurrence
  count when context changed. Never reuse the same old span for two new
  duplicates.
- Will this fix it: Yes if the merge map is keyed by occurrence (or context
  + occurrence), not by quote text alone.
- Verification before approval: require the second AI to trace
  `PrepManuscriptMode.js:517-579` and confirm the proposed key shape covers
  the edge case where Marie edits text before the first duplicate.

### Block 6 - Duet completion and export math

- Why next: Two confirmed Duet bugs. Scan completion does not feed the
  shared chapter list, and marker export can emit invalid `...1000` ms times.
- Bugs covered: `SAS-AUD-20260602-008`, `SAS-AUD-20260602-009`
- Roadmap items: `7.1`, `7.2`
- Likely files:
  - `app/components/PrebuildMode.js`
  - `app/components/SessionsView.js`
- Approach summary: Make the shared completion fallback read both
  `transcribed` and `scanned` while preserving Marie's manual override.
  Normalize total milliseconds first in `formatAuditionTime()` so 999.6 ms
  carries to the next second instead of becoming `1000`.
- Will this fix it: Yes if the new formatter uses
  `totalMs = Math.round(seconds * 1000)` then derives the parts from
  `totalMs`, and if the completion fallback does not regress Proof Listen
  semantics.
- Verification before approval: require the second AI to confirm that
  `scanned` has no separate meaning in Proof flows.

### Block 7 - Wording tidy (quick wins)

- Why next: Three small bugs that are pure label/wording changes. Safest
  block to ship early.
- Bugs covered: `SAS-AUD-20260602-004`, `SAS-AUD-20260602-014`,
  `SAS-AUD-20260602-019`
- Roadmap items: `3.3`, `4.2`, `11.1`
- Likely files:
  - `app/components/SessionsView.js`
  - `app/components/ProofingReader.js`
  - `app/page.js`
  - `main.js`
  - `app/phone/page.js`
- Approach summary: Rename the Proof CSV column from `Note` to
  `Misread Quote`. Rebrand backup/transfer filenames, README copy, and
  manifest defaults to `StJohn Author Studio`, while keeping
  legacy-bundle import accepted. Make the Phone Quill no-match guidance
  match the actual picker path (back-to-chapter-list, or enable reader-side
  pick).
- Will this fix it: Yes for the Proof rename and rebrand. The Phone Quill
  copy fix needs Marie to pick which message direction she wants.
- Verification before approval: require the second AI to confirm the
  desktop book export, desktop reader export, desktop reader preview, and
  phone Proof CSV all share the same header list after the rename.

### Block 8 - Phone safety items (test first, then fix)

- Why this position: Five phone/watchlist items that should not be code-fixed
  before a safe live or account test reproduces the failure. The audit
  classifies all of these as `needs-proof`.
- Bugs covered: `SAS-AUD-20260602-002`, `SAS-AUD-20260602-003`,
  `SAS-AUD-20260602-018`, `SAS-AUD-20260602-020`, plus Duet re-upload
  watchlist (no bug id yet)
- Roadmap items: `2.1`, `2.2`, `2.3`, `2.4`, `7.3`
- Likely files:
  - `app/phone/page.js`
  - `app/phone/_lib/projectCache.js`
  - `packages/cloud-sync/flag-queue.js`
  - `packages/cloud-sync/quill-sync.js`
  - `app/components/PrebuildMode.js`
- Approach summary (after live proof): user-scope the pending Proof flag
  queue keys. Treat successful empty cloud pulls as authoritative for both
  Phone Script and Phone Quill caches. Add an offline pending state for
  Phone Quill. Match Duet re-upload carry-over by stable chapter identity,
  not array index.
- Will this fix it: Yes for each item once the live repro confirms the
  scenario. No code change before proof.
- Verification before approval: require the second AI to write the safe
  live test plan per item before any code is touched.

### Block 9 - Keyboard and screen-reader friendliness

- Why this position: Three confirmed accessibility bugs across overlays,
  reader word actions, and icon/disclosure controls. Medium effort, lower
  data-safety risk.
- Bugs covered: `SAS-AUD-20260602-021`, `SAS-AUD-20260602-022`,
  `SAS-AUD-20260602-023`
- Roadmap items: `12.1`, `12.2`, `12.3`
- Likely files:
  - `app/page.js`
  - `app/components/PrebuildMode.js`
  - `app/components/PrepManuscriptMode.js`
  - `app/components/QuillAndInkMode.js`
  - `app/components/ReaderChrome.js`
  - `app/components/ChapterReader.js`
  - `app/components/ProofingReader.js`
  - `app/phone/_components/PhoneReader.js`
  - `app/phone/page.js`
- Approach summary: One shared `AppDialog` pattern with focus trap and
  return. A reader keyboard navigation hook used by Proof/Quill/Phone. Add
  `aria-label`, `aria-expanded`, and `aria-controls` to disclosure and
  glyph-only controls. Must not break the shared-component rule in
  `CLAUDE.md` (extend `ChapterReader`/`ReaderChrome`, do not duplicate).
- Will this fix it: Yes if the dialog and keyboard helpers are shared
  rather than reimplemented per mode.
- Verification before approval: require the second AI to confirm the plan
  uses `<ChapterReader>`, `<ReaderChrome>`, and other shared components
  instead of creating new ones (the build-checker hook will block
  duplicates).

### Block 10 - Docs tidy

- Why this position: One doc-drift item. Tiny, but safest to do alongside
  any code block so docs and code rebrand together.
- Bugs covered: `SAS-AUD-20260602-001`
- Roadmap items: `1.1`
- Likely files:
  - `READ ME FIRST - OPEN THIS.txt`
  - `docs/BUILD_PLAN_V4.md`
  - `docs/WIRING_MATRIX.md`
  - `docs/FRONT_FUNCTION_TREE.md`
  - `docs/APP_STRUCTURE.md`
  - `docs/INTERNAL_FUNCTION_TREE.md`
  - `docs/CLOUD_SAFETY_AUDIT.md`
  - `docs/SHARED_COMPONENTS.md`
  - `CLAUDE.md`
- Approach summary: Add a "Current status note" block to historical phase
  docs pointing at `APP_STRUCTURE.md` and the source-of-truth file. Add
  `quill-project-list.json` to the save-data audit doc. Do not claim any
  shared `Reader/` engine exists.
- Will this fix it: Yes, this is pure docs.
- Verification before approval: require the second AI to spot-check three
  random docs after the edit to confirm a fresh reader gets one clear
  picture.

### Block 11 - Better test coverage (safety net)

- Why this position: Adds tests around the riskiest blocks. Best done in
  parallel with Blocks 1-3 so future fixes have a real safety net.
- Bugs covered: no single bug ID; supports Blocks 1, 3, 7
- Roadmap items: `9.1`
- Likely files:
  - `tests/`
  - `app/phone/page.js`
  - `app/phone/_components/PhoneReader.js`
  - `main.js`
  - `preload.js`
  - `packages/backups/index.js`
  - `scripts/copy-release.js`
  - `scripts/check-protected-changes.js`
  - `scripts/check-sync-scope.js`
  - `.githooks/pre-commit`
  - `.claude/hooks/build-checker.sh`
- Approach summary: Add small targeted regression tests next to each
  confirmed bug fix, plus a backup manifest truthfulness test, a transfer
  rebrand test, a guardrail allow/block test, and Electron bridge handler
  tests with a fake IPC surface.
- Will this fix it: Tests do not fix bugs; they catch regressions. The
  blocks they support do the actual fixes.
- Verification before approval: require the second AI to confirm tests do
  not touch Marie's real `Save Data/`.

### Block 12 - Marie-only manual verifies

- Why this position: Three items the audit cannot prove from code reading
  alone. They block release confidence but need real apps Marie has access
  to.
- Bugs covered: none directly; export confidence
- Roadmap items: `3.1`, `3.2`, `4.1`
- Likely files: not relevant - manual verification only
- Approach summary: Marie opens a generated Prep export in Word, opens a
  generated Quill InDesign export in InDesign, and runs a Drive snapshot
  backup inside the packaged Mac app. Each manual check ends with a clear
  pass or a new logged bug.
- Will this fix it: Confirms or rejects export confidence. May spawn new
  bug IDs if real apps disagree with the test output.
- Verification before approval: none required from a second AI; this is
  Marie-only.

### Block Mapping Quick Table

| Block | Roadmap | Bug IDs |
|-------|---------|---------|
| 1 Cloud honesty | 8.1, 8.2, 8.3 | 010, 011, 012 |
| 2 Cross-device delete | 8.4 | 013 |
| 3 File access lockdown | 10.1, 10.2, 10.3 | 015, 016, 017 |
| 4 Quill cleanup | 6.1, 6.2 | 006, 007 |
| 5 Prep duplicates | 5.1 | 005 |
| 6 Duet completion + export math | 7.1, 7.2 | 008, 009 |
| 7 Wording tidy | 3.3, 4.2, 11.1 | 004, 014, 019 |
| 8 Phone test-first | 2.1, 2.2, 2.3, 2.4, 7.3 | 002, 003, 018, 020, + Duet re-upload watchlist |
| 9 Keyboard / a11y | 12.1, 12.2, 12.3 | 021, 022, 023 |
| 10 Docs tidy | 1.1 | 001 |
| 11 Test coverage | 9.1 | none direct |
| 12 Marie-only verifies | 3.1, 3.2, 4.1 | none direct |

### Per-Block Gate

Before any code change for a given block:

1. The block's verification report (see
   `docs/audits/STJOHN_FIX_PLAN_VERIFICATION_PROMPT.md`) is filed by a
   second independent AI or by Marie's chosen reviewer.
2. The report says the bug is real and the proposed fix would address it.
3. Marie says "go" on that exact block.

Bulk-approving multiple blocks at once is not allowed. Bible rule: one
thing at a time.

Before moving on:

- Re-check source goals and structure docs.
