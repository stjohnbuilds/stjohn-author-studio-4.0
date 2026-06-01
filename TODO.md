# TODO — StJohn Author Studio 4.0

Active and archived tasks. New work goes under **Active**. Completed
work moves to **Archived** with a date.

Format: `- [x] Task name — completed YYYY-MM-DD`. Never leave a task
as 2–3 words. Add context.

Always read `HANDOFF.md` first, then this file.

---

## Active

### 🆕 2026-05-27 — Drive snapshot backup system added

Built end-to-end. Daily on first app-open, per-account opt-in via
Settings → "Drive snapshots" card → "On for this account" toggle.
Saves a zip into `My Drive/Game Dev/GitHub/App Backups/` containing
all local JSON saves plus a cloud snapshot. Keeps newest 25, drops
oldest. Skips silently if Drive isn't detected on this Mac. Manual
"Snapshot now" button next to the toggle.

Tests: 13/13 pass (gained 2). Files: `main.js`, `preload.js`,
`packages/backups/index.js` (new), `app/page.js`.

- [ ] **Verify Drive snapshot system in packaged Mac app.**
      Build (`npm run release:mac`), open Settings → Drive snapshots →
      toggle on → click "Snapshot now". Confirm a new zip lands in
      `~/Library/CloudStorage/GoogleDrive-.../My Drive/Game Dev/GitHub/App Backups/`
      and contains `local/*.json` + `cloud/cloud-snapshot.json`. Then
      sign out, sign back in, confirm the daily auto-trigger fires once.
- [ ] **Port snapshot system to Typing and Tomes.** Open a fresh
      Claude session in that project, ask for "port the Drive snapshot
      system from Author Studio" — copy `packages/backups/`, the main.js
      IPC block, the preload additions, the page.js wiring, and the
      Settings card.
- [ ] **Port snapshot system to Script and Sync 3.0.** Same as above
      in that project.
- [ ] **Add Prep to cloud as `prep_projects` table (Marie requested
      2026-05-27).** Plan in chat: single new Supabase table mirroring
      Quill's shape, RLS scoped to owner, push/pull helpers in
      `packages/cloud-sync/`, debounced save in PrepManuscriptMode, and
      pull on focus. ~half a day.
- [ ] **Phone Quill edit/delete annotations (Marie requested
      2026-05-27).** Tap existing annotation → popup with current
      values pre-filled + Delete button. Wire to new tiny
      `upsertQuillAnnotation` / `deleteQuillAnnotation` cloud helpers.
      ~2-3 hours.

### 📋 2026-05-27 — Distribution readiness audit completed (read-only)

Full audit per the `APP_DISTRIBUTION_READINESS_AUDIT_INSTRUCTIONS.md`
playbook in Drive `Game Dev/GitHub/`. Report at:
`docs/dev/active/distribution-readiness-audit-2026-05-27/REPORT.md`

Tests passed 11/11. Login screen rendered clean. Score: **72%
provisional** ("workable, but distribution risk remains").

**Top blockers updated 2026-05-27:**
1. ✅ RLS on the six Supabase tables — verified live; locked per user.
2. Phone ↔ desktop flag round-trip — Marie has used it informally; no
   formal two-device test yet.
3. Mac code-signing / notarization absent — first-launch Gatekeeper
   friction for anyone receiving the `.app`; right-click → Open works.

**In-company sharing rating: 90%.** Public release still 72%
provisional. Full report:
`docs/dev/active/distribution-readiness-audit-2026-05-27/REPORT.md`

**Cleanup flagged (not blocking):**
- 25 GB of stale builds in `Script and Sync Releases/Old/`.
- Releases folder + root shortcut files still use old "Proofer" / "Script and Sync" brand.
- `ProofingReader.js` still inline at 1,445 lines (migration tracked).

### Current priority order — cleaned 2026-05-27

- [x] **Proof + Quill transcription sync real-file check.** Marie
      confirmed Proof sync looks good after re-transcribing, Quill jump
      / follow works after the word-count fix, and phone receives the
      transcription. Keep watching for new real-file failures, but this
      is no longer a live blocker. — completed 2026-05-27
- [x] **Phone Quill Back navigation.** Marie re-tested the Quill phone
      Back fix and said it seems fixed. — completed 2026-05-27
- [x] **Phone → desktop Quill annotation round-trip.** Marie added an
      annotation on the phone and saw it on desktop. Add/edit/delete on
      phone is useful polish, not a blocker for adding annotations. —
      completed 2026-05-27
- [x] **Desktop Proof flag save safety.** Desktop flag adds/deletes now
      use the same single-row cloud queue as phone flags, so a flag can
      survive cloud weirdness and retry later instead of depending only
      on the whole-book save. — completed 2026-05-27
- [x] **Phone pending flag backup download.** When phone flags are
      waiting to sync, the book view now offers a CSV backup download
      next to Retry. — completed 2026-05-27
- [x] **Use Quill content hashes on pull.** `quill_chapters.content_hash`
      and `quill_annotations.content_hash` are now selected from
      Supabase and kept on pulled chapters/annotations. — completed
      2026-05-27
- [x] **RLS / Supabase public-release check.** Verified live in the
      database 2026-05-27 via Supabase MCP. All six tables
      (`script_sync_projects`, `script_sync_section_transcriptions`,
      `script_sync_flags`, `quill_projects`, `quill_chapters`,
      `quill_annotations`) have RLS enabled with policies scoped to
      `owner_id = auth.uid()`, with secondary tables also enforcing the
      parent-project owner. No code or data change required. Cloud
      privacy is safe for in-company sharing. Evidence captured in the
      distribution audit report. — completed 2026-05-27
- [ ] **Big-book cloud payload measurement.** Measure one fully
      transcribed large real book so we know Supabase uploads stay small
      and do not timeout. Plain meaning: check the cloud package is not
      too heavy for a giant book.
- [ ] **Quill home load-speed real check.** The code now has the light
      project-list index. Marie should test switching into Quill on her
      large project after the next saved write.
- [ ] **Phone Quill edit/delete annotations.** Useful polish. Adding
      annotations works and round-trips; editing/deleting from phone is
      still missing.
- [ ] **Prep visual polish pass.** Lower priority than data safety, but
      Prep needs a cleaner look before release.
- [ ] **Final packaging trigger.** After safety fixes + tests + visual
      pass are done, rebuild Mac and Windows packages and redeploy the
      phone app if phone code changed.
      Progress 2026-05-27: phone app redeployed after the pending-flag
      backup-download patch. Mac/Windows packages still wait until the
      next desktop package pass.
      Progress 2026-05-27: Mac app rebuilt after desktop flag-save
      safety patch. Windows still waits until final package pass.
      Progress 2026-05-27: phone Proof/Quill export buttons now download
      one ZIP package per mode. Mac app and Windows artifacts rebuilt into
      `Script and Sync Releases/`, and phone redeployed to Vercel.

---

### ✅ RESOLVED — Restore transcription sync accuracy

Proof and Quill follow-text / jump-to-word must use real word timestamp
anchors, not token fragments or estimated word speed. Current evidence:
native whisper.cpp JSON token output is being stored as split pieces
(`v` + `ex`, `eb` + `ony`, `don` + `'` + `t`) in saved transcription
data, which can make jump/follow drift. Fix parser, re-transcribe a real
chapter, then verify: jump to random words at start/middle/end lands
within 1–2 words and follow text does not drift over time at 1x, 1.5x,
2x, and 3x.

Progress 2026-05-27: attempted word-merge parsing made some separate
words join together (`faceplease`), so native Whisper parsing was
returned to the proven Script and Sync 3.0 token style. Next verification
must focus on reader seek/follow behavior and real-file alignment, not
assume the parser alone fixed sync.

Progress 2026-05-27: confirmed Quill drift came from a word-count
mismatch. Quill reader/annotations counted regex words, but Quill
transcription through shared book detail counted whitespace words
(Chapter 4 example: 1,635 visible reader words vs 1,581 aligned words).
Patch now keeps Quill transcription on Quill reader word counting and
keeps Proof on Script and Sync whitespace counting.

Progress 2026-05-27: Marie re-tested the packaged Mac app after
re-transcribing and confirmed Quill jumping/transcription sync now works
on her real file. Keep Proof verification separate before closing this
blocker completely.

Progress 2026-05-27 overnight: added a desktop **Clear T** control on
transcribed chapters. It clears saved transcription/sync timing while
leaving audio, flags, and Quill annotations alone, so a failed/stale
re-transcribe can start from a clean state. Packaged into the Mac app.

Progress 2026-05-27: Marie confirmed Proof transcription sync looks
good on her real file after re-transcribing. Do not keep listing Proof
sync as untested unless a new real-file failure appears.

Progress 2026-05-27: moved transcription clearing out of each chapter
row because it broke the chapter-list layout. The list now has a compact
top-row `×` beside Transcribe all to clear saved transcriptions in bulk.

### 🟡 CHECK — Quill home must not wait for full transcription payload

Switching from Proof to Quill should show the project list immediately.
Current Quill save data is large because chapter transcript/alignment
data is stored inside the project file. The home screen only needs
project id/title/counts/timestamps, so split or lazy-load heavy chapter
transcription payloads after the list renders.

Progress 2026-05-27: Electron now exposes a lightweight Quill project
list and loads the full Quill project only when the project is opened.
Needs packaged-app timing check on Marie's large project before this can
be marked complete.

Progress 2026-05-27 overnight: Mac app was rebuilt with the lazy Quill
list path still passing build/package checks. Still needs Marie's timing
check on her large project before marking complete.

Progress 2026-05-27: found the remaining slow path. The renderer asked
for a light Quill project list, but Electron still parsed the full
transcription-heavy Quill JSON to create that list. Added a tiny
`quill-project-list.json` index so the project list can load without
parsing the full save file after the next write.

### 🟡 CHECK — Phone Proof + Quill companion parity

Phone app goal: pull the cloud project data, keep audio local on the
phone, match audio by synced filenames, save Proof flags / Quill
annotations with useful metadata, and export CSV from the phone.

Progress 2026-05-27: inspected `app/phone/page.js`. Proof phone already
has book-level audio folder picking, filename matching, player speed
controls, sync highlight, flag metadata fields, pending flag queue, and
CSV export. Patched Quill phone to add project-level audio folder
picking, chapter filename matching, the shared phone player/speed/sync
dock, annotation timestamps from transcription/current audio time, and
Audio File in the Quill CSV export. Needs Marie's real-phone test after
deploy.

Progress 2026-05-27: added `.vercelignore` because the first deploy
attempt tried to upload desktop release/data folders. Production deploy
then succeeded and aliased to `https://stjohn-author-studio-4.vercel.app`.

Progress 2026-05-27: fixed Quill phone Back navigation. The
last-opened-chapter restore effect was immediately reopening the reader
after Back set the chapter to null, causing a flicker and trapping Marie
in the reader. Deployed the fix to production.

Progress 2026-05-27: Marie confirmed transcription ports to phone, but
the Quill annotation popup was missing desktop metadata controls and the
reader still prompted for one audio file. Patched Quill phone popup to
mirror the desktop metadata controls: annotation type, subtype dropdown,
custom emotion, attach characters, custom character, and note. Quill
reader no-audio state now tells Marie to return to the chapter list for
the audio folder instead of asking for a single chapter file. Deployed
to production.

Progress 2026-05-27 overnight: added phone chapter-list transcription
status. Quill chapters now show a separate `✓ Transcribed` pill when
usable synced alignment exists. Proof chapters show `✓ Transcribed`
when all sections have usable alignment, or `Part transcribed X/Y` when
only some sections are synced.

Progress 2026-05-27: Marie confirmed phone-to-desktop data looked good
for the tested flags/annotations. Patched Quill phone navigation again:
removed automatic last-chapter restore so Back reliably returns to the
chapter list instead of flickering back into the reader. Added a copy
button to the phone Proof flag popup that copies a tab-separated row.

Progress 2026-05-27: Marie tested the Quill phone Back fix and confirmed
it seems fixed. Do not keep this listed as urgent unless it reappears.

### ✅ RESOLVED / STALE PLAN — Page-number architecture rebuild

**Why this is the blocker.** Page numbers are the primary value of the
app. The current architecture stores the full text of every PDF page
in `pdfPaging.pages` and does a quote-search at flag time. This:
- Fails on Marie's books (returns wrong pages — e.g. p.16 came back as p.4)
- Causes the Supabase CloudSync timeout (massive blob for a 419-page book)
- Forces the phone to either receive the same heavy blob or lose page numbers
- Doesn't match Marie's mental model: PDF is for page numbers; words live in the manuscript.

**The fix Marie signed off on.** Replace the heavy `pdfPaging.pages`
with a slim word-index → printed-page map. PDF is used once at import
to build the map, then discarded from the cloud blob. At flag time,
page lookup is a single array lookup. No quote searching anywhere.

**Plan (in order — every AI picking this up follows these steps):**

1. **Add `buildSlimPageMap(pdfPages, manuscriptWords)` to
   `app/lib/pdfPaging.js`.** Walk each PDF page, take the first 5–8
   non-footer words of its extracted text, find that sequence in the
   manuscript word array starting from a moving cursor. Record
   `{ wordStart: matched index, pageNumber: page.pageNumber }`.
   Output is an array sortable by wordStart.

2. **Wire it into ImportFlow.** When ImportFlow has both `pdfPaging`
   AND parsed manuscript words, run `buildSlimPageMap` and attach the
   result as `pdfPageMap` on the payload that goes to `onConfirm`.

3. **Adopt the slim map in ManuscriptSetup and the other modes.** Save
   `pdfPageMap` on the book/project. Treat it as the primary truth for
   word-index → page lookup. Keep `pdfPaging` for diagnostics on
   desktop ONLY (file name, page count, printed-count) — strip its
   heavy `pages` array.

4. **Strip `pdfPaging.pages` from cloud uploads in
   `packages/cloud-sync/cloud-slim.js`.** `slimBookForCloud` and
   `slimProjectForCloud` must drop `pdfPaging.pages` while keeping
   `pdfPageMap` (which is small and the phone needs it).

5. **Rewrite `getAutoPageNumber` in `app/components/ProofingReader.js`.**
   Look up by word index against `pdfPageMap` (primary), fall back to
   `manuscriptPaging.pageMap` (when no PDF was attached), `?`
   otherwise. Delete the quote-search code path.

6. **Delete (or quarantine) `findPdfPageForQuote` in
   `app/lib/pdfPaging.js`.** Nothing should call it. Leave only the
   page-extraction code that builds `pdfPages` for the map builder.

7. **Wire phone lookup to the same map.** `app/phone/page.js` looks up
   the flag's word index against the synced `pdfPageMap`. No
   quote search on phone. No PDF on phone.

8. **Acceptance test (Marie's hands):** open Anarchy. Tap a word she
   knows is on page 16. Popup shows 16. Tap a word on page 340. Popup
   shows 340. Save flag offline → online → CloudSync push completes
   without "statement timeout." Phone shows the same page numbers.

**Files this touches (and ONLY these):**
- `app/lib/pdfPaging.js` — add `buildSlimPageMap`, remove `findPdfPageForQuote`
- `app/components/ImportFlow.js` — pass `pdfPageMap` through `onConfirm`
- `app/components/ManuscriptSetup.js` — save `pdfPageMap` on book
- `app/components/QuillAndInkMode.js`, `PrebuildMode.js`, `PrepManuscriptMode.js` — adopt pdfPageMap when applicable (Quill probably doesn't care; Duet may not need it; Prep maybe)
- `app/components/ProofingReader.js` — rewrite `getAutoPageNumber`
- `packages/cloud-sync/cloud-slim.js` — strip `pdfPaging.pages`, keep `pdfPageMap`
- `app/phone/page.js` — page lookup via map

**Decisions already made (don't re-litigate):**
- No new Supabase tables. Same 6 tables.
- No data migration. Old cloud books still pull; if they have heavy `pdfPaging.pages`, ignore it on pull (don't store it locally).
- `pageNumberAdjustment` survives ONLY as a manual nudge for the manuscript word-count fallback (when no PDF). Never applied to map results.
- PDF is desktop-only. Never uploaded to Supabase. Never sent to phone.
- Quill: no PDF, no pdfPageMap, no page numbers anywhere. (Already true.)

Progress 2026-05-27 overnight: Marie said page numbers were already
fixed. This old blocker is left in place until a focused cleanup pass
compares the TODO text against the current code and archives the stale
plan safely.

---

### 🔴 CLOUD SAFETY AUDIT FINDINGS — fix list (from independent audit 2026-05-26)

Independent AI audited cloud-sync code against `docs/CLOUD_SAFETY_AUDIT.md`.
Results: 15 ✓ safe / 8 ⚠ risks / 4 ❌ bugs / 5 ? unknown. The four ❌
bugs need fixing before release. The eight ⚠ risks need a judgement
call each.

#### ❌ Bugs (fix before release)

- [x] **Sign-out leaves previous user's data in desktop `books` state.**
      `handleSignOut` in `app/page.js:553-558` only clears
      `authSession`, not `books`. Next user signing in sees the
      previous user's books briefly, AND the debounced push at
      `app/page.js:516-551` may attempt to push prev-user rows under
      the new user's ownerId within 1200ms. Fix: `setBooks([])` and
      clear all cloudId-bearing state on sign-out, OR unmount the
      books-owning component when `authSession` is null.

- [x] **Quill chapter `alignment` is pushed but never pulled.**
      `quill-sync.js:71` writes `alignment` into `quill_chapters`,
      but `quill-sync.js:154` SELECT omits it AND `slimProjectForCloud`
      strips it from the blob. After any push-then-pull round-trip,
      every chapter's audio alignment is gone. Fresh machines lose
      audio-to-word sync. Fix: add `alignment` to the SELECT, OR stop
      writing it (decide if Quill audio alignment is still a feature).

- [x] **Tombstone permanent-ghost: `clearTombstone` is exported but
      never called.** If Marie deletes a project and re-imports/re-creates
      one with the same local id, the tombstone permanently hides it
      AND the retry-delete keeps killing the cloud row on every pull.
      Fix: call `clearTombstone(scope, id)` from project-create /
      project-import flows in both `app/page.js` (Proof) and
      `app/components/QuillAndInkMode.js` (Quill).

- [x] **Race between full-book push and single-flag push.** Full-book
      push deletes-then-inserts all flags (`proof-sync.js:117-122`).
      If a single-flag upsert lands between the delete and the insert
      on another device, that flag is wiped. Fix: change full-book
      flag sync to upsert-with-merge instead of delete-then-insert,
      OR add a row-version check.

#### ⚠ Risks (decide and fix or accept)

- [x] **Audio-extension list drift.** CLAUDE.md lists 6 extensions;
      `audio-guard.js:32` regex covers 8 (adds `.ogg`, `.aac`).
      Reconcile to one source of truth. Low risk for Marie.
- [x] **Flag-queue has no cap / no backoff.** Permanent server-side
      failure = perpetual pending banner. Add max-retry-count or
      exponential backoff.
- [x] **Desktop has no per-flag offline queue.** Only the full-book
      debounced push. If Marie saves a flag and closes the laptop
      within 1200ms before push fires, the flag may not survive.
      Decide: wire `recordPendingFlag` into desktop save, OR document
      this as "always wait 2s before quitting after saving."
      Fixed 2026-05-27: desktop flag saves/deletes now write to the
      local retry queue and immediately attempt single-row cloud
      upsert/delete.
- [x] **`lastPushHashByCloudId` survives sign-out** (Map at module
      scope). Theoretical collision risk across users. Add
      `clearHashCache()` to sign-out.
- [x] **`quill_chapters.content_hash` and `quill_annotations.content_hash`
      written but never read.** Dead columns. Drop or use.
      Fixed 2026-05-27: pull now selects both hashes and keeps them on
      returned chapters/annotations as `contentHash`.
- [ ] **`pullProofProjects` / `pullQuillProjects` don't pass ownerId
      — trust RLS.** Verify RLS policies on the 6 tables in the
      Supabase dashboard; if any are missing, every signed-in user
      sees every other user's projects.
- [x] **Tombstone retry-delete has no rate limit.** Re-issues on
      every pull until the cloud row is gone. Add a per-session
      attempt cap.
- [x] **Local-id-in-NOT-IN-string injection theoretical.** `local_id`
      values are UUIDs so safe today; defensive fix is `.not('local_id',
      'in', \`(${ids.map(...).join(',')})\`)` validation.

#### ? Unknown (live test required)

- [ ] Phone → desktop Proof-flag round-trip — needs two-device test.
- [ ] Payload size on a fully-transcribed 50-chapter book — measure.
- [ ] Behavior under concurrent full-book + single-flag push — stress test.
- [ ] RLS policies on the 6 Supabase tables — check the dashboard.
- [ ] Hidden flag queue in `app/page.js` / `SessionsView.js` — re-grep.

Progress 2026-05-27 overnight: cleanup pass patched the low-risk safety
items above: flag queue retry backoff/cap, tombstone retry-delete cap,
Quill NOT-IN quoting, and source-doc audio extension drift. Items that
need live dashboard/two-device verification remain unchecked.

---

### ⭐ PRIMARY — Final round bug-fix assessment

**The active checklist lives in
`dev/active/FINAL-ROUND-checklist.md`** (created 2026-05-26).

Part A is hands-on for Marie (every mode, real books, real audio).
Part B is the deep dive for Claude (cloud round-trip, edge cases,
code health, hook health). Part C is the watch list.

When this checklist is fully ticked, archive it under `dev/archive/`
with the run date and open a fresh TODO.md.

Everything below this line was the OLD active list, kept here for
context until the final-round walkthrough closes.

---

### OLD — Marie's testing checklist (superseded by FINAL-ROUND-checklist.md)

- [x] **Sign in** — completed 2026-05-25. Supabase project
      `evcusovtjfypfyfvnooy` wired; Marie signs in with her existing
      account.
- [x] **Four mode colours look right** — completed 2026-05-25.
      Verified live: each mode wears its own pastel, no purple leak,
      card headers flat.
- [ ] **Re-test a real Proof audiobook on the NEW unified UI.**
      The book detail is now SessionsView (same component Quill +
      Duet use). Walk through the usual flow — confirm title, action
      buttons, side nav, chapter list, audio panels, delete still
      work. The big purple banner is gone; deleted is now a tiny 🗑
      top-right. **If anything's broken vs the last build, tell me.**
- [ ] **Re-test Quill on a real .docx on the NEW unified UI.**
      Quill book-detail is also SessionsView now (mode="quill"). New
      project → upload a manuscript → open a chapter → drag across
      words → tap pink + → pick a class → save. Confirm the pink
      underline + sidebar entry. Also: Split toggle ON should now
      reveal scene rows from H2 sub-headings.
- [ ] **Test the InDesign export.** Book detail → Export CSV +
      InDesign. Open the .jsx in InDesign and run against a real
      layout. Eyes-on check: are character styles created? Are
      highlights underlined? Marie is the only one who can verify
      "right" for her print workflow.
      Progress 2026-05-27: generated an isolated InDesign test pack at
      `docs/dev/active/indesign-export-test-pack/artifacts/` using the
      real Quill exporter (`buildInDesignJsx`) plus a 4-page DOCX.
      This is a safe first test, not a replacement for Marie's real
      layout check.
- [ ] **Test the phone scaffold.** Browser to `http://localhost:3000/phone`
      while `npm run dev` is running. Sign in with the same account.
      Quill project from the desktop should appear. Open a chapter,
      tap a word, add an annotation. Reload the desktop — annotation
      should appear there too. (Cloud round-trip confirmation.)

### Next up after Marie's checklist

- [x] **Cloud sync for Proof Listen.** Built — packages/cloud-sync/proof-sync.js
      with push/pull/delete, wired into app/page.js with debounced push
      and on-load merge. Audio paths flow through audio-guard.js. —
      completed 2026-05-25 (overnight)

- [x] **Phone Script mode (Proof Listen on phone).** Built — phone has
      both Quill and Script services now. Script flow: project list
      from `pullProofProjects` → chapter list → section reader → tap to
      select word → flag panel with type dropdown + note + save. Saved
      flags push to cloud via `pushProofProject`. — completed 2026-05-25
      (overnight)

- [x] **Phone CSV export.** Built — Export CSV button on both Quill
      (annotations) and Script (flags) project views. Inline
      `buildFlagsCsv` for now; tracked under "Export helpers
      consolidation" if you ever want it lifted to `packages/exports/`. —
      completed 2026-05-25 (overnight)

- [x] **Phone audio playback in Quill mode.** Built —
      `<PhoneAudioDock>` is a small fixed-bottom dock with file picker,
      play/pause, scrubber, speed, close. Shared by Quill and Script.
      Audio stays on the phone. Script reader captures the current
      audio time as the flag's `ts`. — completed 2026-05-25 (overnight)

- [x] **Deploy phone to Vercel.** Live at
      **https://stjohn-author-studio-4.vercel.app/phone**. Linked to the
      Vercel project `marie-mackays-projects/stjohn-author-studio-4`,
      env vars (`NEXT_PUBLIC_SUPABASE_URL` +
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) set in production scope,
      first deploy ready. Both `/` and `/phone` return 200. —
      completed 2026-05-25

- [x] **Phone IS the root on Vercel.** Added build-time swap script
      `scripts/vercel-root-to-phone.js` that copies the phone HTML
      over `out/index.html` when `VERCEL=1`. URL bar stays as `/`,
      no bounce, no redirect. Electron's release scripts call
      `next build` directly so the swap doesn't run there — Electron
      keeps the desktop UI at `/`. (First attempt used `vercel.json`
      rewrites but static-export `index.html` was served before the
      rewrite could apply.) — completed 2026-05-26

- [ ] **Audio sync in Quill desktop reader.** Optional. Quill works
      without audio. If Marie wants audio while annotating on the
      desktop, port the audio dock from the alpha reader.

- [ ] **Search inside chapter in Quill desktop.** Optional. ProofingReader
      has search; port it over.

### Smaller cleanup (low priority, low risk)

- [ ] **Migrate `ProofingReader.js` to use `ReaderChrome.js`** — Prep
      already does. Pure refactor, no behaviour change.

- [ ] **Migrate Duet `PrebuildMode.js` to use `ReaderChrome.js`** —
      uses its own AppModeToggle placement; no shared chrome yet.

- [ ] **Migrate Proof's `BookSetup` to use `ImportFlow`** — Last
      duplicate of the upload flow. Layered with PDF paging + narrator
      colour mapping, so the goal is for BookSetup to render
      `ImportFlow` plus the Proof-only panels.

### ✅ URGENT — Full app unification — DONE 2026-05-25

**Outcome achieved.** Proof + Quill + Duet all now render `SessionsView`
for the book detail. Proof + Quill use `ChapterReader` / `renderChapterBody`
for the reader. `AudioDock` and `ImportFlow` are shared by all modes.
The build-checker hook hard-blocks fresh duplicate components.

**Architectural note:** the plan was to extract each panel (NarratorPanel,
AudiobookTimingPanel, BulkAudioPanel, TranscriptionQueueIndicator) as
its own file. **That isn't what shipped.** Instead, those panels live
INLINE inside SessionsView, and all three modes share the panels by
rendering SessionsView with a `mode` prop. Same user outcome (one UI
everywhere, fix once = fix everywhere) via different architecture.
Phase A items A3–A8 and Phase B1 are NOT extracted as files.

If a future session wants to extract them into separate components for
code-organisation reasons, that's tracked under "Smaller cleanup."

### Code-health audit pass (after reader unification, before phone work)

Same-source mandate applied to the WHOLE codebase, not just BookDetail
and Reader. Sweep:

- [ ] **Extract shared `ModeHome` (project library) component.** Each
      mode has its own home view (project cards + "+ New" button).
      Quill's is the simplest baseline. Same pattern as `BookDetail`:
      take title + accent + project list + onNew/onOpen handlers,
      with a slot for mode-specific tiles (Prep's "scanning" badge,
      Proof's audio-bookmark indicator). Migrate Proof, Duet, Quill,
      and Prep to it. Add to `SHARED_COMPONENTS.md`. Tighten the
      build-checker hook to block new inline `*HomeView` declarations
      that don't import `./ModeHome`.

- [ ] **Shared `<ConfirmDialog />`.** Every mode uses native
      `window.confirm()` which looks like a browser alert and breaks
      the visual language. Build a themed modal with the mode-tone
      accent. Replace every `window.confirm` call across all mode
      files. Add to `SHARED_COMPONENTS.md`. Hook: block new
      `window.confirm(` additions in mode files.

- [ ] **Cloud-sync helpers parity — Proof only.** `packages/cloud-sync/`
      has Quill wired (`quill-sync.js`). Build `proof-sync.js` (push/pull
      for `script_sync_projects`, `script_sync_section_transcriptions`,
      `script_sync_flags`) mirroring `quill-sync.js`'s shape. Audio
      paths flow through `audio-guard.js` before any upload (already
      enforced). **Prep and Duet stay desktop-only** — they don't go to
      phone so they don't need cloud sync. Only Proof + Quill ship to
      phone.

- [ ] **Export helpers consolidation.** Quill has CSV + InDesign export
      in `packages/quill-engine/exporters.js`. Prep has CSV + DOCX in
      `app/components/prepExport.js`. Both should live under a single
      `packages/exports/` with one consistent file pattern (one file
      per export format, shared `downloadBlob` / `safeFileName`
      helpers). Phone's CSV export later imports from the same place.

- [ ] **Inline-style sweep.** Walk every mode file (and shared
      components) and look for:
      - inline `position: 'sticky'` → use `<StickyTopBar />`
      - inline hex color codes → use `MODE_TOKENS[tone]`
      - inline button `style={{ padding, border, background ... }}` →
        use `topBtnStyle(tone, variant)` or `pillBtnStyle(tone)`
      - direct `getSupabaseClient()` calls → must go through
        `packages/cloud-sync/`
      - direct `fs.writeFile` / `window.electron.*` calls outside
        `packages/` — should be wrapped in a typed helper
      Each pattern gets a build-checker hook rule blocking new
      additions.

- [ ] **`.claude/hooks/` health check.** Verify every hook handles
      edge cases robustly: missing edit-log, missing git binary, large
      file lists, log rotation past `MAX_LINES`, permission errors
      writing logs, hook running outside project root. Verify
      `settings.json` registers each hook on the right events. Run a
      synthetic edit (touch a known mode file) and confirm
      `hook-activity.log` shows the expected sequence:
      `file-tracker` → `git-backup` → `build-checker` →
      `context-check` → `no-mess`. Add a `.claude/hooks/_test.sh`
      script that exercises each hook against a fake edit-log and
      reports pass/fail.

- [ ] **`packages/` audit.** Look for duplication BETWEEN packages.
      `packages/manuscript-engine` does DOCX import and dialogue
      detection; `packages/quill-engine` has its own DOCX-related
      helpers (annotation export to InDesign reads DOCX structure
      indirectly). Both should depend on a single canonical
      manuscript-engine if there's overlap. Document the package
      graph in `SHARED_COMPONENTS.md`.

### Same-source consolidation pass — mostly done 2026-05-25

- [x] **Refactor Duet's view==='project' to render shared
      `BookDetail`.** Done — Duet renders `SessionsView` with
      mode="duet" + engineerProgress slot. Inline 386-line custom
      JSX stripped.
- [x] **Refactor Proof's `SessionsView.js` to render shared
      `BookDetail`.** Done — Proof's banner killed, action buttons
      moved to the shared row, side-nav + chapter list inside
      SessionsView are the shared surface that Quill + Duet now
      share too.
- [x] **Unify the reader.** Done for Proof + Quill via
      `renderChapterBody` from `ChapterReader.js`. Prep stays
      separate (dialogue spans, different model). Duet's reader
      stays separate (block-display, different model) — by design.

- [ ] **Extract shared `ModeHome` (project library) component.** Each
      mode has its own home view (project cards + "+ New" button).
      Quill's is the simplest baseline. Same pattern as BookDetail.
      Still not done.

- [ ] **Replace `window.confirm()` with a shared `<ConfirmDialog />`.**
      Every mode uses native confirm. A shared themed dialog would
      look consistent. Still not done.

### Phase 10 — real-file end-to-end pass

- [ ] Marie runs every minimum-release check on her actual books +
      audiobooks. Every row in `WIRING_MATRIX.md` flips to `verified
      live`.
- [ ] Phone signed-in proof: real flag + real annotation saved from
      phone, seen on desktop.

### Phase 11 — release

- [ ] Mac packaged build.
- [ ] Windows packaged build.
- [ ] Phone deploy live on Vercel.
- [ ] First user release.

---

## Archived

### 2026-05-29 — App-wide "don't overwrite, add (1)/(2)/(3)" on every download

- [x] **Every download in the desktop app is now collision-proof.** —
      completed 2026-05-29 (code; pending Marie hands-test in the rebuilt
      app). Marie has asked many times for this: when you save/export a
      file and that name already exists, append " (1)", " (2)", " (3)"
      instead of overwriting. `main.js` already had the exact helper
      (`uniqueExportPath`) but only the 4 IPC "Save As" exports used it;
      every renderer `<a download>` (Quill Word/CSV/InDesign, Proof CSVs,
      Prep, Prebuild CSVs, home backup JSON, ManuscriptSetup config) was
      bypassing it. Fix is ONE central hook: a `will-download` listener on
      the window session in `main.js` that routes every download through
      `uniqueExportPath` into Downloads — so it covers every tab/mode in
      one place, no per-button edits. Phone app is a real browser (auto-
      dedupes already); the 4 IPC exports already defaulted to a deduped
      name. Needs Mac + Windows release rebuilds to reach installed apps.

### 2026-05-29 — Restore Quill (Ink) Word doc export

- [x] **Quill Word doc export restored + bundle exports everything.** —
      completed 2026-05-29. The "annotated review" Word export existed in
      StJohn Author Studio 2.0 (`packages/exports/docx`) but the 4.0
      rebuild only ported the CSV + InDesign exporters, so the Word doc
      silently went missing. Added `buildAnnotationsDocxParts` /
      `buildAnnotationsDocxBlob` to `packages/quill-engine/exporters.js`
      (same OOXML/JSZip approach as Prep's `prepExport.js`): manuscript
      with each annotation highlighted in its real on-screen colour
      (lightened ~45% so text stays readable) + a real Word comment per
      annotation laid out one fact per line (Type / Label / Note). Word
      comments are anchored via commentRangeStart/End + comments.xml.
      Also fixed the bundle button in `QuillAndInkMode.js`: "Export CSV +
      InDesign" used to fire two downloads in one tick and the browser
      dropped all but the CSV. Now "Export all (.zip: Word + CSV +
      InDesign)" builds a single .zip containing all three (Marie's
      choice 2026-05-29 — one file guaranteed to hold everything, no
      risk of a dropped download). CSV + InDesign always included; Word
      added too but zip still ships if the Word build ever fails. Added a
      "Word .docx only" button. Verified: 21 sandbox
      assertions pass, generated .docx re-parses cleanly in mammoth
      (text/punctuation/paragraphs/entities intact), home route compiles
      HTTP 200. Still needs Marie to click it on a real book to fully
      confirm.

### 2026-05-26 evening — Marie's crash-out triage + Proof one-screen rebuild

- [x] **Page-shift explainer text uses Marie's exact wording.** Replaced
      the "footer / PDF page index" jargon in `ImportFlow.js` and the
      Edit-book-data nudge in `SessionsView.js` with her verbatim
      sentence: "If you open the Word document and you see that on the
      first page there isn't a number 1, but on the second page there
      is, then it needs to be shifted +1 or −1." — completed 2026-05-26
- [x] **Page-shift card slimmed to a single pill strip.** Was a tall
      card with title + input + paragraph. Now one row: label + − + N +
      with a one-line tip. — completed 2026-05-26
- [x] **Hourglass ⏳ replaced with a thin spinning ring** in 3 places —
      `ImportFlow.js` (manuscript reading), `ManuscriptSetup.js`
      (manuscript scanning), `SessionsView.js` (Restoring chip on chapter
      rows). — completed 2026-05-26
- [x] **Quill has no page-number UI anywhere.** Added `needsPageNumbers`
      prop to `ImportFlow`; Quill passes `false`. `SessionsView` gates
      the page banner and the page nudge in Edit-book-data when mode is
      `'quill'`. Quill is print-design — never needed pages. —
      completed 2026-05-26
- [x] **The duplicate "Split chapters on sub-headings" panel is gone**
      from both `ImportFlow.js` AND `ManuscriptSetup.js`. Marie asked
      for this multiple times. The structural `splitScenes` state still
      drives parsing behind the scenes; the "Show sub-headings" button
      on the chapter list is the surface the user needs. — completed
      2026-05-26
- [x] **Proof import is ONE screen now (Phase 2 eliminated).**
      `ImportFlow` got two new props: `extraStepSlot` (JSX rendered as
      Step 3 when present) and `onParsed` (fires when the docx parses
      so the parent can react). `ManuscriptSetup` now renders ImportFlow
      with the narrator-mapping panel passed as the extra step;
      `handleImportConfirm` does the final save directly. No more
      second screen. — completed 2026-05-26
- [x] **PDF wording explains both sources.** Now says "either downloaded
      from Google Docs as PDF, or saved from Word as PDF." Marie asked
      about Word's Save-as-PDF; it works fine, same format. —
      completed 2026-05-26
- [x] **Cloud safety audit brief written** at `docs/CLOUD_SAFETY_AUDIT.md`.
      A self-contained 6-section brief for an independent AI to audit
      the cloud-sync package end-to-end. Marie handed it off and got
      back results (4 bugs / 8 risks / 5 unknowns — captured in Active
      section above). — completed 2026-05-26
- [x] **Page-number 340 → 52 double-count fix.** When the PDF lookup
      returns a page whose number came from the detected printed footer
      (`source === 'printed'`), the user nudge is NO LONGER added on
      top. The nudge was being double-counted: 16 + (−12) = 4 was the
      symptom. Adjustment now only applies to inferred / word-count
      fallback paths. — completed 2026-05-26
- [x] **Flag-popup quote whitespace collapse + Sheets-row normalize.**
      `sentPlain` in `ProofingReader.js` now collapses internal whitespace
      runs to single spaces before going in the textarea, so pasting
      into Word/Sheets doesn't carry double spaces from the source .docx.
      `copySheetRow` normalizes the same way. — completed 2026-05-26
- [x] **Hard red warning when page lookup truly fails.** When BOTH the
      manuscript word-index map AND the PDF lookup can't determine a
      page, the flag popup shows a red banner + red-bordered page field.
      Marie's rule: never silently show a guess. — completed 2026-05-26

### 2026-05-25 overnight session 2 — phone v1 functionality parity

Marie's ask after seeing the deployed phone: "It's 80% there. Pull
EVERYTHING from the original Studio app phone — double-tap to highlight,
drag handles, block highlight, settings (font/size/mode/bg/etc.),
Scroll vs Page Swipe, popover matches reader width. It's already
thoroughly debugged there — pull it in, don't re-invent it." Result:

- [x] **Universal reader settings** — cog icon top-right of every
      screen opens a full-page Settings panel. Eight fields, all
      from the v1 Studio phone reference: Font (5 options), Text
      size (16–28), Reader mode (**Scroll | Page Swipe**), Line
      spacing, Margins, Paragraphs, Alignment, Background (8 swatches).
      Persisted in localStorage as `stjohn-phone-reader-settings-v1`.
      Settings apply to BOTH Quill and Script readers, settings panel
      renders as an overlay (so closing returns to the exact previous
      view). New module: `app/phone/_lib/readerSettings.js` +
      `app/phone/_components/PhoneReaderSettings.js`. — completed
      2026-05-25 (overnight 2)
- [x] **HTML-preserving reader** — replaced the naive word-span
      renderer with the v1 Studio walker. Italics, paragraphs, h2/h3
      scene-break headings, paragraph indentation all preserved.
      New module: `app/phone/_components/renderReaderContent.js`. —
      completed 2026-05-25 (overnight 2)
- [x] **Double-tap to highlight + drag handles + block highlight** —
      ported the v1 Studio phone selection model. Single tap is a
      soft tap; second tap within 420ms on the same word opens a
      selection. Two circular drag handles appear at each end; drag
      to extend. Each word segment includes its trailing whitespace,
      so consecutive selected words read as one continuous highlight
      block (not individual words). New module:
      `app/phone/_components/PhoneReader.js`. — completed 2026-05-25
      (overnight 2)
- [x] **Page Swipe reader mode** — when Reader mode is Page Swipe,
      the reader becomes a horizontal CSS-column scroll container
      with `scroll-snap-type: x mandatory`. Swipe left/right to
      flip pages. Scroll mode falls back to normal vertical scroll. —
      completed 2026-05-25 (overnight 2)
- [x] **Popover matches reader width** — annotation popover (Quill)
      and flag popover (Script) are now constrained to the reader's
      column width (centered, max 620px). No more full-viewport
      system-sheet look. — completed 2026-05-25 (overnight 2)
- [x] **Audio Sync mode** — when the desktop has transcribed a
      section (whisperAlignment with word-level timestamps), a Sync
      toggle in the phone audio dock lights up the current word as
      audio plays and auto-scrolls to keep it in view. — completed
      2026-05-25 (overnight 2)
- [x] **IndexedDB project cache + reader-location memory** — phone
      shows last-known project list instantly from cache while the
      cloud pull spins up. Last-opened chapter per project is
      remembered so reopening a project jumps straight back to where
      Marie left off. Cache is no-overwrite-with-empty (so a
      transient cloud failure can't "delete" everything). New
      module: `app/phone/_lib/projectCache.js`. — completed 2026-05-25
      (overnight 2)
- [x] **Redeployed to Vercel** — fresh build pushed. Live at
      **https://stjohn-author-studio-4.vercel.app/phone**. — completed
      2026-05-25 (overnight 2)

### 2026-05-25 overnight session — phone feature parity + desktop polish

- [x] **Visual polish — chapters page top panels.** Removed the outer
      white card that was wrapping the 3 inner pastel cards (the
      card-inside-card was wasting ~190px of vertical space). Tightened
      Audiobook timing to one row (label + Total + Left pills). Tightened
      Bulk audio to one row (label + Start-chapter select + Import button).
      Collapsed the "Manuscript / Chapters" 2-line header into a single
      tight line. Fixed the "· undefined" in the sticky-bar subtitle when
      a book has no fileName. Changed the side-nav incomplete indicator
      from a red × (read as "delete") to a quiet grey ○. The whole top
      band is now ~80px instead of ~270px — five chapters fit above the
      fold instead of three. — completed 2026-05-25 (overnight)


- [x] **Split toggle — no fake scene when chapter has no H2s.** Fixed
      in `app/components/SessionsView.js`. Battery-tested 11 edge cases
      (no h2, h2 only, multi-h2, h2 at start, h2 at end, multi-section,
      empty html, null html, missing section, attribute variants).
      All pass. — completed 2026-05-25 (overnight)
- [x] **PinnedTabPanel shared component + tab-stability hook rule.**
      Added `<PinnedTabPanel>` to `ReaderChrome.js`. Extended
      `.claude/hooks/build-checker.sh` with a soft warn (Rule 6) when
      a mode file adds new `*Tab` state + ternary content render
      without using it. — completed 2026-05-25 (overnight)
- [x] **Edit book data panel — chapter check/uncheck + mode extras.**
      Edit panel in SessionsView now has chapter checkboxes (uncheck
      to remove copyright pages etc.), mode-specific labels (Proof:
      "narrator mapping", Quill: "characters", Duet: book + chapters
      only), and a confirm prompt before destructive removals. —
      completed 2026-05-25 (overnight)
- [x] **Cloud sync for Proof Listen.** (see Active section) —
      completed 2026-05-25 (overnight)
- [x] **Phone Script mode (Proof on phone).** (see Active section) —
      completed 2026-05-25 (overnight)
- [x] **Phone CSV export.** (see Active section) — completed 2026-05-25
      (overnight)
- [x] **Phone audio playback (shared by Quill + Script).** (see Active
      section) — completed 2026-05-25 (overnight)
- [x] **Deep-dive batteries.** Sandbox + pure-function batteries for
      A1 Split toggle (11/11), A3 chapter filter (6/6), A4 audio guard
      (9/9), A4 sync helpers (6/6), A6 buildFlagsCsv (10/10). Live UI
      smoke for phone Script flow (loads, navigates, empty state).
      All passed. — completed 2026-05-25 (overnight)
- [x] **Bug-fix sweep.** Renamed shadowing `flagCount` variable in
      phone page. Added `onError` handler to PhoneAudioDock for
      unsupported audio files. Added confirm guard to chapter-removal
      save flow. — completed 2026-05-25 (overnight)

### 2026-05-24 overnight session — login + Quill + cloud-sync + phone

- [x] **Studio landing page + Supabase login** — Sign in, create
      account, forgot password, show/hide eye icon. Pastel mauve
      aesthetic to match the home. Sign-out lives at the bottom of the
      home page. Auth gate sits in front of the whole app via a
      session check in `app/page.js`. Files: new
      `app/components/LoginScreen.js`, new
      `packages/cloud-sync/account.js`, new
      `packages/cloud-sync/client.js`, gated in `app/page.js`. —
      completed 2026-05-24 (overnight)

- [x] **Shared cloud-sync package** —
      `packages/cloud-sync/` is now the single place every mode talks
      to Supabase. `client.js`, `account.js`, `audio-guard.js`
      (strips audio paths before any upload — CLAUDE.md emphasizes
      this), `quill-sync.js` (push/pull/delete for the three Quill
      tables). Re-exported from `index.js`. — completed 2026-05-24
      (overnight)

- [x] **Quill & Ink desktop mode** — Full port from the alpha.
      4-mode toggle now has Quill enabled. Home → project list →
      ImportFlow → book detail → reader. Reader has word-by-word
      rendering, drag-to-highlight, annotation popover with Image /
      Highlight / Emotion + custom emotions + custom characters,
      inline note, save with delete option. Annotation sidebar with
      jump-to. Local persistence via Electron file system
      (`read-quill-data` / `write-quill-data` handlers in `main.js`
      + `preload.js`, written to `quill-projects.json`). CSV + full
      InDesign JSX exporter ported byte-for-byte. Cloud sync fires
      after every save when signed in. Files: new
      `app/components/QuillAndInkMode.js`, new
      `packages/quill-engine/` (normalize, annotations, exporters,
      index). — completed 2026-05-24 (overnight)

- [x] **Phone scaffold** — `app/phone/page.js`. Login (reused
      LoginScreen), service picker (Quill + Proof placeholder),
      project list pulled from cloud, chapter list, chapter reader
      with tap-to-annotate. Mobile-first layout (max-width 480, sticky
      header). Annotations save to Supabase via the shared cloud-sync
      helpers. — completed 2026-05-24 (overnight)

### 2026-05-24 day session — Prep polish + export pass

- [x] **Header refactor — single nav button on the top-left** —
      previously the Back button and HomePill were fighting for the
      same screen position and the back button hid under the Mac
      traffic lights. Now there's ONE `HomeBackPill` that morphs:
      ⌂ in book detail (goes home), ← in reader (goes back to book
      detail). It sits at top:40 with custom drag region, same level
      as the 4-mode toggle on home. The `StickyTopBar` aligns to that
      row so the eye sees one continuous nav. — completed 2026-05-24

- [x] **One dialogue warning rule** — engine used to emit 7 issue
      types. Now emits one: `missing-closing-quote`, only when no
      follow-up quote within ~3 paragraphs. Marie can't see the noise
      she didn't want. — completed 2026-05-24

- [x] **Section Fixer (per-paragraph editor)** — Fix button on each
      amber warning opens just that paragraph in a textarea with an
      "Insert " here" button at the cursor. Save reruns dialogue
      detection. Edits also recorded so the export replays them. —
      completed 2026-05-24

- [x] **Header confusion fix** — reader top bar title was "Chapter 1
      of 61 · Chapter 2" because it concatenated nav position with
      source heading. Now title is just nav position; source heading
      moves to subtitle and only when it differs. Same fix applied to
      the chapter dropdown and book-detail chapter list. — completed
      2026-05-24

- [x] **Edit chapters cog** — gear button next to Chapters header.
      Toggles edit mode where each chapter row gets a trash X to
      remove it. Chapter numbers re-flow automatically. Marie can fix
      "I accidentally left a chapter in" without re-importing. —
      completed 2026-05-24

- [x] **Auto-assign on character add (in reader)** — when a dialogue
      is selected and Marie adds a new character via the chip, the
      new character is immediately assigned to that dialogue.
      `addCharacter` mints the id synchronously so the caller can
      chain. — completed 2026-05-24

- [x] **Side-voice dialogues carry inline Word comments** — for every
      dialogue assigned to a side voice, the exported .docx has a
      real Word comment with each piece of info on its own line:
      Character, Narrator, Side voice of <character>, Notes,
      [Recurring]/[One time]. Main-character lines stay clean.
      `word/comments.xml` with proper namespaces, content-types +
      rels patched, `<w:commentRangeStart>`/`<w:commentRangeEnd>`/
      `<w:commentReference>` wrapped around each dialogue run. Word
      no longer flags the file as "unreadable". — completed 2026-05-24

- [x] **Pastel palette + Prep is yellow** — `MODE_TOKENS` now has
      `pastel` (very light) + `accent` (mid-tone) + `ink` (dark) per
      mode. Solid buttons use `accent` so the UI reads as pastel-y
      instead of wine. Prep switched from green to yellow. 10-colour
      `CHARACTER_PALETTE` in Marie's preferred order. — completed
      2026-05-24

- [x] **Show sub-headings toggle in ImportFlow** — `allowSceneSplitting`
      prop. When on, Duet sees split groups; Prep keeps it off by
      default. — completed 2026-05-24

- [x] **Duplicate narrator breakdown fix** — `stripPreviousNarratorBreakdown`
      removes any previously-injected breakdown before adding the new
      one. Re-importing an exported file no longer piles up six
      copies. — completed 2026-05-24

- [x] **Fix-quote replays into the exported .docx** — paragraph edits
      from the Section Fixer are recorded on `section.manualEdits`
      and replayed onto the source XML at export time. The missing
      close-quote Marie typed in actually shows up in the downloaded
      file. — completed 2026-05-24

- [x] **`applyHighlightsInPlace` regex constrained** — the `rPr`
      capture used to backtrack across `<w:r>` boundaries when a
      dialogue text only appeared in a later paragraph, which made
      the export inject the narrator breakdown six times. Now the
      capture refuses to cross run boundaries. — completed 2026-05-24

- [x] **Next button bug — actual root cause found** — italic-mid-quote
      dialogues like `"<em>Really</em>?"` made the engine's stripHtml
      produce "Really ?" (with a space) while the reader's stripTags
      produced "Really?" (no space). indexOf returned -1, the span
      didn't render, the cursor got stuck on it, and every dialogue
      AFTER also failed to render. Fixed by importing the engine's
      `stripHtml` into the reader's `paragraphsFromHtml`. — completed
      2026-05-24

### 2026-05-23 session — Prep refactor + shared upload

- [x] **Shared `ImportFlow` for Prep + Duet** — built
      `app/components/ImportFlow.js`. Prep's old inline `SetupView`
      and Duet's `PrebuildManuscriptUpload` both deleted; both now
      render `<ImportFlow ... />`. — completed 2026-05-23

- [x] **Narrator breakdown styling** — switched from `<w:pStyle>`
      references to inline run-property styling so it renders the
      same in any source .docx. — completed 2026-05-23

### Phase 1–4 (bootstrap + base)

- [x] Create `~/Dev/StJohn-Author-Studio-4.0/` and copy Script and
      Sync 3.0 in as the base — completed 2026-05-23
- [x] Set up `.claude/` with scope-locked hooks per bible Step 2.5 —
      completed 2026-05-23
- [x] Write `CLAUDE.md` — completed 2026-05-23
- [x] `git init`, first commit, push to GitHub
      (`stjohnbuilds/stjohn-author-studio-4.0`) — completed 2026-05-23
- [x] Archive old GitHub repos + Google Drive folders — completed
      2026-05-23
- [x] Rebrand npm package, app id, productName, window title, Save
      Data folder — completed 2026-05-23
- [x] Home-screen 4-mode segmented switcher (`AppModeToggle` in
      `app/page.js`) — completed 2026-05-23
