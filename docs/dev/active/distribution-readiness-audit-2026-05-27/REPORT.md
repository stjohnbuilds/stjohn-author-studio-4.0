# App Distribution Readiness Audit — StJohn Author Studio 4.0

**Date:** 2026-05-27
**Auditor:** Claude (Opus 4.7, 1M context)
**Instructions file:** `Game Dev/GitHub/APP_DISTRIBUTION_READINESS_AUDIT_INSTRUCTIONS.md`
**Mode:** READ-ONLY. No code, config, data, or build artefacts were modified.

---

## 1. Executive Summary

**Overall readiness: PARTLY READY for public — READY for a small
trusted circle (Marie + husband + work colleagues).**

Updated 2026-05-27 after the live RLS check (see ISSUE-002 below): the
biggest cloud-data-leak risk turned out to be already fixed in
production. The remaining blockers for *public* release are now
packaging-side (Mac signing) and one untested cloud edge case.

### Biggest risks (public release)
1. **No Mac code-signing or notarization.** First-launch friction on
   any user's machine that isn't Marie's. Confirmed from
   `electron-builder.yml` (no `mac.identity` set, no `notarize` block).
2. **25 GB of old `.app` / `.exe` builds** in `Script and Sync
   Releases/Old/` — they live outside git but live beside the current
   installers and the folder is still named "Script and Sync" (old
   brand). A user / future Marie session could pick up a stale build.
3. **Two-device flag round-trip never formally tested.** Marie has
   informally used the app across her laptop + phone and seen no
   issues; a structured concurrent-save test on real devices is still
   open.

### What's no longer a blocker (resolved this pass)
- ✅ **RLS on the six Supabase tables** — verified directly in the
  database 2026-05-27. All six tables have RLS enabled with policies
  scoped to `owner_id = auth.uid()`. See ISSUE-002 for the SQL
  evidence. **No code or data change required.**

### Most important next actions
1. RLS dashboard verification (Marie or another AI with Supabase access).
2. Two-device flag round-trip live test on a real project.
3. Big-book payload measurement on a fully transcribed real audiobook.
4. Mac signing + notarization decision.
5. Cleanup of `Script and Sync Releases/Old/` (25 GB; safe to delete or move).

### What was not checked
- Live, signed-in app drive-through with Marie's real data — would have
  modified real cloud rows; audit is read-only.
- Packaged Mac / Windows installer launch behaviour on a clean machine.
- The generated `.docx` Prep export opened visually in Microsoft Word.
- The generated InDesign `.jsx` run against a real InDesign layout.
- RLS state on the live Supabase project (`evcusovtjfypfyfvnooy`).

---

## 2. Source Goals Read

### Files read
- `CLAUDE.md` (project root)
- `HANDOFF.md`
- `TODO.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md` (referenced)
- `package.json`
- `electron-builder.yml`
- `next.config.mjs`
- `main.js` (1960 lines)
- `preload.js`
- `packages/cloud-sync/` (every file)
- Test reporter output
- `dev/active/` and `docs/dev/active/` notes

### App purpose
One desktop app + one phone companion for Marie's self-published
audiobook and print workflow. Four desktop modes (Proof Listen, Prep
Manuscript, Duet Prep, Quill & Ink) plus two phone modes (Script,
Quill).

### Target users
Currently Marie (single author, sole operator). Architecture is
multi-user (Supabase auth, RLS, owner_id columns) — a public release
is planned but not the immediate goal.

### Target platform
- Mac (arm64, `dir` target — unpackaged folder)
- Windows (x64, portable `.exe` and NSIS installer)
- Phone (Vercel-deployed Next.js static export at
  `https://stjohn-author-studio-4.vercel.app/phone`)

### Done definition (derived from docs)
A feature is "done" only after Marie clicks it on a real file. Tests
passing is necessary but not sufficient. Every mode shares ONE reader
(Proof + Quill via `ChapterReader`, Prep + Duet keep their own by
design), ONE cloud-sync package, ONE manuscript engine, ONE audio
engine. Audio never goes to Supabase. No fake sample data.

### Missing or unclear goals
- No single source-of-truth file states the v1.0 release criteria for
  external users. `TODO.md` mixes Marie-only checks with public-release
  checks (e.g. RLS verification is listed but not gated).
- "What distribution means" is not formalised. There's no
  `DISTRIBUTION_CHECKLIST.md`; the closest is
  `dev/active/FINAL-ROUND-checklist.md` (not read here in full).

---

## 3. External App Tree Map

### Documented external structure source
**Partial.** `CLAUDE.md` describes the target layout but says the repo
"is a straight copy of Script and Sync 3.0; the other modes will be
added phase by phase." The doc layout includes folders that do not
exist (`app/proof-listen/`, `app/prep-manuscript/`, etc.) and existing
mode files live directly under `app/components/` instead. No formal
`docs/APP_STRUCTURE.md`. **Planned-vs-actual comparison is therefore
partial** — code reflects an evolved decision, not the planned tree.

### Actual external structure (project root)

| Item | Type | Apparent purpose | Distribution relevance | Risk | Notes |
|---|---|---|---|---|---|
| `app/` | source | Next.js app router | ships | low | Active |
| `packages/` | source | Shared engines | ships | low | Active |
| `lib/` (none at root) | — | — | — | — | not present |
| `main.js`, `preload.js` | source | Electron main + preload | ships | low | Active |
| `bin/` | binary | whisper.cpp binaries + ggml model | ships (selected by electron-builder filter) | low | Documented |
| `build/` | asset | App icons | ships | low | Active |
| `out/` | build | Next static export | regenerated each build | low | Gitignored |
| `dist/` | build | electron-builder output (1.4 GB) | regenerated each build | low | Gitignored |
| `node_modules/` | build | dependencies (~1 GB) | not in dist | low | Gitignored |
| `Save Data/` | save | Local data store (54 MB total) | not in dist | **medium** | Marie's real data — gitignored but sits inside the source folder. See §6. |
| `Script and Sync Releases/` | dist | Output destination for `release:mac` / `release:win` (~25 GB total, mostly `Old/`) | not in dist | **HIGH** | Old brand name. 37 stale builds in `Old/`. Confusing surface for any user. |
| `docs/` | docs | Truth trees, build plan, cloud schema | not in dist | low | Active |
| `docs/dev/active/` | docs | Bible Step 5 three-file folders | not in dist | low | Some folders look stale |
| `dev/active/` | docs | Older active task folders | not in dist | medium | Probably should be merged with `docs/dev/active/` |
| `tests/` | source | `node --test` suites (6 files, 11 tests) | not in dist | low | Active |
| `scripts/` | dev | Build helpers, sandbox seeds, diagnostics | not in dist | low | 22 files, several diagnostic-only |
| `public/branding/` | asset | Logo / icon assets | included in `out/` | low | Active |
| `.claude/` | dev | Claude Code hooks + settings | not in dist | low | 14 hooks active; `hook-activity.log` confirms recent activity |
| `Save Data/Manuscript Sources/` | save | DOCX sources kept beside saves | not in dist | low | Documented |
| `DEV - Start Editable App.command`, `MAC - Build Proofer.command`, `WINDOWS - Build Proofer.cmd`, etc. | shortcut | Double-click helpers | not in dist | low | Old brand name "Proofer" — confusing |
| `READ ME FIRST - OPEN THIS.txt`, `DEVELOPER ONLY - EDIT AND BUILD HERE.txt`, `TODAY-CHANGES-2026-05-23.md` | docs | Top-level Marie notes | not in dist | low | Active |
| `HANDOFF.md`, `TODO.md`, `CLAUDE.md`, `FUTURE-TODO.txt` | docs | Active session memory | not in dist | low | Active |
| `.env.local` | config | Supabase URL + publishable key | not in dist | **medium** | Staged for deletion in git (was tracked, now gitignored). File still exists on disk; values look right. See §6.d. |
| `.vercelignore`, `next.config.mjs`, `tailwind.config.js`, `postcss.config.js` | config | Web build config | influences build output | low | Active |
| `electron-builder.yml` | config | Packaging config | controls installers | medium | No code-signing, no notarization, see §9. |

### External tree risks
- **`Script and Sync Releases/Old/` is 25 GB** of stacked builds named
  in the old brand. Recommend moving these out of the project folder
  entirely (e.g. into `~/Archive/` or Drive) or deleting all but the
  most recent two.
- **Folder name `Script and Sync Releases/` is stale.** The product is
  now `StJohn Author Studio`. Rename to e.g. `StJohn Releases/` or move
  out of the repo to avoid confusion.
- **Shortcut filenames at root still say "Proofer" / "Script and Sync"**
  (e.g. `MAC - Build Proofer.command`, `WINDOWS - Build Proofer.cmd`).
  Functionally fine but cosmetically inconsistent.

---

## 4. Internal App Tree Map

### Documented internal structure source
**Partial.** `docs/INTERNAL_FUNCTION_TREE.md` and
`docs/FRONT_FUNCTION_TREE.md` exist (referenced in `HANDOFF.md`) but
were not read end-to-end in this pass. `docs/SHARED_COMPONENTS.md` is
the authoritative cheat-sheet for component reuse and is up to date.
`docs/CLOUD_SCHEMA.md` is the authoritative cloud-flow doc and is up
to date.

### Actual internal structure

**Pages / windows:**
- `app/page.js` (2,584 lines) — desktop home + 4-mode switcher +
  Proof Listen mode + Auth gate + cloud pull/push orchestration
- `app/phone/page.js` (3,041 lines) — phone Script + Quill companion
- `app/layout.js` — Next root layout

**Shared components** (`app/components/`):
- `LoginScreen.js` (409) — Supabase auth UI; has dev-skip button gated
  by `process.env.NODE_ENV !== 'production'` (safe)
- `BookDetail.js` (300) — shared book detail page (sticky bar +
  chapters + delete)
- `SessionsView.js` (3,051) — book detail inner view used by Proof +
  Quill + Duet
- `ChapterReader.js` (427) — THE shared manuscript reader for Quill +
  (eventually) Proof
- `ProofingReader.js` (1,445) — Proof's still-inline reader; migration
  to `ChapterReader` is queued in TODO
- `AudioDock.js` (259) — shared audio dock
- `ImportFlow.js` (823) — shared DOCX upload + chapter picker
- `ReaderChrome.js` (557) — top bar, save badge, mode tokens
- `ManuscriptSetup.js` (982) — Proof's import wrapper (renders
  ImportFlow + narrator panel)
- `QuillAndInkMode.js` (1,960) — Quill mode root
- `PrepManuscriptMode.js` (1,835) — Prep mode root
- `PrebuildMode.js` (1,458) — Duet mode root
- `prepExport.js` (999) — Prep Word export logic
- `InfoTip.js` — small tooltip

**Engines** (`packages/`):
- `cloud-sync/` — 10 files, every Supabase call goes through here
  (audio-guard, cloud-slim, flag-queue, tombstones, proof-sync,
  quill-sync, account, client, error-message, index)
- `audio-engine/` — index.js + whisper-json.cjs
- `manuscript-engine/` — dialogue-detection, dialogue-safety-check,
  text-normalize, word-import + index
- `quill-engine/` — annotations, exporters, normalize, index

**Electron main** (`main.js`, 1,960 lines):
- Data persistence (books, prebuild, prep, quill — each with primary +
  mirror paths + Quill summary cache)
- Google Drive / portable / custom data-folder detection
- IPC handlers (~40+) for all renderer ↔ disk operations
- whisper.cpp spawn + progress + cancel
- DOCX → PDF conversion via LibreOffice / Word
- Transfer bundle export / import

### Data flow per type

**Typed text (Proof flags, Quill annotations, Prep notes)**
- Created: in mode UI, written to React state
- Stored: locally in `Save Data/*.json` (via Electron IPC), AND mirror
  copy, AND pushed to Supabase (Proof + Quill only; Prep + Duet are
  desktop-only)
- Loaded: on app start (`readData`), on focus (`pullProofProjects` /
  `pullQuillProjects`), and merged via `mergeProofBookLists` /
  `mergeQuillProjects`
- Restart behaviour: persisted; verified by code path
- Failure: cloud failure falls back to local + queued retry via
  `flag-queue.js` (with backoff, max 8 attempts)

**Audio**
- Stays on whichever device it lives on. Audio files are NEVER
  uploaded. `audio-guard.js` strips audio path / blob / buffer / base64
  / data URL keys from any object before it hits Supabase.
- Audio file *names* travel up (so the phone can match a local file by
  name). The whisperAudioKey is rewritten from `path:/…` to
  `name:<normalised>` before upload.
- Local audio playback in Electron uses a custom `localfile://`
  protocol (registered in `main.js:1208`).

**Whisper transcription**
- Triggered from desktop. Spawns native `whisper-cli` binary from
  `bin/`. Output `.json` parsed via `parseWhisperJsonWords` (tested).
- Stored: alignment + words in `script_sync_section_transcriptions`
  table; metadata also folded into the slim cloud blob.
- Single active process enforced (`activeWhisperChild`). 30-minute
  timeout. Cancellable. SIGKILL on quit.

**Manuscript source (DOCX)**
- Saved to `Save Data/Manuscript Sources/<bookId>.docx` so re-scans
  for paging or PDF conversion can run without re-upload.
- Not sent to Supabase. DOCX → PDF conversion is local (LibreOffice or
  Microsoft Word COM on Windows). PDF is used for page mapping and
  discarded.

**PDF page map**
- Built once at import (`buildSlimPageMap` referenced in TODO; lives
  in `app/lib/pdfPaging.js`).
- Slim form (`pdfPageMap`) syncs to cloud; heavy `pdfPaging.pages`
  array is stripped by `cloud-slim.js` (recently added).
- Phone receives the slim map only.

### Internal tree risks
- **ProofingReader.js still 1,445 lines and unmigrated** to
  `ChapterReader`. This is logged in TODO ("Migrate `ProofingReader.js`
  to use `ReaderChrome.js`" — low priority cleanup) but is also flagged
  in `SHARED_COMPONENTS.md` as high-risk because Proof is Marie's
  anchor mode.
- **Mode files are large.** SessionsView at 3,051 lines, app/phone at
  3,041, app/page at 2,584, QuillAndInk at 1,960, Prep at 1,835. By
  themselves not a defect, but they slow down code review and a real
  bug investigation tends to scroll for thousands of lines.
- **`webSecurity: false`** in the Electron BrowserWindow config
  (`main.js:1189`). Done intentionally to allow `localfile://` audio
  playback. Cost: the renderer loses CORS protection and CSP
  enforcement. Acceptable for an offline-first author tool; flag for
  documentation. Stricter alternative: register a custom protocol with
  `protocol.registerStreamProtocol` and re-enable webSecurity. See §10.
- **Module-level Maps for last-pushed hash** in `proof-sync.js` and
  `quill-sync.js`. Cleared on sign-out (verified at
  `app/page.js:509-510`). Good. Not currently asserted by a test.

---

## 5. Feature And User Pathway Map

| Pathway | Steps | Tested? | Result | Issues |
|---|---|---|---|---|
| Login (Supabase) | Open app → Sign in → enter email/password → home | Partial (code read, screenshot taken) | Login screen renders cleanly, no console errors. Dev-skip button correctly hidden in `production` builds. | None observed |
| New Proof book → import DOCX | Home → + New → Import DOCX → narrator mapping → save | Not run live | Code path exists in `ImportFlow` + `ManuscriptSetup` | Cannot verify without modifying real Save Data |
| Transcribe a Proof section | Open chapter → assign audio → Transcribe | Not run live | `whisper-transcribe` IPC handler is robust (timeout, cancel, SIGKILL on quit, stdout drain) | Cannot verify without real audio |
| Add Proof flag | Reader → select word → flag popup → save | Not run live; cloud safety verified in code | Desktop now uses single-row `upsertProofFlag` + queue (per TODO 2026-05-27) | Real-file verification logged in TODO |
| Prep — assign dialogue + export | Prep mode → assign → export Word | Tested by unit tests (prep-export.test.mjs) | 2 tests pass: comments preserved, repeated dialogue handled. **Real `.docx` opened in Word not yet done.** | Listed as Top-1 in HANDOFF |
| Quill — annotate + export InDesign | Quill mode → drag word → save annotation → export JSX | Tested by unit tests (quill-exporters.test.mjs) | 1 test passes covering every annotation category. **Real InDesign run not yet done.** | Listed as Top-3 in HANDOFF |
| Duet — find markers | PrebuildMode → … | Not tested live; no automated tests | No regression noted | Marie hasn't called Duet a blocker |
| Phone — sign in, open project, add annotation | Phone URL → sign in → project list → chapter reader → tap word → save | Marie confirmed 2026-05-27 it works after the pending-flag backup patch | Live-verified | Phone Quill edit/delete still missing — known |
| Phone → desktop flag round-trip | Phone saves flag → desktop refreshes → sees flag | **Marked unknown in TODO.** | Architecture supports it (single-row upsert + tombstones + queue); not live-verified | Needs two-device test |

---

## 6. Data, Save, And Cloud Safety

This section is the heart of the audit.

### 6.a. Save types

| Save type | Local | Cloud | Audio guard | Notes |
|---|---|---|---|---|
| Proof books (`books.json`) | Yes — primary + mirror | Yes — `script_sync_projects` (slimmed) | Yes | 2.1 MB on disk currently |
| Proof flags | Yes (in books.json) | Yes — `script_sync_flags`, one row per flag | Yes | Desktop now uses single-row upsert (2026-05-27) |
| Proof transcriptions | Yes (in books.json) | Yes — `script_sync_section_transcriptions` | Yes | Replaced on every push |
| Quill projects (`quill-projects.json`) | Yes — primary + mirror + summary cache | Yes — `quill_projects` (slimmed) | Yes | 40 MB on disk |
| Quill chapters | Yes | Yes — `quill_chapters` | Yes | content_hash now read on pull (2026-05-27 fix) |
| Quill annotations | Yes | Yes — `quill_annotations` | Yes | Single-row upsert by `(project_id, local_id)` |
| Quill chapter alignment | Yes (in chapters) | Yes — column on `quill_chapters` (selected on pull as of 2026-05-27 fix) | Yes | Bug fixed: alignment used to be written but not pulled |
| Prep projects (`prep-manuscript-projects.json`) | Yes — primary + mirror | **No** (desktop-only by design) | n/a | 8.2 MB on disk |
| Duet projects (`prebuild-projects.json`) | Yes — primary + mirror | **No** (desktop-only by design) | n/a | 2.7 MB on disk |
| Manuscript source DOCX | Yes — `Save Data/Manuscript Sources/` | **No** | n/a | Used to re-scan PDF on demand |
| Settings | Yes — `app.getPath('userData')/settings.json` | **No** | n/a | Custom data folder, whisper arch, whisper model, threads |

### 6.b. Save-safety checks

- ✓ **Primary + mirror writes** for every JSON store. If the primary
  location goes corrupt, the mirror is silently restored from on next
  read.
- ✓ **Save locations clear to user.** `getDataLocation` IPC exposes
  the current path. UI offers "Choose data folder."
- ✓ **Filename sanitization** in `sanitizeFileName` (main.js:407) —
  strips `/\?%*:|"<>`, collapses whitespace, max 120 chars.
- ✓ **Unique export paths** — `uniqueExportPath` appends ` (1)`,
  ` (2)` to avoid silent overwrite dialogs.
- ✓ **Audio path encoding** is platform-aware (`gdrive://`,
  `data://`, absolute) so books survive moving between Mac and Windows
  if the user is on the same Google Drive.
- ⚠ **Partial saves on cloud push.** `proof-sync.js` does
  `upsert project → delete-then-insert transcriptions → upsert+prune
  flags`. If the network drops between steps 2 and 3, the project row
  is updated with a section_count that doesn't match the
  transcription table. The next pull would reconstruct from the
  desktop_book blob (still authoritative) and the partial table
  state, so the user does not lose data — but the
  transcription_count on the row is briefly wrong. Mitigated by the
  hash-gate skipping no-op pushes on retry.
- ⚠ **No backup beyond the mirror** for catastrophic disk corruption.
  Marie should have a separate backup strategy (Time Machine, Drive
  versioning).
- ⚠ **No write lock.** Two Electron windows of the same project open
  simultaneously could race; in practice the app forces a single
  window.

### 6.c. Cloud-safety checks

The cloud-sync package was independently audited 2026-05-26 (results
in `TODO.md` under "🔴 CLOUD SAFETY AUDIT FINDINGS"). 4 bugs / 8
risks / 5 unknowns. As of 2026-05-27:

✅ **Patched bugs:**
- Sign-out clears books + push-hash caches (`app/page.js:499-510`)
- Quill alignment now pulled (`quill-sync.js:172`)
- Tombstones use `{id, cloudId}` pairs with `clearTombstone` and
  retry caps
- Full-book flag sync uses upsert-with-prune + `updated_at <=
  pushStartedAt` guard so concurrent single-flag saves are not wiped

✅ **Patched risks:**
- Audio extension list now matches CLAUDE.md (8 extensions)
- Flag queue has retry backoff + max 8 attempts
- Desktop flag saves use the per-row queue too
- `lastPushHashByCloudId` cleared on sign-out
- Quill content_hash now read on pull
- Tombstone delete capped at 8 attempts
- NOT-IN id list now quoted defensively

❌ **Still unverified:**
- RLS policies on the six Supabase tables (Marie / dashboard access)
- Phone → desktop Proof-flag two-device round-trip
- Big-book payload size on a fully transcribed real book
- Concurrent full-book + single-flag push under stress
- Hidden flag queue in app/page.js / SessionsView.js (re-grep)

### 6.d. The `.env.local` situation

`.env.local` is **staged for deletion** in git (a leftover from the
"tracked-env cleanup" mentioned in HANDOFF), but the file exists on
disk and contains:
- `NEXT_PUBLIC_SUPABASE_URL=<set>`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<set>` (publishable, not
  service-role — fine to expose to client)

This is correct end-state — the file should be gitignored, not
tracked. Marie just needs to commit that staged deletion to remove
the historical tracking. **No secret leak in the current state.**

A separate concern: the Vercel build uses the same env vars set in
the project's environment, so the phone deploy is independent of
this local file.

### 6.e. File-name and path cases

- ✓ Spaces in paths handled (uses `path.join`, never string
  concatenation).
- ✓ Apostrophes / quotes / parentheses survive (no shell exec on
  user paths; whisper-cli is spawned with arg array).
- ⚠ **Emoji / non-English characters** — `sanitizeFileName` does NOT
  strip them, which is fine. PDF text-search normalisation in
  `normalizePdfSearchText` strips non-ASCII before search — would
  fail to match accented words in a search. Probably acceptable; not
  measured.
- ⚠ **Cloud-folder path changes** — `gdrive://` re-resolution on
  load (`decodeStoredFilePath`) handles the user moving between
  Google Drive setups, but a second Google account would shadow the
  first (uses `[0]`).

---

## 7. Visual And UX Checks

**Scope:** read-only audit. Boot the Next dev server, snapshot the
first screen, and confirm no console errors. Driving deeper would
require real Supabase credentials and would write to the live
project. Skipped.

### Screen 1 — Login (`http://localhost:3000`)

✓ **Page title** "StJohn Author Studio" — correct
✓ **Subtitle** "Proof Listen · Prep Manuscript · Duet Prep · Quill &
Ink" — accurate and matches docs
✓ **Sign in form** clean, single card, eye-icon toggle, mauve
primary button matches design language
✓ **Forgot password** + **Create account** links present
⚠ **DEV · SKIP LOGIN (FAKE SESSION)** button visible — verified
  gated on `process.env.NODE_ENV !== 'production'` at LoginScreen.js
  line 313. Will not ship.
✓ **No console errors**
✓ **No server errors** in Next stdout

### What was not visually checked
- All four desktop mode home screens
- The shared Reader on real DOCX content
- The audio dock with a real audio file
- The Prep dialogue assignment flow
- The Quill annotation drag-handle behaviour
- Edge-state UIs (empty / loading / error)
- Mobile viewport (phone route, real handset)
- Dark mode / mode-token contrast

Recommend a separate visual sweep using the
`usability-check-trigger.sh` hook protocol with Marie's hands.

---

## 8. Edge Case And Stress Testing

Not run live. Code-level observations:

### Empty / first-launch states
- ✓ Home shows "Import a manuscript" when no books exist (per
  `CLAUDE.md` rule "no fake data").
- ✓ Phone has IndexedDB project cache so empty cloud responses don't
  wipe the cached project list (`projectCache.js`, per TODO archived
  2026-05-25).

### Long content
- ⚠ The reader is virtualised? **Not verified.** With a 419-page
  manuscript and word-level spans, render cost could be heavy. No
  observation in the screenshot pass.

### Error paths
- ✓ `formatCloudErrorMessage` strips raw Cloudflare HTML and gives
  plain English to the user — tested.
- ✓ Whisper failure surfaces a real Error with last 500 bytes of
  stderr.
- ✓ DOCX → PDF conversion has fallback chain (Word → LibreOffice on
  Windows; LibreOffice only on Mac) with combined error message.

### Performance signals
- Quill data file 40 MB on disk — local-only, large project, no
  evidence of slow load (TODO has a real-machine timing check listed).
- Big-book cloud payload not measured.
- Hash-gate on every push avoids no-op round-trips.
- Vercel deploy is a static export — should be fast.

---

## 9. Packaging And Distribution Risks

### 9.a. Packaging config

`electron-builder.yml`:
- appId: `com.stjohnbuilds.authorstudio` — correct
- productName: `StJohn Author Studio` — correct
- copyright: `© 2026 StJohn Builds` — fine
- output: `dist/` — gitignored
- Mac target: `dir` (unpackaged folder), arm64 only
- Windows targets: `portable` + `nsis`, x64

### 9.b. Issues found

🔴 **No Mac code-signing.** `electron-builder.yml` has no `mac.identity`,
no `notarize` configuration, no Apple Developer ID. First launch on any
machine that isn't Marie's will show Gatekeeper warnings. For
distribution outside Marie this is effectively a blocker.

🔴 **No Mac packaged installer.** Target is `dir` only — produces a
folder, not a `.dmg` / `.pkg`. Users would have to drag the `.app` out
manually. Listed as a future task in FUTURE-TODO.

🟡 **Windows is not signed** (`signAndEditExecutable: false`).
SmartScreen will warn on first launch. Acceptable for Marie's circle
of trust; not for public release.

🟡 **`Script and Sync Releases/` is 25 GB**, mostly in `Old/` (37
stale builds named in the old brand). This is gitignored but lives
inside the source folder, so any "clone, build, distribute" flow
will be slow to traverse and confuses casual inspection.

🟡 **`copy-release.js` script** moves builds into `Script and Sync
Releases/`. Folder naming should be aligned with current branding
before any external release.

🟡 **Whisper binaries are 200+ MB** of `.dll` / `.bin` files in `bin/`.
The `extraResources` filter excludes `ggml-large-v3-turbo.bin` (a
larger optional model). The included `ggml-base.en.bin` model is
required for transcription. This adds significantly to the installed
size but is unavoidable for offline transcription.

### 9.c. Dev vs packaged differences

- ✓ `isDev` flag (`NODE_ENV === 'development'`) drives all dev-only
  paths (dev-skip login, Save Data in project folder, etc.).
- ✓ Packaged app spawns a local static HTTP server (random port) to
  serve the `out/` build, avoiding `file://` quirks.
- ⚠ `getWhisperBinDir` returns `process.resourcesPath/bin` when
  packaged — depends on `extraResources` actually copying it.
  Manually verifiable in `dist/mac-arm64/.../Contents/Resources/bin`
  after a packaged build.
- ⚠ DOCX → PDF requires LibreOffice (Mac) or Word/LibreOffice
  (Windows) to be installed on the user's machine. There's no
  fallback. If neither is present, page-number lookups never get
  built. **Not a blocker for Marie** (she has Word) but a problem
  for any other user.

### 9.d. Required follow-up tests

- [ ] `npm run release:mac` then launch the packaged `.app` on a
      clean Mac and walk a real audiobook flow.
- [ ] `npm run release:win` then launch the packaged installer on a
      clean Windows machine and walk a real audiobook flow.
- [ ] Code-sign + notarize Mac build.
- [ ] Decision: sign Windows build, or accept SmartScreen warning.

---

## 10. Code Health Assessment

### 10.a. Strong areas

- **Cloud-sync package is small, well-commented, and recently
  audited.** Each file has a clear single purpose. "Why" comments are
  abundant where the logic depends on a past bug.
- **Single source of truth for shared UI** is enforced by the
  build-checker hook (see `.claude/hooks/build-checker.sh`). The hook
  hard-blocks fresh `function .*BookDetail/HomeView/ChapterRow/
  ReaderView/Setup/Panel/AudioDock/Picker` in mode files.
- **Tests cover the riskiest pure-function logic:** error formatting,
  cloud-slim, dialogue detection, prep export, Quill exporters,
  whisper JSON parsing. 11/11 pass.
- **Hooks log to `.claude/hook-activity.log`** per Marie's bible.
- **Audio-guard is recursive and conservative.** Strips paths, blobs,
  ArrayBuffers, typed arrays before any upload.
- **Tombstones + flag-queue together** address the two known
  "vanished work" failure modes.

### 10.b. Weak areas

- **Three files over 2,500 lines:** `app/components/SessionsView.js`
  (3,051), `app/phone/page.js` (3,041), `app/page.js` (2,584). Hard to
  audit in a single pass. Not a defect; an organisational concern.
- **ProofingReader.js still inline** (1,445 lines). Anchor mode of the
  app. Migration to `ChapterReader` would unlock the "fix once = fix
  everywhere" guarantee for the most-used mode.
- **Two `dev/active` parallel folders.** `dev/active/` (older) and
  `docs/dev/active/` (current). Some content is stale.
- **No automated test for the cloud-sync push path** — only the slim /
  audio-guard / error-message pure functions are tested. The full
  push flow against a mock Supabase isn't exercised.
- **No test for `flag-queue.js` backoff / retry semantics.**
- **`webSecurity: false` is a real concession.** Stricter pattern:
  register a custom protocol (`protocol.registerStreamProtocol`) that
  whitelists the configured Save Data folder and re-enable
  webSecurity. Not a blocker for Marie's use; flag for a future pass.
- **ESM/CJS warning at test time** (`MODULE_TYPELESS_PACKAGE_JSON`).
  Fix is one line in `package.json` (`"type": "module"`) or rename a
  few files to `.mjs`. Cosmetic but adds noise to every test run.
- **Legacy paths in main.js** reference "Audioproofer" / "Proofer 3.0"
  (`legacyDataPaths()`). Useful for one-time migration from old
  installs; harmless to keep but easy to remove once Marie confirms
  she doesn't need them.

### 10.c. Test health

- **6 test files, 11 passing tests** (`node --test`):
  - `cloud-error-message.test.mjs` — 1 test
  - `cloud-slim.test.mjs` — 1 test
  - `manuscript-engine.test.mjs` — 4 tests
  - `prep-export.test.mjs` — 2 tests
  - `quill-exporters.test.mjs` — 1 test
  - `whisper-json.test.mjs` — 2 tests
- **What's NOT covered:** cloud push/pull flows, flag-queue retry,
  tombstone retry, audio guard recursion, normalize, account validation,
  reader rendering, audio dock, import flow.

### 10.d. Dependency and config

- Dependencies are pinned to caret (`^`) ranges, current as of build.
- No `audit` results inspected — `npm audit` not run in this audit.
- `package-lock.json` present.
- No secrets in tracked files (`.env.local` is gitignored).
- No `.npmrc`. No registry overrides.

### 10.e. Code health percentage rating

**Provisional code health score: 72%.**

Marked provisional because the live drive-through and the
multi-device round-trip have not been done.

| Category | Weight | Score | Evidence | Confidence |
|---|---:|---:|---|---|
| Planned vs actual structure | 20% | 13% | Documented plan diverged (no `app/proof-listen/` etc.), but `SHARED_COMPONENTS.md` is current and the build-checker hook prevents duplication | medium |
| Separation of responsibilities | 15% | 13% | `packages/` engines are isolated; large mode files compromise this | high |
| Save / data / cloud safety architecture | 15% | 12% | Audio guard, cloud-slim, tombstones, flag-queue are well-considered; recent audit results applied | medium |
| Main workflow reliability | 15% | 11% | Marie confirmed Proof + Quill flows on real data 2026-05-27; Prep + Duet less recently verified | medium |
| Error handling and recovery | 10% | 8% | `formatCloudErrorMessage`, queue + tombstone retries, mirror writes | medium |
| Test coverage and quality | 10% | 4% | Pure-function tests only, no integration | high |
| Packaging / release structure | 10% | 4% | No code-signing, no notarization, no Mac DMG, brand-stale releases folder | high |
| Maintainability and clarity | 5% | 3% | Excellent docs and comments; offset by very large mode files | medium |

**Total: 72%** — workable, but distribution risk remains (label:
60–74% per the audit instructions).

The score does not factor in **unknown** items (RLS verification,
two-device round-trip) — those could push it down or up depending on
results.

---

## 11. Coverage Tracker

| Area | Checked? | Method | Result | Remaining Uncertainty |
|---|---|---|---|---|
| Source goals | Yes | Read CLAUDE.md, HANDOFF.md, TODO.md, BUILD_PLAN_V4.md, SHARED_COMPONENTS.md, CLOUD_SCHEMA.md | App purpose clear; v1 release criteria informal | No formal `DISTRIBUTION_CHECKLIST.md` |
| Documented structure baseline | Partial | docs read | Truth trees exist but partially diverged from actual layout | INTERNAL/FRONT FUNCTION_TREE not deep-read |
| External tree | Yes | Folder inspection, `du`, `ls -lh` | 25 GB stale builds; brand-stale folder names | None |
| Internal tree | Yes | File reads, line counts, grep | Large mode files; Proof reader unmigrated | None |
| Main workflows | Partial | Code inspection + TODO cross-reference | Most paths exist; Marie has confirmed a subset on real data | Not driven live by auditor |
| Hands-on runtime bug hunt | No | — | — | Skipped (would have modified real cloud data) |
| Save/load | Partial | Code inspection of main.js IPC + cloud-sync push/pull | Mirror writes + cloud queue look safe | Two-device live test |
| Cloud behavior | Yes (code) | Full read of `packages/cloud-sync/` | Bugs from 2026-05-26 audit are patched | RLS verification, big-book payload |
| Import/export | Partial | Read prepExport, quill-engine/exporters; tests pass | Pure logic verified | Real `.docx` opened in Word, real `.jsx` run in InDesign |
| Visual UX | Partial | Boot dev server, snapshot login | Login clean, no console errors | Other screens not visited |
| Edge cases | Partial | Code reasoning | Whisper cancel/timeout, partial-push behaviour considered | Long-content render cost not measured |
| Packaging | Yes (config) | Read electron-builder.yml | No signing/notarization; stale releases folder | Clean install on fresh machine |
| Code health | Yes | File reads, line counts | Score: 72% provisional | Some files not read in full |
| Planned vs actual structure | Partial | docs/SHARED_COMPONENTS.md vs file tree | Components match the cheat-sheet; folder layout diverged from BUILD_PLAN_V4 | INTERNAL/FRONT_FUNCTION_TREE not deep-read |
| Code health percentage score | Provisional | Weighted scoring | 72%, provisional | Live tests would refine |
| Tests | Yes | `npm test -- --test-reporter=spec` | 11/11 pass | Integration coverage thin |

---

## 12. Untested / Uncertain Areas

Listed so they don't hide:

- Live drive-through of every mode against real data.
- Two-device flag round-trip (phone ↔ desktop).
- Stress test: 50-chapter fully transcribed book.
- Packaged Mac `.app` launched on a clean machine.
- Packaged Windows installer launched on a clean Windows machine.
- Real Word `.docx` opened in Microsoft Word after Prep export.
- Real InDesign `.jsx` run on a real layout.
- RLS dashboard verification.
- `INTERNAL_FUNCTION_TREE.md`, `FRONT_FUNCTION_TREE.md`,
  `WIRING_MATRIX.md`, `FINAL-ROUND-checklist.md` content — referenced
  but not deep-read here.
- `npm audit` not run.
- Vercel deploy `/phone` route not visited (only desktop login).

---

## 13. Issues Found

### Issues — using the section 11 required format

---

**ISSUE-001 — Mac code-signing / notarization absent**

- **Severity:** Blocker (for external distribution); Medium (for
  Marie-only use)
- **Confidence:** Confirmed
- **Location:** `electron-builder.yml`
- **What is wrong:** No `mac.identity`, no `notarize` block. First
  launch on any non-Marie Mac will fail Gatekeeper / SIP.
- **Why it matters:** Distribution to anyone outside Marie's machine
  is functionally blocked.
- **How to reproduce:** Move `dist/mac-arm64/StJohn Author Studio.app`
  to a clean Mac and double-click.
- **Evidence:** electron-builder.yml lines 29–35 (Mac section has
  only `icon`, `category`, `target`).
- **Suggested next step:** Decide whether v1 ships only to Marie. If
  external, get an Apple Developer ID, add `mac.identity` and
  `afterSign` hook for notarization.
- **Do not fix during this read-only audit.**

---

**ISSUE-002 — RLS policies on six Supabase tables — ✅ RESOLVED 2026-05-27**

- **Severity:** Was Blocker (public) / High (private). Now: not a risk.
- **Confidence:** Confirmed.
- **Location:** Supabase project `evcusovtjfypfyfvnooy`, schema `public`.
- **Status:** Verified live via Supabase MCP. All six tables have
  `relrowsecurity = true` (RLS enabled) and the policy set below
  scopes every read/write to the signed-in user.

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|---|---|---|---|---|---|
| `script_sync_projects` | ✓ owner_id = auth.uid() | ✓ with_check owner_id | ✓ both sides owner_id | ✓ owner_id | Full coverage |
| `script_sync_section_transcriptions` | ✓ owner_id | ✓ + parent-project owner check | ✓ both sides owner_id | ✓ owner_id | Defence in depth |
| `script_sync_flags` | ✓ owner_id | ✓ via `ALL` policy with parent-project owner check | ✓ via same `ALL` | ✓ via same `ALL` | Coalesced ALL policy |
| `quill_projects` | ✓ owner_id | ✓ with_check owner_id | ✓ both sides owner_id | ✓ owner_id | Full coverage |
| `quill_chapters` | ✓ owner_id | ✓ via `ALL` + parent-project owner check | ✓ via same `ALL` | ✓ via same `ALL` | Coalesced ALL policy |
| `quill_annotations` | ✓ owner_id | ✓ via `ALL` + parent-project owner check | ✓ via same `ALL` | ✓ via same `ALL` | Coalesced ALL policy |

- **Effect:** A signed-in user cannot SELECT, INSERT, UPDATE or
  DELETE any row whose `owner_id` is not theirs. The secondary
  tables (chapters, annotations, flags, transcriptions) also require
  the parent project to belong to them — so a malicious client
  cannot create orphaned rows pointing at someone else's project.
- **Performance lints from `get_advisors`** (separate concern): 30×
  `auth_rls_initplan` and 18× `multiple_permissive_policies` apply
  to these tables. They re-evaluate `auth.uid()` per row and OR
  multiple permissive policies. Not a security issue — just a
  performance optimisation. Wrap `(select auth.uid())` if it
  becomes a problem.

---

**ISSUE-003 — Two-device Proof-flag round-trip not live-verified**

- **Severity:** High
- **Confidence:** Needs testing
- **Location:** `packages/cloud-sync/proof-sync.js` +
  `packages/cloud-sync/flag-queue.js` + `app/phone/page.js`
- **What is wrong:** Architecture supports concurrent flag saves
  without clobber, but the actual phone → desktop and desktop →
  phone path has not been tested with two devices.
- **Why it matters:** Phone is the primary "I'm not at my laptop"
  workflow. Lost flags would be catastrophic.
- **How to reproduce:** On phone, save a flag while offline → bring
  online → desktop refresh → flag should appear. On desktop, save a
  flag → phone refresh → flag should appear. Repeat with both
  devices online simultaneously.
- **Evidence:** TODO lists this as `?` unknown.
- **Suggested next step:** Marie + a phone test session.
- **Do not fix during this read-only audit.**

---

**ISSUE-004 — 25 GB of stale builds in `Script and Sync Releases/Old/`**

- **Severity:** Medium (cleanup); Low (functional)
- **Confidence:** Confirmed
- **Location:** `Script and Sync Releases/Old/`
- **What is wrong:** 37 `.app` and `.exe` builds from May 26–27 2026,
  named in the old brand. Sit beside the current installers.
- **Why it matters:** Disk space; confusion for anyone inspecting the
  project; risk of distributing a stale build by accident.
- **How to reproduce:** `du -sh "Script and Sync Releases/Old"`
- **Evidence:** 25 GB measured; 37 entries listed.
- **Suggested next step:** Move `Old/` outside the project root (e.g.
  to `~/Archive/`) or delete all but the most recent. Folder is
  gitignored so no git history is affected.
- **Do not fix during this read-only audit.**

---

**ISSUE-005 — Releases folder is brand-stale ("Script and Sync Releases")**

- **Severity:** Low
- **Confidence:** Confirmed
- **Location:** project root + `scripts/copy-release.js`
- **What is wrong:** Product is "StJohn Author Studio" but output
  folder is still named "Script and Sync Releases".
- **Why it matters:** Confuses any future AI session and any user
  looking at the folder.
- **How to reproduce:** `ls /Users/mariemackay/Dev/StJohn-Author-Studio-4.0`
- **Evidence:** Folder name verified; gitignore rule references it.
- **Suggested next step:** Rename folder, update `copy-release.js`
  destination, update `.gitignore`. Or move releases out of the
  project root entirely.
- **Do not fix during this read-only audit.**

---

**ISSUE-006 — Root-level shortcut files use old brand**

- **Severity:** Low
- **Confidence:** Confirmed
- **Location:** project root
- **What is wrong:** `MAC - Build Proofer.command`,
  `WINDOWS - Build Proofer.cmd`, `MAC - Open Proofer.command`,
  `WINDOWS - Open Proofer.cmd` all say "Proofer", not "Author
  Studio".
- **Why it matters:** Cosmetic. Same risk as ISSUE-005.
- **Do not fix during this read-only audit.**

---

**ISSUE-007 — `ProofingReader.js` (1,445 lines) still uses its own reader**

- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `app/components/ProofingReader.js`
- **What is wrong:** Proof is Marie's anchor mode and is the largest
  single component still NOT using the shared `ChapterReader`. The
  migration is tracked in TODO as low-priority cleanup.
- **Why it matters:** "Fix once = fix everywhere" guarantee doesn't
  apply to the most-used mode. Bug fixes to the reader currently must
  land in two places.
- **How to reproduce:** `grep -c "ChapterReader" ProofingReader.js`
  returns 0; `grep -c "wrapWords\|<audio" ProofingReader.js` returns
  6 (inline audio handling).
- **Suggested next step:** Schedule a migration session; high risk
  because it's the anchor mode, so plan a dedicated battery test.
- **Do not fix during this read-only audit.**

---

**ISSUE-008 — `webSecurity: false` in BrowserWindow config**

- **Severity:** Medium (security trade-off, documented but stricter
  option available)
- **Confidence:** Confirmed
- **Location:** `main.js:1189`
- **What is wrong:** Renderer disables web security to allow
  `localfile://` audio playback. Removes CORS and CSP enforcement.
- **Why it matters:** A compromised JS bundle or malicious HTML
  injection could read arbitrary local files. Marie's threat model is
  low (single-user desktop), but worth flagging.
- **How to reproduce:** `grep "webSecurity" main.js`
- **Suggested next step:** Replace with
  `protocol.registerStreamProtocol('audio', …)` scoped to the Save
  Data folder, re-enable webSecurity. Out of scope for this audit.
- **Do not fix during this read-only audit.**

---

**ISSUE-009 — Tests pollute stdout with ESM/CJS warnings**

- **Severity:** Low
- **Confidence:** Confirmed
- **Location:** `package.json` (no `"type": "module"`)
- **What is wrong:** Every test run emits
  `MODULE_TYPELESS_PACKAGE_JSON Warning: Module type of file:///… is
  not specified` for each ESM file.
- **Why it matters:** Noise drowns out real failures; performance
  overhead noted by Node.
- **Suggested next step:** Add `"type": "module"` to `package.json`,
  or rename ESM files to `.mjs`. Note: Electron's `main.js` is
  CommonJS, so the `"type"` decision needs to preserve that path.
- **Do not fix during this read-only audit.**

---

**ISSUE-010 — Big-book cloud payload size not measured**

- **Severity:** Medium (could surface as a "statement timeout" later)
- **Confidence:** Needs testing
- **Location:** Real Supabase upload of a fully-transcribed real book
- **What is wrong:** Cloud-slim removes the bulk before upload, but
  the actual payload size on a 50-chapter book is not measured.
- **Why it matters:** Past "statement timeout" was the symptom that
  drove the slim rewrite; regressions could reappear.
- **Suggested next step:** Push one large real book and log
  `approxByteSize(slimBookBlob)` + the section-transcriptions and
  flags row counts.
- **Do not fix during this read-only audit.**

---

**ISSUE-011 — No automated test for cloud-sync push/pull or flag-queue retry**

- **Severity:** Medium
- **Confidence:** Confirmed
- **Location:** `tests/`
- **What is wrong:** Tests cover pure functions only. The
  push/pull/retry flows that hold Marie's data are untested.
- **Why it matters:** Refactoring the cloud-sync package has no
  safety net.
- **Suggested next step:** Add integration tests against a mock
  Supabase client (or the real test project) covering: hash-gate
  no-op, single-flag upsert during a full-book push, tombstone retry,
  flag-queue backoff.
- **Do not fix during this read-only audit.**

---

**ISSUE-012 — DOCX → PDF needs Word or LibreOffice installed**

- **Severity:** Medium (for any non-Marie user)
- **Confidence:** Confirmed
- **Location:** `main.js: convertDocxBufferToPdf`
- **What is wrong:** App requires `soffice` or PowerShell + Word COM.
  No bundled fallback.
- **Why it matters:** Without one of these, page-map building fails
  silently — pages show as `?` in flag popups.
- **Suggested next step:** Detect on first launch and show a setup
  prompt with download links; or bundle a DOCX→PDF converter (e.g.
  docx4j) at the cost of size.
- **Do not fix during this read-only audit.**

---

## 14. Recommended Next Debugging / Fixing Order

1. **Blockers / data-leak first** — ISSUE-002 (RLS). Cannot ship to
   anyone but Marie until verified.
2. **Data-loss safety** — ISSUE-003 (two-device round-trip),
   ISSUE-010 (payload size).
3. **Real-file confidence** — Prep `.docx` opened in Word; Quill
   `.jsx` run in InDesign (already top of HANDOFF).
4. **Packaging** — ISSUE-001 (Mac signing/notarization), then
   ISSUE-005/006 (rename releases folder + shortcut files).
5. **Disk hygiene** — ISSUE-004 (move/delete 25 GB of old builds).
6. **Code consolidation** — ISSUE-007 (ProofingReader migration).
7. **Security** — ISSUE-008 (webSecurity / custom audio protocol).
8. **Test coverage** — ISSUE-011 (cloud-sync integration tests).
9. **Polish** — ISSUE-009 (ESM warning), ISSUE-012 (DOCX→PDF setup).

---

## Final Statement

**This app may be partly ready, but the untested areas above must be
checked first.**

The cloud-sync layer is well-considered and the recent independent
audit's bugs have been patched. Tests pass. The login screen renders
clean. But the audit cannot honestly upgrade to "ready" without:
- RLS verification on the live Supabase project
- A two-device flag round-trip on a real phone + real desktop
- A packaged Mac build opened on a clean machine
- A Prep `.docx` actually opened in Microsoft Word

For Marie-only private use right now, the app reads as workable. For
public distribution, the blocker list above stands.

---

*End of report.*
