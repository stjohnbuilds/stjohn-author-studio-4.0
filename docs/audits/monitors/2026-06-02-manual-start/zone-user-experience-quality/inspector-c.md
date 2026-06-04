# Inspector C - Zone 13 - User Experience Quality

## Scope

- Independent read-only audit of desktop and phone user-experience quality with
  emphasis on accessibility, keyboard use, responsive behavior, and visible UX
  polish risks.
- Focused on the current user-facing shells in `app/page.js`,
  `app/components/ProofingReader.js`, `app/components/QuillAndInkMode.js`,
  `app/components/PrepManuscriptMode.js`, `app/components/BookDetail.js`, and
  `app/phone/page.js`.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

- `date '+%Y-%m-%d %H:%M:%S %Z'` -> exit `0`
- `date -u '+%Y-%m-%dT%H:%M:%SZ'` -> exit `0`
- `git status --short` -> exit `0`
- `npm test -- --test-reporter=spec` -> exit `0`
- `printf '.env.local: '; test -f .env.local && echo yes || echo no; printf 'mac release dir: '; test -d 'Script and Sync Releases' && echo yes || echo no; printf 'windows release files: '; rg --files 'Script and Sync Releases' -g '*win*' -g '*.exe' -g '*.msi' | sed -n '1,20p' || true` -> exit `0`
- `rg -n "onClick=|aria-label|tabIndex|min-w-|overflow-x-auto|console\\.(log|warn|error)" app/page.js app/phone/page.js app/components/ProofingReader.js app/components/PrepManuscriptMode.js app/components/QuillAndInkMode.js app/components/BookDetail.js app/phone/_components/PhoneReader.js app/phone/_components/PhoneReaderSettings.js` -> exit `0`
- `rg -n "onKeyDown|keydown|key === 'Enter'|key === \\\"Enter\\\"|key === ' '" app/components/PrepManuscriptMode.js app/components/ProofingReader.js app/phone/_components/PhoneReader.js app/phone/page.js` -> exit `0`
- `rg -n "data-cr-unit|renderedBody|openWordActionMenu|onDoubleClick" app/components/ProofingReader.js` -> exit `0`
- `rg -n "double-click a word|keyboard|screen reader|aria-label|accessible name|icon-only|reader accessibility|Add annotation|Close settings|Search manuscript" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` -> exit `0`

## Evidence Paths

- `app/components/ProofingReader.js:439-456`
- `app/components/ProofingReader.js:1092-1114`
- `app/components/ProofingReader.js:1169`
- `app/components/ProofingReader.js:1205-1207`
- `app/components/ProofingReader.js:1223-1229`
- `app/components/ProofingReader.js:1289`
- `app/components/ProofingReader.js:1307-1340`
- `app/components/ProofingReader.js:1444-1445`
- `app/components/PrepManuscriptMode.js:1426-1444`
- `app/components/QuillAndInkMode.js:1691-1693`
- `app/components/QuillAndInkMode.js:1812-1828`
- `app/components/QuillAndInkMode.js:1853-1870`
- `app/phone/page.js:1388-1401`
- `app/phone/page.js:1429-1444`
- `app/page.js:1905-1909`
- `docs/BUILD_PLAN_V4.md:20-24`
- `docs/APP_STRUCTURE.md:13-20`

## Pass Items

- Prep dialogue spans do have a keyboard path: they render with
  `role="button"`, `tabIndex={0}`, and `Enter`/space handlers instead of being
  mouse-only. Evidence: `app/components/PrepManuscriptMode.js:1426-1444`.
- Phone reader drag handles and settings close affordance already carry labels,
  so some touch/accessibility affordances are in place. Evidence:
  `app/phone/_components/PhoneReader.js:191-214`,
  `app/phone/_components/PhoneReaderSettings.js:75-76`.
- Repo tests passed in this run: `13` passing, `0` failing.

## Fail Items

- New confirmed accessibility gap: the desktop Proof reader has no keyboard
  path to the per-word "Jump here" / "Flag here" actions. The reader body is
  rendered as passive `data-cr-unit` spans, the action menu is opened only from
  `onDoubleClick`, and the visible styling only covers `:hover`. The global
  `keydown` handler supports shortcut keys like `F` and arrows, but it does not
  provide a way to focus a word and open the word-specific action popover.
  Evidence: `app/components/ProofingReader.js:439-456`,
  `app/components/ProofingReader.js:1092-1114`,
  `app/components/ProofingReader.js:1223-1229`,
  `app/components/ProofingReader.js:1444-1445`.
- New confirmed accessibility gap: multiple icon-only controls still ship
  without accessible names, so assistive tech is left with unlabeled `✕`, `+`,
  or arrow glyph buttons. This appears in the desktop settings close button,
  Proof reader close/search controls, Quill desktop custom-option controls, and
  the phone Quill custom-option controls. Evidence:
  `app/page.js:1905-1909`, `app/components/ProofingReader.js:1169`,
  `app/components/ProofingReader.js:1205-1207`,
  `app/components/ProofingReader.js:1289`,
  `app/components/QuillAndInkMode.js:1691-1693`,
  `app/components/QuillAndInkMode.js:1812-1828`,
  `app/components/QuillAndInkMode.js:1853-1870`,
  `app/phone/page.js:1388-1401`,
  `app/phone/page.js:1429-1444`.

## Watchlist Items

- Static responsive-risk watchlist: the Proof reader still uses fixed desktop
  grids in the flag editor and sheet-row preview with no narrow-width fallback
  in the current source. The top chrome also keeps a rigid `1fr auto 1fr`
  layout while the right-side control cluster can grow. This looks likely to
  crowd or overflow in a narrow desktop window, but I did not live-test a small
  viewport in this run. Evidence: `app/components/ProofingReader.js:1135`,
  `app/components/ProofingReader.js:1307-1340`.
- Existing Node ESM warning remains a UX-adjacent watch item for local
  developer/test noise: `npm test` passes, but Node still prints
  `MODULE_TYPELESS_PACKAGE_JSON` warnings for several package files. This is
  not a user-facing app failure in this zone.

## What Was Not Tested

- No live Electron or browser session.
- No screen-reader run, keyboard-only walkthrough, or small-window resize
  repro.
- No phone-device live test.
- No Save Data, packaged app state, or Marie real files touched.

## Possible Duplicate Bug References

- None found in the current bug log or master report for these specific
  keyboard-only Proof reader or unlabeled icon-control accessibility failures.
- Adjacent but different: existing doc-drift item `SAS-AUD-20260602-001`
  covers plan/tree mismatch, not these UX-control defects.

## Next Checks

- Live-test the desktop Proof reader with keyboard only: verify whether a user
  can reach a word, open the per-word action menu, and create a word-specific
  flag without a mouse.
- Run one focused screen-reader pass over desktop settings, Proof reader, and
  Quill annotation popovers to confirm exactly how the unlabeled glyph buttons
  are announced.
- Resize the Proof reader to a narrow desktop width and capture whether the
  fixed flag-editor grids overflow or clip.
