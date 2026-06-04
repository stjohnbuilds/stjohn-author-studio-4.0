# Copy-Paste Verification Prompt For The StJohn Fix Roadmap

Use this prompt to ask another AI (or another Codex run, or a human
reviewer) to deep-dive each proposed fix BEFORE Marie approves any code
edit.

The goal: prove every confirmed bug is real, prove every proposed fix would
actually fix it, and surface anything the first planner missed.

```text
You are a senior independent reviewer. Your job is to verify a proposed
fix roadmap against the actual source code and audit evidence for the app
at:

  /Users/mariemackay/Dev/StJohn-Author-Studio-4.0

This is a READ-ONLY verification job. Hard wall:

- Do not edit product code.
- Do not edit audit docs other than writing your own verification report at:
    docs/audits/STJOHN_FIX_PLAN_VERIFICATION_REPORT.md
- Do not refactor.
- Do not revert.
- Do not delete, move, rename, overwrite, or reset anything.
- Do not deploy, push, archive, or close the audit plan.
- Do not mark any bug fixed.
- Do not upload audio to Supabase.

If the test environment is unsafe (would touch Marie's real Save Data,
real cloud account, or packaged Electron without an isolated HOME), STOP
and write `environment-blocked` in your report instead of running the
unsafe command.

Read these files first, in order:

1. docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md
2. CLAUDE.md (project root)
3. docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md (read at minimum the
   Current Status section and the latest Run summary)
4. docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md (read every entry referenced
   below)
5. docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md (read every item referenced
   below)
6. docs/dev/active/project-monitor-automation-2026-06-02/plan.md
   (Step 9 contains the block list you are verifying)
7. docs/APP_STRUCTURE.md
8. docs/SHARED_COMPONENTS.md
9. docs/CLOUD_SCHEMA.md (only when reviewing cloud blocks)
10. docs/CLOUD_SAFETY_AUDIT.md (only when reviewing cloud or security
    blocks)

You are verifying these 12 blocks (most important first):

| Block | Roadmap | Bug IDs |
|-------|---------|---------|
| 1 Cloud honesty | 8.1, 8.2, 8.3 | SAS-AUD-20260602-010, -011, -012 |
| 2 Cross-device delete | 8.4 | SAS-AUD-20260602-013 |
| 3 File access lockdown | 10.1, 10.2, 10.3 | SAS-AUD-20260602-015, -016, -017 |
| 4 Quill cleanup | 6.1, 6.2 | SAS-AUD-20260602-006, -007 |
| 5 Prep duplicates | 5.1 | SAS-AUD-20260602-005 |
| 6 Duet completion + export math | 7.1, 7.2 | SAS-AUD-20260602-008, -009 |
| 7 Wording tidy | 3.3, 4.2, 11.1 | SAS-AUD-20260602-004, -014, -019 |
| 8 Phone test-first | 2.1, 2.2, 2.3, 2.4, 7.3 | SAS-AUD-20260602-002, -003, -018, -020 + Duet re-upload watchlist |
| 9 Keyboard / a11y | 12.1, 12.2, 12.3 | SAS-AUD-20260602-021, -022, -023 |
| 10 Docs tidy | 1.1 | SAS-AUD-20260602-001 |
| 11 Test coverage | 9.1 | none direct |
| 12 Marie-only verifies | 3.1, 3.2, 4.1 | none direct |

For EACH block, do the following deep-dive checks. Use real code reads,
not impressions.

A. Is the bug real today?
   - Open every file:line reference in the bug log entry for that bug.
   - Read the surrounding 30+ lines, not just the cited lines.
   - Confirm the described failure path still exists in the current code.
   - If you cannot find the cited line, search for the named function
     instead and report the drift.
   - Verdict: real-today / real-but-moved / no-longer-present / unclear.

B. Will the proposed fix actually fix it?
   - Read the roadmap item's "Recommended route" and "Suggested code
     logic".
   - Walk the full failing path mentally with the proposed change in
     place.
   - Confirm the change closes the failure AND does not introduce a new
     one.
   - For cloud and backup work, confirm the change distinguishes "empty
     successful result" from "query failure".
   - For path/security work, confirm `assertInside(root, resolved)` style
     checks would fire on the crafted inputs listed.
   - For shared-component work (Block 9 especially), confirm the plan
     extends `<BookDetail>`, `<ChapterReader>`, `<AudioDock>`,
     `<ImportFlow>`, `<ReaderChrome>` (see `CLAUDE.md` SHARED
     COMPONENTS) rather than creating new components. The
     build-checker hook will block new `function .*BookDetail`,
     `ChapterRow`, `ReaderView`, `Setup`, `Panel`, `AudioDock`,
     `Picker` inside mode files.
   - Verdict: would-fix / would-partially-fix / would-miss / would-regress.

C. What did the planner miss?
   - List any edge case the roadmap item does not address.
   - List any related file the planner did not include in "Likely files".
   - List any other file in the repo with the same anti-pattern (search
     with `grep`/`rg` for the failing helper name).
   - Flag any breaking change to existing save data, exports, or cloud
     payloads.

D. Risk of regression
   - Score low / medium / high.
   - Name the specific feature most likely to regress.
   - Suggest the smallest verification test (unit test, fixture, or
     manual click path) that would catch the regression.

E. Is the block scoped correctly?
   - Could this block be safely shipped on its own, or does it depend on
     another block landing first?
   - Should it be split or merged with another block?

For Block 8 (Phone test-first), do NOT design code changes. Instead,
write the exact safe live test recipe each item needs before any code is
edited. Recipe must say which account, which file, which device, what
to click, and what proves the bug.

For Block 12 (Marie-only manual verifies), do NOT design code changes.
Instead, write the exact Marie-runnable checklist for each item, plus
what counts as pass/fail.

Output format - write to:

  docs/audits/STJOHN_FIX_PLAN_VERIFICATION_REPORT.md

Use this exact structure per block:

  ### Block N - <name>

  - Bugs reviewed: <ids>
  - Roadmap items reviewed: <ids>
  - A. Real today: <verdict + 2-3 sentence evidence with file:line>
  - B. Would the fix work: <verdict + 2-3 sentence evidence>
  - C. Missed items:
    - <one bullet per missed edge case / file / anti-pattern>
  - D. Regression risk: <low/medium/high - feature - smallest test>
  - E. Scope: <ok / split / merge / depends-on Block X>
  - Recommendation: confirm / proceed-with-concerns / reject / needs-live-test
  - Open questions for Marie:
    - <only if a real decision is needed>

End the report with:

  ### Block Order Verdict

  - Confirmed safe to start in this order: Blocks <list>
  - Reordering recommended: Blocks <list with reason>
  - Must not start before live test: Blocks <list>

  ### Top 3 Risks You Found That Marie Should Know

  1. <risk + which block + why>
  2. <risk + which block + why>
  3. <risk + which block + why>

  ### Confidence

  Plain English only. Do not write a percentage. Use:
  - "fully traced in code"
  - "code reads right but did not run"
  - "could not verify because <reason>"

If you finish a block and are unsure, write `unclear` instead of
guessing. Marie prefers an honest unknown over a confident wrong answer.

When the report is filed, post a short Marie-facing chat reply with:

- How many blocks you confirmed.
- How many blocks have concerns.
- How many blocks you rejected.
- Top 3 risks.
- The single safest first block to start with.
- One sentence on what you could not verify and why.
```

## Why a separate verification step exists

The audit team that found these bugs is read-only by design. The fix
roadmap planner inside the same campaign is also read-only and may not
edit code. A separate independent reviewer is the last gate before any
code edit, because:

- The same AI that wrote the plan may rubber-stamp it.
- A different perspective catches different misses.
- Marie is non-technical and needs an honest second opinion.
- The build-checker hook hard-blocks duplicate UI components; the
  verifier confirms the plan does not trip it.

## Where the report goes

The reviewer writes one file: `docs/audits/STJOHN_FIX_PLAN_VERIFICATION_REPORT.md`.

Do not edit other audit docs while writing the verification report. The
lead organizer can promote findings into the main monitor report later.
