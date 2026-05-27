# Cloud Safety Audit — brief for a fresh AI reviewer

**Hand this file to a different AI session.** Don't audit it from inside
the session that built it. The point is independent eyes.

---

## 1. What this app is (one paragraph)

StJohn Author Studio 4.0 is a desktop + phone companion for Marie, a
self-published audiobook + special-edition print author. Four desktop
modes (Proof Listen / Prep Manuscript / Duet Prep / Quill & Ink) and
two phone modes (Script / Quill) share ONE cloud (Supabase). The
phone is a "tap to flag" / "tap to annotate" companion — it must
round-trip cleanly with the desktop. Audio files are large and live
on whichever device played them; **audio NEVER goes to Supabase**.
Page numbers, narrator mappings, character mappings, flags,
annotations, and chapter "done" ticks all need to land safely.

---

## 2. Read these files in this order

| File | What to look for |
|---|---|
| `packages/cloud-sync/client.js` | The single Supabase client. Every cloud call must go through here. |
| `packages/cloud-sync/account.js` | Auth (sign in / out / forgot password). |
| `packages/cloud-sync/audio-guard.js` | `stripAudioPaths` — must remove every audio file path before any push. |
| `packages/cloud-sync/cloud-slim.js` | `slimBookForCloud` (Proof) and `slimProjectForCloud` (Quill) — strip heavy fields that don't belong in the cloud blob. |
| `packages/cloud-sync/tombstones.js` | When a project is deleted on one device, a tombstone keeps it from resurrecting from the cloud. |
| `packages/cloud-sync/flag-queue.js` | Offline flag queue — `recordPendingFlag`, `retryFlagQueue`. |
| `packages/cloud-sync/proof-sync.js` | Proof push/pull/delete. Reads/writes 3 tables: `script_sync_projects`, `script_sync_section_transcriptions`, `script_sync_flags`. |
| `packages/cloud-sync/quill-sync.js` | Quill push/pull/delete. Reads/writes 3 tables: `quill_projects`, `quill_chapters`, `quill_annotations`. |
| `packages/cloud-sync/index.js` | Public re-exports. The only allowed entry point. |
| `app/page.js` | Desktop — where Proof + Quill consumers call push/pull. Search for `pushProofProject`, `pullProofProjects`, `pushQuillProject`, `pullQuillProjects`. |
| `app/phone/page.js` | Phone — same sync helpers, mobile layout. |
| `supabase/` | Schema notes for the 6 tables. |

The six tables are the ONLY tables in use:
- `script_sync_projects` / `script_sync_section_transcriptions` / `script_sync_flags`
- `quill_projects` / `quill_chapters` / `quill_annotations`

Anything written to any other table = bug.
Anything READ from any other table = bug.
Prep + Duet have no cloud tables — desktop-only by design.

---

## 3. What to verify (checklist)

### A. Audio never reaches Supabase
- [ ] `stripAudioPaths` is called on EVERY push (book/project), every time, before the slim step.
- [ ] All keys that could carry audio (`audioPath`, `audioPaths`, `audioBlob`, `audioUrl`, raw blobs) are removed recursively.
- [ ] No code anywhere in `packages/cloud-sync/` calls `supabase.storage` for audio.
- [ ] Grep `app/` for `.mp3`, `.m4a`, `.m4b`, `.wav`, `.flac`, `.opus` written to Supabase. None should exist.

### B. Slim blobs
- [ ] `slimBookForCloud` strips heavy fields (whisper alignment, raw flags, large blobs) before the upload.
- [ ] `slimProjectForCloud` does the same for Quill — annotations and chapter HTML in the right slots, no dupes.
- [ ] What gets slimmed off is reconstructed correctly by pull (or is recomputed locally).

### C. Round-trip (the trust test)
- [ ] Proof: push then pull a project — every flag, every transcription, every chapter `completed` flag, every narrator mapping, every page-number setting (`pageNumberAdjustment`, `pdfPaging`, `pdfSource`) is preserved.
- [ ] Quill: push then pull — every annotation, every character, every chapter `completed` flag is preserved.
- [ ] Phone → desktop: a flag saved on phone appears on desktop after Resync, with the right page / quote / narrator / timestamp.
- [ ] Desktop → phone: a deletion on desktop is gone on phone after Refresh.

### D. Tombstones (no zombie projects)
- [ ] When a project is deleted on Device A, it stays gone on Device B even if the cloud row is still there briefly.
- [ ] `addTombstone` writes locally; `applyTombstonesToCloudList` filters incoming.
- [ ] Tombstones aren't applied so aggressively that a re-created project with the same id is silently hidden.

### E. Offline flag queue
- [ ] When a Proof flag is saved offline, `recordPendingFlag` writes to localStorage / IndexedDB.
- [ ] `retryFlagQueue` runs on focus / sign-in / Refresh.
- [ ] Failed retries don't loop forever — there's a cap or a backoff.
- [ ] The pending banner on the phone clears once the queue empties.

### F. No orphan columns / tables
- [ ] Every column written by push has a corresponding read in pull (or is meta like `updated_at`).
- [ ] Every column read by pull has a corresponding write in push.
- [ ] No references to tables outside the 6 listed above.

### G. Auth + RLS
- [ ] Every push/pull/delete passes `ownerId` (or relies on Supabase RLS that uses `auth.uid()`).
- [ ] No raw SQL with user input concatenation.
- [ ] Sign-out clears any in-memory project state so a different account can't see leftover data.

---

## 4. Specific test scenarios

These are the edge cases Marie hit (or could hit) in past sessions. The
audit should walk through each one mentally — read the code, follow the
flow, predict whether it survives.

1. **Sign out mid-save.** User taps Save on a flag, then signs out before the network call returns. Does the queue catch it? Or is the flag lost?
2. **Two devices saving the same flag simultaneously.** Last-write-wins, or does one clobber the other? Is there an `updated_at` that resolves it?
3. **Airplane mode flag save.** Phone saves a flag offline → airplane off → app foregrounded. Does `retryFlagQueue` fire automatically?
4. **Delete on Device A while Device B is editing.** Device B saves changes — do those changes resurrect the project, or does the tombstone kill them?
5. **Big project (50+ chapters, 100+ flags).** Does push timeout? Is there a payload-size guard? A hash-gate to skip a push that didn't change anything?
6. **Hash-gate correctness.** Push the same project twice in a row — does the second push skip the network call?
7. **Audio file mis-attached.** User picks a wrong audio file → pushes the project. Does any audio metadata leak to the cloud beyond the filename?
8. **Account swap.** User signs out, signs in as a different account. Does any leftover project from account A appear in account B's list?
9. **First launch with no internet.** Phone shows the cache from last time, NOT an empty state. Cache is not overwritten by an empty cloud pull.
10. **Re-create deleted project with same id.** User deletes a project, then re-imports the same .docx and somehow gets the same id. Does the tombstone permanently hide it, or does it come back?
11. **Quill chapter `completed` flag** — set on phone, pull on desktop. Is it preserved? It lives in the `desktop_project` blob inside `quill_projects`, not in `quill_chapters`.

---

## 5. How to report findings

For each item in §3 and each scenario in §4, report one of:

- **✓ Safe** — read the code, traced the flow, it's correct. Cite the file+lines.
- **⚠ Risk** — code reads correctly in the happy path but a specific edge case could break it. Cite file+lines + the scenario.
- **❌ Bug** — code is wrong as written. Cite file+lines + what to do.
- **? Unknown** — couldn't determine from static reading. Say what live test would resolve it.

Do NOT write code changes during the audit. Write the report. Marie
hands it back to the build session for any fixes.

End the report with:
- Count of ✓ / ⚠ / ❌ / ?
- Top 3 risks worth fixing now
- Anything the audit couldn't cover

---

## 6. Out of scope (don't audit these)

- Desktop Whisper transcription (audio-engine) — local, never touches the cloud.
- Manuscript parsing, dialogue detection — local.
- Quill InDesign export — local file write.
- The Reader UI (ChapterReader, ProofingReader) — UI, not sync.
- Prep + Duet — no cloud tables.

If the auditing AI starts wandering into UI files or local engines,
it's drifted off-task. Rein it in.
