# Inspector C - Zone 14 - Security and privacy

- Campaign: `2026-06-02-manual-start`
- Inspector: `C`
- Run mode: read-only static audit
- Date: 2026-06-02 19:33-19:34 PDT

## Scope

Static security/privacy review of the Electron shell, preload bridge, transfer import/export path handling, local file exposure, cloud table guardrails, audio-path stripping, and backup snapshot flow.

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
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `package.json`

## Commands run with exit codes

| Command | Exit |
|---|---:|
| `date '+%Y-%m-%d %H:%M:%S %Z'` | 0 |
| `git status --short` | 0 |
| `npm test -- --test-reporter=spec` | 0 |
| `find docs/audits/monitors -path '*/inspector-c.md' \| sort` | 0 |
| `rg -n "ipcMain\|contextBridge\|child_process\|spawn\(|exec\(|shell\\.\|openExternal\|openPath\|supabase\|service_role\|anon key\|audio_file_name\|audioPath\|writeData\|readData\|chooseDataLocation\|export\|import\|backup\|token\|secret\|password\|localStorage\|sessionStorage" main.js preload.js app/page.js app/phone/page.js packages/cloud-sync packages/backups tests -g '!node_modules'` | 0 |
| `rg -n "dangerouslySetInnerHTML\|innerHTML\|DOMParser\|createElement\\('script'\|sanitize\|sanitiz" app packages -g '!node_modules'` | 0 |
| `rg -n "readAudioFile\\(|getAudioUrl\\(|openAudioDialog\\(|saveManuscriptSource\\(|convertDocxToPdf\\(|rescanBookPdf\\(|importTransferBundle\\(|exportTransferBundle\\(" app packages -g '!node_modules'` | 0 |
| `rg -n "new BrowserWindow\|contextIsolation\|nodeIntegration\|sandbox\|webSecurity\|allowRunningInsecureContent\|preload:" main.js` | 0 |
| `rg -n "webSecurity\|localfile\|transfer manifest\|relativeAudioPath\|registerFileProtocol\|read-audio-file\|get-audio-url" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start -g '!**/checker.md'` | 0 |
| Targeted `sed` / `nl -ba` reads for `main.js`, `preload.js`, `app/page.js`, `app/components/SessionsView.js`, `app/components/ChapterReader.js`, `app/phone/_components/renderReaderContent.js`, `app/lib/transcriptionWorker.js`, `packages/cloud-sync/*.js`, `packages/backups/index.js`, and monitor docs | 0 |

## Evidence paths

- `main.js:367-385`
- `main.js:444-462`
- `main.js:1179-1190`
- `main.js:1223-1228`
- `main.js:1407-1443`
- `main.js:1617-1662`
- `preload.js:4-55`
- `app/page.js:1198-1234`
- `app/components/SessionsView.js:1341-1348`
- `app/components/ChapterReader.js:144-148`
- `app/phone/_components/renderReaderContent.js:31-34`
- `app/lib/transcriptionWorker.js:86-92`
- `packages/cloud-sync/client.js:22-79`
- `packages/cloud-sync/audio-guard.js:12-84`
- `packages/cloud-sync/proof-sync.js:46-57`
- `packages/cloud-sync/quill-sync.js:27-36`
- `packages/backups/index.js:73-135`

## Pass items

1. Cloud table access is tightly whitelisted. `packages/cloud-sync/client.js:22-79` wraps the Supabase client so the app can only touch the six declared StJohn tables and throws on any `rpc()` call.
2. Audio-path stripping is present on both cloud push paths. `packages/cloud-sync/audio-guard.js:12-84`, `packages/cloud-sync/proof-sync.js:46-57`, and `packages/cloud-sync/quill-sync.js:27-36` remove audio paths/blobs before upload and preserve only filename-safe metadata.
3. Backup snapshots are opt-in per signed-in user and do not run in the browser fallback. `packages/backups/index.js:97-135` requires Electron plus a user id and the per-user toggle before any snapshot call is made.

## Fail items

1. Source-traced fail: the Electron window disables browser security globally while the app also exposes a broad file-capable preload bridge.
   - Evidence: `main.js:1179-1190` sets `contextIsolation: true` and `nodeIntegration: false`, but also sets `webSecurity: false` for the whole app. The same window exposes local read/write, import/export, conversion, and backup IPC methods through `preload.js:4-55`.
   - Why this matters: the app renders user-imported manuscript HTML through `host.innerHTML` in both the desktop and phone reader pipelines (`app/components/ChapterReader.js:144-148`, `app/phone/_components/renderReaderContent.js:31-34`). I did not prove a live exploit in this run, but the current shell configuration removes a major browser safety layer around a renderer that handles imported content and local-file IPC.
   - Result class: code-traced security bug, not live-exploited in this run.

2. Source-traced fail: transfer import trusts manifest-relative paths and can escape the copied transfer folder.
   - Evidence: `main.js:444-462` rebuilds bundled audio paths with `path.join(importDir, ...String(relativeAudioPath).split('/').filter(Boolean))`, and `main.js:1654-1662` rebuilds `manuscriptSource.relativePath` the same way. Neither path is normalized back against `importDir` or checked to stay inside it.
   - Why this matters: a crafted transfer manifest can use `../` segments to point the imported book at arbitrary existing files outside the selected transfer folder. The manuscript path is then read immediately by `fs.readFileSync(sourceManuscriptPath)` in `main.js:1658-1662`.
   - Result class: code-traced privacy/file-boundary bug, not live-exploited in this run.

3. Source-traced fail: imported/local project data can still drive arbitrary local-file reads through the audio path bridge.
   - Evidence: `app/page.js:1198-1204` imports backup JSON directly into app state. For non-portable strings, `decodeStoredFilePath()` returns the absolute path as-is in `main.js:367-385`. `main.js:1407-1443` then exposes both `get-audio-url` and `read-audio-file` with only existence checks, and `app/components/SessionsView.js:1341-1348` plus `app/lib/transcriptionWorker.js:86-92` pass stored audio paths back into that bridge.
   - Why this matters: a crafted backup or imported project can persist an arbitrary absolute path in `audioPath` / `audioPaths`, after which the desktop flow will treat that path as trusted local audio. I did not prove a live user-triggered data leak in this run, but the trust boundary is missing.
   - Result class: code-traced privacy bug, not live-exploited in this run.

## Watchlist items

1. The custom `localfile://` protocol remains broad even aside from the import-path issues above. `main.js:1223-1228` forwards the decoded path directly to Electron's file protocol callback without checking file type or allowed roots. This becomes more serious because `webSecurity` is disabled.
2. Dependency risk was not audited live. `package.json` was read and `npm test` passed, but no live registry-backed vulnerability scan was possible in this run.

## What was not tested

- No live Electron session.
- No real backup or transfer folder import.
- No malicious fixture folder or crafted JSON file was executed.
- No packaged Mac/Windows build audit.
- No real Save Data files were opened or modified.
- No cloud/auth live exploit test.

## Possible duplicate bug references

- Searched `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`, `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, and current monitor outputs for `webSecurity`, `localfile`, transfer-manifest path handling, and audio-path bridge terms.
- No direct duplicate for these three security/privacy findings was found.
- Existing cloud integrity bugs `SAS-AUD-20260602-010` through `013` are related to sync correctness, not this renderer/file-boundary surface.

## Next checks

1. Checker should compare whether Inspectors A and B also flag the `webSecurity: false` shell setting or the transfer-path escape, then preserve any disagreement.
2. In a safe temp-only Electron sandbox, create a crafted transfer manifest with `../` segments and confirm whether the app reads outside the copied transfer folder.
3. In a safe temp-only Electron sandbox, import a crafted backup JSON with a fake absolute `audioPath` and verify how far the localfile / transcription flow trusts it.
