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
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-001`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-source-goals-app-tree-drift/inspector-a.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-source-goals-app-tree-drift/inspector-b.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-source-goals-app-tree-drift/inspector-c.md`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 17:33 PDT - Zone Checker - Internal Architecture`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-internal-architecture/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-internal-architecture/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: docs-only roadmap item
- TLDR for Marie: The app is further along than some old docs say. This can
  make future bots test the wrong thing, so the docs need a cleanup pass before
  fixing code.
- Problem: Some docs still say early-phase or missing status even though the
  source tree now has all four desktop modes plus phone files. The first
  three-inspector wave also found stale shared-reader path claims, old
  release/branding wording, missing target paths, a missing `supabase/` audit
  path reference, and an omitted Quill summary save file. The internal
  architecture checker later confirmed the same drift family: the docs still
  mix the target one-reader / one-book-detail direction with the current
  partial implementation.
- Why it matters: Future bots can waste time or test the wrong thing.
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
  - Keep historical plan notes, but label them as historical.
  - Do not claim `packages/reader-engine/` or `app/components/Reader/` exist
    unless they are created in a future approved code task.
  - Be explicit that desktop `ChapterReader` and phone `PhoneReader` are still
    separate today, even if the target direction remains one shared reader.
  - Be explicit that Quill and Duet still route book-detail state through
    `SessionsView`, and Prep still has an inline `BookDetailView`, so future
    fixes should not assume every mode already uses one `BookDetail` surface.
  - Include real save/index files such as `quill-project-list.json` in
    save-data audit docs.
- Future fixer checks:
  - `git diff -- docs`
  - Read docs as a fresh AI and confirm there is one clear current tree.
- Marie approval needed: approve docs-only status refresh.

#### 1.2 Add a monitor campaign summary after the 12-run pass

- Source bug/risk: monitor process need
- Source references:
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
  - `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
  - `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- Status: `draft`
- Type: reporting roadmap item
- TLDR for Marie: After all the bot reports, you need one simple final answer:
  what is healthy, what is risky, and what to fix first.
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
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-002`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` -> Existing Bug Index
- Status: `needs-proof`
- Type: watchlist roadmap item
- TLDR for Marie: If the phone loses internet while saving a Quill note, we
  need proof the note cannot quietly disappear.
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
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-003`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` -> Existing Bug Index
- Status: `needs-proof`
- Type: watchlist roadmap item
- TLDR for Marie: If one phone account has unsent flags, another account should
  never see that count or data.
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

#### 2.3 Test and plan Phone Script empty-cloud refresh cache clearing

- Source bug/risk: `SAS-AUD-20260602-018`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-018`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 20:40 PDT - Zone Checker - Phone Script`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-phone-script/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-phone-script/conflicts.md`
- Status: `needs-proof`
- Type: Phone Script watchlist roadmap item
- TLDR for Marie: If the phone asks the cloud for your Proof books and the
  cloud says "there are none," the phone may keep showing old cached books.
  First we test it safely; if it happens, the fix is to clear the list.
- Problem: The Phone Script refresh path only replaces the current book list
  when the pulled cloud list has items. If the cloud pull succeeds with `[]`
  and the phone already has cached books in state, the function returns the old
  list instead of clearing it and writing an empty cache.
- Why it matters: Marie could see stale or wrong-account Proof books on the
  phone after a successful refresh, especially during account changes,
  deleted-cloud-project checks, or empty-library tests.
- Likely files:
  - `app/phone/page.js`
  - `app/phone/_lib/projectCache.js`
  - A focused phone refresh/cache test if a future fix is approved
- Strategy options:
  - A: Do a safe live phone/account test first and only fix if the stale list
    is reproduced.
  - B: Treat any successful empty pull as authoritative immediately: set the
    current list to `[]` and write `[]` to the signed-in user's phone cache.
  - C: Add a visible "cloud returned no books" review state instead of
    clearing automatically.
- Recommended route: A first. If reproduced, B.
- Why: The checker evidence is strong from source, but this is still marked
  watchlist-only because no live phone/Supabase repro has run yet. If it
  reproduces, a successful empty pull should mean the phone view matches the
  cloud.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only if reproduced:
  // const list = await pullProofProjects({ timeoutMs: ... });
  // if (Array.isArray(list)) {
  //   await saveCachedProjects(user.id, []);
  //   return list; // allows [] to clear stale cached books
  // }
  // return current; // only for error/timeout/unknown result paths
  ```
- Edge cases:
  - Empty successful cloud list is not the same as a failed cloud pull.
  - Network timeout should keep the existing cached list with a warning.
  - Signed-out state should not erase another user's cache by accident.
  - Account A cache and Account B cache must remain separate.
  - Deleted remote books should disappear after a successful refresh.
  - Phone audio selections should stay local and not be uploaded or erased
    unnecessarily.
- Future fixer tests:
  - Mock `pullProofProjects()` returning `[]` while current state has cached
    books; expect state/cache to clear.
  - Mock pull timeout/error; expect existing cache to remain.
  - Test user A and user B caches stay separate.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe signed-in phone test account, start with cached Proof books.
  - Make the cloud Proof list empty.
  - Tap refresh and confirm the phone list clears.
  - Sign out and sign back in, then confirm the empty list remains empty.
- Marie approval needed: approve a safe phone/cloud test account before any
  code-fix task.

#### 2.4 Test and plan Phone Quill empty-cloud refresh cache clearing

- Source bug/risk: `SAS-AUD-20260602-020`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-020`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 21:08 PDT - Zone Checker - Phone Quill`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-phone-quill/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-phone-quill/conflicts.md`
- Status: `needs-proof`
- Type: Phone Quill watchlist roadmap item
- TLDR for Marie: If the phone asks the cloud for Quill projects and the cloud
  says "there are none," the phone may keep showing old cached projects. First
  we test it safely; if it happens, the fix is to clear the list.
- Problem: The Phone Quill refresh path only replaces the current project list
  when the pulled cloud list has items. If the cloud pull succeeds with `[]`
  and the phone already has cached projects in state, the function returns the
  old list instead of clearing it and writing an empty cache.
- Why it matters: Marie could see stale or wrong-account Quill projects on the
  phone after a successful refresh, especially during account changes,
  deleted-cloud-project checks, or empty-library tests.
- Likely files:
  - `app/phone/page.js`
  - `app/phone/_lib/projectCache.js`
  - A focused phone Quill refresh/cache test if a future fix is approved
- Strategy options:
  - A: Do a safe live phone/account test first and only fix if the stale list
    is reproduced.
  - B: Treat any successful empty Quill pull as authoritative immediately: set
    the current project list to `[]` and write `[]` to the signed-in user's
    phone cache.
  - C: Add a visible "cloud returned no projects" review state instead of
    clearing automatically.
- Recommended route: A first. If reproduced, B.
- Why: The checker evidence is strong from source, but this is still
  watchlist-only because no live phone/Supabase repro has run yet. If it
  reproduces, a successful empty pull should make the phone view match the
  cloud.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only if reproduced:
  // const list = await pullQuillProjects({ timeoutMs: ... });
  // if (Array.isArray(list)) {
  //   await saveCachedProjects(user.id, []);
  //   return list; // allows [] to clear stale cached Quill projects
  // }
  // return current; // only for error/timeout/unknown result paths
  ```
- Edge cases:
  - Empty successful cloud list is not the same as a failed cloud pull.
  - Network timeout should keep the existing cached list with a warning.
  - Signed-out state should not erase another user's cache by accident.
  - Account A cache and Account B cache must remain separate.
  - Deleted remote Quill projects should disappear after a successful refresh.
  - Phone audio selections should stay local and not be uploaded or erased
    unnecessarily.
- Future fixer tests:
  - Mock `pullQuillProjects()` returning `[]` while current state has cached
    projects; expect state/cache to clear.
  - Mock pull timeout/error; expect existing cache to remain.
  - Test user A and user B Quill caches stay separate.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe signed-in phone test account, start with cached Quill projects.
  - Make the cloud Quill project list empty.
  - Tap refresh and confirm the phone list clears.
  - Sign out and sign back in, then confirm the empty list remains empty.
- Marie approval needed: approve a safe phone/cloud test account before any
  code-fix task.

### 3.0 Export Confidence

Goal: turn export concerns into testable proof before release.

#### 3.1 Verify Prep Word export visually

- Source bug/risk: existing handover priority
- Source references:
  - `HANDOFF.md` -> outstanding Prep Word export verification
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` -> Top 3 Risks / Export
    confidence
- Status: `needs-proof`
- Type: real-file/manual roadmap item
- TLDR for Marie: The test can say the Word file was built, but a person still
  needs to open it and check the comments are on the right lines.
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
- Source references:
  - `HANDOFF.md` -> outstanding Quill/InDesign export verification context
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` -> Top 3 Risks / Export
    confidence
- Status: `needs-proof`
- Type: manual app roadmap item
- TLDR for Marie: The app can generate the InDesign script, but InDesign itself
  still needs to prove it accepts and applies it correctly.
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

#### 3.3 Align Proof export quote and note column labels

- Source bug/risk: `SAS-AUD-20260602-004`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-004`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 12:28 PDT - Zone Checker Zone 3 Proof Listen`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-proof-listen/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-proof-listen/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed export-label bug roadmap item
- TLDR for Marie: The export is putting the misread quote under a heading
  called `Note`. That makes the spreadsheet confusing, because the actual
  correction note is already in the next column.
- Problem: Proof export and preview headers say `Note` for the quote column,
  while the row value is `sentPlain` / `quote`. The correction note is still
  exported into the `Should Say` column.
- Why it matters: Marie or an engineer could read the exported spreadsheet
  wrong, especially if a quote and correction are different. Any downstream
  spreadsheet workflow may also key off the wrong heading.
- Likely files:
  - `app/components/SessionsView.js`
  - `app/components/ProofingReader.js`
  - `app/phone/page.js`
- Strategy options:
  - A: Rename the seventh column from `Note` to `Quote` everywhere Proof CSVs
    and the sheet-row preview use that column.
  - B: Rename the seventh column to `Misread Quote` for clarity, and keep the
    eighth column as `Should Say`.
  - C: Reorder the data so `note` moves under `Note` and `sentPlain` moves
    somewhere else.
- Recommended route: B.
- Why: `Misread Quote` matches the app explanation in `app/page.js:2349`, keeps
  the current data order stable, and avoids changing the meaning of the
  existing `Should Say` column.
- Suggested code logic, not app code:
  ```js
  // Proposed header shape only:
  const proofFlagHeaders = [
    'Chapter',
    'Audio File',
    'Page',
    'Timestamp',
    'Narrator/Engineer',
    'Type',
    'Misread Quote',
    'Should Say',
  ];
  // Use the same header list for desktop book export, desktop reader export,
  // desktop reader preview, and phone Proof export.
  ```
- Edge cases:
  - Keep the data order stable unless Marie approves a breaking export change.
  - Make desktop book export, desktop reader export, desktop preview, and phone
    export match exactly.
  - Confirm old flags with missing `sentPlain` or missing `note` still export
    blank cells rather than shifting columns.
  - Do not touch Adobe Audition marker export unless a separate bug proves it
    needs a different label.
- Future fixer tests:
  - Add or update a focused test for Proof CSV header/value alignment.
  - Add a phone Proof CSV builder test if the phone helper is easy to isolate.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - Export one Proof CSV from the desktop book/session view.
  - Export one Proof CSV from inside the Proof reader.
  - Export one Proof CSV from phone Proof.
  - Open each file and confirm the quote is under `Misread Quote` and the
    correction is under `Should Say`.
- Marie approval needed: approve the column wording, especially whether Marie
  prefers `Misread Quote`, `Quote`, or another exact label.

### 4.0 Release And Backup Confidence

Goal: make release risks visible before packaging.

#### 4.1 Verify Drive snapshot backup in packaged Mac app

- Source bug/risk: existing handover priority
- Source references:
  - `HANDOFF.md` -> Drive snapshot backups / not yet verified live in packaged
    Electron app
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` -> Top 3 Risks / Export and
    package checks
- Status: `needs-proof`
- Type: package/manual roadmap item
- TLDR for Marie: The backup feature exists, but it still needs to prove it
  works inside the real packaged Mac app, not just in code.
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

#### 4.2 Rebrand backup and transfer export/import wording without breaking old bundles

- Source bug/risk: `SAS-AUD-20260602-014`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-014`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 17:04 PDT - Zone Checker - Exports, Imports, Release Packages, and Old-Build Confusion`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-exports-imports-release-packages-and-old-build-confusion/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-exports-imports-release-packages-and-old-build-confusion/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed export/import rebrand bug roadmap item
- TLDR for Marie: Some backup and transfer files still say the old app names.
  The fix should make new files say `StJohn Author Studio`, while still letting
  old backup/transfer bundles open if you need them.
- Problem: Desktop backup export still defaults to
  `audiobook-proofer-backup.json`; the browser fallback uses the same old
  filename. Transfer export still writes `script-and-sync-transfer.json`, sets
  `app: 'Script and Sync'`, and writes a `README.txt` headed
  `Script and Sync Transfer Folder`. Transfer import still shows old
  `Script and Sync` / `Audiobook Proofer` wording.
- Why it matters: Marie or a future user can think they opened or exported
  from the wrong product. It also makes release handoff and support more
  confusing because the packaged app is now `StJohn Author Studio`.
- Likely files:
  - `app/page.js`
  - `main.js`
  - A new focused export/import branding test if the helpers can be isolated
- Strategy options:
  - A: Rename only the visible filenames and dialog/README copy, but keep old
    manifest compatibility values accepted during import.
  - B: Rename both visible wording and internal manifest identifiers, and add a
    migration/compatibility layer for old transfer folders.
  - C: Leave old names because they still import.
- Recommended route: A first, with B only if the manifest identifier itself is
  user-visible or blocks future compatibility.
- Why: The user-facing confusion can be fixed without risking old transfer
  bundles. Compatibility should be deliberate, not accidentally broken during
  rebrand cleanup.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // const CURRENT_APP_NAME = 'StJohn Author Studio';
  // const CURRENT_TRANSFER_FILENAME = 'stjohn-author-studio-transfer.json';
  // const LEGACY_TRANSFER_FILENAMES = [
  //   'script-and-sync-transfer.json',
  // ];
  // const ACCEPTED_TRANSFER_APP_IDS = [
  //   'StJohn Author Studio',
  //   'Script and Sync', // legacy import only
  // ];
  //
  // Export new bundles with current names.
  // Import should accept current names and legacy names with clear current UI
  // copy.
  ```
- Edge cases:
  - Old `script-and-sync-transfer.json` folders should still import if Marie
    might need old bundles.
  - New transfer folders should use current README text and filenames.
  - Error messages should say `StJohn Author Studio transfer folder`, not
    `Audiobook Proofer`.
  - Backup filename changes should not overwrite existing backups.
  - Docs drift in `READ ME FIRST - OPEN THIS.txt` remains covered by
    `SAS-AUD-20260602-001`, so do not duplicate that here.
- Future fixer tests:
  - Test backup filename generation.
  - Test transfer export manifest and README current branding.
  - Test import accepts a new current transfer filename.
  - Test import still accepts an old legacy transfer filename if Marie wants
    backward compatibility.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe isolated Electron run, export one backup.
  - Export one transfer folder and open the README/manifest.
  - Import the transfer folder back.
  - Confirm all visible names say `StJohn Author Studio`.
  - Try one legacy transfer folder if Marie needs old-bundle compatibility.
- Marie approval needed: approve the exact new filenames and whether old
  transfer bundle import compatibility must be preserved.

### 5.0 Prep Manuscript Assignment Safety

Goal: protect Marie's character and side-voice assignments when Prep rescans
edited text.

#### 5.1 Preserve duplicate quote assignments during Prep Fix/rescan

- Source bug/risk: `SAS-AUD-20260602-005`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-005`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 13:06 PDT - Zone Checker Zone 4 Prep Manuscript`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-prep-manuscript/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-prep-manuscript/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed Prep assignment bug roadmap item
- TLDR for Marie: If two identical lines appear in one section, Prep can mix
  up who says them after you use Fix. The fix should make Prep remember the
  first line, second line, third line, not just the words.
- Problem: `updateSectionHtml()` preserves prior assignments by `sp.text`
  only. When repeated dialogue has the same text, it keeps the first old span
  for that text and can copy that first assignment onto later duplicates after
  the Fix/rescan flow.
- Why it matters: Marie could carefully assign repeated dialogue to different
  speakers or side voices, then lose those assignments silently after fixing a
  warning paragraph.
- Likely files:
  - `app/components/PrepManuscriptMode.js`
  - `tests/prep-export.test.mjs`
  - A new targeted Prep Fix/rescan test file if cleaner than expanding the
    export test
- Strategy options:
  - A: Preserve assignments by occurrence count per quote text, so the first
    old copy maps to the first new copy, the second old copy maps to the
    second new copy, and so on.
  - B: Preserve assignments by nearby context and span position, falling back
    to occurrence count when context changed during the edit.
  - C: Drop all assignments after a Fix/rescan and ask Marie to reassign
    affected spans manually.
- Recommended route: B if practical, otherwise A.
- Why: B is safest when the text edit changes nearby wording; A is simpler and
  still much better than using only the first text match. C avoids wrong data
  but creates too much manual rework.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // Build old spans grouped by normalized quote text.
  // For each new span:
  //   1. Prefer an unused old span with the closest old spanIndex/start offset.
  //   2. If offsets are unavailable, use the next unused occurrence for that
  //      quote text.
  //   3. Copy characterId and sideVoiceId only from that matched old span.
  //   4. Never reuse the same old duplicate for multiple new duplicates.
  ```
- Edge cases:
  - Two identical quotes assigned to different speakers.
  - Three or more identical quotes in one section.
  - Marie edits text before the first duplicate.
  - Marie edits one duplicate so it is no longer identical.
  - One duplicate has no assignment and another duplicate does.
  - Side-voice assignments must be preserved as carefully as main character
    assignments.
- Future fixer tests:
  - Add a focused unit/component-level test for `updateSectionHtml()` or its
    extracted merge helper.
  - Test duplicate quotes with different `characterId` values.
  - Test duplicate quotes with different `sideVoiceId` values.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe isolated Prep run, create or import a section with identical
    dialogue lines.
  - Assign each duplicate to a different speaker or side voice.
  - Use the Fix flow on that section.
  - Confirm the assignments stay attached to the correct occurrence in the
    reader and in the exported DOCX/narrator list.
- Marie approval needed: approve a future code-fix task for the Prep Fix/rescan
  assignment-preservation logic and choose a safe test manuscript.

### 6.0 Quill Cleanup And Data Safety

Goal: make sure Quill deletions and chapter changes remove the right saved,
exported, and synced data.

#### 6.1 Delete same-range character markers with their Quill annotation

- Source bug/risk: `SAS-AUD-20260602-006`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-006`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 14:33 PDT - Zone Checker Zone 5 Quill & Ink`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-quill-ink/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-quill-ink/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed Quill cleanup bug roadmap item
- TLDR for Marie: If you delete a Quill note that has character tags attached,
  some character tags can be left behind. Delete should clean up the whole
  little bundle, not just the main note.
- Problem: `openExistingAnnotation()` and `saveAnnotation()` treat a main
  Quill annotation plus same-range character markers as one grouped edit, but
  `deleteEditingAnnotation()` and `deleteAnnotation()` remove only one
  annotation id.
- Why it matters: Marie could delete an annotation and still have hidden
  character-marker leftovers show up in the dock, exports, or cloud payload.
- Likely files:
  - `app/components/QuillAndInkMode.js`
  - `packages/quill-engine/annotations.js`
  - `packages/quill-engine/exporters.js`
  - A new targeted Quill grouped-delete test
- Strategy options:
  - A: When deleting an annotation, also delete same-section, same-range
    `character` markers that were created as companions to that annotation.
  - B: Add a shared helper that identifies the grouped annotation bundle, then
    use it in load, save, and both delete paths.
  - C: Leave delete behavior alone and filter leftovers only during export or
    sync.
- Recommended route: B.
- Why: One helper reduces the chance that save, popover delete, dock delete,
  export, and future sync logic disagree about what belongs to the annotation
  bundle.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // function idsForAnnotationBundle(annotation, allAnnotations) {
  //   return allAnnotations
  //     .filter((candidate) =>
  //       candidate.id === annotation.id ||
  //       isSameRangeCharacterMarker(candidate, annotation)
  //     )
  //     .map((candidate) => candidate.id);
  // }
  //
  // Delete path:
  // const idsToDelete = new Set(idsForAnnotationBundle(target, annotations));
  // nextAnnotations = annotations.filter((a) => !idsToDelete.has(a.id));
  ```
- Edge cases:
  - Delete from the edit popover.
  - Delete from the bottom annotation dock.
  - Multiple character markers on the same selected range.
  - A separate real annotation that happens to share a nearby range should not
    be deleted accidentally.
  - Exports and cloud payload should not include orphaned markers.
- Future fixer tests:
  - Add a grouped-delete test for an annotation with attached character markers.
  - Test both delete entry points if the UI logic can be isolated.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe isolated Quill run, create an annotation with attached character
    markers.
  - Delete it from the edit popover and confirm all companion markers are gone.
  - Recreate it, delete it from the dock, and confirm the same cleanup.
  - Export and inspect that no orphaned marker remains.
- Marie approval needed: approve a future code-fix task for grouped Quill
  annotation delete behavior.

#### 6.2 Remove stale annotations when a Quill chapter is removed

- Source bug/risk: `SAS-AUD-20260602-007`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-007`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 14:33 PDT - Zone Checker Zone 5 Quill & Ink`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-quill-ink/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-quill-ink/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed Quill cleanup bug roadmap item
- TLDR for Marie: If you remove a Quill chapter, its old notes can stay
  hidden in the project. The fix should make chapter removal also remove that
  chapter's notes, so they cannot export or sync later.
- Problem: The Quill `onUpdateBook` bridge filters kept chapters and audio by
  `keptIds`, but does not filter `p.annotations` for removed chapter ids.
  Exporters and cloud sync can still consume those leftover annotations.
- Why it matters: Deleted chapter content could still appear in exports or
  cloud payloads, which is confusing and unsafe for release.
- Likely files:
  - `app/components/QuillAndInkMode.js`
  - `packages/cloud-sync/quill-sync.js`
  - `packages/quill-engine/exporters.js`
  - A new chapter-removal cleanup test
- Strategy options:
  - A: When the chapter list changes, filter annotations to only kept chapter
    ids.
  - B: If chapter ids can be remapped during reorder/import, distinguish
    removed chapters from reordered chapters, then prune only true removals.
  - C: Leave saved annotations alone and filter them only in export and cloud
    sync.
- Recommended route: B where needed, otherwise A.
- Why: The safest future fixer should avoid accidentally deleting annotations
  during harmless reorder/rename work, but true removed-chapter annotations
  should not remain in saved state.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // const keptChapterIds = new Set(nextChapters.map((chapter) => chapter.id));
  // const nextAnnotations = previous.annotations.filter((annotation) =>
  //   keptChapterIds.has(annotation.sectionId)
  // );
  // Save nextAnnotations together with nextChapters and pruned audio entries.
  ```
- Edge cases:
  - Removing one annotated chapter while keeping other annotated chapters.
  - Reordering chapters should not delete annotations.
  - Renaming a chapter should not delete annotations.
  - Unknown old annotations with missing `sectionId` should be handled
    deliberately, not silently pushed to `chapter_id: null`.
  - Exports, local save, and cloud payload should agree after removal.
- Future fixer tests:
  - Add a test for removing an annotated Quill chapter.
  - Add a test proving reorder/rename keeps annotations.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe isolated Quill run, annotate a chapter.
  - Remove that chapter from book detail.
  - Save and reopen the project.
  - Confirm the old annotation is gone from reader state, exports, and cloud
    payload shape.
- Marie approval needed: approve a future code-fix task for Quill
  chapter-removal annotation cleanup.

### 7.0 Duet Prep Completion And Export Safety

Goal: make sure Duet scan status and marker exports match what Marie actually
did.

#### 7.1 Align Duet scan completion with the shared chapter list

- Source bug/risk: `SAS-AUD-20260602-008`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-008`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 15:05 PDT - Zone Checker - Duet Prep`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-duet-prep/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-duet-prep/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed Duet completion-state bug roadmap item
- TLDR for Marie: Duet can finish scanning a chapter but still show it as not
  done in the shared list. The app should not make you tick a box by hand after
  a successful scan.
- Problem: Duet scan state is stored as `transcribed: true`, but the shared
  book-detail adapter falls back to `!!ch.scanned` for completion when Marie
  has not manually toggled completion. Duet scan does not write `scanned`.
- Why it matters: Marie can lose trust in the progress list and may repeat
  work because a finished scan still looks incomplete.
- Likely files:
  - `app/components/PrebuildMode.js`
  - `app/components/SessionsView.js`
  - A targeted Duet scan-status test
- Strategy options:
  - A: Change the shared Duet adapter fallback to treat `transcribed` as
    complete.
  - B: Write `scanned: true` when Duet scan succeeds so the existing shared
    fallback works.
  - C: Keep manual completion only and ignore scan completion state.
- Recommended route: A or B after checking whether `scanned` has other meaning
  in shared Proof flows.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // completed:
  //   ch.completionOverride === true ? true :
  //   ch.completionOverride === false ? false :
  //   Boolean(ch.transcribed || ch.scanned)
  ```
- Edge cases:
  - Manual completion override should still win.
  - Failed or cancelled scan must not mark complete.
  - Re-scanning an already complete chapter should keep the list stable.
  - The change must not alter Proof Listen completion semantics accidentally.
- Future fixer tests:
  - Add a Duet adapter test for a chapter with `transcribed: true`.
  - Add a test proving manual override still wins.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe isolated Duet run, scan one chapter.
  - Return to the shared chapter list.
  - Confirm completion count and checkbox update before any manual toggle.
- Marie approval needed: approve a future code-fix task for Duet completion
  state alignment.

#### 7.2 Carry millisecond overflow in Duet marker export times

- Source bug/risk: `SAS-AUD-20260602-009`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-009`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 15:05 PDT - Zone Checker - Duet Prep`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-duet-prep/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-duet-prep/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed Duet export bug roadmap item
- TLDR for Marie: Duet can export a timestamp with `1000` milliseconds, which
  is not a real millisecond value. It should roll over to the next second
  cleanly.
- Problem: `formatAuditionTime()` rounds milliseconds but does not carry
  `1000` milliseconds into the next second before writing the Audition marker
  `Start` column.
- Why it matters: Audition marker files can contain invalid or surprising start
  times near second boundaries, which can break import or place markers wrong.
- Likely files:
  - `app/components/PrebuildMode.js`
  - A targeted Duet marker formatter/export test
- Strategy options:
  - A: Normalize total milliseconds first, then derive hours/minutes/seconds.
  - B: Keep the current formatter shape but add carry logic when `ms === 1000`.
  - C: Clamp `1000` down to `999`.
- Recommended route: A.
- Why: Normalizing total milliseconds first is simpler and avoids future carry
  bugs at minute/hour boundaries.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // const totalMs = Math.round(seconds * 1000);
  // const wholeSeconds = Math.floor(totalMs / 1000);
  // const ms = totalMs % 1000;
  // Build H:MM:SS.mmm or M:SS.mmm from wholeSeconds and ms.
  ```
- Edge cases:
  - `61.9996` should become `1:02.000`, not `1:01.1000`.
  - `3599.9996` should become `1:00:00.000`, not `59:59.1000`.
  - Exact whole seconds should keep `.000`.
  - Negative or invalid times should still be guarded consistently.
- Future fixer tests:
  - Add formatter tests for `61.9996`, `3599.9996`, exact seconds, and normal
    sub-second values.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - Export a safe Duet marker file with a boundary-case marker time.
  - Open the marker file and confirm every `Start` value has exactly
    three-digit milliseconds.
  - If available, import the marker file into Audition.
- Marie approval needed: approve a future code-fix task for Duet marker time
  formatting.

#### 7.3 Test Duet manuscript re-upload carry-over by chapter position

- Source bug/risk: Duet checker likely risk, not a confirmed bug-log item yet
- Source references:
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 15:05 PDT - Zone Checker - Duet Prep`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-duet-prep/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-duet-prep/conflicts.md`
    -> `Conflict 3`
- Status: `needs-proof`
- Type: Duet watchlist roadmap item
- TLDR for Marie: If you re-upload a changed Duet manuscript, old audio/scan
  data may stick to chapters by position, not by true identity. This needs a
  safe test before calling it a confirmed bug.
- Problem: The re-upload path appears to match new chapters to old chapters by
  array index and carry over audio/transcription data from that positional
  match.
- Why it matters: If a revised manuscript adds, removes, or reorders split
  scenes, old audio or scan data might attach to the wrong chapter.
- Likely files:
  - `app/components/PrebuildMode.js`
  - Any future Duet re-upload test fixture
- Strategy options:
  - A: Do a live isolated repro first and only fix if the risk appears in real
    use.
  - B: Preserve carry-over only when chapter title/id/text fingerprint still
    matches.
  - C: Drop all old audio/scan data on re-upload and force Marie to reconnect
    everything.
- Recommended route: A first. If reproduced, B.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only if reproduced:
  // const oldMatch = findOldChapterByStableIdentity(newChapter, oldChapters);
  // if (oldMatch && fingerprintStillMatches(newChapter, oldMatch)) {
  //   carry over audio/transcription fields;
  // } else {
  //   leave scan/audio fields empty and ask for review;
  // }
  ```
- Edge cases:
  - Same manuscript re-upload with only typo fixes should preserve data.
  - Inserted scene near the front should not shift old audio onto later scenes.
  - Removed scene should not leave invisible carried-over data.
  - Renamed chapter with same content may need a careful match.
- Future fixer tests:
  - Add safe fixtures for same-order re-upload, inserted scene, removed scene,
    and reordered scene.
  - Run `npm test -- --test-reporter=spec` if logic changes.
- Manual checks:
  - In a safe isolated Duet run, scan or attach audio to a small manuscript.
  - Re-upload a changed version with one inserted or removed scene near the
    front.
  - Confirm whether audio/scan state stays with the correct chapter.
- Marie approval needed: approve safe test manuscripts before this becomes a
  code-fix task.

### 8.0 Cloud Sync And Backup Integrity

Goal: make cloud reads, cloud writes, backups, and cross-device refresh fail
honestly instead of quietly preserving partial or stale data.

#### 8.1 Make Proof and Quill cloud pulls fail loudly when required secondary reads fail

- Source bug/risk: `SAS-AUD-20260602-010`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-010`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 15:34 PDT - Zone Checker - Cloud, Auth, Audio Privacy, Save Data, and Backups`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-cloud-auth-audio-privacy-save-data-and-backups/checker.md`
  - `docs/CLOUD_SCHEMA.md` -> Read path - single pull
- Status: `ready-for-Marie-review`
- Type: confirmed P1 cloud-pull integrity bug roadmap item
- TLDR for Marie: The app can say a cloud pull worked even when some of the
  important cloud data failed to load. The fix should make it say "sync failed"
  instead of showing half-built or stale books.
- Problem: `pullProofProjects()` checks the top-level project query error but
  does not check later transcription or flag query errors. `pullQuillProjects()`
  checks the top-level project query error but does not check later chapter or
  annotation query errors.
- Why it matters: Marie could open a project that looks synced but is missing
  flags, transcriptions, chapters, or annotations. That is worse than a visible
  error because it can hide data loss or stale data.
- Likely files:
  - `packages/cloud-sync/proof-sync.js`
  - `packages/cloud-sync/quill-sync.js`
  - A new focused cloud-pull failure test
- Strategy options:
  - A: Throw immediately if any required secondary query returns an error.
  - B: Return a structured partial-success object that the UI must display as a
    sync warning.
  - C: Keep returning partial data but add a console warning only.
- Recommended route: A first, with a clean user-facing error path.
- Why: Required rows are part of the project. If they cannot be read, the app
  should not quietly rebuild a project that looks complete.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // const { data: transcriptions, error: transcriptionError } = await ...
  // if (transcriptionError) {
  //   throw new Error(`Proof cloud pull failed while reading transcriptions: ${transcriptionError.message}`);
  // }
  //
  // Repeat for flags, Quill chapters, and Quill annotations before rebuild.
  ```
- Edge cases:
  - Empty tables are valid when the query succeeds and returns `[]`.
  - Query failure is not the same as "no rows".
  - A project with no flags or no annotations should still load.
  - The UI should not overwrite good local data with a partial failed pull.
  - Error messages should not expose secrets or raw tokens.
- Future fixer tests:
  - Mock a Proof transcription query failure.
  - Mock a Proof flag query failure.
  - Mock a Quill chapter query failure.
  - Mock a Quill annotation query failure.
  - Confirm each failure blocks partial rebuild and reports sync failure.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe signed-in test account, simulate or force one secondary cloud
    read failure.
  - Confirm the app keeps the prior local state and shows a clear sync problem.
- Marie approval needed: approve a future code-fix task for cloud-pull error
  handling and choose whether the user-facing message says "sync failed" or a
  softer warning.

#### 8.2 Make backup manifests tell the truth when cloud snapshot reads fail

- Source bug/risk: `SAS-AUD-20260602-011`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-011`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 15:34 PDT - Zone Checker - Cloud, Auth, Audio Privacy, Save Data, and Backups`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-cloud-auth-audio-privacy-save-data-and-backups/checker.md`
  - `docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md` -> `4.1 Verify Drive snapshot backup in packaged Mac app`
- Status: `ready-for-Marie-review`
- Type: confirmed P1 backup integrity bug roadmap item
- TLDR for Marie: A backup can say cloud data was included even if the cloud
  part failed and came back empty. The fix should make the backup label honest.
- Problem: `buildCloudSnapshot()` catches Proof and Quill pull failures and
  turns them into empty arrays. Electron then writes `cloudIncluded: true`
  whenever a `cloudSnapshot` object exists, even if that object only exists
  because failures were swallowed.
- Why it matters: Marie could trust a backup that claims it includes cloud data
  when it does not. During recovery, that could make the backup much less safe
  than it looks.
- Likely files:
  - `packages/backups/index.js`
  - `main.js`
  - Backup snapshot tests
- Strategy options:
  - A: Fail the whole backup if any cloud snapshot read fails.
  - B: Complete the local backup but mark cloud snapshot status as failed in
    the manifest and snapshot file.
  - C: Keep the current behavior and rely on console logs.
- Recommended route: B.
- Why: Marie should still get a local backup when local data is available, but
  the manifest must clearly say whether cloud data was included successfully.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // const cloudSnapshot = {
  //   status: proofOk && quillOk ? 'complete' : 'partial-or-failed',
  //   proof: { status: proofOk ? 'ok' : 'failed', projects },
  //   quill: { status: quillOk ? 'ok' : 'failed', projects },
  // };
  //
  // manifest.cloudIncluded = cloudSnapshot.status === 'complete';
  // manifest.cloudStatus = cloudSnapshot.status;
  ```
- Edge cases:
  - Signed out users should have a clear `not-signed-in` cloud status.
  - Empty cloud data with successful reads should not be treated as failed.
  - A Proof-only failure and a Quill-only failure should be visible separately.
  - Backup zip should still be inspectable even when cloud status is partial.
- Future fixer tests:
  - Test successful empty cloud snapshot.
  - Test Proof snapshot failure.
  - Test Quill snapshot failure.
  - Test manifest fields and `cloud/cloud-snapshot.json` agree.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - Run a safe packaged-app backup when signed in.
  - Force or mock one cloud read failure.
  - Open the backup zip and confirm the manifest does not claim full cloud
    coverage.
- Marie approval needed: approve a future code-fix task for backup manifest
  truthfulness and decide whether failed cloud reads should block backup or
  produce a local-only/partial backup.

#### 8.3 Make Quill cloud push stop on critical Supabase errors before storing success

- Source bug/risk: `SAS-AUD-20260602-012`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-012`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 15:34 PDT - Zone Checker - Cloud, Auth, Audio Privacy, Save Data, and Backups`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-cloud-auth-audio-privacy-save-data-and-backups/checker.md`
  - `docs/CLOUD_SCHEMA.md` -> Write path - single push
- Status: `ready-for-Marie-review`
- Type: confirmed P1 Quill cloud-push integrity bug roadmap item
- TLDR for Marie: Quill can hit cloud errors while saving, then remember the
  save like it worked. The fix should stop immediately and not mark success
  unless every important cloud step really worked.
- Problem: Quill chapter prune, chapter-id lookup, and annotation prune calls
  do not check returned Supabase errors. If the chapter-id lookup fails,
  annotation rows can fall back to `chapter_id: null`, and the final push hash
  can still be stored as if sync succeeded.
- Why it matters: Marie could believe Quill annotations synced when the cloud
  copy is partial, wrongly linked, or missing cleanup.
- Likely files:
  - `packages/cloud-sync/quill-sync.js`
  - A new targeted Quill sync failure test
- Strategy options:
  - A: Check every required Supabase call and throw before writing the success
    hash.
  - B: Allow partial push but mark the project as pending/dirty for retry.
  - C: Only add logging and leave the success hash behavior alone.
- Recommended route: A, with B as a follow-up if retry UX needs improvement.
- Why: The current push hash is a skip gate. It must only be stored after the
  cloud write is known to be complete enough to trust.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // const { error: pruneChapterError } = await ...
  // if (pruneChapterError) throw new Error(...)
  //
  // const { data: chapterRows, error: chapterLookupError } = await ...
  // if (chapterLookupError) throw new Error(...)
  //
  // Only call rememberLastPushHash(project.id, hash) after all required
  // deletes, lookups, and upserts have succeeded.
  ```
- Edge cases:
  - Empty annotation lists should still prune successfully.
  - Missing chapter-id mappings should be treated deliberately, not silently
    converted to `null`.
  - A failed push should remain dirty so a later retry can run.
  - Error text should be safe for logs and user display.
- Future fixer tests:
  - Mock chapter-prune failure.
  - Mock chapter-id lookup failure.
  - Mock annotation-prune failure.
  - Confirm the push throws and does not store a success hash.
  - Confirm a clean push still stores the hash.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe signed-in Quill project, force a cloud write failure if practical.
  - Confirm the app does not report/remember a clean sync.
- Marie approval needed: approve a future code-fix task for Quill push
  error-handling and retry behavior.

#### 8.4 Define remote-delete rules so desktop refresh removes cloud-deleted Proof and Quill items

- Source bug/risk: `SAS-AUD-20260602-013`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-013`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 15:34 PDT - Zone Checker - Cloud, Auth, Audio Privacy, Save Data, and Backups`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-cloud-auth-audio-privacy-save-data-and-backups/checker.md`
  - `docs/CLOUD_SCHEMA.md` -> Tombstones and focus-pull
- Status: `ready-for-Marie-review`
- Type: confirmed P1 cross-device delete bug roadmap item
- TLDR for Marie: If you delete a cloud project on one device, another desktop
  can keep the old local copy and later send it back. The fix needs a clear
  rule for "cloud deleted means remove locally too."
- Problem: Proof and Quill desktop merge/hydrate paths start from all local
  items and overlay cloud items, so local-only survivors are preserved. Empty
  cloud pulls can also return early before clearing local lists. Tombstones
  only protect deletes started on the same device.
- Why it matters: A deleted Proof book or Quill project can come back from
  another desktop, creating old or unwanted cloud data again.
- Likely files:
  - `app/page.js`
  - `app/components/QuillAndInkMode.js`
  - `packages/cloud-sync/tombstones.js`
  - Cross-device delete/merge tests
- Strategy options:
  - A: Treat signed-in cloud-owned projects missing from cloud as remotely
    deleted and remove them locally.
  - B: Move missing cloud-owned projects into a local "needs review" state
    instead of deleting immediately.
  - C: Keep all local-only survivors forever.
- Recommended route: A with a safety check for unsynced local-only projects.
- Why: Cloud-owned projects should respect remote deletion, but brand-new
  local drafts that never synced should not be erased by an empty cloud list.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // const cloudIds = new Set(cloudProjects.map((p) => p.cloudId || p.id));
  // const nextLocal = localProjects.filter((project) => {
  //   if (!project.cloudId) return true; // local-only draft
  //   if (wasLocallyTombstoned(project.cloudId)) return false;
  //   return cloudIds.has(project.cloudId);
  // });
  // merge cloud projects into nextLocal, preserving local audio paths only for
  // surviving cloud-owned projects.
  ```
- Edge cases:
  - Signed out mode should not delete local data.
  - Local-only drafts without a `cloudId` must survive.
  - Failed cloud pulls must not be treated as "everything was deleted".
  - Locally tombstoned deletes should still be respected.
  - Local audio paths should stay attached to surviving cloud projects only.
- Future fixer tests:
  - Test remote delete removes a cloud-owned Proof book.
  - Test remote delete removes a cloud-owned Quill project.
  - Test empty cloud list after successful pull clears only cloud-owned items.
  - Test failed pull does not clear local data.
  - Test local-only unsynced drafts survive.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe two-device account, delete one Proof book on Device A.
  - Refresh Device B and confirm it disappears without re-pushing.
  - Repeat for one Quill project.
- Marie approval needed: approve the exact remote-delete rule before code
  changes, especially what should happen to local-only unsynced drafts.

### 9.0 Tests, Guardrails, And Release Confidence

Goal: make the test and safety net match the size of the app before release.

#### 9.1 Add targeted coverage for phone, Electron, backup, release, and guardrail paths

- Source bug/risk: checker-confirmed coverage/tooling risk, no new bug ID
- Source references:
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 19:37 PDT - Zone Checker - Tests, Scripts, Hooks, and Coverage Gaps`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-tests-scripts-hooks-and-coverage-gaps/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-tests-scripts-hooks-and-coverage-gaps/conflicts.md`
  - Existing adjacent bug families: `SAS-AUD-20260602-011` and
    `SAS-AUD-20260602-014`
- Status: `ready-for-Marie-review`
- Type: watchlist roadmap item for release-readiness coverage
- TLDR for Marie: The current tests pass, but they only check a small slice of
  the app. Before release, the risky areas need their own tests so future fixes
  do not accidentally break phone, backups, exports, or safety checks.
- Problem: The checker confirmed that `npm test -- --test-reporter=spec`
  passes with 13 tests and that staged-file guardrails pass, but the committed
  suite has no direct tests for phone flows, Electron bridge/save-export
  handlers, backup snapshot helpers, release-copy scripts, or the
  guardrail/release scripts named in the audit. The checker also reproduced
  repeated `MODULE_TYPELESS_PACKAGE_JSON` warnings, which add noise to health
  output.
- Why it matters: Passing tests can look stronger than it really is. A future
  code fix could break a high-risk path and still show green tests if that path
  is not covered.
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
- Strategy options:
  - A: Add one large end-to-end test harness for every missing area at once.
  - B: Add small targeted regression tests around each already-confirmed bug
    family, then add broader phone/Electron smoke tests.
  - C: Leave tests as-is and rely on manual release checks only.
- Recommended route: B.
- Why: The audit already found concrete risky areas. Small targeted tests are
  less brittle than one huge harness and will give future fix bots a reliable
  safety net faster.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // 1. Add focused unit tests for backup snapshot status truthfulness.
  // 2. Add focused unit tests for release-copy naming expectations.
  // 3. Add bridge-handler tests with a fake Electron IPC surface.
  // 4. Add phone reader/cloud-save tests with mocked Supabase and local audio.
  // 5. Add guardrail tests that create staged throwaway files and assert
  //    allowed/blocked outcomes without touching real app data.
  ```
- Edge cases:
  - Tests must not touch Marie's real `Save Data/`.
  - Electron-style tests should use temp folders and fake IPC where possible.
  - Guardrail tests must clean up any throwaway staged files.
  - Phone tests must prove audio stays local and is not uploaded.
  - Empty cloud data and failed cloud reads must be tested separately.
  - Release tests should distinguish old import compatibility from new visible
    branding.
  - Module-warning cleanup should not change runtime behavior just to silence
    logs.
- Future fixer tests:
  - Add tests for `SAS-AUD-20260602-011` backup manifest truthfulness.
  - Add tests for `SAS-AUD-20260602-014` release/transfer naming.
  - Add a phone Proof pending-flag/account-scope test if the live repro proves
    the watchlist risk.
  - Add a phone Quill offline-save recovery test if the live repro proves the
    watchlist risk.
  - Add staged-file guardrail pass/fail tests for protected paths.
  - Run `npm test -- --test-reporter=spec`.
  - Run `npm run guardrails:check:all`.
- Manual checks:
  - Run one safe backup export in an isolated Electron profile and open the
    zip manifest.
  - Run one safe transfer export/import round trip and inspect visible naming.
  - Run one safe phone Proof flow and one safe phone Quill flow with test
    projects.
  - Confirm health-check output is readable and important failures are not
    buried by repeated module warnings.
- Marie approval needed: approve a future test/guardrail coverage task before
  any test or script files are changed.

### 10.0 Security And Local File Boundaries

Goal: stop imported or crafted project data from steering the desktop app into
reading local files outside the user's intended audio/manuscript paths.

#### 10.1 Lock down the Electron audio bridge and `localfile://` protocol

- Source bug/risk: `SAS-AUD-20260602-015`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-015`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 20:15 PDT - Zone Checker - Security and Privacy`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-security-and-privacy/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-security-and-privacy/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed P0 security/privacy roadmap item
- TLDR for Marie: The app's audio helper is too trusting. A bad imported
  project could point the player at a private local file instead of a real
  audio file.
- Problem: The Electron window disables normal browser security, preload
  exposes `getAudioUrl()` and `readAudioFile()`, `decodeStoredFilePath()` keeps
  raw absolute paths, and the `localfile://` protocol serves decoded files
  without an audio-only or folder allowlist.
- Why it matters: Audio should stay local, but local does not mean "the
  renderer can read any file on the computer." This is a privacy boundary bug,
  not just a cleanup issue.
- Likely files:
  - `main.js`
  - `preload.js`
  - `app/page.js`
  - Focused Electron bridge/path validation tests
- Strategy options:
  - A: Re-enable `webSecurity` and restrict the file bridge to validated
    audio-only paths chosen through trusted app dialogs.
  - B: Keep `webSecurity` disabled but add path and extension checks to the
    current bridge.
  - C: Remove renderer file URLs entirely and serve audio through temporary
    object URLs or scoped session tokens.
- Recommended route: A first, with C if the current protocol shape stays too
  broad after validation.
- Why: Re-enabling normal browser protections plus strict bridge validation
  fixes the broadest risk while preserving the normal "play selected local
  audio" workflow.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // 1. Keep a main-process allowlist of audio files selected by the user.
  // 2. Reject raw absolute paths that were only loaded from imported project
  //    JSON.
  // 3. Require resolved paths to match an allowed audio file or app-owned temp
  //    file.
  // 4. Reject non-audio extensions and missing files with a safe user-facing
  //    error.
  // 5. Serve only allowlisted files through `localfile://` or replace the
  //    protocol with a safer scoped URL mechanism.
  ```
- Edge cases:
  - Existing legitimate local audio paths should still play after reselecting
    or validating them.
  - Imported backups with old audio paths should ask Marie to reconnect audio,
    not silently trust the raw path.
  - Transcription must still work for approved audio.
  - Non-audio files should be rejected even if they exist.
  - Error messages should not print private full paths unless needed for a
    local-only diagnostic.
  - Turning `webSecurity` back on must not break required local app assets.
- Future fixer tests:
  - Safe temp-only Electron test with a crafted imported book whose `audioPath`
    points at a non-audio local file.
  - Test that approved audio selected through the dialog still plays.
  - Test that transcription still receives only approved audio paths.
  - Test `getAudioUrl()` and `readAudioFile()` reject non-allowlisted paths.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In an isolated Electron profile, import a crafted backup with a bad
    `audioPath`.
  - Confirm the app blocks the bad path and asks for a safe audio reattach.
  - Attach a real safe audio file and confirm playback still works.
- Marie approval needed: approve a future security-fix task and a safe
  temp-only crafted backup fixture.

#### 10.2 Keep transfer import paths inside the copied transfer folder

- Source bug/risk: `SAS-AUD-20260602-016`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-016`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 20:15 PDT - Zone Checker - Security and Privacy`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-security-and-privacy/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-security-and-privacy/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed P0 import-boundary roadmap item
- TLDR for Marie: A bad transfer folder can use sneaky `../` path pieces to
  point outside the transfer folder. The import should slam the door on that.
- Problem: Transfer import rebuilds audio and manuscript paths with
  `path.join(importDir, ...)` after splitting on `/`, but it does not reject
  `..` segments or prove the final resolved path stays inside `importDir`.
- Why it matters: Transfer import is supposed to trust only the copied transfer
  folder. If paths can escape, a crafted transfer could make the app read from
  elsewhere on disk.
- Likely files:
  - `main.js`
  - Transfer import helper tests
- Strategy options:
  - A: Reject any manifest path containing `..`, absolute path syntax, drive
    letters, or URL-like schemes before joining.
  - B: Normalize and resolve the final path, then verify it is still inside
    `importDir`.
  - C: Do both A and B.
- Recommended route: C.
- Why: Early rejection makes malicious paths obvious, and final root checks
  protect against platform-specific path tricks.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // function resolveInsideImportDir(importDir, relativePath) {
  //   if (path.isAbsolute(relativePath)) throw new Error('Invalid transfer path');
  //   const parts = relativePath.split(/[\\/]+/);
  //   if (parts.some((part) => part === '..')) throw new Error('Invalid transfer path');
  //   const resolved = path.resolve(importDir, ...parts);
  //   const root = path.resolve(importDir) + path.sep;
  //   if (!resolved.startsWith(root)) throw new Error('Transfer path escaped folder');
  //   return resolved;
  // }
  ```
- Edge cases:
  - Windows drive letters and backslashes.
  - URL-like strings such as `file://...`.
  - Empty paths versus missing optional audio.
  - Legitimate nested folders inside the transfer folder.
  - Old transfer bundles should still import if their paths are clean.
  - Error text should explain that the transfer folder is invalid, not expose
    unrelated local paths.
- Future fixer tests:
  - Test clean nested transfer audio path imports.
  - Test `../outside.mp3` is rejected.
  - Test manuscript `../outside.docx` is rejected before read.
  - Test absolute paths and Windows-style traversal are rejected.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe temp-only Electron run, import one valid transfer folder.
  - Import one crafted transfer folder with escaping audio and manuscript
    entries.
  - Confirm the crafted import fails without reading outside the copied folder.
- Marie approval needed: approve a future import-boundary fix and allow use of
  a temp-only crafted transfer fixture.

#### 10.3 Sanitize backup-imported book ids before manuscript-source file access

- Source bug/risk: `SAS-AUD-20260602-017`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-017`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 20:15 PDT - Zone Checker - Security and Privacy`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-security-and-privacy/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-security-and-privacy/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed P0 save/manuscript-boundary roadmap item
- TLDR for Marie: A bad backup can sneak path pieces into a book id. Later,
  the app can use that id like a file path and step outside the manuscript
  storage folder.
- Problem: Backup import merges raw book objects into state, paging
  normalization preserves imported ids, and manuscript-source save/read/rescan
  helpers build paths from the raw `bookId` without validating the resolved
  path stays inside `Save Data/Manuscript Sources/`.
- Why it matters: Backup import should never let outside data decide where the
  app reads or writes manuscript-source files.
- Likely files:
  - `main.js`
  - `app/page.js`
  - `app/lib/manuscriptPaging.js`
  - Backup import and manuscript-source path tests
- Strategy options:
  - A: Regenerate unsafe imported book ids during backup import and remap all
    linked book data to the new safe ids.
  - B: Reject any backup that contains an unsafe book id.
  - C: Keep ids unchanged but add root checks around every manuscript-source
    path operation.
- Recommended route: A plus C.
- Why: Regenerating unsafe ids protects saved state, while root checks protect
  every future file operation even if another import path misses validation.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // function isSafeEntityId(id) {
  //   return /^[A-Za-z0-9_-]+$/.test(String(id));
  // }
  //
  // On backup import:
  //   if (!isSafeEntityId(book.id)) {
  //     const newId = createSafeId();
  //     remap book id plus related sections/page maps/source refs;
  //   }
  //
  // Before manuscript-source file access:
  //   const resolved = path.resolve(sourceDir, `${safeBookId}.docx`);
  //   assertInside(sourceDir, resolved);
  ```
- Edge cases:
  - Existing normal ids should not change.
  - Unsafe imported ids may have related sections, flags, page maps, and audio
    references that need remapping.
  - Duplicate ids after sanitizing must be handled safely.
  - Rescan handlers should reject unsafe ids even if the UI somehow sends one.
  - The fix must not touch Marie's real `Save Data/` during tests.
  - Old backups with safe legacy ids should still import.
- Future fixer tests:
  - Test backup import with a safe id keeps the id.
  - Test backup import with `../../../tmp/probe` regenerates or rejects the id.
  - Test manuscript-source save/read/rescan reject escaped paths.
  - Test related book data still points to the correct remapped safe id.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe temp-only Electron profile, import a crafted backup with a
    path-segment book id.
  - Trigger manuscript rescan or reattach.
  - Confirm the app refuses to read/write outside `Save Data/Manuscript Sources/`.
- Marie approval needed: approve a future backup-import security fix and choose
  whether unsafe backups should be repaired with new ids or rejected with a
  clear warning.

### 11.0 Phone Quill Reader And Audio Flow

Goal: make the Phone Quill reader instructions match what the user can
actually do.

#### 11.1 Align Phone Quill no-match audio guidance with the real picker path

- Source bug/risk: `SAS-AUD-20260602-019`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-019`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 21:08 PDT - Zone Checker - Phone Quill`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-phone-quill/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-phone-quill/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed P2 Phone Quill UI/audio bug roadmap item
- TLDR for Marie: Phone Quill tells you to pick audio inside the reader, but
  the reader does not let you do that. The fix is to make the message and the
  button path tell the same truth.
- Problem: The Phone Quill project screen says `No filenames matched. You can
  still pick audio inside the reader.`, but the reader passes
  `allowManualPick={false}` to the audio dock, and the dock tells the user to
  go back to the chapter list to pick audio.
- Why it matters: Marie can follow the app's instruction and land in a reader
  state where the promised action is disabled. That creates avoidable confusion
  during phone audio setup.
- Likely files:
  - `app/phone/page.js`
  - The `PhoneAudioDock` logic defined inside `app/phone/page.js`
  - A focused phone audio-guidance test if a future fix is approved
- Strategy options:
  - A: Enable manual audio picking inside the Phone Quill reader when no audio
    filenames match.
  - B: Keep manual picking chapter-list-only and change the project-screen
    message to tell Marie to return to the chapter list.
  - C: Add a visible reader button that sends Marie directly back to the
    chapter list audio picker.
- Recommended route: C if simple, otherwise B.
- Why: The least risky release fix is to make the visible instructions honest.
  A direct navigation button is better than just changing copy because it gives
  Marie an obvious next action.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // If manual pick is disabled in the reader:
  //   show copy like "Go back to the chapter list to choose an audio folder."
  //   show a "Back to chapter list" action.
  //
  // If manual pick is enabled in the reader:
  //   pass allowManualPick={true}
  //   wire the same safe local-only audio folder picker used by the chapter list.
  ```
- Edge cases:
  - Audio remains local and must not upload to Supabase.
  - The Proof phone audio path should not regress.
  - The no-match state and the no-audio-selected state should not contradict
    each other.
  - If reader-side picking is enabled, it must update the same audio cache as
    chapter-list picking.
  - If reader-side picking stays disabled, every visible message should direct
    users back to the chapter list.
- Future fixer tests:
  - Add a focused UI/unit test around the no-match status message if the phone
    components are testable.
  - Test `allowManualPick` behavior for Phone Quill reader audio dock.
  - Run `npm test -- --test-reporter=spec`.
- Manual checks:
  - In a safe live `/phone` Quill run, load audio files that do not match any
    chapter.
  - Open a chapter.
  - Confirm the visible project-screen message and reader audio dock agree on
    where to pick audio.
  - Confirm a local audio file can still be attached without uploading audio.
- Marie approval needed: choose whether she prefers reader-side picking or a
  clear "back to chapter list" flow before a future code-fix task.

### 12.0 Accessibility And Keyboard UX

Goal: make the main reader, overlay, and control surfaces usable by keyboard
and assistive-tech users without creating one-off fixes in each mode.

#### 12.1 Add accessible dialog behavior to cross-mode overlays

- Source bug/risk: `SAS-AUD-20260602-021`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-021`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 21:42 PDT - Zone Checker - User Experience Quality`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-user-experience-quality/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-user-experience-quality/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed P2 UX/accessibility roadmap item
- TLDR for Marie: Some popups look like popups, but the app does not tell
  keyboards or screen readers that they are popups. The fix is to make all
  these panels behave like proper dialogs.
- Problem: Several current overlay panels are fixed `div` stacks with
  outside-click and `Escape` close behavior, but the checker did not find
  `role="dialog"`, `aria-modal`, focus trapping, or focus return.
- Why it matters: Keyboard and assistive-tech users may tab behind the overlay,
  miss what opened, or lose their place after closing it.
- Likely files:
  - `app/page.js`
  - `app/components/PrebuildMode.js`
  - `app/components/PrepManuscriptMode.js`
  - `app/components/QuillAndInkMode.js`
  - `app/components/ReaderChrome.js`
  - A shared dialog helper/component if a future fixer creates one
- Strategy options:
  - A: Add dialog semantics and focus handling separately in each overlay.
  - B: Create one shared app dialog pattern and move the known overlays onto
    it.
  - C: Use a proven accessible dialog primitive if one is already compatible
    with the app's frontend stack.
- Recommended route: B, or C if the repo already has a suitable dependency.
- Why: This is a repeated cross-mode problem. One shared pattern is less likely
  to drift than five separate fixes.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // <AppDialog
  //   open={isOpen}
  //   titleId="settings-title"
  //   onClose={closeDialog}
  //   initialFocusRef={firstButtonRef}
  //   returnFocusRef={triggerButtonRef}
  // >
  //   ...
  // </AppDialog>
  //
  // AppDialog should:
  // - render role="dialog" and aria-modal="true"
  // - keep Tab focus inside while open
  // - close on Escape
  // - return focus to the opener after close
  // - avoid closing on accidental inner clicks
  ```
- Edge cases:
  - Nested overlays should not trap focus in the wrong layer.
  - Existing outside-click close behavior should still feel natural.
  - Escape should close the topmost overlay only.
  - Focus return should still work if the original trigger unmounts.
  - Mobile/phone surfaces need the same semantics without breaking touch use.
  - The fix should not change save data, cloud data, or audio behavior.
- Future fixer tests:
  - Add a focused component test for dialog focus trap and Escape close if the
    test setup supports it.
  - Run the existing test suite, likely `npm test -- --test-reporter=spec`.
  - Run a safe browser/Electron keyboard pass over each listed overlay.
- Manual checks:
  - Open each help/settings/modal overlay from the listed files.
  - Press Tab repeatedly and confirm focus stays inside.
  - Press Escape and confirm it closes.
  - Confirm focus returns to the button or control that opened it.
  - Confirm mouse/touch users can still close the overlay normally.
- Marie approval needed: approve a future accessibility fix pass and decide
  whether the fixer may introduce a shared dialog component.

#### 12.2 Add keyboard paths for core reader word actions

- Source bug/risk: `SAS-AUD-20260602-022`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-022`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 21:42 PDT - Zone Checker - User Experience Quality`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-user-experience-quality/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-user-experience-quality/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed P1 reader accessibility roadmap item
- TLDR for Marie: Some of the most important reader actions need a mouse or
  tap. A keyboard user needs a way to choose words and open the same actions.
- Problem: Shared chapter reader words and phone reader words use pointer
  handlers, the desktop chapter reader disables native text selection, and the
  Proof word action menu opens from double-click without a matching keyboard
  path.
- Why it matters: This affects core app use, not a side setting. A user should
  be able to make flags, annotations, or word-level actions without a pointer.
- Likely files:
  - `app/components/ChapterReader.js`
  - `app/phone/_components/PhoneReader.js`
  - `app/components/ProofingReader.js`
  - Shared reader interaction helpers if a future fixer extracts them
- Strategy options:
  - A: Make individual word spans focusable and handle Enter/Space for the
    same action as click or double-click.
  - B: Add a reader-level keyboard mode where arrow keys move a word cursor
    and Enter opens the current word action.
  - C: Restore safe native text selection and provide keyboard-accessible
    action buttons for the selected text.
- Recommended route: B for the long-term shared reader goal, with A as a
  smaller first step where needed.
- Why: The build plan wants one shared reader. A shared keyboard model prevents
  Proof, Quill, and Phone from inventing different interaction rules.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // const readerKeyboard = useReaderKeyboardNavigation({
  //   words,
  //   onActivateWord: openWordActions,
  //   onExtendSelection: updateSelectionRange,
  // });
  //
  // Reader container:
  // - has a clear focus target
  // - arrow keys move the active word
  // - Shift+arrow extends a range if range selection is supported
  // - Enter or Space opens the same menu/action as pointer activation
  // - Escape clears reader selection or closes the word menu
  ```
- Edge cases:
  - Long chapters with thousands of words should not become slow.
  - Screen readers should not receive thousands of noisy tab stops if a
    container-level cursor model is used.
  - Touch and mouse behavior must continue to work.
  - Proof word actions and Quill annotations may need different labels but the
    same navigation base.
  - Phone browser keyboard behavior may differ from desktop browser behavior.
  - The fix must not change annotation ranges, flag timestamps, or audio sync.
- Future fixer tests:
  - Add tests for keyboard activation of a word action where possible.
  - Add range/selection tests if the shared reader has testable state helpers.
  - Run `npm test -- --test-reporter=spec`.
  - Run a safe live keyboard-only pass over Proof, Quill, and Phone Quill.
- Manual checks:
  - Open a Proof reader and open the word action menu without a mouse.
  - Open a Quill chapter and create or start an annotation without a mouse.
  - Open Phone Quill and confirm equivalent keyboard behavior where the device
    supports it.
  - Confirm mouse/touch selection still works after the keyboard path is added.
- Marie approval needed: approve a future reader-accessibility fix and choose
  whether the first pass should be minimal keyboard activation or the fuller
  shared reader keyboard model.

#### 12.3 Add accessible names and state to disclosure and icon-only controls

- Source bug/risk: `SAS-AUD-20260602-023`
- Source references:
  - `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` ->
    `SAS-AUD-20260602-023`
  - `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` ->
    `Run 2026-06-02 21:42 PDT - Zone Checker - User Experience Quality`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-user-experience-quality/checker.md`
  - `docs/audits/monitors/2026-06-02-manual-start/zone-user-experience-quality/conflicts.md`
- Status: `ready-for-Marie-review`
- Type: confirmed P2 control accessibility roadmap item
- TLDR for Marie: Some buttons only show symbols like arrows, plus, or X. The
  app needs to give those buttons real names and say when expandable sections
  are open or closed.
- Problem: Proof expanders use glyph swapping without `aria-expanded`, and
  several glyph/icon-only controls rely on symbols or `title` instead of a
  clear accessible name.
- Why it matters: A screen reader can announce a button as just "button" or
  miss whether a section is open. That makes normal app navigation harder than
  it should be.
- Likely files:
  - `app/components/SessionsView.js`
  - `app/components/ReaderChrome.js`
  - `app/components/ProofingReader.js`
  - `app/components/QuillAndInkMode.js`
  - `app/phone/page.js`
  - `app/page.js`
  - A shared icon/disclosure button helper if a future fixer creates one
- Strategy options:
  - A: Add `aria-label` and `aria-expanded` directly at each listed control.
  - B: Create shared `IconButton` and `DisclosureButton` helpers, then migrate
    the listed controls onto them.
  - C: Use an accessibility lint rule to catch future unlabeled icon buttons.
- Recommended route: A plus B where the controls repeat, with C as a follow-up
  if the repo's lint setup can support it.
- Why: Direct labels fix the immediate release risk. Shared helpers keep future
  buttons from repeating the same mistake.
- Suggested code logic, not app code:
  ```js
  // Proposed shape only:
  // <button
  //   type="button"
  //   aria-label={isOpen ? 'Collapse chapter' : 'Expand chapter'}
  //   aria-expanded={isOpen}
  //   aria-controls={panelId}
  // >
  //   {isOpen ? '▲' : '▼'}
  // </button>
  //
  // <IconButton label="Delete option" onClick={handleDelete}>
  //   <XIcon aria-hidden="true" />
  // </IconButton>
  ```
- Edge cases:
  - Labels should include context when repeated buttons appear in a list, such
    as "Delete custom option: Mood".
  - `aria-expanded` should only appear on real disclosure controls.
  - `title` can remain as a tooltip but should not be the only name.
  - Visible symbols should be hidden from assistive tech when a clear label is
    present.
  - Phone and desktop labels should stay consistent.
  - Changes must not alter click behavior, expanded state, or saved settings.
- Future fixer tests:
  - Add accessibility-oriented component tests for the main disclosure helper
    if the test setup supports it.
  - Run `npm test -- --test-reporter=spec`.
  - Run an accessibility-tree or screen-reader spot check over Proof, settings,
    Quill, and phone controls.
- Manual checks:
  - In Proof, expand and collapse chapters/sections and confirm the state is
    announced.
  - In Quill/settings/phone flows, tab to glyph-only buttons and confirm each
    announces a useful action name.
  - Confirm the visible UI layout does not shift after labels are added.
- Marie approval needed: approve a future control-accessibility cleanup and
  decide whether the fixer should also add a lint/check rule to prevent
  unlabeled icon controls from coming back.
