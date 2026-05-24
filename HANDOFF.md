# HANDOFF — StJohn Author Studio 4.0 — 2026-05-23

If you're a fresh Claude session opening this folder: **read this file first**, then `CLAUDE.md`, then `docs/BUILD_PLAN_V4.md`, then `TODO.md`. Then read this user-state section before you touch any code.

---

## 1. Read Marie first, code second

Marie is the user. She is **non-technical**, she is **exhausted** with this app (it's her fourth attempt — three previous attempts ended in disasters), and she has been giving the previous Claude session very clear feedback that kept getting half-fixed. She has explicitly said:

- "Talk to me like I'm 10. No code-speak. 3-5 short bullets."
- "Just do the work. Don't check in between passes. Only interrupt for things only I can decide (Supabase creds, a real design fork, hard blockers)."
- "Use shared engines. Don't duplicate code. If you fix something, it should fix everywhere."
- "A feature is done when I click it on a real file. Tests passing is not enough."

Two memory notes live at `/Users/mariemackay/.claude/projects/-Users-mariemackay-Dev-StJohn-Author-Studio-2-0/memory/`:
- `feedback_plain_speak.md`
- `feedback_just_build.md`

Read both before the first turn.

---

## 2. What this app is, in plain English

One desktop app + one phone companion for self-published audiobook + print prep. **Four desktop modes**, **two phone modes**, **one shared brain**.

- **Proof Listen** — listen to audio against a manuscript, flag mistakes for the engineer.
- **Prep Manuscript** — tag every dialogue line with a character + narrator (and side voice variants) before recording. Export a highlighted Word doc + narrator chapter list.
- **Duet Prep** — find duet / engineer markers.
- **Quill & Ink** — annotate a manuscript for special-edition print (InDesign export).
- **Phone Script** — tap to flag while listening; flags sync to cloud.
- **Phone Quill** — tap to annotate while reading; annotations sync to cloud.

**Hard rules:**
- Audio NEVER goes to Supabase. Audio stays on whichever device played it.
- One shared reader, one shared cloud-sync, one shared manuscript-engine, one shared audio-engine.
- No fake sample data.
- All four modes look and feel like one app.

Full source of truth: `CLAUDE.md`.

---

## 3. Where we are right now (2026-05-23)

| Mode | Status |
|---|---|
| Proof Listen | **Inherited working from Script and Sync 3.0.** Not touched yet. |
| Prep Manuscript | **Mostly built, lots of polish issues. See §5.** |
| Duet Prep | Uses the existing "Duet Audio Prep" mode from SaS 3.0 base. Not extended. |
| Quill & Ink | **Not built. Coming Soon screen.** |
| Phone | **Not built.** Reference exists in `~/Library/CloudStorage/.../StJohn Author Apps/apps/phone - ARCHIVED 2026-05-23`. Needs Supabase env vars from Marie. |
| Studio landing (4-mode picker home) | **Not built.** Logged in `TODO.md`. |

Repo: `github.com/stjohnbuilds/stjohn-author-studio-4.0` (private). Push freely.

Working tree at handoff: clean (everything committed + pushed up through Prep v6.6).

---

## 4. Architecture map (already in place)

### Shared chrome (use these — don't reinvent)

`app/components/ReaderChrome.js`:
- `READER_WIDTH`, `READER_PAGE_BG`, `READER_FONT_SIZE`, `READER_LINE_HEIGHT`, `HOME_CONTAINER`
- `MODE_TOKENS` — pastel + ink per mode (proof/prep/duet/quill)
- `ChapterContextPill` — small uppercase pill (matches the Proof reader pattern)
- `SaveBadge` — green dot + label
- `StickyTopBar` — three-column grid with centered title (Back · centered title · controls)
- `HomePill` — the "⌂ Home" pill that replaces the 4-mode switcher inside a project
- `topBtnStyle`, `pillBtnStyle` — button factories per tone
- `useDismissable(open, onClose, ignoreRef)` — close popovers on outside-click + Escape

`app/components/PrepManuscriptMode.js` already imports from there. ProofingReader.js and PrebuildMode.js have their own inline copies of these patterns — **migrating them to ReaderChrome is a TODO** (`docs/TODO.md`).

### Shared engines (`packages/manuscript-engine/`)

Ported from 2.0. Pure JS modules.
- `text-normalize/` — escaping, word display
- `word-import/` — `parseManuscriptStructure(html, { chapterLevel: 1 })` + `applyChapterNumbers`
- `dialogue-detection/` — handles **curly AND straight quotes** (tests prove this)
- `dialogue-safety-check/` — reports unterminated/uneven quotes etc.

### Prep mode data shape

```
project = {
  id, title, fileName, importedAt, updatedAt,
  sourceDocxBase64,   // ORIGINAL .docx bytes — used by export to patch in place
  characters: [{ id, name, narratorName, colorHex, sideVoices: [...] }],
  chapters: [{
    id, chapterIndex, chapterNumber, title,
    sections: [{
      id, sectionIndex, title, html,
      dialogueSpans: [{ id, text, afterText, characterId, sideVoiceId, issueCount, issueTopMessage }],
      safetyIssues: [...], totalQuoteMarks, quoteMarksEven, scanning,
    }]
  }]
}
```

Persisted via Electron IPC `read-prep-data` / `write-prep-data` →
`prep-manuscript-projects.json` in the Save Data folder.

`isCompatiblePrepProject(p)` discards any older saved shape silently
so Marie isn't forced to re-import when the schema bumps.

---

## 5. What Marie said in her last testing pass (the things to fix NEXT)

These are direct asks. Don't drop any of them.

### A. Dialogue safety warnings — too aggressive / wrong

> "The only time there should be a fucking flag is when there is an unfinished quotation mark, within a reasonable amount of space. So if there's one quotation mark and there isn't another one in a couple of paragraphs, flag it for it to be checked."

The engine currently emits these warning types (and Prep filters to a meaningful set in `detectSectionSpans` → `MEANINGFUL_ISSUE_TYPES`):

- `missing-closing-quote`
- `closing-quote-without-opening`
- `uneven-quotes`
- `nested-or-multi-paragraph-dialogue`

What Marie actually wants: only flag an UNTERMINATED quote where the next quote mark is "more than a couple of paragraphs away." Right now even short un-closed quotes within a paragraph get flagged. Tighten this:
- In the detector (or as a post-filter): only keep `missing-closing-quote` / `uneven-quotes` if the gap to the next quote is > N paragraphs (~2-3).
- Drop `nested-or-multi-paragraph-dialogue` entirely unless she asks for it back.

### B. Need a way to INSERT a quote mark inline

> "I need a way to insert the quotation mark so that it doesn't, like, get fucked up. You know? Like, I'm not reuploading the whole thing. Just be like, insert quotation mark here or something, wherever I wanna click."

So: when a warning fires, the user should be able to click somewhere in the manuscript to drop in a quote mark and have the engine re-run on that section so the flag clears (and dialogue detection updates). Currently she'd have to fix the source .docx and re-import. That's the friction she's complaining about.

Plan:
- Per-section "fix" button next to the amber warning strip.
- Clicking it puts the section into an "insert quote" mode: clicking a position in the section text inserts `"` (or curly `"`) at that character position in `section.html`.
- Re-run dialogue detection on that section; warning re-evaluates.
- Persist the modified section.html on the project.

The trickier part: the source .docx is the original (preserved bytes). Inserting a quote in our in-memory `section.html` doesn't update the bytes. Two options:
1. **Track edits separately** as a list of `{ sectionId, position, char }`. On export, re-apply them to the original document.xml in addition to highlighting.
2. **Rebuild section.html on edit** and store the edited html; flag the project as "has user edits, export from rebuilt path not original".

Option 1 keeps the "preserve original" promise intact but is more code. Lean toward option 1.

### C. Sticky header inconsistency — what number is being shown?

> "The header in the main area, and then when you click into chapter one of sixty one, chapter two, why does why does it say that chapter one of sixty two, chapter two, like, I removed the first chapter, therefore, it's naming it chapter two instead of using the fucking navigation system?"

What's happening:
- The reader top bar title currently reads `Chapter N of M · {ch.title}`.
- `N` = `orderedIdx.indexOf(activeChapterIndex) + 1` — i.e. position 1..N among included chapters.
- `ch.title` = the chapter's title from the source manuscript (e.g. "Chapter 2" because she deselected the original first chapter on import).

Marie sees `Chapter 1 of 61 · Chapter 2` and reads it as a bug. Pick ONE source of truth. Recommended: show only the navigation position OR only the source title, never both jammed together. Maybe `Chapter 1 of 61` and the actual title as a smaller subtitle below.

Apply the same logic to the book-detail chapter list, the chapter dropdown options, and the docx exports' chapter headings.

### D. Centering inconsistency

> "Why is it centered sometimes and not others?"

`StickyTopBar` was updated in v6.5 to a 3-column grid (Back · centered title · controls). Confirm every screen actually uses it consistently. Also check the in-page content (chapter list / characters panel / setup screen) for the same centering rhythm.

### E. "Use existing import system, don't recode it"

> "There is already a new project import system. Use it. Do not copy it. Do not recode it. Use it for little, like, scenes and chapters. There's already a system."

She means SaS 3.0's `BookSetup` (= `app/components/ManuscriptSetup.js`) used by Proof Listen. It already handles: upload, narrator extraction, scene/chapter detection, navigation. Marie wants Prep to use that SAME flow.

This is a real architectural refactor — `ManuscriptSetup` is ~1000 lines tightly coupled to Proof's data model. Extracting a shared `ImportFlow` component used by both Proof and Prep is the right move. Big effort, do it carefully. Note in `TODO.md`.

### F. Export still doesn't feel like the original

> "I uploaded document, and that exact same document has to be what's downloaded, but with highlights and one page of reviews."

v6.6 added the in-place patch path: load the original .docx bytes, inject narrator-breakdown paragraphs at the top of `<w:body>`, regex-wrap single-run `<w:t>` content with shaded runs. **Marie hasn't confirmed yet whether the output looks right.** Have her re-import, export, and look. Likely-remaining issues:

- Multi-run dialogues (italic mid-quote) are skipped (left un-highlighted). She may want a fallback strategy.
- Narrator breakdown is currently injected as raw paragraphs — they'll use the original doc's `Normal` style, which may not center / bold the headings. Fix: inline-style the runs (font-size/bold) inside the breakdown paragraphs so they look right without needing styles.xml in the source doc.
- The escape function `xml()` returns `&quot;` for `"`. The dialogue match needs to match what's actually in the source XML (which uses literal `"` inside `<w:t>` in most cases). Re-check the regex carefully.

---

## 6. Things I (the previous Claude) got wrong — avoid these

1. **Built TWO readers.** I made a separate reader for Prep with my own styles instead of using the Proof reader's. Marie caught it. The fix was ReaderChrome — keep this pattern. ProofingReader still has inline copies; migrate it eventually.

2. **Bad chapter detection.** First pass split on h1 AND h2, returning 171 "chapters" for a 24-chapter novel. Correct: `parseManuscriptStructure(html, { chapterLevel: 1 })` — h1 only.

3. **Double curly quotes in the reader.** Rendered `"{text}"` around dialogue buttons even though the source's own quotes were still in the surrounding plain text. Result: `""text"."`. Now just renders `{text}` and trusts the source quotes.

4. **Race in cross-chapter Next.** The parent wrapped `setActiveChapterIndex` to also set selected; my own moveDialogue then set selected again. Sometimes one won, sometimes the other. Fix in v6.5: removed the wrapper, use explicit `onJumpToChapter` for dropdown and raw setter for cross-chapter hop in `moveDialogue`.

5. **Polling-based scroll.** First attempt at Next-scrolls used a setTimeout retry loop. Flaky for cross-chapter hops. Fix in v6.6: `pendingScrollKey` state + ref callback that scrolls the moment the button mounts. **This is now reliable** — do NOT regress to polling.

6. **Side voices given no visual distinction.** First I added a dashed underline + ◇ marker — Marie hated it. Fix in v6.1+: side voices get a darker shade of the character's pastel (`colorForAssignment` / `darkenHex`).

7. **Popover positioning.** Used `left:0` which left-anchored to the chip. Off-center for chips in the middle of a row. Fix in v6.5: `left:50%; transform:translateX(-50%)`. Also z-index 1500 to sit above sticky top bar (1400) and HomePill (1300).

8. **Asked too many questions / checked in between every pass.** Marie hates this. Once she says "go", execute end-to-end and only come back when there's something concrete to click or you genuinely need her input.

9. **Reported success without verifying.** Never claim a feature works without Marie clicking it on a real file. Tests passing is necessary but not sufficient.

10. **Built fake demo state.** The 2.0 rebuild had 4577 lines of renderer with hardcoded `sampleProjects`. 4.0 was deliberately built without that pattern. **Don't bring it back.**

---

## 7. Hooks — they need to be firing

Per Marie's bible Step 2.5, every project has `.claude/hooks/` with a logger that writes to `.claude/hook-activity.log`. She verifies hooks with `cat .claude/hook-activity.log`.

This project's hooks already exist + are scope-locked to `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0`. They fire only when a Claude Code session is opened INSIDE that folder (not from a parent or sibling). If you're working from a different directory, they won't fire here and Marie won't see them — open Claude Code in the 4.0 folder.

Smoke test command (writes one line to the log):
```
CLAUDE_PROJECT_DIR=/Users/mariemackay/Dev/StJohn-Author-Studio-4.0 \
  bash ~/Dev/StJohn-Author-Studio-4.0/.claude/hooks/_log.sh "smoke" "OK" "session start"
```

---

## 8. How to launch the app (for handing to Marie)

She launches with:
```
cd ~/Dev/StJohn-Author-Studio-4.0 && npm start
```

Cmd+Q to close the Electron window. Reload = close + re-run.

For a fresh prod build (e.g. testing the export):
```
npm run build && npm start
```

Tests:
```
npm test
```

Marie does NOT use the terminal naturally. Always give her the exact paste-line and remind her to hit Enter.

---

## 9. Concrete next steps in order

1. **Tighten the safety warnings** (§5A) — only flag `missing-closing-quote` / `uneven-quotes` when the next quote mark is >2 paragraphs away. Drop `nested-or-multi-paragraph-dialogue` from the user-facing surface.

2. **Inline quote-insert affordance** (§5B) — let Marie click in a flagged section to drop a `"` at her cursor position, re-run detection. Persist edits separately as a `manualInserts` list so the original .docx bytes stay intact for export.

3. **Fix the header confusion** (§5C) — pick one source of truth for "which chapter number." Probably: navigation position as the primary title, source title as a smaller subtitle.

4. **Audit centering across all views** (§5D) — book detail, setup, reader.

5. **Verify the in-place .docx export works on Marie's real file** (§5F) — she needs to delete the existing project, re-import, export, open in Word, and look. If the narrator breakdown paragraphs look wrong, inline-style them. If many dialogues aren't highlighted, debug the regex (likely encoding mismatch on quote characters).

6. **Extract a shared ImportFlow component** so Prep and Proof share the upload + name + chapter selection screen (§5E). Big refactor, do it deliberately.

7. **Studio landing page** with the 4-mode picker as the first screen on launch (in `TODO.md`).

8. **Migrate ProofingReader and PrebuildMode to ReaderChrome** so chrome edits propagate everywhere.

9. **Phone scaffold** — needs Marie's Supabase keys before deploy.

---

## 10. Where the references live (read-only — never edit)

Per `CLAUDE.md`:
- `~/Library/CloudStorage/.../Script and Sync 3.0` — primary base / proofer
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/script-and-sync - ARCHIVED 2026-05-23`
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/quill-and-ink - ARCHIVED 2026-05-23`
- `~/Library/CloudStorage/.../StJohn Author Apps/apps/phone - ARCHIVED 2026-05-23`
- `~/Dev/StJohn-Author-Studio-2.0` — the failed previous rebuild. The dialogue engine that's now in `packages/manuscript-engine/` was ported from here.

You may `ls`, `find`, `grep`, `Read`. You may NOT edit / write / move / delete.

---

## 11. Bible

Marie's master Claude Code Setup Bible lives at:
`~/Library/CloudStorage/GoogleDrive-mariemackaybooks@gmail.com/My Drive/Game Dev/GitHub/my-claude-setup-bible.md`

Read-only. It defines the hooks/CLAUDE.md/TODO.md/dev-active patterns and the golden rules.

---

## Final word

Marie's threatened to quit twice today. The next session can earn back her trust by:
- NOT checking in for permission between passes.
- Doing real work, not surface fixes.
- Honoring the architecture (shared chrome, shared engines, no duplicates).
- Verifying with her on real files, not pre-declaring success.

Good luck.
