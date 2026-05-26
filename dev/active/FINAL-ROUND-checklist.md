# Final round — bug-fix assessment & checklist

Created 2026-05-26. This is the PRIMARY list now. Everything else is
archived. Two halves:

- **Part A — YOURS to walk through.** Concrete clicks, tap-by-tap, on
  every mode. Real books, real audio.
- **Part B — MINE to walk through.** Code + cloud deep dive, edge
  cases, debugging scan. No code changes until Part A finds something
  or until I find a bug worth flagging.

When you find something broken, ⛔ it on the list and message the AI
before moving on. When something passes, ✓ it.

---

## PART A — YOUR HANDS-ON CHECKLIST

Run the app first:

```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm start
```

Paste and hit Enter. Wait for the window.

### A1 — Sign-in / sign-out

- [ ] You can sign in with your real email + password
- [ ] Sign out works (sign-out lives at the bottom of the home page)
- [ ] After sign-out, signing back in puts you back in the same place
- [ ] Forgot password → email flow works (do this once, ever)

### A2 — Home page (4-mode toggle)

- [ ] All 4 mode buttons appear (Proof / Prep / Duet / Quill)
- [ ] Each one has its own colour, not bleeding into another
- [ ] Tutorial pill opens the tutorial without breaking the page
- [ ] Settings cog opens settings without breaking the page

---

### A3 — PROOF LISTEN (desktop)

#### A3.a — Import + setup
- [ ] + New Book → upload a .docx (a real one with chapters)
- [ ] Pick the chapters you want, drop the copyright pages
- [ ] Save → book appears on the home page

#### A3.b — Book detail
- [ ] Title shows correctly at the top
- [ ] Side nav shows three tabs: Nav, All flags, Queue
- [ ] No big purple banner — title sits inline with the action buttons
- [ ] "Edit book data" button is visible (not lost)
- [ ] Click Edit book data → can untick chapters → save → unticked chapters disappear from chapter list AND bulk audio dropdown
- [ ] Same flow but untick a SCENE inside a chapter (click the `▾ N/M scenes` badge) → save → that scene drops

#### A3.c — Bulk audio
- [ ] Pick a starting chapter from the dropdown
- [ ] Click Import → pick a folder of audio files
- [ ] Each chapter gets its audio attached (filename shown)
- [ ] Close the app, reopen — the audio attachments are still there
- [ ] **No "Beginning" row** anywhere when Split is on

#### A3.d — Transcribe + flag (the core Proof flow)
- [ ] Click Transcribe All (or one chapter)
- [ ] Whisper runs, progress shows, words light up
- [ ] Open a chapter → reader appears
- [ ] Audio plays, the current word glows as it goes
- [ ] Tap-to-flag works on a misread word
- [ ] Flag pop-up has Quote / Page / Narrator / Type / Note
- [ ] Save → flag appears in side nav All flags AND on the chapter row
- [ ] Delete a flag → gone everywhere (chapter row, All flags, no orphan)

#### A3.e — Export
- [ ] Export Flags → CSV downloads, opens cleanly in Numbers/Excel
- [ ] Export for Engineer → marker files generated
- [ ] Transfer → folder created (only in desktop app, with all audio copied)

#### A3.f — Mark done
- [ ] Tick a scene complete (the round button on its row) → strike-through appears
- [ ] Sub-line on the book card updates (X/N completed)
- [ ] Reload — still ticked

---

### A4 — PREP MANUSCRIPT (desktop)

#### A4.a — Import
- [ ] + New Book → upload a real .docx with dialogue
- [ ] Chapter list comes up correctly
- [ ] Dialogue spans get detected (highlighted lines)

#### A4.b — Character assignment
- [ ] Open a chapter
- [ ] Drag across a dialogue → character chip strip appears
- [ ] Pick a character → dialogue gets coloured
- [ ] Add a new character → new chip → assign on the fly
- [ ] Side voice option works (Notes field shows)

#### A4.c — Section Fixer
- [ ] An amber warning shows on a paragraph with a missing quote
- [ ] Click Fix → that paragraph opens in a textarea
- [ ] Type the missing `"` → save → warning disappears
- [ ] Re-open the chapter — fix is still there

#### A4.d — Export
- [ ] Export Word doc → real .docx downloads
- [ ] Open the .docx in Word — every side-voice dialogue has a real Word comment with character / narrator / notes
- [ ] No "unreadable file" warning from Word
- [ ] CSV export — opens cleanly

---

### A5 — DUET PREP (desktop)

#### A5.a — Import + assign audio
- [ ] + New Book → upload a real .docx
- [ ] Engineer assigns audio file per chapter
- [ ] Audio attachments survive close + reopen

#### A5.b — Scan
- [ ] Click Scan / Start scan
- [ ] Engineer markers detected (or "no markers" message clearly shown)
- [ ] Progress shows during scan
- [ ] Ready to scan / completed counts update

#### A5.c — Mark done
- [ ] Tick a chapter done (the round button) → strike-through
- [ ] Reload — still ticked

---

### A6 — QUILL & INK (desktop)

#### A6.a — Import
- [ ] + New project → upload a real .docx with scenes (H2 sub-headings)
- [ ] **"Split scenes" toggle is visible** at the top of import
- [ ] Flip it on — chapter list shows scene rows underneath each chapter, with the actual scene titles (NOT "Beginning")
- [ ] Pick chapters → Import & open
- [ ] Book detail appears with chapter list

#### A6.b — Edit book data
- [ ] Edit book data button is visible (top right of book detail)
- [ ] Click it → panel opens with title / chapters / characters
- [ ] Untick a CHAPTER → save → chapter disappears
- [ ] Untick a SCENE inside a chapter → save → scene disappears
- [ ] Re-upload manuscript button works (test with a small file)
- [ ] Add a character (colour, name) → save → chip appears in reader

#### A6.c — Reader (the annotation flow)
- [ ] Click a chapter → reader opens
- [ ] Drag across a few words → annotation pop-up
- [ ] Pick a class + option (Image / Highlight / Emotion / Character)
- [ ] Add a note
- [ ] Save → underline appears under the words in the reader
- [ ] Sidebar list shows the annotation
- [ ] Click the sidebar entry → jumps to that point in the chapter
- [ ] Delete an annotation → underline gone, sidebar entry gone

#### A6.d — Export
- [ ] Export CSV + InDesign → both files download
- [ ] Open the .jsx in InDesign — character styles + highlights apply correctly
- [ ] Open the CSV — every annotation listed with class / option / colour

#### A6.e — Mark done
- [ ] Tick a chapter done in the chapter list (the round button) → strike-through
- [ ] Reload — still ticked

---

### A7 — PHONE — SCRIPT MODE (Proof on phone)

Open `https://stjohn-author-studio-4.vercel.app/` on your phone.
You should land on the phone UI directly (no /phone in the URL).

#### A7.a — Service picker
- [ ] After sign-in, you see "Choose a service" with Quill + Proof tiles
- [ ] Cog (top right) opens reader settings — all 8 fields show
- [ ] Account chip opens email + sign-out

#### A7.b — Empty + populated lists
- [ ] Pick Proof Listen
- [ ] If you have books on desktop, they show up here (after Refresh)
- [ ] Empty state shows the right message if no books

#### A7.c — Reader + flag
- [ ] Tap a book → chapter list shows
- [ ] Chapter row has chapter title + flag count
- [ ] Tap a chapter → reader opens
- [ ] Reader settings (font, size, mode) apply
- [ ] Page Swipe mode swipes left/right cleanly
- [ ] Pick an audio file from the phone — plays
- [ ] Double-tap a word → drag handles appear → drag to extend selection
- [ ] Tap `+` → flag pop-up → fill quote / page / note → save
- [ ] Flag appears inline in the reader AND on the Flags tab
- [ ] Delete a flag → gone

#### A7.d — Offline behaviour
- [ ] Save a flag, immediately turn airplane mode ON, then OFF
- [ ] The pending flag banner kicks in if cloud failed
- [ ] Refresh resolves the queue (banner clears)

---

### A8 — PHONE — QUILL MODE

#### A8.a — Project list
- [ ] Quill & Ink tile opens to a project list
- [ ] Your desktop projects show after Refresh
- [ ] Each chapter row has the round `○` done tick on the left
- [ ] Tap the `○` → it becomes `✓`, title strikes through
- [ ] Reload — still ticked

#### A8.b — Annotate
- [ ] Tap a chapter → reader opens
- [ ] Double-tap a word → drag handles → drag → tap `+`
- [ ] Annotation pop-up → pick class → save
- [ ] Annotation shows underlined in the reader

#### A8.c — Cross-device (the trust test)
- [ ] Annotate on phone → wait 5 seconds
- [ ] Open desktop Quill → Resync → annotation is in the sidebar
- [ ] Tick a chapter done on phone → Resync desktop → side nav shows ✓
- [ ] Tick a chapter done on desktop → Refresh phone → tick shows ✓

---

### A9 — Cross-device round-trip (final trust check)

Do these in order, on the SAME signed-in account:

- [ ] Make a flag on phone (Proof) → it shows on desktop (Proof) after Resync
- [ ] Delete the flag on desktop → it's gone on phone after Refresh
- [ ] Make an annotation on phone (Quill) → desktop shows it after Resync
- [ ] Delete the annotation on desktop → it's gone on phone after Refresh
- [ ] Mark a chapter done on phone → desktop reflects it
- [ ] Untick a chapter in Edit book data on desktop → phone loses that chapter
- [ ] **Airplane mode test:** save a flag offline → online → it lands in the cloud

---

## PART B — CLAUDE'S DEEP DIVE

I work through this list without Marie. Every item is a thing to
read + verify, NOT a thing to blindly change. If something needs a
fix, I flag it first.

### B1 — Supabase cloud round-trip

- [ ] **Proof push path** — read `pushProofProject` end to end. Confirm every column written matches what `pullProofProjects` reads back. No silent drops.
- [ ] **Proof pull path** — confirm flags + transcriptions + book metadata reconstruct identically.
- [ ] **Quill push path** — already audited this session. Re-verify after the recent `completed` flag change.
- [ ] **Quill pull path** — confirm `completed` flag from `desktop_project` blob lands on each chapter.
- [ ] **Audio guard** — verify `stripAudioPaths` runs before EVERY push, removes `audioPath`, `audioPaths`, blobs.
- [ ] **Slim blobs** — verify `slimProjectForCloud` / `slimBookForCloud` drop the heavy fields (alignment, flags, annotations) before upload.
- [ ] **Tombstones** — confirm `addTombstone` + `applyTombstonesToCloudList` prevent a deleted project from coming back.
- [ ] **Flag queue (offline)** — confirm `recordPendingFlag` → `retryFlagQueue` actually retries on focus.
- [ ] **No orphan columns** — every column written in push has a column read in pull (or is meta).
- [ ] **No orphan tables** — every table referenced is one of the 6 expected ones (script_sync_projects, script_sync_section_transcriptions, script_sync_flags, quill_projects, quill_chapters, quill_annotations). No others.

### B2 — Cloud save / sync edges

- [ ] Two devices saving the same flag simultaneously — does the second clobber the first or merge?
- [ ] User signed out mid-save — does the pending queue catch it?
- [ ] Project deleted on device A while device B is editing it — what happens?
- [ ] Big project (hundreds of chapters) — does push timeout? Is there a hash-gate skip?
- [ ] Hash-gate correctness — does pushing the same project twice in a row skip the second push?

### B3 — Per-mode edge case scan

#### B3.a — Proof Listen
- [ ] Empty book (no chapters)
- [ ] Book with chapters but no audio
- [ ] Book with audio but no transcription
- [ ] All flags deleted from a book
- [ ] Audio filename mismatch (whisper alignment partial)
- [ ] Section title with special characters (`/`, `:`, `*`, etc.)
- [ ] Single-section vs multi-section chapter behaviour
- [ ] Bulk audio when chapter count < audio file count (or vice versa)
- [ ] Whisper transcription cancelled mid-run

#### B3.b — Prep Manuscript
- [ ] Manuscript with no dialogue at all
- [ ] Dialogue with no character assignment
- [ ] Character added then immediately deleted
- [ ] Side voice assigned to a non-existent character
- [ ] Missing close-quote that crosses paragraph boundaries
- [ ] Multiple consecutive H2s (empty scene)
- [ ] Export with zero assigned dialogues
- [ ] Re-import a previously-exported .docx (the duplicate-narrator-breakdown trap)

#### B3.c — Duet Prep
- [ ] Audio file shorter than chapter manuscript
- [ ] Audio file with no markers (engineer didn't add any)
- [ ] Scan cancelled mid-chapter
- [ ] Engineer progress with all chapters skipped
- [ ] Re-scan after fixing manuscript

#### B3.d — Quill & Ink
- [ ] Annotation that crosses a paragraph boundary
- [ ] Multiple overlapping annotations on the same word
- [ ] Character deleted with active annotations using it
- [ ] Custom emotion added then deleted
- [ ] Empty chapter (no text)
- [ ] InDesign export with annotations across H2 boundaries
- [ ] Annotations on text containing `<em>` / italic

### B4 — Phone edge cases

#### B4.a — Phone Script
- [ ] Phone with no internet on first launch (cache fallback)
- [ ] Phone signed in as user with no projects yet
- [ ] Sign out mid-save (flag should still queue)
- [ ] Audio file picked from gallery (iOS share sheet)
- [ ] Multiple flags saved back-to-back (queue ordering)
- [ ] Reader location persistence across refresh

#### B4.b — Phone Quill
- [ ] Tick + untick repeatedly — final state correct on desktop after Resync
- [ ] Annotation save with no internet → reopen → still in IndexedDB cache
- [ ] Service picker → switch service mid-task (Quill to Script)

### B5 — Code health

- [ ] Cross-mode parity hook runs clean against every mode file
- [ ] Build-checker reports no shared-component duplication
- [ ] No new `function .*BookDetail/HomeView/ChapterRow/Setup/Panel` in mode files
- [ ] No new inline `<audio>` outside AudioDock
- [ ] No new inline word renderers outside ChapterReader
- [ ] All four mode files reference the forwarded fields (cross-mode parity Check 2)
- [ ] No empty `() => {}` handler stubs except marked `// intentional:`
- [ ] HANDOFF.md is current (state, top jobs, URLs)
- [ ] TODO.md archive section captures everything moved this session

### B6 — Hook health

- [ ] git-backup actually creates a backup commit before each edit
- [ ] file-tracker logs every edited file in `.claude/edit-log.txt`
- [ ] cross-mode-parity runs clean on every edit
- [ ] context-check fires on every user prompt
- [ ] no-mess Stop hook prints the checklist
- [ ] build-checker Stop hook syntax-checks every edited file (exit 1 on fail)
- [ ] build-checker Stop hook runs npm test on risky-path edits (exit 1 on fail twice)
- [ ] stop-no-self-cert Tier A blocks (exit 1)
- [ ] stop-no-self-cert Tier B warns (exit 0 with note)

---

## PART C — WATCH LIST

These are tiny things I might spot on the way that aren't bugs but
deserve a second look:

- Anywhere `// TODO:` or `// FIXME:` sits in code that's about to ship
- Console.log statements left in production paths
- Hardcoded strings that should be configurable
- Files that grew past 2000 lines (re-check the shared-component story)
- Dead code (imports / functions never called)
- Comments that say one thing but the code does another

---

## ARCHIVE PLAN

Once this checklist is fully ticked:

- Move every closed item out of `TODO.md` into `## Archived` with date
- Move this file into `dev/archive/` with the run date
- Open a fresh `TODO.md` with whatever lands during the walkthrough
- That's the next session's starting point
