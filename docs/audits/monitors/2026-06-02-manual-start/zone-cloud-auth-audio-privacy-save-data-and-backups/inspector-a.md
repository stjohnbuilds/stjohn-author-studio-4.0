# Inspector A — Zone 9: Cloud, auth, audio privacy, save data, and backups

## Scope

Read-only audit of Zone 9 only:

- Supabase client guardrails
- Proof and Quill cloud push/pull paths
- Auth sign-in/sign-out state handling
- Audio-path stripping before cloud writes
- Offline/tombstone safety helpers
- Save-data location boundaries
- Drive snapshot backup path

No product code was changed. No live Supabase writes, real Save Data writes, or
real Google Drive snapshots were performed.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands Run

| Command | Exit |
|---|---:|
| `git status --short` | `0` |
| `npm test -- --test-reporter=spec` | `0` |
| `.env.local` / release-folder presence check | `0` |
| `rg -n "...cloud/auth/audio/backup..." packages/cloud-sync app main.js preload.js tests` | `0` |
| `rg -n "...audioPath/audioBlob/etc..." packages/cloud-sync app` | `0` |
| `rg -n "...pullProofProjects|pullQuillProjects..." tests` | `0` |
| `test -d supabase && echo ... || echo ...` | `0` |
| `node scripts/cloud-safety-test.mjs` | `0` |
| Earlier broad `rg ... supabase` scan | `2` |

Notes:

- `npm test` passed `13/13`.
- The `exit 2` scan happened because the docs mention `supabase/`, but that
  folder is absent in this repo.

## Evidence Paths

- `packages/cloud-sync/client.js:22-60`
- `packages/cloud-sync/audio-guard.js:12-84`
- `packages/cloud-sync/cloud-slim.js:25-101`
- `packages/cloud-sync/flag-queue.js:23-240`
- `packages/cloud-sync/tombstones.js:19-171`
- `packages/cloud-sync/proof-sync.js:46-340`
- `packages/cloud-sync/quill-sync.js:27-290`
- `packages/backups/index.js:16-135`
- `app/page.js:509-527`
- `app/page.js:619-637`
- `app/page.js:639-671`
- `app/page.js:703-778`
- `app/phone/page.js:575-612`
- `app/phone/_lib/projectCache.js:30-68`
- `main.js:292-304`
- `main.js:1347-1387`
- `main.js:1993-2114`
- `docs/CLOUD_SAFETY_AUDIT.md:37`

## Pass Items

1. Cloud table access is tightly fenced. The shared client hard-blocks any
   `supabase.from(...)` call outside the six allowed StJohn tables and also
   blocks all `rpc(...)` calls. Evidence: `packages/cloud-sync/client.js:22-60`.

2. Audio privacy is enforced on both main cloud write paths. Proof and Quill
   both call `stripAudioPaths(...)` before slimming or uploading, and the guard
   removes path/blob/base64-style audio fields recursively while keeping only
   filename-level metadata. Evidence:
   `packages/cloud-sync/audio-guard.js:12-84`,
   `packages/cloud-sync/proof-sync.js:51-58`,
   `packages/cloud-sync/quill-sync.js:32-35`.

3. Desktop sign-out clears in-memory cloud-visible Proof state before another
   session starts, and the phone cache is keyed by `scope:userId` rather than a
   single shared cache key. Evidence:
   `app/page.js:509-527`,
   `app/page.js:821-828`,
   `app/phone/_lib/projectCache.js:30-68`.

4. Proof offline flag retry logic has a real retry cap/backoff and merges
   pending writes back onto fresh pulls before retrying them. Tombstone helpers
   also passed the dedicated cloud-safety script in this run (`6/6 pass`).
   Evidence:
   `packages/cloud-sync/flag-queue.js:61-85`,
   `203-240`,
   `packages/cloud-sync/tombstones.js:121-171`,
   `scripts/cloud-safety-test.mjs`.

5. Backup snapshots stay inside the app’s local JSON save set plus an optional
   cloud snapshot object; the backup path itself does not add raw audio files or
   Save Data folder copies. Evidence:
   `packages/backups/index.js:73-135`,
   `main.js:2065-2092`.

6. Save-data location selection stays scoped to the expected JSON project files
   and reports the active data folder cleanly through the Electron bridge.
   Evidence:
   `main.js:292-304`,
   `main.js:1347-1387`,
   `preload.js:19-20`.

## Fail Items

1. Proof cloud pull can silently return incomplete books if the secondary
   transcription or flag query fails. `pullProofProjects(...)` checks the
   project-row query error, but it does not check errors from
   `script_sync_section_transcriptions` or `script_sync_flags` before building
   the returned book list. That means a partial cloud failure can look like a
   successful pull with missing flags/transcriptions rather than an explicit
   sync failure. Evidence:
   `packages/cloud-sync/proof-sync.js:216-231`,
   `233-286`.

2. Quill cloud pull has the same silent-partial-failure problem. It checks the
   project-row query error, but it ignores errors from `quill_chapters` and
   `quill_annotations` before reconstructing projects. A failed secondary query
   can therefore present as a “successful” pull missing chapter or annotation
   data. Evidence:
   `packages/cloud-sync/quill-sync.js:162-177`,
   `179-285`.

## Watchlist Items

1. Existing adjacent risk, not a new duplicate: the phone pending Proof queue
   count is still global rather than clearly user-scoped. This remains the same
   concern already logged as `SAS-AUD-20260602-003`. Evidence:
   `packages/cloud-sync/flag-queue.js:149-159`,
   `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md:423-446`.

2. `docs/CLOUD_SAFETY_AUDIT.md` still tells reviewers to inspect `supabase/`,
   but this repo has no `supabase/` folder. That is zone-relevant doc drift.
   Evidence:
   `docs/CLOUD_SAFETY_AUDIT.md:37`,
   command result `supabase dir missing`.

3. Automated coverage is still thin for real pull/reconstruction failure paths.
   The current tests found in this run cover `cloud-slim` and the separate
   cloud-safety tombstone script, but I found no dedicated test coverage for
   `pullProofProjects(...)` or `pullQuillProjects(...)` error handling.
   Evidence:
   `tests/cloud-slim.test.mjs`,
   `scripts/cloud-safety-test.mjs`,
   `rg -n "pullProofProjects|pullQuillProjects|flag-queue|tombstones|audio-guard|cloud-slim|backup" tests`.

## What Was Not Tested

- No live Supabase sign-in, pull, push, delete, or RLS behavior
- No live offline/airplane-mode retry run
- No live multi-account swap test
- No live Google Drive snapshot creation
- No real packaged app run
- No real Save Data contents touched

## Possible Duplicate Bug References

- No matching existing confirmed bug was found for the silent partial cloud-pull
  failure in Proof or Quill.
- Adjacent existing cloud risks already logged:
  `SAS-AUD-20260602-002` and `SAS-AUD-20260602-003`.

## Next Checks

1. In a later safe cloud test lane, force or mock secondary-query failures for
   Proof and Quill pulls and confirm the UI surfaces a sync error instead of
   quietly rebuilding partial data.

2. Add targeted regression coverage later for:
   `pullProofProjects(...)` secondary-query failure handling and
   `pullQuillProjects(...)` secondary-query failure handling.

3. Run an isolated live account-swap check to confirm pending queue state,
   project cache, and sign-out clearing stay separated between two accounts.
