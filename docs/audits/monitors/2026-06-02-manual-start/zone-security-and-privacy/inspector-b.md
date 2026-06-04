# Inspector B - Zone 08 - Security and Privacy

- Date: 2026-06-02 19:31-19:39 PDT
- Campaign: `2026-06-02-manual-start`
- Inspector: B
- Status: complete

## Scope

Read-only static audit of Electron renderer hardening, preload/main-process
filesystem exposure, cloud/auth privacy boundaries, phone cache scoping, and
retry behavior for the current StJohn 4.0 repo state. No product-code edits,
no real Save Data access, no live Electron/package run, and no cloud write.

## Source Docs Checked

1. `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
2. `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
3. `READ ME FIRST - OPEN THIS.txt`
4. `HANDOFF.md`
5. `CLAUDE.md`
6. `TODO.md`
7. `docs/BUILD_PLAN_V4.md`
8. `docs/APP_STRUCTURE.md`
9. `docs/CLOUD_SCHEMA.md`
10. `docs/CLOUD_SAFETY_AUDIT.md`
11. `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
12. `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
13. `package.json`

## Commands Run With Exit Codes

| Command | Exit |
|---|---:|
| `date -u +"%Y-%m-%dT%H:%M:%SZ"` | 0 |
| `sed -n '1,220p' "$CODEX_HOME/automations/stjohn-inspector-b/memory.md"` if present | 0 |
| `sed -n '1,220p' docs/audits/monitors/_run_state/inspector-b.lock.md` | 0 |
| `sed -n '1,420p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` | 0 |
| `sed -n '1,260p' docs/BUILD_PLAN_V4.md` | 0 |
| `sed -n '1,260p' docs/APP_STRUCTURE.md` | 0 |
| `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `sed -n '1,220p' 'READ ME FIRST - OPEN THIS.txt'` | 0 |
| `sed -n '1,220p' HANDOFF.md` | 0 |
| `sed -n '1,220p' CLAUDE.md` | 0 |
| `sed -n '1,220p' TODO.md` | 0 |
| `find docs/audits/monitors/2026-06-02-manual-start -maxdepth 2 -name 'inspector-b.md' \| sort` | 0 |
| `git status --short` | 0 |
| `npm test -- --test-reporter=spec` | 0 |
| `test -f .env.local && echo present || echo missing` | 0 |
| release-app existence checks under `Script and Sync Releases/` | 0 |
| `sed -n '1,220p' docs/CLOUD_SAFETY_AUDIT.md` | 0 |
| `sed -n '1,220p' docs/CLOUD_SCHEMA.md` | 0 |
| `rg -n "BrowserWindow\|contextIsolation\|nodeIntegration\|sandbox\|webSecurity\|ipcMain.handle\|contextBridge\|supabase\|localStorage\|service_role\|dangerouslySetInnerHTML\|read-audio-file\|get-audio-url"` across `main.js`, `preload.js`, `app/`, `packages/`, `scripts/`, `package.json` | 0 |
| `sed` / `nl -ba` reads for `main.js`, `preload.js`, `app/page.js`, `app/phone/page.js`, `app/components/ProofingReader.js`, `packages/cloud-sync/*.js`, and `app/phone/_lib/projectCache.js` | 0 |
| `rg -n "webSecurity\|localfile\|read-audio-file\|get-audio-url\|filesystem access\|security\|privacy"` across bug log, master report, and current campaign outputs | 0 |

## Evidence Paths

- `main.js:330-385`
- `main.js:1177-1190`
- `main.js:1223-1229`
- `main.js:1407-1443`
- `preload.js:1-29`
- `packages/cloud-sync/client.js:14-79`
- `packages/cloud-sync/audio-guard.js:12-85`
- `packages/cloud-sync/account.js:26-139`
- `packages/cloud-sync/flag-queue.js:23-240`
- `app/page.js:509-527`
- `app/page.js:582-609`
- `app/page.js:821-828`
- `app/phone/page.js:575-612`
- `app/phone/page.js:833-845`
- `app/phone/page.js:1589-1602`
- `app/phone/_lib/projectCache.js:30-68`
- `app/components/ProofingReader.js:23`
- `app/components/ProofingReader.js:927-960`
- `app/components/ProofingReader.js:1424`
- `package.json:1-37`

## Pass Items

1. The cloud table boundary is actively guarded in code. The shared Supabase
   client whitelists only the six StJohn tables and throws on any `.rpc(...)`
   call, which is a meaningful privacy guard because the Supabase project is
   shared with other apps. `packages/cloud-sync/client.js:22-79`
2. The audio-to-cloud privacy rule is still implemented in the live upload
   path. `stripAudioPaths()` recursively removes audio paths, blobs, buffers,
   and path-shaped strings while preserving filename-only metadata, and the
   current repo grep found no `supabase.storage` or `service_role` usage in
   app/package source. `packages/cloud-sync/audio-guard.js:12-85`,
   `packages/cloud-sync/client.js:14-20`
3. Desktop sign-out clears in-memory Proof state and push caches instead of
   leaving the previous signed-in session mounted. `clearSignedOutState()`
   empties books, active selections, player state, and cloud-push caches; the
   sign-out handler calls it after Supabase sign-out. `app/page.js:509-527`,
   `app/page.js:821-828`
4. The phone’s warm-start cache is scoped per `scope:userId`, so a different
   account does not reuse the previous user’s cached project list by key.
   `app/phone/_lib/projectCache.js:30-68`, `app/phone/page.js:833-845`,
   `app/phone/page.js:1589-1602`
5. The offline Proof flag queue has bounded retry behavior, not an infinite
   hot loop. Retries cap at 8 attempts with backoff up to 1 hour, and pending
   items are retried single-flight per project. `packages/cloud-sync/flag-queue.js:23-84`,
   `packages/cloud-sync/flag-queue.js:203-240`
6. The one `dangerouslySetInnerHTML` sink I checked is not directly rendering
   raw typed quote text. The quote is escaped before it is stored in `sentHtml`
   and escaped again on edited save. `app/components/ProofingReader.js:23`,
   `app/components/ProofingReader.js:927-960`,
   `app/components/ProofingReader.js:1424`

## Fail Items

1. The desktop Electron window still launches with `webSecurity: false`.
   That disables normal same-origin and related renderer protections for the
   whole app, not just local audio playback. Because the app already serves its
   UI from a localhost static server, turning off all web security is broader
   than the stated need and materially increases the blast radius of any future
   renderer bug or malicious content path. `main.js:1177-1190`
2. The preload/main-process file bridge is broader than “audio only” and can
   read or serve arbitrary local files. `decodeStoredFilePath()` accepts raw
   absolute paths, `get-audio-url()` and `read-audio-file()` only check
   existence before returning a `localfile://` URL or raw bytes, the
   `localfile` protocol handler blindly maps that URL to disk, and preload
   exposes those calls to renderer code. There is no extension check and no
   approved-directory restriction on this path, so a compromised renderer could
   reach outside chosen audio files into other readable local files.
   `main.js:330-385`, `main.js:1223-1229`, `main.js:1407-1443`,
   `preload.js:21-29`

## Watchlist Items

1. Supabase auth persists in renderer `localStorage` by design
   (`persistSession: true`, `autoRefreshToken: true`). That is common for web
   apps, but with the two Electron hardening issues above it raises the impact
   of a renderer compromise because account tokens become one more reachable
   secret. `packages/cloud-sync/client.js:65-77`
2. No packaged Mac or Windows app was present under `Script and Sync Releases/`
   in this run, so I could not verify whether the packaged runtime still ships
   with the same Electron security posture or whether any release-only wrapper
   changes it.
3. I did not run a dependency advisory scan such as `npm audit` in this run,
   so package vulnerability status is still unverified beyond static
   `package.json` inspection.

## What Was Not Tested

1. No live Electron window was opened, so the two Electron findings are
   source-traced only and were not exercised in a packaged app.
2. No real Save Data, real manuscripts, real phone device, or real cloud data
   was touched in this zone.
3. No dependency CVE scan or OS-level app-hardening scan was run.
4. I did not inspect every renderer HTML sink in the repo; I checked the
   visible Proof flag quote sink because it was the one exposed by the search.
5. I did not verify whether `localfile://` can be fetched or embedded from all
   renderer contexts live; the risk call here is based on the current bridge
   and protocol code, not a runtime exploit demo.

## Possible Duplicate Bug References

1. The duplicate search found no exact existing bug-log or master-report entry
   for `webSecurity: false`, unrestricted `localfile://` mapping, or the
   renderer-exposed arbitrary file-read path.
2. Earlier cloud/privacy notes in
   `docs/audits/monitors/2026-06-02-manual-start/zone-cloud-auth-audio-privacy-save-data-and-backups/`
   cover audio stripping and table boundaries, but they do not appear to cover
   this zone’s Electron renderer-hardening findings.

## Next Checks

1. In a later safe packaged-app pass, verify whether local audio playback still
   works with normal `webSecurity` restored and a narrower audio-loading
   approach.
2. Tighten the file bridge so `get-audio-url()` / `read-audio-file()` accept
   only approved audio sources or approved app-owned directories, then re-test
   phone/desktop audio attachment and transcription flows.
3. If Marie approves a repair pass later, add a focused regression check that
   proves a renderer cannot read arbitrary non-audio files through the preload
   bridge.
