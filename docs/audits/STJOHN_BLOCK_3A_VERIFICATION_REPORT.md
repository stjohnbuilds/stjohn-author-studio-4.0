# Block 3a Verification Report

Date: 2026-06-03
Reviewer: independent verification, read-only.
Scope: Block 3a — path-escape lockdown for the two confirmed P0
findings `SAS-AUD-20260602-016` (transfer manifest path escape) and
`SAS-AUD-20260602-017` (raw backup book id → manuscript source escape).
Block 3a does NOT cover `SAS-AUD-20260602-015` (the broader `localfile://`
audio bridge); that is Block 3b / item 10.1 and is explicitly out of
scope for this report.

## A. Helper correctness

- Verdict: **helper-correct** (with one nuance noted below).
- Evidence:
  - [main.js:31-39](main.js:31) `assertResolvedInsideDir(rootDir, candidate)`
    resolves both root and candidate via `path.resolve`, builds
    `rootWithSep` with the OS separator suffix, and throws unless the
    resolved path equals root or starts with `rootWithSep`. This is the
    standard prefix-with-separator check, which prevents the classic
    `/save/Foo` matching `/save/FooBar` mistake.
  - [main.js:40-65](main.js:40) `safeJoinInsideDir(rootDir, relativePath)`
    layers the following checks in order:
    1. Non-string or empty → throw "empty input".
    2. `^[\\/]` → throw "absolute input". Catches `/etc/passwd`,
       `\\\\server\\share`, `////`, and any other leading separator.
    3. `^[a-zA-Z][a-zA-Z0-9+.-]*:` → throw "scheme-like input". Catches
       `file://...`, `http:...`, `C:\\...`, `data:...`.
    4. Split on `/[\\/]+/`, filter empties. Empty-after-split → throw
       "no usable segments".
    5. Per-segment loop rejects `..`, `.`, and any segment containing
       `\0`.
    6. Hands the joined relative path to `assertResolvedInsideDir` as
       the final defence in depth.
  - The combined early-reject + final resolve check is the
    double-defence pattern the previous verifier called for in
    [STJOHN_FIX_PLAN_VERIFICATION_REPORT.md:82](docs/audits/STJOHN_FIX_PLAN_VERIFICATION_REPORT.md:82).
  - I executed the helper against every input in the crafted-input
    grid below; all 15 produced the expected verdict (15/15 PASS).
- Bugs found (none material; nuance only):
  - `assertResolvedInsideDir(rootDir, candidate)` accepts the
    case where `resolved === root` (the root itself). Reachable only
    when `safeJoinInsideDir` is bypassed (the per-segment loop blocks
    `.`, and the segments cannot be empty), so this is a latent
    permissiveness, not a current escape. If a future caller passes a
    relative path that resolves to exactly the root, it will be
    allowed. Not exploitable today, but worth noting if
    `assertResolvedInsideDir` is ever called directly without
    `safeJoinInsideDir` in front of it.

## B. Call-site coverage

- Per-site verdicts:
  - **`getManuscriptSourcePath`** — [main.js:1122-1128](main.js:1122):
    **protected.** Builds the manuscript path via
    `safeJoinInsideDir(getManuscriptSourcesDir(), \`${String(bookId)}.docx\`)`.
    A crafted `bookId` like `'../../etc/passwd'` throws synchronously
    inside the helper before any `fs` call runs.
  - **`saveManuscriptSource` (IPC `save-manuscript-source`)** —
    [main.js:1130-1135](main.js:1130) and the IPC handler at
    [main.js:1772-1780](main.js:1772): **protected by virtue of
    `getManuscriptSourcePath`**. The helper throw propagates synchronously
    out of `saveManuscriptSource` → out of the `async` IPC handler →
    Electron rejects the renderer's `invoke()` promise. No `try/catch`
    swallows the error.
  - **`readManuscriptSource`** — [main.js:1137-1143](main.js:1137): same —
    protected via `getManuscriptSourcePath`.
  - **`rescan-book-pdf`** — [main.js:1782-1789](main.js:1782): protected
    via `readManuscriptSource(bookId)` → `getManuscriptSourcePath(bookId)`.
  - **`rescan-book-page-map`** — [main.js:1791-1808](main.js:1791): same
    chain — protected.
  - **`rewriteBookAudioPathsForTransferImport`** —
    [main.js:485-513](main.js:485): **protected.** Inside the
    `chapter.sections.map(section => ...)` callback, line 500 calls
    `safeJoinInsideDir(importDir, String(relativeAudioPath))`. The helper
    only runs when `relativeAudioPath` is truthy (legitimate "no audio"
    sections are skipped). A throw aborts the `.map`, which aborts the
    whole rewrite, which aborts the `import-transfer-bundle` IPC handler.
    (See Verdict D.)
  - **Transfer-import manuscript path** — [main.js:1702-1708](main.js:1702):
    **protected.** Uses `safeJoinInsideDir(importDir, String(manuscriptRelativePath))`
    when `manuscriptRelativePath` is truthy. A throw aborts the import
    handler. Note: the legitimate "no manuscript" case is handled by
    the `manuscriptRelativePath ? ... : null` guard, so empty/missing
    manifests still import cleanly.
  - **Transfer-import re-use inside the same handler** —
    [main.js:1606](main.js:1606): the export path calls
    `getManuscriptSourcePath(book.id)` for the **outgoing** transfer
    bundle. Since `book.id` here is freshly assigned `Date.now()` for
    new books, this site is safe today by the same helper. Protected.
  - **`encodeStoredFilePath`** —
    [main.js:371-384](main.js:371): not-applicable for Block 3a. It
    converts an already-resolved absolute path back into `data://` /
    `gdrive://` form for storage; the input is the safe output of
    `safeJoinInsideDir`. The reverse direction (`decodeStoredFilePath`)
    is a separate concern — see "missed sites" below.
- Missed sites the implementer did not cover:
  - **`importBooks` does not sanitize backup-imported book ids before
    persisting them.** [app/page.js:1228-1245](app/page.js:1228) merges
    the raw parsed JSON into state and calls `persist(merged)`. A
    crafted backup with `"id": "../../etc/passwd"` will reach
    `books.json` verbatim. The runtime escape is still blocked because
    `getManuscriptSourcePath` throws when that id is later passed in,
    but the bad id sits in saved state and renders that book unusable
    for save/rescan operations until manually scrubbed. The original
    verifier explicitly flagged this in
    [STJOHN_FIX_PLAN_VERIFICATION_REPORT.md:83](docs/audits/STJOHN_FIX_PLAN_VERIFICATION_REPORT.md:83):
    "Either alone would still leak — e.g. id-only regen leaves rescan
    vulnerable if the UI ever sends a raw id; root-check-only leaves
    saved state poisoned with a bad id." Block 3a implements only the
    root-check half. **Not a security escape, but a Strategy-A
    omission.**
  - **`decodeStoredFilePath` `data://` and `gdrive://` branches do not
    use `safeJoinInsideDir`.** [main.js:412-426](main.js:412) calls
    `joinPortablePath(root, relativePath)` which filters empty segments
    but does **not** reject `..`. A crafted backup that stores
    `audioPaths.darwin: 'data://../../../etc/passwd'` would bypass the
    Block 3a helper and resolve outside the data root when the renderer
    later calls `get-audio-url` or `read-audio-file`. This is
    technically the audio bridge bug (`SAS-AUD-20260602-015` / item
    10.1), which Block 3a explicitly does not cover. Flagging it here
    because the same crafted-backup attack model bridges 10.1 and 10.3.
  - **`localfile://` protocol handler** —
    [main.js:1273-1276](main.js:1273): no validation. Renderer can
    construct any `localfile://<encoded-path>` and the protocol returns
    bytes via `callback({ path: filePath })`. Confirmed still
    unprotected. Out of Block 3a scope; called out for completeness.
- Quill / Prep / Duet parallel path-builders:
  - Searched for `Quill Sources`, `Prep Sources`, `Prep Manuscript
    Sources`, and equivalents under `main.js`, `app/`, and `packages/`.
    **None found.** Quill writes to `quillDataPath()` and friends;
    Prep writes to `prepDataPath()`; Duet writes to `prebuildDataPath()`.
    All three are fixed-root JSON files; none of them build a per-id
    file path from external data. So there is **no parallel
    `Save Data/<X> Sources/` path that needs the helper today**. The
    previous verifier's "10.3 does not address Save Data/Prep
    Manuscript Sources/" concern is **resolved as not-applicable** —
    that directory does not exist in the current codebase.
  - Quill `delete-quill-project-data` IPC at
    [main.js:1389-1393](main.js:1389) filters by `projectId` in memory
    only; no file path is built from `projectId`. Safe.
- Backup-import path: protected at runtime by the `getManuscriptSourcePath`
  helper, but **not** at the import boundary — see "missed sites" above.

## C. No-regression check

- Verdict: **no-regression** for normal use today.
- Evidence per legitimate-use scenario:
  - **Marie's numeric book ids.** Probed every `books.json` on this
    machine —
    `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Save Data/books.json`,
    `~/Library/Application Support/stjohn-author-studio-4.0/books.json`,
    `~/Library/Application Support/proofer-5-0/books.json`,
    `~/Library/Application Support/proofer-4-0/books.json`,
    `~/Library/Application Support/script-and-sync/books.json`,
    `~/Library/Application Support/proofer-3-0/books.json`. Total of
    **28 books across all stores; all 28 ids pass
    `safeJoinInsideDir`**. Every id is a numeric `Date.now()` value
    (`typeof id === 'number'`); `String(id) + '.docx'` always yields
    `<13-digit number>.docx`, which contains no separators, no `..`,
    no scheme prefix, and no null byte. The example
    `1777428389536.docx` cited in the prompt resolves cleanly to
    `<rootDir>/1777428389536.docx`. **Zero rejections.**
  - **Legitimate nested transfer audio paths.** Inputs like
    `chapter01/section01.mp3` are correctly split into two segments
    and joined inside `importDir` without throwing (verified in the
    crafted-input grid below).
  - **Existing IPC handlers.** Walked
    `save-manuscript-source` ([main.js:1772](main.js:1772)),
    `rescan-book-pdf` ([main.js:1782](main.js:1782)), and
    `rescan-book-page-map` ([main.js:1791](main.js:1791)). All three
    derive the path through `getManuscriptSourcePath`, which for a
    legitimate numeric id returns the same path layout as before
    Block 3a (`<saveDir>/Manuscript Sources/<id>.docx`). The only
    behaviour change is that **a malicious id now throws**, where
    before it would have read or written outside the directory.

## D. Failure-mode shape

- Verdict: **fails-loudly** for the transfer-import path; **mostly
  fails-loudly** for the backup/manuscript-source path with one quiet
  hole (poisoned ids persisting into `books.json`).
- Evidence:
  - The helper throws plain `Error` objects with descriptive messages
    ("Refused unsafe path: contains `\"..\"`.", "absolute input ...",
    "scheme-like input ...", "no usable segments.", "empty input.").
  - **Transfer import — whole-transfer abort:** the helper is called
    inside `chapters[].sections.map()` at
    [main.js:500](main.js:500). JavaScript's `.map` does not catch
    exceptions; a throw in one section propagates synchronously out of
    the whole nested map chain, aborts
    `rewriteBookAudioPathsForTransferImport`, and aborts the
    `ipcMain.handle('import-transfer-bundle', ...)` callback. The
    `async` handler's rejected promise is sent to the renderer via
    Electron's IPC layer. **No good sections are kept** if one bad
    section is present. This matches the verifier's stated
    "loud refusal beats silent acceptance" preference.
    - Minor caveat: the import handler copies `sourceDir` into
      `importDir` via `copyDirectoryContents` at
      [main.js:1687](main.js:1687) **before** running the rewrite.
      If the rewrite then throws, the copied folder is orphaned under
      `Save Data/Transfer Imports/`. Not a security risk (the files
      are the user's own copy of the would-be-malicious bundle, sitting
      in the user's data dir), but it could surprise Marie as
      leftover disk usage. Worth noting for a follow-up cleanup.
  - **Manuscript-source IPC — propagates to renderer:** none of the
    three IPC handlers (`save-manuscript-source`, `rescan-book-pdf`,
    `rescan-book-page-map`) wrap the helper call in `try/catch`. An
    `Error` thrown by `safeJoinInsideDir` flows directly out of the
    `async` handler. The renderer's `await window.electron.<handler>(...)`
    rejects with the same error message, where existing UI calls
    `alert()` or shows a banner.
  - **Backup-import — quiet at the import boundary:**
    [app/page.js:1228-1244](app/page.js:1228) wraps the whole import
    in `try { ... } catch { alert('Invalid file.'); }`. A crafted
    backup with `"id": "../../etc/passwd"` parses as valid JSON, so the
    catch never fires. The bad id reaches `persist(merged)` and is
    written to `books.json`. The first later attempt to save/read/
    rescan THAT book throws loudly, but the bad id has by then become
    part of saved state. As noted in B (Missed sites), this matches
    Strategy C of roadmap 10.3 but not Strategy A; the original
    verifier called for both.

## Crafted-input test grid

Ran a Node reproduction of the helper against `/tmp/probe-root`. 15/15
inputs matched the expected verdict.

| Input | Expected | Actual | Pass/Fail |
|-------|----------|--------|-----------|
| `'../../etc/passwd.docx'` | throw | throw: `Refused unsafe path: contains "..".` | PASS |
| `'/etc/passwd.docx'` | throw | throw: `Refused unsafe path: absolute input "/etc/passwd.docx".` | PASS |
| `'C:\\Windows\\evil.docx'` | throw | throw: `Refused unsafe path: scheme-like input "C:\\\\Windows\\\\evil.docx".` | PASS |
| `'..\\..\\Windows\\evil.docx'` | throw | throw: `Refused unsafe path: contains "..".` | PASS |
| `'file:///etc/passwd'` | throw | throw: `Refused unsafe path: scheme-like input "file:///etc/passwd".` | PASS |
| `'good\\0bad.docx'` | throw | throw: `Refused unsafe path: contains "good\\u0000bad.docx".` | PASS |
| `''` | throw | throw: `Refused unsafe path: empty input.` | PASS |
| `'...'` | ok | ok: `/tmp/probe-root/...` | PASS |
| `'..docx'` | ok | ok: `/tmp/probe-root/..docx` | PASS |
| `'1777428389536.docx'` | ok | ok: `/tmp/probe-root/1777428389536.docx` | PASS |
| `'abc-def-123.docx'` | ok | ok: `/tmp/probe-root/abc-def-123.docx` | PASS |
| `'chapter01/section01.mp3'` | ok | ok: `/tmp/probe-root/chapter01/section01.mp3` | PASS |
| `'foo/../../bar.mp3'` | throw | throw: `Refused unsafe path: contains "..".` | PASS |
| `'////'` | throw | throw: `Refused unsafe path: absolute input "////".` | PASS |
| `'.'` | throw | throw: `Refused unsafe path: contains ".".` | PASS |

Total: 15 pass / 0 fail / 15 total. The script is at `/tmp/block3a-helper-probe.js` and the helper logic was copied verbatim from `main.js:31-65` (no production code modified).

## Top 3 remaining risks for Marie

1. **`importBooks` does not regenerate unsafe book ids on backup
   import.** A crafted backup with `"id": "../../etc/passwd"` will be
   persisted to `books.json`. The runtime escape is blocked (good),
   but the book becomes a permanent broken entry whose rescan/save
   always throws. This is the Strategy-A half of roadmap item 10.3
   that the original verifier called out as needed *in addition to*
   the root-check Strategy C. Block 3a implemented only the
   root-check half. Severity: low security risk, moderate UX risk
   (poisoned `books.json`).

2. **The `data://` and `gdrive://` decoders in `decodeStoredFilePath`
   ([main.js:412-426](main.js:412)) do not run through
   `safeJoinInsideDir`.** Their `joinPortablePath` helper filters
   empty segments but does not reject `..`. A crafted backup that
   stores `audioPaths.darwin: 'data://../../../etc/passwd'` reaches
   the renderer via `get-audio-url`/`read-audio-file` and resolves
   outside the data root. This is properly the audio bridge bug
   (`SAS-AUD-20260602-015` / item 10.1), which is explicitly out of
   Block 3a scope — but it shares the "crafted backup data drives a
   path build" attack model with 10.3. **Block 3a does not need to
   own this; just confirming it is still open.**

3. **Orphaned transfer-import folder on bad-transfer abort.**
   `copyDirectoryContents(sourceDir, importDir)` runs at
   [main.js:1687](main.js:1687) **before** the audio/manuscript
   rewrite. If the rewrite throws, the copied folder under
   `Save Data/Transfer Imports/` is left behind. Not a security
   problem (it's a copy of files the user already chose to import),
   but disk-space surprise for Marie and a possible source of stale
   data in the data folder. A cleanup `try/finally` would close it.

## Overall recommendation

- **confirm**
- Block 3a closes the two P0 path-escape findings the prompt named
  (`SAS-AUD-20260602-016`, `SAS-AUD-20260602-017`) at every previously
  vulnerable call site and on every input I could construct. Marie
  can ship it as-is for the runtime escape risk. Two follow-up items
  remain — (1) regenerating unsafe book ids at `importBooks` time so
  `books.json` stays clean, and (2) extending `safeJoinInsideDir`
  coverage to the `decodeStoredFilePath` `data://`/`gdrive://` decoders
  (audio bridge, item 10.1) — but neither is a Block 3a defect; both
  are pre-existing items the original verifier already flagged.

## Confidence

- **fully traced in code** for the helper itself, every call site in
  `main.js`, the crafted-input grid (verified by running the helper
  in a Node probe), and the regression check against Marie's 28 real
  book ids across all save locations on this machine.
- **code reads right but did not run** for the live transfer-import
  flow (no temp-Electron run was performed in this audit). The throw
  propagation through `.map` and the `async` IPC handler is a direct
  language guarantee, but a live "import a crafted transfer bundle and
  watch the alert" check was not performed.
- **could not verify because the Quill / Prep / Duet code paths in
  this commit do not have any per-id file builders** — that's a
  negative finding from grep, not a positive proof, but the grep was
  comprehensive (`Sources`, `quill-sources`, `prep-sources` across
  `main.js`, `app/`, `packages/`).
