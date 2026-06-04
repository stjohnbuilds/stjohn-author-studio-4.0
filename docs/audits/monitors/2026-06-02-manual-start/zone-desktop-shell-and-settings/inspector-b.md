# Inspector B - Zone 2 Desktop Shell And Settings

- Date: 2026-06-02
- Role: Inspector B
- Scope: read-only audit of the desktop shell and settings only.
- Product code changed: no.
- Real Save Data touched: no.
- Files written by this role: this report and `docs/audits/monitors/_run_state/inspector-b.lock.md`.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `CLAUDE.md`
- `TODO.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands Run

- `date '+%Y-%m-%d %H:%M:%S %Z'` - exit 0.
- `git status --short` - exit 0. Dirty before this run: `M docs/audits/OTHER_APP_PROJECT_MONITOR_PROMPT.md`, `M docs/audits/STJOHN_FIX_STRATEGY_QUEUE.md`, `M docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `M docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`, `M docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`, `M docs/dev/active/project-monitor-automation-2026-06-02/tasks.md`, `?? docs/audits/monitors/`.
- `npm test -- --test-reporter=spec` - exit 0. Result: 13 tests passed, 0 failed. Console also showed repeated Node `MODULE_TYPELESS_PACKAGE_JSON` warnings.
- `rg -n "shell|settings|mode switcher|auth|login|segmented|theme|save path|data location|chooseDataLocation|getDataLocation|Settings|settings" docs/FRONT_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/INTERNAL_FUNCTION_TREE.md app/page.js app/components main.js preload.js package.json` - exit 0.
- `rg -n "function AppModeToggle|const AppModeToggle|handleAppModeChange|setAppMode\\(|getDataLocation\\?|chooseDataLocation|setDataLocation|authReady|authSession|onAuthStateChange|hasSupabaseConfig" app/page.js` - exit 0.
- `sed -n ...` and `nl -ba ...` reads for `app/page.js`, `main.js`, `preload.js`, `app/components/LoginScreen.js`, `docs/FRONT_FUNCTION_TREE.md`, `docs/WIRING_MATRIX.md`, and `READ ME FIRST - OPEN THIS.txt` - exit 0.
- Re-anchor rereads of `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, and `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` - exit 0.

## Evidence Paths

- Shell entry and auth gate: `app/page.js:498-609`, `app/page.js:1498-1665`.
- Mode switcher and persistence: `app/page.js:1451-1458`, `app/page.js:1704-1755`.
- Settings panel and proof-only settings scope: `app/page.js:1790-2180`.
- Home screen save-location card: `app/page.js:2312-2471`.
- Save-folder bridge and settings storage: `main.js:41-68`, `main.js:133-143`, `main.js:292-303`, `main.js:1347-1388`, `preload.js:4-20`.
- Dev fake-login path: `app/components/LoginScreen.js:313-346`.
- Shell docs for comparison: `docs/FRONT_FUNCTION_TREE.md:20-27`, `docs/WIRING_MATRIX.md:24-31`, `READ ME FIRST - OPEN THIS.txt:1-55`.

## Pass Items

### Pass - The 4-mode desktop shell is real and persisted

`app/page.js` reads a stored mode from localStorage on load at lines 537-540, updates mode state through `handleAppModeChange` at lines 1451-1458, and renders a real 4-button segmented switcher in `AppModeToggle` at lines 1704-1755. The main render path then switches between Proof, Prep, Duet, and Quill branches at lines 1518-1654.

### Pass - Settings are wired into every desktop mode, with broader controls in Proof

Each desktop mode mounts `SettingsCog` from the shell layer at `app/page.js:1524-1542`, `1551-1569`, `1581-1599`, and `1614-1650`. Inside the cog, the shared profile and tutorial cards always render, the Drive snapshots card renders for signed-in Electron use at lines 1953-1963, and the broader save/backup/audio/page/reader/Whisper controls are intentionally gated to Proof mode at lines 1965-2144. That matches `docs/FRONT_FUNCTION_TREE.md:27`, which marks Settings as `PARTIAL`.

### Pass - Save-location controls are backed by a real Electron bridge

The home screen shows the current save location and a Choose/Change button at `app/page.js:2438-2455`. The settings panel shows the same save-location control for Proof at `app/page.js:1968-1978`. Renderer calls `window.electron.getDataLocation` and `window.electron.chooseDataLocation` at `app/page.js:534-536` and `1289-1295`, those bridge methods are exposed in `preload.js:19-20`, and Electron handles them in `main.js:1347-1388`.

### Pass - Shell auth, cloud resync, and per-user backup wiring all exist

When Supabase config exists, the shell shows a loading state until auth is ready at `app/page.js:1498-1506`, then falls back to `LoginScreen` if no session exists at `app/page.js:1509-1515`. It subscribes to auth state changes at `app/page.js:577-609`, wires a manual Proof resync flow at `app/page.js:639-698`, and wires per-user Drive snapshot state at `app/page.js:703-778`.

## Fail Items

### Fail / Doc-drift - `WIRING_MATRIX.md` still says the shell mode switcher is missing and names the wrong save-folder bridge

`docs/WIRING_MATRIX.md:28-30` still says the 4-mode switcher is "(Phase 4 - not built)" and `MISSING`, and it lists `window.electron.changeSaveFolder()` as the shell save-folder bridge. The real code uses `AppModeToggle` in `app/page.js:1704-1755` and `getDataLocation` / `chooseDataLocation` in `preload.js:19-20` and `main.js:1347-1388`.

Possible duplicate: `SAS-AUD-20260602-001`.

### Fail / Doc-drift - `READ ME FIRST - OPEN THIS.txt` still points shell users at old app names and an old save-path expectation

`READ ME FIRST - OPEN THIS.txt:1-55` still starts with `AUDIoproofer 5.0`, says the code lives in `Script and Sync 3.0`, tells users to open `Script and Sync.app`, and says the home-screen save location should point inside the main Script and Sync folder. Current shell code is branded/stored as `StJohn Author Studio` in `main.js:10-15`, and default save-location logic can point to Google Drive or Electron userData at `main.js:139-143`.

Possible duplicate: `SAS-AUD-20260602-001`.

## Watchlist Items

### Watchlist - Changing save folder appears to adopt any existing folder immediately, with no visible merge or warning path in the audited code

`main.js:1349-1388` stores the selected directory in settings immediately, then copies current Proof/Prep/Duet/Quill data only when the target JSON files do not already exist. If a user picks an existing folder with stale or different project files, the shell appears to switch over without any confirmation or merge step. This may be intentional for migration use, but I did not find a warning path in the audited shell code.

This is code-traced only. No live folder-switch test was run.

### Watchlist - Dev fake-login path is still present in non-production builds

`app/components/LoginScreen.js:313-346` exposes a `Dev · skip login (fake session)` button when `process.env.NODE_ENV !== 'production'`. The guard looks correct for production, but this shell zone did not verify a packaged build, so the protection remains unproven here.

## What Was Not Tested

- No Electron app launch, because this run stayed read-only and avoided any save-path write risk tied to `SAS-AUD-20260530-001`.
- No live click test of the mode switcher, settings panel, save-folder chooser, sign-in/out, backup toggle, tutorial, or resync button.
- No packaged Mac or Windows build check.
- No real Supabase auth, pull, sign-out, account-switch, or backup snapshot test.
- No real file import, export, or Save Data migration test.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` - broad shell/doc drift already logged; this zone adds shell-specific receipts.
- `SAS-AUD-20260530-001` - still relevant blocker for any live Electron shell/settings run that could touch save paths.

## Next Checks

- Checker should compare whether Inspector A and C also treat the shell doc drift as one bug or separate the release-instructions drift from the app-tree drift.
- A later safe Electron audit should test `Choose save folder` only with isolated `HOME=/tmp/...` and copied audit data.
- A later release/package audit should confirm the dev fake-login button is absent from packaged production builds.
- After the monitor campaign, docs should refresh the shell rows in `docs/WIRING_MATRIX.md` and the user-facing release wording in `READ ME FIRST - OPEN THIS.txt`.
