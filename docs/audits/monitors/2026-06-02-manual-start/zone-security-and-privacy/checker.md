# Zone Checker - Zone 14 Security and Privacy

- Date/time: 2026-06-02 20:15 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for
  the security/privacy zone only; preserve disagreements; run focused
  read-only follow-up where needed; dedupe before touching the master report
  or bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-security-and-privacy/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-security-and-privacy/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-security-and-privacy/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main disagreements around:

- `main.js`
- `preload.js`
- `app/page.js`
- `app/lib/manuscriptPaging.js`
- `app/components/ChapterReader.js`
- `app/phone/_components/renderReaderContent.js`
- `app/components/ProofingReader.js`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p'` on the three security/privacy inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba main.js \| sed -n '320,390p;440,470p;1074,1098p;1177,1230p;1404,1448p;1638,1666p;1718,1748p'` | 0 |
| `nl -ba preload.js \| sed -n '1,80p'` | 0 |
| `nl -ba app/page.js \| sed -n '1194,1235p'` | 0 |
| `nl -ba app/lib/manuscriptPaging.js \| sed -n '173,197p'` | 0 |
| `nl -ba app/components/ChapterReader.js \| sed -n '136,156p'` | 0 |
| `nl -ba app/phone/_components/renderReaderContent.js \| sed -n '1,80p'` | 0 |
| `nl -ba app/components/ProofingReader.js \| sed -n '920,965p;1416,1430p'` | 0 |
| `rg -n "webSecurity: false\|localfile://\|registerFileProtocol\\('localfile'\|get-audio-url\|read-audio-file\|joinPortablePath\|getManuscriptSourcePath\|manuscriptSource\\.relativePath\|transfer import" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` | 0 |
| `node -e "const path=require('path'); ..."` path-join escape check | 0 |

## Merged Findings

### PASS - The main cloud table and audio-upload privacy guardrails still hold

All three inspectors agreed on the core cloud privacy shape, and this checker
pass did not find a contradiction:

- The shared Supabase client still hard-whitelists the six approved StJohn
  tables.
- `.rpc(...)` calls are still blocked at the shared client layer.
- Proof and Quill cloud writes still strip audio paths, blobs, buffers, and
  similar audio-bearing fields before upload.

Evidence:

- `packages/cloud-sync/client.js:22-79`
- `packages/cloud-sync/audio-guard.js:12-84`
- `packages/cloud-sync/proof-sync.js:46-57`
- `packages/cloud-sync/quill-sync.js:27-36`

### CONFIRMED BUG - The Electron shell and audio bridge can expose arbitrary local files to the renderer

All three inspectors independently raised the same core boundary problem, and
the checker follow-up confirms it:

- The desktop window launches with `webSecurity: false`.
- `decodeStoredFilePath()` returns raw absolute paths unchanged when a stored
  path is not one of the app's portable schemes.
- `get-audio-url()` and `read-audio-file()` accept any resolved path that
  exists.
- The `localfile://` protocol handler serves the decoded file path without an
  extension or root allowlist.
- Preload exposes these calls to renderer code.
- Backup import merges unvalidated book JSON directly into app state, so
  crafted stored audio paths can reach the same bridge without any
  sanitization step.

Checker assessment: confirmed privacy/security bug. Logged as
`SAS-AUD-20260602-015`.

Evidence:

- `main.js:367-385`
- `main.js:1179-1190`
- `main.js:1225-1228`
- `main.js:1408-1442`
- `preload.js:4-29`
- `app/page.js:1198-1204`

### CONFIRMED BUG - Transfer import manifest paths can escape the copied transfer folder

Inspectors A and C both flagged this, and the checker follow-up confirms the
escape path:

- Transfer-audio import rebuilds `relativeAudioPath` with `path.join(importDir,
  ...segments)` after only splitting on `/` and dropping empty pieces.
- Manuscript transfer import rebuilds `manuscriptSource.relativePath` the same
  way.
- Neither path is normalized back against `importDir` or checked to remain
  inside it.
- A focused read-only `node` check showed the current helper shape allows
  `..` traversal to escape the intended root.
- The manuscript import path is then read immediately if the resulting file
  exists.

Checker assessment: confirmed import-boundary bug. Logged as
`SAS-AUD-20260602-016`.

Evidence:

- `main.js:323-327`
- `main.js:444-463`
- `main.js:1654-1662`

### CONFIRMED BUG - Raw book ids can escape manuscript-source storage paths

Only Inspector A called this out directly, but the checker follow-up confirms
the issue:

- Backup import parses JSON and merges book objects directly into state.
- `normalizeBookPaging()` preserves the imported `id`.
- `getManuscriptSourcePath()` builds the source-doc path from raw `bookId`
  using `path.join(...)` with no root check.
- `save-manuscript-source`, `rescan-book-pdf`, and `rescan-book-page-map`
  then use that path unchanged.
- A focused read-only `node` check showed a path-segment `bookId` can escape
  `Save Data/Manuscript Sources/`.

Checker assessment: confirmed local-path boundary bug. Logged as
`SAS-AUD-20260602-017`.

Evidence:

- `app/page.js:1198-1204`
- `app/lib/manuscriptPaging.js:173-197`
- `main.js:1078-1094`
- `main.js:1721-1742`

### AUDIT UNCLEAR - No separate renderer HTML-injection bug is confirmed in this checker pass

Inspector C correctly noted that desktop and phone reader helpers parse stored
HTML in the renderer, and Inspector B correctly noted that the Proof quote sink
they checked escapes its edited content. The checker follow-up confirms both
points, but this run did not prove a current source-to-script exploit path for
imported manuscript HTML.

Checker assessment: do not open a separate bug-log item yet. Keep this as
impact context for `SAS-AUD-20260602-015` and revisit only with a safe
temp-only hostile-markup repro.

Evidence:

- `app/components/ProofingReader.js:927-960`
- `app/components/ProofingReader.js:1424`
- `app/components/ChapterReader.js:145-148`
- `app/phone/_components/renderReaderContent.js:31-33`

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: searched for `webSecurity: false`,
  `localfile://`, `get-audio-url`, `read-audio-file`, transfer-manifest path
  handling, and manuscript-source path terms. No exact existing bug matched
  these three local-file boundary findings.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: found adjacent but non-duplicate
  overlap with `SAS-AUD-20260530-001`, which is the existing temp-isolation
  Electron save-data mirror issue rather than the renderer/file-boundary
  problems confirmed here.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: found adjacent watchlist overlap
  with `SAS-AUD-20260602-003`, but this checker pass did not add new proof
  that would promote the pending-queue scoping concern beyond its current
  watchlist state.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: found no earlier accepted
  security/privacy checker section, so this run appends one new checker
  section rather than updating an older zone-checker entry.

## Overall Assessment

- Zone status: checked
- Audit result: three new confirmed security/privacy bugs; no product-code
  edits; no real-file or live exploit run in this checker pass
- Confidence: high
- Why not higher: the findings are source-traced and deterministic, but this
  zone did not include a safe temp-only live Electron exploit repro

## Next Steps

- Safe temp-only Electron repro: import a crafted backup that points an audio
  path at a non-audio local file and confirm the bridge blocks it after
  hardening.
- Safe temp-only transfer repro: build a transfer manifest with `../` path
  segments for bundled audio and manuscript entries and confirm the import
  rejects them.
- Safe temp-only manuscript-source repro: import a crafted book id with path
  segments, run a rescan or reattach flow, and confirm the app stays inside
  `Save Data/Manuscript Sources/`.
- No later checker-ready zone currently exists. Wait for the first later
  active-priority zone where `inspector-a.md`, `inspector-b.md`, and
  `inspector-c.md` all exist and no `checker.md` exists. The next likely
  candidate is `zone-phone-script` once Inspector C arrives.
