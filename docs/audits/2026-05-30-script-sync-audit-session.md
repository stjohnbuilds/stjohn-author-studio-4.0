# Script and Sync Audit Session - 2026-05-30

## Scope

Begin the audit safely. Set up the documentation system before testing features
so that unknown navigation does not get mislabeled as a product bug.

## Source Goals Re-Checked

- `READ ME FIRST - OPEN THIS.txt`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

## Files Created

- `docs/audits/SCRIPT_AND_SYNC_AUDIT_RUNBOOK.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`

## First Audit Decision

The audit will use these categories:

- `confirmed-bug`
- `needs-navigation-proof`
- `needs-real-file`
- `environment-blocked`
- `doc-drift`
- `watchlist-risk`
- `fixed-archived`

This directly prevents false reports like "scene creation is broken" when the
real issue is that the tester did not find the right button yet.

## Current Findings

No product bugs are confirmed yet.

One audit-environment blocker is logged:

- `SAS-AUD-20260530-001`: Electron dev mode mirrors `books.json` into
  `~/Documents/StJohn Author Studio/Save Data/` even when launched from a temp
  project copy. The audit entry was removed from that mirror after discovery.

## Baseline Commands

```bash
git status --short
```

Result:

```txt
 M app/page.js
?? docs/APP_STRUCTURE.md
?? docs/audits/
?? docs/dev/active/script-sync-full-app-audit-plan/
```

`app/page.js` was already modified before this audit session and was not
touched.

```bash
npm test -- --test-reporter=spec
```

Result: passed. 13 tests passed, 0 failed. Node printed module-type warnings
for some ES-module-style files, but no test failed.

## Shell / Home Crawl

Environment used:

- Browser preview at `http://localhost:3007`
- Dev fake session: `dev@local`
- No Marie account credentials used.
- No real `Save Data/` files changed.

Controls found and tested:

| Control | Result | Evidence |
|---|---|---|
| Dev skip login | Passed | `docs/audits/artifacts/2026-05-30-shell-home/01-proof-home.png` |
| Proof tab | Passed | `docs/audits/artifacts/2026-05-30-shell-home/05-proof-return-home.png` |
| Prep tab | Passed | `docs/audits/artifacts/2026-05-30-shell-home/02-prep-home.png` |
| Duet tab | Passed | `docs/audits/artifacts/2026-05-30-shell-home/03-duet-home.png` |
| Quill tab | Passed | `docs/audits/artifacts/2026-05-30-shell-home/04-quill-home.png` |
| Settings opens | Passed | `docs/audits/artifacts/2026-05-30-shell-home/06-settings.png` |
| Settings closes | Passed after isolated retest | `docs/audits/artifacts/2026-05-30-shell-home/08-after-settings-close-retest.png` |
| Start tutorial | Opens Settings tutorial area | `docs/audits/artifacts/2026-05-30-shell-home/09-after-start-tutorial.png` |
| About Proof Listen | Passed | `docs/audits/artifacts/2026-05-30-shell-home/10-about-proof.png` |
| Sign out | Passed | `docs/audits/artifacts/2026-05-30-shell-home/11-after-signout.png` |

Important false-bug prevention note:

- During one combined click sequence, Settings still appeared after clicking
  close and then Start tutorial. Retesting close by itself proved Settings does
  close correctly. This was not logged as a bug.

Browser preview limitation:

- Settings correctly says desktop-only settings are available in the Electron
  app. Save-folder changing and Electron file dialogs were not tested in the
  browser preview.

## Generated Audit Files

Generated files live under:

`docs/audits/artifacts/2026-05-30-generated-files/`

Files created:

- `audit-proof-manuscript.docx`
- `audit-prep-dialogue.docx`
- `audit-duet-markers.docx`
- `audit-quill-annotations.docx`
- `expected-results.md`
- `audio/chapter-01.m4a`
- `audio/chapter-02.m4a`
- `audio/wrong-chapter.m4a`
- matching `.aiff` source files

Render QA:

- DOCX-to-PDF render worked after adding LibreOffice to `PATH`.
- Full PNG rasterization could not run because Poppler tools were unavailable.
- Quick Look generated
  `docs/audits/artifacts/2026-05-30-generated-files/rendered-proof/quicklook/audit-proof-manuscript.pdf.png`,
  and the first page looked clean.

## Proof Listen Electron Slice

Environment:

- Temp app copy: `/tmp/stjohn-author-studio-audit-run`
- Original `Save Data/` excluded from the copy.
- Electron dev URL: `http://localhost:3017`

Proof checks completed before stopping Electron:

| Control / workflow | Result |
|---|---|
| `+ New Book` | Passed |
| Import generated DOCX | Passed |
| Chapter detection | Passed: app found 3 real chapters plus `(Before first chapter)` front matter; front matter was unchecked |
| Save book | Passed |
| Attach chapter audio | Passed with generated `chapter-01.m4a` |
| Open proof reader | Passed |
| Play audio | Passed: 0:06 generated audio played |
| Create proof flag | Passed: flag saved with timestamp, quote, page, type, note, and audio filename |

Persistence evidence:

- Temp save file:
  `/tmp/stjohn-author-studio-audit-run/Save Data/books.json`
- The saved audit flag included note
  `Audit flag: check quote and timestamp export.`
- The original repo save file
  `/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/Save Data/books.json`
  kept its original May 27 timestamp.

Audit safety incident:

- The app also wrote the audit book to
  `/Users/mariemackay/Documents/StJohn Author Studio/Save Data/books.json`
  through dev-mode mirror persistence.
- Electron was stopped immediately.
- The audit book was removed from the Documents mirror; the existing `Anarchy`
  project remained.
- A fresh Electron run with `HOME=/tmp/stjohn-author-studio-audit-home`
  displayed save path
  `/private/tmp/stjohn-author-studio-audit-run-iso/Save Data/books.json`.
- After the isolated relaunch, the real Documents mirror timestamp remained
  `May 29 19:33:54 2026`.
- Further Electron testing must continue from an isolated `HOME`.

## Existing Git State Before This Session

`git status --short` already showed:

```txt
 M app/page.js
?? docs/APP_STRUCTURE.md
?? docs/audits/
?? docs/dev/active/script-sync-full-app-audit-plan/
```

The existing `app/page.js` modification was not touched by this documentation
setup.

## Next Step

Continue from the isolated Electron setup, then test Proof exports, Transfer,
save/restart, Prep, Duet, Quill, and phone checks. Each finding must be written
into `SCRIPT_AND_SYNC_BUG_LOG.md` before moving on.
