# Review prompt — paste this whole file into another AI

You are reviewing a code change in someone else's project. Be adversarial and
specific. Do NOT rubber-stamp. For every issue, name the exact file, function,
and line area, explain the failure case concretely, and suggest a fix. End with
a punch-list grouped: 🟥 must-fix (bug/regression), 🟨 should-check (needs real
data/device), 🟩 fine. Do not give a confidence percentage.

## The project (context)
- Next.js 14 (app router) phone companion to a desktop audiobook-proofing app.
- The phone app is ONE big file: `app/phone/page.js`. It has two modes:
  "Script/Proof Listen" (tap a word while listening → save a "flag" for the
  audio engineer) and "Quill" (annotations). They share a reader component
  `app/phone/_components/PhoneReader.js` which renders section HTML via
  `app/phone/_components/renderReaderContent.js` (walks the HTML, assigns each
  word an incrementing index using the regex `/[A-Za-z0-9']+/g`).
- Word data: `buildWordSpans(plainText)` (in `packages/quill-engine/normalize.js`)
  tokenises plain text with the SAME regex `/[A-Za-z0-9']+/g` and returns
  `{ word, start, end }` where start/end are char offsets into plainText.
  IMPORTANT: it STRIPS punctuation — `word` has no trailing `.`/`?`/`!`.
- Rule: audio files NEVER get uploaded to the cloud; only filenames/handles may
  be stored locally on the device.

## What was changed (3 fixes, all in `app/phone/page.js` unless noted)
New file: `app/phone/_lib/audioFolderMemory.js` (IndexedDB helper).

### Fix 1 — "Remember the audio folder" (was: forgotten on every reload)
- Before: the picked folder lived only in React state `audioFilesByBook`
  (resets to `{}` on reload). New: persist per `userId + audioKey` in IndexedDB.
- `BookAudioFolderPicker` now:
  - Uses `window.showDirectoryPicker()` when available (Chrome/Android, secure
    context) → reads audio via `readAudioFilesFromDirHandle` → persists the
    directory **handle** + folderName + fileNames. Offers a "🔄 Reload" button
    (`handleReload` → `checkDirHandlePermission(handle, true)` → re-read).
  - Falls back to the existing `<input webkitdirectory>` / `<input multiple>`
    on iOS Safari (no API) → persists folderName (from `webkitRelativePath`) +
    fileNames, shows "Last folder: X · N files" + "Pick again".
  - Attempts ONE silent restore on open if a handle exists and permission is
    already `granted` (`useEffect` guarded by `triedSilentRef`, callback held
    in `onPickRef` to avoid a re-render aborting it).
  - `handleClear` also clears the saved memory.
- Wiring: both call sites pass `userId={session?.user?.id}` and `audioKey`
  (Script: `audioProjectKey('script', book.id)`; Quill: the project key).

### Fix 2 — Flag narrator should match the tapped word (like desktop)
- Desktop (`app/components/ProofingReader.js` `detectNarrator`) picks the
  narrator per word: highlight background colour matched to
  `book.narratorColors[].hex`, else nearest preceding `<h2>` character heading,
  mapped via `narratorColors` (character → narrator). Phone previously used only
  a section-level `autoNarratorFor` (generic "Narrator").
- New: `buildSectionWordContext(html)` walks a DETACHED copy of the section HTML
  with the SAME `/[A-Za-z0-9']+/g` regex and records, per word index, the active
  preceding `<h2>` heading + any inline `style.backgroundColor`.
  `narratorForWordContext(book, ctx, fallback)` mirrors desktop priority
  (colour → heading → fallback=section narrator). Used in `selectionMeta`.
- Narrator field UI changed from a text input + `<datalist>` to a `<select>`
  (lists all options incl. "Engineer", defaults to the detected narrator) plus
  a "＋ New" button that flips to a free-text input. State: `narratorCustom`.
- Pre-fill effect now fills quote/page/narrator once per selection, tracked by
  `filledForRef` (so re-renders don't clobber edits, but a new word refreshes).

### Fix 3 — Tapping one word grabs the WHOLE sentence (like desktop)
- Before: quote = `words.slice(start, end+1).map(s=>s.word).join(' ')` (one word).
- New helpers: `sentenceWordBounds(plainText, words, idx)` expands to sentence
  bounds by testing the plainText GAP between consecutive words for `[.!?]`
  (because `word` itself has no punctuation), capped at 60 words each way.
  `sentenceTextBetween(...)` slices the original plainText between the bound
  words and appends trailing `.!?` + closing quotes/brackets. `selectionMeta`
  now uses these for the quote (falls back to the old join if empty).

### Fix 4 — Folder pick didn't auto-attach each chapter's audio
- Symptom: after picking the audio folder, opening a chapter still showed a
  "pick" prompt and made Marie select each file by hand.
- Root cause: `mapPulledProofProjects` in `packages/cloud-sync/proof-sync.js`
  merged the transcription row's words/alignment onto each section but NOT its
  `audio_file_name`, and `slimBookForCloud` (`cloud-slim.js`) can leave
  `section.audioFileName` empty on the stored `desktop_book`. So the phone's
  `pickAudioFile` matcher had no filename and fell back to per-file picking.
- Fix (one line + comment): on pull, `if (!merged.audioFileName &&
  trans?.audio_file_name) merged.audioFileName = trans.audio_file_name;`.
  This mirrors what the Quill pull already does (`quill-sync.js:231`).
- Verify: confirm this can't OVERWRITE a real desktop-set audioFileName (it
  only fills when empty); confirm it helps only transcribed sections (no trans
  row → no filename to borrow); confirm the matcher (`pickAudioFile`,
  exact→stem→loose) then attaches the file. Note it needs a phone re-pull to
  take effect. Flag any case where a wrong file could auto-attach.

## Specific things to verify (be skeptical)
1. **Index alignment (Fix 2, highest risk).** The tapped word `index` comes from
   `renderReaderContent`'s HTML walk; `wordContext[index]` comes from
   `buildSectionWordContext`'s HTML walk; `words[index]`/sentence logic come from
   `buildWordSpans(plainText)`. Do all three stay in lockstep for tricky HTML
   (a word split across tags like `anno<em>tate</em>`, headings counted as words,
   `<br>`, nested spans, `&amp;` entities)? Where could they drift by one and put
   the wrong narrator/sentence on a word? Note: the existing timestamp/page
   features already rely on tap-index ↔ `words` alignment, so argue whether that
   proves it or not.
2. **Fix 2 colour path.** `buildSectionWordContext` reads `node.style.backgroundColor`
   on a DETACHED node (no computed styles). If the real manuscript HTML applies
   highlights via CSS classes (not inline styles), the colour match silently
   yields nothing → falls back to H2/section. Is that acceptable degradation?
   Does the H2 path actually fire for these books, or will narrator just equal
   the old section default (no improvement)? Flag as "needs real manuscript HTML".
3. **Fix 3 edge cases.** Abbreviations ("Mr. Smith"), ellipses ("wait…"),
   decimals ("3.5"), quotes around dialogue. Confirm the desktop has the SAME
   limitations (it uses regex `/[.!?]['"]?$/` on whitespace-split words) so this
   is parity, not a new bug. Any case where the 60-word cap produces a weird
   half-sentence?
4. **Fix 1 races & lifecycle.** `BookAudioFolderPicker` calls hooks
   (`useState`/`useEffect`) — confirm they're unconditional (the component is
   only rendered inside an `if` branch in the parent, but the hooks are at the
   top of the child, which is fine). Check the silent-restore effect can't
   double-fire, can't apply the wrong book's files after a fast book switch, and
   that `onPickRef` actually prevents the abort-on-re-render bug. Check
   `showDirectoryPicker` cancellation (`AbortError`) is swallowed, not surfaced.
5. **Fix 1 honesty.** On iOS / non-secure-context, `supportsDirectoryPicker()` is
   false → no handle → `canReopen` false → "Pick again" path. Confirm there's no
   path that promises a one-tap reload it can't deliver. Confirm audio bytes are
   never written to IndexedDB (only names + handle).
6. **No regression to Quill.** The picker is shared. `onPick` now receives a 2nd
   arg `(files, meta)`; the Quill/Script `onPick` handlers ignore it and the
   picker persists internally. Confirm no double-persist / stale-state bug.
7. **Build-checker hook compliance** (`.claude/hooks/build-checker.sh`). It blocks,
   in non-allowed files, any ADDED line matching
   `<input ... type="file" ... accept="...audio..."`, any new `<audio`, any new
   `class="w"`/`wrapWords(`, and (in listed mode files only) new
   `function .*(BookDetail|HomeView|ChapterRow|ReaderView|Setup|Panel|AudioDock|Picker)`.
   `app/phone/page.js` is NOT a listed mode file, but the file-input/audio/word
   rules apply everywhere. Confirm this diff adds none of those (it reuses the
   existing `<input>` elements and adds no `<audio>`/word-renderer).

## How to get the diff
`git diff` in the repo root. Touched: `app/phone/page.js`,
`app/phone/_lib/audioFolderMemory.js` (new), `TODO.md`. The build passes
(`npx next build` → ✓ Compiled successfully).
