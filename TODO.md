# To do

Open work only. Finished items are removed, not ticked.

## Proofing reader
- Individual chapter transcription has thrown a remote-call error and briefly frozen the app mid-queue; needs reproducing and the transcribe error handling hardened.
- Saved transcriptions have occasionally gone missing with no repro yet — next time it happens, the cloud transcription table needs checking against local save data before anything gets re-transcribed.
- The scene "split" nudge arrows still respond to clicks and move nothing when Split mode is off; they should hide or disable instead.
- Double-click word-jump in the reader still doesn't reliably seek the audio once the app is packaged; needs event-targeting/seek debugging.
- Page-number rework is intentionally paused until specifically reopened.
- The Proof reader is still its own separate implementation (about 1,400 lines) instead of the shared reader component Quill uses, so reader fixes currently have to be made twice.
- A full hands-on pass through every mode — sign-in, all four desktop modes, both phone modes, cross-device checks — has a detailed room-by-room checklist still waiting to be walked end to end.

## Prep manuscript
- A visual polish pass is still pending — lower priority than data safety, but the mode needs a cleaner look before release.
- A generated highlighted Word export still needs to be opened in real Word on a real manuscript to confirm formatting and comments hold up — not yet confirmed.

## Phone
- Quill on the phone still has no way to edit or delete a saved annotation — adding one is the only action available today.
- Remembering the picked audio folder per book, and auto-filling the flag narrator/quote from the tapped word, are both built and reviewed but still need a hands-on confirmation pass on a real phone.
- A few phone/cloud edge cases are flagged as needing a real device before they can be safely fixed: scoping the pending-flag queue per signed-in account, treating a successful-but-empty cloud pull as authoritative for the phone's cached project list, and an offline-pending state for Quill phone saves.
- The two-device round trip — save or delete a flag/annotation on the phone and confirm it lands on desktop, and back — is architecturally supported but has never been formally tested end to end.

## Cloud sync
- Exercise interrupted pushes and cross-device deletion on signed-in devices. Secondary-query failures now throw, Quill stamps its success hash only after required work succeeds, and successful pulls prune missing cloud-owned projects while preserving local drafts. Source and regression checks cover these fixes; real account/device acceptance remains open. A multi-step push is not a database transaction, so a recovery/status record for partially completed uploads remains a separate improvement.
- Cloud payload size on a large, fully transcribed book has never been measured, and pushing a whole book at the same time as a single flag hasn't been stress-tested.
- Prep isn't backed up to the cloud (a deliberate desktop-only choice); a small mirror table and push/pull helpers like Quill's would let a Prep project survive a lost machine, if that choice is ever revisited.
- The lazy-loading project list added to make switching into Quill fast still needs a real timing check on a genuinely large project.

## Build/release
- Verify the installed app's update workflow against the downloads repository. The installed Mac app and current source both report 4.0.32; this does not prove a complete update/download/relaunch or Windows installation.
- The Windows build still needs to confirm its bundled audio-checking tool actually ships and runs after the next Windows release.
- The Windows uninstaller leaves files behind that can't be removed through normal File Explorer afterward.
- Windows install can show a "the app cannot be closed" message even when it definitely isn't running.
- The Mac build has no code-signing or notarization, so first launch on any machine other than the one it was built on shows a security warning; needed before sharing outside a small trusted circle.
- The Windows build isn't signed either, so first install shows an "unrecognised publisher" warning.
- A packaged Mac build and a packaged Windows installer still need to be run through end to end on a genuinely clean machine — neither has been.

## Housekeeping
- Old build artifacts remain in ignored release folders. Audit exact versions, unique contents and consumers before any later removal; cleanup currently stops before deletions.
- The local releases folder still carries the product's old name; the release scripts point at it, so renaming it means updating them together.
- A security setting in the desktop shell (webSecurity) is switched off to allow local audio playback; a properly scoped alternative would allow turning it back on — flagged but not fixed, low real-world risk for a single-account desktop app today.
- The audio file-access bridge still needs an explicit allowlist of chosen audio files/folders before wider release. Manuscript-source and transfer paths already use containment guards with regression coverage; do not treat those two repaired paths as wholly unprotected.
- Add coverage for offline retry queues and full device/cloud recovery. Cloud push/pull failure handling and cross-device pruning already have regression tests; this is not a request to recreate those tests.
- A shared project-list home view remains a possible consolidation. AppDialog is already used in the main shell; native browser confirmations remain in BookDetail, PrebuildMode, SessionsView and the phone flag flow.
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
- Review whether to retain the development-only sign-in shortcut. LoginScreen gates it with NODE_ENV !== 'production'; it is not an available sign-in route in the installed production app, and it cannot verify real cloud access.
- Save-folder and other broader app settings are only reachable from the Proof Listen screen, so they can look unavailable from the other three modes (app settings).
- Whether sign-in is required in a way that blocks offline-only use of Prep and Duet, which are meant to work without an account, was never fully settled (sign-in, Prep, Duet).
- The daily backup timer mixes a global-time marker with local-day logic, which could in theory skip a backup around midnight; not reproduced in real use (backups).
- A PDF re-import in Prep Manuscript may not carry page-number data through correctly; raised but not confirmed as an actual failure (Prep Manuscript).
- Sign-in and account logic is written separately in three different parts of the app instead of one shared place (general code structure).
- Automated tests still do not directly cover the phone app, the desktop shell, backups, or the release-packaging scripts (testing).
- Keep the four project notes aligned with current source. Earlier dev/docs planning trees were consolidated; do not direct future work to those absent folders. Historical design goals remain distinct from current implementation.
- Touch-screen dismiss behaviour and narrow-width layout in the reader were flagged as possibly cramped but never checked live (mobile UX).
