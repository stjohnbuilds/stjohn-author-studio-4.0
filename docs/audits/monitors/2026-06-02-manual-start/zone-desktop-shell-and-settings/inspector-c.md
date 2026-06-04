# Inspector C — Zone 2: Desktop shell and settings

## Scope

Read-only Inspector C audit of the desktop shell and settings surfaces for the
current campaign.

Focused on:

- shell mode switching
- auth gate behavior at app entry
- settings availability by mode
- save-folder bridge wiring
- shell-level doc drift tied to this zone

This was a static source and docs audit only. No live app launch was performed.

## Source docs checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands run with exit codes

- `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` → `0`
- `sed -n '1,260p' docs/BUILD_PLAN_V4.md` → `0`
- `sed -n '1,260p' docs/APP_STRUCTURE.md` → `0`
- `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` → `0`
- `date '+%Y-%m-%d %H:%M:%S %Z'` → `0`
- `find docs/audits/monitors -maxdepth 3 ... -type f | sort` → `0`
- `rg -n "settings|mode switch|mode|auth|login|project list|desktop shell|segmented|reader mode|Supabase|chooseDataLocation|getDataLocation" docs/FRONT_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/CLOUD_SAFETY_AUDIT.md docs/APP_STRUCTURE.md` → `0`
- `rg -n "settings|setSettings|Settings|chooseDataLocation|getDataLocation|mode|setMode|mode switch|auth|login|Supabase|data location|backup|project list" app/page.js main.js preload.js app/components` → `0`
- `nl -ba app/page.js | sed -n '1490,1665p'` → `0`
- `rg -n "function SettingsCog|...|SettingsCog" app/components app/page.js` → `0`
- `nl -ba main.js | sed -n '35,160p;292,380p;1340,1395p;1770,1855p;1980,2065p'` → `0`
- `nl -ba app/page.js | sed -n '1288,1315p;1450,1778p'` → `0`
- `nl -ba app/components/LoginScreen.js | sed -n '1,260p'` → `0`
- `nl -ba docs/FRONT_FUNCTION_TREE.md | sed -n '20,40p;80,105p'` → `0`
- `nl -ba docs/WIRING_MATRIX.md | sed -n '24,34p;78,98p'` → `0`
- `rg -n "onChangeDataLocation|dataLocation|Choose save folder|Change save folder|Save location|Save Folder" app/page.js app/components` → `0`
- `rg -n "Prep is local-only|Duet is local-only|Prep and Duet do not have cloud tables|desktop-only|local-only" docs/BUILD_PLAN_V4.md docs/APP_STRUCTURE.md docs/CLOUD_SCHEMA.md` → `0`

Repeated drift-reset rereads of the source-of-truth, app structure, and bug log
also returned exit code `0`.

## Evidence paths

- `app/page.js`
- `app/components/LoginScreen.js`
- `main.js`
- `preload.js`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Pass items

### PASS-C-1: Four-mode desktop shell toggle exists in current source

- `APP_MODES` defines Proof, Prep, Duet, and Quill as enabled in
  `app/page.js`.
- `AppModeToggle` renders all four buttons and `handleAppModeChange` persists
  the chosen mode to `localStorage`.
- This supports `docs/FRONT_FUNCTION_TREE.md`, which marks the 4-mode shell
  switcher as real.

### PASS-C-2: Save-folder bridge wiring exists end-to-end

- `preload.js` exposes `getDataLocation` and `chooseDataLocation`.
- `main.js` implements both IPC handlers.
- `choose-data-location` also seeds missing JSON files into the selected folder
  for Proof, Prep, Duet, and Quill project stores.
- This is code-traced only; dialog behavior was not exercised live.

## Fail items

### FAIL-C-1: Global login gate blocks local-only desktop modes when Supabase is configured

- `app/page.js` returns `LoginScreen` whenever `hasSupabaseConfig` is true and
  `authSession` is missing, before any mode render branch runs.
- `docs/APP_STRUCTURE.md` says Prep Manuscript and Duet Prep are local-only.
- `docs/BUILD_PLAN_V4.md` says cloud sync is not being added for Prep or Duet
  in v4.0.
- Result: a logged-out desktop user cannot reach those local-only modes if the
  app has Supabase config present.
- Evidence paths:
  - `app/page.js`
  - `app/components/LoginScreen.js`
  - `docs/APP_STRUCTURE.md`
  - `docs/BUILD_PLAN_V4.md`
- Status note: code-traced fail; not tested live.

### FAIL-C-2: Save-folder control is effectively Proof-only, not a shared shell setting

- `docs/FRONT_FUNCTION_TREE.md` lists Save Folder under shared desktop shell
  chrome.
- In `app/page.js`, `dataLocation` and `onChangeDataLocation` are only passed
  into the Proof-mode `SettingsCog` and Proof `HomePage`.
- Inside `SettingsCog`, the save-location card is behind `isProof`.
- Non-Proof mode renders for Prep, Duet, and Quill do not pass the save-folder
  props into `SettingsCog`.
- Result: shell-level save-folder management is not available inside those
  modes, despite the docs describing it as shared shell chrome.
- Evidence paths:
  - `app/page.js`
  - `docs/FRONT_FUNCTION_TREE.md`
  - `docs/APP_STRUCTURE.md`
- Status note: code-traced fail; not tested live.

## Watchlist items

### WATCH-C-1: Shell documentation still conflicts with current shell source

- `docs/FRONT_FUNCTION_TREE.md` marks the 4-mode switcher as real.
- `docs/WIRING_MATRIX.md` still marks the mode switcher as missing and cites an
  old bridge name for Save Folder.
- This overlaps an existing documentation drift item and should not be logged as
  a new bug by this inspector.

## What was not tested

- No Electron app launch.
- No sign-in, sign-out, or session refresh flow.
- No clicking of the settings cog or mode switcher.
- No save-folder dialog use or migration write.
- No backup snapshot toggle or backup execution.
- No proof book import/export.
- No writes to real `Save Data/` or external mirror folders.

## Possible duplicate bug references

- `SAS-AUD-20260602-001` — shell/docs status drift overlaps this zone's shell
  doc mismatch evidence.
- No exact existing bug-log duplicate was found for the global auth gate on
  local-only desktop modes.
- No exact existing bug-log duplicate was found for the non-Proof save-folder
  settings gap.

## Next checks

- Safe live verification should use an isolated `HOME` because of
  `SAS-AUD-20260530-001`.
- Launch the desktop app in a safe audit workspace with Supabase config present
  and verify whether logged-out users are blocked from Prep and Duet.
- In the same safe run, switch between all four desktop modes and confirm where
  the save-folder control is actually reachable.
- Zone checker should compare this with Inspector A and B without merging away
  disagreements.
