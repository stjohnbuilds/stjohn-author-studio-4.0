# Internal Function Tree — 4.0

Status: **Skeleton.** Phase 1 of v4.0. Filled in as each phase lands.

Companion: [`FRONT_FUNCTION_TREE.md`](./FRONT_FUNCTION_TREE.md),
[`WIRING_MATRIX.md`](./WIRING_MATRIX.md).

---

## Today

This repo is currently a copy of **Script and Sync 3.0**. The internal
shape today is exactly its internal shape. Only Proof Listen exists.

### Top-level layout (as-copied)

| Path | What it is |
|---|---|
| `main.js` | Electron main process. Window + IPC handlers. |
| `preload.js` | Electron preload — exposes `window.electron` bridge. |
| `app/page.js` (~1837 lines) | Next.js home: book list + state orchestration. |
| `app/components/SessionsView.js` (~2100 lines) | Book detail: chapters, audio, transcription queue. |
| `app/components/ProofingReader.js` (~2600 lines) | Reader: audio + word-sync + flag panel. |
| `app/components/ManuscriptSetup.js` (~600 lines) | Import + narrator mapping. |
| `app/components/PrebuildMode.js` (~2200 lines) | Layout frame. |
| `lib/transcriptionWorker.js` | Whisper subprocess driver. |
| `lib/manuscriptPaging.js` | Word-to-page mapping. |
| `lib/pdfPaging.js` | PDF page detection. |
| `lib/fuzzyMatcher.js` | Whisper-to-manuscript word alignment. |
| `scripts/` | Build, release, sandbox helpers. |

### IPC bridge methods (from `preload.js`)

To be enumerated by reading `preload.js` and `main.js` once Phase 1 is
checked in. The pattern is `window.electron.<verb>` (e.g.
`readManuscriptFile`, `writeData`, `getAudioUrl`, `whisperTranscribe`).

### Supabase tables (reused from 2.0 project)

Project `evcusovtjfypfyfvnooy`, all six tables have RLS:

- `script_sync_projects` / `script_sync_section_transcriptions` /
  `script_sync_flags`
- `quill_projects` / `quill_chapters` / `quill_annotations`

---

## Target (where 4.0 is going)

### Shared engines (one of each — never duplicated)

| Package | Owns | Used by |
|---|---|---|
| `packages/reader-engine` | word render, selection, scroll, settings | every desktop mode + phone |
| `packages/audio-engine` | whisper, alignment, file matching, playback | Proof Listen, Duet Prep, phone |
| `packages/manuscript-engine` | docx/word import, narrator extract, dialogue detection, safety check | every desktop mode |
| `packages/cloud-sync` | Supabase client + per-table CRUD | Proof Listen (cloud sync), Quill (cloud sync), phone |
| `packages/exports` | CSV, DOCX, InDesign, backup writers | every mode |

### Target app routes

```
app/
  page.js                     Home: mode switcher + book list
  proof-listen/[id]/page.js   Proof Listen book detail + reader
  prep-manuscript/[id]/...    Prep
  duet-prep/[id]/...          Duet
  quill/[id]/...              Quill
  phone/login                 Phone auth
  phone/script/...            Phone Script mode
  phone/quill/...             Phone Quill mode
  components/
    Reader/                   THE shared reader. One file, four modes.
    ModeSwitcher.js           Colored 4-mode segmented switcher.
```

### Target Electron IPC channels

Per-mode namespace plus shared:

- `proof:*` (import-manuscript, save-book, attach-audio, transcribe-chapter, save-flag, export-csv, …)
- `prep:*` (import-manuscript, save-assignment, export-docx, …)
- `duet:*` (import-manuscript, detect-markers, export-markers, …)
- `quill:*` (import-manuscript, save-annotation, export-indesign, …)
- `shared:*` (change-save-folder, get-app-version, …)

### Target data flows

1. **Import** — `app/<mode>/page.js` → `window.electron.importManuscript()`
   → `main.js` IPC → `packages/manuscript-engine/docx-import` → state.
2. **Save (local)** — state → `packages/exports/backup` →
   `window.electron.writeData()` → `Save Data/` folder.
3. **Save (cloud, Proof + Quill)** — flag/annotation → `packages/cloud-sync`
   → Supabase row.
4. **Transcribe** — `packages/audio-engine/transcription` →
   spawn whisper.cpp → JSON timing → `packages/audio-engine/word-timing`
   alignment.
5. **Load on phone** — login → `packages/cloud-sync` pull project +
   chapters + transcript text → render via shared
   `packages/reader-engine`.

### Hard rules

- Audio paths are stripped before any Supabase write
  (`packages/cloud-sync/payload-guards`).
- The reader engine has no per-mode `if` branches — modes pass behavior
  in as props.
- No mode ever instantiates its own Supabase client. Always go through
  `packages/cloud-sync/supabase-client`.
