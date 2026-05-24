# Wiring Matrix — 4.0

Status: **Skeleton.** Phase 1 of v4.0. Fills in row by row as Marie
clicks each button on a real file.

One row per user-visible button. A row only flips to **verified live**
when Marie has clicked it on a real audiobook / manuscript / phone
audio file and seen the right thing happen. Tests passing is not
enough.

## How to read this

| Column | Meaning |
|---|---|
| **Button** | What Marie sees / clicks. |
| **Where** | App + mode the button belongs to. |
| **Bridge / route** | The IPC channel, Supabase call, or local route the click invokes. |
| **Engine** | The shared engine that does the real work. |
| **Status** | REAL / PARTIAL / MISSING. |
| **Verified live** | Date + the real file Marie used. **Empty until clicked.** |

---

## Desktop — Shell

| Button | Where | Bridge / route | Engine | Status | Verified live |
|---|---|---|---|---|---|
| Mode switcher (4-mode) | shell | (Phase 4 — not built) | — | MISSING | |
| Home / book list | shell | local route | — | REAL (inherited from SaS 3.0) | |
| Save Folder | shell | `window.electron.changeSaveFolder()` | — | REAL | |

## Desktop — Proof Listen (inherited working)

| Button | Bridge / route | Engine | Status | Verified live |
|---|---|---|---|---|
| Create new book | local state | — | REAL | |
| Import manuscript | `window.electron.readManuscriptFile()` | manuscript-engine | REAL | |
| Map narrator names | local | manuscript-engine | REAL | |
| Save book | `window.electron.writeData()` | exports/backup | REAL | |
| Attach chapter audio | `window.electron.getAudioUrl()` | audio-engine/file-matching | REAL | |
| Transcribe chapter | `window.electron.whisperTranscribe()` | audio-engine/transcription | REAL | |
| Open proofing reader | local route | reader-engine (target) | REAL | |
| Play / Pause | local | audio-engine/playback | REAL | |
| Word sync highlight | local | audio-engine/word-timing | REAL | |
| Add flag | local + save | exports/backup | REAL | |
| Prev / Next chapter | local | reader-engine | REAL | |
| Export flags to CSV | local | exports/csv | REAL | |

## Desktop — Prep Manuscript (Phase 6 — empty rows for now)

| Button | Bridge / route | Engine | Status | Verified live |
|---|---|---|---|---|
| Import manuscript | (Phase 6) | manuscript-engine | MISSING | |
| Dialogue groups list | (Phase 6) | manuscript-engine/dialogue-detection | MISSING | |
| Assign character | (Phase 6) | manuscript-engine | MISSING | |
| Safety panel | (Phase 6) | manuscript-engine/dialogue-safety-check | MISSING | |
| Export highlighted DOCX | (Phase 6) | exports/docx | MISSING | |

## Desktop — Duet Prep (Phase 7 — empty rows)

| Button | Bridge / route | Engine | Status | Verified live |
|---|---|---|---|---|
| Import manuscript | (Phase 7) | manuscript-engine | MISSING | |
| Detect markers | (Phase 7) | audio-engine | MISSING | |
| Edit marker | (Phase 7) | — | MISSING | |
| Export markers | (Phase 7) | exports | MISSING | |

## Desktop — Quill & Ink (Phase 8 — empty rows)

| Button | Bridge / route | Engine | Status | Verified live |
|---|---|---|---|---|
| Import manuscript | (Phase 8) | manuscript-engine | MISSING | |
| Annotation list (+ / edit icons) | (Phase 8) | local | MISSING | |
| Add annotation | (Phase 8) | cloud-sync/quill-sync | MISSING | |
| Export InDesign | (Phase 8) | exports/indesign | MISSING | |

## Phone — Script (Phase 9 — empty rows)

| Button | Bridge / route | Engine | Status | Verified live |
|---|---|---|---|---|
| Sign in | Supabase auth | cloud-sync | MISSING | |
| Project list | Supabase select | cloud-sync/script-sync | MISSING | |
| Open chapter | Supabase select | cloud-sync | MISSING | |
| Pick local audio | local file picker | audio-engine/file-matching | MISSING | |
| Play / Pause | local | audio-engine/playback | MISSING | |
| Add flag | Supabase insert | cloud-sync/script-sync | MISSING | |
| Export CSV | local | exports/csv | MISSING | |

## Phone — Quill (Phase 9 — empty rows)

| Button | Bridge / route | Engine | Status | Verified live |
|---|---|---|---|---|
| Project list | Supabase select | cloud-sync/quill-sync | MISSING | |
| Open chapter | Supabase select | cloud-sync | MISSING | |
| Add annotation | Supabase insert | cloud-sync/quill-sync | MISSING | |
| Export CSV | local | exports/csv | MISSING | |

---

## Verification protocol

1. A row stays MISSING until the relevant phase ships the button.
2. When the button exists, it's tagged PARTIAL until Marie clicks it on
   a real file.
3. When Marie clicks it and the right thing happens, fill
   `Verified live` with date + filename used. Example:
   `2026-05-23 — "Chapter 1.docx"`.
4. A phase is "done" when every row in that phase has a verified-live
   date.
