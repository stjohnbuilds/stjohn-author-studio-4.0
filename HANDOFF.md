# HANDOFF — StJohn Author Studio 4.0 — 2026-05-24 (overnight + QoL pass)

Fresh Claude session: read this file first. Top to bottom. Then `CLAUDE.md`,
then `TODO.md`. Don't write code before you've read all three.

This handoff replaces the earlier one — Claude ran overnight on
2026-05-24 and landed login, Quill & Ink desktop mode, the Supabase
cloud sync, and a phone scaffold. Then did a quality-of-life pass:
bug fixes, dead-code cleanup, edge cases. Marie is reviewing in the
morning, so most of the test passes are still hers to do.

---

## 0. Two-line summary

All four desktop modes now exist — Quill & Ink shipped overnight. Login
is in front of the app. Phone web companion shell is live. Cloud sync
to Supabase is wired for Quill (audio paths stripped before upload).

---

## 1. How to launch

```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm start
```

Paste into Terminal, hit Enter. Cmd+Q to close.

Marie does NOT use the terminal naturally. Always give her the exact
paste-line + "hit Enter" reminder.

Tests:
```
npm test
```

Phone preview (web):
```
npm run dev
```
Then visit `http://localhost:3000/phone` in a browser.

---

## 2. What's new since the last handoff (overnight 2026-05-24)

### Login screen (NEW)
First screen on launch. Email + password, show/hide eye icon, forgot
password, create account. Pastel mauve aesthetic matching the home.
Sign-out lives at the bottom of the home page once signed in.

- File: `app/components/LoginScreen.js`
- Gate logic: `app/page.js` (auth state effect + early return)
- Sign-out: bottom of `HomePage` in `app/page.js`
- Supabase URL + publishable key live in `.env.local` (gitignored)

### Shared cloud-sync package (NEW)
Single shared package every mode + the phone talk to.

- `packages/cloud-sync/client.js` — one Supabase client, lazy
- `packages/cloud-sync/account.js` — sign-in / sign-up / forgot /
  resend / sign-out (ported from the alpha)
- `packages/cloud-sync/audio-guard.js` — strips audio paths before any
  upload. Only the bare filename may travel. CLAUDE.md emphasizes this.
- `packages/cloud-sync/quill-sync.js` — push/pull/delete for the three
  Quill tables (projects, chapters, annotations). Replace-on-write
  strategy so removed chapters/annotations actually disappear from
  Supabase.

### Quill & Ink desktop mode (NEW)
Full port from the archived alpha. The 4-mode toggle now has Quill
enabled (no longer "Coming in Phase 8").

- Home view → projects list, "+ New project" button (pink accent)
- ImportFlow (shared) handles .docx upload + chapter picker
- Book detail → chapter list + export buttons (CSV + InDesign .jsx)
- Reader: word-by-word rendering, drag-to-highlight, "+" / "✎" icons
  on selection, annotation popover (Image / Highlight / Emotion +
  attach characters), inline note, save button
- Annotation list sidebar with delete + jump-to
- Quill engine ported intact: annotation tree, normalize helpers, CSV
  + full InDesign JSX exporter (15.7 KB script for the InDesign Run
  Script panel)
- Local persistence via Electron file system (`read-quill-data` /
  `write-quill-data` handlers added to `main.js` + `preload.js`,
  written to `quill-projects.json`)
- Cloud sync fires in the background whenever you save (no-op if
  not signed in, fails silently if Supabase is down)

### Phone companion (NEW scaffold)
Lives at `/phone` (`app/phone/page.js`). Web-only, deploy to Vercel.

- Same login as desktop
- Service picker: Quill (working) / Proof Listen (placeholder)
- Project list pulled from Supabase
- Chapter list per project
- Chapter reader with tap-to-annotate (popover, save)
- Audio + Script Mode flag-tapping + CSV export — NOT in this
  overnight pass. Marie's morning todo.

### Other plumbing
- `@supabase/supabase-js@^2` installed
- `.env.local` added with the Supabase URL + publishable key.
  `.env*.local` added to `.gitignore` so it's never committed.
- `main.js` + `preload.js` got `read-quill-data` / `write-quill-data`
  IPC handlers and file paths next to the prep ones.

---

## 3. State of the modes

| Mode | Status |
|---|---|
| **Login screen** | Built. Marie hasn't logged in for real yet — overnight Claude used a temporary bypass that's been removed. **First task in the morning: create an account.** |
| **Proof Listen** | Inherited working from Script and Sync 3.0. Unchanged overnight. |
| **Prep Manuscript** | Polished 2026-05-24 day session. Unchanged overnight. |
| **Duet Prep** | Unchanged overnight. Inherited from SaS 3.0. |
| **Quill & Ink** | Built overnight. Local save + cloud sync. Annotation popover, drag-to-highlight, CSV + InDesign export. **Marie needs to test on a real .docx.** |
| **Phone** | Scaffold built. Login + project list + chapter view + tap-to-annotate. Audio + Script-mode flagging not yet ported. |
| **Cloud sync (Quill)** | Wired. Pushes after every save when signed in. Audio paths stripped per CLAUDE.md. Marie should sign in then save once to confirm round-trip. |
| **Cloud sync (Proof / Prep)** | Not wired yet. Tables exist; the helper file pattern is set. Same as Quill but for `script_sync_projects` / `_section_transcriptions` / `_flags`. |

---

## 4. What Marie needs to do in the morning

In order:

1. **Sign up.** Launch the app (`cd ~/Dev/StJohn-Author-Studio-4.0 && npm start`).
   Click "Don't have an account? Create one" and use a real email. Confirm
   the email when Supabase sends the link. Sign in.
2. **Click into Quill.** Top-left mode toggle → Quill. Click "+ New
   project". Upload a .docx Marie wants to annotate.
3. **Try one annotation.** In the reader, click-drag across a few words.
   Tap the pink "+" button that appears above. Pick a class (Highlight,
   Emotion, Image). Add a note. Save.
4. **Test the InDesign export.** Back to the project detail. Click
   "Export CSV + InDesign". Open the .jsx in InDesign's Scripts panel,
   then run it against the matching layout. Marie's eyes on whether the
   InDesign output is what she needs.
5. **Open the phone.** In a browser on the same machine for now:
   `http://localhost:3000/phone`. Sign in with the same account. The
   Quill project should appear. Click into a chapter, tap a word, add
   a phone-side annotation. Reload the desktop — it should appear there.

If step 5 doesn't work, the cloud sync wiring is the suspect. Check the
Supabase project `evcusovtjfypfyfvnooy` for new rows in `quill_projects`
/ `quill_chapters` / `quill_annotations`.

---

## 5. What's still NOT done

- **Cloud sync for Proof & Prep.** Quill is the only mode wired. Marie
  is fine with Proof / Prep being desktop-only for now (CLAUDE.md says
  so), but if she wants Proof flags on the phone, that's the next step.
- **Phone audio + Script-mode flag-tapping.** The phone shell + Quill
  annotation flow is in; the Script mode (proof listen) flag tapping
  and the local audio picker are not ported yet.
- **Phone CSV export.** Not built.
- **Audio sync in Quill reader.** Not built. Quill works without audio
  for now. If Marie wants audio while annotating, that's a future task.
- **Search inside chapter in Quill.** Not built. Marie can use cmd+F
  for now.
- **InDesign export — Marie's eyes haven't seen the output yet.** The
  exporter is ported byte-for-byte from the alpha so it should work,
  but until Marie runs it against a real InDesign doc, we can't call
  it done.
- **Search-inside-chapter in Quill.** Not built. ProofingReader has
  search; Quill borrows it later.
- **`ProofingReader` → `ReaderChrome` migration.** Same as before.
  Refactor task. No behaviour change. Logged in `TODO.md`.

---

## 6. Files Claude touched overnight (Marie's "I see new code" reassurance)

- `app/page.js` — auth gate + sign-out + Quill route
- `app/components/LoginScreen.js` (new)
- `app/components/QuillAndInkMode.js` (new)
- `app/phone/page.js` (new)
- `packages/cloud-sync/` (new — client, account, audio-guard,
  quill-sync, index)
- `packages/quill-engine/` (new — normalize, annotations, exporters,
  index)
- `main.js` + `preload.js` — IPC handlers for Quill
- `.env.local` (new, gitignored)
- `.gitignore` — added `.env*.local`
- `package.json` / `package-lock.json` — `@supabase/supabase-js`
  installed

---

## 7. Reference folders (READ-ONLY)

Unchanged from before. Marie's reference apps under
`~/Library/CloudStorage/GoogleDrive-mariemackaybooks@gmail.com/My Drive/Game Dev/GitHub/`:

| Path | What it is |
|---|---|
| `Script and Sync 3.0/` | Primary base. The 4.0 repo was copied from here. |
| `StJohn Author Apps/apps/quill-and-ink - ARCHIVED 2026-05-23/` | Alpha Quill. Source of the overnight Quill port. |
| `StJohn Author Apps/apps/phone - ARCHIVED 2026-05-23/` | Phone scaffold. Source of the overnight phone port. |
| `StJohn Author Studio 2.0 - ARCHIVED 2026-05-23/supabase/` | The migration that created Marie's six tables. Useful schema reference. |
| `StJohn Author Apps/packages/ui/src/cloudUsage.js` | Where the Supabase URL + publishable key live (now copied into `.env.local`). |

---

## 8. Supabase

Project: `evcusovtjfypfyfvnooy` ("Typing and Tomes 2.0 DATA").

Tables (all exist, all have RLS):
- `script_sync_projects`
- `script_sync_section_transcriptions`
- `script_sync_flags`
- `quill_projects`         ← Quill desktop pushes to this
- `quill_chapters`         ← Quill desktop pushes to this
- `quill_annotations`      ← Desktop and phone both write here

URL + publishable key are in `.env.local`. **Never commit that file.**

---

## 9. Marie's rules — read these before you touch anything

1. **Plain English.** Short bullets. No code-speak unless she asks. 2–4
   sentences default.
2. **Don't check in between passes.** When she says "go", execute end
   to end.
3. **Use shared engines. Never duplicate.** `packages/manuscript-engine/`,
   `packages/quill-engine/`, `packages/cloud-sync/`,
   `app/components/ReaderChrome.js`, `app/components/ImportFlow.js`.
4. **A feature is "done" when Marie clicks it on a real file.** Tests
   passing is not enough.
5. **End every code change with the run command in a code block.**
   `cd ~/Dev/StJohn-Author-Studio-4.0 && npm start`. Paste + hit Enter.
6. **Pastels, not wine.**
7. **End every response that touches files with "Files I changed:".**

There are also feedback memory files at
`/Users/mariemackay/.claude/projects/-Users-mariemackay-Dev-StJohn-Author-Studio-4-0/memory/`.
Read them.

---

## 10. Final word

Quill is the big shipping piece. The InDesign export is the part Marie's
eyes haven't yet validated — if it doesn't do what she expects, the
fix lives in `packages/quill-engine/exporters.js` (the `buildInDesignJsx`
function — ported byte-for-byte from the alpha). The phone is a scaffold;
expect to add audio + script mode + CSV before Marie can ship it.
