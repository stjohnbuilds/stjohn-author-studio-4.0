# Next-Chapter Transcription Drop — Independent Verification

Reviewer: independent code review pass (read-only).
Date: 2026-06-04.

## A. Two-function existence: **confirmed**

- `sectionAudioKey(section)` — [app/page.js:90](../../app/page.js#L90)
  - Body: `return getSectionStoredAudioPath(section) || section?.audioFileName || null;`
  - Returns: **RAW** string — the full stored audio path, or the raw
    `audioFileName`, or `null`. **No prefix, no normalization.**
- `getSectionAudioKey(sec)` — [app/components/SessionsView.js:441](../../app/components/SessionsView.js#L441)
  - Body:
    ```js
    const storedAudioPath = getSectionStoredAudioPath(sec);
    if (storedAudioPath) return `path:${storedAudioPath}`;
    if (sec?.audioFileName) return `name:${normText(sec.audioFileName)}`;
    return null;
    ```
  - Returns: **PREFIXED** string — `path:<storedAudioPath>` or
    `name:<normText(audioFileName)>` (lowercased, alphanumerics + spaces).

Same conceptual function. Two different output shapes. The shapes are
incompatible under `===`.

## B. navigateReaderChapter uses wrong (raw) form: **confirmed**

Full trace:

- [app/page.js:1144](../../app/page.js#L1144) `navigateReaderChapter(direction)`
- [app/page.js:1173](../../app/page.js#L1173)
  `const targetSection = buildContinuousChapterSection(targetChapter, targetSectionBase);`
- [app/page.js:142](../../app/page.js#L142) `buildContinuousChapterSection(chapter, section)`
- [app/page.js:151](../../app/page.js#L151)
  `const key = sectionAudioKey(section);` ← **RAW form**
- [app/page.js:162](../../app/page.js#L162)
  `const hasCurrentMergedTranscription = allSections.every(s => hasCurrentSectionTranscription(s, key, expectedTextHash));`
- [app/page.js:104](../../app/page.js#L104) `hasCurrentSectionTranscription(section, expectedAudioKey, expectedTextHash)`
- [app/page.js:111](../../app/page.js#L111)
  `section.whisperAudioKey === expectedAudioKey` ← **strict `===`**

What this does in practice: `expectedAudioKey` arrives as a raw string
(e.g. `/Users/.../Chapter 3.m4a`). `section.whisperAudioKey` was
written as `path:/Users/.../Chapter 3.m4a`. Strict equality fails.
`hasCurrentMergedTranscription` is `false`, so lines 167-168 return
`whisperAlignment: []` and `whisperWords: []`. The reader opens with
no transcription. Exactly Marie's symptom.

## C. openSceneProof uses right (prefixed) form: **confirmed**

Full trace:

- [app/components/SessionsView.js:1863](../../app/components/SessionsView.js#L1863) `openSceneProof(chapter, section)`
- [app/components/SessionsView.js:1870](../../app/components/SessionsView.js#L1870)
  `onProof(buildProofSectionForReader(chapter, section), url);`
- [app/components/SessionsView.js:1852](../../app/components/SessionsView.js#L1852) `buildProofSectionForReader`
- [app/components/SessionsView.js:1853](../../app/components/SessionsView.js#L1853)
  `const merged = buildContinuousProofSection(chapter, section);`
- [app/components/SessionsView.js:1807](../../app/components/SessionsView.js#L1807) `buildContinuousProofSection`
- [app/components/SessionsView.js:1825](../../app/components/SessionsView.js#L1825)
  `const expectedAudioKey = getSectionAudioKey(allSections[0]) || getSectionAudioKey(section) || '';` ← **PREFIXED**
- [app/components/SessionsView.js:1827](../../app/components/SessionsView.js#L1827)
  `hasCurrentSectionTranscription(s, expectedAudioKey, expectedTextHash)`
- [app/components/SessionsView.js:167](../../app/components/SessionsView.js#L167)
  Local `hasCurrentSectionTranscription` — a **different copy** from the
  one in page.js.
- [app/components/SessionsView.js:156-164](../../app/components/SessionsView.js#L156)
  Uses `equivalentAudioKeys(audioKey)` which generates BOTH the
  `path:` form and a derived `name:` form, then
  [SessionsView.js:175](../../app/components/SessionsView.js#L175)
  does `expectedAudioKeys.includes(section.whisperAudioKey)` — an
  **equivalence** check, not strict equality.

So the SessionsView path is doubly safe: it computes the prefixed form
(matches the stored value), and it also tolerates path/name drift if
the stored value happened to be the other form.

`onProof` is wired to `startProofing` at
[app/page.js:1721](../../app/page.js#L1721)
(`<BookDetail ... onProof={startProofing} ...>`). So this path bypasses
`buildContinuousChapterSection` entirely.

## D. Transcription writer uses prefixed form: **confirmed**

Two writers, both prefixed:

1. Queue-driven Whisper completion — [app/components/SessionsView.js:1467](../../app/components/SessionsView.js#L1467)
   `whisperAudioKey: task.expectedAudioKey`
   - Producer of `task.expectedAudioKey`:
     [app/components/SessionsView.js:1626](../../app/components/SessionsView.js#L1626)
     `const expectedAudioKey = getChapterAudioKey(ch);` then
     [app/components/SessionsView.js:1655 / 1673](../../app/components/SessionsView.js#L1655)
     `expectedAudioKey,` (stamped onto the queued task and the
     `runQueuedTranscriptionTask` call).
   - `getChapterAudioKey` — [app/components/SessionsView.js:151](../../app/components/SessionsView.js#L151)
     calls `getSectionAudioKey(firstAudioSection)` → **PREFIXED**.
2. Realign-only path — [app/components/SessionsView.js:1753](../../app/components/SessionsView.js#L1753)
   `whisperAudioKey: expectedAudioKey` where
   [app/components/SessionsView.js:1705](../../app/components/SessionsView.js#L1705)
   `const expectedAudioKey = getChapterAudioKey(ch);` → also **PREFIXED**.

Conclusion: every write of `whisperAudioKey` in Proof Listen stores the
prefixed form. There is no path that ever writes the raw form.

## E. Other whisperAudioKey consumers

Every occurrence found via `grep -rn whisperAudioKey app packages`:

- **READ — BROKEN.** [app/page.js:111](../../app/page.js#L111)
  `section.whisperAudioKey === expectedAudioKey` — strict equality
  against caller-supplied key from `sectionAudioKey()` (raw).
  This is the bug. Used by `buildContinuousChapterSection` (Next/Prev
  button) and indirectly by `jumpToReaderScene`.
- **READ — correct.** [app/components/SessionsView.js:175](../../app/components/SessionsView.js#L175)
  `expectedAudioKeys.includes(section.whisperAudioKey)` — uses
  `equivalentAudioKeys()` to accept both `path:` and `name:` forms.
  Used by `isChapterTranscriptionCurrent`, `realignChapter`,
  `buildContinuousProofSection`, and the chapter-tick UI.
- **WRITE — prefixed.** [app/components/SessionsView.js:1467](../../app/components/SessionsView.js#L1467) — queue completion writer (covered in D).
- **WRITE — prefixed.** [app/components/SessionsView.js:1753](../../app/components/SessionsView.js#L1753) — realign writer (covered in D).
- **CLEAR.** [app/components/SessionsView.js:141](../../app/components/SessionsView.js#L141)
  Inside `clearSectionTranscription` — sets to `undefined`. Format-agnostic.
- **WRITE — prefixed (Quill mode).** [app/components/QuillAndInkMode.js:452](../../app/components/QuillAndInkMode.js#L452)
  Builds `path:<storedAudioPath>` or `name:<normalizedName>` explicitly.
  Lines 430-454 have a comment block from Marie 2026-05-26 explaining
  this *same class of bug* in Quill ("the previous version of this fix
  saved a raw filename — the format mismatch is what wiped the tick").
  Quill writes prefixed; the fix has held. Quill's pass-through
  references at [QuillAndInkMode.js:216 / 231 / 323 / 866](../../app/components/QuillAndInkMode.js#L216)
  treat the value opaquely (just copy through).
- **SERIALIZE — opaque.** [packages/cloud-sync/proof-sync.js:68 / 120 / 125 / 281](../../packages/cloud-sync/proof-sync.js#L68),
  [packages/cloud-sync/quill-sync.js:272](../../packages/cloud-sync/quill-sync.js#L272),
  [packages/cloud-sync/cloud-slim.js:31](../../packages/cloud-sync/cloud-slim.js#L31),
  [packages/cloud-sync/audio-guard.js:70](../../packages/cloud-sync/audio-guard.js#L70).
  These read/write the field as a string for cloud round-trip. They
  don't care about the format — they don't compare it. They will NOT
  break if the format is unified.
- **CLOUD MERGE.** [packages/cloud-sync/proof-sync.js:281](../../packages/cloud-sync/proof-sync.js#L281)
  Pulls `whisperAudioKey` from cloud transcription record and stamps it
  on the merged section. Format whatever was written. Opaque.

Summary: only **one** consumer reads with the wrong format, and it is
the smoking gun (app/page.js:111). Everything else either writes
prefixed or treats the value opaquely.

## F. Architectural recommendation

**Should Next/Prev just set chapter id? Yes — eventually.**

Quill already does this — [app/components/QuillAndInkMode.js:803](../../app/components/QuillAndInkMode.js#L803)
(`onChangeChapter={setActiveChapterId}`) — and re-derives everything
from `project.chapters` inside `QuillReaderView`. That pattern works
because the reader owns the "given a chapter id, build the view"
logic, and there is only one place that does it.

ProofingReader could do the same:

- Receive `book` + `activeSectionId` (or `chapterId`) instead of a
  pre-baked `section` with computed `whisperAlignment` / `whisperWords`
  / `proofInitialWordOffset`.
- Internally derive the merged continuous-chapter section using
  **one** shared `buildContinuousProofSection` (the SessionsView one).
- `onNextChapter` / `onPrevChapter` just call `setActiveSectionId(...)`
  in page.js. Drop `navigateReaderChapter` and the audio-URL resolution
  becomes a side-effect of section change (a `useEffect` in
  ProofingReader, or a helper in the parent).
- Same for `jumpToReaderScene` — collapse to id-set.

What ProofingReader needs to support that:

- It currently expects `section.whisperAlignment` / `whisperWords` /
  `proofInitialWordOffset` / `html` (possibly merged) / `chapterTitle`
  / `audioFileName` / `isFirstSectionInChapter`. All of those come out
  of `buildProofSectionForReader`. Move that builder into the reader
  (or call it from page.js with the SessionsView export), keep its
  output shape identical.
- The reader already accepts new `section` props and rebuilds internal
  state from them (it does today on prop change), so passing a freshly
  re-derived section per render is safe.

**Risk.** The reader has a lot of internal state (audio element,
follow-playback, syncSpeed, etc.). Verify on a re-derive that the
audio element doesn't reset mid-playback unexpectedly — the current
`navigateReaderChapter` deliberately resolves a new `targetUrl` and
calls `startProofing(... , targetUrl, 0)`, which sets a fresh
`audioUrl`. A re-derive flow needs the same "audio for this section"
plumbing.

**Recommended sequence.**

1. Land the one-line fix first (see Overall recommendation). Marie
   verifies on a real file.
2. Then schedule the architectural refactor as a separate task —
   moving `buildContinuousProofSection`, `sectionAudioKey`,
   `hasCurrentSectionTranscription`, and friends into a single shared
   module (e.g. `packages/audio-engine/section-keys.js` and
   `packages/audio-engine/continuous-section.js`). Delete the page.js
   copies. Switch ProofingReader to id-driven navigation.

## G. Other parallel-implementation drift

The duplication that caused this bug is not isolated. Spot-checks:

1. **`hashText`** — defined three times, in
   [app/page.js:94](../../app/page.js#L94),
   [app/components/SessionsView.js:120](../../app/components/SessionsView.js#L120),
   [app/components/QuillAndInkMode.js:149](../../app/components/QuillAndInkMode.js#L149).
   Any divergence breaks the manuscript-text-hash check that gates
   "is this transcription still valid?" silently. I did not byte-diff
   all three, but a hash function used to invalidate cached work is
   exactly the wrong thing to duplicate.
2. **`countWordsInHtml`** — defined in
   [app/components/SessionsView.js:67](../../app/components/SessionsView.js#L67),
   [app/components/PrebuildMode.js:63](../../app/components/PrebuildMode.js#L63),
   [app/lib/manuscriptPaging.js:8](../../app/lib/manuscriptPaging.js#L8).
   Word counts feed alignment slicing and page numbering — if these
   diverge by even one word, alignment offsets drift.
3. **`normText`** — defined in
   [app/components/ManuscriptSetup.js:63](../../app/components/ManuscriptSetup.js#L63),
   [app/components/SessionsView.js:392](../../app/components/SessionsView.js#L392),
   [app/components/ProofingReader.js:26](../../app/components/ProofingReader.js#L26).
   `normText` is the *normalizer inside `name:...` audio keys*. If any
   copy diverges from SessionsView's, an audio-key match could pass in
   one mode and fail in another. This is a direct cousin of today's bug.
4. **`getSectionStoredAudioPath`** — defined in
   [app/page.js:66](../../app/page.js#L66) and
   [app/components/SessionsView.js:424](../../app/components/SessionsView.js#L424).
   Both look identical today but nothing prevents drift. Marie has
   already been bitten once by the platform-disambiguation logic; two
   copies is two places to keep in sync.
5. **`hasCurrentSectionTranscription`** — the smoking gun: defined in
   [app/page.js:104](../../app/page.js#L104) (strict `===`, no
   equivalence) and [app/components/SessionsView.js:167](../../app/components/SessionsView.js#L167)
   (uses `equivalentAudioKeys`, tolerates form drift). The page.js
   copy is a stale clone of an older version of SessionsView's. This
   is exactly the same parallel-implementation pattern that caused the
   Quill tick bug Marie fixed on 2026-05-26 — see the long comment at
   [QuillAndInkMode.js:430-454](../../app/components/QuillAndInkMode.js#L430).
   The lesson did not propagate.

CLAUDE.md explicitly calls for "one shared audio engine" in
`packages/audio-engine/` and "one shared manuscript engine" in
`packages/manuscript-engine/`. These helpers belong there. They are
currently re-implemented in three or four places each.

## Overall recommendation

**Approve one-line fix? Yes — but make it two changes, not one.**

The minimum-viable patch is two coordinated changes in `app/page.js`:

1. Change `sectionAudioKey` (line 90) to return the prefixed form,
   matching `getSectionAudioKey` in SessionsView byte-for-byte (or
   import it directly from a shared module). Today:
   ```js
   function sectionAudioKey(section) {
     return getSectionStoredAudioPath(section) || section?.audioFileName || null;
   }
   ```
   Should produce `path:<storedPath>` or `name:<normText(audioFileName)>`.
2. Update `hasCurrentSectionTranscription` (line 104) to use the same
   `equivalentAudioKeys` tolerance the SessionsView version uses — or,
   better, delete the page.js copy and import the SessionsView one.

Doing only #1 makes the next-chapter path work. Doing only #2 does
not, because callers still pass the raw form. Both are needed for a
clean fix.

**Approve architectural refactor (kill the rebuild)? Yes, but as a
follow-up.**

The refactor is the right shape but it touches ProofingReader's
prop contract and the audio-URL resolution. Land the fix first, then
refactor with Marie in the loop. The refactor should consolidate
`sectionAudioKey` / `hasCurrentSectionTranscription` / `hashText` /
`normText` / `countWordsInHtml` / `getSectionStoredAudioPath` into the
shared packages and delete every duplicate.

**Other risks Marie should know about before either lands.**

- **`jumpToReaderScene` has the same bug.** [app/page.js:1129](../../app/page.js#L1129)
  also calls `buildContinuousChapterSection`. Within the same audio
  file the merged section's transcription will look stale to that
  function and get blanked. Marie may or may not have noticed this
  yet because scene jumps within a chapter are common only in long
  scenes. The two-line fix covers it automatically.
- **Stored data is already in prefixed form.** Existing books on
  disk / in Supabase already have `whisperAudioKey: "path:..."`. The
  fix changes the READER side only. No migration needed. No fresh
  re-transcription needed.
- **Cloud-sync helpers are opaque** ([proof-sync.js:120/125](../../packages/cloud-sync/proof-sync.js#L120))
  — they round-trip the string without comparing it. They will not
  break when the format is unified.
- **The Quill-side fix from 2026-05-26 stays untouched.** Quill's
  builder/key is independent and already correct.
- **Risk of "fixing" by changing the WRITER instead.** Do NOT make
  the transcription writer store the raw form to match page.js. That
  would re-break the SessionsView tick check, the cloud-sync
  serialization assumptions, and the Quill comment-block precedent.
  Fix the reader, not the writer.

## Confidence

**Bug diagnosis: fully checked.** Read every function in the trace
end-to-end. The format mismatch is real, the strict `===` on line
111 of page.js is the failure point, and there is no other code path
that could rescue the comparison.

**Other consumers: fully checked.** All ten `whisperAudioKey`
references across `app/` and `packages/` are accounted for — see
section E. Only one is broken.

**Architectural recommendation: code reads right but didn't run.** The
"Quill does just set a chapter id" claim is grounded in the code at
QuillAndInkMode.js:803 and the QuillReaderView contract. Whether
ProofingReader can be refactored cleanly depends on internal-state
churn I didn't simulate (audio-element reset behaviour on re-derive).
The refactor is the right direction; the precise patch needs a
small spike before committing.

**Parallel-implementation drift census: partial.** I confirmed five
duplicates by grep. There may be more — I did not enumerate every
helper in `app/` or do a byte-diff of the three `hashText` copies. A
follow-up audit of `packages/audio-engine/` and `packages/manuscript-engine/`
content vs. inline copies in mode files is worth scheduling separately.

Honest unknowns:

- I did not run the app and watch the bug reproduce. The diagnosis is
  pure code-trace. If Marie can repro the steps from the bug report
  on the latest build and the patched build silences the symptom,
  that closes the loop.
- I did not check the on-disk shape of `whisperAudioKey` in Marie's
  actual `Save Data/` book files to absolutely confirm they are stored
  as `path:...`. The code paths above all write that form, and the
  comment block at QuillAndInkMode.js:430-454 corroborates the format,
  but a one-line `jq` over a real book file would make this airtight.
