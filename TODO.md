# TODO — StJohn Author Studio 4.0

Active and archived tasks. Cleaned up after the overnight 2026-05-24
session. New work goes under **Active**. Completed work moves to
**Archived** with a date.

Format: `- [x] Task name — completed YYYY-MM-DD`. Never leave a task as
2–3 words. Add context.

Always read `HANDOFF.md` first, then this file.

---

## Active

### Marie's morning testing checklist (do these in order)

- [ ] **Sign in.** Supabase is already wired to your existing
      project (`evcusovtjfypfyfvnooy`). Use the same email/password you
      use for your other apps in that Supabase. If you don't remember,
      use "Forgot password" to reset.
- [ ] **Look at the four mode colours.** Flip between Proof / Prep /
      Duet / Quill. Each one should wear its own pastel colour, not
      purple. Card headers should be flat, not a fade-to-white.
- [ ] **Open a real Proof audiobook.** The book detail page was just
      rebuilt to use the shared component. Walk through your usual
      flow — confirm the title, action buttons, chapter list, audio
      panels, and delete still work like before. If anything looks off
      or behaves differently, tell me before I tackle the next big
      migration (the reader itself).
- [ ] **Try Quill on a real .docx.** Top-left mode toggle → Quill. New
      project → upload a manuscript. Open a chapter. Drag across a few
      words, tap the pink + button, pick a class, save. Verify the
      pink underline appears + the annotation shows in the sidebar.
- [ ] **Test the InDesign export.** Book detail → Export CSV +
      InDesign. Open the .jsx in InDesign and run it against the
      matching layout. Eyes-on check: are character styles created?
      Are highlights underlined? Marie is the only one who knows what
      "right" looks like for her print workflow.
- [ ] **Test the phone scaffold.** Browser to `http://localhost:3000/phone`
      while `npm run dev` is running. Sign in with the same account.
      Quill project from the desktop should appear. Open a chapter,
      tap a word, add an annotation. Reload the desktop — annotation
      should appear there too. (Cloud round-trip confirmation.)

### Next up after Marie's checklist

- [ ] **Cloud sync for Proof Listen.** Wire `script_sync_projects`,
      `script_sync_section_transcriptions`, `script_sync_flags`. Same
      pattern as `packages/cloud-sync/quill-sync.js`. Audio paths
      stripped per the guard. Flags from the phone (when Script-mode
      flag-tapping is built) write here.

- [ ] **Phone Script mode (Proof Listen on phone).** Phone scaffold
      has the Quill flow only. Script mode needs: project list from
      `script_sync_projects`, chapter view with transcript text, local
      audio picker (audio stays on phone — only the filename goes to
      the cloud), tap-to-flag with a timestamp from the audio
      position, save to `script_sync_flags`. Reference:
      `/Users/.../StJohn Author Apps/apps/phone - ARCHIVED 2026-05-23/app/script-and-sync-service.js`.

- [ ] **Phone CSV export.** Button on the phone that downloads the
      flags or annotations for the current project as a CSV. The
      desktop has `packages/quill-engine/exporters.js` →
      `buildAnnotationsCsv` already; phone can call it directly.

- [ ] **Phone audio playback in Quill mode.** Tap the music icon, pick
      a local audio file, listen while annotating. Audio stays on the
      phone. Reference: alpha `phone/app/phone-audio-dock.jsx` and
      `phone-audio-library.js`.

- [ ] **Deploy phone to Vercel.** Once the phone is feature-complete
      enough for Marie to use, push it live. `vercel.json` may need a
      route rewrite so `/phone` is the root for the deployed phone
      project (or use a separate Vercel project pointing at the same
      Next.js build).

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

### URGENT — Full app unification (master plan, multi-turn execution)

**The mandate, in Marie's words:** ONE system. ONE BookDetail. ONE reader.
ONE audio engine. ONE set of panels. Mode just changes the verb
(flag / annotate / duet-mark / dialogue-tag). **Pull Proof's existing
modules INTO shared packages — do not rebuild "similar" versions.**
Visual = Quill's flat clean look (no gradients). Quill gains audio +
narrators + audiobook timing + bulk-chapter-audio + transcription queue
by rendering the SAME components Proof renders.

**Annotation list in Quill once the bottom is the audio dock:** a popout
button in the top dock (next to the chapter dropdown). Same button slot
Proof uses for its top controls. Simple.

**Prep stays separate** (no audio, dialogue-span model, different
feature surface). **Duet's reader stays separate** (block-display, not
word-interactive). Everything else unifies.

#### Phase A — Extract the reusable Proof modules (low/medium risk)

These come out of `ProofingReader.js` (1546 lines) and `SessionsView.js`
(2385 lines) as standalone shared modules. Extract IN PLACE — Proof
keeps working by importing the new modules itself.

- [ ] **A1. Extract audio engine** → `packages/audio-engine/index.js`.
      Exports: `createAudioEngine(audioEl, onTimeUpdate)`,
      `buildSyncTable(whisperAlignment)`,
      `getMsIdxAtTime(table, time, fallback)`. Source:
      ProofingReader.js lines 234-270 + 465-599. Risk: HIGH (deep
      whisper coupling). Test by confirming Proof still syncs after
      extraction.

- [ ] **A2. Extract `<AudioDock>`** → `app/components/AudioDock.js`.
      The bottom bar: native `<audio>` element + speed slider + jump
      chips (±10s / ±30s) + Follow-text toggle + transcription "T"
      toggle + flag "F" button (optional via slot). Source:
      ProofingReader.js lines 1401-1460. Risk: MEDIUM. Props:
      `{audioRef, listenSpeed, onListenSpeedChange, hasTranscription,
      useWhisperSync, onWhisperSyncChange, followPlayback,
      onFollowPlaybackChange, extraButtons?}`.

- [ ] **A3. Extract `<FlagForm>`** → `app/components/FlagForm.js`.
      Marie hasn't asked Quill to flag (Quill annotates), but Proof's
      flag form is the canonical "capture-at-audio-time" pattern.
      Source: ProofingReader.js lines 956-1029 + 1347-1395. Risk:
      HIGH (Sheets row build, narrator coupling).

- [ ] **A4. Extract `<ChapterSearchBar>`** →
      `app/components/ChapterSearchBar.js` + `app/lib/chapterSearch.js`.
      Ctrl/⌘+F live search inside the reader. Source:
      ProofingReader.js 482-486 + 1085-1124 + 1410-1430. Risk: LOW.

- [ ] **A5. Extract `<NarratorPanel>`** →
      `app/components/NarratorPanel.js`. Character color picker +
      narrator-name management. Source: SessionsView.js 1755-2000.
      Props: `{narratorColors, onNarratorColorsChange, sections}`.
      Risk: MEDIUM.

- [ ] **A6. Extract `<AudiobookTimingPanel>`** →
      `app/components/AudiobookTimingPanel.js`. Read-only per-chapter
      timing grid. Source: SessionsView.js 1755-1810. Risk: LOW.

- [ ] **A7. Extract `<BulkAudioPanel>`** →
      `app/components/BulkAudioPanel.js`. Folder-pick + per-chapter
      audio file attach. Source: SessionsView.js 2009-2100. Props:
      `{chapters, onAttachAudio}`. Risk: MEDIUM (file I/O).

- [ ] **A8. Extract `<TranscriptionQueueIndicator>`** →
      `app/components/TranscriptionQueueIndicator.js`. Status pill per
      chapter (queued / running / done). Source: SessionsView.js
      1334-1337 + 2082-2107. Risk: LOW.

#### Phase B — Extend shared `BookDetail` v2 to host all panels

- [ ] **B1. Add panel slots to BookDetail.** New props: `narratorPanel`,
      `audiobookTimingPanel`, `bulkAudioPanel`, `transcriptionQueue`.
      All optional. They render above the chapter list in the
      `prePanels` area; ordering driven by an array prop so each mode
      picks what's visible. Keep the flat look (no gradient).

- [ ] **B2. Add `audioPanel` slot to `ChapterRow`.** Per-chapter audio
      status (attached/missing) + transcription state pill + scan
      button. Existing `rightControls` slot covers it — verify and
      document.

#### Phase C — Migrate the modes onto the unified surface

- [ ] **C1. Migrate Proof's `SessionsView` to render shared
      `BookDetail` v2** with the extracted panels (NarratorPanel,
      AudiobookTimingPanel, BulkAudioPanel, TranscriptionQueueIndicator).
      Delete the inline panel code. Proof becomes the smallest mode
      file. **Risk: HIGH — anchor mode.** Real-file test pass after.

- [ ] **C2. Migrate Quill to render the same BookDetail v2.** Quill
      *gains* the audio attach + narrators + audiobook timing + bulk
      audio panels for free. Annotation export buttons live in
      `actionButtons` slot.

- [ ] **C3. Migrate Duet to render the same BookDetail v2.**
      Custom chapter rows stay (audio-status + merge controls) but
      everything else is shared. Audio-attach replaced by shared
      `BulkAudioPanel`.

- [ ] **C4. Migrate Proof's reader to `<ChapterReader>`** + shared
      `<AudioDock>` bottom slot. Already pending in earlier plan as
      Step 4; lands here as part of the bigger unification.

- [ ] **C5. Add `<AudioDock>` to Quill's reader.** ChapterReader's
      bottom-dock slot accepts the AudioDock when Quill has audio
      attached. When no audio, dock is empty. Annotation list moves
      to a popout button in the top dock (next to chapter dropdown)
      — opens a side popover listing chapter annotations with
      jump-to.

- [ ] **C6. Migrate Proof's `BookSetup`** (ManuscriptSetup.js, 1027
      lines) to render shared `<ImportFlow>` plus the Proof-only
      add-on panels (PDF paging, narrator color mapping). Last
      duplicate of the upload flow.

#### Phase D — Visual + interaction polish

- [ ] **D1. Kill the cream-to-white gradient** everywhere.
      `READER_PAGE_BG` becomes a flat cream. Search for `linear-gradient(180deg, #fbfaf7` and replace with flat. Card backgrounds use flat white or `rgba(255,255,255,0.86)`.

- [ ] **D2. Fix per-word highlight band → continuous underline.**
      Currently each word's `borderBottom: 3px solid` draws an
      underline that stops at the space between words, so the
      annotation reads as N broken stripes. Fix in
      `ChapterReader.js` `renderUnit`: render the underline as a
      continuous element OR use `text-decoration: underline` on a
      wrapping span across the whole range OR use `box-shadow`
      that bleeds into the trailing space.

- [ ] **D3. Fix image-annotation red → pink (or purple).**
      `QuillAndInkMode.js` `unitDecoration` callback: change
      `background: '#d8282822'; color: '#7a1818'` to a pastel pink
      / purple from `MODE_TOKENS.quill`.

- [ ] **D4. Fix top banner blocking reader content.**
      `ChapterReader.js` paper container `padding: '20px 0 ...'`
      isn't enough — sticky bar height is ~54px so the first lines
      of the chapter hide under it. Bump top padding to clear it.

- [ ] **D5. Track down Duet upload purple-chip leak.**
      `ImportFlow.js` uses `accent` prop. Duet must be passing
      `MODE_TOKENS.proof.accent` somewhere instead of
      `MODE_TOKENS.duet.accent`. Audit `PrebuildMode.js` for stray
      proof tokens.

#### Phase E — Lock it in

- [ ] **E1. Replace every `window.confirm()` with shared
      `<ConfirmDialog />`.** 9 calls total: BookDetail (1),
      PrebuildMode (4), PrepManuscriptMode (3), SessionsView (1).
      Themed modal that uses the mode tone.

- [ ] **E2. Tighten build-checker hook** with new patterns:
      block new inline `function .*Narrator(`, `function .*Audio(`,
      `function .*FlagForm(`, `function .*Queue(` in mode files
      without the matching shared-component import. Same
      git-diff-aware approach.

- [ ] **E3. Update `docs/SHARED_COMPONENTS.md`** with every new
      shared module (AudioDock, FlagForm, ChapterSearchBar,
      NarratorPanel, AudiobookTimingPanel, BulkAudioPanel,
      TranscriptionQueueIndicator, ConfirmDialog) and which modes
      use each.

- [ ] **E4. Real-file end-to-end test pass** (Marie's). Open each
      mode on a real book + audiobook, walk through the full
      workflow she actually does. Any regression → fix in the
      shared module, not in the mode file.

#### Original reader-unification section (the smaller plan from earlier)



**Why this is urgent:** Marie has flagged this many times. The four
mode files each render manuscript text their own way (`ProofingReader.js`,
`SectionBody` inside `PrepManuscriptMode.js`, inline reader in
`PrebuildMode.js`, `QuillReaderView` inside `QuillAndInkMode.js`).
Bug-fixing any one of them now means re-doing the same fix in three
other places, and then doing it AGAIN after we unify. We unify first,
then bug-fix once.

What's actually different across the four readers (audit done
2026-05-24):

|  | Shared today? |
|---|---|
| Sticky chrome (top bar, save badge) | Yes — `ReaderChrome.StickyTopBar` |
| Paper container, font, line-height | Yes — `READER_WIDTH`, `READER_PAGE_BG` (Quill + Prep use it; Proof + Duet don't yet) |
| HTML walker (parse manuscript blocks) | **No — 4 inline copies** |
| Word splitter (regex `[A-Za-z0-9']+`) | **No — 4 inline copies** |
| "Word as button" render | **No — 4 inline copies** |
| Selection state + floating action button | **No — Quill has it, others differ** |
| How a word LOOKS when annotated | Yes, differs per mode (highlight / flag pin / underline) — needs a `renderWord` callback |
| What CLICK does on a word | Yes, differs per mode — needs interaction callbacks |
| Bottom dock content | Yes, differs per mode — slot |
| Selection unit (word vs dialogue span) | Yes, **Prep is the outlier** (operates on dialogue spans, not words) |

Effort estimate: ~400 lines new (`ChapterReader.js`), ~150 lines deleted
per mode = net code reduction. ~3-4 focused hours plus testing.

Risk ranking (do in this order — lowest risk first, anchor mode last):

- [x] **Step 1 — Extract `<ChapterReader>` primitive.** New file
      `app/components/ChapterReader.js`. Owns: shell (sticky bar slot,
      paper container at READER_WIDTH, top action slot, bottom dock
      slot), HTML walker (recursive renderNode for p / h1-h6 /
      blockquote / ul / ol / li / strong / em / br), word splitter
      (default = regex; configurable via `splitUnits(text)` prop so
      Prep can pass its dialogue-span splitter), word-as-button render
      with `data-word-index` attr, selection state (`{ start, end }`),
      floating action-button overlay anchored to the line's left
      margin (port `computeSelectionActionPos` from QuillAndInkMode).
      Props: `tone`, `chapter`, `chapters`, `chapterIndex`,
      `onChangeChapter`, `usesCustomDragRegion`, `wordDecorations` (Map
      of word index → { background, borderBottom, color, etc.}),
      `renderWordOverlay?` (optional per-word overlay JSX),
      `onWordPointerDown`, `onWordPointerEnter`, `onSelectionAction`
      (fired when user clicks the +/✎ button), `actionButtonIcon`,
      `topActions` (slot), `bottomDock` (slot), `onBack`.
      **No mode migrations in this step** — just build the primitive +
      a smoke test that renders some HTML.

- [x] **Step 2 — Migrate Quill** to use `<ChapterReader>`. Lowest risk
      because Quill was just rewired and the primitive's API was
      designed from Quill's shape. Delete `renderChapterAsWords` +
      word selection state from `QuillAndInkMode.js`. Keep
      mode-specific: annotation popover, annotation save/delete,
      cloud sync, bottom annotation dock. Re-test on a real .docx:
      drag-select multi-word, + in left margin, popover, edit existing
      annotation, dock chip jump-to, CSV + InDesign export. If anything
      regresses, the primitive needs more API surface — fix in
      ChapterReader, not in Quill.

- [x] **Step 3 — Migrate Duet** — SKIPPED. Duet's reader is read-only
      block-highlight display (multi-word contiguous spans with
      insertion-time labels), not a word-drag-select reader. Forcing
      it into `<ChapterReader>` would require a separate block-render
      mode that bloats the primitive. Same structural-difference
      reasoning as Prep. Duet keeps its own reader permanently unless
      it grows interactive features later.

- [ ] **Step 4 — Migrate Proof** to use `<ChapterReader>`. **Highest
      risk — Marie's anchor mode that has been working since v3.0.**
      Proof's `ProofingReader.js` couples word render tightly to
      whisper alignment timing. Plan: keep audio-sync state in
      ProofingReader; compute `wordDecorations` per render so the
      synced word lights up; pass `onWordClick` that opens flag form
      at `audio.currentTime`. Flag pin rendering uses
      `renderWordOverlay`. Search-inside-chapter (Proof-only) gets a
      `searchMatches` decoration. **Full real-file test pass after**:
      transcribe + sync, flag save, flag list, audio dock, search,
      chapter prev/next, persistent audio across chapter changes.

**Prep stays on its own reader** — the dialogue-span model (operates on
detected dialogue chunks, not individual words) is structurally
different from word-drag-select. Forcing it into ChapterReader would
fork the primitive. Same reasoning as Prep keeping its own
`BookDetailView` instead of using shared `BookDetail`. If Marie wants
Prep merged in too later, ChapterReader gains a `splitUnits` prop.

- [x] **Step 6 — Update docs and CLAUDE.md.** ChapterReader added to
      `docs/SHARED_COMPONENTS.md` as the canonical reader. "What's NOT
      shared yet → Reader" bullet rewritten to scope to just the
      pending Proof migration. CLAUDE.md architecture rule #1 rewritten
      to point at `app/components/ChapterReader.js` and explain why
      Prep and Duet are intentionally separate.

- [x] **Step 7 — Tighten build-checker hook.** Hook now hard-blocks
      newly added `function .*Reader(` / `renderChapter*` /
      `renderWord*` in mode files that don't import
      `./ChapterReader`. Same git-diff-aware approach as the existing
      BookDetail / HomeView guard.

- [ ] **Step 8 — Real-file end-to-end test pass.** Marie opens each
      mode on a real book + manuscript, walks through the full
      workflow she actually does:
      - **Proof:** sign in, open book, attach audio, transcribe,
        listen-along, flag a real mistake, save, see flag in list.
      - **Prep:** open manuscript, assign characters to dialogue
        across a chapter, add a side voice, export .docx with inline
        comments, open in Word.
      - **Duet:** open manuscript, attach audio, scan, place duet
        markers at correct timestamps.
      - **Quill:** drag-select, add Image/Highlight/Emotion annotation
        with character markers, save, export CSV + InDesign .jsx, run
        the .jsx in InDesign against a real layout.
      Any regression → fix in ChapterReader, not in mode files.

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

### Same-source consolidation pass (Marie's "fix once, fixed everywhere")

These came out of the 2026-05-24 session where Marie said every mode's
"click into a book" page looks different and pointed at the same root
cause every time: each mode has its own copy. The shared
`app/components/BookDetail.js` + `ChapterRow` now exists (Quill uses
it). The rest of the consolidation:

- [ ] **Refactor Duet's view==='project' to render shared
      `BookDetail`.** `PrebuildMode.js` lines ~490-1480 are ~1000
      lines of audio/scan/merge UI. Strategy: keep chapter-row
      rendering custom (audio status + scan buttons), move the outer
      title bar, action row and delete button into `<BookDetail
      tone="duet" actionButtons={...} prePanels={ReadyNavigator} />`.

- [ ] **Refactor Proof's `SessionsView.js` to render shared
      `BookDetail`.** SessionsView is 2385 lines — biggest single
      component. Audio dock, transcription queue, narrator color
      picker, reupload preview all live in there. Strategy: same
      as Duet — keep audio/queue panels in the prePanels slot, swap
      outer chrome to `<BookDetail tone="proof" />`. Higher risk
      because Proof is the anchor mode that works. Test pass on a
      real book required after.

- [ ] **Unify the reader.** Four files render manuscript text their
      own way: `ProofingReader.js`, `SectionBody` inside
      `PrepManuscriptMode.js`, inline reader in `PrebuildMode.js`,
      `QuillReaderView` inside `QuillAndInkMode.js`. Plan: extract a
      shared `ChapterPaper` (sticky bar + paper container at
      `READER_WIDTH`) and a shared word-render primitive that takes
      per-mode `renderWord` + interaction callbacks. Modes pass their
      own selection / highlight / annotation logic as props. This is
      the single highest-leverage refactor left in the project.

- [ ] **Extract shared `ModeHome` (project library) component.** Each
      mode has its own home view (project cards + "+ New" button).
      Quill's is the simplest baseline. Same pattern as BookDetail:
      take title + accent + project list + onNew/onOpen handlers.

- [ ] **Replace `window.confirm()` with a shared `<ConfirmDialog />`.**
      Every mode uses native confirm. A shared themed dialog would
      look consistent and not look like a browser alert.

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
