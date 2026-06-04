# Conflict Ledger - Zone 12 Internal Architecture

The three inspectors agreed that the current repo still keeps the cloud client
and Electron bridge boundaries centralized. The differences were about whether
the split reader and fragmented book-detail surfaces should become new product
bugs, or whether they belong under existing doc drift and already logged Quill
and Duet failures.

## Conflict 1 - Should the missing one-reader target be logged as a new internal-architecture bug?

- Original Inspector A claim: the source-goal single-reader architecture is not
  implemented because the repo still splits reader behavior across Proof,
  `ChapterReader`, and the phone reader.
- Original Inspector B claim: the shared-reader architecture is still split
  across multiple live implementations and should count as a zone fail.
- Original Inspector C claim: the phone still runs on a separate reader
  implementation instead of the shared reader required by the source goals, but
  the older target/doc mismatch likely stays under existing doc drift.
- Evidence:
  - `docs/BUILD_PLAN_V4.md:122-133`
  - `CLAUDE.md:97-106`
  - `docs/SHARED_COMPONENTS.md:23-30`, `36-41`
  - `app/components/ChapterReader.js:3-17`, `97-131`
  - `app/phone/_components/PhoneReader.js:1-20`
  - `app/phone/_components/renderReaderContent.js:1-79`
- Checker follow-up audit: confirmed the shared-reader target is still only
  partially implemented and that the planned `packages/reader-engine/` package
  is still absent, but also confirmed the live docs already describe the mixed
  present-state migration.
- Checker assessment: keep visible under existing doc-drift item
  `SAS-AUD-20260602-001` instead of creating a duplicate new Zone 12 bug.
- Status: `resolved`
- Next check needed: a later docs-only cleanup should separate target-state
  reader plans from current source-of-truth usage, then a later UI parity audit
  should compare the same chapter across desktop and phone.

## Conflict 2 - Is the fragmented book-detail surface its own new bug, or the architecture seam behind existing Quill and Duet bugs?

- Original Inspector A claim: the shared-component rule is bypassed because
  Prep still keeps an inline `BookDetailView`, while Duet and Quill still rely
  on legacy `SessionsView` wrappers instead of one clearly shared book-detail
  contract.
- Original Inspector B claim: the repo still has three active book-detail
  shapes, so the book-detail surface is fragmented across multiple
  implementations instead of one.
- Original Inspector C claim: the `SessionsView` adapter seam is architecture
  debt and likely the parent cause behind existing Quill and Duet failures,
  rather than a separate user-facing bug by itself.
- Evidence:
  - `CLAUDE.md:5-16`
  - `docs/SHARED_COMPONENTS.md:21-30`, `46-55`
  - `app/components/BookDetail.js:3-16`
  - `app/components/PrepManuscriptMode.js:694-721`, `881-919`
  - `app/components/QuillAndInkMode.js:21-23`, `787-890`, `891-948`
  - `app/components/PrebuildMode.js:6-7`, `1098-1158`, `1190-1221`
  - `app/components/SessionsView.js:2403-2445`, `2826-2829`, `3098-3100`
- Checker follow-up audit: confirmed the fragmentation is real and also
  confirmed that the same adapter seam already feeds existing bugs
  `SAS-AUD-20260602-007` and `SAS-AUD-20260602-008`.
- Checker assessment: do not create a new standalone Zone 12 bug. Keep the
  one-component-per-job mismatch under `SAS-AUD-20260602-001`, and keep the
  live user-facing failures under `SAS-AUD-20260602-007` and
  `SAS-AUD-20260602-008`.
- Status: `resolved`
- Next check needed: if a later repair pass is approved, map book-detail
  consolidation only after the Quill chapter-removal and Duet completion-state
  bugs are fixed or guarded by targeted tests.

## Conflict 3 - Should duplicated auth/session bootstrap logic become a new bug?

- Original Inspector A claim: auth/session orchestration is duplicated across
  the desktop shell, phone shell, and Quill mode, which weakens the one-cloud
  path goal.
- Original Inspector B claim: did not raise this as a fail item.
- Original Inspector C claim: did not raise this as a fail item.
- Evidence:
  - `app/page.js:588-597`
  - `app/phone/page.js:587-597`
  - `app/components/QuillAndInkMode.js:502`, `545`
  - `packages/cloud-sync/account.js:59-137`
- Checker follow-up audit: confirmed the repeated `getSession` /
  `onAuthStateChange` patterns, but did not find a deterministic user-facing
  failure from that duplication in this static zone.
- Checker assessment: keep as a likely architecture risk, not a new bug entry.
- Status: `likely`
- Next check needed: later safe account-swap and sign-out parity testing across
  desktop, phone, and Quill surfaces.

## Conflict 4 - Should the missing reader/book-detail coverage become a bug?

- Original Inspector A claim: did not raise this as a fail item.
- Original Inspector B claim: the current suite lacks targeted automated
  coverage for reader-shell parity or book-detail reuse.
- Original Inspector C claim: the same coverage gap remains visible and should
  stay on the follow-up list.
- Evidence:
  - `tests/`
  - Inspector B and Inspector C report command output
- Checker follow-up audit: confirmed the current automated suite still focuses
  on cloud, manuscript, export, and Whisper helpers rather than reader/detail
  parity.
- Checker assessment: keep as a likely follow-up risk, not as a new bug entry
  in this zone.
- Status: `likely`
- Next check needed: add targeted tests later for shared reader/body parity and
  shared book-detail behavior before any large architecture cleanup.
