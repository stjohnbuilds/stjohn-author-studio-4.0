# To do

Open work only. Finished items are removed, not ticked.

## Proofing reader
- Individual chapter transcription has thrown a remote-call error and briefly frozen the app mid-queue; needs reproducing and the transcribe error handling hardened.
- Saved transcriptions have occasionally gone missing with no repro yet — next time it happens, the cloud transcription table needs checking against local save data before anything gets re-transcribed.
- The scene "split" nudge arrows still respond to clicks and move nothing when Split mode is off; they should hide or disable instead.
- Double-click word-jump in the reader still doesn't reliably seek the audio once the app is packaged; needs event-targeting/seek debugging.
- Page-number rework is intentionally paused until specifically reopened; a long leftover rebuild plan for it is still sitting in the task list and should be archived once checked against the current code.
- The Proof reader is still its own separate implementation (about 1,400 lines) instead of the shared reader component Quill uses, so reader fixes currently have to be made twice.
- Quill: deleting an annotation or removing a chapter can leave orphaned annotation/character-marker data behind that can still export or sync; needs one shared cleanup helper used by every delete path.
- Duet: scan-completion status doesn't always reach the shared chapter list, and exported marker times can round to an invalid value; needs one consistent fix.
- A full hands-on pass through every mode — sign-in, all four desktop modes, both phone modes, cross-device checks — has a detailed room-by-room checklist still waiting to be walked end to end.

## Prep manuscript
- A visual polish pass is still pending — lower priority than data safety, but the mode needs a cleaner look before release.
- Duplicate identical dialogue lines can lose their individual speaker assignment after a fix/rescan; the merge needs to key off position/context rather than the quoted text alone.
- A generated highlighted Word export still needs to be opened in real Word on a real manuscript to confirm formatting and comments hold up — not yet confirmed.

## Phone
- Quill on the phone still has no way to edit or delete a saved annotation — adding one is the only action available today.
- Remembering the picked audio folder per book, and auto-filling the flag narrator/quote from the tapped word, are both built and reviewed but still need a hands-on confirmation pass on a real phone.
- A few phone/cloud edge cases are flagged as needing a real device before they can be safely fixed: scoping the pending-flag queue per signed-in account, treating a successful-but-empty cloud pull as authoritative for the phone's cached project list, and an offline-pending state for Quill phone saves.
- The two-device round trip — save or delete a flag/annotation on the phone and confirm it lands on desktop, and back — is architecturally supported but has never been formally tested end to end.

## Cloud sync
- A cloud push interrupted partway through (a network drop) can leave a project's row silently out of step with its transcription/flag data, and a Quill push doesn't hold back its "success" signal until every required step has actually landed; needs explicit per-step error checks and a push/backup record that can say "partial or failed."
- Deleting a project on one device isn't guaranteed to remove it from another device, and a stale local copy could re-upload after a delete; a project missing from an otherwise-successful cloud pull should be treated as remotely deleted, while local-only drafts that never synced stay protected.
- Cloud payload size on a large, fully transcribed book has never been measured, and pushing a whole book at the same time as a single flag hasn't been stress-tested.
- Prep isn't backed up to the cloud (a deliberate desktop-only choice); a small mirror table and push/pull helpers like Quill's would let a Prep project survive a lost machine, if that choice is ever revisited.
- The lazy-loading project list added to make switching into Quill fast still needs a real timing check on a genuinely large project.

## Build/release
- The installed app's auto-updater is stuck on an old published release while the code has moved several versions ahead — several shipped features aren't visible yet to anyone running the installed app; needs a fresh release publish plus a current Windows build.
- The Windows build still needs to confirm its bundled audio-checking tool actually ships and runs after the next Windows release.
- The Windows uninstaller leaves files behind that can't be removed through normal File Explorer afterward.
- Windows install can show a "the app cannot be closed" message even when it definitely isn't running.
- The Mac build has no code-signing or notarization, so first launch on any machine other than the one it was built on shows a security warning; needed before sharing outside a small trusted circle.
- The Windows build isn't signed either, so first install shows an "unrecognised publisher" warning.
- A packaged Mac build and a packaged Windows installer still need to be run through end to end on a genuinely clean machine — neither has been.

## Housekeeping
- More than 80 GB of old app builds sit in the local releases folder (git-ignored) — safe to delete or move out, not done yet.
- The local releases folder still carries the product's old name; the release scripts point at it, so renaming it means updating them together.
- A security setting in the desktop shell (webSecurity) is switched off to allow local audio playback; a properly scoped alternative would allow turning it back on — flagged but not fixed, low real-world risk for a single-account desktop app today.
- The local file-access bridge (audio playback, imports/transfers) doesn't yet enforce an explicit allowlist of chosen folders, and imported project IDs/paths aren't fully hardened against unexpected input — worth a dedicated pass before any wider release.
- Cloud push/pull and the offline-retry queue have no automated tests yet; only the smaller pure-logic pieces (formatting, slimming) are covered.
- A couple of stale planning drafts — an early Prep-mode build plan that shipped a different way, and a long page-number rebuild plan later put on hold — are still sitting in active-work folders instead of being archived.
- Two shared-component cleanups are still open: a shared project-list "home" view every mode could reuse instead of its own copy, and a themed confirm dialog to replace the plain browser popup used everywhere.
- A shared keyboard-navigation/focus pattern for dialogs, and labels on icon-only buttons, got a first pass — worth a final check that every dialog and control is covered.
- Export code for CSV/Word/InDesign is still separate per mode rather than sharing one export module.
- Small suggested polish still on the list: drag-and-drop support for uploads, and a larger, easier-to-tap back button.
- Test output currently prints module-format warnings on every run — cosmetic, a one-line project-config fix.
- Converting a manuscript to PDF for page-mapping depends on Word or a free office suite being installed locally, with no bundled fallback — fine for the one machine it runs on today, a gap for anyone else.

## Found by earlier reviews, not yet fixed


- The desktop app's audio player can be made to open or read any file on the computer, not just audio files, if fed a crafted project — the most serious item still open (Electron audio playback).
- Whether manuscript text shown in the reader could ever run something beyond harmless formatting was never proven safe or unsafe (desktop and phone reader display).
- Phone Quill has no offline queue for notes, so an unsent note can be lost if the app closes before it reconnects (phone companion, Quill).
- The phone's pending-notes count is stored globally rather than tied to the signed-in account, so it could show the wrong count after switching accounts on a shared phone (phone companion, cloud sync).
- Re-uploading a corrected manuscript in Duet Prep matches old audio to new chapters by position only, so inserting or reordering chapters can attach audio to the wrong chapter (Duet Prep).
- Two files (the shared book-detail screen and the phone screen) are still oversized and flagged for splitting into smaller pieces (general code structure).
- Several small text-cleanup helper functions are still copy-pasted in two or three places instead of one shared place (general code structure).
- A leftover developer-only "skip sign-in" shortcut is still present on the sign-in screen (sign-in screen).
- Save-folder and other broader app settings are only reachable from the Proof Listen screen, so they can look unavailable from the other three modes (app settings).
- Whether sign-in is required in a way that blocks offline-only use of Prep and Duet, which are meant to work without an account, was never fully settled (sign-in, Prep, Duet).
- The daily backup timer mixes a global-time marker with local-day logic, which could in theory skip a backup around midnight; not reproduced in real use (backups).
- A PDF re-import in Prep Manuscript may not carry page-number data through correctly; raised but not confirmed as an actual failure (Prep Manuscript).
- Sign-in and account logic is written separately in three different parts of the app instead of one shared place (general code structure).
- Automated tests still do not directly cover the phone app, the desktop shell, backups, or the release-packaging scripts (testing).
- Some reference documents describing the app's own structure still describe an older or target design rather than what is actually built (documentation).
- Touch-screen dismiss behaviour and narrow-width layout in the reader were flagged as possibly cramped but never checked live (mobile UX).
