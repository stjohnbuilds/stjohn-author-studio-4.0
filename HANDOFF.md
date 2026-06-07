# HANDOFF — StJohn Author Studio 4.0

Last refreshed: 2026-06-06. Focus: Audiobook **Breakdown** popup — character word-count attribution is missing the "plain-paragraph character name" convention.

## Copy-Paste Bootstrap For Next Chat

```text
You are continuing work on StJohn Author Studio 4.0 for Marie Mackay.

Marie is a non-coder. Plain English, short sentences. No walls of text.
No jargon. No "X% confident" — banned phrase. Always end every response
that touched files with a "Files I changed:" footer. Talk like she's 10.

Current top-priority bug:
The Breakdown popup in Proof (Audiobook breakdown) attributes most of
Marie's manuscript to "Unsure" instead of the actual character POV.
Root cause confirmed 2026-06-06: her chapters use the character name
as a STANDALONE PARAGRAPH of plain text — e.g.

  <h1>Chapter 1</h1>
  <p>Day One</p>
  <p>Vex</p>           ← character name, as a normal paragraph
  <p>I broke a dozen laws…</p>

The DOM walker in app/components/SessionsView.js
(tallyCharacterWordCountsDom) only matches character names inside
<h1>…<h6> elements. A plain <p> whose entire text is "Vex" is not
recognised, so all body text falls into the "Unsure" bucket.

The metadata-fallback I added 2026-06-06 only redirects Unsure words
when sec.characterName / sec.title / ch.characterName / ch.title
matches a mapped character. For Marie's "Chapter 1" titles, none of
those metadata fields contain the character name, so the fallback
doesn't help.

FIX TO IMPLEMENT (not yet done — Marie asked for the handover before
the fix):
Extend the heading-walker in tallyCharacterWordCountsDom to also
treat block-level elements (P / DIV) as IMPLICIT scene boundaries
WHEN their trimmed textContent is exactly a known character's name
(fuzzy nameMatches — same comparator the rest of the file uses).
That covers the standard "author drops the POV name as a one-line
paragraph at the top of each scene" manuscript convention.

The same fix should also be made in:
  • app/components/PrepManuscriptMode.js — analyzePrepChapterByCharacter
    (uses the SAME shape of walker, would have the same blind spot for
    Marie's plain-paragraph POV markers).

Read in this exact order before doing anything:
1. HANDOFF.md (this file)
2. CLAUDE.md (project rules)
3. ~/.claude/CLAUDE.md (Marie-wide rules)
4. app/components/SessionsView.js — tallyCharacterWordCountsDom +
   sectionTimingRows (the metadata-fallback I added today)
5. app/components/PrepManuscriptMode.js — analyzePrepChapterByCharacter
   (parallel walker that needs the same fix)
6. packages/manuscript-engine/chapter-plain-text/index.js
   — string-based tally (older fallback path)
```

## 1. WHO IS THE USER

Marie Mackay. Non-coder. Self-publishes audiobooks and special-edition
prints. Writes the books, narrates them, proofs the audio.

Talk like she's 10. Plain English. No jargon. No code-paste unless she
asks. Short sentences. Bullets only when truly parallel. Always end
file-touching turns with `**Files I changed:**` footer — without it
she has no way to see what shifted.

Banned phrases (her no-self-cert Stop hook will block them): "X%
confident", "self-certify", "trust me it works", "fully tested",
"verified" without evidence.

## 2. HARD RULES

- No dual-write. One source of truth per concept.
- No self-certifying anything as done — Marie reviews everything.
- Plain English in chat replies.
- "Files I changed:" footer on every file-touching turn.
- Always give the run command at the end: `cd ~/Dev/StJohn-Author-Studio-4.0 && npm start` and "paste and hit Enter".
- Bottom toolbar in the reader is sacred — do not move it.
- Double-confirm destructive actions before running.
- Never suggest stopping or pausing — keep momentum.
- Push without asking is fine. Force-push to main is NOT.
- Edits only reach Marie's installed app after `npm run release:mac` and `npm run release:win` AND copying the new .app/.exe into place. Dev mode (`npm start`) shows changes without rebuild.
- ONE component per job. Don't write fresh `BookDetail` / `ChapterReader` / `AudioDock` / `ImportFlow` / `ReaderChrome` — extend the existing ones (CLAUDE.md SHARED COMPONENTS list).
- Never create new database tables / data structures if one already exists.

## 3. READ THESE FILES (IN ORDER)

1. `HANDOFF.md` (this file)
2. `CLAUDE.md` (project rules + SHARED COMPONENTS list)
3. `~/.claude/CLAUDE.md` (Marie-wide rules)
4. `app/components/SessionsView.js` — focus on:
   - `tallyCharacterWordCountsDom` (~line 450 area) — the DOM walker that needs the plain-paragraph extension
   - `sectionTimingRows` useMemo — emits rows; has a metadata-fallback added 2026-06-06
   - `durationSummary` useMemo — aggregates by character / narrator / words / time
   - The Breakdown popup body inside `{showTimingDetails && …}`
5. `app/components/PrepManuscriptMode.js` — `analyzePrepChapterByCharacter` (same blind spot for Marie's manuscripts)
6. `packages/manuscript-engine/chapter-plain-text/index.js` — string-based `tallyCharacterWordCounts` (defence-in-depth fallback path)

## 4. BROAD VISION

THE DREAM: one desktop app + one phone companion for Marie's
self-published audiobook + print workflow. Four desktop modes (Proof
Listen, Prep Manuscript, Duet Prep, Quill & Ink), two phone modes
(Script, Quill), one shared reader brain, one shared cloud-sync. Audio
stays local (never uploaded). One mode-switching home. No fake data.

## 5. CURRENT STATE

- Build state: clean. 127/127 unit tests pass.
- Latest commit pushed: `29ecc39` — Proof breakdown metadata fallback.
- Mac + Windows packaged 2026-06-06 ~13:45, in `Script and Sync Releases/`
  - `StJohn Author Studio.app` (ad-hoc signed, xattrs cleared)
  - `StJohn Author Studio Setup.exe` (~301 MB)
- Audiobook Breakdown popup: pill rows with dot + name + time + word
  count + percent. Shows every character mapped in `book.narratorColors`
  even when detection found zero words for them. Sort is by words
  (tiebreaker: seconds).
- Prep Breakdown popup added today: same shape, sourced from
  `analyzePrepChapterByCharacter`. Chapter rows show colored character
  pills with per-chapter word counts ("Crescent · 1,200").
- See Errors popup: in-paragraph yellow highlight + amber word-follow
  while audio plays. Sticky bottom stack (Comment + Player + Prev/Next).
- "Markers from CSV": position-based parser (column names ignored);
  output is byte-identical to "Export for Engineer" Marker_[…].csv
  format; merges saved-flag markers with the CSV.

CURRENT BUG (focus of this handover):
- Marie's Proof book "Anarchy / Vex" shows the breakdown at
  108,108w / 100% "Unsure", with mapped characters at 0w / 0.0%.
  Cause confirmed: her chapters use POV character name as plain `<p>`
  text, not as a heading element. Walker only checks H1-H6. Fix is to
  also recognise block-level (P / DIV) elements whose entire trimmed
  text equals a known character's name. See the Copy-Paste bootstrap
  above for the exact mechanic. ~30-line change. Must mirror the same
  fix into `analyzePrepChapterByCharacter` in PrepManuscriptMode.js.

## 6. TOP 5 NEXT JOBS

In priority order. Effort tags: Easy / Marie / Design call /
Big multi-week.

1. **Plain-paragraph POV-name detection in the breakdown walker.**
   Easy code. Touch `tallyCharacterWordCountsDom` in SessionsView and
   `analyzePrepChapterByCharacter` in PrepManuscriptMode. When walking
   the off-screen DOM, treat any block-level element (`P`, `DIV`,
   `H1-6`) whose trimmed textContent is *exactly* a character name
   (via `nameMatches`) as an implicit scene boundary. Add a regression
   test using the `<p>Vex</p>` shape.

2. **Consolidate the two character-tally implementations.** Easy code.
   There are now two near-parallel walkers — Proof's
   `tallyCharacterWordCountsDom` (color + heading) and Prep's
   `analyzePrepChapterByCharacter` (heading only). Factor the heading-
   walker into a single shared helper in
   `packages/manuscript-engine/chapter-plain-text/` (or a new
   `app/lib/`-level module). Both modes call it; Proof layers its color
   pass on top. Tests stay near the helper.

3. **First-launch "pathway not found" popup on Mac + Windows.** Marie +
   Easy. Hasn't been reproduced this session — Marie said it appeared
   once on install, vanished on second run, and she couldn't recreate
   it to screenshot. NOT a code-signing warning (her words). Build
   pipeline already does `xattr -cr` + `codesign --force --deep --sign
   -` post-build. Needs the exact error wording next time it appears
   to pinpoint the missing path.

4. **Audio "Re-select audio" persistence.** Marie + Easy code, high-risk
   surface area. `URL.createObjectURL` is session-scoped, so the
   audio's playable URL is lost every reload — only the filename is
   saved. Proper fix: persist a real filesystem path (or use Electron's
   stable file:// protocol) so audio reattaches automatically.

5. **Phone test-first items.** Marie. Live phone tests against a safe
   Supabase account. Recipes in
   `docs/audits/STJOHN_FIX_PLAN_VERIFICATION_REPORT.md` Block 8.

## 7. WHAT ONLY MARIE CAN DO

- Approve each code-edit block (per-block, never bulk).
- Live phone tests on her actual phone with a safe Supabase account.
- Visual verification in real Word / Adobe Audition / InDesign of the
  export output.
- Push authorisation for anything destructive.
- Pick between alternatives where there is no obviously-correct answer
  (e.g. minimal one-line fix vs full architectural refactor).
- Supply real manuscripts / real audio when needed for repro.
- Sign packaged builds (Apple Developer ID / Windows EV cert) — not
  done yet; first-launch warnings are the cost of that being unset.

## 8. WHERE THINGS LIVE

```
~/Dev/StJohn-Author-Studio-4.0/
├── app/
│   ├── page.js                          ← Proof shell, mode switch
│   ├── phone/page.js                    ← Phone Script + Quill
│   ├── components/
│   │   ├── SessionsView.js              ← Proof book detail + Audiobook
│   │   │                                  breakdown popup + Make markers
│   │   │                                  from CSV + See errors button.
│   │   │                                  tallyCharacterWordCountsDom is
│   │   │                                  HERE — needs the plain-<p>
│   │   │                                  POV-name extension.
│   │   ├── CheckErrorsDialog.js         ← See errors popup
│   │   ├── ProofingReader.js            ← Proof reader, audio sync
│   │   ├── PrepManuscriptMode.js        ← Prep mode + analyzePrepChapter
│   │   │                                  ByCharacter (also needs the
│   │   │                                  plain-<p> extension)
│   │   ├── PrebuildMode.js              ← Duet
│   │   ├── QuillAndInkMode.js           ← Quill
│   │   ├── BookDetail.js                ← SHARED book detail chrome
│   │   ├── ChapterReader.js             ← SHARED reader (Quill uses it)
│   │   ├── AudioDock.js                 ← SHARED player
│   │   ├── AppDialog.js                 ← SHARED modal primitive
│   │   ├── ImportFlow.js                ← SHARED .docx import
│   │   ├── ReaderChrome.js              ← MODE_TOKENS, sticky top bar
│   │   └── icons.js                     ← line SVG icons (no emojis)
│   └── lib/
│       ├── csvFlagImport.js             ← position-based CSV parser
│       ├── csvAuditionMarkers.js        ← writes Marker_[…].csv per
│       │                                  chapter, merges saved flags
│       └── narratorSpeedMemory.js       ← per-narrator playback memory
├── packages/
│   ├── cloud-sync/                      ← Supabase + slim push/pull
│   ├── audio-engine/                    ← whisper-json, sync table,
│   │                                      formatAuditionTime
│   ├── manuscript-engine/
│   │   ├── chapter-plain-text/index.js  ← string-based tally (older
│   │   │                                  fallback) + plain-text index
│   │   ├── dialogue-detection/          ← used by Prep
│   │   └── …
│   └── quill-engine/
├── main.js                              ← Electron main
├── preload.js                           ← Electron bridge
├── electron-builder.yml                 ← Build config
├── tests/                               ← 127 tests, node:test
└── Script and Sync Releases/
    ├── StJohn Author Studio.app         ← latest Mac build (2026-06-06)
    └── StJohn Author Studio Setup.exe   ← latest Win build (2026-06-06)
```

### Commands Marie actually uses (paste-ready)

```bash
# Dev mode (fast iteration)
cd ~/Dev/StJohn-Author-Studio-4.0 && npm start

# Run the tests
cd ~/Dev/StJohn-Author-Studio-4.0 && npm test

# Build Mac app
cd ~/Dev/StJohn-Author-Studio-4.0 && npm run release:mac

# Build Windows installer (on the Mac via Wine)
cd ~/Dev/StJohn-Author-Studio-4.0 && npm run release:win
```

---

This is a handover doc. If you're a fresh AI reading this: the
ONE-LINE fix Marie is waiting on is in TOP 5 NEXT JOBS #1 — extend
the breakdown walker to recognise `<p>Vex</p>` as a scene boundary.
Mirror the change into PrepManuscriptMode. Then she can see her
characters' word counts properly.
