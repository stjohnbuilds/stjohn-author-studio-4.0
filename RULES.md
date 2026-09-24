# Rules

## Rule 1 — no personal names, no quoted conversations, no tool references

Rule is: nothing in this repository — code comments, notes, commit messages, file or folder names —
names a person, quotes a conversation, or refers to the tools used to write it. State the rule or the
reason instead, in this shape: "Rule is: [what must happen, what must not, and why]". A quoted remark
loses the situation that made it make sense; the next reader needs the intent. Project notes are
exactly four files: README.md (what this is, how to run it), RULES.md (this file), TODO.md (open
work), LOG.md (history). Nothing else is added.


## What the app is
One desktop app (Electron + Next.js) plus one phone companion, for preparing and proofing self-published audiobooks and special-edition print manuscripts. Four desktop modes — Proof Listen, Prep Manuscript, Duet Prep, Quill & Ink — share one reader, one audio engine, one manuscript engine, and one cloud-sync path. Two phone modes, Script and Quill, companion Proof Listen and Quill & Ink respectively. Current version: 4.0.31.

## Stack
Next.js 14 (app router) for the UI, Electron for the desktop shell, Supabase for cloud sync and sign-in, Tailwind CSS for styling. DOCX import runs on mammoth.js; PDF page-mapping on pdfjs-dist; export bundles on jszip; transcription runs whisper.cpp as a spawned process against a bundled model. A Node-based test suite covers cloud sync, exports, manuscript parsing, and Whisper-output handling.

## Structure and layout
- Each mode is a component inside `app/components/` (`ProofingReader.js`, `SessionsView.js`, `ManuscriptSetup.js` for Proof Listen; `PrepManuscriptMode.js`; `PrebuildMode.js` for Duet Prep; `QuillAndInkMode.js`), switched from the single shell at `app/page.js` — modes are not separate route folders. A per-mode routed layout (`app/proof-listen/`, `app/prep-manuscript/`, etc.) and a `packages/reader-engine/` package appear in older planning notes but do not exist in the app; treat them as a future direction, not current structure.
- Shared, non-UI logic lives in its own package under `packages/` and nowhere else: `audio-engine` (Whisper output, timing), `manuscript-engine` (DOCX import, dialogue detection), `quill-engine` (annotations, exporters), `cloud-sync` (Supabase), `acx-engine` (audio file checks), `backups` (snapshot handling). Browser-side helpers specific to the desktop UI live in `app/lib/`; the phone companion keeps its own `app/phone/_components/` and `app/phone/_lib/`.
- Rule is: never build a second version of a shared component. One reader (`ChapterReader.js`), one audio player (`AudioDock.js`), one accessible modal (`AppDialog.js`), one manuscript-import flow (`ImportFlow.js`), one book-detail screen (`BookDetail.js`), one set of top-bar/pill primitives (`ReaderChrome.js`). If a mode needs something different, add a prop or a slot to the existing component — a second inline reader, a second raw audio element, or a second word-by-word rendering loop reproduces the exact bug-multiplying problem this app was rebuilt to avoid.
- `ChapterReader` is currently used by Quill & Ink only. Proof Listen still renders through its own, older `ProofingReader.js` (migration pending — treat as the highest-risk file to change). Prep Manuscript and Duet Prep keep their own readers permanently, because their interaction models are structurally different (dialogue spans; read-only block highlights), not because migrating them was skipped.
- Rule is: a short list of core files is protected from casual changes — `app/components/ProofingReader.js`, `SessionsView.js`, `ManuscriptSetup.js`, `app/page.js`, `app/layout.js`, `app/globals.css`, `main.js`, `preload.js`, `tailwind.config.js`. A change to one of these needs a clear, minimal, stated reason; prefer an isolated addition or a flag over rewriting existing logic, and avoid changing typography, spacing, palette, or layout structure without an explicit visual-redesign request.
- Rule is: no fake or sample data, anywhere, ever — an empty state must say so in plain terms (for example, "Import a manuscript") rather than showing placeholder content that could be mistaken for real content.
- Rule is: a feature counts as working only once it has been run against a real manuscript or audio file, not only when its automated tests pass — the two catch different classes of bug.

## Data safety
- Local project data is saved to a user-chosen `Save Data/` folder — never a fixed system path — as JSON (`books.json`, `prebuild-projects.json`, `prep-manuscript-projects.json`, `quill-projects.json`, plus a lightweight `quill-project-list.json` index) with manuscript source files under `Save Data/Manuscript Sources/`. This folder is git-ignored and must never be deleted, moved, or overwritten by tooling.
- Rule is: any file path built from data that came from outside the app (an imported book id, a transfer-bundle manifest, an IPC payload) must be validated by the path-boundary helpers in `main.js` (`safeJoinInsideDir`, `assertResolvedInsideDir`) so it cannot resolve outside `Save Data/Manuscript Sources/` — this is what stops a corrupted or hostile id from writing a file somewhere it shouldn't.
- Rule is: exports and downloads never silently overwrite an existing file on disk — a repeat export gets "(1)", "(2)", "(3)" appended to its name instead of replacing the earlier one.
- Rule is: audio files (`.mp3`, `.m4a`, `.m4b`, `.wav`, `.flac`, `.opus`, `.ogg`, `.aac`, `.aif`, `.aiff`) stay on whichever device played them and are never uploaded anywhere in the cloud-sync path — only the bare filename crosses devices, so a companion device can match its own local copy by name.
- Rule is: `.env.local` (the Supabase URL and publishable key) is never committed — it is git-ignored, as are the downloaded Whisper model and ffmpeg binaries under `bin/`, which are too large for source control and are fetched on demand at build time instead.

## Cloud and Supabase
- Six Supabase tables are the only ones in use, all with row-level security scoped to the signed-in owner: `script_sync_projects`, `script_sync_section_transcriptions`, `script_sync_flags` for Proof Listen, and `quill_projects`, `quill_chapters`, `quill_annotations` for Quill & Ink. Prep Manuscript and Duet Prep are desktop-only by design and have no cloud tables. A few other tables exist in the same Supabase project for unrelated purposes and must be left alone.
- Rule is: every Supabase call goes through the single client in `packages/cloud-sync/` — no mode creates its own client or talks to Supabase directly.
- Rule is: before any upload, audio-related fields are stripped recursively first, then fields that belong in their own table (flags, transcription/alignment data, annotations, chapter alignment) are stripped from the main project blob, because storing them twice invites the two copies to disagree. Those fields are put back together on read by joining the per-row tables against the base blob.
- Rule is: a push is skipped when a content hash shows nothing changed since the last push, so an edit-free save does not cost a round trip. A local delete writes a tombstone before the cloud delete fires, so a pull racing in behind it cannot resurrect a project that was just removed. Both the desktop app and the phone companion re-pull on window/tab focus, so the device being looked at always has the freshest state before it saves anything.
- The Supabase free tier pauses a database after about a week of no activity; a scheduled daily check-in query keeps it awake so proofing sessions never hit a cold start.

## Proofing, prep, and phone conventions
- Rule is: the phone companion's scope is deliberately small — sign in with email and password, see a text-only project list, open a chapter to read manuscript and transcript text, pick an audio file already on the phone (never uploaded), listen or read, tap to add a flag (Script mode) or an annotation (Quill mode), and export to CSV. The phone never transcribes audio and never edits manuscript text, keeping it a thin companion rather than a second place bugs can diverge from the desktop.
- In Proof Listen, a flag records a timestamp, page, narrator, type, and note against a manuscript position, never the audio itself. In Quill & Ink, an annotation records a class, option, character, timestamp, and note against a selected word or range.
- Prep Manuscript detects dialogue and assigns it to characters and narrators before recording, then exports a highlighted Word document and a narrator chapter list. Duet Prep finds and edits duet/engineer markers in audio for export. Both are local-only, with no cloud step.

## Build and release
- Dev: `npm run dev` runs the Next.js dev server alone (browser); `npm start` runs Next.js and Electron together as the full desktop app.
- Test: `npm test` runs Node's built-in test runner over `tests/**/*.test.mjs`.
- The Whisper transcription model and the platform ffmpeg binary are fetched on demand, not stored in git: `npm run whisper:model`, `npm run ffmpeg:mac`, `npm run ffmpeg:win`.
- Packaging: `npm run electron-build-mac` / `electron-build-win` fetch the model and the right ffmpeg binary, run `next build`, then run electron-builder for that platform with publishing turned off — packaging alone never publishes a release.
- electron-builder.yml: app id `com.stjohnbuilds.authorstudio`, product name "StJohn Author Studio". The Mac build targets arm64 only (a `dir` build plus a zip). The Windows build configures a single target, an NSIS installer for x64, forced to a per-user, non-elevated install so the auto-updater can replace it without asking for a Windows administrator password; its filename is set to use hyphens rather than spaces because GitHub's upload step otherwise mangles the name in a way that breaks the auto-update manifest's download link.
- Release copy: `npm run release:mac` / `release:win` run the platform build above, then move whatever they find in `dist/` into the `Script and Sync Releases/` folder, archiving the previous release into `Script and Sync Releases/Old/` with a timestamp first — nothing is deleted. On Mac, the app bundle is re-signed ad hoc immediately after the move. On Windows, the copy step also looks for a separate "portable" `.exe` alongside the installer; only the NSIS installer target is currently configured in electron-builder.yml, and the installer filename the copy step looks for does not match the hyphenated name electron-builder.yml sets — worth a live test before relying on the Windows release-copy step working end to end.
- Rule is: any new file that `main.js` requires at runtime must be added to electron-builder.yml's `files:` list, and the packaged app must be launched once to confirm it starts — a missing file only shows up as a runtime crash, never at build time.
- Auto-update: the installed app checks `latest.yml` / `latest-mac.yml` on the newest published, non-draft GitHub Release for this repository. Packaging and release-copying, above, never publish that release themselves — publishing to GitHub Releases is a separate step, and only after it happens can already-installed copies see the new version.
- The same Next.js build produces both the desktop shell and the phone companion's static pages. A post-build step swaps the site's root page for the phone page only when the build is running on Vercel, so a web deploy serves the phone companion at its root address while the desktop package is unaffected.

## Coding conventions
- Rule is: icons are line-drawn SVGs from the shared icon file — no emoji in the interface.
- Rule is: keep a change scoped to what it set out to do; do not bundle unrelated fixes into the same edit.
- Rule is: when the app's structure changes, the structure notes describing it must be updated in the same change.
