# Zone Checker - Zone 13 User Experience Quality

- Date/time: 2026-06-02 21:42 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for
  the User Experience Quality zone only; preserve disagreements; run focused
  read-only follow-up where needed; dedupe before touching the master report or
  bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-user-experience-quality/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-user-experience-quality/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-user-experience-quality/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main differences around:

- `app/components/SessionsView.js`
- `app/components/ChapterReader.js`
- `app/components/ReaderChrome.js`
- `app/components/ProofingReader.js`
- `app/components/PrebuildMode.js`
- `app/components/PrepManuscriptMode.js`
- `app/components/QuillAndInkMode.js`
- `app/phone/_components/PhoneReader.js`
- `app/phone/page.js`
- `app/page.js`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '228,320p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` | 0 |
| `sed -n '1,220p'` on the three Zone 13 inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| Duplicate scans: `rg -n "dialog\|aria-expanded\|keyboard\|accessible name\|double-click"` across the bug log and master report | 1 |
| Targeted `nl -ba` follow-up on `SessionsView.js`, `ChapterReader.js`, `ReaderChrome.js`, `ProofingReader.js`, `PrebuildMode.js`, `PrepManuscriptMode.js`, `QuillAndInkMode.js`, `app/page.js`, `app/phone/page.js`, and `PhoneReader.js` | 0 |

## Merged Findings

### PASS - The current UI still has real shared surfaces, some keyboard-ready controls, and a clean safe baseline from the inspector runs

The three inspectors did not find a placeholder UI. They also agreed that some
accessibility groundwork is already present:

- Prep dialogue spans already expose keyboard handlers
- phone reader drag handles already have labels
- shared info tips support focus-visible styling
- the inspector preflights kept a passing safe test baseline, and Inspector B
  also recorded a clean `npm run build`

Evidence:

- `app/components/PrepManuscriptMode.js:1426-1444`
- `app/phone/_components/PhoneReader.js:193-212`
- `app/components/InfoTip.js:3-14`
- `app/globals.css:46-66`
- inspector preflight receipts inside the three Zone 13 inspector reports

### CONFIRMED BUG - Custom overlay surfaces still lack dialog semantics and focus management across modes

Inspector A raised the missing dialog/focus seam, and the checker follow-up
confirms it across multiple current overlays:

- fixed overlay panels are rendered with plain `div` containers
- no `role="dialog"` or `aria-modal` is present on the inspected surfaces
- shared dismiss wiring closes on outside `mousedown` and `Escape`, but the
  checker did not find a focus trap or focus-return path in the current source

Checker assessment: distinct source-traced UX/accessibility bug. Logged as
`SAS-AUD-20260602-021`.

Evidence:

- `app/page.js:2329-2340`
- `app/components/PrebuildMode.js:381-392`
- `app/components/PrepManuscriptMode.js:780-791`
- `app/components/QuillAndInkMode.js:1051-1062`
- `app/components/ReaderChrome.js:542-555`

### CONFIRMED BUG - Core reader word interactions are still pointer-only, leaving no keyboard path for several main reading actions

Inspectors B and C independently found the same deeper seam, and the checker
follow-up confirms it in current source:

- desktop Quill chapter text units are passive spans with pointer handlers only
- the desktop chapter reader disables native text selection
- phone reader words mirror the same pointer-only word interaction pattern
- Proof's word action menu opens from double-click on a word target rather than
  a focusable keyboard path

Checker assessment: distinct source-traced UX/accessibility bug affecting core
reader interaction. Logged as `SAS-AUD-20260602-022`.

Evidence:

- `app/components/ChapterReader.js:214-225`
- `app/components/ChapterReader.js:374-386`
- `app/phone/_components/PhoneReader.js:184-216`
- `app/components/ProofingReader.js:1223-1229`

### CONFIRMED BUG - Disclosure and icon-only controls still miss accessible state or accessible names in current source

Inspectors A, B, and C each found different examples of the same control-level
accessibility seam, and the checker follow-up confirms that the current source
still includes:

- Proof chapter and section expanders that swap `▲` / `▼` glyphs with no
  `aria-expanded` signal
- the shared Home/Back pill rendered as a glyph-only button with `title` but no
  explicit accessible name
- several reader/settings/custom-option buttons that expose only `✕`, `+`, or
  arrow glyphs with no explicit label

Checker assessment: distinct source-traced UX/accessibility bug. Logged as
`SAS-AUD-20260602-023`.

Evidence:

- `app/components/SessionsView.js:2946-2954`
- `app/components/SessionsView.js:3141-3144`
- `app/components/ReaderChrome.js:270-287`
- `app/components/ProofingReader.js:1165-1169`
- `app/components/ProofingReader.js:1205-1207`
- `app/page.js:1905-1908`
- `app/components/QuillAndInkMode.js:1691-1693`
- `app/components/QuillAndInkMode.js:1814-1828`
- `app/components/QuillAndInkMode.js:1855-1870`
- `app/phone/page.js:1388-1401`
- `app/phone/page.js:1429-1444`

### CONFIRMED OVERLAP - The repeated Phone Quill no-match guidance contradiction still belongs under `SAS-AUD-20260602-019`

Inspector B raised the Phone Quill no-match audio contradiction again in this
cross-cutting UX zone. The checker follow-up confirms the same contradiction is
real, but it was already logged in the dedicated Phone Quill checker pass.

Checker assessment: preserve it as a Zone 13 overlap under
`SAS-AUD-20260602-019`, not a duplicate bug.

Evidence:

- `app/phone/page.js:952-960`
- `app/phone/page.js:2673-2693`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` entry `SAS-AUD-20260602-019`

### WATCHLIST ONLY - Touch dismissal and bundle-weight concerns still need live proof before promotion

Inspectors B and C also called out narrower UX risks that the checker did not
promote to new bug-log items in this pass:

- `useDismissable()` listens on `mousedown`, so touch outside-dismiss remains
  unproven
- Inspector B's build output still showed heavy first-load JS for `/` and
  `/phone`, but this checker did not run a live performance repro

Checker assessment: keep both visible as watchlist-only notes inside this zone
report until a safe live browser or Electron pass proves an end-user failure.

Evidence:

- `app/components/ReaderChrome.js:545-555`
- Inspector B Zone 13 report build notes

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` and
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: no exact existing item
  matched the cross-mode dialog-semantics/focus-management issue, so the
  checker added `SAS-AUD-20260602-021`.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` and
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: no exact existing item
  matched the shared reader keyboard-access gap, so the checker added
  `SAS-AUD-20260602-022`.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` and
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: no exact existing item
  matched the missing accessible-state / accessible-name control seam, so the
  checker added `SAS-AUD-20260602-023`.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` and
  `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: confirmed the repeated
  Phone Quill no-match guidance contradiction already belongs under
  `SAS-AUD-20260602-019`.

## Overall Assessment

- Zone status: checked
- Audit result: three new source-traced UX/accessibility bugs confirmed,
  one repeated Phone Quill overlap kept under the existing Zone 8 bug,
  watchlist-only touch/performance notes preserved, no product-code edits, and
  no live browser/Electron/screen-reader run in this checker pass
- Confidence: medium-high
- Why not higher: the current bugs are source-traced rather than live-tested,
  and the touch-dismiss plus performance watchlist items still need a safe live
  UX pass before they should be promoted

## Next Steps

- Safe live keyboard-only pass: verify Quill reader, phone reader, and Proof
  word actions can or cannot be completed without a pointer.
- Safe accessibility-tree or screen-reader pass: confirm how the current
  glyph-only controls and custom overlays are announced.
- Safe narrow-width browser/Electron pass: confirm whether the current Proof
  reader chrome and fixed grids crowd or overflow at small desktop widths.
- The zone-checker lane has now merged every active zone in the current
  campaign; the next safest role action is lead-organizer custody and then
  fix-roadmap planning for the new UX bugs.
