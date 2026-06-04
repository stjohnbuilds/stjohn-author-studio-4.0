# Zone Checker - Zone 1 Source Goals And App Tree Drift

- Date/time: 2026-06-02 01:33 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for Zone 1 only; preserve disagreements; run focused read-only follow-up where needed; dedupe before touching the master report or bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-source-goals-app-tree-drift/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-source-goals-app-tree-drift/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-source-goals-app-tree-drift/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve scope and severity differences around:

- `docs/BUILD_PLAN_V4.md`
- `docs/WIRING_MATRIX.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/CLOUD_SCHEMA.md`
- `READ ME FIRST - OPEN THIS.txt`
- `docs/APP_STRUCTURE.md`
- `main.js`

## Commands Run

| Command | Exit |
|---|---:|
| `find docs/audits/monitors -type f \\( -name 'inspector-a.md' -o -name 'inspector-b.md' -o -name 'inspector-c.md' -o -name 'checker.md' \\) \| sort` | 0 |
| `sed -n '1,260p'` on the three Zone 1 inspector reports | 0 |
| `sed -n '1,260p' docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` | 0 |
| `sed -n '1,320p' docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba docs/BUILD_PLAN_V4.md \| sed -n '1,220p'` | 0 |
| `nl -ba docs/WIRING_MATRIX.md \| sed -n '1,180p'` | 0 |
| `nl -ba 'READ ME FIRST - OPEN THIS.txt' \| sed -n '1,120p'` | 0 |
| `nl -ba docs/CLOUD_SAFETY_AUDIT.md \| sed -n '1,120p'` | 0 |
| `nl -ba docs/CLOUD_SCHEMA.md \| sed -n '1,140p'` | 0 |
| `nl -ba docs/SHARED_COMPONENTS.md \| sed -n '1,220p'` | 0 |
| `nl -ba docs/APP_STRUCTURE.md \| sed -n '150,210p'` | 0 |
| `nl -ba main.js \| sed -n '220,250p'` and `sed -n '1050,1075p'` | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |

## Merged Findings

### PASS - Current product shape is present in the source tree

All three inspectors agreed that the current repo contains the intended top-level product areas: desktop shell, four desktop mode files, phone route/components, shared cloud-sync package, backups, audio engine, manuscript engine, Quill engine, scripts, and tests.

Evidence:

- `app/page.js`
- `app/phone/page.js`
- `app/components/PrepManuscriptMode.js`
- `app/components/PrebuildMode.js`
- `app/components/QuillAndInkMode.js`
- `packages/cloud-sync/`
- `packages/backups/`
- `packages/manuscript-engine/`
- `packages/quill-engine/`

### CONFIRMED DOC-DRIFT - Existing bug `SAS-AUD-20260602-001` should absorb the Zone 1 disagreements

The inspectors all found the same core issue: current source docs disagree about the app's real state. The checker follow-up confirms these sub-findings belong to the existing documentation-drift item rather than separate product bugs:

- `docs/BUILD_PLAN_V4.md:3` still says "Phase 1 in progress" while the current tree and newer structure docs show later-mode files and phone files exist.
- `docs/WIRING_MATRIX.md:28`, `53-57`, `63-75`, and `81-96` still mark current shell, Prep, Duet, Quill, and phone flows as `MISSING`.
- `docs/BUILD_PLAN_V4.md:128-129` still describes the shared reader as living in `packages/reader-engine/` and `app/components/Reader/`, but current docs and code show a mixed present state: Quill uses `app/components/ChapterReader.js`, Proof still uses `app/components/ProofingReader.js`, and `docs/SHARED_COMPONENTS.md:23-33` explicitly says Proof migration is pending while Prep and Duet intentionally use different reader models.
- `docs/CLOUD_SAFETY_AUDIT.md:37` still points reviewers to `supabase/`, which is absent in this repo, while `docs/CLOUD_SCHEMA.md` is acting as the current schema reference.
- `docs/CLOUD_SCHEMA.md:6-8` says "The four StJohn 4.0 tables" even though the same file documents six tables by name.
- `READ ME FIRST - OPEN THIS.txt:1`, `6`, `23`, `29`, and `35-49` still use older product naming and release instructions (`AUDIoproofer 5.0`, `Script and Sync 3.0`, `Script and Sync.app`). This is documentation drift and release-confusion risk, but not a confirmed product failure from Zone 1 alone.

Checker assessment: keep one deduped doc-drift bug, expand its evidence, and do not split these into new bugs yet.

### PASS WITH STATIC EVIDENCE - Cloud/audio safety claims are directionally consistent in code, despite doc wording drift

The inspectors did not disagree on the static cloud result. The checker follow-up supports their conclusion: current sync code still hard-whitelists the six approved tables and strips audio-related fields before upload. This remains static-only evidence, not a live cloud audit.

Evidence:

- `packages/cloud-sync/client.js:22-37`
- `packages/cloud-sync/audio-guard.js:12-84`
- `packages/cloud-sync/proof-sync.js`
- `packages/cloud-sync/quill-sync.js`

### LIKELY DOC-DRIFT, HELD OUT OF BUG LOG FOR NOW - `APP_STRUCTURE.md` save-file inventory is slightly incomplete

Inspector C flagged that `docs/APP_STRUCTURE.md:177-183` omits `quill-project-list.json`, while `main.js:239` and `main.js:1056-1068` show that summary file exists. The checker follow-up confirms the omission is real, but it is lower priority than the broader Zone 1 doc-drift already logged. Because this detail is more relevant to later save-data and export/release zones, it is recorded here and in the conflict ledger only for now.

Checker assessment: likely true, not urgent enough to split into a separate bug this run.

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: searched existing `SAS-AUD-20260602-001`; updated that item instead of creating a new doc-drift bug.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: existing setup pass already referenced the same doc-drift family; appended a checker run instead of duplicating the finding.

## Overall Assessment

- Zone status: checked
- Audit result: doc-drift confirmed; no new product bug confirmed in Zone 1
- Confidence: medium-high
- Why not higher: this zone stayed static/read-only and did not live-test release packaging, cloud flows, or UI behavior

## Next Steps

- Later docs-only cleanup should separate current implementation truth from historical plan or target-state notes.
- Zone 10 should verify whether the old naming in `READ ME FIRST - OPEN THIS.txt` is still intentional for packaged-release handoff, or should be updated.
- Zone 9 should treat `docs/CLOUD_SAFETY_AUDIT.md` and `docs/CLOUD_SCHEMA.md` as documentation-drift inputs, then do the real cloud safety audit against current `packages/cloud-sync/` code and any live-safe checks.
- The next zone-checker run should wait for the first later zone with all three inspector reports present and no checker report.
