# Copy-Paste Verification Prompt For Block 3a (File Access Lockdown — Path Boundaries)

Use this prompt to ask another AI (or another Codex run, or a human
reviewer) to independently vet the Block 3a implementation BEFORE it
ships to Marie's packaged Mac app.

Block 3a covers bugs SAS-AUD-20260602-016 (transfer import path escape)
and SAS-AUD-20260602-017 (raw bookId path escape). Block 3b (audio
bridge / `webSecurity: false`) is intentionally deferred and is NOT in
scope for this verification.

```text
You are a senior independent security reviewer. Your job is to verify
that Block 3a of the StJohn Author Studio 4.0 fix roadmap actually
closes the two confirmed path-escape bugs without breaking legitimate
behavior, and to flag anything the implementer missed.

Project root:
  /Users/mariemackay/Dev/StJohn-Author-Studio-4.0

This is a READ-ONLY verification job. Hard wall:

- Do not edit product code.
- Do not edit other audit docs.
- The only allowed write is your own report at:
    docs/audits/STJOHN_BLOCK_3A_VERIFICATION_REPORT.md
- Do not refactor, deploy, push, archive, or close any plan.
- Do not upload audio to Supabase.

Read these in order before judging anything:

1. docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md
   — entries SAS-AUD-20260602-016 and SAS-AUD-20260602-017.
2. docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md
   — items 10.2 and 10.3.
3. docs/audits/STJOHN_FIX_PLAN_VERIFICATION_REPORT.md
   — the Block 3 section, which lists what the original verifier
     said the implementer must NOT miss.
4. main.js
   — read the new helpers `assertResolvedInsideDir` and
     `safeJoinInsideDir` near the top of the file, plus the three call
     sites: `getManuscriptSourcePath`, `rewriteBookAudioPathsForTransferImport`,
     and the transfer-manuscript path inside the import IPC handler.

Then verify FOUR things, in this order:

A. The helper itself does what it claims.
   - Trace `safeJoinInsideDir` line by line.
   - Confirm it rejects: `..` segments, absolute paths starting with `/`
     or `\`, scheme-like inputs (`file://`, `C:`, etc), null bytes,
     empty inputs, and segments-only-after-trim that are empty.
   - Confirm it ALLOWS: normal numeric ids (Marie's existing books are
     all numeric `Date.now()` values), uuid-style ids with hyphens,
     plain filenames, and nested chapter/section paths like
     `chapter01/section01.mp3`.
   - Verdict: helper-correct / helper-has-hole.

B. Every previously-vulnerable site uses the helper.
   - Grep main.js for every `path.join(` and `path.resolve(` and
     decide: does this site build a path from external data (imported
     books, transfer manifests, IPC payloads, manifest fields)? If yes,
     it must go through `safeJoinInsideDir`.
   - Specifically check these previously-cited sites:
     - `getManuscriptSourcePath(bookId)`
     - `rewriteBookAudioPathsForTransferImport` (audio rebuild)
     - The transfer-import IPC handler (manuscript path rebuild)
   - Also search for any OTHER path-building sites that take external
     data and were not in the original bug list. Specifically check
     for: Quill source paths, Prep manuscript source paths, Duet
     project paths, backup-import paths, copy-release scripts, and the
     `localfile://` protocol handler.
   - Verdict per site: protected / unprotected / not-applicable.

C. The fix does not break legitimate use.
   - Confirm Marie's existing book ids (all numeric, e.g.
     `1777428389536`) still resolve through the helper without
     throwing.
   - Confirm a legitimate transfer import with normal nested audio
     paths (e.g. `chapter01/section01.mp3`) still imports cleanly.
   - Confirm `saveManuscriptSource`, `readManuscriptSource`,
     `rescan-book-pdf`, and `rescan-book-page-map` IPC handlers still
     work for normal calls.
   - Verdict: no-regression / regression-found.

D. Failure mode is the right shape.
   - Confirm the helper THROWS on bad input (not silently sanitizing).
   - Confirm the throw propagates to the IPC reply so the renderer
     can show the user a clear error.
   - Confirm a partially-bad transfer (one section's audio path tries
     to escape) aborts the WHOLE transfer rather than silently keeping
     the good sections. (This is the verifier's stated preference —
     loud refusal beats silent acceptance for a P0 security bug.)
   - Verdict: fails-loudly / fails-quietly.

Also explicitly check the verifier's previously-listed misses:

- "10.2 misses the audio rewrite at main.js:456 AND the manuscript
  rewrite at main.js:1656." — confirm both call sites now use the
  shared helper, not just one.
- "10.3 does not explicitly cover Quill" — confirm Quill's storage
  paths are either already safe (no raw-id-to-path) or have been
  hardened too.
- "10.3 does not address `Save Data/Prep Manuscript Sources/` or any
  Prep equivalent." — confirm there is no parallel Prep code path
  that takes a raw id and joins it into a Save Data subdirectory.
- "Existing ids that contain `.` or whitespace" — Marie's scan shows
  all 22 of her real book ids are numeric. Confirm the helper does
  not falsely reject any of them.

Try ALL of these crafted inputs against the helper and report the
verdict:

  '../../etc/passwd.docx'                  → must throw
  '/etc/passwd.docx'                       → must throw
  'C:\\Windows\\evil.docx'                 → must throw
  '..\\..\\Windows\\evil.docx'             → must throw
  'file:///etc/passwd'                     → must throw
  'good\0bad.docx'                         → must throw
  ''                                       → must throw
  '...'                                    → must NOT throw (it's a
                                              filename, not `..`)
  '..docx'                                 → must NOT throw (filename)
  '1777428389536.docx'                     → must NOT throw
  'abc-def-123.docx'                       → must NOT throw
  'chapter01/section01.mp3'                → must NOT throw
  'foo/../../bar.mp3'                      → must throw
  '////'                                   → must throw
  '.'                                      → must throw

Output your report to:

  docs/audits/STJOHN_BLOCK_3A_VERIFICATION_REPORT.md

Use this exact structure:

  # Block 3a Verification Report

  ## A. Helper correctness
  - Verdict: helper-correct / helper-has-hole
  - Evidence: <line refs and reasoning>
  - Bugs found: <list, one per finding>

  ## B. Call-site coverage
  - Per-site verdicts (protected / unprotected / not-applicable):
    - getManuscriptSourcePath: ...
    - rewriteBookAudioPathsForTransferImport: ...
    - transfer-import manuscript path: ...
    - other sites you found: ...
  - Missed sites the implementer did not cover: <list>

  ## C. No-regression check
  - Verdict: no-regression / regression-found
  - Evidence per legitimate-use scenario:
    - Marie's numeric book ids: ...
    - Legitimate transfer import: ...
    - Existing IPC handlers: ...

  ## D. Failure-mode shape
  - Verdict: fails-loudly / fails-quietly
  - Evidence: <where the throw goes, what the renderer sees>

  ## Crafted-input test grid
  - One row per input above with: input | expected | actual | pass/fail.

  ## Top 3 remaining risks for Marie
  - 1. ...
  - 2. ...
  - 3. ...

  ## Overall recommendation
  - confirm / proceed-with-concerns / reject / needs-live-test
  - One sentence saying what to do next.

  ## Confidence
  - Plain English only. Do not write a percentage. Use:
    - "fully traced in code"
    - "code reads right but did not run"
    - "could not verify because <reason>"

If you are unsure about any verdict, write `unclear` and explain why.
Marie prefers an honest unknown over a confident wrong answer.

When the report is filed, post a short Marie-facing chat reply with:

- Helper correct? yes / no / concerns
- All call sites covered? yes / no / list misses
- Any legitimate use that would break? yes / no
- Safe to ship Block 3a as-is? yes / no / what to fix first
- Top single risk for Marie to know about
- One sentence on what you could not verify
```
