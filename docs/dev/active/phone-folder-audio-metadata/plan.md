# Phone folder audio + metadata plan

## Source goals checked

- `CLAUDE.md`: phone audio stays local; only filenames sync; reuse shared reader/audio/cloud helpers.
- `docs/BUILD_PLAN_V4.md`: Phase 9 phone scope includes project list, local audio pick, flag/annotation save, and CSV export.
- `docs/FRONT_FUNCTION_TREE.md` / `docs/INTERNAL_FUNCTION_TREE.md`: phone Script + Quill are intended phone companion flows.

## Goal

Patch the phone app so Proof and Quill both support Marie's simple phone flow:
pick one local audio folder for a project, auto-match chapter/section files by cloud filename, use the phone player, save flags/annotations with useful metadata, and export CSV from the phone.

## Steps

1. Check existing phone Proof and Quill behavior against the source goals.
   Verify: identify what is already present before editing.
   Re-check source goals before moving on.

2. Patch Quill phone audio parity.
   Add project-level folder picker, chapter filename matching, audio player/speed/sync, and annotation timestamp capture.
   Verify: code compiles and existing Proof behavior is not removed.
   Re-check source goals before moving on.

3. Verify metadata paths.
   Check Proof flags and Quill annotations still pull from Supabase rows and export expected CSV fields.
   Verify: automated tests/guardrails pass, then run a production build if needed.
   Re-check source goals before moving on.

4. Update `TODO.md`.
   Record what was patched and what Marie still needs to test on the phone.
   Ask Marie before archiving or closing this plan.
