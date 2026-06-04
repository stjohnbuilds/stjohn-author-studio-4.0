# Inspector C - Zone 5 - Duet Prep

## Scope

Read-only audit of the Duet Prep desktop flow in the current source tree.
This run covered source docs, Duet source paths, safe grep/snippet inspection,
a small read-only Node reproduction for marker time formatting, and the current
automated test suite. No product code was edited. No real Save Data was
touched. No live Electron, Whisper, or real-file export workflow was run in
this zone.

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `READ ME FIRST - OPEN THIS.txt`
- `HANDOFF.md`
- `CLAUDE.md`
- `TODO.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`
- `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`

## Commands Run With Exit Codes

- `sed -n '1,180p' docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md` -> exit `0`
- `sed -n '1,180p' docs/APP_STRUCTURE.md` -> exit `0`
- `sed -n '1,220p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> exit `0`
- `rg -n "Duet Prep|duet|Prebuild|marker|markers|export markers" READ\ ME\ FIRST\ -\ OPEN\ THIS.txt HANDOFF.md CLAUDE.md TODO.md docs/FRONT_FUNCTION_TREE.md docs/INTERNAL_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/WIRING_MATRIX.md docs/CLOUD_SCHEMA.md docs/CLOUD_SAFETY_AUDIT.md docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> exit `0`
- `rg -n "PrebuildMode|ImportFlow|exportMarkersFolder|marker|duet|prebuild-projects|readPrebuild|writePrebuild|pdfPageMap|pageNumberAdjustment" app/components/PrebuildMode.js app/components/ImportFlow.js app/page.js main.js preload.js tests` -> exit `0`
- `sed -n '1,260p' app/components/PrebuildMode.js` -> exit `0`
- `sed -n '260,620p' app/components/PrebuildMode.js` -> exit `0`
- `sed -n '1440,1495p' main.js` -> exit `0`
- `nl -ba app/components/PrebuildMode.js | sed -n '320,390p'` -> exit `0`
- `nl -ba app/components/PrebuildMode.js | sed -n '760,990p'` -> exit `0`
- `rg -n "export markers|markers.csv|exportMarkersFolder|folderName|ready to scan|mergeGroup|splitGroup|treatAsOne|whisperAlignment" app/components/PrebuildMode.js` -> exit `0`
- `rg --files tests | sort` -> exit `0`
- `nl -ba app/components/PrebuildMode.js | sed -n '180,210p'` -> exit `0`
- `node - <<'EOF' ... formatAuditionTime(61.9996) ... formatAuditionTime(3599.9996) ... EOF` -> exit `0`
- `nl -ba app/components/PrebuildMode.js | sed -n '935,980p'` -> exit `0`
- `rg -n "Duet Prep|marker|markers|Audition|timestamp|1000|whisperAlignment" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` -> exit `0`
- `npm test` -> exit `0`

## Evidence Paths

- `app/components/PrebuildMode.js:196-204`
- `app/components/PrebuildMode.js:336-367`
- `app/components/PrebuildMode.js:766-805`
- `app/components/PrebuildMode.js:941-967`
- `main.js:1457-1468`
- `docs/FRONT_FUNCTION_TREE.md:64-71`
- `docs/WIRING_MATRIX.md:59-66`
- `tests/` directory listing (no duet-specific test file present)

## Pass Items

- Duet project creation is wired through the shared `ImportFlow` and stores a
  local `prebuild-projects.json` shape with chapter rows ready for later audio
  assignment and scan state. Evidence: `app/components/PrebuildMode.js:336-367`.
- The Duet scan path stores transcript words, word-to-manuscript alignment,
  and match quality per chapter, and it excludes highlighted insert lines from
  the spoken-word match percentage. Evidence:
  `app/components/PrebuildMode.js:783-805`.
- Duet marker export builds one tab-delimited marker file per chapter and
  sanitizes chapter labels before handing the files to the Electron export
  folder handler. Evidence: `app/components/PrebuildMode.js:935-967`,
  `main.js:1457-1468`.

## Fail Items

- Duet marker export can emit invalid Adobe Audition start times when the
  fractional seconds round up to `1000` milliseconds. `formatAuditionTime()`
  rounds the milliseconds but never carries overflow into the next second, so
  values near a second boundary become malformed strings like `1:01.1000` and
  `59:59.1000`. The export path writes that formatter result directly into the
  `Start` column for marker files. Evidence:
  `app/components/PrebuildMode.js:196-204`, `app/components/PrebuildMode.js:941-965`,
  and the read-only Node reproduction returned `1:01.1000` for `61.9996` and
  `59:59.1000` for `3599.9996`.
- Duet docs are still in the broader current-state drift family. The front
  function tree says the Duet controls are real, but `docs/WIRING_MATRIX.md`
  still marks the Duet rows as Phase 7 missing. Evidence:
  `docs/FRONT_FUNCTION_TREE.md:64-71`, `docs/WIRING_MATRIX.md:59-66`.

## Watchlist Items

- The current automated suite passes, but there is still no duet-specific test
  coverage for `PrebuildMode.js`, marker time formatting, scan/export wiring,
  or split/merged chapter export behavior. `rg --files tests | sort` returned
  only cloud, manuscript-engine, Prep export, Quill export, and Whisper JSON
  tests. `npm test` exited `0`, but none of those tests exercised Duet code.

## What Was Not Tested

- No live Electron launch in this zone.
- No real audio attachment or Whisper transcription.
- No live scan/re-scan of split or merged chapters.
- No actual marker-folder export to disk and no Adobe Audition import check.
- No real manuscript import or replacement flow.
- No keyboard, layout, or responsive checks in the live Duet UI.

## Possible Duplicate Bug References

- The Duet documentation mismatch is not a new bug-log family. It matches the
  existing doc-drift item `SAS-AUD-20260602-001`.
- No matching existing bug-log entry was found for the Duet marker timestamp
  overflow that produces `...1000` milliseconds.
- No matching existing bug-log entry was found for the missing duet-specific
  automated coverage; this remains a coverage gap, not a confirmed product bug.

## Next Checks

- Run an isolated-home Electron audit for Duet Prep, scan a chapter, export
  marker files, and inspect whether any exported `Start` value lands on an
  invalid `...1000` millisecond boundary.
- Add a small unit test around `formatAuditionTime()` for carry cases like
  `61.9996` and `3599.9996`.
- Live-test one split chapter group and one merged chapter export to confirm
  the exported file count, chapter labels, and cue ordering match the UI.
