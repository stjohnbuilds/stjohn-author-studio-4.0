# HANDOFF - StJohn Author Studio 4.0

## Copy-Paste Bootstrap For Next Chat

```text
You are continuing work on StJohn Author Studio 4.0 for Marie Mackay.

Before touching code, read these files:
1. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/HANDOFF.md
2. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/CLAUDE.md
3. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/TODO.md
4. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/BUILD_PLAN_V4.md
5. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/CLOUD_SCHEMA.md
6. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/dev/active/quill-proof-persistence-page-fixes/context.md
7. /Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/dev/active/quill-proof-persistence-page-fixes/tasks.md

Current emergency:
Marie opened the freshly rebuilt app, transcribed in Quill, saw the tick appear, switched to another app, came back, and the transcription tick was gone. This means the Quill transcription still is not reliably sticking in visible app state. Paths/transcriptions must be solved before any other polish.

Do not tell Marie it is fixed until you have verified the exact flow:
Quill -> attach audio -> transcribe -> tick appears -> switch away/back -> tick remains -> quit/reopen -> tick remains -> log out/in -> tick remains -> phone can see/use cloud transcription data.
```

## 1. Who Marie Is And How To Talk To Her

Marie is a non-coder author building this app for her audiobook proofing, Quill annotation, special-edition, and audio-prep workflow.

She is exhausted from weeks of bug fixing. Keep replies short, concrete, and plain English. Do not over-explain unless she asks. Say what happened, what you changed, what she should test next.

Do not use coder language with her. Avoid words like refactor, abstraction, hydration, memoization, prop drilling, side effect, idempotent, or anything that sounds like process instead of progress.

When she is testing live and upset, do not brainstorm aloud. Identify the failure, fix or inspect it, and give a calm status update.

## 2. Hard Rules That The Next AI Must Follow

- Quality over speed. Do not rush or slap on a patch that only hides the symptom.
- Read the source before changing it. Use existing app patterns.
- Preserve Marie's data. Do not wipe saved books/projects, paths, or local JSON.
- Audio and PDF files must not be uploaded to Supabase. Only small metadata/text/alignment/flags/annotations may sync.
- Local file paths should stay local to the machine. They can persist locally but should not be cloud-shared.
- Phone cannot use Mac paths. It should use cloud text/alignment plus locally picked/matched phone audio.
- Page numbers are non-negotiable for Proof flags/export.
- Quill transcription must behave like Proof: visible done state, tick/percent, open reader, synced/follow text state, survive restart/logout/login, and be useful on phone.
- After code edits, run `npm run test`. If packaging changed or Marie needs the app, rebuild at least Mac.
- If you edit files, mention the files changed in the final.
- Do not create multiple handover files. Update this file only unless Marie asks.

## 3. Files To Read First, With Exact Paths

Read these first:

1. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/HANDOFF.md`
2. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/CLAUDE.md`
3. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/TODO.md`
4. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/BUILD_PLAN_V4.md`
5. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/CLOUD_SCHEMA.md`
6. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/FRONT_FUNCTION_TREE.md`
7. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/INTERNAL_FUNCTION_TREE.md`
8. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/dev/active/quill-proof-persistence-page-fixes/plan.md`
9. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/dev/active/quill-proof-persistence-page-fixes/context.md`
10. `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/dev/active/quill-proof-persistence-page-fixes/tasks.md`

Then inspect these code files for the current bug:

- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/app/components/QuillAndInkMode.js`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/app/components/SessionsView.js`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/app/page.js`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/app/phone/page.js`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/packages/cloud-sync/quill-sync.js`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/packages/cloud-sync/proof-sync.js`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/packages/cloud-sync/cloud-slim.js`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/main.js`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/preload.js`

Useful local data files:

- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Save Data/books.json`
- `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Save Data/quill-projects.json`

## 4. Broad Vision Of The App

StJohn Author Studio 4.0 is one desktop app plus a phone companion.

Desktop modes:

- Proof Listen: audiobook proofing, flags, timestamps, page numbers, narrator fields, CSV/marker export.
- Quill & Ink: manuscript annotation, audio/transcription support, phone annotation support, CSV/InDesign export.
- Prep Manuscript: manuscript prep.
- Duet/Prebuild: multi-cast audio prep and marker generation.

Phone modes:

- Proof Listen phone side: open synced books, pick local phone audio, flag while listening, export/sync flags.
- Quill phone side: annotate synced manuscript data.

Cloud goal:

- Supabase stores small useful data only: projects, chapter text/html, annotations, flags, transcription/alignment data, audio file names.
- Supabase must not store audio/PDF files or local file paths.

## 5. Current State

Latest local commit:

- `a209222`

Working tree:

- There are many uncommitted edits from the current bug-fix/package pass.
- `git status --short` currently shows modified app files plus generated/untracked `build/` and `docs/dev/`.
- Do not revert user or generated changes without Marie explicitly asking.

Last verified test status:

- `npm run test` passed after the latest code changes.
- Result: 4 tests passed, 0 failed.

Build/package status:

- Mac release rebuilt after the latest source fixes:
  `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Script and Sync Releases/StJohn Author Studio.app`
- Windows portable rebuilt:
  `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Script and Sync Releases/StJohn Author Studio (Windows).exe`
- Windows installer rebuilt:
  `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Script and Sync Releases/StJohn Author Studio Setup.exe`
- Mac bundle verification passed with `codesign --verify --deep --strict`.

Known live URL from prior project state:

- Phone/root: `https://stjohn-author-studio-4.vercel.app/`
- Phone direct: `https://stjohn-author-studio-4.vercel.app/phone`
- These were not re-verified in this handover pass.

What was done in the last session:

- Packaged Mac and Windows releases.
- Added playback speed up to `4x` on desktop and phone:
  - `app/components/AudioDock.js`
  - `app/components/ProofingReader.js`
  - `app/page.js`
  - `app/phone/page.js`
  - `app/components/SessionsView.js`
- Changed Quill so the shared transcription queue's function-style update is handled by the Quill bridge.
- Added a visible `✓ Synced` chip inside the Quill reader when sync alignment exists.
- Changed Proof cloud merge so a cloud copy without transcription data should not wipe local transcription data.
- Closed the settings panel during sign-out/sign-in so it does not stay open.
- Improved Proof PDF page-map persistence and phone page-number lookup.
- Improved Quill local audio path persistence.
- Wrote external audit prompt here:
  `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/docs/dev/active/quill-proof-persistence-page-fixes/external-ai-audit-prompt.md`

Critical current bug:

- After using the rebuilt app, Marie reported:
  - Quill transcribe shows a tick immediately.
  - She switches away to another app.
  - She comes back.
  - The transcription tick is gone.
- This means the Quill transcription still is not reliably sticking in visible state.
- Do not assume the previous bridge fix solved it. It did not fully solve Marie's real flow.

Likely areas to inspect:

- `QuillAndInkMode.js` bridge from `SessionsView` back into Quill project shape.
- Whether `onUpdateBook(currentBook => ...)` writes transcript fields into `allProjects`.
- Whether `persistProjects(allProjects)` writes the finished fields to `Save Data/quill-projects.json`.
- Whether a later cloud push/pull or cloudId backfill replaces the just-transcribed local chapter with a slimmer copy.
- Whether `isChapterTranscriptionCurrent()` in `SessionsView.js` rejects the saved transcription because `whisperAudioKey` or `whisperTextHash` changes after focus/state refresh.
- Whether `chapterTranscripts` memory has the tick but the persisted chapter does not.
- Whether `quill-sync.js` can store alignment but loses `whisperAudioKey`, `whisperTextHash`, `transcribedAt`, `whisperWords`, or quality fields on pull.

## 6. Top 5 Next Jobs In Priority Order

1. Fix Quill transcription tick disappearing after app switch.

   Reproduce exactly. Add temporary logging if needed. Check `Save Data/quill-projects.json` immediately after transcription, after switching apps, after restart, and after logout/login. The tick must remain because the project data says it is transcribed, not only because the queue says "done".

2. Verify Quill transcription cloud-to-phone path.

   After the tick sticks locally, confirm Supabase gets the small alignment/transcription data and the phone can use it. Audio paths must not go to Supabase. Audio file names may go up. Phone still needs local phone audio.

3. Verify Proof logout/login does not wipe transcriptions.

   Marie reported Proof does better than Quill but "it ALL vanished when I log in and log out." The merge patch is in place, but it needs real testing. Test Proof: transcribe, tick remains, logout/login, tick remains, restart, tick remains.

4. Rebuild packages after the real Quill persistence fix.

   Once fixed and tested, run `npm run test`, rebuild Mac with `npm run release:mac`, verify Mac bundle, and rebuild Windows with `npm run release:win` if time.

5. Continue the phone/export/Supabase audit.

   Confirm phone flags include page number, timestamp, narrator/dropdown or typed narrator, type, quote, note, chapter/audio file. Confirm cloud is limited to small data and no PDF/audio bytes or local paths.

## 7. What Only Marie Can Decide Or Do

- Marie must choose the actual book/audio/PDF files to test.
- Marie must confirm whether old Quill "done" queue items should be rerun or whether they must be recovered.
- Marie must log into the real Supabase-backed account for cross-device tests if credentials/session are not already present.
- Marie must confirm whether Windows packaging is needed immediately after every hotfix or whether Mac-only is enough for same-night testing.
- Marie must judge whether page numbers are acceptable against her real PDF/Word doc.

## 8. Where Things Live And The Commands She Actually Uses

Project root:

```bash
cd "/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
```

Start editable app:

```bash
npm start
```

Run tests:

```bash
npm run test
```

Build Mac release:

```bash
npm run release:mac
```

Build Windows release:

```bash
npm run release:win
```

Fresh packaged app:

```text
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Script and Sync Releases/StJohn Author Studio.app
```

Windows releases:

```text
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Script and Sync Releases/StJohn Author Studio (Windows).exe
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Script and Sync Releases/StJohn Author Studio Setup.exe
```

Local saved data:

```text
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Save Data/books.json
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Save Data/quill-projects.json
```

Cloud sync code:

```text
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/packages/cloud-sync/
```

Supabase project URL in local env:

```text
https://evcusovtjfypfyfvnooy.supabase.co
```

Important practical reminder:

- If you change `main.js`, fully quit and restart the Electron app. Renderer reload is not enough.
- If you change packaged output, rebuild the release app before telling Marie to test it.
