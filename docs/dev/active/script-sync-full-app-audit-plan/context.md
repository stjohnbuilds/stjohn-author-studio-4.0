# Context

Marie asked for the Typing and Tomes audit style to be recreated for Script
and Sync / StJohn Author Studio 4.0. Typing and Tomes is reference only. This
work belongs in:

`/Users/mariemackay/Dev/StJohn-Author-Studio-4.0`

Reference folder used for format ideas only:

`/Users/mariemackay/Dev/Typing-and-Tomes-3.3-active/docs/audits`

Source goals checked before writing:

- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

Relevant project goals:

- Start from the working Script and Sync 3.0 base.
- One shared direction for reader, audio, manuscript, and cloud systems.
- Audio never goes to Supabase.
- No fake sample data in product code.
- A feature is done only after Marie clicks it on a real file.
- Tests passing is useful, but not the same as real workflow verification.

Current repo state when this plan was created:

- `git status --short` showed one existing modified file: `app/page.js`.
- This plan must not touch or revert that user/previous-session change.

Outcome of this planning pass:

- Add `docs/APP_STRUCTURE.md` because no `docs/APP_STRUCTURE.md` existed.
- Add Script and Sync audit prompts under `docs/audits/`.
- Keep this active plan open until Marie decides whether to archive it.
