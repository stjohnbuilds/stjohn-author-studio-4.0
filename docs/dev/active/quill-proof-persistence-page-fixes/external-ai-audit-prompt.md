# External AI Audit Prompt

You are auditing StJohn Author Studio 4.0 for release readiness. Treat this as a serious production review, not a quick skim. Read the source goals first, then inspect the full internal and external tree before making claims.

## Project

Repository path:

`/Users/mariemackay/Dev/StJohn-Author-Studio-4.0`

Primary source docs to read first:

- `docs/BUILD_PLAN_V4.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/dev/active/quill-proof-persistence-page-fixes/plan.md`
- `docs/dev/active/quill-proof-persistence-page-fixes/context.md`
- `docs/dev/active/quill-proof-persistence-page-fixes/tasks.md`

## Audit Scope

Review all major modes:

- Proof Listen desktop
- Proof Listen phone
- Quill & Ink desktop
- Quill & Ink phone
- Prep Manuscript
- Duet / Prebuild
- Electron packaging for Mac and Windows
- Supabase cloud sync and local persistence

Core files to inspect:

- `app/page.js`
- `app/phone/page.js`
- `app/components/QuillAndInkMode.js`
- `app/components/SessionsView.js`
- `app/components/ProofingReader.js`
- `app/components/ImportFlow.js`
- `app/components/ManuscriptSetup.js`
- `app/components/PrepManuscriptMode.js`
- `app/components/PrebuildMode.js`
- `main.js`
- `preload.js`
- `packages/cloud-sync/*.js`
- `packages/audio-engine/index.js`
- `packages/quill-engine/index.js`
- `scripts/copy-release.js`
- `electron-builder.yml`

## Required Checks

1. Cloud safety
   - Confirm audio files, audio bytes, blob URLs, base64 audio, and local audio paths cannot reach Supabase.
   - Confirm Proof only sends slim book data, flags, and transcription rows.
   - Confirm Quill only sends slim project data, chapter text/alignment, audio file names, and annotations.
   - Confirm PDF heavy page text is not pushed unnecessarily.
   - Check sign-out, account switching, RLS assumptions, tombstones, pending phone queues, and hash gates.

2. Persistence
   - Proof audio paths persist locally and stay local to one machine.
   - Quill audio paths persist locally and stay local to one machine.
   - Proof transcriptions survive restart and cloud pull.
   - Quill transcriptions/alignment survive restart and cloud pull.
   - Opening or editing a Proof project reliably moves it to the top of the home list.
   - Cloud pulls do not overwrite local-only path data.

3. Proof page numbers
   - Import with matching PDF builds `pdfPageMap`.
   - Upload PDF after import builds `pdfPageMap`.
   - Rescan page numbers rebuilds `pdfPageMap`.
   - Cloud slim/pull does not make the app think page numbers are missing.
   - Desktop reader flags use `pdfPageMap` first.
   - Phone flags use `pdfPageMap` first.
   - Late-book flags should not become page `1` or `?` when a valid PDF map exists.

4. Phone workflows
   - Proof phone flag panel has quote, page, narrator/engineer, type, note, timestamp, and CSV export.
   - Narrator can be selected from suggestions or typed manually.
   - Phone flag save uses single-row cloud upsert and does not clobber other flags.
   - Quill phone can pull chapters/annotations and push annotations without audio paths.
   - Phone cache should not wipe good local data on empty or failed cloud pulls.

5. Edge cases
   - Restart after attaching audio.
   - Restart after transcription.
   - Cloud newer than local after phone edits.
   - Local newer than cloud after desktop edits.
   - Missing Supabase config.
   - Signed out state.
   - Wrong account / empty cloud pull.
   - PDF with front matter, unnumbered pages, missing footer numbers, and late chapters.
   - Large book with many chapters and long alignment arrays.
   - Windows path format vs Mac path format.

6. Packaging
   - Verify `npm test`.
   - Verify production build.
   - Verify Mac release at `Script and Sync Releases/StJohn Author Studio.app`.
   - Verify Windows release scripts/config are still valid.
   - Report whether any generated build files should be committed or ignored.

## Output Format

Start with a release-readiness rating:

- `Ready for tonight`
- `Usable with caution`
- `Not ready`

Then list findings by severity:

- Critical: blocks real use or risks data loss/security.
- High: likely to break a core workflow.
- Medium: edge-case bugs or confusing behavior.
- Low: cleanup, wording, non-blocking polish.

For each finding include:

- File and line reference.
- What can go wrong.
- Exact reproduction steps or reasoning.
- Suggested fix.
- Whether it affects Mac, Windows, phone, or Supabase.

End with:

- Specific tests you ran.
- Specific tests you could not run.
- A short “what I would verify manually tonight” checklist.

Do not give vague assurances. If you cannot prove something, say so.
