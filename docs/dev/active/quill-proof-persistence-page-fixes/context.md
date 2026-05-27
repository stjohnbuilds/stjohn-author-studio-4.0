# Context

Marie tested the packaged Mac app and found:

- Proof paths persisted after restart.
- Quill paths disappeared after restart.
- Proof page numbers are release-blocking: Anarchy reported no page map, then a PDF upload produced bad pages such as page `1` for a late chapter.
- Transcriptions disappearing after restart blocks the phone workflow.
- Local file paths should remain local to each machine.
- Transcript/alignment/page data should persist because phone needs it.
- Last-worked ordering is useful but lower priority than Quill and Proof page numbers.
- Duet is lower priority because it is more one-shot: import, get markers, leave.

Relevant source rules:

- `docs/BUILD_PLAN_V4.md`: audio never goes to Supabase; phone needs manuscript + transcript text; feature done only after Marie verifies on real files.
- `docs/CLOUD_SCHEMA.md`: Proof uses `script_sync_section_transcriptions`; Quill uses `quill_chapters.alignment`; audio paths are stripped before cloud writes.
- `docs/INTERNAL_FUNCTION_TREE.md`: local save path goes through Electron `writeData`; cloud sync goes through `packages/cloud-sync`.
