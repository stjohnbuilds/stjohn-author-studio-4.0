# HANDOFF — StJohn Author Studio 4.0 — 2026-05-24

Fresh Claude session: read this file first. Top to bottom. Then `CLAUDE.md`,
then `TODO.md`. Don't write code before you've read all three.

This handoff supersedes the 2026-05-23 one. That version is no longer
accurate — most of what was "next steps" got built and polished in the
2026-05-24 session.

---

## 0. Two-line summary

The desktop app exists and works for Proof Listen and Prep Manuscript.
Duet Prep inherits from Script & Sync 3.0 and runs as-is. The next
three big builds are **Studio landing page (login)**, **Quill & Ink
mode**, and **the phone companion + Supabase cloud sync**.

---

## 1. How to launch

```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm start
```

Paste that into Terminal and hit Enter. Cmd+Q to close.

Tests:
```
npm test
```

Marie does NOT use the terminal naturally. Always give her the exact
paste-line and remind her to hit Enter — this rule is also in her
memory file at
`/Users/mariemackay/.claude/projects/-Users-mariemackay-Dev-StJohn-Author-Studio-4-0/memory/feedback_always_give_run_command.md`.

---

## 2. Marie's rules — read these before you do anything

Marie is non-technical, she's exhausted (this is her fourth attempt at
the app), and she's very specific about what she wants. These rules are
non-negotiable:

1. **Plain English.** Short bullets. No code-speak unless she asks. 2–4
   sentences default. Talk like a person, not a coder.
2. **Don't check in between passes.** When she says "go", execute end
   to end. Only come back when there's something concrete to click or
   you genuinely need her input (Supabase creds, design forks, hard
   blockers).
3. **Use shared engines. Never duplicate.** If you find yourself
   writing a second copy of something that already exists, stop and
   share the existing one. `packages/manuscript-engine/`,
   `app/components/ReaderChrome.js`, `app/components/ImportFlow.js`
   exist precisely so each mode uses them. Marie noticed and called
   out the previous duplicate-upload-flow in 2026-05-24.
4. **A feature is "done" when Marie clicks it on a real file.** Tests
   passing is not enough. Run the app, do the thing, see it work, THEN
   call it done.
5. **End every code change with the run command in a code block.**
   `cd ~/Dev/StJohn-Author-Studio-4.0 && npm start`. Tell her to paste
   and hit Enter. This is a saved feedback memory.
6. **Pastels, not wine.** Marie loathes dark "wine purple", "dark
   green" button colors. The mode tokens already have a `pastel` (very
   light) + `accent` (mid-tone) + `ink` (dark) split — use `accent`
   for solid button backgrounds, `pastel` for chip/active-tab fills,
   `ink` for text + borders. Defined in `MODE_TOKENS` in
   `app/components/ReaderChrome.js`.
7. **End every response that touches files with "Files I changed:".**
   A plain-text footer listing each file + what changed. The Stop-hook
   that's supposed to do this gets swallowed by the UI, so the footer
   is the only reliable trace Marie sees.

There are also feedback memory files at
`/Users/mariemackay/.claude/projects/-Users-mariemackay-Dev-StJohn-Author-Studio-4-0/memory/`.
Read them.

---

## 2b. CRITICAL — these are PORTS, not greenfield

Read this section twice. Marie has said this three times now and it
needs to land.

**Every remaining item on the roadmap has already shipped in a
working form in an earlier attempt of this app.** The Studio login
screen, Quill & Ink mode, the phone companion, the Supabase wiring —
none of these are things you design from scratch. They exist. Marie
has used them. She knows how she wants them to work because she's
already worked with them.

What this means for how you work:

1. **Before you write any code for one of these items, read its
   reference.** Open the archived app folder in §7. `ls`, `grep`,
   `Read` every file that's relevant. Look at the data model, the
   component structure, the UI patterns, the user flow. Understand
   it completely. Only then start porting.
2. **The reference is the spec.** If your instinct disagrees with
   what the reference does, the reference wins. Don't redesign. Port.
3. **Marie is not going to iterate on UI tweaks for these.** With
   Prep we went through many rounds of "the button is too dark, the
   header isn't centered, the back button is hiding" — that's because
   Prep was new. These items are NOT new. If you give Marie a Quill
   mode that doesn't match the alpha's layout, she's going to be
   frustrated. Match the alpha. If the alpha has the audio player
   bottom-docked, dock it. If the alpha's annotation list has
   `+` and ✏️ icons in a specific spot, put them in that spot.
4. **Use the SHARED engines we already built.** `ReaderChrome`,
   `ImportFlow`, `manuscript-engine`, the pastel `MODE_TOKENS`. The
   reference apps may have their own copies of some of these — port
   the BEHAVIOUR through the shared engines, not the duplicate code.
   This is the same "use the baseline, not extras" rule that drove
   Prep's polish work.
5. **If you cannot find a reference for something specific you're
   building, ask Marie before inventing.** She'd rather point you at
   the working version than discover later that you redesigned a
   solved problem.

The language to internalize: **port with fidelity, not creativity.**
The creativity got spent in the original. Your job is to bring it
forward into 4.0 with the shared engines and the pastel palette.

---

## 3. Read these files, in this order

| Order | Path | Why |
|---|---|---|
| 1 | `HANDOFF.md` (this file) | State + rules |
| 2 | `CLAUDE.md` | App purpose, data tables, architecture rules |
| 3 | `TODO.md` | Active backlog (cleaned up 2026-05-24) |
| 4 | `app/components/ReaderChrome.js` | Shared chrome (sticky bar, home pill, save badge, button factories, mode tokens) |
| 5 | `app/components/ImportFlow.js` | Shared upload + chapter picker. Prep + Duet use it. Proof's BookSetup is the last duplicate. |
| 6 | `app/components/PrepManuscriptMode.js` | Prep mode end-to-end. Use it as the pattern for new modes. |
| 7 | `app/components/prepExport.js` | In-place .docx patcher (highlights + Word comments + paragraph edits + narrator breakdown) |
| 8 | `packages/manuscript-engine/` | Pure JS engine. Dialogue detection, parsing, text normalization. |
| 9 | `docs/BUILD_PLAN_V4.md` if it exists, or skip | Phase plan |
| 10 | `tests/manuscript-engine.test.mjs` | Smoke tests. Run `npm test`. |
| 11 | Memory files at `/Users/mariemackay/.claude/projects/-Users-mariemackay-Dev-StJohn-Author-Studio-4-0/memory/` | Marie's feedback preferences |

---

## 4. State of the four modes

| Mode | Status |
|---|---|
| **Proof Listen** | Inherited working from Script and Sync 3.0. The 2600-line `ProofingReader.js` still has its own copies of chapter pill / sticky bar / save badge — should migrate to `ReaderChrome.js` (low risk, low priority, logged in TODO). |
| **Prep Manuscript** | Heavily polished 2026-05-24. Shared upload, one-rule dialogue warnings, paragraph fixer, edit-chapters cog, side-voice Word comments, pastel palette. The fully-built mode. |
| **Duet Prep** | Uses the existing Duet Audio Prep from the SaS 3.0 base, with `PrebuildMode.js` and the shared `ImportFlow`. Not extended in 4.0. Works as-is. |
| **Quill & Ink** | **NOT BUILT.** Currently shows the Coming Soon panel. There's a working alpha to port from — see §6 below. |
| **Phone** | **NOT BUILT.** There's a working scaffold to port from — see §7. |
| **Studio landing page** | **NOT BUILT.** First screen on launch should be a login + 4-mode picker, not dropping into Proof. See §5 next. |

---

## 5. What's next — in priority order

### A. Studio landing page (login + mode picker)  **<-- DO THIS FIRST**

When the app opens, Marie should see a small login screen (Supabase
auth) and after login, the 4-mode picker. NOT dropping straight into
Proof like it does now.

- Supabase auth: email + password. Show/hide password toggle. **Marie
  explicitly asked for a show/hide password eye icon — include it.**
- "Forgot password" link.
- After login: the 4-mode picker is the home screen (with the pastel
  pill toggle in `app/page.js` `AppModeToggle`).
- "Sign out" lives somewhere subtle once logged in (probably on the
  4-mode home).
- The login UI should match the pastel aesthetic. No dark/wine colors.
- A similar login screen existed in a previous attempt (probably in
  the archived `apps/` folder or the 2.0 attempt). **Look at it before
  designing from scratch — Marie said "it's been done before, don't
  fuck around with anything that's ugly."**

The Supabase project + tables already exist (see §8). Marie can give
you the URL + anon key when you ask (or look in any old
`.env`/`supabase.js` in the archives). Don't store her credentials in
the repo.

### B. Quill & Ink mode

There's a near-complete alpha to port from:
`/Users/mariemackay/Library/CloudStorage/GoogleDrive-mariemackaybooks@gmail.com/My Drive/Game Dev/GitHub/StJohn Author Apps/apps/quill-and-ink - ARCHIVED 2026-05-23/`

Read-only. You may `ls`, `find`, `grep`, `Read`. You may NOT edit or
delete anything inside.

What Quill & Ink does:
- Read a manuscript chapter at a time (use the shared `ReaderChrome`
  and the same import flow as Prep).
- Annotate inline — drag across text to highlight a range, double-click
  a word to jump to it. The "drag along highlights" interaction Marie
  liked from the alpha.
- Annotation list with `+` and ✏️ icons (Marie specifically mentioned
  she liked these — port them).
- The audio player from Proof gets reused.
- Export an InDesign-friendly file (the alpha exported some form of
  this — look at the alpha's export code).

Supabase tables that already exist for Quill: `quill_projects`,
`quill_chapters`, `quill_annotations`. All have RLS.

Make it match Prep's visual aesthetic — same pastel pink mode token
(`MODE_TOKENS.quill`), same `StickyTopBar` + `HomeBackPill`.

### C. Supabase cloud sync wiring

The shared `packages/cloud-sync/` directory (or its equivalent) needs to
be the SINGLE place every mode talks to Supabase. Per-table CRUD
helpers, not per-mode duplicates. Marie has been very clear on this.

Tables (all exist already with RLS, project id
`evcusovtjfypfyfvnooy`):
- `script_sync_projects`
- `script_sync_section_transcriptions`
- `script_sync_flags`
- `quill_projects`
- `quill_chapters`
- `quill_annotations`

Audio NEVER goes to Supabase. The shared `cloud-sync` should have
guards that strip audio paths before any upload. This is in CLAUDE.md
and Marie has emphasized it three times.

### D. Phone companion

There's a working scaffold to port from:
`/Users/mariemackay/Library/CloudStorage/GoogleDrive-mariemackaybooks@gmail.com/My Drive/Game Dev/GitHub/StJohn Author Apps/apps/phone - ARCHIVED 2026-05-23/`

Marie says it was "actually quite solid" and just needs porting + a UI
fix-up. Marie also mentioned there might be an even earlier phone
attempt in `Manuscript Prepper 1.0` worth looking at — go look first.

Scope (deliberately small per CLAUDE.md):
- Login (Supabase auth, same as desktop)
- Project list (text only)
- Open a chapter, see manuscript + transcript text
- Pick an audio file from the phone (audio stays local on phone — NEVER
  uploaded)
- Listen / read; tap to add a flag (Script mode) or annotation (Quill
  mode)
- Save: only flag/annotation text + timestamp + position go to cloud
- Export: dump flags/annotations to CSV
- No transcribing on phone. No manuscript editing.

Deploy to Vercel when it works.

### E. Smaller cleanup tasks (low priority, low risk)

- Migrate `ProofingReader.js` to use `ReaderChrome.js` — Prep already
  does, Proof still has inline copies. Pure refactor, no behaviour
  change.
- Migrate `PrebuildMode.js` (Duet) to use `ReaderChrome.js` for its
  chrome too.
- Migrate Proof's `BookSetup` (`app/components/ManuscriptSetup.js`) to
  use the shared `ImportFlow.js` — last duplicate of the upload flow.

These are all logged in `TODO.md`.

---

## 6. What got built / polished in the 2026-05-24 session

This is mostly so you don't accidentally redo work or miss context.

### Shared upload flow
- `app/components/ImportFlow.js` (new). One component, used by Prep
  and Duet. Title input, .docx upload, H1/H2/H3 selector, optional
  scene-splitting toggle, chapter list with checkboxes + Set First
  toggle + Show Sub-headings toggle.
- Deleted `PrebuildManuscriptUpload.js`.
- Prep's old inline `SetupView` is gone — uses `ImportFlow` directly.
- Pulls `STYLE_MAP` + `convertShadingToHighlight` + `applyHexColors`
  from `ManuscriptSetup.js` so Google Docs–style background highlights
  get converted to Word highlights consistently across modes.

### One dialogue warning rule (only)
- `packages/manuscript-engine/dialogue-detection/index.js`. Emits ONE
  issue type — `missing-closing-quote` — and only when the next quote
  mark is more than ~3 paragraphs after the orphaned open. All other
  warning types (tiny / long / empty dialogue, nested, uneven,
  quote-context-review) are gone. Marie specifically asked for this.
- Each issue carries a `blockIndex` so the UI can scroll to the
  affected paragraph.

### Section Fixer
- Per-paragraph editor that appears in place of the warning paragraph.
- "Insert " here" button drops a closing curly quote at the cursor.
- Save → updates `section.html`, reruns dialogue detection.
- Edits are also recorded in `section.manualEdits` so the export can
  replay them onto the original .docx (otherwise the missing quote
  Marie typed in would stay missing in the exported file).

### Header / chrome
- `HomeBackPill` in `ReaderChrome.js`. Single button at top-left, same
  position as the 4-mode toggle on home. Morphs between ⌂ (book
  detail → home) and ← (reader → book detail). No more separate Back
  button + Home pill fighting for the same screen position.
- `StickyTopBar` is now top-aligned with `HomeBackPill` (top:40 with
  custom drag region). Title absolutely centered.

### Header confusion fix (Marie's old complaint)
- Reader top bar reads `Chapter 5 of 62` from the navigation system —
  the source heading (e.g. "Chapter 6" because she deselected the
  original Chapter 1) only shows in the subtitle, and only when it
  differs from the nav number.

### Edit chapters cog
- "⚙ Edit" button next to the Chapters section header on the book
  detail page. Trash icon per chapter to remove an
  accidentally-included one. Chapter numbers re-flow automatically.

### Auto-assign on character add
- When a dialogue is selected and Marie adds a new character via the
  chip dock, the new character is immediately assigned to that
  dialogue. `addCharacter` returns the new id synchronously so the
  caller can chain.

### Side-voice Word comments in the export
- Every dialogue assigned to a side voice now has an inline Word
  comment with each piece of info on its own line:
  ```
  Character: Jim
  Narrator: Mark
  Side voice of Crescent
  Notes: happy
  [Recurring]
  ```
- Main-character dialogues just get the highlight, no comment noise.
- `word/comments.xml` is added to the zip with the namespaces Word
  actually expects (`xmlns:mc`, `xmlns:w14`) so it doesn't trigger the
  "unreadable" repair dialog.
- Dropped the `<w:rStyle w:val="CommentReference"/>` reference — user
  docs don't define that style and Word's repair flagged the file.
- Document rels + content-types patched to wire `comments.xml` in.

### Pastel palette
- `MODE_TOKENS` in `ReaderChrome.js` now has `pastel` (very light),
  `accent` (mid-tone for solid buttons), `ink` (dark for text/borders)
  per mode.
- Prep switched from green to **yellow** (Marie didn't love the green).
- `topBtnStyle('solid')` uses `accent`, not `ink` — the buttons feel
  pastel, not wine-y.
- 10-colour `CHARACTER_PALETTE` in `PrepManuscriptMode.js` in Marie's
  preferred order: pink → peach → yellow → mint → green → cyan → blue
  → periwinkle → lavender → rose.

### Export polish
- Strip any previously-injected narrator breakdown before adding a new
  one (so re-importing an exported file doesn't pile up breakdowns).
- Replay `section.manualEdits` onto the source XML before highlights
  are applied (so the Fix button's quote ends up in the exported file).
- The regex in `applyHighlightsInPlace` is constrained so the `rPr`
  capture cannot cross `<w:r>` boundaries — without this fix, the
  regex backtracked across run boundaries and produced six copies of
  the narrator breakdown when Marie tested earlier.
- `paragraphsFromHtml` in BOTH `PrepManuscriptMode.js` AND
  `prepExport.js` now use the engine's `stripHtml` so paragraph text
  matches what the engine sees. Before, the reader's `stripTags`
  replaced tags with empty string but the engine replaced with a space
  → italic-mid-quote dialogues like `"Really?"` (split across runs)
  produced "Really ?" on the engine side and "Really?" on the reader
  side, and the Next button got stuck on every italic-emphasised
  dialogue.

---

## 7. Reference folders (READ-ONLY)

You may `ls`, `find`, `grep`, `Read`. You may NOT edit, write, move,
or delete anything inside these.

| Path | What it is |
|---|---|
| `/Users/mariemackay/Library/CloudStorage/GoogleDrive-mariemackaybooks@gmail.com/My Drive/Game Dev/GitHub/Script and Sync 3.0/` | Primary base. The 4.0 repo was copied from here. |
| `.../Script and Sync - ARCHIVED 2026-05-23/` | Older proofer. Cross-reference only. |
| `.../StJohn Author Apps/apps/script-and-sync - ARCHIVED 2026-05-23/` | Older SaS. |
| `.../StJohn Author Apps/apps/quill-and-ink - ARCHIVED 2026-05-23/` | Alpha Quill. **Port from here for §5B.** |
| `.../StJohn Author Apps/apps/phone - ARCHIVED 2026-05-23/` | Phone scaffold. **Port from here for §5D.** |
| `.../Manuscript Prepper 1.0/` | Earlier phone attempt Marie said might also be solid. Worth a peek before committing to one. |
| `~/Dev/StJohn-Author-Studio-2.0/` | The failed 2.0 attempt. The dialogue engine in `packages/manuscript-engine/` was ported from here. Other things were not worth keeping. |

---

## 8. Supabase

Project: `evcusovtjfypfyfvnooy` ("Typing and Tomes 2.0 DATA"). Six
tables already exist, all with RLS:

- `script_sync_projects`
- `script_sync_section_transcriptions`
- `script_sync_flags`
- `quill_projects`
- `quill_chapters`
- `quill_annotations`

No new tables required for the next round of work. If you find yourself
about to create one, stop — there's almost certainly an existing one
that fits.

URL + anon key: ask Marie or look in any archived `.env`/`supabase.js`
file. Do not commit credentials.

Prep + Duet do NOT have Supabase tables yet (desktop-only for v4.0).

---

## 9. Known limitations / things to keep in mind

- **Multi-run dialogues are not highlighted in the in-place export.**
  If the source manuscript has italic emphasis mid-quote (the engine
  detects the dialogue text as e.g. "Really ?"), the export's regex
  intentionally doesn't match those — they get left un-shaded. Not a
  bug; round-tripping multi-run formatting would risk breaking the
  document. Marie knows.
- **Source manuscripts can have pre-existing Google Docs highlights**
  (background fills on text) that bleed through into the export
  because they get converted to Word highlights at import time. Marie
  said to ignore this — it's the source's fault, not ours.
- **Fix-quote edits lose formatting on that one paragraph.** When
  `applyManualEdits` replays a paragraph edit, it replaces the whole
  `<w:p>` with a single-run paragraph containing the new text. Any
  italic emphasis inside that one paragraph is lost. Acceptable
  tradeoff for the simplest possible "insert a missing quote" path.
- **The Fix button's editor only shows ONE paragraph** (the one the
  warning points to). Marie wanted this — she explicitly said dumping
  the whole section into a textarea was "annoying".

---

## 10. Things Marie hates (will tell you off for)

- Adding extra clarifying questions when she's said go.
- Hand-waving a bug fix without actually diagnosing the root cause.
- Wine-purple / dark-green / "ugly" colours on buttons.
- Two competing UI elements doing the same job (Back button + Home
  pill on the same screen, two upload flows, etc.).
- Forgetting the run command at the end of a response.
- Saying "this should work now" without testing it.
- Mismatched centering between screens.
- Multi-step setup when one step would do.

---

## 11. Final word

The session that produced this handoff fixed a lot of stuff Marie
caught in 2026-05-23 + 2026-05-24 testing. The remaining work is real
greenfield (Quill, Supabase, Phone) but with strong references to port
from. The previous Claude burned itself out trying to build all of
that in one session — that's why this handoff exists. Do one thing at
a time. Test it on a real file. Then move on.

Good luck.
