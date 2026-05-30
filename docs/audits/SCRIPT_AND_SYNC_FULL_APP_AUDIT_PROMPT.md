# Script and Sync Full-App Audit Prompt

Copy this entire file into a fresh AI session. The AI should audit, not fix.
The job is to crawl Script and Sync / StJohn Author Studio 4.0 from the outside
like a real user, then trace code only when needed to explain a bug.

Do not use Typing and Tomes for this audit. That app was only a formatting
reference for this prompt.

---

## Who You Are Reporting To

Marie is a non-coder author. She needs plain English first, then technical
evidence. Do not say "probably", "should work", or "clean" unless you can name
exactly what you checked.

Use this rule:

- Tested live: say what file/data/account you used.
- Code-traced only: say it was code-traced only.
- Not tested: say not tested.
- Unclear: say what would be needed to settle it.

Do not fix code during this audit. Write a report.

---

## Working Directory

```txt
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0
```

This is the Script and Sync / StJohn Author Studio 4.0 repo.

Important release rule:

- The real user-facing packaged app is in `Script and Sync Releases/`.
- `dist/`, `.next/`, and `out/` are build/staging output.
- Do not tell Marie to open the app from `dist/`.

Protect real user data:

- Do not delete or overwrite `Save Data/`.
- Do not rename or move release files.
- Create audit artifacts in a clearly named temporary folder only.
- For Electron dev tests, a temp project copy alone is not enough. Launch with
  an isolated `/tmp` `HOME`, then verify the Documents mirror under the real
  home did not change. If you cannot prove that, stop and log
  `environment-blocked`.

---

## Read These First, In This Order

1. `HANDOFF.md`
2. `CLAUDE.md`
3. `TODO.md`
4. `READ ME FIRST - OPEN THIS.txt`
5. `docs/BUILD_PLAN_V4.md`
6. `docs/APP_STRUCTURE.md`
7. `docs/SHARED_COMPONENTS.md`
8. `docs/INTERNAL_FUNCTION_TREE.md`
9. `docs/FRONT_FUNCTION_TREE.md`
10. `docs/WIRING_MATRIX.md`
11. `docs/CLOUD_SCHEMA.md`
12. `docs/CLOUD_SAFETY_AUDIT.md`
13. `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`
14. `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
15. `package.json`

At the start and end of each audit section below, re-check the source goals and
structure docs. If a source doc conflicts with the UI or code, report the drift.

---

## Ground Rules

- Audit every visible feature externally.
- Use the packaged app when verifying release behavior.
- Use dev mode only when you need logs or faster iteration.
- Do not use Marie's real books unless she explicitly gives you a package.
- Generated Lorem Ipsum manuscripts are fine for import/export/button tests.
- Generated audio is fine for attach/playback/export tests.
- For true transcription and sync accuracy, generated audio is only a smoke
  test. Ask Marie for a real manuscript/audio package if exact alignment matters.
- Audio files must never be uploaded to Supabase.
- Prep and Duet are local-only by current plan.
- Proof and Quill have cloud paths.
- Phone must work without Mac local audio paths.
- If you cannot find a button or workflow, log it as `needs-navigation-proof`.
  Do not call it a bug until the real UI path has been found and tested.
- Every confirmed bug must be added to
  `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` before moving to the next workflow.
- Fixed items stay in the bug log under `Fixed / Archived`; do not delete old
  bug details.

---

## Before You Touch The App

Run these first:

```bash
git status --short
npm test -- --test-reporter=spec
```

Record:

- Any dirty files before you started.
- Test result and exit code.
- Whether `.env.local` exists.
- Whether `Script and Sync Releases/StJohn Author Studio.app` exists.
- Whether `Script and Sync Releases/StJohn Author Studio (Windows).exe` exists.

If tests fail before you start, continue the audit but mark every dependent
result as affected by pre-existing test failure.

---

## Create A Safe Audit Workspace

Create audit-only artifacts outside Marie's real Save Data:

```txt
docs/audits/artifacts/full-app-audit-<date>/
```

Suggested generated files:

- `audit-proof-manuscript.docx`
- `audit-prep-dialogue.docx`
- `audit-duet-markers.docx`
- `audit-quill-annotations.docx`
- `audio/chapter-01.m4a`
- `audio/chapter-02.m4a`
- `audio/wrong-chapter.m4a`
- `expected-results.md`

Use generated text that contains:

- 3 chapters.
- 2 narrators.
- Dialogue with repeated short lines like "No."
- Curly and straight quotes.
- Scene breaks.
- Character names with punctuation.
- One long paragraph.
- One very short chapter.
- One chapter with no audio.

For Mac audio generation, try:

```bash
say -o docs/audits/artifacts/full-app-audit-<date>/audio/chapter-01.aiff "Chapter one. This is audit audio for Script and Sync."
afconvert docs/audits/artifacts/full-app-audit-<date>/audio/chapter-01.aiff docs/audits/artifacts/full-app-audit-<date>/audio/chapter-01.m4a -f m4af -d aac
```

If generated audio cannot be made, ask Marie for an audio package and mark
audio/transcription checks as blocked.

---

## Section A - Source Goal And Structure Audit

Check:

- Does the current tree match `docs/APP_STRUCTURE.md`?
- Does `FRONT_FUNCTION_TREE.md` match the real UI?
- Does `WIRING_MATRIX.md` match the real UI and current status?
- Do any docs claim a feature is verified live without a real filename/date?
- Are there duplicated readers, import flows, save paths, or cloud clients that
  violate the shared-system goal?

Report:

- Doc drift.
- Missing source maps.
- Any "verified" claim you cannot prove.

---

## Section B - Desktop Shell And Settings

Externally test:

- App launch.
- Home screen loads without fake sample data.
- Four-mode switcher.
- Project lists for Proof, Prep, Duet, Quill.
- Save folder display.
- Change save folder flow, without pointing at Marie's real files.
- Settings opens and closes cleanly.
- Account sign in/out controls.
- Drive snapshot card if signed in and available.
- Manual "Snapshot now" if safe.
- Backup info and retention display.
- No mode loses its list after switching away and back.

Trace in code only if the UI fails:

- `app/page.js`
- `packages/backups/index.js`
- `main.js` backup IPC handlers
- `preload.js`

---

## Section C - Proof Listen Full Workflow

Externally test with a generated book first:

1. Create new book.
2. Import `.docx`.
3. Map narrators and characters.
4. Save book.
5. Confirm it appears in the book list.
6. Reopen it.
7. Attach audio to one chapter or section.
8. Attach the wrong audio to another section and confirm the UI can recover.
9. Play/pause audio.
10. Change speed.
11. Transcribe one chapter if the Whisper model is present.
12. Cancel transcription if possible.
13. Transcribe all chapters if safe and not too slow.
14. Open proofing reader.
15. Use previous/next chapter.
16. Add a flag with type, note, page, timestamp, and quote context.
17. Edit the flag.
18. Delete the flag.
19. Add multiple flags to multiple chapters.
20. Mark chapter done/undone if the UI exposes it.
21. Export flags to CSV.
22. Export backup JSON.
23. Import backup JSON into a safe audit copy.
24. Export transfer bundle.
25. Import transfer bundle and confirm audio relinks or missing audio is clear.
26. Restart the app and confirm book, flags, transcript, audio metadata, and page
    data still behave correctly.

Specific bug traps:

- Page numbers showing `1` or `?` deep in the book.
- Flags missing quote context.
- Flags duplicated after cloud refresh.
- Audio path works before restart but not after restart.
- Transcriptions vanish after restart.
- CSV drops fields.
- Transfer bundle silently loses audio.

Relevant files:

- `app/components/ManuscriptSetup.js`
- `app/components/SessionsView.js`
- `app/components/ProofingReader.js`
- `app/lib/fuzzyMatcher.js`
- `app/lib/manuscriptPaging.js`
- `app/lib/pdfPaging.js`
- `packages/cloud-sync/proof-sync.js`
- `main.js`

---

## Section D - Prep Manuscript Full Workflow

Externally test:

1. Import a generated dialogue-heavy `.docx`.
2. Confirm chapter detection.
3. Confirm dialogue detection.
4. Assign a main character.
5. Assign a side character.
6. Add a side character.
7. Change an assignment.
8. Remove or clear an assignment if available.
9. Open the safety panel.
10. Verify repeated short dialogue is handled clearly.
11. Export highlighted DOCX.
12. Open or inspect the generated DOCX.
13. Confirm comments/highlights land on the correct dialogue.
14. Export narrator chapter list.
15. Restart app and confirm the Prep project still loads.

Specific bug traps:

- Repeated lines like "No." get comments on every copy.
- Side-voice comments land on the wrong line.
- Existing Word comments break the export.
- Curly quotes and straight quotes mismatch.
- Narrator files omit chapters.
- Prep tries to sync to cloud even though current plan says desktop-only.

Relevant files:

- `app/components/PrepManuscriptMode.js`
- `app/components/prepExport.js`
- `packages/manuscript-engine/`
- `tests/prep-export.test.mjs`

---

## Section E - Duet Prep Full Workflow

Externally test:

1. Import generated duet manuscript.
2. Confirm chapter detection.
3. Run marker detection or insertion.
4. Edit marker.
5. Delete marker if available.
6. Export marker list or folder.
7. Inspect exported files.
8. Restart app and confirm project still loads.

Specific bug traps:

- Marker order changes after save/restart.
- Exported markers have wrong chapter names.
- Empty chapters crash export.
- Duet tries to use Proof-only audio state.

Relevant files:

- `app/components/PrebuildMode.js`
- `app/components/ImportFlow.js`
- `main.js` export marker handlers

---

## Section F - Quill & Ink Full Workflow

Externally test:

1. Import generated manuscript.
2. Open a project.
3. Open a chapter.
4. Single-click a word.
5. Select a range.
6. Add an annotation with class, option, character, timestamp, and note.
7. Edit annotation.
8. Delete annotation.
9. Add many annotations across chapters.
10. Use any custom option/class feature if visible.
11. Attach audio if the mode exposes audio.
12. Transcribe/sync if the mode exposes it.
13. Export CSV.
14. Export InDesign JSX.
15. Inspect CSV row count against annotation count.
16. Inspect JSX entry count against annotation count.
17. Restart app and confirm annotations, chapters, completion, transcript, and
    local audio metadata behave correctly.

Specific bug traps:

- Annotation count differs between UI, CSV, and JSX.
- Deleted annotations come back after restart or cloud refresh.
- Word selection shifts after reopening.
- Audio path persists locally but leaks to Supabase.
- Quill phone cannot see data that desktop saved.

Relevant files:

- `app/components/QuillAndInkMode.js`
- `app/components/BookDetail.js`
- `app/components/ChapterReader.js`
- `packages/quill-engine/`
- `packages/cloud-sync/quill-sync.js`
- `tests/quill-exporters.test.mjs`

---

## Section G - Phone Companion Workflow

Use the phone route:

```txt
http://localhost:<port>/phone
```

Externally test:

- Sign in.
- Sign out.
- Sign up only if Marie approves using a test email.
- Resend confirmation only if safe.
- Forgot password only if safe.
- Script project list.
- Open Script chapter.
- Pick local phone audio or browser-supported local file.
- Play/pause/speed.
- Add Proof flag.
- Edit/delete Proof flag if visible.
- Export Proof CSV.
- Quill project list.
- Open Quill chapter.
- Select word/range.
- Add Quill annotation.
- Edit/delete Quill annotation if visible.
- Export Quill CSV.
- Refresh page and confirm cache behavior.
- Go offline/online if possible and test pending flag queue.

Specific bug traps:

- Phone shows Mac local file paths.
- Phone overwrites cloud with empty cache.
- Offline flags vanish.
- Deleted flags or annotations return.
- Account A data appears after signing in as account B.

Relevant files:

- `app/phone/page.js`
- `app/phone/_components/`
- `app/phone/_lib/`
- `packages/cloud-sync/flag-queue.js`
- `packages/cloud-sync/proof-sync.js`
- `packages/cloud-sync/quill-sync.js`

---

## Section H - Cloud Safety And Supabase

Read-only checks unless Marie approves a test account/write test.

Verify:

- All Supabase calls go through `packages/cloud-sync/`.
- Proof writes only these tables:
  - `script_sync_projects`
  - `script_sync_section_transcriptions`
  - `script_sync_flags`
- Quill writes only these tables:
  - `quill_projects`
  - `quill_chapters`
  - `quill_annotations`
- Prep and Duet do not write cloud rows.
- Audio fields are stripped before upload.
- No `supabase.storage` audio upload path exists.
- Deletes create correct tombstone behavior.
- Offline flag queue preserves saves and deletes.
- Pulling cloud data never replaces a better local copy with empty data.
- Project deletion on one device cannot resurrect from another device without
  being reported.

If Supabase access exists, inspect row counts, schemas, RLS, and orphan rows.
Do not delete live data.

Specific bug traps:

- Audio path in any cloud payload.
- Orphan `script_sync_flags`.
- Orphan `quill_annotations`.
- Large transcript blobs duplicated in multiple places.
- Account swap leaks previous user's local state.

Relevant files:

- `packages/cloud-sync/client.js`
- `packages/cloud-sync/audio-guard.js`
- `packages/cloud-sync/cloud-slim.js`
- `packages/cloud-sync/proof-sync.js`
- `packages/cloud-sync/quill-sync.js`
- `packages/cloud-sync/tombstones.js`
- `packages/cloud-sync/flag-queue.js`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

---

## Section I - Export And Restore Safety

Test or inspect every export/import:

- Proof flags CSV.
- Quill annotations CSV.
- Quill InDesign JSX.
- Prep highlighted DOCX.
- Prep narrator chapter list.
- Duet marker export.
- Backup JSON export.
- Backup JSON import.
- Transfer bundle export.
- Transfer bundle import.
- Drive snapshot ZIP.

For every export:

- Open or inspect the file.
- Count rows/items against UI state.
- Confirm names, chapters, timestamps, pages, quote text, narrator/character,
  and notes survive.
- Confirm dangerous local-only data does not enter cloud exports unless the
  export is explicitly local transfer.

For every import/restore:

- Import into a safe audit project only.
- Confirm old data is not silently overwritten.
- Confirm bad/corrupt file handling is understandable.

---

## Section J - Error And Edge Case Sweep

Test:

- Missing audio file after restart.
- Wrong audio file attached.
- No internet on phone load.
- Sign out mid-save.
- Two tabs/windows editing same project if possible.
- Large project with 25+ chapters.
- Empty manuscript.
- Bad `.docx` file.
- PDF page scan missing.
- Cancel file picker.
- Permission denied on export path.
- Duplicate project names.
- Duplicate chapter names.
- Unicode, punctuation, and long filenames.
- Very long annotation note.
- Very long flag note.
- Delete then undo/recreate where available.

Report exact repro steps for every bug.

---

## Section K - Code Health Sweep

Run:

```bash
rg -n "TODO|FIXME|fake|sample|demo|should work|verified|cleaned up|all paths|every button" app packages docs tests main.js preload.js -g '!node_modules/**' -g '!dist/**' -g '!.next/**' -g '!out/**'
rg -n "createClient\\(|from\\(" app packages main.js preload.js -g '*.js' -g '!node_modules/**'
rg -n "audioPath|audioPaths|audioBlob|audioUrl|supabase.storage|storage\\.from" app packages main.js preload.js -g '*.js' -g '!node_modules/**'
rg -n "<button|onClick=|aria-label=" app -g '*.js' -g '!node_modules/**'
```

Check:

- Dead buttons.
- Duplicate implementations of shared UI.
- Supabase calls outside `packages/cloud-sync/`.
- Audio upload risks.
- Claims in docs that are not true.
- Large files where a bug-prone feature may hide.

Do not refactor. Report only.

---

## Section L - Release Readiness

Verify:

- `npm test -- --test-reporter=spec`
- `npm run build`
- Packaged Mac app exists in `Script and Sync Releases/`.
- Windows release files exist in `Script and Sync Releases/`.
- `READ ME FIRST - OPEN THIS.txt` points to the correct release names.
- No one is told to use `dist/`.
- The packaged app launches if you can safely launch it.
- Save folder shown in-app points somewhere safe and expected.

If you run a packaged app, say exactly which app path you opened.

---

## Output File

Write the report here:

```txt
docs/audits/<YYYY-MM-DD>-script-sync-full-app-audit.md
```

If you cannot write the report, return it in chat using the format below.

---

## Required Report Format

```md
# AUDIT REPORT - Script and Sync Full App - <date>

## Plain-English Summary

- Overall verdict: <safe / risky / blocked / not enough tested>
- Biggest risk Marie should know first: <one sentence>
- What was tested live: <short list>
- What was code-traced only: <short list>
- What was not tested: <short list>

## Counts

- P0 release blockers: <number>
- P1 serious bugs: <number>
- P2 medium bugs: <number>
- P3 polish/issues: <number>
- Unknowns needing Marie files or account access: <number>

## P0 Release Blockers

- None found.

or

- <title>
  - Area: <mode/export/cloud/etc>
  - Evidence: <file path + line, screenshot path, output file path, or repro>
  - Repro steps: <numbered>
  - Expected: <plain English>
  - Actual: <plain English>
  - Why it matters: <plain English>

## P1 Serious Bugs

<same format>

## P2 Medium Bugs

<same format>

## P3 Polish Or Follow-Up

<same format>

## Feature Crawl Matrix

| Area | Feature | Tested live? | Code traced? | Result | Evidence |
|---|---|---:|---:|---|---|
| Proof | Create book | yes/no | yes/no | pass/risk/bug/unknown | path or note |

## Export/Import Results

| Export/import | Tested file | Expected count | Actual count | Result |
|---|---|---:|---:|---|

## Cloud Safety Results

| Check | Result | Evidence |
|---|---|---|

## Save/Restart Results

| Mode | Data checked after restart | Result | Evidence |
|---|---|---|---|

## Source-Doc Drift

- <doc path> says <claim>, but <evidence> shows <actual>.

## What Needs Marie's Real Files

- <workflow> needs <manuscript/audio/cloud account> because <reason>.

## Commands Run

```bash
<command>
```

Result: <exit code and short output summary>

## Files Created During Audit

- <artifact path>

## Final Recommendation

1. <next action>
2. <next action>
3. <next action>
```

Do not end with a vague confidence score. End with what should happen next.
