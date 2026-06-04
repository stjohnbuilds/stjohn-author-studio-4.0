# Conflict Ledger - Zone 14 Security and Privacy

The three inspectors agreed that the cloud table fence and audio-stripping
guardrails still exist. The differences were about how many current local-file
boundary issues are strong enough to promote from code-traced concern to
confirmed bug.

## Conflict 1 - Can the renderer reach arbitrary local files through the current Electron audio bridge?

- Original Inspector A claim: the Electron bridge plus `localfile://`
  protocol gives the renderer arbitrary-file read power because raw absolute
  paths are accepted and `webSecurity` is disabled.
- Original Inspector B claim: the Electron shell launches with
  `webSecurity: false`, and the exposed audio bridge can read or serve
  arbitrary existing local files instead of audio-only sources.
- Original Inspector C claim: the broad audio bridge remains reachable from
  imported/local project data because backup import preserves stored audio
  paths and the renderer later feeds them back into `get-audio-url()` /
  `read-audio-file()`.
- Evidence:
  - `main.js:367-385`
  - `main.js:1179-1190`
  - `main.js:1225-1228`
  - `main.js:1408-1442`
  - `preload.js:4-29`
  - `app/page.js:1198-1204`
- Checker follow-up audit: confirmed that `decodeStoredFilePath()` returns raw
  absolute paths unchanged, `get-audio-url()` and `read-audio-file()` only
  check existence, the `localfile` protocol callback blindly serves the
  decoded path, preload exposes those calls to renderer code, and backup
  import merges unsanitized stored paths directly into app state.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-015`.
- Status: `resolved`
- Next check needed: safe temp-only Electron repro with a crafted imported
  book that points `audioPath` at a non-audio local file, then verify the app
  blocks it while normal audio playback still works.

## Conflict 2 - Can transfer import manifest paths escape the copied transfer folder?

- Original Inspector A claim: transfer import trusts manifest relative paths
  too loosely and can escape the copied import folder for bundled audio or
  manuscript-source lookups.
- Original Inspector B claim: did not raise this as a fail item.
- Original Inspector C claim: transfer import rebuilds manifest-relative audio
  and manuscript paths with `path.join(...)` and does not keep them inside the
  copied transfer folder.
- Evidence:
  - `main.js:323-327`
  - `main.js:444-463`
  - `main.js:1654-1662`
- Checker follow-up audit: confirmed that the import helpers split the
  manifest paths on `/` but do not reject `..` segments; a focused read-only
  `node` check showed `path.join('/safe/import', '..', 'outside.mp3')` escapes
  to `/safe/outside.mp3`, and the manuscript path is then read immediately if
  it exists.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-016`.
- Status: `resolved`
- Next check needed: safe temp-only transfer import using a crafted manifest
  with `../` segments for both audio and manuscript entries and confirm the
  import rejects them.

## Conflict 3 - Can raw book ids escape the manuscript-source storage directory?

- Original Inspector A claim: manuscript source storage trusts raw `bookId`
  too much, so read/write/rescan flows can escape `Manuscript Sources`.
- Original Inspector B claim: did not raise this as a fail item.
- Original Inspector C claim: did not raise this as a fail item.
- Evidence:
  - `main.js:1078-1094`
  - `main.js:1721-1742`
  - `app/page.js:1198-1204`
  - `app/lib/manuscriptPaging.js:173-197`
- Checker follow-up audit: confirmed that backup import merges book ids
  directly into app state, `normalizeBookPaging()` preserves them, and
  `getManuscriptSourcePath()` builds the storage path with
  `path.join(getManuscriptSourcesDir(), \`${String(bookId)}.docx\`)` without
  root checks. A focused read-only `node` check showed a crafted id such as
  `../../../tmp/probe.docx` escapes to `/tmp/probe.docx.docx`.
- Checker assessment: confirmed bug. Logged as `SAS-AUD-20260602-017`.
- Status: `resolved`
- Next check needed: safe temp-only backup import with a path-segment book id,
  then trigger manuscript rescan or reattach flow and confirm the app rejects
  any path outside `Save Data/Manuscript Sources/`.

## Conflict 4 - Does this run prove a separate renderer HTML-injection bug?

- Original Inspector A claim: did not raise a renderer HTML-injection issue as
  a separate fail item.
- Original Inspector B claim: the checked Proof flag quote sink escapes the
  edited quote before it reaches `dangerouslySetInnerHTML`.
- Original Inspector C claim: imported manuscript HTML still reaches
  `host.innerHTML` in desktop and phone reader helpers, which raises the
  impact of the weak Electron shell configuration.
- Evidence:
  - `app/components/ProofingReader.js:927-960`
  - `app/components/ProofingReader.js:1424`
  - `app/components/ChapterReader.js:145-148`
  - `app/phone/_components/renderReaderContent.js:31-33`
- Checker follow-up audit: confirmed the specific Proof flag sink Inspector B
  checked is escaped, and confirmed the reader helpers do parse stored HTML in
  the renderer. This run did not prove a current source-to-executable-script
  exploit path for imported manuscript HTML, so the shell/file-bridge issue is
  confirmed, but a separate HTML-injection bug is still unproven here.
- Checker assessment: keep this as impact context for
  `SAS-AUD-20260602-015`, not as a separate bug-log item yet.
- Status: `audit unclear`
- Next check needed: safe temp-only manuscript fixture with hostile markup and
  a packaged/dev Electron check that proves whether the current import/render
  path can execute anything beyond inert markup.
