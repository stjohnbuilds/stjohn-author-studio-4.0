# Code Cleanup Plan — 2026-06-28

Companion to [`CODE_SIZE_BLOAT_AUDIT_2026-06-28.md`](CODE_SIZE_BLOAT_AUDIT_2026-06-28.md).
Ordered **easiest & safest first, the two huge files last.** Each job is standalone —
do one, test, stop. Nothing here needs Fable; Claude can do all of it.

**Golden rules for every job:** one job at a time · run tests + boot the app after each ·
commit after each so any step can be undone · never touch shared components by copying
them (extend them) · the build-checker hook hard-blocks new `function *BookDetail/
HomeView/ChapterRow/ReaderView/Setup/Panel/AudioDock/Picker` in a mode file.

---

## JOB 1 — Delete the 14 dead scripts  🟢 EASY (~10 min, near-zero risk)

**What:** remove 14 diagnostic/one-off scripts in `scripts/` that nothing runs.
**Why:** 1,750 lines of clutter. Verified not referenced in `package.json` or anywhere
else in the repo, and they don't import each other.

**Files (all in `scripts/`):** anarchy-accuracy-test.mjs · anarchy-heavy-test.mjs ·
anarchy-real-test.mjs · check-v6.js · cloud-safety-test.mjs · diagnose-alignment.js ·
diagnose-sync-table.mjs · diagnose-word-count.mjs · generate-prep-sample.mjs ·
inject-v6-alignment.mjs · page-diagnostic.mjs · page-sandbox.mjs · pull-page-text.mjs ·
test-alignment-v6.mjs

**Steps:**
1. Safer than deleting: move them into `scripts/archived/` (keeps history handy) —
   OR delete outright (git still has them forever). Recommend archive.
2. Nothing else to change — no `package.json` edits needed (they're not wired in).

**Test:** `npm test` (18 tests still pass) · `npm run guardrails:check:all` ·
`npm start` boots the app. All should be unchanged.
**Rollback:** `git checkout` the folder / `git revert` the commit.

---

## JOB 2 — Remove verified dead code  🟢 SMALL (~1 hr, low risk)  ~70 lines

**What:** delete code that is defined but never used. Each item was grep-verified.

| Item | File:line | Fix |
|---|---|---|
| `ComingSoonScreen` never rendered | app/page.js:1863–1893 | delete the function (~30 lines) |
| Dead import of `BookDetail, {ChapterRow}` | app/components/QuillAndInkMode.js:21 | delete that one import line (file uses `ProofBookDetail`) |
| `export` on unused `tokenizeWords` | packages/quill-engine/normalize.js:18 | keep the function (its `countWords` uses it) — just remove the `export` keyword so it's not public |
| Dev "skip login (fake session)" button | app/components/LoginScreen.js:313–347 | delete (~35 lines) — a hidden dev shortcut that shouldn't ship |

**Leave alone (NOT dead):** `slimPdfPagingForCloud` (cloud-slim.js) — it's wired in at
line 74 and you reverted it on purpose; harmless.

**Steps:** one edit per row, in one commit. After the LoginScreen edit, sign-in/sign-up
still render normally (only the grey dev button disappears).
**Test:** `npm start` → confirm login screen looks right, sign in works · `npm test`.
**Risk:** low. The only user-visible change is the dev button vanishing (dev-only anyway).
**Rollback:** `git revert`.

---

## JOB 3 — Merge the copy-pasted helpers  🟡 SMALL–MEDIUM (~half day)  ~200 lines

**What:** the same tiny text helpers are hand-copied in several files. Point everyone at
the one real version in the shared engine, then delete the copies.

**Helpers + where the copies live (delete these, import the canonical one instead):**
- `stripTags` → use manuscript-engine `stripHtml`. Copies: ImportFlow.js:76 ·
  PrepManuscriptMode.js:88 · prepExport.js:50 (+`stripHtmlForText`:60).
- `paragraphsFromHtml` → pick one home (manuscript-engine). Copies: PrepManuscriptMode.js:139
  · prepExport.js:86.
- `darkenHex` / `darkenHexExport` → one shared. Copies: PrepManuscriptMode.js:93 ·
  prepExport.js:116.
- HTML-entity decode → use text-normalize's decoder. Copies: PrepManuscriptMode.js:120 ·
  prepExport.js:760 · chapter-plain-text.js:37.
- `countWords` → one shared. Copies: ImportFlow.js:79 · PrebuildMode.js:63.
- `hashString` (identical) → new `packages/cloud-sync/hash.js`. Copies: proof-sync.js:362 ·
  quill-sync.js:332.

**Steps (one helper at a time, commit between each):**
1. Make sure the canonical version is exported from the engine.
2. In each copy site: replace the local function with an import of the canonical one.
3. Delete the local copy.
4. Test that specific mode's export/import still produces identical output.

**Why one-at-a-time:** these touch export/highlight code (Prep DOCX, Quill exports). A
tiny difference in `stripTags` could change a highlighted Word doc. Test each swap on a
real file before the next.
**Test after each:** `npm test` (prep-export, quill-exporters tests cover a lot) + run
the actual export in the app on one real book and eyeball the result.
**Risk:** medium — output-shaping code. Mitigated by going one helper at a time.
**Rollback:** `git revert` the specific helper's commit.

---

## JOB 4 — Split the two huge files  🔴 BIG (multi-day, careful) — DO LAST

These aren't dead code — they run your real work. The job is **tidying, not deleting**:
break one giant file into a few smaller ones that do one thing each. Higher risk because
a mistake here breaks Proof or the phone. Do Jobs 1–3 first; only start this when you
have time to test thoroughly on real files.

### 4a — `SessionsView.js` (3,664 lines → ~5 files)

**Target split (from the audit blueprint):**
- book-detail shell (~500) · audio attach + transcription queue (~700) · transcription
  engine wiring (~500) · side panel Nav/Flags/Transcriptions tabs (~500) · CSV/Audition
  export (~300) · shared character-tally + word-split helper (~150 → `app/lib/`).

**Hard constraint:** the build-checker hook blocks new `function *BookDetail/Panel/Picker`
inside mode files. So extractions must go into **new files under `app/components/` or
`app/lib/`**, imported back in — not renamed copies inside a mode file.

**Steps:**
1. First, land Job 3's shared character-tally helper (removes ~150 lines here for free).
2. Pull out the CSV/Audition export functions into `app/lib/proofExports.js`. Test exports.
3. Pull out the side-panel tab renderers into `app/components/ProofSidePanel.js`. Test tabs.
4. Pull out the transcription-queue logic into a hook `app/lib/useTranscriptionQueue.js`.
   Test transcribe + queue on a real chapter.
5. What remains is the book-detail shell — leave it as `SessionsView`.
6. Boot + full Proof walkthrough on a real book after EACH extraction; commit each.

**Test:** the deep-check/battery protocol (import → attach audio → transcribe → open
reader → flag → export CSV) on a real book, after every step.
**Risk:** high. This is Marie's anchor mode. Small steps + commit-per-step + real-file
test each time.
**Rollback:** each extraction is its own commit; revert the last one if a test fails.

### 4b — `app/phone/page.js` (3,595 lines → ~6 files)

**Target split:** PhoneShell/auth (~200) · ServicePicker (~80) · ScriptService+reader
(~900) · QuillService+reader (~800) · PhoneAudioDock (~300) · shared phone helpers
CSV/auto-fill/paging (~700 → `app/phone/_lib/`).

**Steps:**
1. Pull the ~40 helper functions into `app/phone/_lib/` modules (CSV, flag auto-fill,
   narrator detection, paging). Pure functions → safest first. Test.
2. Extract `PhoneAudioDock` into `app/phone/_components/PhoneAudioDock.js`. Test playback.
3. Extract the Quill phone service + its reader into its own file. Test on phone.
4. Extract the Script phone service + its reader into its own file. Test on phone.
5. What remains is the shell + service picker.
6. Test on a real phone (or phone-sized browser) after each step; commit each.

**Test:** phone battery — sign in → open project → pick local audio → play → add flag /
annotation → export CSV, in Script AND Quill, after each step.
**Risk:** high. Fully standalone from desktop, so desktop is safe, but phone flows are
fiddly. Small steps + real-device test.
**Rollback:** commit-per-step; revert the last.

---

## Suggested order & effort

| Order | Job | Effort | Risk | Lines |
|---|---|---|---|---|
| 1 | Delete dead scripts | 10 min | 🟢 tiny | −1,750 |
| 2 | Remove dead code | ~1 hr | 🟢 low | −70 |
| 3 | Merge copy-paste helpers | ~½ day | 🟡 med | −200 |
| 4a | Split SessionsView | multi-day | 🔴 high | tidy 3,664 |
| 4b | Split phone/page.js | multi-day | 🔴 high | tidy 3,595 |

Do 1 & 2 now. Sit on 3 until you can test exports on a real book. Save 4 for when you
have a clear few days and want the maintainability win — it doesn't make the app better
for readers, only easier to work on.
