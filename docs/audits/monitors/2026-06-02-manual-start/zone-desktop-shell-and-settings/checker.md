# Zone Checker - Zone 2 Desktop Shell And Settings

- Date/time: 2026-06-02 02:33 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for Zone 2 only; preserve disagreements; run focused read-only follow-up where needed; dedupe before touching the master report or bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-desktop-shell-and-settings/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-desktop-shell-and-settings/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-desktop-shell-and-settings/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve scope and severity differences around:

- `app/page.js`
- `app/components/PrepManuscriptMode.js`
- `app/components/PrebuildMode.js`
- `app/components/QuillAndInkMode.js`
- `app/components/LoginScreen.js`
- `main.js`
- `preload.js`
- `packages/backups/index.js`
- `docs/APP_STRUCTURE.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/WIRING_MATRIX.md`
- `READ ME FIRST - OPEN THIS.txt`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,220p'` on the three Zone 2 inspector reports | 0 |
| `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` | 0 |
| `sed -n '1,260p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba app/page.js \| sed -n '520,780p;1288,1310p;1450,1665p;1700,2185p;2310,2460p'` | 0 |
| `nl -ba app/page.js \| sed -n '1785,1985p'` | 0 |
| `nl -ba app/page.js \| sed -n '1608,1655p'` | 0 |
| `rg -n "modeToggle" app/components/PrepManuscriptMode.js app/components/PrebuildMode.js app/components/QuillAndInkMode.js` | 0 |
| `nl -ba app/components/PrepManuscriptMode.js \| sed -n '1,80p;100,180p'` | 0 |
| `nl -ba app/components/PrebuildMode.js \| sed -n '1,80p;100,180p'` | 0 |
| `nl -ba app/components/QuillAndInkMode.js \| sed -n '1,100p;120,220p'` | 0 |
| `nl -ba app/components/LoginScreen.js \| sed -n '300,355p'` | 0 |
| `nl -ba main.js \| sed -n '1,170p;292,320p;1340,1395p;2010,2055p'` | 0 |
| `nl -ba preload.js \| sed -n '1,80p'` | 0 |
| `nl -ba packages/backups/index.js \| sed -n '1,170p'` | 0 |
| `nl -ba docs/FRONT_FUNCTION_TREE.md \| sed -n '20,40p;80,110p'` | 0 |
| `nl -ba docs/WIRING_MATRIX.md \| sed -n '24,34p;78,98p'` | 0 |
| `nl -ba docs/BUILD_PLAN_V4.md \| sed -n '70,115p'` | 0 |
| `nl -ba docs/APP_STRUCTURE.md \| sed -n '95,140p'` | 0 |
| `nl -ba 'READ ME FIRST - OPEN THIS.txt' \| sed -n '1,60p'` | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |

## Merged Findings

### PASS - The current shell wiring is real

All three inspectors agreed on the core shell wiring, and the checker follow-up confirms it:

- the four-mode desktop toggle exists and persists the chosen mode
- Electron exposes a real save-folder bridge through `getDataLocation` and `chooseDataLocation`
- shell auth/session plumbing exists
- Drive snapshot status and manual snapshot wiring exist end to end

Evidence:

- `app/page.js:534-540`
- `app/page.js:1451-1458`
- `app/page.js:1498-1515`
- `app/page.js:1953-1963`
- `app/page.js:2438-2455`
- `main.js:292-303`
- `main.js:1347-1388`
- `main.js:2019-2048`
- `preload.js:19-20`

### CONFIRMED DOC-DRIFT - Existing bug `SAS-AUD-20260602-001` should absorb the shell-specific disagreements

The inspectors all surfaced the same shell-doc drift family. The checker follow-up confirms these details belong under the existing documentation-drift item rather than a new shell bug:

- `docs/WIRING_MATRIX.md:28-30` still says the four-mode switcher is missing and still names `window.electron.changeSaveFolder()` even though the live bridge is `getDataLocation` / `chooseDataLocation`.
- `READ ME FIRST - OPEN THIS.txt:1-55` still uses old `AUDIoproofer 5.0` / `Script and Sync` release wording and still tells users the home-screen save location should point inside the main Script and Sync folder, while the current shell branding and default path logic now use `StJohn Author Studio` and may point to Google Drive or Electron userData.

Checker assessment: update the existing doc-drift bug and the master report with these shell-specific receipts; do not create a duplicate item.

### LIKELY UX/DOCS GAP, HELD OUT OF BUG LOG FOR NOW - Save-folder and broader shell settings are effectively Proof-entry controls

Inspector A and Inspector C treated this as a shell failure; Inspector B treated it as intentional partial settings scope. The checker follow-up narrows it:

- `SettingsCog` is mounted in every desktop mode, but its broader controls are intentionally gated behind `isProof`.
- Prep, Duet, and Quill do still render the shared `modeToggle`, so the user is not hard-locked out; they can switch back to Proof to reach the save-location card and the larger Proof-only settings block.

Checker assessment: likely a UX/docs mismatch rather than a confirmed broken shell control. Keep the disagreement visible in `conflicts.md`, but do not log a new bug until a safe live check proves users are materially trapped or misled.

Evidence:

- `app/page.js:1518-1651`
- `app/page.js:1790-1978`
- `app/components/PrepManuscriptMode.js:238`, `651`
- `app/components/PrebuildMode.js:246`, `380`
- `app/components/QuillAndInkMode.js:383`, `750`, `1027`
- `docs/FRONT_FUNCTION_TREE.md:20-27`

### AUDIT UNCLEAR - Global login gate may conflict with the "local-only" plan for Prep and Duet

Inspector C elevated this as a fail. The checker follow-up confirms the code path is real: when Supabase config exists and there is no session, `app/page.js` returns `LoginScreen` before any desktop mode branch runs. The unresolved part is expectation:

- `docs/APP_STRUCTURE.md` and `docs/BUILD_PLAN_V4.md` say Prep and Duet are local-only
- the same docs do not explicitly promise logged-out desktop access when Supabase config is present

Checker assessment: the tension is real, but product intent is not explicit enough to call this a confirmed bug from static evidence alone. Leave both claims visible and require a safe live verification plus a product-intent check.

Evidence:

- `app/page.js:1498-1515`
- `app/components/LoginScreen.js:313-346`
- `docs/APP_STRUCTURE.md:95-115`, `116-131`
- `docs/BUILD_PLAN_V4.md:74-85`

### AUDIT UNCLEAR - Daily backup gating mixes a UTC ref tag with a local-day helper

Only Inspector A flagged this. The checker follow-up confirms the code mismatch:

- `app/page.js` tags `dailyBackupTriedRef` with `new Date().toISOString().slice(0, 10)`
- `packages/backups/index.js` stores and checks the last-run day with local calendar math in `todayStamp()`

The mismatch is real in code, but the exact user impact still needs a controlled repro because the ref is in-memory and resets on app relaunch.

Checker assessment: preserve as an unclear conflict, not a confirmed bug or bug-log entry yet.

Evidence:

- `app/page.js:719-727`
- `packages/backups/index.js:27-33`
- `packages/backups/index.js:63-70`
- `packages/backups/index.js:119-134`

### WATCHLIST HELD IN CHECKER ONLY - Choosing an existing save folder may silently adopt that folder's data

Inspector B flagged a code-traced risk in `main.js:1349-1388`: after the user picks a folder, the app stores that folder immediately and only copies current project JSON into the new location if target files do not already exist. The checker follow-up confirms the behavior, but this run did not safely live-test whether the UI already warns users elsewhere or whether this is an intentional migration path.

Checker assessment: keep this watchlist in the checker artifacts only for now. A safe Electron folder-switch audit should decide whether it belongs in the bug log.

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: searched for shell/save/auth/backup overlap; updated existing `SAS-AUD-20260602-001` instead of creating a new shell doc-drift bug.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: appended a Zone 2 checker section instead of duplicating the setup-pass summary.

## Overall Assessment

- Zone status: checked
- Audit result: shell doc-drift confirmed; no new product bug confirmed in Zone 2
- Confidence: medium
- Why not higher: this zone stayed static/read-only and did not safely live-test login gating, save-folder switching, backup day rollover, or packaged-build behavior

## Next Steps

- Later docs-only cleanup should refresh the shell rows in `docs/WIRING_MATRIX.md` and the release wording in `READ ME FIRST - OPEN THIS.txt`.
- A safe Electron audit with isolated `HOME=/tmp/...` should live-check whether non-Proof settings access is merely awkward or actually misleading in use.
- The same safe run should decide whether the login gate on Prep/Duet is intended or a real product restriction when Supabase config exists.
- A controlled backup test should check whether the UTC/local-day mismatch can suppress a real daily snapshot attempt in one signed-in desktop session.
- The next zone-checker run should wait for the first later zone with all three inspector reports present and no checker report.
