# Cloud schema — canonical reference

This is what's actually in Supabase project `evcusovtjfypfyfvnooy`
("Typing and Tomes 2.0 DATA"). Audit performed 2026-05-26.

## The four StJohn 4.0 tables

All four have RLS enabled. Owner_id is the auth.users uuid.

### `script_sync_projects` — Proof audiobooks

| column | type | notes |
|---|---|---|
| `id` | uuid PK | aka `cloudId` on the client |
| `owner_id` | uuid FK auth.users | RLS scope |
| `title` | text | book title |
| `desktop_book` | jsonb | **slimmed** book — title/chapters/sections, NO flags, NO whisper data, NO audio paths |
| `desktop_book_hash` | text | FNV-1a hash, used by the client to skip no-op pushes |
| `section_count` | int | denormalised count for quick UI |
| `ready` | bool | true once the desktop pushes |
| `created_at` / `updated_at` | timestamptz | |

### `script_sync_section_transcriptions` — whisper output per section

One row per section that has been transcribed.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK | cascade delete |
| `owner_id` | uuid FK auth.users | |
| `section_id` | text | local section id (matches `desktop_book.chapters[].sections[].id`) |
| `chapter_id` / `chapter_index` / `section_index` | text/int/int | fallback keys for matching |
| `audio_file_name` | text | basename only (no path) |
| `transcription` | jsonb | `{ words, alignment, audioKey, textHash }` — the heavy whisper output |
| `transcription_hash` | text | content hash |

### `script_sync_flags` — proof flags per section

One row per flag. Schema mirrors the desktop CSV columns.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid FK | cascade delete |
| `owner_id` | uuid FK auth.users | |
| `section_id` | text | which section the flag belongs to |
| `local_id` | text | client-generated stable id |
| `flag` | jsonb | `{ ts, page, narrator, type, sentPlain, note, ...the whole flag }` |
| `flag_hash` | text | content hash |

### `quill_projects` / `quill_chapters` / `quill_annotations`

Same shape as Proof but with chapters and annotations as their own rows.
`desktop_project` is the slimmed manuscript blob (no `annotations`, no
`chapters[].alignment`).

## What does NOT travel to Supabase

`packages/cloud-sync/audio-guard.js` strips these recursively from every
book/project before upload:

- `audioPath`, `audioPaths`, `audioUrl`, `audioBlob`, `audioDataUrl`,
  `audioBuffer`, `audioBytes`, `audioBase64`, `sourceAudioPath`,
  `sourceAudioBytes`, `audio`
- ArrayBuffer and typed array values

Only `audioFileName` (the bare basename string) travels. The phone uses
that filename to look for a local match in a folder Marie picked.

`packages/cloud-sync/cloud-slim.js` then drops these from the JSONB
blob (they're in dedicated tables):

**Proof** (`desktop_book`):
- `chapters[].sections[].flags` — in `script_sync_flags`
- `chapters[].sections[].whisperWords` / `whisperAlignment` /
  `whisperTranscript` / `whisperAudioKey` / `whisperTextHash` /
  `whisperMatchedCount` / `whisperManuscriptWordCount` /
  `whisperMatchQuality` / `whisperSourceUpdatedAt` / `transcribedAt`
  — in `script_sync_section_transcriptions`

**Quill** (`desktop_project`):
- `annotations` — in `quill_annotations`
- `chapters[].alignment` / `whisperAlignment` / `whisperWords` — in
  `quill_chapters`

Measured impact: ~90% smaller blobs once a book is fully transcribed.

## Write path — single push

`pushProofProject(supabase, book, ownerId)`:
1. **Slim the book** (`stripAudioPaths` then `slimBookForCloud`)
2. **Hash-gate** — compute composite hash of (slim book, flag set,
   transcription set). If unchanged since the last push for this
   `cloudId` in this tab, return immediately. No round-trips.
3. Upsert the `script_sync_projects` row.
4. Delete all rows for this project in `script_sync_section_transcriptions`, insert the current set.
5. Delete all rows for this project in `script_sync_flags`, insert the current set.

`pushQuillProject` follows the same shape with `quill_*` tables.

## Read path — single pull

`pullProofProjects(supabase)`:
1. Fetch all `script_sync_projects` rows for this user (ordered newest first).
2. Fetch all `script_sync_section_transcriptions` for those project ids.
3. Fetch all `script_sync_flags` for those project ids.
4. Reconstruct each book: take `desktop_book` as the base; for each
   section, if the transcriptions table has a row, overlay
   `whisperWords` / `whisperAlignment` / etc; if the flags table has
   rows, overlay `flags`.

`pullQuillProjects` follows the same shape.

## Delete path

`deleteProofProject(supabase, cloudId)` deletes the project row;
transcriptions + flags cascade via FK.

`deleteQuillProject` — same.

### Tombstones (`packages/cloud-sync/tombstones.js`)

When the user deletes locally:
1. Write the project id + cloud uuid to a localStorage tombstone set
   (scoped per service: `proof` / `quill`).
2. Filter local state.
3. Fire cloud delete (background).

When the next pull comes back, `applyTombstonesToCloudList`:
1. Drops any cloud project whose id is tombstoned.
2. Retries the cloud delete in the background for any tombstoned id
   that's still in the cloud (handles the case where the original
   delete failed).

This is what stops a fire-and-forget delete from being undone by a
focus-pull racing it.

## Race-condition mitigation: focus-pull

Both desktop (`app/page.js`) and phone (`app/phone/page.js`) re-pull on
window focus + tab visibility change. Whichever device the user is
looking at gets the freshest state before any local edit triggers a
push.

When the cloud version is newer, the merge (`mergePreservingLocalAudio`)
preserves local `audioPath` / `audioPaths` / `audioDurationCache` on a
per-section basis — audio attachments never get wiped by a cloud sync.

## Tables that exist but aren't used by StJohn 4.0

- `app_data` — generic key/value JSONB, unused by current app
- `loveworn_projects` / `loveworn_chapters` / `loveworn_annotations` —
  pre-rename of Quill, contains 1 legacy row, safe to ignore
- `godmode_*` / `xp_curve_tester_drafts` — different project entirely

Leave these alone unless Marie asks to clean them up.

## Cloud advisor notes (low priority, future cleanup)

`get_advisors` reports against StJohn-relevant tables:

- 30 × `auth_rls_initplan` — RLS expressions re-evaluate `auth.uid()`
  per row instead of caching. Wrap with `(select auth.uid())` to fix.
- 18 × `multiple_permissive_policies` — multiple policies on the same
  role/action; PostgreSQL ORs them.
- 11 × `unused_index` — created indexes that no query has used. Drop
  to save storage + speed up writes.
- 5  × `unindexed_foreign_keys` — FK columns without supporting
  indexes; slows cascade deletes.
- 1  × `duplicate_index` — `script_sync_transcriptions_project_section_idx`
  duplicates `script_sync_section_transcriptions_project_section_idx`.

None of these block functionality. Address as a maintenance pass when
the working set gets large.
