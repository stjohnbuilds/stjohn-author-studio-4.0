# Conflict Ledger - Zone 1 Source Goals And App Tree Drift

No hard pass/fail contradiction appeared across the three inspectors. The differences were about scope, emphasis, and whether smaller doc issues should be folded into the existing doc-drift bug. Those deltas are preserved below.

## Conflict 1 - Shared-reader claim vs current implementation

- Original Inspector A claim: `BUILD_PLAN_V4.md` still says one reader lives in `packages/reader-engine/` plus `app/components/Reader/`, but those paths do not exist; current docs/code show a mixed reality with `ChapterReader.js`, `ProofingReader.js`, and pending migration notes.
- Original Inspector B claim: same core finding; tied it to `docs/SHARED_COMPONENTS.md` and treated it as part of `SAS-AUD-20260602-001`.
- Original Inspector C claim: same core finding; called it stale shared-reader architecture wording rather than a product failure.
- Evidence:
  - `docs/BUILD_PLAN_V4.md:122-129`
  - `docs/SHARED_COMPONENTS.md:23-33`, `36-41`
  - `app/components/ChapterReader.js`
  - `app/components/ProofingReader.js`
- Checker follow-up audit: re-read the plan and shared-components doc to distinguish target-state wording from current-state wording.
- Checker assessment: confirmed doc-drift within the existing Zone 1 bug.
- Status: `resolved`
- Next check needed: docs-only cleanup after the monitor pass.

## Conflict 2 - Old branding and release-handoff wording in `READ ME FIRST - OPEN THIS.txt`

- Original Inspector A claim: did not elevate this as a separate finding.
- Original Inspector B claim: old `AUDIoproofer 5.0` / `Script and Sync` naming may cause old-build confusion and should be treated as doc-drift.
- Original Inspector C claim: did not elevate this item separately.
- Evidence:
  - `READ ME FIRST - OPEN THIS.txt:1-12`
  - `READ ME FIRST - OPEN THIS.txt:22-49`
- Checker follow-up audit: confirmed the old naming is present, but Zone 1 did not prove a live user failure from it.
- Checker assessment: likely part of the same doc-drift family, not a separate bug ID yet.
- Status: `likely`
- Next check needed: Zone 10 release/package audit should confirm whether this wording is still intentional.

## Conflict 3 - Missing `supabase/` reference and schema-table wording

- Original Inspector A claim: `CLOUD_SAFETY_AUDIT.md` points to `supabase/`, and `CLOUD_SCHEMA.md` says "four tables" while describing six.
- Original Inspector B claim: did not call out the table-count typo, but confirmed cloud docs/code broadly align and the zone was static only.
- Original Inspector C claim: `CLOUD_SAFETY_AUDIT.md` points to missing `supabase/`; six-table usage still appears supported by current code.
- Evidence:
  - `docs/CLOUD_SAFETY_AUDIT.md:22-38`
  - `docs/CLOUD_SCHEMA.md:6-8`, `52-56`
- Checker follow-up audit: confirmed both wording drifts are real and documentation-only.
- Checker assessment: merge into the existing doc-drift bug.
- Status: `resolved`
- Next check needed: Zone 9 should use the current cloud package paths as the audit anchor.

## Conflict 4 - `APP_STRUCTURE.md` omission of `quill-project-list.json`

- Original Inspector A claim: did not call this out.
- Original Inspector B claim: did not call this out.
- Original Inspector C claim: `APP_STRUCTURE.md` is slightly behind because it omits `quill-project-list.json`.
- Evidence:
  - `docs/APP_STRUCTURE.md:175-183`
  - `main.js:239`
  - `main.js:1056-1068`
- Checker follow-up audit: confirmed the omission is real.
- Checker assessment: likely doc-drift, but too minor to split into the bug log during this run.
- Status: `likely`
- Next check needed: revisit during the save-data/backups or export/release zones.
