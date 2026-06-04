# Copy-paste audit prompt: Next-chapter transcription drop bug

Send this to a second AI (or another Codex run) to verify the
diagnosis below and surface anything missed.

```text
You are a senior independent code reviewer. Verify a bug diagnosis
in this app:

  /Users/mariemackay/Dev/StJohn-Author-Studio-4.0

READ-ONLY job. Do not edit product code. Write your report at:
  docs/audits/STJOHN_NEXT_CHAPTER_BUG_AUDIT_REPORT.md

THE BUG (reported by Marie 2026-06-04):
- User starts the Proof Listen reader on a chapter.
- Background transcription completes for the NEXT chapter while she's
  reading the current one.
- She clicks the "Next chapter" button (top of the reader, Proof
  Listen view).
- The next chapter opens BUT the transcription does not appear (no
  word-follow alignment, no whisper data shown).
- If she instead clicks Back (returns to Book Detail) and then clicks
  Proof on the same chapter, the transcription appears correctly.
- Same project state both times — only the entry path differs.

CLAIMED ROOT CAUSE:
Two parallel "audio key" functions produce two different string
shapes, and the next-chapter path uses the wrong one:

1. `app/page.js:90 sectionAudioKey(section)`
   - returns `<storedPath>` or `<audioFileName>` (RAW)
   - used by: `navigateReaderChapter` (Next/Prev button),
     `jumpToReaderScene`, `buildContinuousChapterSection`,
     reader scene options

2. `app/components/SessionsView.js:441 getSectionAudioKey(sec)`
   - returns `path:<storedPath>` or `name:<normText(audioFileName)>`
     (PREFIXED)
   - used by: `buildProofSectionForReader`,
     `buildContinuousProofSection`, the transcription writer that
     stores `whisperAudioKey` on the section

When transcription completes (SessionsView.js around line 1455-1470),
the section is stamped with `whisperAudioKey: "path:..."` (prefixed
form).

`buildContinuousChapterSection` (app/page.js line 142) checks
`section.whisperAudioKey === key` where `key` came from
`sectionAudioKey()` (raw form). The strings never match because of
the `path:` / `name:` prefix mismatch, so
`hasCurrentSectionTranscription` returns false and the function
returns empty `whisperAlignment: []` and `whisperWords: []`.

That is why the next chapter looks like it has no transcription
when she just clicked Next, but it appears fine after Back + Proof
(which goes through buildProofSectionForReader → uses prefixed form).

VERIFY THESE FIVE THINGS:

A. Confirm the two functions exist with the shapes I described.
   File paths and line numbers above. Read each function in full.

B. Confirm `navigateReaderChapter` reaches
   `buildContinuousChapterSection` which calls
   `hasCurrentSectionTranscription(s, key, expectedTextHash)` with
   the raw-form key. Trace: page.js:1173 → page.js:142 → page.js:162.

C. Confirm `openSceneProof` reaches `buildContinuousProofSection`
   which calls the same check with the prefixed-form key. Trace:
   SessionsView.js:openSceneProof → buildProofSectionForReader →
   buildContinuousProofSection.

D. Confirm the transcription writer stores the PREFIXED form:
   SessionsView.js around lines 1455-1470 (look for
   `whisperAudioKey: task.expectedAudioKey`) and confirm
   `task.expectedAudioKey` is the prefixed form (the producer is
   somewhere in the same file).

E. Search the codebase for any OTHER consumer of `whisperAudioKey`
   that might also be using the wrong-format comparator. Specifically:
     - Anywhere that does `section.whisperAudioKey === X`
     - Any other "is this transcription current" check
   Report whether each consumer uses the prefixed or raw form.

ALSO ANSWER:

F. Architectural question: should `navigateReaderChapter` be
   rebuilding the section at all, or should it just update an
   active-chapter-id and let the reader re-derive from the latest
   book state? Read `app/page.js:1144-1175` and
   `app/components/ProofingReader.js:369` (the props it accepts) and
   give your opinion. Note: Quill's reader uses
   `onChangeChapter={setActiveChapterId}` and re-reads from
   project.chapters; it does NOT do this rebuild.

G. Are there other places in the codebase where two parallel
   implementations exist for "the same thing" with slightly
   different output? Spot-check 3-5 cross-mode operations
   (Proof/Quill/Prep/Duet) for similar drift.

REPORT STRUCTURE (write to the report file):

  # Next-Chapter Transcription Drop — Independent Verification

  ## A. Two-function existence: confirmed / refuted
    - sectionAudioKey: file:line, shape returned
    - getSectionAudioKey: file:line, shape returned

  ## B. navigateReaderChapter uses wrong form: confirmed / refuted
    - Trace with line numbers

  ## C. openSceneProof uses right form: confirmed / refuted
    - Trace with line numbers

  ## D. Transcription writer uses prefixed form: confirmed / refuted
    - File:line of the writer
    - File:line of expectedAudioKey producer

  ## E. Other whisperAudioKey consumers
    - One bullet per consumer with file:line and key-format used

  ## F. Architectural recommendation
    - Should Next/Prev just set chapter id? Yes/no, why.
    - What needs to change in ProofingReader to support that?

  ## G. Other parallel-implementation drift
    - 3-5 spot-checks across modes

  ## Overall recommendation
    - Approve one-line fix (unify the key format)? Yes/no.
    - Approve architectural refactor (kill the rebuild)? Yes/no.
    - Other risks Marie should know about before either lands.

  ## Confidence
    - Plain English only. No percentages.

If you cannot verify something, write `unclear` and explain why.
Marie prefers honest unknowns over confident guesses.

When the report is filed, post a short Marie-facing chat reply
(under 8 lines) summarising: confirmed / refuted, top risk, and
your one-sentence recommendation.
```
