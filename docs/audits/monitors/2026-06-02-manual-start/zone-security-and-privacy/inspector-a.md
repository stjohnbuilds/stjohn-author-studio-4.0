# Inspector A - Zone 14 - Security and privacy

- Date: 2026-06-02 19:36:51 PDT
- Campaign: `2026-06-02-manual-start`
- Status: complete

## Scope

Read-only source audit of security and privacy boundaries across Supabase
access, audio/cloud separation, auth teardown, Electron preload exposure,
local file access, transfer import paths, and manuscript-source storage. No
product code edits. No live exploit attempt. No real Save Data, real cloud,
or packaged app launch.

## Source docs checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `CLAUDE.md`
- `TODO.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/monitors/_run_state/inspector-a.lock.md`

## Commands run with exit codes

| Command | Exit |
|---|---:|
| `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` | 0 |
| `sed -n '1,240p' docs/BUILD_PLAN_V4.md && sed -n '1,240p' docs/APP_STRUCTURE.md` | 0 |
| `sed -n '261,420p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| `sed -n '1,220p' READ ME FIRST - OPEN THIS.txt && sed -n '1,220p' HANDOFF.md && sed -n '1,220p' CLAUDE.md && sed -n '1,220p' TODO.md` | 0 |
| `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md && sed -n '1,220p' docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` | 0 |
| `find docs/audits/monitors -maxdepth 3 -type f | sort` | 0 |
| `date '+%Y-%m-%d %H:%M:%S %Z'` | 0 |
| `git status --short` | 0 |
| `npm test -- --test-reporter=spec` | 0 |
| `sed -n '1,240p' docs/CLOUD_SCHEMA.md && sed -n '1,260p' docs/CLOUD_SAFETY_AUDIT.md` | 0 |
| `sed -n '1,260p' package.json` | 0 |
| `rg -n "process\\.env|SUPABASE|NEXT_PUBLIC|service_role|anon key|apikey|token" app packages main.js preload.js scripts tests` | 0 |
| `rg -n "supabase\\.storage|storage\\.from|upload\\(|createSignedUrl|download\\(|from\\('" app packages main.js preload.js scripts tests` | 0 |
| `rg -n "ipcMain\\.handle|contextBridge\\.exposeInMainWorld|shell\\.|openExternal|exec\\(|spawn\\(|rmSync|unlinkSync|fs\\.writeFile|dialog\\.show(Open|Save)Dialog" main.js preload.js scripts app packages` | 0 |
| `rg -n "audioPath|audioPaths|audioUrl|audioBlob|audioDataUrl|audioBuffer|audioBytes|audioBase64|sourceAudioPath|sourceAudioBytes|stripAudioPaths|slimBookForCloud|slimProjectForCloud" packages app tests` | 0 |
| `sed -n '1,220p' packages/cloud-sync/client.js && sed -n '1,220p' packages/cloud-sync/audio-guard.js && sed -n '1,220p' packages/cloud-sync/cloud-slim.js` | 0 |
| `sed -n '1,260p' packages/cloud-sync/proof-sync.js && sed -n '1,320p' packages/cloud-sync/quill-sync.js` | 0 |
| `sed -n '1,220p' preload.js && sed -n '1,260p' main.js && sed -n '1240,1765p' main.js && sed -n '1820,2125p' main.js` | 0 |
| `sed -n '1,260p' packages/cloud-sync/account.js && sed -n '1,280p' packages/cloud-sync/flag-queue.js && sed -n '1,260p' packages/cloud-sync/tombstones.js` | 0 |
| `sed -n '470,860p' app/page.js && sed -n '560,940p' app/phone/page.js` | 0 |
| `rg -n "decodeStoredFilePath|encodeStoredFilePath|sanitizeFileName|ensureUniqueFilePath|getManuscriptSourcePath|readManuscriptSource|saveManuscriptSource|copyDirectoryContents|findTransferManifestPath|toPortableRelativePath|rewriteBookAudioPathsForTransferImport" main.js` | 0 |
| `test -f .env.local && echo EXISTS; ls -1 'Script and Sync Releases'` | 0 |
| `sed -n '1390,1465p' main.js` | 0 |
| `rg -n "webSecurity: false|localfile://|registerFileProtocol|read-audio-file|get-audio-url|choose-data-location|showOpenDialog\\(|showSaveDialog\\(|import-transfer-bundle|export-transfer-bundle" main.js preload.js` | 0 |
| `rg -n "countAllFlagQueues|countFlagQueue\\(|applyFlagQueueToBook\\(|recordPendingFlag\\(|recordDeletedFlag\\(|clearPendingFlag\\(|clearDeletedFlag\\(" app/page.js app/phone/page.js packages/cloud-sync` | 0 |
| `nl -ba main.js | sed -n '300,390p' && sed -n '440,470p' && sed -n '1074,1095p' && sed -n '1180,1230p' && sed -n '1390,1450p' && sed -n '1634,1664p'` | 0 |
| `nl -ba packages/cloud-sync/client.js && nl -ba packages/cloud-sync/audio-guard.js && nl -ba packages/cloud-sync/proof-sync.js && nl -ba packages/cloud-sync/quill-sync.js` | 0 |
| `nl -ba app/page.js | sed -n '500,840p' && nl -ba app/phone/page.js | sed -n '1528,1765p' && nl -ba packages/cloud-sync/flag-queue.js | sed -n '1,210p'` | 0 |
| `rg -n "supabase\\.storage|storage\\.from|createSignedUrl|download\\(" app packages main.js preload.js scripts tests; printf 'exit=%s\n' $?` | 0 |
| `rg -n "service_role|SUPABASE_SERVICE|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|rpc\\(" app packages main.js preload.js scripts tests; printf 'exit=%s\n' $?` | 0 |

## Evidence paths

- `packages/cloud-sync/client.js:14-18`
- `packages/cloud-sync/client.js:22-60`
- `packages/cloud-sync/audio-guard.js:12-84`
- `packages/cloud-sync/proof-sync.js:46-57`
- `packages/cloud-sync/quill-sync.js:27-35`
- `app/page.js:509-527`
- `app/page.js:639-661`
- `app/page.js:821-828`
- `app/phone/page.js:1554-1570`
- `app/phone/page.js:1707-1723`
- `packages/cloud-sync/flag-queue.js:23-48`
- `packages/cloud-sync/flag-queue.js:151-159`
- `main.js:323-327`
- `main.js:367-385`
- `main.js:444-463`
- `main.js:1078-1094`
- `main.js:1184-1189`
- `main.js:1225-1227`
- `main.js:1408-1442`
- `main.js:1654-1661`
- `preload.js:4-43`
- `docs/CLOUD_SCHEMA.md:24-42`
- `docs/APP_STRUCTURE.md:18-24`
- `docs/APP_STRUCTURE.md:143-165`

## Pass items

1. The cloud client is tightly narrowed on paper and in code. It uses the
   browser publishable/anon key path only, whitelists just the six StJohn
   tables, and blocks any `rpc()` call outright. I found no `service_role`
   usage and no non-whitelisted table access path in the shared client.
2. The app’s core cloud uploads do honor the audio privacy rule. Both Proof
   and Quill call `stripAudioPaths()` before slimming/upload, and the audio
   guard removes path/blob/base64-style keys while keeping only filename-level
   metadata for local phone matching.
3. Desktop auth teardown is reasonably defensive. On sign-out or missing
   session, the shell clears in-memory books, active UI state, audio state,
   proof-pull state, and the per-tab push caches before the next signed-in
   session starts.

## Fail items

1. The Electron bridge currently gives the renderer broad arbitrary-file read
   power instead of audio-only access. `decodeStoredFilePath()` returns raw
   absolute paths, `get-audio-url()` and `read-audio-file()` accept any path
   that exists, `localfile://` serves whatever path is encoded, and the window
   runs with `webSecurity: false`. There is no extension allowlist, no
   directory allowlist, and no protocol-side path validation. That means any
   renderer compromise or crafted local state that can reach these bridge calls
   can turn the app into a local file reader, not just an audio player.
   Evidence: `main.js:367-385`, `main.js:1184-1189`, `main.js:1225-1227`,
   `main.js:1408-1442`, `preload.js:4-43`.
2. Transfer import trusts manifest relative paths too loosely and can escape
   the copied import folder. `joinPortablePath()` and the transfer import
   helpers split on `/` but do not reject `..` segments, so a crafted transfer
   manifest can point `audioPaths` or `manuscriptSource.relativePath` outside
   `importDir`. Because the import code then reads that path if it exists, this
   is a deterministic path-traversal surface in the current importer.
   Evidence: `main.js:323-327`, `main.js:444-463`, `main.js:1639-1661`.
3. Manuscript source storage also trusts raw `bookId` too much. The stored
   DOCX path is built with `path.join(getManuscriptSourcesDir(), \`${bookId}.docx\`)`
   and no sanitization, so a manipulated `bookId` containing path segments can
   escape the intended `Manuscript Sources` directory on read/write/rescan
   flows. That is another local path-traversal surface in the Electron layer.
   Evidence: `main.js:1078-1094`.

## Watchlist items

1. The pending Proof flag queue is still global in browser storage rather than
   user-scoped. The storage key is one shared `stjohn-cloud-flag-queue-v1`, and
   the phone banner totals every queued project with `countAllFlagQueues()`.
   That does not prove cross-account flag leakage by itself, but on a shared
   device it is still an avoidable privacy/safety smell and matches the shape
   of existing queue-scope concerns. Evidence: `packages/cloud-sync/flag-queue.js:23-48`,
   `packages/cloud-sync/flag-queue.js:151-159`, `app/phone/page.js:1554-1570`,
   `app/phone/page.js:1707-1723`.
2. I did not find any `supabase.storage` use for audio upload, which is good,
   but the local Electron side remains the larger risk surface because of the
   wide file-path bridge noted above.
3. `npm test -- --test-reporter=spec` passed 13/13, but the current automated
   suite does not appear to cover these Electron path-boundary cases, so the
   security findings above are presently source-traced only.

## What was not tested

- No live Electron or packaged app exploit attempt.
- No malicious transfer bundle import.
- No live Supabase sign-in, sign-out, or account-swap session.
- No real Save Data, real manuscript, real audio, or real Google Drive snapshot.
- No CSP/browser-hardening test beyond static reading of `BrowserWindow`
  options.
- No direct proof that another app or script can reach these bridge calls at
  runtime; this report is based on current source behavior only.

## Possible duplicate bug references

- No exact duplicate for the Electron file-bridge or transfer/manuscript path
  traversal surfaces was found in `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
  during this run.
- Adjacent watchlist: `SAS-AUD-20260602-003` because the global flag-queue
  storage shape still looks under-scoped for shared-device privacy.

## Next checks

1. Inspector B should complete an independent Zone 14 pass without using this
   report as input.
2. Inspector C should complete an independent Zone 14 pass so the checker can
   compare whether these Electron path issues are reproduced independently.
3. If Inspector A wakes again and Zone 14 is not reopened, the next safest
   target is `Phone Quill`, which is the next priority-order zone without an
   Inspector A report in this campaign.
