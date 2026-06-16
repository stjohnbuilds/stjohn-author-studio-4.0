# TODO — StJohn Author Studio 4.0

Active and archived tasks. New work goes under **Active**. Completed
work moves to **Archived** with a date.

Format: `- [x] Task name — completed YYYY-MM-DD`. Never leave a task
as 2–3 words. Add context.

Always read `HANDOFF.md` first, then this file.

---

## Active

### 🆕 2026-06-13 — ACX file checker (Second Opinion–style)

- [x] **"Scan for ACX" tool on the proofer book screen** (top action bar,
      next to See errors — moved OUT of Settings per Marie). Measures each
      finished audio file against ACX's rules with bundled ffmpeg
      (`volumedetect` for RMS/peak, `silencedetect` for room tone) — same
      numbers as Steven Jay Cohen's "Second Opinion". Plain-English
      pass/fail. Mirrors the tool Marie trusts.
- [x] **Folder / This-audiobook toggle.** From a book it defaults to
      scanning that book's attached audio (by saved path, nothing
      uploaded — `acx-analyze-file` decodes the stored path); toggle to
      "A folder" to scan any folder.
- [x] **Export after scan:** Copy (clipboard), Save text, Save CSV — text
      report lists the ones that DON'T pass at the top, then PASSED with
      heads-up notes below. On-screen list also sorts fails-first when done.
- [x] **Fixed-size window** so it no longer grows/jumps while scanning.
- [x] **ACX limits (triple-checked via a verification workflow):** RMS
      -23..-18 (fail), 44.1kHz (fail), mono/stereo + batch consistency
      (fail), tail room tone 1–5s (fail), ≤120 min / `_sample` ≤5 min
      (fail), bonus MP3 ≥192kbps. Soft HEADS-UPS (don't block): peak >-3dB
      and START room tone 0.5–1s — both are guidelines ACX accepts past in
      practice (Marie's -1.5dB / 0.96s files passed ACX). Noise floor
      enforced as the -60dB silence threshold. Verdict: logic sound; the
      head room-tone hard-fail was the one real bug, now a heads-up.
      Files: `packages/acx-engine/index.cjs`, `main.js`, `preload.js`,
      `app/components/AcxScanDialog.js`, `app/components/SessionsView.js`
      (button), `app/page.js` (wiring), `scripts/ensure-ffmpeg.js`,
      `electron-builder.yml`, `tests/acx-engine.test.mjs`. Verified:
      163/163 tests pass (incl. live-ffmpeg + Marie's real file); renderer
      compiles clean. — 2026-06-13
- [x] **Released v4.0.20 (Mac)** — 2026-06-15. NOTE: v4.0.19 shipped
      BROKEN — `main.js` requires `packages/acx-engine/index.cjs` but it
      wasn't in `electron-builder.yml` `files:`, so the packaged app
      crashed on launch ("Cannot find module"). Fixed by adding it to the
      whitelist; v4.0.20 verified to actually LAUNCH (renderer process came
      up) before publishing. Lesson saved to memory. Windows NOT included.
- [ ] **Marie hands-test (installed v4.0.19):** open a book, click "Scan for
      ACX" (top bar). Confirm "This audiobook" + folder toggle + export.
- [ ] **Windows release** of v4.0.19 when needed (`npm run release:win`,
      then publish the win artifacts to the same/newer release).
- [ ] **Windows build:** `bin/ffmpeg-x64.exe` is fetched automatically by
      `npm run ffmpeg:win` (wired into `release:win`); confirm it bundles
      and runs on the next Windows release. (Mac already works — uses the
      x86_64 ffmpeg under Rosetta, same as Second Opinion.)

### 🆕 2026-06-07 — Auto-update from GitHub Releases (electron-updater)

- [ ] **Add `electron-updater` so the installed app pulls future updates
      automatically from GitHub Releases.** Marie's pain point: every
      session that produces a new build means manually downloading
      `.app.zip` / `.exe` and re-installing on every laptop. With
      electron-updater wired up: on each launch the app pings the
      latest GitHub release; if newer than itself, surfaces a quiet
      "Update available" toast in the title chrome. Click → downloads
      in background → "Restart to install" appears → click restarts
      with the new version. Setup outline:
        • `npm i electron-updater`
        • In `main.js`, on `app.ready`: `autoUpdater.checkForUpdatesAndNotify()`
        • In `electron-builder.yml`: add `publish:` block pointing at
          GitHub `stjohnbuilds/stjohn-author-studio-4.0`
        • Wire IPC: `'update-available'` / `'update-downloaded'` → a
          tiny banner in `ReaderChrome` (one shared place, NOT per-mode).
      Caveats to call out in Marie's voice once done:
        • Mac without Developer ID: works, but macOS may show a one-time
          allow-update prompt every few months. Real Apple Dev ID ($99/yr)
          makes it silent. Windows works fine without signing — SmartScreen
          shows "unrecognised publisher" once per update.
      Effort: small-medium code change (~50 lines). Test by publishing
      a no-op v4.0.2 release and watching it auto-update.

### 🆕 2026-06-07 — Windows uninstaller leaves files behind

- [ ] **The NSIS uninstaller exits cleanly but leaves files in
      `C:\Program Files\StJohn Author Studio\` that Marie can't delete
      via normal File Explorer.** Probable causes: (a) NSIS uninstaller
      registry isn't tracking every file the installer wrote, (b) some
      files are held open by zombie electron-helper processes the
      installer didn't kill, (c) per-machine vs per-user folder mix-up
      means the uninstaller is removing from the wrong root. Investigate
      via `build/uninstaller.nsh` custom script that force-removes the
      install dir on uninstall (`RMDir /r "$INSTDIR"`). Combine with
      the close-app NSIS fix so both run cleanly together. Verify on
      a fresh Windows VM: install → run app → close app → uninstall →
      install folder should be GONE.

### 🆕 2026-06-07 — Suppress NSIS "cannot be closed" popup on Windows install

- [ ] **Stop the "StJohn Author Studio cannot be closed" prompt during
      Windows install** when the app is clearly NOT running. Marie hit
      this even with the app definitely closed — NSIS's running-process
      check false-triggers on stale Windows process records. Fix is
      a small NSIS include script under `build/installer.nsh` that
      overrides the `customInit` macro to skip the close-app prompt
      (or kill matching processes silently). Add `nsis.include:
      build/installer.nsh` to `electron-builder.yml`. Rebuild + verify
      a fresh install on a clean Windows machine shows no popup.

### 🆕 2026-06-06 — Character palette consolidated into ONE file

- [x] **Shared `app/lib/characterPalette.js` is now the single source of
      truth for the 7 character-row colours.** Previously the same hex
      list was copy-pasted in two places (`PrepManuscriptMode.js`'s
      `CHARACTER_PALETTE` and `ManuscriptSetup.js`'s
      `DEFAULT_MANUAL_COLORS`) and Proof's "+ Add character" button in
      `SessionsView.js` hardcoded `#d9d9d9` (gray), ignoring both. This
      is why new characters added to Sweetheart in Proof (Love / Ebony /
      Rook / Drake) all came out gray instead of cycling through the
      palette like Prep + Setup do. Now all three places import from
      one file. Adding a new character in Proof gives the next unused
      palette colour, same as Prep. Existing gray entries in books.json
      stay gray until Marie clicks the colour swatch to change them
      (data stored in book.narratorColors, not regenerated). 140/140
      tests pass. — completed 2026-06-06

### 🆕 2026-06-06 — Audiobook Breakdown: plain-paragraph POV-name detection

- [x] **Walker now recognises `<p>Vex</p>` as a scene boundary.** Marie's
      Vellum-exported manuscripts mark each scene's POV character with
      a standalone paragraph (`<p>Vex</p>`) above the prose, not an
      `<h2>`. The Breakdown popup used to attribute 100% of those books
      to "Unsure" because the DOM walker only checked `h1`–`h6`. Now
      both Proof's `tallyCharacterWordCountsDom` (SessionsView.js) and
      Prep's `analyzePrepChapterByCharacter` (PrepManuscriptMode.js)
      use a shared `classifyCharacterMarker` helper at
      `app/lib/characterMarker.js`. Plain `<p>` / `<div>` blocks are
      treated as scene boundaries when their entire trimmed text is
      EXACTLY a mapped character's name (strict equality after
      normalisation — body prose mentioning the name does NOT trigger).
      Headings keep their fuzzy substring match so "Phantom — Day One"
      still resolves to Phantom. 13 new regression tests
      (`tests/character-marker.test.mjs`); 140/140 total pass. Marie
      needs to open the Anarchy / Vex book in Proof and confirm the
      Breakdown rows now show Vex's words. — completed 2026-06-06

### 🆕 2026-06-04 — Make markers from CSV + position-based CSV parser

- [x] **CSV parser rewritten position-based.** Column names ignored
      completely (Marie 2026-06-04: "even if a column were named
      grgefkjuhfndjkhnf it would still spit out the right
      timestamps"). Row counts as a data row when slot 0 has a
      chapter title AND slot 3 parses as a clock-style time
      (M:SS or H:MM:SS). Project / Author / MANUSCRIPT LINK /
      "DONE" placeholders / blank rows / typed text in the
      timestamp slot all get skipped. Multi-line quoted cells
      (newline inside a "...") merged into one row. 10 tests.
      — completed 2026-06-04
- [x] **"Make markers from CSV" button next to Export for Engineer.**
      Click → file picker → parses CSV → writes one .txt per chapter
      in a `{title} audition markers` folder, byte-identical format
      to Export for Engineer: header `Name\tStart\tDuration\tTime
      Format\tType\tDescription`, `0:00.000` duration, `decimal`,
      `Cue`, sorted by start time, M:SS.mmm clock. Name = longer of
      slots 7/8 (the manuscript quote), Description = the shorter
      (engineer's note). Skipped-row count surfaced in the
      success alert ("3 rows had no timestamp — skipped"). Uses
      the existing Electron `exportMarkersFolder` path, falls
      back to per-file browser download. 10 tests. 118/118 across
      the project. — completed 2026-06-04

### 🆕 2026-06-04 — Check Errors popup (re-listen workflow)

- [x] **"Check errors" popup — saved flags OR uploaded CSV, same UI.**
      New `app/components/CheckErrorsDialog.js`. Walks one flag at a
      time. Top-right toggle: "Saved flags" reads
      `book.chapters[].sections[].flags` as-is. "Upload CSV" parses
      the existing export format (Chapter / Audio File / Page /
      Timestamp / Narrator/Engineer / Type / Misread Quote / Should
      Say) AND Marie's engineer-template spreadsheet variant (column
      labels "File name" / "Note" for the same columns; scans past
      Project / Author / MANUSCRIPT LINK pre-rows). CSV-imported
      flags are in-memory only — never saved to the book.
      Walker body shows chapter / page / timestamp / narrator /
      type / quote / should-say + the paragraph context (before /
      flagged / after) lifted from the existing section HTML. Audio
      auto-plays from `max(0, ts − 10s)` using the chapter's currently
      attached audio. If the chapter has a whisperAlignment and the
      flag has a manuscript idx, seek time uses
      `getAudioTimeForMsIdx` so re-recorded chapters with shifted
      pacing still land on the right word (falls back to original ts
      otherwise). Reuses existing AppDialog + AudioDock + the same
      flag shape. CSV parser is column-name-tolerant, case-insensitive,
      and scans past header noise. 10 new regression tests; 108/108
      pass overall. Button sits next to "Breakdown" on the book
      detail page. — completed 2026-06-04

### 🆕 2026-06-04 — Playback speed: 1.5 default + per-narrator memory

- [x] **Default listening speed is now 1.5x.** Changed in
      `app/page.js`: the initial state and the localStorage-fallback
      both now resolve to 1.5 instead of 2. Books that previously
      saved 2 keep using 2 (the preset is in the valid range); books
      where nothing was saved start at 1.5. — completed 2026-06-04
- [x] **Per-narrator speed memory — shared across Proof / Quill /
      phone.** New `app/lib/narratorSpeedMemory.js` stores per-narrator
      speed under `ap-narrator-speed:<NarratorName>` in localStorage.
      Narrator key derived from `section.narratorName` first, else
      the dominant highlight character → narrator via the existing
      `tallyCharacterWordCounts` + `book.narratorColors` mapping, else
      `'default'`. So Marie's Mark chapters open at her last Mark
      speed (e.g. 1.45), Daryl chapters at her last Daryl speed (e.g.
      1.5), etc. — and the speed she sets in Proof is honoured by
      Quill + phone too (they share the `'default'` slot). No new
      data on book / section / chapter. — completed 2026-06-04

### 🆕 2026-06-04 — Flag-quote "Kar ma" phantom-space bug + narrator breakdown regression

- [x] **Proof flag quote: exact text from the .docx, not box-join with
      spaces.** The reader splits the manuscript into one box per word,
      then `openFlagAtIndex` glued boxes back with `.join(' ')`. Any
      inline tag boundary inside a word (italic on "all", a hidden span
      around "Kar" / "g") left a phantom space — "all .", "Kar ma",
      "g et" — in the QUOTE field. Built a per-chapter plain-text index
      that records each word-box's start/end character in the original
      decoded text; `sentPlain` and `sentHtml` now slice from that
      instead of joining. Files: new
      `packages/manuscript-engine/chapter-plain-text/index.js`, wired
      into `ProofingReader.openFlagAtIndex`. Old saved flags untouched.
      Fallback path kept if the index ever fails to build. 9 regression
      tests added. 90/90 tests pass. — completed 2026-06-04
- [x] **Quill annotations: same fix in shared engine.** Quill stored
      `selectedText` and `textContext` via `htmlToPlainText` + `.join(' ')`
      — same phantom-space bug. Switched `QuillReaderView` to derive
      `plainText` and `wordSpans` from the new index, and made
      `saveAnnotation` slice via `sliceUnitsRange`. Unit count is
      unchanged (regex split — `[A-Za-z0-9']+`), so old saved
      annotations' `wordStart`/`wordEnd` still point at the right
      words. — completed 2026-06-04
- [x] **Audiobook breakdown: harden narrator lookup.** In
      `SessionsView.sectionTimingRows`, when `sec.characterName` is
      null (true for any chapter parsed without H2 character-name
      scene headings — Marie's current manuscript), also try
      `sec.title` and `ch.title`. Catches chapters literally named
      after the POV character. — completed 2026-06-04
- [x] **Audiobook breakdown: per-chapter character picker.**
      [SUPERSEDED + REVERTED 2026-06-04 — Marie said no new UI / no new
      metadata. The picker dropdown, characterPick state, and save-flow
      propagation are gone. The 4-way matcher fallback (sec.character
      → ch.character → sec.title → ch.title) stays as harmless lookup
      logic. Replaced by the "shift the display, use existing data"
      task below.] — completed 2026-06-04
- [x] **Audiobook breakdown: use existing highlight data (no new
      metadata, no new UI).** Replaces the picker above. The
      breakdown popup now derives character per section from the
      `<span class="hl-yellow">` / hl-pink etc. spans mammoth already
      injects at import + the existing book.narratorColors mapping
      (same data Proof's per-word `detectNarrator` already reads). New
      pure-string helper `tallyCharacterWordCounts` in
      `packages/manuscript-engine/chapter-plain-text/`. SessionsView
      `sectionTimingRows` emits one row per character per section;
      `durationSummary` weights time by word count. So a chapter
      that's 80% pink + 20% no-highlight → 80% of its runtime under
      Daryl, 20% under Narrator. No H1/H2 requirement — robust to any
      heading structure. Falls back to the old per-section behaviour
      when the book has no narrator mapping or no highlights. 8 new
      regression tests (17 total in the file, 98/98 across the
      project). — completed 2026-06-04
- [x] **Proof flag default ts: prefer whisper-aligned time when a
      transcription exists.** Phone already did this
      (`wordStartTimeFromAlignment`). Desktop Proof's `openFlag` used
      raw `audio.currentTime` — inaccurate when manual sliding has
      drifted from the real spoken word. Now: if syncTable has ≥4
      entries, the flag's default ts comes from `getAudioTimeForMsIdx`
      for the resolved manuscript word. Falls back to currentTime if
      no alignment. Works whether the "T" sync toggle is on or off.
      — completed 2026-06-04
- [ ] **Page-number consistency — BENCHED at Marie's request
      2026-06-04.** The whole stack is fragile (PDF page text search +
      ± page adjustment + paging extraction). Marie has explicitly
      parked it. Do NOT propose page-number work until she re-opens
      this.

### 🆕 2026-06-01 — Phone companion: three fixes Marie reported

All live in `app/phone/page.js` (phone is one big file). Doing them one
at a time, **folder first** (Marie's pick). Marie uses both iPhone and
Android.

- [ ] **Phone: remember the audio folder per book.** Today the picked
      folder lives only in React state (`audioFilesByBook`, page.js:466)
      and is lost on reload — it never saves. Plan: persist per
      `userId + audioProjectKey` in a new IndexedDB helper
      (`app/phone/_lib/audioFolderMemory.js`). Android/Chrome (secure
      context) → store the File System Access directory handle, offer a
      one-tap "Reload folder". iPhone/Safari → Apple blocks silent
      re-open; store folder name + filenames, show "Last folder: X · N
      files" + one-tap Pick again. Audio still never leaves the phone
      (only the name/handle is stored, never the audio bytes). Extend the
      existing `BookAudioFolderPicker` — do NOT add a new picker.
- [ ] **Phone: attribute the flag narrator to the tapped word.** Desktop
      detects the narrator per word (`ProofingReader.js` `detectNarrator`:
      nearest preceding H2 character heading + `narratorColors` map);
      phone uses only section-level `autoNarratorFor`, so it shows a
      generic "Narrator". Port the H2-heading method (the phone reader
      keeps H2 headings; it strips highlight colours). Spec from Marie
      2026-06-01: the field DEFAULTS to the detected narrator, the
      dropdown lists ALL options incl. "Engineer", plus an "Add new"
      button.
- [ ] **Phone: tapping one word pulls the whole sentence into the flag.**
      Desktop uses `getSentence(words, idx)` (`ProofingReader.js:132`) to
      expand to sentence bounds; the phone quote is just the tapped word
      (`page.js` `selectionMeta`, ~line 1873). Port `getSentence` (adapt
      to the phone's `{word}` objects) and pre-fill the quote with the
      full sentence.

Progress 2026-06-01: all three implemented in `app/phone/page.js`
(+ new `app/phone/_lib/audioFolderMemory.js`). Sentence detection uses
plainText gaps (buildWordSpans strips punctuation) — verified by sandbox
test incl. trailing `.?!` and multi-sentence selections. Narrator uses a
detached-HTML walk (`buildSectionWordContext`) for nearest H2 heading +
inline highlight colour, mapped via `narratorColors`; field is now a
dropdown (all options incl. Engineer) + "＋ New" button, defaulting to the
detected narrator. Folder memory: IndexedDB per user+book; Chrome/Android
stores a File System Access handle (one-tap Reload), iOS stores name+count
("Pick again"); audio bytes never stored. `npx next build` passes (both
`/` and `/phone`). Review prompt for a second AI at
`REVIEW_PROMPT_phone-fixes.md`. NOT archived — needs Marie's real-phone
test (rule 7: done only after Marie clicks it on a real file).

- [ ] **Phone: folder pick didn't auto-attach each chapter's audio (still
      said "pick").** Root cause (Marie 2026-06-01): `mapPulledProofProjects`
      in `packages/cloud-sync/proof-sync.js` merged the transcription's
      words/alignment onto each section but NOT its `audio_file_name`, and
      `slimBookForCloud` can leave `section.audioFileName` empty — so the
      phone matcher had no filename to match and fell back to per-file
      picking. Fix: on pull, set `merged.audioFileName ||= trans.audio_file_name`
      (mirrors what Quill already does at `quill-sync.js:231`). Needs a
      re-pull on the phone to take effect; book must have been transcribed
      so the transcription rows carry the filename. Verified: 13/13 tests
      pass, `npx next build` clean. Confirms-on-phone pending.

Triple-check audit 2026-06-01 (3 parallel adversarial reviewers + manual
trace). Fixes applied from it:
  • `audioLibrary.js` pickAudioFile loose match: was substring, so
    "Chapter 1" wrongly grabbed "Chapter 11.mp3". Now whole-token
    (`tokenRunContains`) — at worst falls back to manual pick, never the
    wrong file. (Marie's "RIGHT audio" concern.)
  • `page.js` sentence detection: decimals/versions ("3.5", "v1.2") were
    split mid-number → corrupt quote. ENDER now requires `.?!`+space, so
    decimals stay intact. Abbreviations ("Mr.") still split = desktop parity.
  • `page.js` flag pre-fill: guard keyed on selection start ONLY meant
    dragging the END handle to cover more sentences did NOT extend the
    quote (broke the "highlight more" promise). Now keyed on start:end with
    quote/narrator "dirty" tracking so it extends but never clobbers edits.
  • `page.js` PhoneAudioDock: adopts a folder match that arrives AFTER a
    chapter is already open (late silent-restore) instead of still showing
    "pick".
  • `page.js` BookAudioFolderPicker: "Pick files" pick now clears any stale
    directory handle (handle/fileNames can't diverge); empty-folder pick
    shows a message instead of silently popping a 2nd picker; non-audio
    selection now gives feedback; Clear awaits the IndexedDB delete; silent
    restore no longer fires the status toast.
  • `audioFolderMemory.js` save now requires a real userId (no shared
    "anonymous" bucket), mirroring projectCache.
Quill parity: folder-remember + audio auto-attach apply to Quill (shared
picker + quill-sync already merges audio_file_name). Sentence-grab +
per-word narrator are NOT applicable to Quill (annotations are exact word
ranges, no narrator) — left Quill alone, by design.
Known/acceptable limits: abbreviation sentence-split (desktop parity);
Proof audio_file_name fallback only covers transcribed sections (the
embedded desktop_book copy covers the rest). Build-checker compliant
(0 added audio inputs / <audio>). Still needs Marie's real-phone test.

Second review round 2026-06-02 (external bot via REVIEW_PROMPT). Verified
each finding against the code; fixes applied:
  • `sentenceTextBetween`: a sentence ending "(a lot)." dropped the ")"
    and "." (unbalanced quote); and dialogue lost its OPENING quote. Now
    grabs a leading opening quote/bracket and a closing bracket that
    precedes the terminal . ! ? — quotes stay balanced + match desktop.
    (8/8 harness cases incl. dialogue, brackets, decimals.)
  • Pre-fill effect: the Page field froze after the first selection (quote
    + narrator refreshed on a new word, page didn't). Now page/quote/
    narrator all refresh on a NEW anchor word and all stay put while only
    extending the selection; added `pageDirtyRef` so a typed page is never
    clobbered. Also fixed: a typed "＋ New" narrator no longer sticks when
    you tap a different word without saving.
  • `sectionPlainText` + `chapterPlainText`: decode named HTML entities
    (&rsquo; &mdash; …) so buildWordSpans tokenizes IDENTICALLY to the
    reader's DOM tap-index — closes the word-index drift that would mis-
    anchor the sentence/quote (and Quill annotation ranges) after any such
    entity. Applies to BOTH Proof and Quill (parity).
  • Folder picker: clear `memory` synchronously on book change (defensive
    vs a stale-handle restore race); a "Pick files" selection no longer
    inherits the previous folder's NAME (was already not inheriting the
    handle).
Left as-is (correct): color-class narrator highlights fall back to H2/
section (can't read computed style off a detached node — needs a real
coloured manuscript to confirm Marie's books); whole-token matcher may
miss fuzzy partials like "Kingdom"/"Kingdoms" (deliberate — never attaches
the wrong file). Tests 13/13, `npx next build` clean.

### 🆕 2026-05-27 — Drive snapshot backup system added

Built end-to-end. Daily on first app-open, per-account opt-in via
Settings → "Drive snapshots" card → "On for this account" toggle.
Saves a zip into `My Drive/Game Dev/GitHub/App Backups/` containing
all local JSON saves plus a cloud snapshot. Keeps newest 25, drops
oldest. Skips silently if Drive isn't detected on this Mac. Manual
"Snapshot now" button next to the toggle.

Tests: 13/13 pass (gained 2). Files: `main.js`, `preload.js`,
`packages/backups/index.js` (new), `app/page.js`.

- [ ] **Verify Drive snapshot system in packaged Mac app.**
      Build (`npm run release:mac`), open Settings → Drive snapshots →
      toggle on → click "Snapshot now". Confirm a new zip lands in
      `~/Library/CloudStorage/GoogleDrive-.../My Drive/Game Dev/GitHub/App Backups/`
      and contains `local/*.json` + `cloud/cloud-snapshot.json`. Then
      sign out, sign back in, confirm the daily auto-trigger fires once.
- [ ] **Port snapshot system to Typing and Tomes.** Open a fresh
      Claude session in that project, ask for "port the Drive snapshot
      system from Author Studio" — copy `packages/backups/`, the main.js
      IPC block, the preload additions, the page.js wiring, and the
      Settings card.
- [ ] **Port snapshot system to Script and Sync 3.0.** Same as above
      in that project.
- [ ] **Add Prep to cloud as `prep_projects` table (Marie requested
      2026-05-27).** Plan in chat: single new Supabase table mirroring
      Quill's shape, RLS scoped to owner, push/pull helpers in
      `packages/cloud-sync/`, debounced save in PrepManuscriptMode, and
      pull on focus. ~half a day.
- [ ] **Phone Quill edit/delete annotations (Marie requested
      2026-05-27).** Tap existing annotation → popup with current
      values pre-filled + Delete button. Wire to new tiny
      `upsertQuillAnnotation` / `deleteQuillAnnotation` cloud helpers.
      ~2-3 hours.

### 📋 2026-05-27 — Distribution readiness audit completed (read-only)

Full audit per the `APP_DISTRIBUTION_READINESS_AUDIT_INSTRUCTIONS.md`
playbook in Drive `Game Dev/GitHub/`. Report at:
`docs/dev/active/distribution-readiness-audit-2026-05-27/REPORT.md`

Tests passed 11/11. Login screen rendered clean. Score: **72%
provisional** ("workable, but distribution risk remains").

**Top blockers updated 2026-05-27:**
1. ✅ RLS on the six Supabase tables — verified live; locked per user.
2. Phone ↔ desktop flag round-trip — Marie has used it informally; no
   formal two-device test yet.
3. Mac code-signing / notarization absent — first-launch Gatekeeper
   friction for anyone receiving the `.app`; right-click → Open works.

**In-company sharing rating: 90%.** Public release still 72%
provisional. Full report:
`docs/dev/active/distribution-readiness-audit-2026-05-27/REPORT.md`

**Cleanup flagged (not blocking):**
- 25 GB of stale builds in `Script and Sync Releases/Old/`.
- Releases folder + root shortcut files still use old "Proofer" / "Script and Sync" brand.
- `ProofingReader.js` still inline at 1,445 lines (migration tracked).

### Current priority order — cleaned 2026-05-27

- [x] **Proof + Quill transcription sync real-file check.** Marie
      confirmed Proof sync looks good after re-transcribing, Quill jump
      / follow works after the word-count fix, and phone receives the
      transcription. Keep watching for new real-file failures, but this
      is no longer a live blocker. — completed 2026-05-27
- [x] **Phone Quill Back navigation.** Marie re-tested the Quill phone
      Back fix and said it seems fixed. — completed 2026-05-27
- [x] **Phone → desktop Quill annotation round-trip.** Marie added an
      annotation on the phone and saw it on desktop. Add/edit/delete on
      phone is useful polish, not a blocker for adding annotations. —
      completed 2026-05-27
- [x] **Desktop Proof flag save safety.** Desktop flag adds/deletes now
      use the same single-row cloud queue as phone flags, so a flag can
      survive cloud weirdness and retry later instead of depending only
      on the whole-book save. — completed 2026-05-27
- [x] **Phone pending flag backup download.** When phone flags are
      waiting to sync, the book view now offers a CSV backup download
      next to Retry. — completed 2026-05-27
- [x] **Use Quill content hashes on pull.** `quill_chapters.content_hash`
      and `quill_annotations.content_hash` are now selected from
      Supabase and kept on pulled chapters/annotations. — completed
      2026-05-27
- [x] **RLS / Supabase public-release check.** Verified live in the
      database 2026-05-27 via Supabase MCP. All six tables
      (`script_sync_projects`, `script_sync_section_transcriptions`,
      `script_sync_flags`, `quill_projects`, `quill_chapters`,
      `quill_annotations`) have RLS enabled with policies scoped to
      `owner_id = auth.uid()`, with secondary tables also enforcing the
      parent-project owner. No code or data change required. Cloud
      privacy is safe for in-company sharing. Evidence captured in the
      distribution audit report. — completed 2026-05-27
- [ ] **Big-book cloud payload measurement.** Measure one fully
      transcribed large real book so we know Supabase uploads stay small
      and do not timeout. Plain meaning: check the cloud package is not
      too heavy for a giant book.
- [ ] **Quill home load-speed real check.** The code now has the light
      project-list index. Marie should test switching into Quill on her
      large project after the next saved write.
- [ ] **Phone Quill edit/delete annotations.** Useful polish. Adding
      annotations works and round-trips; editing/deleting from phone is
      still missing.
- [ ] **Prep visual polish pass.** Lower priority than data safety, but
      Prep needs a cleaner look before release.
- [ ] **Final packaging trigger.** After safety fixes + tests + visual
      pass are done, rebuild Mac and Windows packages and redeploy the
      phone app if phone code changed.
      Progress 2026-05-27: phone app redeployed after the pending-flag
      backup-download patch. Mac/Windows packages still wait until the
      next desktop package pass.
      Progress 2026-05-27: Mac app rebuilt after desktop flag-save
      safety patch. Windows still waits until final package pass.
      Progress 2026-05-27: phone Proof/Quill export buttons now download
      one ZIP package per mode. Mac app and Windows artifacts rebuilt into
      `Script and Sync Releases/`, and phone redeployed to Vercel.

---

### ✅ RESOLVED — Restore transcription sync accuracy

Proof and Quill follow-text / jump-to-word must use real word timestamp
anchors, not token fragments or estimated word speed. Current evidence:
native whisper.cpp JSON token output is being stored as split pieces
(`v` + `ex`, `eb` + `ony`, `don` + `'` + `t`) in saved transcription
data, which can make jump/follow drift. Fix parser, re-transcribe a real
chapter, then verify: jump to random words at start/middle/end lands
within 1–2 words and follow text does not drift over time at 1x, 1.5x,
2x, and 3x.

Progress 2026-05-27: attempted word-merge parsing made some separate
words join together (`faceplease`), so native Whisper parsing was
returned to the proven Script and Sync 3.0 token style. Next verification
must focus on reader seek/follow behavior and real-file alignment, not
assume the parser alone fixed sync.

Progress 2026-05-27: confirmed Quill drift came from a word-count
mismatch. Quill reader/annotations counted regex words, but Quill
transcription through shared book detail counted whitespace words
(Chapter 4 example: 1,635 visible reader words vs 1,581 aligned words).
Patch now keeps Quill transcription on Quill reader word counting and
keeps Proof on Script and Sync whitespace counting.

Progress 2026-05-27: Marie re-tested the packaged Mac app after
re-transcribing and confirmed Quill jumping/transcription sync now works
on her real file. Keep Proof verification separate before closing this
blocker completely.

Progress 2026-05-27 overnight: added a desktop **Clear T** control on
transcribed chapters. It clears saved transcription/sync timing while
leaving audio, flags, and Quill annotations alone, so a failed/stale
re-transcribe can start from a clean state. Packaged into the Mac app.

Progress 2026-05-27: Marie confirmed Proof transcription sync looks
good on her real file after re-transcribing. Do not keep listing Proof
sync as untested unless a new real-file failure appears.

Progress 2026-05-27: moved transcription clearing out of each chapter
row because it broke the chapter-list layout. The list now has a compact
top-row `×` beside Transcribe all to clear saved transcriptions in bulk.

### 🟡 CHECK — Quill home must not wait for full transcription payload

Switching from Proof to Quill should show the project list immediately.
Current Quill save data is large because chapter transcript/alignment
data is stored inside the project file. The home screen only needs
project id/title/counts/timestamps, so split or lazy-load heavy chapter
transcription payloads after the list renders.

Progress 2026-05-27: Electron now exposes a lightweight Quill project
list and loads the full Quill project only when the project is opened.
Needs packaged-app timing check on Marie's large project before this can
be marked complete.

Progress 2026-05-27 overnight: Mac app was rebuilt with the lazy Quill
list path still passing build/package checks. Still needs Marie's timing
check on her large project before marking complete.

Progress 2026-05-27: found the remaining slow path. The renderer asked
for a light Quill project list, but Electron still parsed the full
transcription-heavy Quill JSON to create that list. Added a tiny
`quill-project-list.json` index so the project list can load without
parsing the full save file after the next write.

### 🟡 CHECK — Phone Proof + Quill companion parity

Phone app goal: pull the cloud project data, keep audio local on the
phone, match audio by synced filenames, save Proof flags / Quill
annotations with useful metadata, and export CSV from the phone.

Progress 2026-05-27: inspected `app/phone/page.js`. Proof phone already
has book-level audio folder picking, filename matching, player speed
controls, sync highlight, flag metadata fields, pending flag queue, and
CSV export. Patched Quill phone to add project-level audio folder
picking, chapter filename matching, the shared phone player/speed/sync
dock, annotation timestamps from transcription/current audio time, and
Audio File in the Quill CSV export. Needs Marie's real-phone test after
deploy.

Progress 2026-05-27: added `.vercelignore` because the first deploy
attempt tried to upload desktop release/data folders. Production deploy
then succeeded and aliased to `https://stjohn-author-studio-4.vercel.app`.

Progress 2026-05-27: fixed Quill phone Back navigation. The
last-opened-chapter restore effect was immediately reopening the reader
after Back set the chapter to null, causing a flicker and trapping Marie
in the reader. Deployed the fix to production.

Progress 2026-05-27: Marie confirmed transcription ports to phone, but
the Quill annotation popup was missing desktop metadata controls and the
reader still prompted for one audio file. Patched Quill phone popup to
mirror the desktop metadata controls: annotation type, subtype dropdown,
custom emotion, attach characters, custom character, and note. Quill
reader no-audio state now tells Marie to return to the chapter list for
the audio folder instead of asking for a single chapter file. Deployed
to production.

Progress 2026-05-27 overnight: added phone chapter-list transcription
status. Quill chapters now show a separate `✓ Transcribed` pill when
usable synced alignment exists. Proof chapters show `✓ Transcribed`
when all sections have usable alignment, or `Part transcribed X/Y` when
only some sections are synced.

Progress 2026-05-27: Marie confirmed phone-to-desktop data looked good
for the tested flags/annotations. Patched Quill phone navigation again:
removed automatic last-chapter restore so Back reliably returns to the
chapter list instead of flickering back into the reader. Added a copy
button to the phone Proof flag popup that copies a tab-separated row.

Progress 2026-05-27: Marie tested the Quill phone Back fix and confirmed
it seems fixed. Do not keep this listed as urgent unless it reappears.

### ✅ RESOLVED / STALE PLAN — Page-number architecture rebuild

**Why this is the blocker.** Page numbers are the primary value of the
app. The current architecture stores the full text of every PDF page
in `pdfPaging.pages` and does a quote-search at flag time. This:
- Fails on Marie's books (returns wrong pages — e.g. p.16 came back as p.4)
- Causes the Supabase CloudSync timeout (massive blob for a 419-page book)
- Forces the phone to either receive the same heavy blob or lose page numbers
- Doesn't match Marie's mental model: PDF is for page numbers; words live in the manuscript.

**The fix Marie signed off on.** Replace the heavy `pdfPaging.pages`
with a slim word-index → printed-page map. PDF is used once at import
to build the map, then discarded from the cloud blob. At flag time,
page lookup is a single array lookup. No quote searching anywhere.

**Plan (in order — every AI picking this up follows these steps):**

1. **Add `buildSlimPageMap(pdfPages, manuscriptWords)` to
   `app/lib/pdfPaging.js`.** Walk each PDF page, take the first 5–8
   non-footer words of its extracted text, find that sequence in the
   manuscript word array starting from a moving cursor. Record
   `{ wordStart: matched index, pageNumber: page.pageNumber }`.
   Output is an array sortable by wordStart.

2. **Wire it into ImportFlow.** When ImportFlow has both `pdfPaging`
   AND parsed manuscript words, run `buildSlimPageMap` and attach the
   result as `pdfPageMap` on the payload that goes to `onConfirm`.

3. **Adopt the slim map in ManuscriptSetup and the other modes.** Save
   `pdfPageMap` on the book/project. Treat it as the primary truth for
   word-index → page lookup. Keep `pdfPaging` for diagnostics on
   desktop ONLY (file name, page count, printed-count) — strip its
   heavy `pages` array.

4. **Strip `pdfPaging.pages` from cloud uploads in
   `packages/cloud-sync/cloud-slim.js`.** `slimBookForCloud` and
   `slimProjectForCloud` must drop `pdfPaging.pages` while keeping
   `pdfPageMap` (which is small and the phone needs it).

5. **Rewrite `getAutoPageNumber` in `app/components/ProofingReader.js`.**
   Look up by word index against `pdfPageMap` (primary), fall back to
   `manuscriptPaging.pageMap` (when no PDF was attached), `?`
   otherwise. Delete the quote-search code path.

6. **Delete (or quarantine) `findPdfPageForQuote` in
   `app/lib/pdfPaging.js`.** Nothing should call it. Leave only the
   page-extraction code that builds `pdfPages` for the map builder.

7. **Wire phone lookup to the same map.** `app/phone/page.js` looks up
   the flag's word index against the synced `pdfPageMap`. No
   quote search on phone. No PDF on phone.

8. **Acceptance test (Marie's hands):** open Anarchy. Tap a word she
   knows is on page 16. Popup shows 16. Tap a word on page 340. Popup
   shows 340. Save flag offline → online → CloudSync push completes
   without "statement timeout." Phone shows the same page numbers.

**Files this touches (and ONLY these):**
- `app/lib/pdfPaging.js` — add `buildSlimPageMap`, remove `findPdfPageForQuote`
- `app/components/ImportFlow.js` — pass `pdfPageMap` through `onConfirm`
- `app/components/ManuscriptSetup.js` — save `pdfPageMap` on book
- `app/components/QuillAndInkMode.js`, `PrebuildMode.js`, `PrepManuscriptMode.js` — adopt pdfPageMap when applicable (Quill probably doesn't care; Duet may not need it; Prep maybe)
- `app/components/ProofingReader.js` — rewrite `getAutoPageNumber`
- `packages/cloud-sync/cloud-slim.js` — strip `pdfPaging.pages`, keep `pdfPageMap`
- `app/phone/page.js` — page lookup via map

**Decisions already made (don't re-litigate):**
- No new Supabase tables. Same 6 tables.
- No data migration. Old cloud books still pull; if they have heavy `pdfPaging.pages`, ignore it on pull (don't store it locally).
- `pageNumberAdjustment` survives ONLY as a manual nudge for the manuscript word-count fallback (when no PDF). Never applied to map results.
- PDF is desktop-only. Never uploaded to Supabase. Never sent to phone.
- Quill: no PDF, no pdfPageMap, no page numbers anywhere. (Already true.)

Progress 2026-05-27 overnight: Marie said page numbers were already
fixed. This old blocker is left in place until a focused cleanup pass
compares the TODO text against the current code and archives the stale
plan safely.

---

### 🔴 CLOUD SAFETY AUDIT FINDINGS — fix list (from independent audit 2026-05-26)

Independent AI audited cloud-sync code against `docs/CLOUD_SAFETY_AUDIT.md`.
Results: 15 ✓ safe / 8 ⚠ risks / 4 ❌ bugs / 5 ? unknown. The four ❌
bugs need fixing before release. The eight ⚠ risks need a judgement
call each.

#### ❌ Bugs (fix before release)

- [x] **Sign-out leaves previous user's data in desktop `books` state.**
      `handleSignOut` in `app/page.js:553-558` only clears
      `authSession`, not `books`. Next user signing in sees the
      previous user's books briefly, AND the debounced push at
      `app/page.js:516-551` may attempt to push prev-user rows under
      the new user's ownerId within 1200ms. Fix: `setBooks([])` and
      clear all cloudId-bearing state on sign-out, OR unmount the
      books-owning component when `authSession` is null.

- [x] **Quill chapter `alignment` is pushed but never pulled.**
      `quill-sync.js:71` writes `alignment` into `quill_chapters`,
      but `quill-sync.js:154` SELECT omits it AND `slimProjectForCloud`
      strips it from the blob. After any push-then-pull round-trip,
      every chapter's audio alignment is gone. Fresh machines lose
      audio-to-word sync. Fix: add `alignment` to the SELECT, OR stop
      writing it (decide if Quill audio alignment is still a feature).

- [x] **Tombstone permanent-ghost: `clearTombstone` is exported but
      never called.** If Marie deletes a project and re-imports/re-creates
      one with the same local id, the tombstone permanently hides it
      AND the retry-delete keeps killing the cloud row on every pull.
      Fix: call `clearTombstone(scope, id)` from project-create /
      project-import flows in both `app/page.js` (Proof) and
      `app/components/QuillAndInkMode.js` (Quill).

- [x] **Race between full-book push and single-flag push.** Full-book
      push deletes-then-inserts all flags (`proof-sync.js:117-122`).
      If a single-flag upsert lands between the delete and the insert
      on another device, that flag is wiped. Fix: change full-book
      flag sync to upsert-with-merge instead of delete-then-insert,
      OR add a row-version check.

#### ⚠ Risks (decide and fix or accept)

- [x] **Audio-extension list drift.** CLAUDE.md lists 6 extensions;
      `audio-guard.js:32` regex covers 8 (adds `.ogg`, `.aac`).
      Reconcile to one source of truth. Low risk for Marie.
- [x] **Flag-queue has no cap / no backoff.** Permanent server-side
      failure = perpetual pending banner. Add max-retry-count or
      exponential backoff.
- [x] **Desktop has no per-flag offline queue.** Only the full-book
      debounced push. If Marie saves a flag and closes the laptop
      within 1200ms before push fires, the flag may not survive.
      Decide: wire `recordPendingFlag` into desktop save, OR document
      this as "always wait 2s before quitting after saving."
      Fixed 2026-05-27: desktop flag saves/deletes now write to the
      local retry queue and immediately attempt single-row cloud
      upsert/delete.
- [x] **`lastPushHashByCloudId` survives sign-out** (Map at module
      scope). Theoretical collision risk across users. Add
      `clearHashCache()` to sign-out.
- [x] **`quill_chapters.content_hash` and `quill_annotations.content_hash`
      written but never read.** Dead columns. Drop or use.
      Fixed 2026-05-27: pull now selects both hashes and keeps them on
      returned chapters/annotations as `contentHash`.
- [ ] **`pullProofProjects` / `pullQuillProjects` don't pass ownerId
      — trust RLS.** Verify RLS policies on the 6 tables in the
      Supabase dashboard; if any are missing, every signed-in user
      sees every other user's projects.
- [x] **Tombstone retry-delete has no rate limit.** Re-issues on
      every pull until the cloud row is gone. Add a per-session
      attempt cap.
- [x] **Local-id-in-NOT-IN-string injection theoretical.** `local_id`
      values are UUIDs so safe today; defensive fix is `.not('local_id',
      'in', \`(${ids.map(...).join(',')})\`)` validation.

#### ? Unknown (live test required)

- [ ] Phone → desktop Proof-flag round-trip — needs two-device test.
- [ ] Payload size on a fully-transcribed 50-chapter book — measure.
- [ ] Behavior under concurrent full-book + single-flag push — stress test.
- [ ] RLS policies on the 6 Supabase tables — check the dashboard.
- [ ] Hidden flag queue in `app/page.js` / `SessionsView.js` — re-grep.

Progress 2026-05-27 overnight: cleanup pass patched the low-risk safety
items above: flag queue retry backoff/cap, tombstone retry-delete cap,
Quill NOT-IN quoting, and source-doc audio extension drift. Items that
need live dashboard/two-device verification remain unchecked.

---

### ⭐ PRIMARY — Final round bug-fix assessment

**The active checklist lives in
`dev/active/FINAL-ROUND-checklist.md`** (created 2026-05-26).

Part A is hands-on for Marie (every mode, real books, real audio).
Part B is the deep dive for Claude (cloud round-trip, edge cases,
code health, hook health). Part C is the watch list.

When this checklist is fully ticked, archive it under `dev/archive/`
with the run date and open a fresh TODO.md.

Everything below this line was the OLD active list, kept here for
context until the final-round walkthrough closes.

---

### OLD — Marie's testing checklist (superseded by FINAL-ROUND-checklist.md)

- [x] **Sign in** — completed 2026-05-25. Supabase project
      `evcusovtjfypfyfvnooy` wired; Marie signs in with her existing
      account.
- [x] **Four mode colours look right** — completed 2026-05-25.
      Verified live: each mode wears its own pastel, no purple leak,
      card headers flat.
- [ ] **Re-test a real Proof audiobook on the NEW unified UI.**
      The book detail is now SessionsView (same component Quill +
      Duet use). Walk through the usual flow — confirm title, action
      buttons, side nav, chapter list, audio panels, delete still
      work. The big purple banner is gone; deleted is now a tiny 🗑
      top-right. **If anything's broken vs the last build, tell me.**
- [ ] **Re-test Quill on a real .docx on the NEW unified UI.**
      Quill book-detail is also SessionsView now (mode="quill"). New
      project → upload a manuscript → open a chapter → drag across
      words → tap pink + → pick a class → save. Confirm the pink
      underline + sidebar entry. Also: Split toggle ON should now
      reveal scene rows from H2 sub-headings.
- [ ] **Test the InDesign export.** Book detail → Export CSV +
      InDesign. Open the .jsx in InDesign and run against a real
      layout. Eyes-on check: are character styles created? Are
      highlights underlined? Marie is the only one who can verify
      "right" for her print workflow.
      Progress 2026-05-27: generated an isolated InDesign test pack at
      `docs/dev/active/indesign-export-test-pack/artifacts/` using the
      real Quill exporter (`buildInDesignJsx`) plus a 4-page DOCX.
      This is a safe first test, not a replacement for Marie's real
      layout check.
- [ ] **Test the phone scaffold.** Browser to `http://localhost:3000/phone`
      while `npm run dev` is running. Sign in with the same account.
      Quill project from the desktop should appear. Open a chapter,
      tap a word, add an annotation. Reload the desktop — annotation
      should appear there too. (Cloud round-trip confirmation.)

### Next up after Marie's checklist

- [x] **Cloud sync for Proof Listen.** Built — packages/cloud-sync/proof-sync.js
      with push/pull/delete, wired into app/page.js with debounced push
      and on-load merge. Audio paths flow through audio-guard.js. —
      completed 2026-05-25 (overnight)

- [x] **Phone Script mode (Proof Listen on phone).** Built — phone has
      both Quill and Script services now. Script flow: project list
      from `pullProofProjects` → chapter list → section reader → tap to
      select word → flag panel with type dropdown + note + save. Saved
      flags push to cloud via `pushProofProject`. — completed 2026-05-25
      (overnight)

- [x] **Phone CSV export.** Built — Export CSV button on both Quill
      (annotations) and Script (flags) project views. Inline
      `buildFlagsCsv` for now; tracked under "Export helpers
      consolidation" if you ever want it lifted to `packages/exports/`. —
      completed 2026-05-25 (overnight)

- [x] **Phone audio playback in Quill mode.** Built —
      `<PhoneAudioDock>` is a small fixed-bottom dock with file picker,
      play/pause, scrubber, speed, close. Shared by Quill and Script.
      Audio stays on the phone. Script reader captures the current
      audio time as the flag's `ts`. — completed 2026-05-25 (overnight)

- [x] **Deploy phone to Vercel.** Live at
      **https://stjohn-author-studio-4.vercel.app/phone**. Linked to the
      Vercel project `marie-mackays-projects/stjohn-author-studio-4`,
      env vars (`NEXT_PUBLIC_SUPABASE_URL` +
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) set in production scope,
      first deploy ready. Both `/` and `/phone` return 200. —
      completed 2026-05-25

- [x] **Phone IS the root on Vercel.** Added build-time swap script
      `scripts/vercel-root-to-phone.js` that copies the phone HTML
      over `out/index.html` when `VERCEL=1`. URL bar stays as `/`,
      no bounce, no redirect. Electron's release scripts call
      `next build` directly so the swap doesn't run there — Electron
      keeps the desktop UI at `/`. (First attempt used `vercel.json`
      rewrites but static-export `index.html` was served before the
      rewrite could apply.) — completed 2026-05-26

- [ ] **Audio sync in Quill desktop reader.** Optional. Quill works
      without audio. If Marie wants audio while annotating on the
      desktop, port the audio dock from the alpha reader.

- [ ] **Search inside chapter in Quill desktop.** Optional. ProofingReader
      has search; port it over.

### Smaller cleanup (low priority, low risk)

- [ ] **Migrate `ProofingReader.js` to use `ReaderChrome.js`** — Prep
      already does. Pure refactor, no behaviour change.

- [ ] **Migrate Duet `PrebuildMode.js` to use `ReaderChrome.js`** —
      uses its own AppModeToggle placement; no shared chrome yet.

- [ ] **Migrate Proof's `BookSetup` to use `ImportFlow`** — Last
      duplicate of the upload flow. Layered with PDF paging + narrator
      colour mapping, so the goal is for BookSetup to render
      `ImportFlow` plus the Proof-only panels.

### ✅ URGENT — Full app unification — DONE 2026-05-25

**Outcome achieved.** Proof + Quill + Duet all now render `SessionsView`
for the book detail. Proof + Quill use `ChapterReader` / `renderChapterBody`
for the reader. `AudioDock` and `ImportFlow` are shared by all modes.
The build-checker hook hard-blocks fresh duplicate components.

**Architectural note:** the plan was to extract each panel (NarratorPanel,
AudiobookTimingPanel, BulkAudioPanel, TranscriptionQueueIndicator) as
its own file. **That isn't what shipped.** Instead, those panels live
INLINE inside SessionsView, and all three modes share the panels by
rendering SessionsView with a `mode` prop. Same user outcome (one UI
everywhere, fix once = fix everywhere) via different architecture.
Phase A items A3–A8 and Phase B1 are NOT extracted as files.

If a future session wants to extract them into separate components for
code-organisation reasons, that's tracked under "Smaller cleanup."

### Code-health audit pass (after reader unification, before phone work)

Same-source mandate applied to the WHOLE codebase, not just BookDetail
and Reader. Sweep:

- [ ] **Extract shared `ModeHome` (project library) component.** Each
      mode has its own home view (project cards + "+ New" button).
      Quill's is the simplest baseline. Same pattern as `BookDetail`:
      take title + accent + project list + onNew/onOpen handlers,
      with a slot for mode-specific tiles (Prep's "scanning" badge,
      Proof's audio-bookmark indicator). Migrate Proof, Duet, Quill,
      and Prep to it. Add to `SHARED_COMPONENTS.md`. Tighten the
      build-checker hook to block new inline `*HomeView` declarations
      that don't import `./ModeHome`.

- [ ] **Shared `<ConfirmDialog />`.** Every mode uses native
      `window.confirm()` which looks like a browser alert and breaks
      the visual language. Build a themed modal with the mode-tone
      accent. Replace every `window.confirm` call across all mode
      files. Add to `SHARED_COMPONENTS.md`. Hook: block new
      `window.confirm(` additions in mode files.

- [ ] **Cloud-sync helpers parity — Proof only.** `packages/cloud-sync/`
      has Quill wired (`quill-sync.js`). Build `proof-sync.js` (push/pull
      for `script_sync_projects`, `script_sync_section_transcriptions`,
      `script_sync_flags`) mirroring `quill-sync.js`'s shape. Audio
      paths flow through `audio-guard.js` before any upload (already
      enforced). **Prep and Duet stay desktop-only** — they don't go to
      phone so they don't need cloud sync. Only Proof + Quill ship to
      phone.

- [ ] **Export helpers consolidation.** Quill has CSV + InDesign export
      in `packages/quill-engine/exporters.js`. Prep has CSV + DOCX in
      `app/components/prepExport.js`. Both should live under a single
      `packages/exports/` with one consistent file pattern (one file
      per export format, shared `downloadBlob` / `safeFileName`
      helpers). Phone's CSV export later imports from the same place.

- [ ] **Inline-style sweep.** Walk every mode file (and shared
      components) and look for:
      - inline `position: 'sticky'` → use `<StickyTopBar />`
      - inline hex color codes → use `MODE_TOKENS[tone]`
      - inline button `style={{ padding, border, background ... }}` →
        use `topBtnStyle(tone, variant)` or `pillBtnStyle(tone)`
      - direct `getSupabaseClient()` calls → must go through
        `packages/cloud-sync/`
      - direct `fs.writeFile` / `window.electron.*` calls outside
        `packages/` — should be wrapped in a typed helper
      Each pattern gets a build-checker hook rule blocking new
      additions.

- [ ] **`.claude/hooks/` health check.** Verify every hook handles
      edge cases robustly: missing edit-log, missing git binary, large
      file lists, log rotation past `MAX_LINES`, permission errors
      writing logs, hook running outside project root. Verify
      `settings.json` registers each hook on the right events. Run a
      synthetic edit (touch a known mode file) and confirm
      `hook-activity.log` shows the expected sequence:
      `file-tracker` → `git-backup` → `build-checker` →
      `context-check` → `no-mess`. Add a `.claude/hooks/_test.sh`
      script that exercises each hook against a fake edit-log and
      reports pass/fail.

- [ ] **`packages/` audit.** Look for duplication BETWEEN packages.
      `packages/manuscript-engine` does DOCX import and dialogue
      detection; `packages/quill-engine` has its own DOCX-related
      helpers (annotation export to InDesign reads DOCX structure
      indirectly). Both should depend on a single canonical
      manuscript-engine if there's overlap. Document the package
      graph in `SHARED_COMPONENTS.md`.

### Same-source consolidation pass — mostly done 2026-05-25

- [x] **Refactor Duet's view==='project' to render shared
      `BookDetail`.** Done — Duet renders `SessionsView` with
      mode="duet" + engineerProgress slot. Inline 386-line custom
      JSX stripped.
- [x] **Refactor Proof's `SessionsView.js` to render shared
      `BookDetail`.** Done — Proof's banner killed, action buttons
      moved to the shared row, side-nav + chapter list inside
      SessionsView are the shared surface that Quill + Duet now
      share too.
- [x] **Unify the reader.** Done for Proof + Quill via
      `renderChapterBody` from `ChapterReader.js`. Prep stays
      separate (dialogue spans, different model). Duet's reader
      stays separate (block-display, different model) — by design.

- [ ] **Extract shared `ModeHome` (project library) component.** Each
      mode has its own home view (project cards + "+ New" button).
      Quill's is the simplest baseline. Same pattern as BookDetail.
      Still not done.

- [ ] **Replace `window.confirm()` with a shared `<ConfirmDialog />`.**
      Every mode uses native confirm. A shared themed dialog would
      look consistent. Still not done.

### Phase 10 — real-file end-to-end pass

- [ ] Marie runs every minimum-release check on her actual books +
      audiobooks. Every row in `WIRING_MATRIX.md` flips to `verified
      live`.
- [ ] Phone signed-in proof: real flag + real annotation saved from
      phone, seen on desktop.

### Phase 11 — release

- [ ] Mac packaged build.
- [ ] Windows packaged build.
- [ ] Phone deploy live on Vercel.
- [ ] First user release.

---

## Archived

### 2026-06-01 — Cloud guard: hard whitelist on every Supabase write

- [x] **Wrapped the shared Supabase client with a hard table whitelist.** —
      completed 2026-06-01. After investigating a cross-app contamination
      report (T&T's `app_data` row overwritten with Sweetheart Part One),
      ruled out StJohn 4.0 as the culprit (no code path calls `app_data`
      or any RPC; `docs/CLOUD_SCHEMA.md:164` explicitly marks `app_data`
      "unused by current app"). To prevent any future bug or stray
      library call from leaking 4.0 data into another app's tables,
      added an `installCloudGuard` wrapper in `packages/cloud-sync/client.js`.
      The guard monkey-patches `client.from` and `client.rpc`:
        - `.from("<table>")` is allowed ONLY for the six known tables:
          `script_sync_projects`, `script_sync_section_transcriptions`,
          `script_sync_flags`, `quill_projects`, `quill_chapters`,
          `quill_annotations`. Anything else throws + console.errors.
        - `.rpc(...)` is blocked entirely (4.0 calls zero RPCs by design).
        - `.auth` and `.storage` are untouched.
      Verified with 10 unit tests: all 6 allowed tables go through, `app_data`
      is blocked, all RPC calls are blocked, auth and storage remain
      accessible. If the guard ever fires in production, the error
      message names the offending table/function for diagnosis.

### 2026-06-01 — Quote-search typography fix + remaining tutorial anchors

- [x] **`normalizeSearchText` now collapses double-spaces left by the
      punctuation-strip step.** — completed 2026-06-01. Another AI's
      review caught it: pre-existing bug where the punctuation→space
      replace introduced internal double spaces. A PDF with "no — go"
      (em-dash with surrounding spaces) normalised to "no   go", while
      a manuscript ".docx" with "no—go" (tight em-dash) normalised to
      "no go". Substring `.includes` then failed and quote-search
      silently fell back to the slim map. Fix is a trailing
      `.replace(/\s+/g, ' ').trim()` after the punctuation strip in
      `app/lib/pdfPaging.js`. Verified: same PDF text + quote that
      failed under the old normalizer now matches under the new one.
- [x] **Tutorial steps 3, 4, 7 now have DOM anchors.** — completed
      2026-06-01. Same review found that `book-title` (step 3),
      `manuscript-upload` (step 4), and `save-book` (step 7) were
      declared in `TUTORIAL_STEPS` but never attached to any element.
      Step 3 in particular auto-checks the input value, which always
      came back empty, so the tutorial got stuck until the user
      clicked "Mark done." Added `data-tutorial="book-title"` to the
      Project name card, `data-tutorial="manuscript-upload"` to the
      Manuscript file card, and `data-tutorial="save-book"` to the
      Save button — all in `app/components/ImportFlow.js`. Same
      pattern as the step 6 (`review-chapters`) fix earlier today.

### 2026-06-01 — Duet timestamps: stopped fuzzy matcher mis-matching highlighted words

- [x] **Duet's audio matcher now actually skips highlighted words.** —
      completed 2026-06-01. Engineer reported Duet insertion-point
      timestamps were "sometimes off by a bit". Root cause: in
      `PrebuildMode.js:789` the call to `alignTranscriptToManuscript`
      passes a 4th argument `highlightedIndices` (a Set of manuscript-
      word positions that are highlighted = second-narrator dialogue
      not in the audio), but the function signature only accepted 3
      params — the 4th was silently dropped. The matcher then tried
      to find the highlighted words in the audio anyway, sometimes
      latching onto unrelated whisper words and pulling the
      surrounding path off by one or two words. Symptom: insertion
      timestamp lands just inside or just past the highlight instead
      of right before it, and only when surrounding prose isn't
      strong enough to recover the path. Fix: thread `skipMsIndices`
      through `alignTranscriptToManuscript` in `app/lib/fuzzyMatcher.js`.
      When set, the DP forces a "skip this manuscript word" move at
      those rows with no penalty (expected absence, not a gap). The
      gap-fill interpolation pass also respects the skip set so it
      doesn't re-introduce bogus matches. Backward compat: the param
      is optional; existing callers (Proof, Quill) that pass 2 args
      see zero behavior change. Verified with unit tests including
      an adversarial case where the highlighted text echoes audio
      content elsewhere — without the fix, the matcher matched the
      echoes instead of the real text; with the fix, real text wins
      and highlight markers land at the correct end-time.

### 2026-06-01 — Proof page numbers: ported PDF quote-search back from 3.0

- [x] **Proof flags now resolve page numbers by sentence, not just word
      count.** — completed 2026-06-01. Marie's chapter 51 was showing page
      1 even with 419 of 420 PDF pages numbered. Root cause: the slim
      word-index → page map drifts when any earlier chapter has a missing
      manuscript or zero word count, so the running word total stalls and
      every late chapter looks up word index ~0 = page 1. Old Script and
      Sync 3.0 didn't have this bug because it used CONTENT-based lookup:
      take the clicked sentence, search every PDF page's text for it,
      return the page that contains it. That code was deleted in 4.0 as
      "dead". Ported it back with one improvement: when a sentence
      appears on multiple PDF pages (duplicated dialogue etc), pick the
      page closest to the word-count hint instead of giving up. Also
      stopped `packages/cloud-sync/cloud-slim.js` from stripping
      `pdfPaging.pages` from the cloud copy — that was the reason 3.0
      survived weeks of disuse and 4.0 didn't. Files: `app/lib/pdfPaging.js`
      (enhanced `findPdfPageForQuote`), `app/components/ProofingReader.js`
      (wired quote-search in as primary lookup ahead of slim map),
      `packages/cloud-sync/cloud-slim.js` (stop stripping). Verified with
      5 unit tests (unique sentence, duplicate-with-hint, too-short quote
      falls back, typography normalisation including curly apostrophes
      and line breaks).

### 2026-06-01 — Duet book detail "Organise…" button (Windows folder helper)

- [x] **"Organise…" button next to "Import…" in Duet's Bulk audio card.** —
      completed 2026-06-01. Marie ships a folder of raw chapter audio to
      the engineer, but Windows sorts 1, 2, 3, 10, 11 wrong (puts 10
      before 2). She has a PowerShell one-liner that (a) copies every
      audio file longer than N minutes into a sub-folder, and (b) pads
      the leading number so 1 → 01, 2 → 02 etc. The button shows a
      centered modal with the 5-step recipe ("right-click empty space →
      Open in Terminal → paste → Enter", with the tip to change
      `$minutes = 5` to whatever she wants) plus the full PowerShell
      script in a dark code box with a Copy button. Lives in
      `app/components/SessionsView.js` (shared book detail). Only renders
      when `mode === 'duet'`. Verified in browser preview: button shows
      only in Duet, modal opens centered, Copy → "Copied ✓", Close closes,
      no console errors.

### 2026-05-29 — App-wide "don't overwrite, add (1)/(2)/(3)" on every download

- [x] **Every download in the desktop app is now collision-proof.** —
      completed 2026-05-29 (code; pending Marie hands-test in the rebuilt
      app). Marie has asked many times for this: when you save/export a
      file and that name already exists, append " (1)", " (2)", " (3)"
      instead of overwriting. `main.js` already had the exact helper
      (`uniqueExportPath`) but only the 4 IPC "Save As" exports used it;
      every renderer `<a download>` (Quill Word/CSV/InDesign, Proof CSVs,
      Prep, Prebuild CSVs, home backup JSON, ManuscriptSetup config) was
      bypassing it. Fix is ONE central hook: a `will-download` listener on
      the window session in `main.js` that routes every download through
      `uniqueExportPath` into Downloads — so it covers every tab/mode in
      one place, no per-button edits. Phone app is a real browser (auto-
      dedupes already); the 4 IPC exports already defaulted to a deduped
      name. Needs Mac + Windows release rebuilds to reach installed apps.

### 2026-05-29 — Restore Quill (Ink) Word doc export

- [x] **Quill Word doc export restored + bundle exports everything.** —
      completed 2026-05-29. The "annotated review" Word export existed in
      StJohn Author Studio 2.0 (`packages/exports/docx`) but the 4.0
      rebuild only ported the CSV + InDesign exporters, so the Word doc
      silently went missing. Added `buildAnnotationsDocxParts` /
      `buildAnnotationsDocxBlob` to `packages/quill-engine/exporters.js`
      (same OOXML/JSZip approach as Prep's `prepExport.js`): manuscript
      with each annotation highlighted in its real on-screen colour
      (lightened ~45% so text stays readable) + a real Word comment per
      annotation laid out one fact per line (Type / Label / Note). Word
      comments are anchored via commentRangeStart/End + comments.xml.
      Also fixed the bundle button in `QuillAndInkMode.js`: "Export CSV +
      InDesign" used to fire two downloads in one tick and the browser
      dropped all but the CSV. Now "Export all (.zip: Word + CSV +
      InDesign)" builds a single .zip containing all three (Marie's
      choice 2026-05-29 — one file guaranteed to hold everything, no
      risk of a dropped download). CSV + InDesign always included; Word
      added too but zip still ships if the Word build ever fails. Added a
      "Word .docx only" button. Verified: 21 sandbox
      assertions pass, generated .docx re-parses cleanly in mammoth
      (text/punctuation/paragraphs/entities intact), home route compiles
      HTTP 200. Still needs Marie to click it on a real book to fully
      confirm.

### 2026-05-26 evening — Marie's crash-out triage + Proof one-screen rebuild

- [x] **Page-shift explainer text uses Marie's exact wording.** Replaced
      the "footer / PDF page index" jargon in `ImportFlow.js` and the
      Edit-book-data nudge in `SessionsView.js` with her verbatim
      sentence: "If you open the Word document and you see that on the
      first page there isn't a number 1, but on the second page there
      is, then it needs to be shifted +1 or −1." — completed 2026-05-26
- [x] **Page-shift card slimmed to a single pill strip.** Was a tall
      card with title + input + paragraph. Now one row: label + − + N +
      with a one-line tip. — completed 2026-05-26
- [x] **Hourglass ⏳ replaced with a thin spinning ring** in 3 places —
      `ImportFlow.js` (manuscript reading), `ManuscriptSetup.js`
      (manuscript scanning), `SessionsView.js` (Restoring chip on chapter
      rows). — completed 2026-05-26
- [x] **Quill has no page-number UI anywhere.** Added `needsPageNumbers`
      prop to `ImportFlow`; Quill passes `false`. `SessionsView` gates
      the page banner and the page nudge in Edit-book-data when mode is
      `'quill'`. Quill is print-design — never needed pages. —
      completed 2026-05-26
- [x] **The duplicate "Split chapters on sub-headings" panel is gone**
      from both `ImportFlow.js` AND `ManuscriptSetup.js`. Marie asked
      for this multiple times. The structural `splitScenes` state still
      drives parsing behind the scenes; the "Show sub-headings" button
      on the chapter list is the surface the user needs. — completed
      2026-05-26
- [x] **Proof import is ONE screen now (Phase 2 eliminated).**
      `ImportFlow` got two new props: `extraStepSlot` (JSX rendered as
      Step 3 when present) and `onParsed` (fires when the docx parses
      so the parent can react). `ManuscriptSetup` now renders ImportFlow
      with the narrator-mapping panel passed as the extra step;
      `handleImportConfirm` does the final save directly. No more
      second screen. — completed 2026-05-26
- [x] **PDF wording explains both sources.** Now says "either downloaded
      from Google Docs as PDF, or saved from Word as PDF." Marie asked
      about Word's Save-as-PDF; it works fine, same format. —
      completed 2026-05-26
- [x] **Cloud safety audit brief written** at `docs/CLOUD_SAFETY_AUDIT.md`.
      A self-contained 6-section brief for an independent AI to audit
      the cloud-sync package end-to-end. Marie handed it off and got
      back results (4 bugs / 8 risks / 5 unknowns — captured in Active
      section above). — completed 2026-05-26
- [x] **Page-number 340 → 52 double-count fix.** When the PDF lookup
      returns a page whose number came from the detected printed footer
      (`source === 'printed'`), the user nudge is NO LONGER added on
      top. The nudge was being double-counted: 16 + (−12) = 4 was the
      symptom. Adjustment now only applies to inferred / word-count
      fallback paths. — completed 2026-05-26
- [x] **Flag-popup quote whitespace collapse + Sheets-row normalize.**
      `sentPlain` in `ProofingReader.js` now collapses internal whitespace
      runs to single spaces before going in the textarea, so pasting
      into Word/Sheets doesn't carry double spaces from the source .docx.
      `copySheetRow` normalizes the same way. — completed 2026-05-26
- [x] **Hard red warning when page lookup truly fails.** When BOTH the
      manuscript word-index map AND the PDF lookup can't determine a
      page, the flag popup shows a red banner + red-bordered page field.
      Marie's rule: never silently show a guess. — completed 2026-05-26

### 2026-05-25 overnight session 2 — phone v1 functionality parity

Marie's ask after seeing the deployed phone: "It's 80% there. Pull
EVERYTHING from the original Studio app phone — double-tap to highlight,
drag handles, block highlight, settings (font/size/mode/bg/etc.),
Scroll vs Page Swipe, popover matches reader width. It's already
thoroughly debugged there — pull it in, don't re-invent it." Result:

- [x] **Universal reader settings** — cog icon top-right of every
      screen opens a full-page Settings panel. Eight fields, all
      from the v1 Studio phone reference: Font (5 options), Text
      size (16–28), Reader mode (**Scroll | Page Swipe**), Line
      spacing, Margins, Paragraphs, Alignment, Background (8 swatches).
      Persisted in localStorage as `stjohn-phone-reader-settings-v1`.
      Settings apply to BOTH Quill and Script readers, settings panel
      renders as an overlay (so closing returns to the exact previous
      view). New module: `app/phone/_lib/readerSettings.js` +
      `app/phone/_components/PhoneReaderSettings.js`. — completed
      2026-05-25 (overnight 2)
- [x] **HTML-preserving reader** — replaced the naive word-span
      renderer with the v1 Studio walker. Italics, paragraphs, h2/h3
      scene-break headings, paragraph indentation all preserved.
      New module: `app/phone/_components/renderReaderContent.js`. —
      completed 2026-05-25 (overnight 2)
- [x] **Double-tap to highlight + drag handles + block highlight** —
      ported the v1 Studio phone selection model. Single tap is a
      soft tap; second tap within 420ms on the same word opens a
      selection. Two circular drag handles appear at each end; drag
      to extend. Each word segment includes its trailing whitespace,
      so consecutive selected words read as one continuous highlight
      block (not individual words). New module:
      `app/phone/_components/PhoneReader.js`. — completed 2026-05-25
      (overnight 2)
- [x] **Page Swipe reader mode** — when Reader mode is Page Swipe,
      the reader becomes a horizontal CSS-column scroll container
      with `scroll-snap-type: x mandatory`. Swipe left/right to
      flip pages. Scroll mode falls back to normal vertical scroll. —
      completed 2026-05-25 (overnight 2)
- [x] **Popover matches reader width** — annotation popover (Quill)
      and flag popover (Script) are now constrained to the reader's
      column width (centered, max 620px). No more full-viewport
      system-sheet look. — completed 2026-05-25 (overnight 2)
- [x] **Audio Sync mode** — when the desktop has transcribed a
      section (whisperAlignment with word-level timestamps), a Sync
      toggle in the phone audio dock lights up the current word as
      audio plays and auto-scrolls to keep it in view. — completed
      2026-05-25 (overnight 2)
- [x] **IndexedDB project cache + reader-location memory** — phone
      shows last-known project list instantly from cache while the
      cloud pull spins up. Last-opened chapter per project is
      remembered so reopening a project jumps straight back to where
      Marie left off. Cache is no-overwrite-with-empty (so a
      transient cloud failure can't "delete" everything). New
      module: `app/phone/_lib/projectCache.js`. — completed 2026-05-25
      (overnight 2)
- [x] **Redeployed to Vercel** — fresh build pushed. Live at
      **https://stjohn-author-studio-4.vercel.app/phone**. — completed
      2026-05-25 (overnight 2)

### 2026-05-25 overnight session — phone feature parity + desktop polish

- [x] **Visual polish — chapters page top panels.** Removed the outer
      white card that was wrapping the 3 inner pastel cards (the
      card-inside-card was wasting ~190px of vertical space). Tightened
      Audiobook timing to one row (label + Total + Left pills). Tightened
      Bulk audio to one row (label + Start-chapter select + Import button).
      Collapsed the "Manuscript / Chapters" 2-line header into a single
      tight line. Fixed the "· undefined" in the sticky-bar subtitle when
      a book has no fileName. Changed the side-nav incomplete indicator
      from a red × (read as "delete") to a quiet grey ○. The whole top
      band is now ~80px instead of ~270px — five chapters fit above the
      fold instead of three. — completed 2026-05-25 (overnight)


- [x] **Split toggle — no fake scene when chapter has no H2s.** Fixed
      in `app/components/SessionsView.js`. Battery-tested 11 edge cases
      (no h2, h2 only, multi-h2, h2 at start, h2 at end, multi-section,
      empty html, null html, missing section, attribute variants).
      All pass. — completed 2026-05-25 (overnight)
- [x] **PinnedTabPanel shared component + tab-stability hook rule.**
      Added `<PinnedTabPanel>` to `ReaderChrome.js`. Extended
      `.claude/hooks/build-checker.sh` with a soft warn (Rule 6) when
      a mode file adds new `*Tab` state + ternary content render
      without using it. — completed 2026-05-25 (overnight)
- [x] **Edit book data panel — chapter check/uncheck + mode extras.**
      Edit panel in SessionsView now has chapter checkboxes (uncheck
      to remove copyright pages etc.), mode-specific labels (Proof:
      "narrator mapping", Quill: "characters", Duet: book + chapters
      only), and a confirm prompt before destructive removals. —
      completed 2026-05-25 (overnight)
- [x] **Cloud sync for Proof Listen.** (see Active section) —
      completed 2026-05-25 (overnight)
- [x] **Phone Script mode (Proof on phone).** (see Active section) —
      completed 2026-05-25 (overnight)
- [x] **Phone CSV export.** (see Active section) — completed 2026-05-25
      (overnight)
- [x] **Phone audio playback (shared by Quill + Script).** (see Active
      section) — completed 2026-05-25 (overnight)
- [x] **Deep-dive batteries.** Sandbox + pure-function batteries for
      A1 Split toggle (11/11), A3 chapter filter (6/6), A4 audio guard
      (9/9), A4 sync helpers (6/6), A6 buildFlagsCsv (10/10). Live UI
      smoke for phone Script flow (loads, navigates, empty state).
      All passed. — completed 2026-05-25 (overnight)
- [x] **Bug-fix sweep.** Renamed shadowing `flagCount` variable in
      phone page. Added `onError` handler to PhoneAudioDock for
      unsupported audio files. Added confirm guard to chapter-removal
      save flow. — completed 2026-05-25 (overnight)

### 2026-05-24 overnight session — login + Quill + cloud-sync + phone

- [x] **Studio landing page + Supabase login** — Sign in, create
      account, forgot password, show/hide eye icon. Pastel mauve
      aesthetic to match the home. Sign-out lives at the bottom of the
      home page. Auth gate sits in front of the whole app via a
      session check in `app/page.js`. Files: new
      `app/components/LoginScreen.js`, new
      `packages/cloud-sync/account.js`, new
      `packages/cloud-sync/client.js`, gated in `app/page.js`. —
      completed 2026-05-24 (overnight)

- [x] **Shared cloud-sync package** —
      `packages/cloud-sync/` is now the single place every mode talks
      to Supabase. `client.js`, `account.js`, `audio-guard.js`
      (strips audio paths before any upload — CLAUDE.md emphasizes
      this), `quill-sync.js` (push/pull/delete for the three Quill
      tables). Re-exported from `index.js`. — completed 2026-05-24
      (overnight)

- [x] **Quill & Ink desktop mode** — Full port from the alpha.
      4-mode toggle now has Quill enabled. Home → project list →
      ImportFlow → book detail → reader. Reader has word-by-word
      rendering, drag-to-highlight, annotation popover with Image /
      Highlight / Emotion + custom emotions + custom characters,
      inline note, save with delete option. Annotation sidebar with
      jump-to. Local persistence via Electron file system
      (`read-quill-data` / `write-quill-data` handlers in `main.js`
      + `preload.js`, written to `quill-projects.json`). CSV + full
      InDesign JSX exporter ported byte-for-byte. Cloud sync fires
      after every save when signed in. Files: new
      `app/components/QuillAndInkMode.js`, new
      `packages/quill-engine/` (normalize, annotations, exporters,
      index). — completed 2026-05-24 (overnight)

- [x] **Phone scaffold** — `app/phone/page.js`. Login (reused
      LoginScreen), service picker (Quill + Proof placeholder),
      project list pulled from cloud, chapter list, chapter reader
      with tap-to-annotate. Mobile-first layout (max-width 480, sticky
      header). Annotations save to Supabase via the shared cloud-sync
      helpers. — completed 2026-05-24 (overnight)

### 2026-05-24 day session — Prep polish + export pass

- [x] **Header refactor — single nav button on the top-left** —
      previously the Back button and HomePill were fighting for the
      same screen position and the back button hid under the Mac
      traffic lights. Now there's ONE `HomeBackPill` that morphs:
      ⌂ in book detail (goes home), ← in reader (goes back to book
      detail). It sits at top:40 with custom drag region, same level
      as the 4-mode toggle on home. The `StickyTopBar` aligns to that
      row so the eye sees one continuous nav. — completed 2026-05-24

- [x] **One dialogue warning rule** — engine used to emit 7 issue
      types. Now emits one: `missing-closing-quote`, only when no
      follow-up quote within ~3 paragraphs. Marie can't see the noise
      she didn't want. — completed 2026-05-24

- [x] **Section Fixer (per-paragraph editor)** — Fix button on each
      amber warning opens just that paragraph in a textarea with an
      "Insert " here" button at the cursor. Save reruns dialogue
      detection. Edits also recorded so the export replays them. —
      completed 2026-05-24

- [x] **Header confusion fix** — reader top bar title was "Chapter 1
      of 61 · Chapter 2" because it concatenated nav position with
      source heading. Now title is just nav position; source heading
      moves to subtitle and only when it differs. Same fix applied to
      the chapter dropdown and book-detail chapter list. — completed
      2026-05-24

- [x] **Edit chapters cog** — gear button next to Chapters header.
      Toggles edit mode where each chapter row gets a trash X to
      remove it. Chapter numbers re-flow automatically. Marie can fix
      "I accidentally left a chapter in" without re-importing. —
      completed 2026-05-24

- [x] **Auto-assign on character add (in reader)** — when a dialogue
      is selected and Marie adds a new character via the chip, the
      new character is immediately assigned to that dialogue.
      `addCharacter` mints the id synchronously so the caller can
      chain. — completed 2026-05-24

- [x] **Side-voice dialogues carry inline Word comments** — for every
      dialogue assigned to a side voice, the exported .docx has a
      real Word comment with each piece of info on its own line:
      Character, Narrator, Side voice of <character>, Notes,
      [Recurring]/[One time]. Main-character lines stay clean.
      `word/comments.xml` with proper namespaces, content-types +
      rels patched, `<w:commentRangeStart>`/`<w:commentRangeEnd>`/
      `<w:commentReference>` wrapped around each dialogue run. Word
      no longer flags the file as "unreadable". — completed 2026-05-24

- [x] **Pastel palette + Prep is yellow** — `MODE_TOKENS` now has
      `pastel` (very light) + `accent` (mid-tone) + `ink` (dark) per
      mode. Solid buttons use `accent` so the UI reads as pastel-y
      instead of wine. Prep switched from green to yellow. 10-colour
      `CHARACTER_PALETTE` in Marie's preferred order. — completed
      2026-05-24

- [x] **Show sub-headings toggle in ImportFlow** — `allowSceneSplitting`
      prop. When on, Duet sees split groups; Prep keeps it off by
      default. — completed 2026-05-24

- [x] **Duplicate narrator breakdown fix** — `stripPreviousNarratorBreakdown`
      removes any previously-injected breakdown before adding the new
      one. Re-importing an exported file no longer piles up six
      copies. — completed 2026-05-24

- [x] **Fix-quote replays into the exported .docx** — paragraph edits
      from the Section Fixer are recorded on `section.manualEdits`
      and replayed onto the source XML at export time. The missing
      close-quote Marie typed in actually shows up in the downloaded
      file. — completed 2026-05-24

- [x] **`applyHighlightsInPlace` regex constrained** — the `rPr`
      capture used to backtrack across `<w:r>` boundaries when a
      dialogue text only appeared in a later paragraph, which made
      the export inject the narrator breakdown six times. Now the
      capture refuses to cross run boundaries. — completed 2026-05-24

- [x] **Next button bug — actual root cause found** — italic-mid-quote
      dialogues like `"<em>Really</em>?"` made the engine's stripHtml
      produce "Really ?" (with a space) while the reader's stripTags
      produced "Really?" (no space). indexOf returned -1, the span
      didn't render, the cursor got stuck on it, and every dialogue
      AFTER also failed to render. Fixed by importing the engine's
      `stripHtml` into the reader's `paragraphsFromHtml`. — completed
      2026-05-24

### 2026-05-23 session — Prep refactor + shared upload

- [x] **Shared `ImportFlow` for Prep + Duet** — built
      `app/components/ImportFlow.js`. Prep's old inline `SetupView`
      and Duet's `PrebuildManuscriptUpload` both deleted; both now
      render `<ImportFlow ... />`. — completed 2026-05-23

- [x] **Narrator breakdown styling** — switched from `<w:pStyle>`
      references to inline run-property styling so it renders the
      same in any source .docx. — completed 2026-05-23

### Phase 1–4 (bootstrap + base)

- [x] Create `~/Dev/StJohn-Author-Studio-4.0/` and copy Script and
      Sync 3.0 in as the base — completed 2026-05-23
- [x] Set up `.claude/` with scope-locked hooks per bible Step 2.5 —
      completed 2026-05-23
- [x] Write `CLAUDE.md` — completed 2026-05-23
- [x] `git init`, first commit, push to GitHub
      (`stjohnbuilds/stjohn-author-studio-4.0`) — completed 2026-05-23
- [x] Archive old GitHub repos + Google Drive folders — completed
      2026-05-23
- [x] Rebrand npm package, app id, productName, window title, Save
      Data folder — completed 2026-05-23
- [x] Home-screen 4-mode segmented switcher (`AppModeToggle` in
      `app/page.js`) — completed 2026-05-23
