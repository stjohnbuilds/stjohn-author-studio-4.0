# Inspector B - Zone 13 - User experience quality

- Date: 2026-06-02
- Inspector: B
- Campaign: `2026-06-02-manual-start`
- Audit mode: read-only docs + source + safe tests/build only

## Scope

User experience quality across the shared desktop and phone surfaces:

- shared navigation chrome and reader entry points
- keyboard/accessibility shape for the core reading flows
- phone Quill reader and audio guidance UX
- current responsive/performance signals from a safe production build
- duplicate-bug overlap and current coverage gaps

This run did not launch a live Electron window, did not open a browser session,
did not sign into Supabase, and did not touch real Save Data.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `CLAUDE.md`
- `TODO.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run With Exit Codes

- `date '+%Y-%m-%d %H:%M:%S %Z'` -> `0`
- `git status --short` -> `0`
- `npm test -- --test-reporter=spec` -> `0`
- `test -f .env.local && echo '.env.local: present' || echo '.env.local: missing'` -> `0`
- `test -d 'Script and Sync Releases' && echo 'Script and Sync Releases: present' || echo 'Script and Sync Releases: missing'` -> `0`
- `rg --files docs/audits/monitors | sort` -> `0`
- `sed -n '1,260p' docs/SHARED_COMPONENTS.md` -> `0`
- `sed -n '1,260p' docs/FRONT_FUNCTION_TREE.md` -> `0`
- `sed -n '1,260p' docs/WIRING_MATRIX.md` -> `0`
- `npm run build` -> `0`
- `rg -n "window\\.confirm|window\\.alert|alert\\(|confirm\\(|aria-label|aria-labelledby|role=\\\"dialog\\\"|onKeyDown|keydown|Escape|overflow-x|overflow-hidden|sticky top|text-overflow|truncate|line-clamp|console\\.error|console\\.warn" app app/phone app/components packages | head -n 400` -> `0`
- `rg -n "button[^\\n]*>[^<]*$|<button|<dialog|tabIndex|aria-|role=|onKeyDown|onPointerDown|onPointerEnter|onDoubleClick" app/components app/phone | head -n 400` -> `0`
- `rg -n "data-word|onDoubleClick|onMouseDown|onPointerDown|tabIndex|userSelect:'none'|WebkitUserSelect:'none'" app/components/ProofingReader.js` -> `0`
- `rg -n "keyboard|accessib|aria|screen reader|focus|tab order|popover|reader.*keyboard|double-click|search button" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start TODO.md HANDOFF.md` -> `0`
- `nl -ba app/components/ChapterReader.js | sed -n '200,430p'` -> `0`
- `nl -ba app/phone/_components/PhoneReader.js | sed -n '150,240p'` -> `0`
- `nl -ba app/components/ProofingReader.js | sed -n '1158,1212p'` -> `0`
- `nl -ba app/components/ReaderChrome.js | sed -n '250,430p'` -> `0`
- `nl -ba app/components/ReaderChrome.js | sed -n '536,560p'` -> `0`
- `nl -ba app/phone/page.js | sed -n '950,980p'` -> `0`
- `nl -ba app/phone/page.js | sed -n '1288,1460p'` -> `0`
- `nl -ba app/phone/page.js | sed -n '2668,2695p'` -> `0`

## Evidence Paths

- `docs/APP_STRUCTURE.md:16-59,117-132`
- `docs/FRONT_FUNCTION_TREE.md:13-24,86-108`
- `docs/SHARED_COMPONENTS.md:13-46,75-89`
- `docs/WIRING_MATRIX.md:13-73,95-104`
- `app/components/ChapterReader.js:214-225`
- `app/components/ChapterReader.js:326-421`
- `app/components/ProofingReader.js:1163-1169`
- `app/components/ProofingReader.js:1216-1230`
- `app/components/ReaderChrome.js:254-289`
- `app/components/ReaderChrome.js:542-555`
- `app/phone/_components/PhoneReader.js:162-216`
- `app/phone/page.js:952-960`
- `app/phone/page.js:1298-1456`
- `app/phone/page.js:2673-2693`

## Pass Items

1. Safe preflight passed for this zone. `git status --short` showed only
   pre-existing audit/docs dirt, `.env.local` exists, `Script and Sync Releases`
   exists, `npm test -- --test-reporter=spec` passed `13` of `13`, and
   `npm run build` completed cleanly.

2. The repo still uses shared UX primitives instead of new ad hoc reader
   copies. `docs/SHARED_COMPONENTS.md:13-46` still points Quill at
   `ChapterReader`, the app structure keeps the main desktop/phone surfaces
   centralized, and the production build succeeded without route/build errors.

3. Several user-facing overlays do have close behavior and labels in the
   current source. `useDismissable()` closes on outside click plus `Escape` in
   `app/components/ReaderChrome.js:542-555`, and the phone reader selection
   handles carry explicit labels in `app/phone/_components/PhoneReader.js:193-212`.

## Fail Items

1. Core reader interaction is still pointer-only across the main manuscript
   surfaces, which leaves the shared reader, phone reader, and Proof word
   actions effectively unavailable to keyboard-only users. In the shared
   desktop reader, each unit is a plain `<span>` with pointer handlers only and
   no focus or keyboard handler in `app/components/ChapterReader.js:214-225`.
   The reader body also disables native text selection in
   `app/components/ChapterReader.js:374-386`. The phone reader mirrors that
   same pattern in `app/phone/_components/PhoneReader.js:184-216`, and Proof's
   word-action path is opened from a double-click target search in
   `app/components/ProofingReader.js:1216-1230`. Expected result: the core
   read/select/annotate or read/select/flag flow should expose a keyboard path,
   not only pointer gestures and double-click.

2. The shared top-left Home/Back pill still uses icon-only navigation without
   an explicit accessible name. `HomeBackPill` renders a button with only `⌂`
   or `←` text plus a `title`, but no `aria-label`, in
   `app/components/ReaderChrome.js:270-287`. Because this component is shared
   across reader/library navigation, the missing accessible name affects more
   than one mode. Expected result: shared navigation chrome should announce a
   clear action such as "Back to projects" or "Back to book" to assistive
   tech, not only a glyph.

3. Phone Quill still gives contradictory audio guidance in the no-match path.
   On the chapter list, the picker status tells Marie `No filenames matched.
   You can still pick audio inside the reader.` in `app/phone/page.js:952-960`.
   But the actual reader dock hides that picker when `allowManualPick={false}`
   and instead tells her `Back to the chapter list to pick the audio folder.` in
   `app/phone/page.js:2673-2693`. Expected result: both screens should point to
   the same recovery path.

## Watchlist Items

1. `useDismissable()` listens for `mousedown`, not `pointerdown` or
   `touchstart`, in `app/components/ReaderChrome.js:545-555`. I did not prove a
   live touch failure, but outside-tap dismissal on touch/hybrid devices is
   still unverified.

2. The production build succeeded, but the current first-load bundles are still
   fairly heavy for a UX-quality pass: `/` reported `280 kB` first-load JS and
   `/phone` reported `218 kB`. This is a performance watchlist item, not a
   confirmed bug from this run.

3. Phone Quill edit/delete annotations remain a visible UX gap in the phone
   flow. This is already tracked outside this zone in `TODO.md` and in the
   earlier Phone Quill zone work, so I am not treating it as a new Zone 13
   claim here.

## What Was Not Tested

- No live keyboard-only walkthrough in Electron or the browser.
- No screen-reader pass.
- No live mobile/touch outside-dismiss test.
- No responsive screenshot sweep across narrow and wide breakpoints.
- No live phone Quill audio no-match reproduction.
- No real file, cloud, or Save Data interaction.

Reason: this run stayed read-only and limited itself to safe tests, a production
build, and source-trace evidence.

## Possible Duplicate Bug References

- No direct existing bug-log match found for the shared-reader keyboard-access
  gap.
- No direct existing bug-log match found for the shared Home/Back pill missing
  accessible name.
- The Phone Quill no-match guidance contradiction matches the earlier
  Inspector B Phone Quill finding in
  `docs/audits/monitors/2026-06-02-manual-start/zone-phone-quill/inspector-b.md`,
  but I did not find a dedicated bug-log entry for it yet.

## Next Checks

1. Run a safe live keyboard-only pass through Proof, Quill, and the phone
   reader to confirm the source-traced access gap on real UI surfaces.
2. Verify shared icon-only controls with a screen reader or accessibility tree,
   starting with the shared Home/Back pill and the Proof search icon.
3. Reproduce the Phone Quill no-audio-match flow live and confirm which message
   should remain after repair.
