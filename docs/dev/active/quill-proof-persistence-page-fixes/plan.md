# Quill + Proof Persistence/Page Fix Plan

Source goals checked: `docs/BUILD_PLAN_V4.md`, `docs/CLOUD_SCHEMA.md`, `docs/FRONT_FUNCTION_TREE.md`, `docs/INTERNAL_FUNCTION_TREE.md`.

## Goal

Make the app usable for Marie's immediate Mac workflow:

1. Quill local paths survive restart.
2. Quill transcription/alignment data persists to the backend for phone use.
3. Proof PDF/page maps persist and produce accurate flag page numbers.
4. Proof last-worked ordering updates after real work.
5. Mac package is rebuilt after fixes.

## Rules

- Audio file paths stay local to the machine.
- Audio bytes/files never go to Supabase.
- Transcript/alignment/page-map data can go to Supabase because the phone needs it.
- Proof page numbers are release-blocking.
- Duet gets a regression check only unless a shared persistence/page fix clearly affects it.

## Steps

### 1. Quill local persistence

What to do:
- Compare Proof's local save/load path with Quill's.
- Fix Quill so chapter audio paths and local-only metadata survive app restart.

What to verify:
- Attach Quill audio, restart packaged/dev app, reopen project, confirm paths remain.

Before moving on:
- Re-check source goals and structure docs.

### 2. Quill transcription backend persistence

What to do:
- Trace Quill transcription/alignment state after transcribe.
- Make sure text/alignment rows are written to `quill_chapters` and restored on desktop/phone pull.

What to verify:
- Transcribe a Quill chapter, restart, confirm transcript/alignment remains.
- Confirm Supabase payload contains data only, not audio files or local paths.

Before moving on:
- Re-check source goals and structure docs.

### 3. Proof page-number persistence and accuracy

What to do:
- Trace import PDF/page scan, rescan PDF, local save, cloud slim, and reader lookup.
- Restore the correct scan behavior for Proof.
- Keep Quill from doing unnecessary page scans if that path is currently shared incorrectly.

What to verify:
- Import Proof with PDF, restart, confirm app still knows it has page numbers.
- Add a flag deep in the book and confirm page is real, not `1` or `?`.

Before moving on:
- Re-check source goals and structure docs.

### 4. Proof last-worked ordering

What to do:
- Ensure flag save, transcription, audio attach, and project edits bump `updatedAt`.
- Ensure home sorting uses that timestamp.

What to verify:
- Work on a project, return home, confirm it moves to top.

Before moving on:
- Re-check source goals and structure docs.

### 5. Package and audit prompt

What to do:
- Run tests.
- Rebuild the Mac app.
- Write the external-AI audit prompt/script.

What to verify:
- Mac app exists in `Script and Sync Releases`.
- Known fixes are checked in dev or packaged app.

Before closing:
- Ask Marie before archiving or closing this plan.
