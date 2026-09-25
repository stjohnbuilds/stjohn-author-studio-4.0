# Log

A short history of the project. Newest decisions are added at the bottom of the relevant section.

## What was built, by month

## May 2026 — build begins
- Work started from a copy of an existing proofing app, rebranded, with a four-mode home screen (Proof Listen, Prep Manuscript, Duet Prep, Quill & Ink) as the starting scaffold.
- Prep Manuscript mode was built out first: manuscript import, automatic dialogue-line detection, per-line character/narrator assignment with a colour palette, a per-paragraph fixer for missing quotation marks, and a highlighted Word export carrying real Word comments.
- Quill & Ink mode was ported in: manuscript reader, drag-to-annotate, several annotation types, CSV and InDesign export.
- Account sign-in and a shared cloud-sync layer were added, with every upload passed through a guard that strips any audio file path or byte data before it can reach the cloud — audio itself never leaves the machine it's on.
- A browser-based phone companion was scaffolded, then brought close to feature parity with the desktop reader: double-tap-to-select, drag handles, adjustable reader settings, and a page-swipe reading mode.
- All four desktop modes were unified onto one shared book-detail screen, and Proof plus Quill onto one shared manuscript reader, so a fix in one place covers both.
- An independent review of the cloud-sync code found and fixed four real data-safety bugs (a previous account's data briefly visible after sign-out; a Quill setting saved but never read back; a stuck deletion marker; a race between two kinds of save) plus several smaller risks.
- A read-only readiness review rated the app workable for a small trusted circle, blocked from a public release mainly by missing Mac code-signing and an untested two-device round trip; it also confirmed the database's per-account access rules were locked down correctly.
- Page-number lookup was reworked around a slim word-position map so large books wouldn't time out uploading to the cloud.

## June 2026 — sync, transcription and phone hardening
- Page-number lookup gained a second, content-based fallback (search the source PDF for the flagged sentence) after a large book was found showing every late chapter as page 1.
- The audio-transcription and word-alignment path was hardened: chapters queue instead of failing when another is transcribing, a saved transcription is invalidated if its audio or text changes underneath it, and several rounds of word-position drift were traced and fixed.
- Two rounds of independent review of new phone features (remembering a picked audio folder, pulling a whole sentence from one tapped word, auto-filling the narrator) found and fixed real edge cases around sentence boundaries, a frozen form field, and manuscript text encoding.
- A per-character audiobook time breakdown was added, then hardened to recognise more manuscript formatting without needing any new saved data.
- A re-listen tool ("check errors") and an audition-marker generator were added, both able to read the same spreadsheet format.
- Default playback speed and a per-narrator speed memory were added, shared between desktop and phone.
- An audio-file checker against a well-known audiobook platform's technical rules was built and released as v4.0.19-v4.0.21; the first release crashed on launch from a missing bundled file and was fixed within two versions.
- Automatic update-checking against a published release feed, and a visible version number, were added so the installed app could update itself.
- Old diagnostic scripts were archived and verified-dead code removed; native Apple-silicon audio tooling replaced an emulated version.

## July 2026 — polish and a save-safety scare
- A single popup for jump-to-word, flag, and clip download replaced two competing ones, each option explaining itself when it doesn't apply yet (v4.0.28).
- A short-clip preview player was added (v4.0.29), then hardened after a real test showed it could keep playing with no way to stop — every stop path now funnels through one function (v4.0.30).
- Reader highlight colours were switched to match the exact colours from the source Word document (v4.0.31).
- The cloud database was found to auto-pause from inactivity on its free hosting tier; a scheduled keep-alive ping was added and tightened from twice a week to daily after a gap still let it sleep one day.
- A save-safety scare: a Quill project's chapter timing was found wiped on most of its chapters, traced to a save that let a blank local copy overwrite good saved timing while the database had been asleep. Fixed by making a save read the existing cloud data first and refuse to push at all if the database can't be reached.
- By late July the app had reached version 4.0.31 with all automated tests passing, but the most recent published release was several versions behind, so installed copies couldn't yet auto-update to see the newer work.

## Threads running throughout
- One shared cloud-sync module, one shared manuscript reader for the two cloud-backed modes, one shared book-detail screen for all four — repeated as the standing rule whenever a feature was about to be built twice.
- Audio never uploaded, only file names, so a phone can match a local file by name; no placeholder or sample data anywhere in the product.
- A feature only counts as finished once it has been confirmed against a real file, not just once its automated tests pass.

## Reviews and what they fixed

## Data safety and local files

A check in May 2026 found the test build of the app could accidentally write into the same save folder as real data if launched carelessly; later testing moved to a fully separate setup to avoid that risk. A review in June 2026 found three ways a crafted project or backup file could make the app read or write outside its normal save folders. Two of the three were fixed and proven with test files; the third, covering the desktop app's audio player, is still open (see the problems list).

## Cloud sync

A June 2026 review found the app could mark a project as fully up to date even when part of the cloud data had actually failed to load, and a backup could claim cloud data was included when it was not — both were fixed so failures are now reported honestly instead of hidden. A related finding, that a project deleted on one device could keep reappearing on another, was also fixed. A couple of smaller phone-side sync gaps are still open (see the problems list).

## Proofing reader

A June 2026 review found exported spreadsheets labelled the misheard-quote column "Note" instead of naming it as the quote, which was fixed. A separately reported issue where the "Next chapter" button could drop that chapter's transcription, while reaching the same chapter another way worked fine, was confirmed and fixed. Keyboard access and screen-reader labelling for on-screen controls were found lacking across the app and have since been added.

## Prep manuscript

A June 2026 review found that fixing a flagged paragraph with repeated identical lines could wrongly copy the first line's character assignment onto the other identical lines; this was fixed so each line keeps its own assignment. A smaller concern about page numbers after a PDF re-import was raised but never confirmed as an actual failure.

## Quill and Ink annotations

A June 2026 review found two related problems: deleting a note could leave its attached character markers behind, and removing a chapter could leave that chapter's notes behind, still showing up in exports and cloud sync. Both were fixed.

## Duet Prep

A June 2026 review found a fully scanned chapter could still show as "incomplete" in the shared chapter list, and exported timing markers could contain an invalid time value at certain boundary moments; both were fixed. A separate finding, that re-uploading a corrected manuscript matches old audio to new chapters by position only, is still open (see the problems list).

## Phone companion

A June 2026 review found the phone Quill screen told users they could still pick audio from inside the reader when that option was actually switched off there; the wording was corrected to match what the screen really does. A related finding — that refreshing with no cloud projects keeps showing the old cached list on the phone — was reviewed and kept on purpose, so an empty or slow refresh never looks like lost work.

## Branding and release files

A June 2026 review found backup and transfer files still carried the app's old product name; this was fixed while keeping older backup files able to be brought back in. Several reference documents describing the app's own structure were found out of date in multiple places; a short "current status" note was added rather than a full rewrite.

## Code health and test coverage

A June 2026 review measured the overall codebase as lean, not bloated, but flagged two files (the shared book-detail screen and the phone screen) as too large and due for a split, plus a handful of small helper functions copy-pasted in several places. Since then, 14 unused script files were archived and one duplicated helper was merged into a single shared copy; splitting the two large files and merging the rest of the duplicated helpers has not happened yet. Automated test coverage grew from 6 test files to 18 over the same stretch.

## 24 September 2026 — cleanup verification

Removed stale development-note pointers and personal test paths; aligned version and update-feed documentation with 4.0.32 and the downloads repository. Existing Node tests: 163 passed. Local safety hooks retain their scope guard using their actual directory and use neutral backup messages.
