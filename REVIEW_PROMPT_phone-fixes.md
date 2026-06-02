# Independent review brief — paste this ENTIRE file into another AI

You are an independent, adversarial code reviewer. Another AI made the changes
below; your job is to try to BREAK them, not bless them. Be concrete. Do not
rubber-stamp. Do not give a confidence %. For every finding cite `file:line`,
the exact failure scenario, and a one-line fix. End with a punch list grouped
🟥 must-fix (real bug / broken promise / regression) · 🟨 should-check (needs
real data or a device) · 🟩 verified-fine. If you can, actually run the repo
(build + tests) and trace the logic; reason from the code, and say what you
could not test.

## How to get the code
Repo root: `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0`
- `git diff $(git log --oneline --diff-filter=A --follow -- app/phone/_lib/audioFolderMemory.js | tail -1 | awk '{print $1}')^ -- app/phone packages/cloud-sync` shows the whole change set.
- Build: `npx next build` (must stay green). Tests: `npm test` (13 should pass).
- Touched files: `app/phone/page.js`, `app/phone/_lib/audioLibrary.js`,
  `app/phone/_lib/audioFolderMemory.js` (new), `packages/cloud-sync/proof-sync.js`.

## App context (what matters)
- Next.js 14 phone companion to a desktop audiobook-proofing app. The phone UI
  is ONE big file: `app/phone/page.js`. Two modes: **Proof/Script** (tap a word
  while listening → save a "flag" for the audio engineer) and **Quill**
  (annotations). They share a reader (`app/phone/_components/PhoneReader.js` →
  `renderReaderContent.js`, which walks the section HTML and assigns each word an
  incrementing index via the regex `/[A-Za-z0-9']+/g`).
- `buildWordSpans(plainText)` (`packages/quill-engine/normalize.js`) tokenises
  with the SAME regex — it STRIPS punctuation, but each span keeps `start`/`end`
  char offsets into plainText.
- HARD RULES: audio files NEVER go to the cloud (only filenames/handles, stored
  locally). There is ONE shared reader / cloud-sync / audio dock — do not
  duplicate. A build-checker hook (`.claude/hooks/build-checker.sh`) blocks new
  `<input type=file accept=audio>`, new `<audio>`, new `class="w"`/`wrapWords(`
  in non-allowed files, and component-shaped funcs in guarded mode files
  (page.js is NOT guarded, but the audio/file/word rules apply everywhere).

## THE CHANGES (verify each)

### Feature 1 — Flag quote = the whole SENTENCE (was: one word)
`app/phone/page.js`: helpers `sentenceWordBounds`, `sentenceTextBetween`; used in
`selectionMeta` inside `ScriptChapterView`. Because `buildWordSpans` strips
punctuation, sentence ends are detected by testing the plainText GAP between
consecutive words. ENDER regex is `/[.!?]+["'”’)\]]*\s/` (must be followed by
whitespace — so "3.5"/"v1.2" do NOT split). Dragging the selection over more
words must include ALL covered sentences.

### Feature 2 — Flag narrator auto-detected per tapped word + dropdown UI
`app/phone/page.js`: `buildSectionWordContext(html)` walks a DETACHED copy of the
section HTML with the same `/[A-Za-z0-9']+/g`, recording per word index the
nearest preceding `<h2>` heading + inline highlight bg color.
`narratorForWordContext` mirrors desktop `detectNarrator`
(`app/components/ProofingReader.js`): color → H2 heading → section fallback.
The narrator field is now a `<select>` (all options incl. "Engineer"), defaulting
to the detected narrator, plus a "＋ New" button → free-text input.

### Feature 3 — Remember the audio folder per book
New `app/phone/_lib/audioFolderMemory.js` (IndexedDB: folderName + fileNames +
optional FileSystem directory handle; NO audio bytes). `BookAudioFolderPicker`
in page.js uses `showDirectoryPicker()` where available (Chrome/Android) for a
reusable handle + one-tap "Reload"; falls back to `<input webkitdirectory>` on
iOS; silent-restore effect re-reads files if permission is already granted.
Wired into BOTH Proof and Quill picker call sites (`userId` + `audioKey` props).

### Feature 4 — Folder pick auto-attaches each chapter's audio (was: still "pick")
`packages/cloud-sync/proof-sync.js` `mapPulledProofProjects`: added
`if (!merged.audioFileName && trans?.audio_file_name) merged.audioFileName = trans.audio_file_name;`
so the per-section filename (stored on the transcription row) reaches the phone
matcher. Mirrors what Quill already does (`quill-sync.js:231`).

### Hardening from a prior audit (verify these too)
- `audioLibrary.js` `pickAudioFile` loose match changed from substring to
  whole-token (`tokenRunContains`/`stemTokens`): "Chapter 1" must NOT match
  "Chapter 11.mp3". Confirm it still matches legit cases ("Dragon King" in
  "Dragon King Ch 3").
- `page.js` flag pre-fill effect: guard now keyed on `start:end` with
  `quoteDirtyRef`/`narratorDirtyRef` so extending the selection updates the
  quote, but a hand-edit is never clobbered; narrator only refreshes when the
  anchor (start) word moves.
- `page.js` `PhoneAudioDock`: new effect adopts a `presetAudioFile` that arrives
  AFTER the section mounted, guarded by `adoptedPresetRef` and `if (file) return`
  so it never clobbers a manual/playing file.
- `page.js` `BookAudioFolderPicker`: a "Pick files" selection clears any stale
  directory handle (`persistMemory` dirHandle = `meta.dirHandle || null`);
  empty-folder pick shows a note instead of popping a second picker; non-audio
  selection shows a note; `handleClear` awaits the IndexedDB delete; silent
  restore passes `{silent:true}` and the call sites skip the status toast.
- `audioFolderMemory.js` `saveAudioFolderMemory` requires a real `userId`.

## PROMISES THAT MUST HOLD (attack these specifically)
1. Single tap → the whole sentence (with trailing . ? !). Dragging to cover more
   → ALL covered sentences. Numbers like "3.5" stay intact. Find any tap/drag
   that yields a corrupt or half-sentence quote (beyond the known abbreviation
   limit below).
2. The narrator auto-fills from DESKTOP metadata (`book.narratorColors` + `<h2>`
   character headings), defaults correctly, and the dropdown always contains the
   shown value + "Engineer". "＋ New" custom text is never silently reverted
   except on an empty blur.
3. After picking ONE folder, every transcribed chapter's audio auto-attaches by
   name — no per-file picking — and the WRONG file can never auto-attach.
4. The folder is remembered across logout/login (same account) and app reopen
   (Android: one-tap reload; iOS: shows name + "Pick again"). No audio bytes ever
   stored. Two signed-out users can't share a memory bucket.

## RISKIEST ASSUMPTIONS TO HAMMER
- **Index alignment:** the tap index (renderReaderContent HTML walk),
  `wordContext` (buildSectionWordContext HTML walk), and `words`/sentence logic
  (buildWordSpans of plainText) must stay in lockstep. Find HTML where they drift
  (word split across tags `anno<em>tate</em>`, `&amp;`, `<br>`, headings counted
  as words, nested colored spans).
- **Folder restore races:** fast book→book switches, silent restore vs manual
  pick, stale handle vs fileNames, permission `prompt` vs `granted`.
- **Narrator color path:** `buildSectionWordContext` reads inline
  `style.backgroundColor` on a DETACHED node (no computed styles). If the
  manuscript highlights via CSS classes, color match yields nothing → does it
  fall back correctly to H2/section? Does H2 detection actually fire for these
  books, or will narrator just equal the old section default?

## PROOF ↔ QUILL PARITY (the user explicitly asked)
Confirm: folder-remember + audio auto-attach apply to BOTH (shared picker;
`quill-sync.js:231` already merges `audio_file_name`). Confirm sentence-grab and
per-word narrator are correctly NOT applied to Quill (annotations are exact word
ranges with no narrator; forcing sentences would corrupt the highlight + export
ranges). Flag anything asymmetric that SHOULD be symmetric, or vice versa.

## KNOWN / ACCEPTED (don't just re-flag — say if you disagree)
- Abbreviations ("Mr.", "Dr.") still split the sentence — same as the desktop
  `getSentence`. Accepted as parity.
- The Proof `audio_file_name` pull-fallback only helps TRANSCRIBED sections; the
  embedded `desktop_book` copy covers the rest (`cloud-slim.js` does not strip
  `audioFileName`). Quill writes the name for every chapter, so Quill is more
  robust.
- iOS can't silently reopen a folder (Apple restriction) — "Pick again" is by
  design, not a bug.

## ALREADY VERIFIED (go deeper than this)
`npx next build` green; `npm test` 13/13; sentence + matcher logic checked in a
standalone harness (decimals, multi-sentence drags, "1" vs "11"); build-checker:
0 added audio inputs / `<audio>`. I did NOT drive a real iOS/Android device or
the live touch UI — React-state timing (pre-fill on end-handle drag, late preset
adoption) and the `showDirectoryPicker`/`requestPermission` gesture flow are
reasoned from code, not observed. Prioritise those.

## Output
Punch list grouped 🟥 / 🟨 / 🟩, each with `file:line`, concrete scenario, and a
one-line fix. Then: the single highest-risk thing to test on a real phone first.
