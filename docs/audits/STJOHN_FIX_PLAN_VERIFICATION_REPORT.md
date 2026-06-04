# StJohn Fix Plan Verification Report

Date filed: 2026-06-03.
Reviewer role: independent verification of `docs/dev/active/project-monitor-automation-2026-06-02/plan.md` Step 9 (12-block fix roadmap) against the current source tree.
Scope: read-only. No product code edited. No audit doc edited besides this file.

What I traced in source:
- `packages/cloud-sync/proof-sync.js`, `packages/cloud-sync/quill-sync.js`, `packages/cloud-sync/tombstones.js`, `packages/cloud-sync/flag-queue.js`
- `packages/backups/index.js`
- `main.js`, `preload.js`
- `app/page.js`
- `app/components/QuillAndInkMode.js`, `app/components/PrepManuscriptMode.js`, `app/components/PrebuildMode.js`, `app/components/SessionsView.js`, `app/components/ProofingReader.js`, `app/components/ChapterReader.js`, `app/components/ReaderChrome.js`
- `app/phone/page.js`, `app/phone/_components/PhoneReader.js`
- `app/lib/manuscriptPaging.js`
- `docs/BUILD_PLAN_V4.md`, `docs/WIRING_MATRIX.md`, `docs/CLOUD_SCHEMA.md`, `docs/CLOUD_SAFETY_AUDIT.md`, `READ ME FIRST - OPEN THIS.txt`
- One read-only `node` reproduction of `path.join('/save/Manuscript Sources', '../../../etc/passwd.docx')` → `/etc/passwd.docx`.

I did not run the app, sign into Supabase, or open Word/InDesign/the packaged Mac build during this review.

---

### Block 1 - Cloud honesty

- Bugs reviewed: SAS-AUD-20260602-010, -011, -012
- Roadmap items reviewed: 8.1, 8.2, 8.3
- A. Real today: real-today. Traced each cited line.
  - 8.1 Proof pull: `packages/cloud-sync/proof-sync.js:216-231` checks `error` on the `script_sync_projects` SELECT but the follow-up SELECTs for `script_sync_section_transcriptions` (224-227) and `script_sync_flags` (228-231) destructure only `data` and ignore `error`. The merge then rebuilds books at lines 246-286 with whatever empty fallbacks `data` left behind.
  - 8.1 Quill pull: `packages/cloud-sync/quill-sync.js:162-167` checks `error` on `quill_projects` but the SELECTs for `quill_chapters` (170-173) and `quill_annotations` (174-177) ignore `error`. Same silent partial rebuild risk.
  - 8.2 Backups: `packages/backups/index.js:73-83` wraps both `pullProofProjects` and `pullQuillProjects` in `.catch(() => [])`, so a thrown cloud error becomes an empty array. `main.js:2076-2092` then writes `cloudIncluded: !!cloudSnapshot` — true whenever any `cloudSnapshot` object exists, regardless of whether the reads succeeded.
  - 8.3 Quill push: `packages/cloud-sync/quill-sync.js:101-116` runs chapter-prune deletes and the chapter-id lookup `.select(...).eq(...)` without destructuring `error`. Lines 144-153 do the same for annotation-prune. Line 155 then unconditionally stores `lastPushHashByCloudId.set(cloudProjectId, compositeHash)`. If chapter-id lookup returns null/empty, line 122 `chapterIdByLocal.get(a.sectionId) || null` writes `chapter_id: null` on annotations.
- B. Would the fix work: would-fix.
  - 8.1: Treating each secondary `error` as fatal (and throwing) closes the silent-partial path. The plan correctly notes that empty `data` arrays must stay valid — that distinction is what makes this safe.
  - 8.2: Replacing the swallow-and-fallback in `buildCloudSnapshot()` with explicit `proof.status / quill.status` flags, then computing `cloudIncluded = (proofOk && quillOk)` in the manifest, gives Marie an honest label. The proposed shape covers signed-out, empty-success, and partial-failure cases.
  - 8.3: Checking `error` on chapter-prune delete, chapter-id lookup, and annotation-prune delete before line 155 closes the "remembered as success" hole. The plan correctly identifies that storing the hash is the skip gate for future pushes.
- C. Missed items:
  - The roadmap does not mention that `packages/cloud-sync/quill-sync.js:102-109` (the chapter-prune delete with `.not('local_id', 'in', toPostgrestInList(keepLocalIds))`) also calls `await supabase.from('quill_chapters').delete()` without an `error` destructure. Both branches of the if/else (lines 101-109) should be hardened, not just the lookup at line 112.
  - The roadmap does not flag `packages/cloud-sync/quill-sync.js:147-153` (the annotation-prune delete else branch) — same unchecked-error pattern, separate code path from the chapter prune.
  - Block 1 does not explicitly say the Proof push side of `proof-sync.js` already checks errors on its transcription insert (135), flag upsert (177), prunes (195, 203). That's a useful contrast point — Block 1's Proof fix is the *pull* path, the push path is already correct.
  - The plan does not call out that `app/page.js:639-671` (`resyncProof`) currently catches every thrown cloud error and just sets `setProofPullError`. If 8.1 starts throwing on partial reads, the existing catch already routes to a banner — good, but the plan should confirm Marie wants partial reads to look identical to total connection failure, or split the messages.
  - `app/components/QuillAndInkMode.js:513-515` also catches Quill pull errors with a `console.warn` and no UI surface. If 8.1 throws on partial reads, Quill currently won't show Marie anything besides a silent failure. That's a downstream caller the plan should harden alongside the package change.
- D. Regression risk: medium - Proof pull happy path with empty `flags`/`transcriptions` tables. Smallest test: a mocked `pullProofProjects()` where the project SELECT returns one row and both secondary SELECTs return `{ data: [], error: null }` — must still return one project with `flags: []` and no whisper data; today this works because `transByProjectSection`/`flagsByProjectSection` are empty maps. After the fix, verify the same outcome — empty `data` must not be conflated with `error`.
- E. Scope: ok. Block 1 is self-contained inside `packages/cloud-sync/` plus a short `main.js` manifest tweak. It does not depend on any other block.
- Recommendation: confirm
- Open questions for Marie:
  - When a secondary cloud read fails, do you want one combined sync-failed banner or separate "transcriptions failed" / "flags failed" messages?
  - When backup cloud reads fail, do you want the local-only backup to still be written (Strategy B in 8.2) or refuse to write a backup at all (Strategy A)?

### Block 2 - Cross-device delete

- Bugs reviewed: SAS-AUD-20260602-013
- Roadmap items reviewed: 8.4
- A. Real today: real-today.
  - Proof side: `app/page.js:399-416` `mergeProofBookLists` seeds `byId` from every local book and iterates only the cloud list. A local book missing from the cloud is never removed.
  - Proof side: `app/page.js:648-651` — `if (cloudBooks.length) { setBooks(...) }`. A successful empty cloud pull never reaches `setBooks` at all. The local list is preserved unconditionally.
  - Quill side: `app/components/QuillAndInkMode.js:350-372` `mergeProjectLists` seeds `byId` from local, iterates cloud, never prunes.
  - Quill side: `app/components/QuillAndInkMode.js:505` — `if (cancelled || !rawCloudProjects.length) return;` aborts hydrate before the merge runs when cloud is empty.
  - Tombstones: `packages/cloud-sync/tombstones.js:148-172` only filters cloud rows whose id matches a locally-recorded delete. A delete that happened on another device has no local tombstone, so nothing filters it.
- B. Would the fix work: would-fix.
  - Strategy A's proposed shape (filter local projects by `cloudId` membership in the fresh cloud list, but keep `!project.cloudId` drafts and locally tombstoned entries) closes the four edge cases. Distinguishing empty-success from failed-pull is the load-bearing safety check.
- C. Missed items:
  - `app/page.js:684-698` re-runs `resyncProof()` on focus and visibility change. After the fix, the prune will fire on every focus event, including the first one after sign-in if the cloud pull races local hydrate. The plan should make sure local books load from `Save Data/` *before* the first cloud-driven prune, otherwise a slow cloud pull could prune everything during the brief window where local state is `[]`. Suggested check: a hydrate-complete gate (e.g. `restoreLocalBooksForSignedInSession` has run) before allowing cross-device delete pruning.
  - The roadmap names `app/components/QuillAndInkMode.js`, but the actual Quill remote-delete prune needs to cover BOTH the hydrate-time merge at line 512 AND any later `mergeProjectLists` calls inside the persist effect (search for `mergeProjectLists(` — needs to be audited). The plan does not enumerate every call site.
  - The plan does not address Phone behavior on cross-device delete. Phone refresh paths (`app/phone/page.js:1522-1550` Proof, `app/phone/page.js:791-818` Quill) keep stale cached items on empty pulls. That's tracked separately in Block 8 (018, 020), but the resolution of 8.4 — "successful empty pull is authoritative" — is conceptually the same decision. They should land together so Marie's mental model stays consistent across desktop and phone.
  - The proposed `wasLocallyTombstoned(project.cloudId)` check is fine, but the plan does not explain what happens if Marie re-imports a project locally with the same `cloudId` after a remote delete. With the new rule, the next cloud pull would prune the re-imported draft. That's a deliberate-design call Marie should review.
- D. Regression risk: high - Marie's local-only unsynced drafts. Smallest test: a unit/component test that loads a local Proof book with no `cloudId`, calls the new merge with `cloudBooks = []`, and asserts the local draft survives. Plus the equivalent for Quill.
- E. Scope: depends-on Block 1. Block 2 requires "successful empty pull" to be distinguishable from "failed pull". Block 1 enforces that distinction at the package layer. If Block 2 ships first, every transient cloud error could look like "everything was deleted remotely" and silently wipe Marie's library on the next focus event.
- Recommendation: proceed-with-concerns. Land Block 1 first.
- Open questions for Marie:
  - If you re-import a project locally with a cloudId that was deleted remotely, do you want that re-import to survive or to be pruned to match the cloud?
  - For the "user signed out" case, should desktop refresh prune cloud-owned items (treating signed-out as "no cloud, prune nothing") or freeze the local list?

### Block 3 - File access lockdown

- Bugs reviewed: SAS-AUD-20260602-015, -016, -017
- Roadmap items reviewed: 10.1, 10.2, 10.3
- A. Real today: real-today.
  - 10.1: `main.js:1189` sets `webSecurity: false`. `main.js:1225-1228` `protocol.registerFileProtocol('localfile', ...)` decodes the URL and passes the raw path to `callback({ path })` with no allowlist or extension check. `main.js:1408-1413` `get-audio-url` only calls `decodeStoredFilePath` + `fs.existsSync`. `main.js:1439-1443` `read-audio-file` does the same and then `fs.readFileSync(resolvedPath)` returns the bytes — for any readable file, not just audio. `preload.js:22, 29` exposes both helpers to the renderer.
  - 10.2: `main.js:444-468` `rewriteBookAudioPathsForTransferImport` — line 456 does `path.join(importDir, ...String(relativeAudioPath).split('/').filter(Boolean))`. `filter(Boolean)` drops only empty strings, never `..`. `main.js:1654-1672` does the same for the manuscript path and then `fs.readFileSync(sourceManuscriptPath)` if it exists. `node` reproduction confirms `path.join('/import', '..', '..', 'etc', 'passwd')` resolves outside `/import`.
  - 10.3: `main.js:1078-1080` `getManuscriptSourcePath(bookId)` joins the raw `bookId` straight into `Save Data/Manuscript Sources/`. `app/page.js:1198-1204` `importBooks(data)` merges the parsed JSON into state without any `book.id` validation. `app/lib/manuscriptPaging.js:173-197` `normalizeBookPaging` spreads `...book` and preserves the imported `id` untouched. `main.js:1721-1742` `save-manuscript-source`, `rescan-book-pdf`, `rescan-book-page-map` all consume `payload?.bookId` and feed it into the path builder. Live reproduction with `node` confirms `path.join('/save/Manuscript Sources', '../../../etc/passwd.docx')` resolves to `/etc/passwd.docx`.
- B. Would the fix work: would-fix.
  - 10.1: Re-enabling `webSecurity` plus a main-process audio-allowlist closes the broad path. Object URLs or scoped session tokens (Strategy C) are an even stronger fix because they prevent any renderer leak — worth taking as a follow-up.
  - 10.2: The proposed `resolveInsideImportDir` helper combining (early reject of `..` / absolute / scheme-like strings) + (final `resolved.startsWith(root)` check) is the standard double-defense pattern and correctly handles Windows backslashes if the split uses `/[\\/]+/` as the plan suggests.
  - 10.3: Regenerating unsafe ids on import PLUS adding `assertInside(root, resolved)` around every read/write/rescan is what closes the issue. Either alone would still leak — e.g. id-only regen leaves rescan vulnerable if the UI ever sends a raw id; root-check-only leaves saved state poisoned with a bad id.
- C. Missed items:
  - 10.1 misses `main.js:1225-1228` itself — the `localfile://` protocol decoder does no validation at all. The plan focuses on `get-audio-url` and `read-audio-file`, but the renderer can construct `localfile://<encoded-arbitrary-path>` strings directly inside an `<audio src>` tag too. The protocol handler must be the allowlist gate, not just the IPC helpers.
  - 10.1 misses `main.js:1408-1413` returning `localfile://` URLs without normalizing absolute paths. If a crafted book sends `audioPath: '/etc/passwd'`, the path passes `fs.existsSync`, and the renderer gets a working `localfile://` URL. The fix must reject non-audio extensions at this stage too.
  - 10.2 misses the audio rewrite at `main.js:456` AND the manuscript rewrite at `main.js:1656`. The plan lists both, but the shared helper proposal must be reused at both call sites — not solved once.
  - 10.3 does not explicitly cover Quill — `app/components/QuillAndInkMode.js` does not use `getManuscriptSourcePath`, but it does write to `Save Data/Quill Sources/` via the `writeQuillProject` IPC. A search for similar raw-id-to-path patterns in the Quill side is needed and is not in the plan's "Likely files."
  - 10.3 does not address `Save Data/Prep Manuscript Sources/` or any Prep equivalent. The plan's narrow focus on `Manuscript Sources/` may leave parallel Prep paths unsafe. (A quick grep for `path.join(.*Sources)` in `main.js` would confirm.)
  - The proposed `isSafeEntityId` regex `/^[A-Za-z0-9_-]+$/` rejects existing ids that contain `.` or whitespace. Marie has been running v4.0 for weeks; existing saved books may have ids the new regex rejects. The plan should mark an explicit migration path for existing safe-but-non-matching ids, not just for newly imported ones.
- D. Regression risk: high - existing local audio playback. Smallest test: a packaged Mac app run where Marie attaches an audio file from her usual Drive path, plays it, and confirms transcription still works after the bridge is locked down. If the allowlist is too tight, ALL audio breaks.
- E. Scope: ok, but P0 status means it gates external release. The plan's "must close before any external release" framing is correct. Could be split into 3 sub-blocks (audio bridge, transfer paths, manuscript-source paths) for safer staged rollout — each is independently testable.
- Recommendation: proceed-with-concerns. The plan correctly identifies the bugs but understates the helper-reuse scope.
- Open questions for Marie:
  - Are there existing books in your `Save Data/` whose `id` would fail a strict `[A-Za-z0-9_-]+` check? If so, the migration must not break them.
  - Do you want non-audio file extensions to be rejected outright at the audio bridge, or just logged as warnings?

### Block 4 - Quill cleanup

- Bugs reviewed: SAS-AUD-20260602-006, -007
- Roadmap items reviewed: 6.1, 6.2
- A. Real today: real-today.
  - 6.1: `app/components/QuillAndInkMode.js:1456-1464` `openExistingAnnotation` does load same-range character markers into `characterIds` so the popover is correct. `app/components/QuillAndInkMode.js:1484-1496` `saveAnnotation` removes them and re-adds, so save is correct. But `app/components/QuillAndInkMode.js:1545-1552` `deleteEditingAnnotation` filters only `a.id !== editingAnnotationId`, and `app/components/QuillAndInkMode.js:1554-1560` `deleteAnnotation(id)` does the same. Neither path consults `characterIds` or runs the same-range filter that save uses. Confirmed.
  - 6.2: `app/components/QuillAndInkMode.js:907-925` builds `keptIds` from updated chapters and `chapterPatchById`. Lines 926-948 filter `(p.chapters || []).filter((ch) => keptIds.has(ch.id))`. No corresponding filter for `p.annotations`. Lines 949-972 do drop `chapterAudios` for removed chapters but never touch annotations. Downstream `packages/quill-engine/exporters.js:11-26, 38-46, 61-71` iterate `project.annotations` regardless of chapter membership, and `packages/cloud-sync/quill-sync.js:118-156` upserts every annotation; for removed-chapter annotations, `chapterIdByLocal.get(a.sectionId)` returns `undefined`, line 122 falls back to `chapter_id: null`. Confirmed.
- B. Would the fix work: would-fix for both, with one caveat.
  - 6.1: Strategy B's `idsForAnnotationBundle(annotation, allAnnotations)` helper used in load/save/delete/dock-delete is the right shape — it stops the four call sites from drifting independently. The current save path's same-range filter (lines 1488-1496) is what the helper would replace. Correct mental walk.
  - 6.2: Strategy B (distinguish removal from reorder/rename via stable id check) is what the plan calls for. The proposed `keptChapterIds.has(annotation.sectionId)` filter is correct because annotations use `sectionId === chapter.id`, and removed chapters have ids that drop out of `keptIds`. Reorder/rename keeps the same chapter id, so annotations survive.
  - Caveat: the plan does not say what should happen to annotations whose `sectionId` is missing or refers to a chapter that was never in the project (e.g. corrupted import). The plan should specify: drop, log, or quarantine. Silently dropping is the current de facto behavior in exports but explicit handling is safer.
- C. Missed items:
  - 6.1: The plan does not mention `packages/quill-engine/exporters.js:11-26` or 61-71, which iterate `project.annotations` and emit rows. Today, orphaned same-range character markers slip through into CSV and InDesign exports. The export side does not need code changes if 6.1 lands at the source, but it should be in the "Future fixer tests" list — assert no orphaned markers appear in exports after a popover/dock delete.
  - 6.1: The plan does not catch that `saveAnnotation` at line 1488-1496 already implements the same-range filter — extracting that filter into the shared helper is a low-risk refactor; the plan should reference it explicitly so the fixer reuses existing logic rather than reinventing.
  - 6.2: The plan's `packages/cloud-sync/quill-sync.js:111-123` reference is correct, but the actual cleanup also needs to ensure that when the local annotation pool shrinks, the cloud-side prune at `quill-sync.js:144-153` (the "delete annotations not in keep list") actually fires. That should already work because shrinking `annotationRows` shortens `keepAnnIds`, but the plan should explicitly assert it as a test.
  - 6.2 does not flag `app/components/SessionsView.js:518-520` (the `allSections` derivation feeding `completedCount` etc.). If Quill stops routing through SessionsView in the future (Block 10 docs drift), the cleanup logic must move with it.
- D. Regression risk: medium - 6.1 could over-delete if the bundle helper mismatches its filter. Smallest test: a Quill annotation with TWO same-range character markers — confirm delete-from-popover removes all 3, but a separately-created different-range character marker on the same chapter is NOT touched.
- E. Scope: ok. 6.1 and 6.2 are independent and self-contained inside the Quill component plus a small package helper. Could ship as one PR since both share `QuillAndInkMode.js`.
- Recommendation: confirm
- Open questions for Marie: none — the proposed routes match the bug behavior.

### Block 5 - Prep duplicates

- Bugs reviewed: SAS-AUD-20260602-005
- Roadmap items reviewed: 5.1
- A. Real today: real-today.
  - `app/components/PrepManuscriptMode.js:517-558`: the merge at lines 528-535 builds `oldByText` with `if (!oldByText.has(sp.text)) oldByText.set(sp.text, sp)` — keeping only the first old span per unique text. Then `mergedSpans = nextSpans.map((sp) => { const prior = oldByText.get(sp.text); ... })` — every new span with the same text reads the same prior assignment.
  - Confirmed effect: three identical lines previously assigned to characters A, B, C all get character A's assignment after a Fix/rescan. Side-voice assignments behave the same way (same property on the span). The bug is exactly as the log describes.
- B. Would the fix work: would-fix.
  - Strategy B (context + occurrence fallback) handles the "Marie edits text before the first duplicate" edge case — if the first duplicate's surrounding paragraph text changed, the context match fails, and occurrence ordering keeps the second/third assignments correct.
  - Strategy A (occurrence-only) is simpler and still much better than today. The "edit before first duplicate" case is the only one where A behaves wrongly (it would map the first new duplicate to whatever first-old-with-same-text exists, even if Marie meant the second one).
- C. Missed items:
  - The roadmap names `app/components/PrepManuscriptMode.js:759-763` (the call site of `updateSectionHtml`) — the bug log cites that too. Verify the Fix flow's only entry point is that line; if any other path also calls `updateSectionHtml`, all of them need to pass the same edit shape so the merge helper has occurrence info.
  - The plan does not specify what happens when the new section has FEWER duplicates than the old one (Marie removed one). The merged span map will then have an unused old assignment — fine. But the reverse (new section has MORE duplicates) needs explicit behavior: should the third duplicate copy nothing, or copy from a "best effort" nearest neighbor? The plan should pick one and document it.
  - The plan references `tests/prep-export.test.mjs:120-213` as evidence that the export side already treats duplicates by occurrence. Confirmed in file listing. The fix should reuse that test's duplicate handling as the merge helper's reference behavior so they don't drift.
  - The plan does not mention that `assignCurrent` (lines 561-579) writes assignments by `selected.spanIndex` — i.e. occurrence-based already. The fix should align `updateSectionHtml`'s merge with the same span-index model so both edit paths share the same data shape.
- D. Regression risk: medium - sections with three or more identical lines and mixed assignments. Smallest test: a Prep section with three identical quotes assigned to characters A, B, C. Call `updateSectionHtml` with the same HTML (no edit). Confirm A, B, C are preserved in order. Today this fails — all three become A.
- E. Scope: ok. Self-contained inside `PrepManuscriptMode.js` plus one new or expanded test.
- Recommendation: confirm
- Open questions for Marie:
  - If you edit a paragraph and split one quote into two, do you want the new copy to inherit the assignment of the original, or to come up unassigned?

### Block 6 - Duet completion + export math

- Bugs reviewed: SAS-AUD-20260602-008, -009
- Roadmap items reviewed: 7.1, 7.2
- A. Real today: real-today.
  - 7.1: `app/components/PrebuildMode.js:801` `scanChapterIntoProject` writes `transcribed: true` only. `app/components/PrebuildMode.js:1143` the shared book-detail adapter falls back to `typeof ch.completed === 'boolean' ? ch.completed : !!ch.scanned`. Because `scanChapterIntoProject` never writes `scanned`, `!!ch.scanned === false` after a successful scan and before any manual toggle. Confirmed.
  - 7.2: `app/components/PrebuildMode.js:196-205` `formatAuditionTime` does `whole = Math.floor(s); ms = Math.round((s - whole) * 1000)`. For `seconds = 61.9996`: `s = 1.9996`, `whole = 1`, `ms = Math.round(999.6) = 1000`. Output: `1:01.1000`. Bug reproduces in source without running anything.
- B. Would the fix work: would-fix.
  - 7.1: Strategy A's fallback `Boolean(ch.transcribed || ch.scanned)` with manual-override preserved is correct, and Marie's manual toggle (line 1195) keeps winning because it writes `ch.completed` directly. The fix correctly preserves Proof Listen semantics because Proof flows write `ch.completed` at the section level (`s.completed` at SessionsView line 519), not on the chapter, so the Duet adapter's fallback does not affect Proof's completion math.
  - 7.2: The proposed `totalMs = Math.round(seconds * 1000); wholeSeconds = Math.floor(totalMs / 1000); ms = totalMs % 1000` shape is the right pattern — it carries cleanly to the next second and works at minute/hour boundaries (`61.9996 → 62000 → 62 sec → 1m02s.000`; `3599.9996 → 3600000 → 3600 sec → 1h00m00s.000`).
- C. Missed items:
  - 7.1: The plan does not explicitly confirm "scanned" has no Proof-side meaning. I spot-checked `SessionsView.js`; the only match for `scanned` is in a UI string ("Page numbers auto-scanned"). No Proof code branches on `ch.scanned`. The plan's "Verification before approval" requires this — it's resolved as: no conflict.
  - 7.1: The bug log cites `app/components/SessionsView.js:518-520, 2826-2829, 3098-3100` as evidence of the shared completion fallback. Those line numbers reference Proof's section-level `s.completed` logic, not the Duet adapter's chapter-level fallback. The actual fallback that produces the bug lives in `PrebuildMode.js:1143`. The bug log's evidence is slightly mis-cited; the plan should anchor on `PrebuildMode.js:1143`.
  - 7.2: The plan covers boundary values 61.9996 and 3599.9996 but does not mention exact `0.000`, very small positives, or NaN/Infinity. The current code's `Number.isFinite(seconds)` guard at line 197 is fine; the fix should preserve that.
  - 7.2: The proposed formatter shape will subtly change behavior on inputs that are exactly representable in floating point but round differently after `Math.round(seconds * 1000)` vs `Math.round((s - whole) * 1000)`. Both should match for any sane second input; the test suite should cover at least one value where they would have diverged.
- D. Regression risk: low for both.
  - 7.1 smallest test: a Duet chapter with `transcribed: true, completed: undefined` — the shared adapter must produce `completed: true`. Plus a chapter with `transcribed: true, completed: false` (Marie un-toggled) — must produce `completed: false`. Plus a Proof section with `s.completed: false` — must NOT be affected.
  - 7.2 smallest test: formatter receives `61.9996` and `3599.9996`, returns `1:02.000` and `1:00:00.000`. Also `0`, `60`, `3600`, `0.001` for sanity.
- E. Scope: ok. Both fixes touch `PrebuildMode.js` plus a small adapter tweak in 7.1. Independent of other blocks.
- Recommendation: confirm
- Open questions for Marie: none.

### Block 7 - Wording tidy

- Bugs reviewed: SAS-AUD-20260602-004, -014, -019
- Roadmap items reviewed: 3.3, 4.2, 11.1
- A. Real today: real-today for all three.
  - 3.3 (Proof "Note" column): `app/components/SessionsView.js:306` header says `'Note','Should Say'`; line 309 writes `fl.sentPlain || ''` (the misread quote) into the `Note` slot and `fl.note || ''` into `Should Say`. Same at line 385-386. `app/components/ProofingReader.js:1093-1094` same pattern. `app/components/ProofingReader.js:1331-1333` the on-screen preview row uses the same header list. `app/phone/page.js:153-167` phone CSV builder same pattern.
  - 4.2 (branding): `main.js:1419` `audiobook-proofer-backup.json`. `main.js:1576` `app: 'Script and Sync'`. `main.js:1595` `script-and-sync-transfer.json`. `main.js:1599-1602` README headed `Script and Sync Transfer Folder`. `main.js:1619` dialog `Select Script and Sync transfer folder`. `main.js:1631` error `That folder is not an Audiobook Proofer transfer folder.` `app/page.js:1211` browser fallback also `audiobook-proofer-backup.json`.
  - 11.1 (Phone Quill no-match): `app/phone/page.js:959` says `'No filenames matched. You can still pick audio inside the reader.'` `app/phone/page.js:1471` passes `allowManualPick={false}` to `PhoneAudioDock`. `app/phone/page.js:2692` then renders `'Back to the chapter list to pick the audio folder.'` Direct contradiction.
- B. Would the fix work: would-fix.
  - 3.3: A single `proofFlagHeaders` constant reused in SessionsView (both exports), ProofingReader (export + preview), and `app/phone/page.js` is the clean fix. The plan's suggested label `Misread Quote` matches the existing in-app explanation at `app/page.js:2349`.
  - 4.2: A pair of constants for the current filename/manifest id and a small "legacy ids accepted on import" list cover the user-facing rebrand without breaking compatibility. The plan's Strategy A shape is sound.
  - 11.1: Strategy C (a "Back to chapter list" action button in the reader) is the safest because it makes the visible UI match the actual data flow. Strategy B (changing only the copy) is also viable; Strategy A (enabling reader-side pick) would require wiring a folder picker into `PhoneAudioDock` and an audio-cache update path, which is a bigger lift than the bug warrants.
- C. Missed items:
  - 3.3: The plan does not enumerate every consumer of the existing `Note` label. A grep for `'Note','Should Say'` and the cells writing `fl.sentPlain` would catch all four current call sites and confirm no fifth exists.
  - 3.3: The CSV header change is user-visible. If Marie has scripts or sheets that key off `Note` as the seventh column header, they will break. The plan acknowledges "downstream spreadsheet workflow may also key off the wrong heading" — Marie should confirm whether she has any.
  - 4.2: The plan focuses on backup/transfer wording but not the `script-and-sync-transfer` `manifestType` itself (line 1573). If that string is renamed, every existing transfer bundle stops importing unless the legacy id is in the accepted list. The plan does discuss legacy accept lists; this is the load-bearing detail.
  - 4.2: `main.js:430-433` `findTransferManifestPath` hard-codes `'script-and-sync-transfer.json'`, `'transfer-manifest.json'`, `path.join('data', 'script-and-sync-transfer.json')` — the rebrand must add the new filename to that list, not replace the old one, or legacy bundles stop importing.
  - 4.2: The plan does not mention the desktop home page string at `app/page.js:1211` (`a.download = 'audiobook-proofer-backup.json'`) — the browser fallback path that runs when Electron is not available. The `Likely files` list includes `app/page.js` but does not pinpoint this line.
  - 11.1: The plan does not flag that `PhoneAudioDock` is defined inline inside `app/phone/page.js` (somewhere around lines 2630+). If Strategy A (enable reader-side picking) is chosen, the picker needs to update the same audio cache key Marie's chapter-list picker writes (`audioFilesByBook[projectAudioKey]`). Threading that through is non-trivial — Strategy C (a navigation button) avoids that complexity.
- D. Regression risk: low for 3.3 (header rename) and 11.1 (copy fix). Medium for 4.2 because of legacy-bundle compatibility — smallest test: export a transfer bundle, then re-import it; export a backup, then re-import it; spin up a fixture of an old `script-and-sync-transfer.json` bundle and confirm it still imports.
- E. Scope: ok. Safest block to ship early. Could be split into 3 micro-PRs (one per fix) for isolated review.
- Recommendation: confirm
- Open questions for Marie:
  - Do you prefer `Misread Quote` or `Quote` or another label for the seventh column?
  - For the Phone Quill no-match, do you want a "Back to chapter list" button in the reader, or just a clearer text instruction?

### Block 8 - Phone test-first

- Bugs reviewed: SAS-AUD-20260602-002, -003, -018, -020, plus Duet re-upload watchlist
- Roadmap items reviewed: 2.1, 2.2, 2.3, 2.4, 7.3
- A. Real today: real-today.
  - 002 Phone Quill offline queue: `app/phone/page.js:877-888` `pushProject` saves locally + cache, then `pushQuillProject(...).catch(console.warn)`. No queue, no pending UI, no retry. Confirmed.
  - 003 flag-queue scope: `packages/cloud-sync/flag-queue.js:23` `STORAGE_KEY = 'stjohn-cloud-flag-queue-v1'` is a single global key. The store is keyed by projectId (line 30), but `countAllFlagQueues()` (line 151) sums across every project in the store regardless of which user originated them. If account A's projects share localStorage with account B (same browser/phone), the count can include account A's pending items after a sign-in swap. Confirmed.
  - 018 Phone Script empty pull: `app/phone/page.js:1522-1550` — `if (list?.length)` branch replaces state and writes cache; the `else` branch only writes empty cache if `current` is already empty, otherwise returns `current` unchanged. Confirmed.
  - 020 Phone Quill empty pull: `app/phone/page.js:791-818` — same pattern, with an explicit comment at lines 804-807 calling this a deliberate "never wipe a populated local cache with an empty cloud pull" choice. Behavior is real; intent is documented; reconciling with cross-device delete (Block 2) is a design call.
  - 7.3 Duet re-upload: `app/components/PrebuildMode.js:1017-1033` `reuploadManuscript` does `const match = ni < oldChapters.length ? oldChapters[ni] : null` — purely positional. Inserted/removed scenes near the front shift every later chapter's audio carry-over to the wrong chapter. Confirmed.
- B. Would the fix work: would-fix (after live proof).
  - 002: Per-project Quill annotation queue mirroring the Proof flag-queue pattern is the right shape. The fix should also be user-scoped (do not repeat bug 003's mistake).
  - 003: User-scoped localStorage key `stjohn-cloud-flag-queue-v1:<userId>` + a one-time migration of the global queue into the signed-in user's queue (assuming project ownership is known). The plan's shape is sound.
  - 018, 020: Treating a successful empty pull as authoritative is the same decision Block 2 requires for desktop. Distinguishing "pull succeeded with []" from "pull threw" is the load-bearing safety check. The plan's `Array.isArray(list)` test is the right discriminator.
  - 7.3: Match by stable fingerprint (chapter title + plainText hash) before falling back to position is correct. The plan's "stable identity" framing is right.

#### Recipe 2.1 - Phone Quill offline annotation recovery

- Account: a Marie-owned test Supabase account, not her main account. Add a project named "OFFLINE TEST Q" so it's obvious in the dashboard.
- Pre-state: sign in on phone in normal connectivity. Import a small Quill project on desktop, push to cloud, refresh phone, confirm the project lists.
- Test steps:
  1. On the phone, enable airplane mode (or fully kill the local network).
  2. Open the project, open chapter 1, add ONE distinctive annotation with a note like "OFFLINE-001 — must survive".
  3. Confirm the annotation is visible in the phone reader immediately.
  4. Background the app for 30 seconds, foreground, confirm the annotation is still visible.
  5. Disable airplane mode.
  6. Wait 30 seconds, then pull-to-refresh.
  7. Open the project on desktop, refresh, look for "OFFLINE-001".
- What proves the bug: the annotation never appears on desktop AND/OR vanishes from phone after the refresh AND no visible "pending" or "not synced" indicator was shown.
- What proves the bug did not reproduce: the annotation reaches desktop after reconnect, OR it visibly shows as "pending" on phone the whole time, OR Marie sees a clear retry path.

#### Recipe 2.2 - Account-scoped pending Proof flag queue

- Accounts: two Marie-owned test Supabase accounts on the same phone. Account A has at least one Proof book; Account B has at least one Proof book.
- Pre-state: sign in as A on phone in airplane mode. Save one flag offline ("ACCOUNT-A-001"). Confirm the pending banner shows "1 flag waiting" or similar.
- Test steps:
  1. Sign out of A without reconnecting.
  2. Sign in as B (still offline).
  3. Read the pending banner.
  4. Re-enable network.
  5. Sign out of B, sign back in as A, watch the queue replay.
- What proves the bug: B sees a pending count from A's queue, OR a flag pushes to B's project from A's queue, OR the pending banner shows the wrong count for B.
- What proves the bug did not reproduce: B's pending count is 0 throughout, the queue replays cleanly only when A is signed in, no cross-account data appears.

#### Recipe 2.3 - Phone Script empty-cloud refresh

- Account: a Marie-owned test Supabase account with at least one Proof book.
- Pre-state: sign in on phone, refresh, confirm the book lists. Background the app.
- Test steps:
  1. On desktop or in the Supabase dashboard, delete every `script_sync_projects` row for that user.
  2. On phone, pull-to-refresh.
  3. Observe the book list.
  4. Sign out and sign back in.
  5. Observe the book list again.
- What proves the bug: the cached book still shows after the refresh.
- What proves the bug did not reproduce: the list clears immediately on refresh, and stays cleared after the sign-out/sign-in cycle.

#### Recipe 2.4 - Phone Quill empty-cloud refresh

- Account: a Marie-owned test Supabase account with at least one Quill project.
- Pre-state: identical to 2.3 but for Quill.
- Test steps: identical to 2.3 but delete `quill_projects` rows and refresh the Quill phone list instead.
- Same pass/fail criteria as 2.3.

#### Recipe 7.3 - Duet manuscript re-upload carry-over

- Account: not cloud-related. Local Save Data only. Use a temp HOME for safety.
- Pre-state: a Duet project with five chapters (Chapter 1, 2, 3, 4, 5). Attach audio file `c1.mp3` to chapter 1, `c2.mp3` to chapter 2, ..., `c5.mp3` to chapter 5. Scan at least chapter 1 so it has whisper data.
- Test steps:
  1. Edit the manuscript .docx to INSERT a new "Chapter 0" at the very front (so the file now has 6 chapters: New, 1, 2, 3, 4, 5).
  2. In Duet, use the re-upload action with the edited file.
  3. Look at the project after re-upload: which chapter is `c2.mp3` attached to?
- What proves the bug: `c2.mp3` is attached to the new "Chapter 0" (or whatever the second chapter is now). Whisper data from old Chapter 1 is on the new Chapter 0.
- What proves the bug did not reproduce: every audio stays attached to its correct chapter (matched by content), even though positions shifted.

- C. Missed items (across the block):
  - 2.1: The plan does not specify what happens when a Phone Quill annotation push fails AND the user adds a second annotation before reconnect. The queue must handle multiple pending writes per project, like the Proof flag queue does.
  - 2.2: The proposed migration "migrate old global queue into the signed-in user's queue only if project ownership is known" is correct, but the plan does not handle the case where project ownership cannot be determined (because the user is signed out at first read). The migration may need to wait until the first cloud pull returns the owned project list.
  - 2.3, 2.4: The plan does not address Phone Proof's `applyFlagQueueToBook` interaction with an empty cloud pull. If the local queue has pending flags for a project the cloud just emptied, what happens? Probably the queued flags should still be reflected somehow until the user explicitly discards them.
  - 7.3: The plan suggests "stable identity" matching, but does not pick a concrete fingerprint. A combination of chapter title (normalized) + first N words of `plainText` would work; a fuzzy hash would handle minor typo edits. The plan should pick one before code work begins.
- D. Regression risk: low to medium across all 5 items. These are all `needs-proof` items — risk only materializes if the code fix is wrong, not if the test reproduces.
- E. Scope: ok. 2.3 and 2.4 share `app/phone/page.js` and can ship together. 2.1 should ship with its own dedicated PR because it adds new infrastructure. 7.3 is independent of the other four.
- Recommendation: needs-live-test for all five items.
- Open questions for Marie:
  - Can you set up two test Supabase accounts for the 2.2 recipe? If not, the account-swap test cannot run.
  - Do you have a safe phone-side way to enable/disable network without losing your real account session? Airplane mode usually works on iOS/Android, but the test should not corrupt your real Save Data.

### Block 9 - Keyboard / a11y

- Bugs reviewed: SAS-AUD-20260602-021, -022, -023
- Roadmap items reviewed: 12.1, 12.2, 12.3
- A. Real today: real-today.
  - 12.1 dialogs: `app/page.js:2329-2342` and `app/components/QuillAndInkMode.js:1051-1064` are plain `div` overlays with `onClick` close + inner `stopPropagation`. No `role`, no `aria-modal`, no focus trap, no focus return. `app/components/ReaderChrome.js:542-555` `useDismissable` adds Escape close but no focus management. The bug log cites `PrebuildMode.js:381-392` and `PrepManuscriptMode.js:780-791` too — same pattern, same bugs.
  - 12.2 pointer-only: `app/components/ChapterReader.js:214-225` word spans use `onPointerDown`/`onPointerEnter`/`onDoubleClick` only — no `tabIndex`/`onKeyDown`. Lines 384-385 disable native text selection. `app/phone/_components/PhoneReader.js:184-216` same pattern. `app/components/ProofingReader.js:1223-1230` opens word-action menu on double-click only.
  - 12.3 icon-only / disclosure: `app/components/SessionsView.js:2946-2954` expander button has no `aria-expanded`; line 2954 swaps `▲`/`▼` glyphs only. `app/components/ReaderChrome.js:270-288` Home/Back pill uses `title` but no `aria-label`. The bug log lists more sites; spot checks confirm the pattern is consistent.
- B. Would the fix work: would-fix.
  - 12.1: Strategy B (one shared `AppDialog` pattern) is the right call. CLAUDE.md SHARED COMPONENTS forbids new components without using the existing pattern; the new `<AppDialog>` would be a NEW shared component, but it's the kind that CLAUDE.md explicitly invites under "How to extend": "Confirm dialogs — every mode uses `window.confirm()`. Replace with a shared `<ConfirmDialog />`." The same logic applies to overlay panels. The build-checker hook does not currently flag new dialog components, only `function .*BookDetail/ReaderView/Setup/Panel/AudioDock/Picker`.
  - 12.2: A reader keyboard navigation hook used inside `<ChapterReader>` AND `<PhoneReader>` AND `<ProofingReader>` is the right shape. CLAUDE.md says "Quill uses `<ChapterReader>`. Proof still has its own `ProofingReader.js` and is logged for next-session migration." The keyboard hook can live in `ChapterReader.js` and be reused by Proof when it migrates. PhoneReader stays separate for now per CLAUDE.md, so it needs its own use of the same hook — but extracting the hook into a shared location (e.g. `packages/quill-engine/` or a new lightweight utility) is the way to avoid forking.
  - 12.3: Direct labels + shared `IconButton`/`DisclosureButton` helpers is fine. Per CLAUDE.md, these are new helpers, not duplicate UI; the build-checker hook should not block them as long as they live in `app/components/ReaderChrome.js` or a new shared file and are reused.
- C. Missed items:
  - 12.1: The plan does not name Prep's `BookDetailView` overlay or any Settings overlay. The bug log lists four files; the plan lists the same four plus a generic "shared overlay helpers." Spot check those line ranges before implementation.
  - 12.1: The CLAUDE.md hook list (in the project CLAUDE.md, "FORBIDDEN PATTERNS") explicitly blocks new `Panel` functions in mode files. An `AppDialog` is fine if it lives in `ReaderChrome.js` or its own new file; but a `function SomeMode_HelpPanel(...)` inside `PrebuildMode.js`/`QuillAndInkMode.js` would trip the hook. The fix should extend `ReaderChrome.js` or land the new `AppDialog` as a top-level shared component.
  - 12.2: The plan does not address that the desktop reader explicitly disables native text selection (`userSelect: 'none'`, `app/components/ChapterReader.js:384-385`). If the keyboard model uses a custom word-cursor, that's fine; if it tries to use native browser selection extension keys, native selection must be re-enabled. The plan should pick one model and commit.
  - 12.2: Phone reader keyboard support is hard because most phones don't expose arrow keys to the browser. The plan's "Phone browser keyboard behavior may differ from desktop browser behavior" is mentioned but not resolved. Decision needed: is phone keyboard out of scope, or is it expected to be functionally equivalent when a Bluetooth keyboard is connected?
  - 12.3: The plan does not address `app/phone/page.js:1388-1401, 1429-1444` which the bug log cites — many phone icon buttons are inline with `title` but no `aria-label`. Phone's icon button labeling probably needs more sites changed than desktop's.
- D. Regression risk: medium for 12.1 (focus trap can break existing keyboard-only flows), low for 12.2 and 12.3.
  - 12.1 smallest test: open the Home info overlay in Proof, tab through, press Escape, confirm focus returns to the Home info button. Then do the same in Quill. Then verify mouse outside-click still closes.
  - 12.2 smallest test: open a Quill chapter, focus the reader body, navigate to a word with arrow keys, press Enter, confirm the annotation popover opens at that word.
  - 12.3 smallest test: a screen reader (VoiceOver or NVDA) announces "expanded" / "collapsed" on the Proof chapter expander when toggled.
- E. Scope: ok. 12.1 is a foundation for 12.2 and 12.3 (the popovers they open need to be accessible). 12.1 could ship alone first.
- Recommendation: confirm. Land 12.1 before 12.2; 12.3 is independent.
- Open questions for Marie:
  - Is phone keyboard support in scope, or only desktop?
  - For the reader keyboard cursor, do you want arrow keys to navigate words (12.2's Strategy B) or just Tab to focus each word (Strategy A)?

### Block 10 - Docs tidy

- Bugs reviewed: SAS-AUD-20260602-001
- Roadmap items reviewed: 1.1
- A. Real today: real-today.
  - `docs/BUILD_PLAN_V4.md:3` still says "Status: ACTIVE. Phase 1 in progress." — direct quote from the file.
  - `docs/WIRING_MATRIX.md:28` says shell mode switcher is MISSING; lines 53-57, 63-65 say Prep/Duet flows are MISSING — but the source files exist and are wired.
  - `docs/CLOUD_SAFETY_AUDIT.md:37` references `supabase/` — `ls` confirms the directory is absent.
  - `docs/CLOUD_SCHEMA.md:6` heading says "The four StJohn 4.0 tables" — `grep` confirms exactly one match. The file documents six tables below.
  - `READ ME FIRST - OPEN THIS.txt:1` still says "AUDIoproofer 5.0".
- B. Would the fix work: would-fix.
  - Strategy B (current-status notes + targeted refresh) preserves history while making current state legible. The plan correctly avoids deleting valuable historical context.
- C. Missed items:
  - The plan should also flag that `CLAUDE.md` (project root) under "## Where things live" describes a "target layout" that does not fully match the current tree. That has already been noted in the bug log's expanded entry but is worth pinning explicitly in the roadmap "Likely files" list. (It is listed; this is a no-op confirmation.)
  - The plan does not enumerate which `docs/WIRING_MATRIX.md` rows are currently wrong. A simple diff against the source tree would catch all of them; the plan defers that to the fixer.
  - The plan does not address the contradiction between `CLAUDE.md` SHARED COMPONENTS' "one BookDetail" rule and Quill/Duet still routing through `SessionsView`. The current implementation does NOT have one shared BookDetail; the docs should either acknowledge this is a target state or describe the partial state honestly.
- D. Regression risk: low - docs only.
- E. Scope: ok. Doc-only, can ship any time. Marie's intuition (mentioned in Block 10's "alongside any code block so docs and code rebrand together") aligns well with Block 7's branding fixes — the README/transfer rebrand could land in the same PR as `READ ME FIRST` updates.
- Recommendation: confirm
- Open questions for Marie: none.

### Block 11 - Test coverage

- Bugs reviewed: none direct
- Roadmap items reviewed: 9.1
- A. Real today: real-today.
  - `tests/` contains 6 files: `cloud-error-message.test.mjs`, `cloud-slim.test.mjs`, `manuscript-engine.test.mjs`, `prep-export.test.mjs`, `quill-exporters.test.mjs`, `whisper-json.test.mjs`. The bug log says 13 tests total — that's likely test cases per file, not files. Either way, there are no test files covering phone, backups, the Electron bridge, release-copy scripts, or guardrails.
  - `npm test` runs `node --test 'tests/**/*.test.mjs'`.
- B. Would the fix work: would-fix.
  - Strategy B (targeted regression tests next to each confirmed bug) is the right pacing. It does not require fixing the bugs first; the tests can be added as the fixes land so each fix has its own safety net.
- C. Missed items:
  - 9.1 does not say what counts as "done." A specific count? Coverage targets? "One regression test per confirmed bug from Blocks 1-7"? The plan should pick a finish line.
  - 9.1 does not address that the Electron bridge tests require a fake `ipcMain` surface. A small helper file under `tests/` for "fake Electron context" is implied but should be enumerated.
  - 9.1 does not address that the phone tests need a fake Supabase client. The `cloud-error-message.test.mjs` pattern can be extended.
  - 9.1 calls out `.claude/hooks/build-checker.sh` and `.githooks/pre-commit` as "Likely files" — those are hooks, not test targets. The plan probably means tests that verify the hooks BLOCK the right things; that's a separate harness from app tests.
- D. Regression risk: low - tests catch regressions, they do not cause them. Risk is "false negative" if a test is poorly written and passes when it shouldn't.
- E. Scope: ok. Should run in parallel with Blocks 1-7 so each fix lands with its test.
- Recommendation: confirm
- Open questions for Marie:
  - Do you want a coverage target (e.g. "every Block 1 bug has at least one regression test") or just "add what's reasonable as we go"?

### Block 12 - Marie-only verifies

- Bugs reviewed: none direct
- Roadmap items reviewed: 3.1, 3.2, 4.1
- A. Real today: unclear (cannot trace without running).
- B. Would the fix work: not applicable - these are verification tasks, not code fixes.
- C. Missed items: not applicable to code review.

#### Checklist 3.1 - Verify Prep Word export visually

- Setup:
  1. In a safe Save Data folder, import a small `.docx` (5-10 dialogue lines, at least 2 named characters, at least 2 narrator voices).
  2. Assign dialogue lines to characters in Prep Manuscript mode.
  3. Open the export action and choose "Highlighted Word" (or whatever the Prep DOCX export button says).
  4. Save the exported `.docx` to your Desktop with a name like `prep-test-2026-06-03.docx`.
- What to check, in order:
  - Open the file in Microsoft Word (not LibreOffice — LibreOffice may render comments differently).
  - On each dialogue line, the highlight color matches the character you assigned.
  - Comments (if Prep uses comments for side voices) attach to the correct line, not the next line or the previous line.
  - Curly quotes (`"…"`) and straight quotes (`"…"`) both highlighted correctly. If your manuscript had curly quotes, the export should preserve them.
  - The narrator chapter list (the second export, if it's a separate file) lists every chapter and the assigned narrator. No chapter is missing or mislabeled.
  - The file opens cleanly. No "this file is corrupted" warning.
- Pass: every highlight and comment lands on the correct line, file opens with no warnings.
- Fail: any highlight is on the wrong line, any comment is on the wrong line, file shows a corruption warning, or any chapter is missing/mislabeled from the narrator list. Log a new bug with the file attached.

#### Checklist 3.2 - Verify Quill InDesign export in real InDesign

- Setup:
  1. In a safe Save Data folder, create a Quill project with a known manuscript.
  2. Add 5-10 annotations: at least one with each of the major annotation classes (regular, character marker, image marker, full-spread marker, custom emotion if you have one).
  3. Use the InDesign export action and save the `.jsx` script.
  4. Have the matching InDesign layout file ready and OPEN.
- What to check, in order:
  - In InDesign, choose Window → Utilities → Scripts. Drop your `.jsx` there or run it via File → Scripts.
  - The script runs without throwing an error.
  - Each annotation's character style is applied to the correct selected text (the "Selected Text" column from the CSV is what InDesign searches for).
  - Image markers `[INSERT IMG]` appear in the right place in the InDesign text.
  - Character markers `[Name]` appear adjacent to the right selected text.
  - Full-spread markers are placed at the start of the right spread.
  - Custom emotion annotations apply the custom style without falling back to a default.
- Pass: every annotation type applies cleanly, no script errors, no "selected text not found" warnings beyond the expected duplicates.
- Fail: script errors, missing annotations, wrong styles applied. Log a new bug with the `.jsx` file and a screenshot of the InDesign result.

#### Checklist 4.1 - Verify Drive snapshot backup in packaged Mac app

- Setup:
  1. Build the packaged Mac app via `npm run release:mac` (you, Marie — this is the install you actually use).
  2. Open the packaged app from `Script and Sync Releases/StJohn Author Studio.app`.
  3. Sign in.
  4. Ensure Google Drive is mounted on this Mac (Finder shows the Drive folder).
- What to check, in order:
  - Open Settings (or wherever the Drive snapshot toggle lives).
  - Confirm Drive is detected (the UI should say "Drive detected" or similar).
  - Toggle backups ON for your signed-in account.
  - Press the "Snapshot now" button.
  - Wait for the success toast/alert.
  - Open Finder, navigate to the Drive backup folder (usually `Drive/StJohn Backups/` or similar).
  - Confirm a new `.zip` file appeared with today's timestamp.
  - Open the zip. Look inside.
    - Confirm `manifest.json` exists.
    - Confirm `local/books.json`, `local/prebuild-projects.json`, `local/prep-manuscript-projects.json`, `local/quill-projects.json` all exist (if any of those Save Data files exist locally).
    - Confirm `cloud/cloud-snapshot.json` exists (if you have cloud data).
    - Open `manifest.json` and confirm `cloudIncluded: true` and the file sizes match the local files.
- Pass: every expected file is in the zip, manifest is consistent, no errors during snapshot.
- Fail: missing files, `cloudIncluded: true` but cloud snapshot is empty (this is the bug that Block 1 8.2 will fix — log if you see it), or any error during snapshot. Log a new bug with the manifest contents.

- D. Regression risk: not applicable - manual verification.
- E. Scope: ok. Independent of other blocks.
- Recommendation: confirm
- Open questions for Marie: none. The checklists are direct.

---

### Block Order Verdict

- Confirmed safe to start in this order: Blocks 1, 7, 10, 11, 12.
- Reordering recommended:
  - Block 2 must follow Block 1. If 2 lands first, transient cloud errors look identical to "everything was deleted remotely" and could wipe local libraries on focus.
  - Block 3 should be split into the audio bridge (10.1) vs the transfer/manuscript path checks (10.2 + 10.3). Audio bridge regression risk is highest (could break all audio playback); ship after Block 1 and behind a packaged-app test.
  - Block 4 and Block 6 are independent and can ship any time after Block 11 has its safety net in place.
  - Block 5 is independent.
  - Block 9 (a11y) is independent of cloud/security blocks but 12.1 (dialog) should land before 12.2 (reader keyboard) because the keyboard model needs the dialog focus model.
- Must not start before live test: Block 8 entirely (it's all `needs-proof`). Recipes are above.

### Top 3 Risks You Found That Marie Should Know

1. **Block 2 will silently wipe your local desktop library if Block 1 has not landed first.** Today, a transient cloud read error looks identical to "the cloud is empty." If Block 2's cross-device delete rule fires on the second case but the first case is still misread as the second, every focus-pull that hits a network hiccup could prune your books. Land Block 1 first so a partial cloud read throws cleanly instead of looking like a success.
2. **Block 3's audio bridge fix can break ALL audio playback if the allowlist is too tight.** `webSecurity: false` and the raw `localfile://` protocol have been load-bearing for the audio flow since Script and Sync 3.0. The fix is right, but it must be tested in the packaged Mac app with your real Drive-stored audio before the change ships. Otherwise Marie's daily Proof Listen workflow stops working.
3. **Block 7's CSV column rename (`Note` → `Misread Quote`) is user-visible and will break any spreadsheet you have that keys off the old header.** Worth checking your Sheets or scripts BEFORE the rename lands. The fix is correct; it's just that "right label" and "compatible label" are not the same thing.

### Confidence

- Block 1 cloud-pull, push, and backup integrity: fully traced in code. The unchecked errors are at exact lines I cited.
- Block 2 desktop merge semantics: fully traced in code. Both Proof and Quill merge paths confirmed.
- Block 3 file-access boundaries: fully traced in code, plus one read-only `node` path-join reproduction. I did not run the app to confirm the audio playback path still works after the proposed fix — that needs the packaged Mac test.
- Block 4 Quill annotation/chapter cleanup: fully traced in code at the exact lines cited.
- Block 5 Prep duplicate merge: fully traced in code; the bug is a single function and is unambiguous.
- Block 6 Duet completion + marker math: fully traced in code; the marker math reproduces in a few seconds of mental arithmetic.
- Block 7 wording: fully traced in code. Every header and copy string was read in source.
- Block 8 phone bugs: code reads right but did not run. Recipes are designed to confirm or rule out each item with safe test accounts. The Phone Quill empty-pull behavior is documented as intentional in the comment at `app/phone/page.js:804-807`, so the "fix" here is a design call as much as a bug fix.
- Block 9 a11y: fully traced in code at the cited line ranges. Did not run a screen reader or keyboard-only pass.
- Block 10 docs drift: fully traced via spot checks against current source.
- Block 11 test coverage: fully traced via test directory listing and package.json scripts.
- Block 12 Marie-only verifies: could not verify because these require running Word, InDesign, and the packaged Mac app — out of scope for code review. Checklists above are designed to produce a clear pass/fail.

Could not verify because Block 8 needs live phone testing and Block 12 needs running real external apps — neither was in scope for this read-only review.
