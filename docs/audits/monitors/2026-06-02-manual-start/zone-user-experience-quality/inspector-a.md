# Inspector A — Zone 13: User Experience Quality

- Campaign: `2026-06-02-manual-start`
- Zone: `User experience quality`
- Inspector: `A`
- Date: `2026-06-02`
- Result: `fail`
- Audit style: read-only static UX audit plus safe baseline test run

## Scope

Read-only inspection of cross-mode UX quality with focus on accessibility,
keyboard use, dialog behavior, responsive layout handling, and obvious
console-risk or state-signaling gaps in the current desktop and phone UI.

## Source docs checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Commands run with exit codes

- `sed -n '1,260p' /Users/mariemackay/.codex/automations/stjohn-inspector-a/memory.md` → exit `0`
- `sed -n '1,260p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` plus later
  drift-reset rereads → exit `0`
- `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md` →
  exit `0`
- `sed -n '1,260p' docs/BUILD_PLAN_V4.md` and `docs/APP_STRUCTURE.md` →
  exit `0`
- `sed -n '1,260p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` →
  exit `0`
- `sed -n '1,220p' docs/audits/monitors/_run_state/inspector-a.lock.md` →
  exit `0`
- `find docs/audits/monitors -maxdepth 3 -name 'inspector-a.md' | sort` →
  exit `0`
- `date '+%Y-%m-%d %H:%M:%S %Z'` → exit `0`
- `sed -n '1,220p' package.json` → exit `0`
- `git status --short` → exit `0`
- `npm test -- --test-reporter=spec` → exit `0`
- `test -f .env.local; echo $?` → exit `0`
- `find 'Script and Sync Releases' -maxdepth 3 \( -iname '*.app' -o -iname '*.exe' \) | sort`
  → exit `0`
- `tail -n 40 .claude/hook-activity.log` → exit `0`
- `rg -n "<(div|span)[^>]*onClick|role=\"button\"|tabIndex=|aria-label=|aria-labelledby=|onKeyDown=|onKeyUp=|onKeyPress=" app/page.js app/components app/phone/page.js app/phone/_components`
  → exit `0`
- `rg -n "minWidth|maxWidth|overflow-x|overflowX|white-space: nowrap|whitespace-nowrap|100vw|position: fixed|sticky|grid-cols-|flex-nowrap" app/page.js app/components app/phone/page.js app/phone/_components app/globals.css`
  → exit `0`
- `rg -n "console\.(error|warn|log)|throw new Error|catch \(|setError\(|error &&|error:\s|TODO|FIXME" ...`
  across app/packages source → exit `0`
- `rg -n "User experience|keyboard|responsive|reader|sticky|tab|modal|dialog|SaveBadge|ReaderChrome|ProofingReader|PhoneReader|Quill|Prep|Duet|settings" docs/FRONT_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/INTERNAL_FUNCTION_TREE.md`
  → exit `0`
- `rg -n "window\.confirm|confirm\(" app/page.js app/components app/phone/page.js`
  → exit `0`
- `rg -n "showHomeInfo|show.*Info|position:'fixed',inset:0|backdropFilter:'blur|role=\"dialog\"|aria-modal" app/page.js app/components app/phone/page.js`
  → exit `0`
- `rg -n "aria-expanded|isExpanded|▲|▼|setExpanded|setOpen\(|setPanelOpen\(|setShow.*Modal|setShow.*Info" app/components/SessionsView.js app/phone/page.js app/components/PrebuildMode.js app/components/QuillAndInkMode.js app/components/PrepManuscriptMode.js`
  → exit `0`
- Targeted `sed -n` and `nl -ba ... | sed -n ...` reads for:
  `app/page.js`, `app/components/SessionsView.js`,
  `app/components/PrebuildMode.js`, `app/components/PrepManuscriptMode.js`,
  `app/components/QuillAndInkMode.js`, `app/components/InfoTip.js`,
  `app/globals.css`, `app/phone/page.js`, and `docs/SHARED_COMPONENTS.md`
  → exit `0`
- `rg -n "dialog|modal|aria-expanded|window.confirm|ConfirmDialog|accessibility|keyboard" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start -g 'inspector-*.md'`
  → exit `0`

## Evidence paths

- `app/page.js`
- `app/components/SessionsView.js`
- `app/components/PrebuildMode.js`
- `app/components/PrepManuscriptMode.js`
- `app/components/QuillAndInkMode.js`
- `app/components/InfoTip.js`
- `app/globals.css`
- `app/phone/page.js`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## Pass items

1. Proof and Duet both have real responsive logic for their side navigation
   panels instead of a permanently fixed desktop rail. Each mode flips between
   floating and inline navigation at `window.innerWidth >= 760`, which is a
   real cross-layout adaptation in the current source.
   Evidence: `app/components/SessionsView.js:583-586`,
   `app/components/PrebuildMode.js:280-284`.

2. The shared info-tip pattern is keyboard-reachable and not hover-only. The
   tip node is focusable, and the tooltip styling opens on `:focus-visible` as
   well as hover.
   Evidence: `app/components/InfoTip.js:3-14`,
   `app/globals.css:46-66,68-99,130-148`.

3. The repo still has a clean baseline test run for the currently automated
   surfaces. This does not prove live UX quality, but it does mean the current
   helper/test layer was not already failing underneath this audit.
   Evidence: `npm test -- --test-reporter=spec` exited `0` with `13` passing
   tests and `0` failures.

## Fail items

1. The app's custom modal/help surfaces still ship without dialog semantics or
   focus management. I found repeated fixed-overlay implementations for Proof,
   Quill, Prep, Duet, and Proof workflow modals that rely on click-outside
   close, but I did not find `role="dialog"`, `aria-modal`, or any clear focus
   trap / restore behavior on those surfaces.
   Evidence: `app/page.js:2329-2340`,
   `app/components/QuillAndInkMode.js:1051-1062`,
   `app/components/PrepManuscriptMode.js:780-791`,
   `app/components/PrebuildMode.js:381-392`,
   `app/components/SessionsView.js:2233-2240,2380-2397`.
   Status note: code-traced accessibility fail; no live screen-reader or
   keyboard-only dialog run was performed.

2. Proof's chapter and section disclosure controls do not expose expanded state
   to assistive tech. The buttons only swap visible `▲` / `▼` glyphs; I found
   no `aria-expanded`, `aria-controls`, or equivalent state signal on the main
   chapter expander or the per-section expander.
   Evidence: `app/components/SessionsView.js:2946-2954`,
   `app/components/SessionsView.js:3141-3144`.
   Status note: code-traced accessibility fail; not exercised live.

## Watchlist items

1. Destructive flows still rely on native `window.confirm()` across modes,
   which matches the docs' own note that a shared `ConfirmDialog` is still
   missing. This is a visible UX-consistency gap rather than a newly proven
   data-loss bug.
   Evidence: `app/components/BookDetail.js:118-124,197-203`,
   `app/components/SessionsView.js:1950,1979`,
   `app/components/PrebuildMode.js:585,627,647,682,756,994`,
   `app/components/PrepManuscriptMode.js:701,865,1077`,
   `app/phone/page.js:3099`,
   `docs/SHARED_COMPONENTS.md:36-42`.

2. The phone account menu toggle opens a custom popover but does not expose
   expanded/menu state on the trigger, and I found no paired dismiss helper on
   that surface. That is a likely keyboard/screen-reader rough edge, but I did
   not run it live.
   Evidence: `app/phone/page.js:2860-2884`.

3. The Proof "Transcribe All" modal renders the re-transcribe option as a
   custom button with a visual checkmark only. I found no `aria-pressed`,
   `aria-checked`, or explicit accessible state label on that toggle.
   Evidence: `app/components/SessionsView.js:2386-2389`.

## What was not tested

- No live browser or Electron session.
- No real keyboard-only walkthrough.
- No screen-reader pass.
- No live mobile viewport check.
- No live console-error collection from the running app.
- No real Save Data mutation.
- No packaged app launch.

## Possible duplicate bug references

- I did not find a matching existing bug-log id for the missing dialog
  semantics / focus-management issue.
- I did not find a matching existing bug-log id for the missing
  `aria-expanded` state on Proof chapter/section disclosure controls.
- The `window.confirm()` consistency gap appears to be a known shared-component
  refactor note in `docs/SHARED_COMPONENTS.md`, but I did not find a numbered
  bug id for it in the live bug log.
- `docs/audits/monitors/2026-06-02-manual-start/zone-desktop-shell-and-settings/inspector-a.md`
  already called out that no keyboard-only/settings accessibility run had been
  done, but it did not log these specific source-traced UX issues.

## Next checks

1. Run a safe live desktop/browser pass focused only on keyboard order,
   `Escape`, focus return, and screen-reader naming for the current custom
   dialogs and popovers.
2. Live-check Proof chapter and section expand/collapse with a keyboard and
   confirm whether state changes are announced or completely silent.
3. Decide whether the custom dialog/menu/expand-state issues should become new
   numbered UX bugs or stay grouped under one accessibility-quality umbrella.
