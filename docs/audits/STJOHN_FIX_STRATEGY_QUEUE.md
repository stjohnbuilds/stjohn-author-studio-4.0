# StJohn Fix Roadmap

Purpose: turn audit findings into a numbered fix roadmap Marie can approve
later.

This is planning only.

The roadmap may offer code logic, pseudocode, or small suggested snippets inside
this document. It must not edit app code.

## Hard Wall

Allowed:

- Read bug logs, monitor reports, source files, and tests.
- Build a numbered roadmap: `1.0`, `1.1`, `1.2`, `2.0`, etc.
- Compare possible strategies.
- Recommend the safest strategy.
- Offer code logic or snippets as suggestions inside this document only.
- List likely files, edge cases, commands, and manual checks.

Not allowed:

- Edit product code.
- Apply patches.
- Refactor code.
- Revert user work.
- Mark bugs fixed.
- Archive bugs.
- Touch Marie's real save data.

Any code change needs Marie's explicit approval in a separate fix task.

## Source Files To Recheck

Before creating or updating roadmap items, reread:

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/APP_STRUCTURE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/CLOUD_SCHEMA.md` when cloud is involved
- The likely source files listed in the bug or risk

## Roadmap Status Labels

- `draft` - idea exists, not ready for Marie yet.
- `needs-proof` - needs live test, real file, or account test before fixing.
- `ready-for-Marie-review` - clear enough for Marie to approve or reject.
- `approved-for-fixer` - Marie approved a separate code-fix task.
- `superseded` - replaced by a better plan.

## Roadmap Index

### 1.0 Documentation And Audit Alignment

Goal: make sure future bots read the app correctly and do not chase stale
phase notes.

#### 1.1 Refresh stale app tree and wiring docs

- Source bug/risk: `SAS-AUD-20260602-001`
- Status: `ready-for-Marie-review`
- Type: docs-only roadmap item
- Problem: Some docs still say early-phase or missing status even though the
  source tree now has all four desktop modes plus phone files.
- Why it matters: Future bots can waste time or test the wrong thing.
- Likely files:
  - `docs/BUILD_PLAN_V4.md`
  - `docs/WIRING_MATRIX.md`
  - `docs/FRONT_FUNCTION_TREE.md`
  - `docs/APP_STRUCTURE.md`
- Strategy options:
  - A: Update only `docs/WIRING_MATRIX.md`.
  - B: Add historical-status notes to `docs/BUILD_PLAN_V4.md`, refresh
    `docs/WIRING_MATRIX.md`, and cross-link to `docs/APP_STRUCTURE.md`.
  - C: Rewrite all structure docs into one canonical app tree.
- Recommended strategy: B.
- Why: It fixes the misleading parts without deleting useful history.
- Suggested doc logic, not code:
  ```md
  Current status note:
  This phase list is historical. For current source layout and audit targets,
  use docs/APP_STRUCTURE.md and docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md.
  ```
- Edge cases:
  - Do not mark anything `verified live` unless Marie tested it on a real file.
  - Keep missing Phone Quill edit/delete honest.
  - Keep Prep/Duet local-only cloud status honest unless a new cloud plan exists.
- Future fixer checks:
  - `git diff -- docs`
  - Read docs as a fresh AI and confirm there is one clear current tree.
- Marie approval needed: approve docs-only status refresh.

#### 1.2 Add a monitor campaign summary after the 12-run pass

- Source bug/risk: monitor process need
- Status: `draft`
- Type: reporting roadmap item
- Problem: After 12 runs, Marie needs one plain-English answer, not 12 separate
  fragments.
- Likely files:
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
  - `docs/audits/monitors/*/report.md`
- Recommended strategy: create a final summary section with zones covered,
  confirmed bugs, watchlist risks, blocked tests, Marie-only checks, and release
  risk.
- Suggested report shape:
  ```md
  ## 12-Run Campaign Summary
  - Covered:
  - Confirmed bugs:
  - Watchlist risks:
  - Blocked:
  - Marie-only:
  - Top release risks:
  - Recommended next fixing order:
  ```
- Marie approval needed: not needed for docs summary; needed before closing the
  monitor plan.

### 2.0 Phone Cloud Safety

Goal: prove phone saves are safe before deciding whether code needs changing.

#### 2.1 Test and plan Phone Quill offline annotation recovery

- Source bug/risk: `SAS-AUD-20260602-002`
- Status: `needs-proof`
- Type: watchlist roadmap item
- Problem: Phone Proof has an offline flag queue. Phone Quill appears to push
  the whole project and may not have a clear pending/recovery path.
- What must stay true:
  - Audio stays local.
  - Annotation text and metadata do not silently disappear.
  - Desktop and phone do not create duplicate annotations.
- Likely files if a future fix is approved:
  - `app/phone/page.js`
  - `packages/cloud-sync/quill-sync.js`
  - `packages/cloud-sync/flag-queue.js` as a pattern only
- Strategy options:
  - A: Add a Quill-specific pending annotation queue.
  - B: Add a lightweight local recovery backup plus visible "not synced" banner.
  - C: Do no code work until a live offline test proves data loss or unclear
    recovery.
- Recommended strategy: C first. If reproduced, choose B for simple recovery or
  A if true retry semantics are needed.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // 1. Save annotation locally immediately.
  // 2. Try cloud push.
  // 3. If push fails, mark project/annotation as pending.
  // 4. Show a visible pending banner.
  // 5. Retry on focus/sign-in/manual retry.
  // 6. Clear pending only after cloud confirms.
  ```
- Edge cases:
  - Offline save, then refresh before reconnect.
  - Reconnect and open desktop.
  - Two annotations on the same words.
  - Future edit/delete once phone Quill edit/delete exists.
- Future fixer checks:
  - `npm test -- --test-reporter=spec`
  - `npm run build` if phone code changes
  - Real phone test with safe account
- Marie approval needed: live offline test package/account before any code fix.

#### 2.2 Test and plan account-scoped pending Proof flag queue

- Source bug/risk: `SAS-AUD-20260602-003`
- Status: `needs-proof`
- Type: watchlist roadmap item
- Problem: Pending Proof flag counts may be global rather than scoped to the
  signed-in user.
- What must stay true:
  - Account A data must never appear under Account B.
  - Existing pending flags must not be lost.
- Likely files if a future fix is approved:
  - `packages/cloud-sync/flag-queue.js`
  - `app/phone/page.js`
- Strategy options:
  - A: Prefix queue storage keys with user id and migrate old global queue once.
  - B: Leave storage keys as-is but filter pending items by project/user when
    counting.
  - C: Do no code work until account-swap live test reproduces it.
- Recommended strategy: C first. If reproduced, A.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // const queueKey = `stjohn:proof:pending-flags:${userId}`;
  // On first load, migrate old global queue into the signed-in user's queue
  // only if project ownership is known.
  ```
- Edge cases:
  - Account A pending flag, then sign out.
  - Account B signs in on same phone.
  - Account A signs back in and retries.
  - Duplicate local flag ids.
- Future fixer checks:
  - Add queue unit tests.
  - `node scripts/cloud-safety-test.mjs`
  - `npm test -- --test-reporter=spec`
- Marie approval needed: safe account-swap test before any code fix.

### 3.0 Export Confidence

Goal: turn export concerns into testable proof before release.

#### 3.1 Verify Prep Word export visually

- Source bug/risk: existing handover priority
- Status: `needs-proof`
- Type: real-file/manual roadmap item
- Problem: Prep export tests inspect DOCX structure, but the exported file still
  needs visual verification in Word/LibreOffice.
- Likely files if future fix is needed:
  - `app/components/prepExport.js`
  - `tests/prep-export.test.mjs`
- Recommended strategy: open generated DOCX in Word/LibreOffice first. Only
  plan code changes if side-voice comments land on the wrong line or the file
  opens badly.
- Edge cases:
  - Existing Word comments.
  - Repeated short dialogue.
  - Curly/straight quotes.
  - Dialogue split across Word runs.
- Future fixer checks:
  - `npm test -- --test-reporter=spec`
  - Visual open in Word or LibreOffice
- Marie approval needed: Marie chooses the real-ish manuscript/export to trust.

#### 3.2 Verify Quill InDesign export in real InDesign

- Source bug/risk: existing handover priority
- Status: `needs-proof`
- Type: manual app roadmap item
- Problem: Quill exporter tests cover output structure, but InDesign itself has
  not been verified in this pass.
- Likely files if future fix is needed:
  - `packages/quill-engine/exporters.js`
  - `tests/quill-exporters.test.mjs`
- Recommended strategy: run the generated JSX in real InDesign before planning
  code changes.
- Edge cases:
  - Duplicate selected text.
  - Full spread markers.
  - Image markers.
  - Custom emotions.
  - Character markers.
- Future fixer checks:
  - `npm test -- --test-reporter=spec`
  - Real InDesign run
- Marie approval needed: access to the right InDesign file/environment.

### 4.0 Release And Backup Confidence

Goal: make release risks visible before packaging.

#### 4.1 Verify Drive snapshot backup in packaged Mac app

- Source bug/risk: existing handover priority
- Status: `needs-proof`
- Type: package/manual roadmap item
- Problem: Drive snapshots were built and tested partly, but not fully verified
  in a fresh packaged Mac app during this handover.
- Likely files if future fix is needed:
  - `main.js`
  - `preload.js`
  - `packages/backups/index.js`
  - `app/page.js`
- Recommended strategy: package Mac, open Settings, toggle Drive snapshots, run
  Snapshot now, inspect zip contents.
- Edge cases:
  - Signed out user.
  - Drive missing.
  - Retention over 25 snapshots.
  - Different user account on same Mac.
- Future fixer checks:
  - `npm test -- --test-reporter=spec`
  - `npm run release:mac`
  - Inspect backup zip for local JSON and `cloud/cloud-snapshot.json`
- Marie approval needed: packaged-app test timing.

