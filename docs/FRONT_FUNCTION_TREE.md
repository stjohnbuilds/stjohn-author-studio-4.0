# Front Function Tree — 4.0

Status: **Skeleton.** Phase 1 of v4.0. Filled in mode by mode as each
phase lands.

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
| 4-mode segmented switcher (Proof / Prep / Duet / Quill) | MISSING | (Phase 4) | Today the base only shows one mode. Add the colored-tab switcher inspired by 2.0. |
| Home / book list | REAL | SaS 3.0 `app/page.js` | Works today for Proof Listen. |
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
| Transcribe All Chapters | `app/components/SessionsView.js` | REAL |
| Open proofing reader | `app/page.js` `startProofing` | REAL |
| Audio play / pause / speed | `app/components/ProofingReader.js` | REAL |
| Word-by-word sync highlight | `app/components/ProofingReader.js` | REAL |
| Flag a mistake | `app/components/ProofingReader.js` flag panel | REAL |
| Edit / delete flag | `app/components/ProofingReader.js` | REAL |
| Prev / Next chapter | `app/components/ProofingReader.js` | REAL |
| Export flags to CSV | `app/components/SessionsView.js` | REAL |

## Desktop — Prep Manuscript (Phase 6 — not built yet)

| Button | Status |
|---|---|
| Import manuscript | MISSING |
| Show dialogue groups | MISSING |
| Assign main / side character to dialogue | MISSING |
| Add side character | MISSING |
| Open safety panel | MISSING |
| Export highlighted DOCX | MISSING |
| Export narrator chapter list | MISSING |

## Desktop — Duet Prep (Phase 7 — not built yet)

| Button | Status |
|---|---|
| Import manuscript | MISSING |
| Detect duet/insert markers | MISSING |
| Edit marker | MISSING |
| Export marker list | MISSING |

## Desktop — Quill & Ink (Phase 8 — not built yet)

| Button | Status |
|---|---|
| Import manuscript | MISSING |
| Annotation list (+ and edit icons — Marie liked this) | MISSING |
| Single / double-word click | MISSING |
| Class / option selector | MISSING |
| Add / edit / delete annotation | MISSING |
| Export InDesign | MISSING |

## Phone — Script mode (Phase 9 — not built yet)

| Button | Status |
|---|---|
| Sign in / Sign up / Resend confirmation | MISSING |
| Project list | MISSING |
| Open chapter — manuscript + transcript text | MISSING |
| Pick local audio file (audio stays on phone) | MISSING |
| Audio play / pause | MISSING |
| Add flag | MISSING |
| Edit / delete flag | MISSING |
| Export flags to CSV | MISSING |

## Phone — Quill mode (Phase 9 — not built yet)

| Button | Status |
|---|---|
| Project list | MISSING |
| Open chapter | MISSING |
| Tap to select word / range | MISSING |
| Add annotation (with class + option) | MISSING |
| Edit / delete annotation | MISSING |
| Export annotations to CSV | MISSING |
