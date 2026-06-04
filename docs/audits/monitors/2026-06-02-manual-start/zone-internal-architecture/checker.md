# Zone Checker - Zone 12 Internal Architecture

- Date/time: 2026-06-02 17:33 PDT
- Role: Zone Checker
- Scope: Compare `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` for
  the internal-architecture zone only; preserve disagreements; run focused
  read-only follow-up where needed; dedupe before touching the master report or
  bug log.
- Product code changed: no
- Real Save Data touched: no

## Inputs Compared

- `docs/audits/monitors/2026-06-02-manual-start/zone-internal-architecture/inspector-a.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-internal-architecture/inspector-b.md`
- `docs/audits/monitors/2026-06-02-manual-start/zone-internal-architecture/inspector-c.md`

## Checker Follow-Up Audit

Focused read-only follow-up was used to resolve the main disagreements around:

- `docs/BUILD_PLAN_V4.md`
- `CLAUDE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/APP_STRUCTURE.md`
- `app/components/ChapterReader.js`
- `app/phone/_components/PhoneReader.js`
- `app/phone/_components/renderReaderContent.js`
- `app/components/BookDetail.js`
- `app/components/SessionsView.js`
- `app/components/PrepManuscriptMode.js`
- `app/components/QuillAndInkMode.js`
- `app/components/PrebuildMode.js`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run

| Command | Exit |
|---|---:|
| `sed -n '1,260p'` on the three Zone 12 inspector reports | 0 |
| Drift-reset rereads: `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`, `docs/APP_STRUCTURE.md`, `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md` | 0 |
| `nl -ba docs/BUILD_PLAN_V4.md \| sed -n '60,150p'` | 0 |
| `nl -ba CLAUDE.md \| sed -n '1,130p'` | 0 |
| `nl -ba docs/SHARED_COMPONENTS.md \| sed -n '1,120p'` | 0 |
| `nl -ba app/components/ChapterReader.js \| sed -n '1,220p'` | 0 |
| `nl -ba app/phone/_components/PhoneReader.js \| sed -n '1,260p'` | 0 |
| `nl -ba app/phone/_components/renderReaderContent.js \| sed -n '1,160p'` | 0 |
| `nl -ba app/components/BookDetail.js \| sed -n '1,220p'` | 0 |
| `nl -ba app/components/SessionsView.js \| sed -n '1,120p;2380,2445p;2800,3115p'` | 0 |
| `nl -ba app/components/PrepManuscriptMode.js \| sed -n '680,980p'` | 0 |
| `nl -ba app/components/QuillAndInkMode.js \| sed -n '20,40p;780,980p;1640,1670p'` | 0 |
| `nl -ba app/components/PrebuildMode.js \| sed -n '1,20p;500,540p;748,820p;1090,1230p'` | 0 |
| `rg -n "getSession\\(|onAuthStateChange\\(|supabase\\.auth" app/page.js app/phone/page.js app/components/QuillAndInkMode.js packages/cloud-sync` | 0 |
| `rg -n "SAS-AUD-20260602-001\\|SAS-AUD-20260602-007\\|SAS-AUD-20260602-008\\|internal architecture\\|reader-engine\\|BookDetail\\|SessionsView" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md` | 0 |

## Merged Findings

### PASS - Shared cloud-client and Electron bridge boundaries still stay centralized

The three inspectors agreed that the current repo still keeps its highest-risk
cross-mode boundaries in one place, and the checker follow-up did not find a
contradiction:

- `packages/cloud-sync/client.js` remains the one Supabase client entry point.
- `preload.js` still exposes the Electron bridge families that `main.js`
  handles.
- App files still consume those boundaries rather than importing Electron
  directly into mode code or creating extra Supabase clients.

Evidence:

- `packages/cloud-sync/client.js:1-79`
- `preload.js:4-54`
- Inspector A, B, and C evidence lists

### RESOLVED - The shared-reader target is still only partially implemented, but this stays under the existing doc-drift item instead of becoming a new Zone 12 product bug

All three inspectors found that the source goals still promise one shared
reader while the live tree still splits reader behavior across desktop and
phone. The checker follow-up confirms that mismatch, but it is still a
target-state/current-state documentation conflict plus architecture debt, not a
new user-facing failure reproduced in this zone:

- `docs/BUILD_PLAN_V4.md` still says every mode plus phone should import one
  shared reader from `packages/reader-engine/` plus `app/components/Reader/`.
- `CLAUDE.md` says word-level modes, including phone, should render through
  `app/components/ChapterReader.js`.
- Current source still keeps desktop word rendering in
  `app/components/ChapterReader.js` while phone uses its own `PhoneReader` plus
  `renderReaderContent` walker, and the planned `packages/reader-engine/`
  package does not exist.
- `docs/SHARED_COMPONENTS.md` already documents the live mixed state for Proof,
  Quill, Prep, and Duet, which confirms the repo itself knows the migration is
  partial.

Checker assessment: resolved as overlap with existing doc-drift item
`SAS-AUD-20260602-001`. The mismatch is real and worth keeping visible, but
this checker pass did not isolate a distinct new user-facing bug beyond the
already logged documentation drift and architecture debt.

Evidence:

- `docs/BUILD_PLAN_V4.md:122-133`
- `CLAUDE.md:97-106`
- `docs/SHARED_COMPONENTS.md:23-30`, `36-41`
- `app/components/ChapterReader.js:3-17`, `97-131`
- `app/phone/_components/PhoneReader.js:1-20`
- `app/phone/_components/renderReaderContent.js:1-79`

### RESOLVED - Book-detail fragmentation is real, but the live user-facing failures already belong to existing Quill and Duet bugs instead of a new Zone 12 bug

Inspectors A and B treated the multi-surface book-detail setup as a zone fail,
while Inspector C argued it is the architecture seam behind existing Quill and
Duet failures. The checker follow-up confirms both parts:

- `CLAUDE.md` still says there should be one `BookDetail` component.
- `BookDetail.js` itself says Quill and Duet should use that shared surface,
  while Proof and Prep are exceptions or pending migrations.
- Current source still routes Quill and Duet through `ProofBookDetail` from
  `SessionsView.js`, and Prep still keeps an inline `BookDetailView`.
- The same adapter seam is already where current user-facing bugs live:
  Quill's chapter-removal bridge filters chapters and audio but leaves
  annotations behind (`SAS-AUD-20260602-007`), and Duet's adapter still maps
  completion through `scanned` even though the scan path writes
  `transcribed: true` (`SAS-AUD-20260602-008`).

Checker assessment: no separate new architecture bug added here. The checker
expanded the existing doc-drift item for the one-component-per-job mismatch and
kept the actual user-facing failures under existing bug entries
`SAS-AUD-20260602-007` and `SAS-AUD-20260602-008`.

Evidence:

- `CLAUDE.md:5-16`
- `docs/SHARED_COMPONENTS.md:21-30`, `46-55`
- `app/components/BookDetail.js:3-16`
- `app/components/PrepManuscriptMode.js:694-721`, `881-919`
- `app/components/QuillAndInkMode.js:21-23`, `787-890`, `891-948`
- `app/components/PrebuildMode.js:6-7`, `1098-1158`, `1190-1221`
- `app/components/SessionsView.js:2403-2445`, `2826-2829`, `3098-3100`

### LIKELY - Auth/session orchestration is still duplicated across desktop, phone, and Quill

Only Inspector A raised this explicitly. The checker follow-up confirms that
the same session bootstrap pattern still appears in multiple surfaces:

- Desktop shell calls `supabase.auth.getSession()` and
  `supabase.auth.onAuthStateChange()` in `app/page.js`.
- Phone shell repeats that pattern in `app/phone/page.js`.
- Quill mode also calls `supabase.auth.getSession()` directly.

Checker assessment: likely architecture risk, not a confirmed product bug. The
shared cloud package still owns the client, but auth/session orchestration is
not yet consolidated enough to log a new bug from static reading alone.

Evidence:

- `app/page.js:588-597`
- `app/phone/page.js:587-597`
- `app/components/QuillAndInkMode.js:502`, `545`
- `packages/cloud-sync/account.js:59-137`

### LIKELY - Reader and book-detail seams still lack targeted automated coverage

Inspectors B and C both raised the weak coverage story, and Inspector A did not
contradict it. The checker follow-up did not find targeted tests for these
shared seams.

Checker assessment: likely follow-up risk, not a new bug entry in this zone.

Evidence:

- `tests/`
- Inspector B and Inspector C report evidence lists

## Duplicate Checks

- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed existing doc-drift item
  `SAS-AUD-20260602-001` already covered the shared-reader target drift family,
  so this checker pass expanded that item instead of creating a duplicate Zone
  12 docs/architecture bug.
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`: confirmed existing bugs
  `SAS-AUD-20260602-007` and `SAS-AUD-20260602-008` already capture the live
  Quill and Duet user-facing failures tied to the `SessionsView` adapter seam,
  so no duplicate internal-architecture bug was added for those symptoms.
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`: found no earlier Zone 12
  checker section, so this run appends one new checker section rather than
  updating an older zone-checker entry.

## Overall Assessment

- Zone status: checked
- Audit result: no new bug ID added; existing doc-drift item expanded; existing
  Quill and Duet bugs kept as the live user-facing issues on this seam
- Confidence: high
- Why not higher: this zone stayed static/read-only, so there was no live UI
  parity run across desktop, phone, Quill, or Duet

## Next Steps

- Later safe parity audit: open the same generated chapter in desktop Quill,
  desktop Proof, and phone to compare spacing, token boundaries, selection
  behavior, and heading rendering across the split reader surfaces.
- Later docs-only cleanup: separate target-state notes from present-state usage
  in `CLAUDE.md`, `docs/BUILD_PLAN_V4.md`, and `docs/SHARED_COMPONENTS.md` so
  auditors are not reading aspirational architecture as current implementation.
- Next later checker-ready zone: wait for the first later active-priority zone
  where `inspector-a.md`, `inspector-b.md`, and `inspector-c.md` all exist and
  no `checker.md` exists; no later zone is checker-ready right now.
