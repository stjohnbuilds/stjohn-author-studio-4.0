# Front Function Tree — 4.0

Status: **Partially updated 2026-05-27.** This file had drifted behind
the real app. Phone and major desktop Proof/Quill rows below reflect
current tested behavior where known.

Companion: [`INTERNAL_FUNCTION_TREE.md`](./INTERNAL_FUNCTION_TREE.md),
[`WIRING_MATRIX.md`](./WIRING_MATRIX.md).

## Tag legend

- **REAL** — handler reaches a real engine + persists to filesystem or
  Supabase.
- **PARTIAL** — handler exists but only goes part of the way.
- **MISSING** — referenced but no handler / not yet built.
- **N/A** — not part of this mode by design.

---

## Desktop — Shell chrome (shared across all modes)

| Control | Status | Source | Notes |
|---|---|---|---|
| 4-mode segmented switcher (Proof / Prep / Duet / Quill) | REAL | `app/page.js` | Desktop shell switches modes. |
| Home / book list | REAL | `app/page.js` + mode components | Proof, Prep, Duet, Quill project lists exist; Quill has a light-list path for speed. |
| Save Folder | REAL | SaS 3.0 `app/page.js` | Bridge to Electron filesystem. |
| Settings | PARTIAL | SaS 3.0 | Verify scope when we add per-mode settings. |

## Desktop — Proof Listen (the anchor mode)

Inherited from Script and Sync 3.0. Marie verifies each row on a real
file in Phase 5.

| Button | Source file | Status |
|---|---|---|
| Create new book | `app/page.js` | REAL |
| Import manuscript (.docx) | `app/components/ManuscriptSetup.js` | REAL |
| Map narrator names | `app/components/ManuscriptSetup.js` | REAL |
| Save book | `app/page.js` | REAL |
| Add chapter audio (per section / bulk) | `app/components/SessionsView.js` | REAL |
| Transcribe chapter | `app/components/SessionsView.js` → whisper subprocess | REAL |
| Clear saved transcriptions | `app/components/SessionsView.js` | REAL |
| Transcribe All Chapters | `app/components/SessionsView.js` | REAL |
| Open proofing reader | `app/page.js` `startProofing` | REAL |
| Audio play / pause / speed | `app/components/ProofingReader.js` | REAL |
| Word-by-word sync highlight | `app/components/ProofingReader.js` | REAL |
| Flag a mistake | `app/components/ProofingReader.js` flag panel | REAL |
| Edit / delete flag | `app/components/ProofingReader.js` | REAL |
| Prev / Next chapter | `app/components/ProofingReader.js` | REAL |
| Export flags to CSV | `app/components/SessionsView.js` | REAL |

## Desktop — Prep Manuscript

| Button | Status |
|---|---|
| Import manuscript | REAL |
| Show dialogue groups | REAL |
| Assign main / side character to dialogue | REAL |
| Add side character | REAL |
| Open safety panel | REAL |
| Export highlighted DOCX | REAL |
| Export narrator chapter list | REAL |

## Desktop — Duet Prep

| Button | Status |
|---|---|
| Import manuscript | REAL |
| Detect duet/insert markers | REAL |
| Edit marker | REAL |
| Export marker list | REAL |

## Desktop — Quill & Ink

| Button | Status |
|---|---|
| Import manuscript | REAL |
| Annotation list (+ and edit icons — Marie liked this) | REAL |
| Single / double-word click | REAL |
| Class / option selector | REAL |
| Add / edit / delete annotation | REAL |
| Export InDesign | REAL |

## Phone — Script mode

| Button | Status |
|---|---|
| Sign in / Sign up / Resend confirmation | REAL |
| Project list | REAL |
| Open chapter — manuscript + transcript text | REAL |
| Pick local audio folder/files (audio stays on phone) | REAL |
| Audio play / pause / speed | REAL |
| Add flag | REAL |
| Edit / delete flag | PARTIAL |
| Export flags to CSV | REAL |

## Phone — Quill mode

| Button | Status |
|---|---|
| Project list | REAL |
| Open chapter | REAL |
| Pick local audio folder/files (audio stays on phone) | REAL |
| Audio play / pause / speed / sync | REAL |
| Tap to select word / range | REAL |
| Add annotation (with class + option + character + timestamp + note) | REAL |
| Edit / delete annotation | MISSING |
| Export annotations to CSV | REAL |
