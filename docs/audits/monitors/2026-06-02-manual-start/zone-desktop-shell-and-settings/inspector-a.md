# Inspector A — Zone 2: Desktop shell and settings

- Campaign: `2026-06-02-manual-start`
- Zone: `Desktop shell and settings`
- Inspector: `A`
- Date: `2026-06-02`
- Result: `fail`
- Audit style: read-only static audit plus safe test run

## Scope

Read-only inspection of the desktop shell, shared settings access, save-folder
bridge, mode switcher, account/sign-out shell controls, and Drive snapshot
settings/status paths.

## Source docs checked

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
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands run with exit codes

- `date '+%Y-%m-%d %H:%M:%S %Z'` → exit `0`
- `find docs/audits/monitors -maxdepth 3 -type f | sort` → exit `0`
- `find tests -maxdepth 2 -type f | sort` → exit `0`
- `git status --short` → exit `0`
- `npm test -- --test-reporter=spec` → exit `0`
- `rg -n "mode switch|selectedMode|Save location|changeSaveFolder|getDataLocation|chooseDataLocation|Settings|backup|signOut|ProfilePill|HomeBackPill" app/page.js preload.js main.js app/components/ReaderChrome.js packages/backups/index.js` → exit `0`
- `rg -n "function AppModeToggle|const APP_MODES|function HomePage|save-location-card|Save location" app/page.js` → exit `0`
- `rg -n "write-data|write-prep-data|write-quill-data|mirrorDataPath|prebuildMirrorDataPath|prepMirrorDataPath|quillMirrorDataPath" main.js` → exit `0`
- `rg -n "Change save folder|Choose save folder|Restore backup|Backup all books|getDataLocation|chooseDataLocation|Save location" app/components app/page.js` → exit `0`
- `rg -n "toISOString\\(\\)\\.slice\\(0, 10\\)|todayStamp\\(|stjohn-backup-last-run-v1|stjohn-backup-enabled-v1" app/page.js packages/backups/index.js` → exit `0`
- `sed -n '1,200p' tests/cloud-safety-test.mjs` → exit `1` (`tests/cloud-safety-test.mjs` does not exist; no shell/settings-specific test file was found under `tests/`)
- Read-only file views used for evidence: `sed -n` / `nl -ba ... | sed -n` on the docs and source files listed in this report → exit `0`

## Evidence paths

- `app/page.js`
- `main.js`
- `preload.js`
- `packages/backups/index.js`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `package.json`

## Pass items

1. The desktop shell does have a real four-mode toggle, and the chosen mode is persisted between opens.
   Evidence: `app/page.js` lines 538-540, 1451-1458, 1697-1755.

2. The desktop save-folder bridge is real in Electron.
   Evidence: `preload.js` lines 19-20 expose `getDataLocation` and `chooseDataLocation`; `main.js` lines 292-303 and 1347-1388 implement the location info and chooser; `app/page.js` lines 1290-1295, 1968-1977, and 2438-2454 consume it.

3. Drive snapshot settings/status plumbing exists end to end.
   Evidence: `app/page.js` lines 703-778, 1953-1963, and 2173-2307; `main.js` lines 2019-2048; `packages/backups/index.js` lines 86-135.

4. The current automated test suite passes, but it does not cover this shell/settings zone directly.
   Evidence: `npm test -- --test-reporter=spec` exit `0`; `tests/` contains cloud slim, manuscript, prep export, quill export, and whisper tests only.

## Fail items

1. Shared shell settings are not actually shared across all four desktop modes.
   The settings cog appears in every mode, but `SettingsCog` gates save location, backup/restore JSON, page matching, reader settings, and Whisper controls behind `isProof`. Prep, Duet, and Quill only get profile, tutorial, and Drive snapshots. Because the selected app mode is persisted in localStorage, a user can reopen directly into a non-Proof mode and lose access to shared shell controls until they know to switch back to Proof.
   Evidence: `app/page.js` lines 538-540, 1451-1458, 1532-1599, 1817-1824, 1965-2144. The only save-location UI hits from repo search were `app/page.js` lines 1969 and 2443.
   Status note: code-traced only, not live-clicked.

2. Daily Drive backup gating mixes UTC and local-day logic, which can skip a local calendar day.
   `app/page.js` uses `new Date().toISOString().slice(0, 10)` for the in-memory `dailyBackupTriedRef` tag, while `packages/backups/index.js` uses local calendar math in `todayStamp()`. In UTC-negative timezones, the app can treat the previous evening and the next local morning as the same ref tag even though the backup helper sees a new local day, preventing the first backup attempt after local midnight.
   Evidence: `app/page.js` lines 725-727; `packages/backups/index.js` lines 27-33, 63-70, and 119-134.
   Status note: code-traced only, not reproduced live.

## Watchlist items

1. This zone has no direct automated coverage for mode-toggle persistence, non-Proof settings visibility, save-folder switching, tutorial shell behavior, or backup day-rollover behavior.
   Evidence: `find tests -maxdepth 2 -type f | sort` and the passing test run only showed cloud/message, manuscript, prep export, quill export, and whisper suites.

2. Electron shell testing for save-folder changes remains tied to the known mirror-write safety blocker.
   Related evidence: existing bug `SAS-AUD-20260530-001` in `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`.

## What was not tested

- No live Electron clicks.
- No real or temp save-folder change in the UI.
- No real Google Drive detection or zip creation.
- No packaged Mac or Windows shell check.
- No keyboard-only or accessibility run through the settings panel.
- No timezone-forced live reproduction of the daily backup bug.
- No real Save Data was touched.

## Possible duplicate bug references

- `SAS-AUD-20260602-001` — overlaps on shell doc drift because `docs/WIRING_MATRIX.md` still reports shell controls as missing while the code shows a live mode toggle and save-location UI.
- `SAS-AUD-20260530-001` — related environment blocker for any future live Electron save-folder test because dev-mode mirrors can write outside the audit area.

## Next checks

1. Live-check a non-Proof mode in Electron and confirm whether Save location, restore backup, and Whisper settings are unreachable without switching modes.
2. Reproduce the backup day-rollover bug with a mocked timezone or controlled local/UTC midnight boundary.
3. If the checker agrees these are distinct issues, add one product bug for non-shared shell settings access and one product bug for backup day-rollover skipping.
