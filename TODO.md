# To do

Open work only. Finished items are removed, not ticked.

## Handover — review of 12 November 2026

A full read-only review of version 4.0.32 was carried out on 12 November 2026. No code was changed. Each item says how it was established: RUN (reproduced by a script against a throwaway copy or a stand-in), READ (traced in the code), SUSPECTED (needs a live check). "Re-checked" means a second, independent check agreed. Severity: FIX NOW can lose or corrupt saved work, block a session, give a wrong export, or expose files; FIX SOON is a real fault with a workaround; LEAVE is a tidy-up. Items here sharpen, and where they disagree replace, the older lists further down.

### Order of work
1. Prep Manuscript: version 4.0.33 with the export, save, replace, remove and keyboard fixes is installed on the main computer in place of 4.0.32 and opens with the saved project (see LOG, 12 November). Still to do: open one export in real Word; run one Replace manuscript with a real corrected file; build and publish the Windows and update-feed releases so other installed copies receive 4.0.33.
2. Gather saved work into one folder (steps under "Where saved work lives"). To be done after the next Prep session, not before. Waiting for a go.
3. Everything else, chosen from the lists below.

### Prep Manuscript
- P3 FIX SOON (reduced). The Prep screen now shows "Not saved" and retries when a write fails, no longer writes on open, and writes a pending change when the window closes. What remains is on the desktop side: `write-prep-data` still writes the spare copy when the main copy failed, and `read-prep-data` still prefers the main copy without comparing dates, so after a failed main write the next open reads the older main copy. `main.js:858-869, 1437-1453`. READ.
- P4 FIX SOON (reduced). Opening Prep no longer writes anything, a project the screen cannot open is kept in the file untouched, and a read that fails outright blocks saving for the session. What remains: when both copies are unreadable the desktop side returns an empty list rather than an error, so a new project started then would replace both files. `main.js:1437-1446`. READ.
- P6 FIX SOON. Prep rewrites its whole save file on every open and every change (8.6 MB for one book, because the Word file is stored inside it). The spare copy is therefore never an independent backup, and a second computer or an unmounted Drive can write a stale list over newer work. `PrepManuscriptMode.js:340-355`, `main.js:182-192, 277-282`. READ; two-computer timing SUSPECTED.
- P7 FIX SOON. The paragraph Fix tool flattens the chapter's on-screen formatting, and a fix only reaches the Word export when the paragraph text matches exactly (72 of 1,624 quoted paragraphs in the test book would not). `PrepManuscriptMode.js:1527-1545`, `prepExport.js:713-748`. RUN.
- P9 (reduced). The export now keeps a single shading tag per run and drops a marker-pen highlight from shaded runs. Still to do: open one export in real Word to confirm it opens without a repair prompt (Word is installed on the main computer).
- P10 FIX SOON. Sign-in blocks the two local-only modes when offline. With no connection and an expired login the app stops at the sign-in screen. This settles the older open question. `app/page.js:645-660, 1594-1616`. READ.
- P12 LEAVE. Upload PDF in Prep builds an empty page map (it reads chapter text where Prep keeps text in sections), and every import runs the slow page scan. `PrepManuscriptMode.js:1047-1051`, `app/components/ImportFlow.js:474-502`. READ.
- P13 LEAVE. Lines of a character with no narrator are missing from the narrator list without warning; the two spreadsheets have no byte-order mark; two characters can share a colour without warning. `prepExport.js:126-164`. RUN.
- P14 LEAVE. Next stops without a message at a chapter that has no dialogue. `PrepManuscriptMode.js:1339, 1358-1371`. READ.
- P15 Windows. Import can wait up to 120 seconds twice on the page scan; Drive is only looked for on drives G, H and I. `main.js:170-177, 590-700`. READ.
- Found fine on a real book: import, chapter split, dialogue detection (1,994 of 1,995 saved lines reproduced), both spreadsheets (1,995 rows with correct escaping; 62 narrator rows), and the Word package itself (valid, comments consistent).

### Where saved work lives (state on 12 November 2026)
- The installed Mac app saves into Google Drive at `My Drive/Game Dev/GitHub/StJohn Author Studio/Save Data` (location 1; chosen by `main.js:23, 182-192, 277-282` because no save-folder setting exists) and keeps a spare copy in the app-support folder (location 2). Location 1 holds only the books file and the Prep file. Location 2 also holds the Quill files. The code folder's own `Save Data` (location 3, used in development and by any copy of the app opened from beside it) is the only place holding the Duet Prep file and `Manuscript Sources`. `Documents/StJohn Author Studio/Save Data` (location 4) holds older copies only.
- Effect today: Duet Prep shows no projects; "Rescan page map" fails for all three books because their stored Word files are only in location 3; a transfer export leaves the manuscript out; Quill is read from the spare copy only. Nothing is lost.
- Proposed gathering into location 1 (not started): quit the app on every computer; make one dated safety copy of all four locations; copy the Duet Prep file from location 3; copy the Quill projects file and then the Quill list file from location 2; create `Manuscript Sources` in location 1 with the three Word files the books refer to; open the app and check that each mode shows its projects and that a page-map rescan works; only then archive locations 3 and 4. Development runs must be pointed at a separate test folder or they will split the data again.
- A1 FIX NOW. The app's in-page storage is reset on every launch, because the local page server takes a random port and storage is filed per address (`main.js:1222`). Sign-in is not remembered, the daily-backup switch is forgotten so daily backups have never run (the backup folder is empty), and deletion markers and the unsent-flag queue do not survive a restart. `packages/backups/index.js:48-56`, `packages/cloud-sync/tombstones.js:19-60`, `packages/cloud-sync/flag-queue.js:23-48`. RUN (81 different addresses on record), re-checked; READ.
- A2 FIX NOW. If the main books, Prep or Duet file cannot be read for a moment (still syncing, half-written), the spare copy is loaded and written over it. With two computers on one Drive folder the spare is older by design. `main.js:858-864, 1391-1446`. RUN in a sandbox; READ, re-checked.
- A3 FIX NOW. When the main and spare Quill files differ, a project that exists only in the spare is dropped and the shorter list is written over both. `main.js:908-924, 1040-1051`. RUN; READ, re-checked.
- A4 FIX NOW. Stranded work, as described above. Longer term: warn at start when a book says its manuscript is stored but the file is missing.
- A5 FIX NOW (confirms and widens the older audio-bridge item). Six desktop channels read or process any file path the page sends: read-audio-file, get-audio-url with the localfile protocol, export-audio-clip, acx-analyze-file and whisper-transcribe; web security is off. `main.js:1249, 1367-1370, 1551-1556, 1582-1586, 1639-1645, 1715-1718, 2224`. RUN in a sandbox; READ, re-checked for get-audio-url. A possible way in: a flag quote typed on the phone is stored unescaped and shown as raw HTML on the desktop (`app/phone/page.js:2229`, `packages/cloud-sync/proof-sync.js:327`, `app/components/ProofingReader.js:1752`), SUSPECTED. Fix: one helper for all six that resolves the real path and accepts only audio extensions; escape the quote when shown.
- A6 FIX SOON. Backups hold only the four files in the main folder, never the spare copies or `Manuscript Sources`; they are skipped when Drive is not detected; there is no restore; the manifest stores the account e-mail. `main.js:2341-2347, 2394-2473`. RUN; READ, re-checked for the file list.
- A7 FIX SOON. Every save rewrites whole indented files in place (53 to 62 MB), with no temporary file and rename, and a failed write is swallowed. `main.js:101-109, 866-869, 1423-1453`, `app/page.js:85-88`. RUN.
- A8 FIX SOON. The save folder changes without notice: Drive not mounted gives a local folder; a missing configured folder gives the Drive default; an app opened from beside a `Save Data` folder uses that one. This is how the four locations came about. `main.js:182-192, 246-282`. RUN in a sandbox.
- A9 FIX SOON. The Save Folder setting only repoints and seeds missing files; it never copies `Manuscript Sources` and can make the app look empty. `main.js:1492-1531`. RUN.
- A10 FIX SOON. No single-instance lock and no file lock: two open copies, or two computers, each rewrite whole files and the last save wins. READ, re-checked.
- A12 FIX SOON (Windows). The release copy step looks for an installer name the build does not produce and stops with an error after removing the previous files; the Open launcher looks for a file that is never built. `scripts/copy-release.js:15-17, 88-115`, `electron-builder.yml:56`. RUN against a stand-in; READ, re-checked.
- A13 FIX SOON. Updates are trusted on a checksum alone; the Mac build's signing probably stops the in-app update from installing (SUSPECTED, needs one real update); nothing blocks a new window or a navigation from inheriting the desktop bridge. `main.js:1237-1251, 1293-1344`. READ.
- A14 FIX SOON. The sandbox seed script writes into the code folder's real books file and can replace it with the sandbox book alone. `scripts/seed-pac3-sandbox.js:7, 27-41, 96-97`. READ.
- A15 LEAVE. The comment on the inlined path helpers gives the wrong cause (the shared file is simply missing from the packaged file list); a deprecated protocol call; eleven Word files in location 3 belong to no current book.
- Found fine: context isolation on and node integration off; the local page server binds to the local address only and blocks path traversal; manuscript and transfer paths use the boundary helpers; child processes are started with argument lists; exports never overwrite; no secrets in tracked files or history.

### Proof Listen
- B1 FIX NOW. Several actions rebuild the book from a copy taken earlier (attaching audio after the file picker closes, re-align, saving a flag after a cloud pull), which overwrites anything saved in between, such as a transcription that finished meanwhile. `app/components/SessionsView.js:1571-1585, 1693-1700` and the same pattern at 1259, 1329, 1350, 1366, 1387, 1500, 1509, 1658, 2097-2110; `app/page.js:719, 991-1004, 1243-1256`. RUN on a replica of the merge; READ.
- B2 FIX NOW (root cause of the older "remote-call error mid-queue" item). Cancelling sets a three-second force-kill timer that kills whichever transcription is running then, usually the next chapter in the queue. `main.js:2199-2212`. READ, re-checked. Fix: remember the process being cancelled and kill only that one.
- B3 FIX NOW (root cause of the older "brief freeze" item). After transcription, word matching runs twice on the screen's own thread: about 2.8 s per pass for 8,000 words, and minutes when the audio has many extra words. `SessionsView.js:1783, 1786, 2067, 2086`, `app/lib/fuzzyMatcher.js:218-247`. RUN on synthetic chapters.
- B4 FIX SOON (likely cause of the older "transcriptions go missing" item). A saved transcription is shown only when the stored audio key equals today's, so it disappears on the other computer, after a moved file, and after a transfer import; "transcribe all" then redoes and overwrites it. `SessionsView.js:166-188, 658-663`, `app/page.js:118-139`, `main.js:497-525`. RUN.
- B5 FIX SOON. Every flag, tick or edit sends the whole library to the desktop side, which indents it, checks every audio file on disk and writes it twice; the words are stored several times over, so the file is about 2.5 times its needed size. `app/page.js:85-89, 982-1004`, `SessionsView.js:1807-1824`, `main.js:933-975, 1423-1428`. RUN on a synthetic book.
- B6 FIX SOON. With Drive not mounted at start, saves go to a local folder; when Drive returns the older Drive copy is loaded with no date check. If both copies are unreadable an empty library is shown and the next save overwrites both. `main.js:182-192, 276-282, 858-864, 1391-1409`. READ.
- B7 FIX SOON. The reader's chapter and scene jumps count words differently from the book screen, so highlight and jumps drift. `app/page.js:168-217`, `app/lib/manuscriptPaging.js:3-15`, `SessionsView.js:61-80, 1794`. RUN.
- B8 FIX SOON. Sub-word pieces from transcription are stored as separate words (names and contractions split up), which hurts matching and inflates counts. `packages/audio-engine/whisper-json.cjs:12-25`, `main.js:2230-2241`. RUN; the current test locks the behaviour in.
- B9 FIX SOON (older "double-click word-jump" item). The jump clamps to zero when the audio length is not yet known; packaged audio is served through a custom protocol that is not registered for streaming, which commonly makes seeking unreliable (SUSPECTED). `app/components/ProofingReader.js:446-450, 839-853, 1135-1140, 1498-1505`, `main.js:1367-1370`. READ.
- B10. No scene-split nudge arrows were found in the Proof Listen files; the nearest control, the reader's word-offset buttons, changes a hidden offset and does not redraw while paused. `ProofingReader.js:812, 1293, 1716`. READ.
- B11 FIX SOON. Each progress percent during transcription re-renders the whole book screen; with Split on, every re-render rebuilds every chapter's scene rows. `SessionsView.js:237-242, 810, 1524-1533, 3306-3356`. READ.
- B12 FIX SOON. Re-attaching audio, even the same file, erases that chapter's transcription without notice; books whose audio has moved open with no message. `SessionsView.js:1527-1531, 1575, 1698-1699`. READ.
- B13 LEAVE. About 250 unused lines in `ProofingReader.js` (125, 174-322, 362 onward); key and path helpers exist twice.
- B14 LEAVE. A waiting chapter says to press Transcribe again although the queue retries by itself. `SessionsView.js:1873-1887, 1943-1950`.

### Quill & Ink, Duet Prep, cloud sync
- C1 FIX NOW. On each signed-in launch of Quill the cloud copy wins and is saved over the local project, but the pull rebuilds the project from about ten fields, so PDF page data, chapter audio links and annotation details (context, section title, chapter number, category) are lost. `packages/cloud-sync/quill-sync.js:68, 339-350`, `app/components/QuillAndInkMode.js:312-336, 373-386`. RUN against a stand-in database; READ, re-checked.
- C2 FIX NOW. Each Quill save deletes every cloud annotation it does not hold, with no time guard, and desktop Quill does not pull again when the window regains focus; an annotation added on another device is deleted by the next desktop save, and the reverse. `quill-sync.js:191-209`. RUN; READ, re-checked. This answers the older "two-device round trip" item: it fails.
- C3 FIX NOW. Signing in as a different account and opening Quill prunes local projects, and can write an empty list over both copies. `QuillAndInkMode.js:112-123, 537-546`. RUN; READ.
- C4 FIX SOON. Overlapping or half-failed first pushes of a new Quill project create two cloud rows. `QuillAndInkMode.js:570-604`, `quill-sync.js:57-71`. RUN.
- C5 FIX SOON. Deleted annotations come back from older save copies, because copies are joined and a deletion leaves no marker. `main.js:315-321, 889-924`. RUN.
- C6 FIX SOON. Each Quill autosave re-reads three copies of the projects file (about 62 MB) and rewrites it four times on the main process. `main.js:1040-1050, 1466-1482`, `QuillAndInkMode.js:115-118`. RUN on a synthetic file.
- C7 FIX SOON. Duet Prep: the scan, rescan, realign, re-upload, bulk-audio, merge, split and delete-chapter functions are never called (about 550 lines, `app/components/PrebuildMode.js:489-1080`), transcription results are not recorded so Export stays disabled, and the export panel is never drawn (`PrebuildMode.js:262, 1061-1066, 1157-1206`). READ, re-checked for four functions and the panel. Needs one live run to confirm how much still works.
- C8 FIX SOON. Duet marker files are named from the chapter title alone, so two chapters with one title overwrite each other; folder names are not cleaned for Windows. `PrebuildMode.js:954-955`, `main.js:1799-1810`. READ.
- C9 FIX SOON. Clearing a Quill chapter's transcription is undone at the next launch. `quill-sync.js:95-101`, `QuillAndInkMode.js:316-323`. RUN.
- C10 FIX SOON. A re-transcribe or realign of the same text and audio is never uploaded, because the change check looks only at the length of the timing list. `packages/cloud-sync/proof-sync.js:66-75`. RUN.
- C11 FIX SOON. Pulls fetch each table in one request with no paging; if the server keeps the usual 1,000-row limit the rest is dropped and the next push deletes it from the cloud. Each Quill push re-uploads the whole book. `quill-sync.js:191-244`, `proof-sync.js:227-240`, `packages/cloud-sync/cloud-slim.js:94-99`. RUN against a stand-in with that limit; the server's real limit SUSPECTED.
- C12 Windows. The Quill "transcription saved" tick can drop on Windows when a Mac audio path is stored first. `QuillAndInkMode.js:183, 455-457`. READ.
- C13 LEAVE. Exporters: no byte-order mark in the spreadsheet; an annotation with a missing chapter is labelled with the first chapter; control characters break the Word export; a title with a line break breaks the InDesign script. `packages/quill-engine/exporters.js:19, 29-31, 75, 511-517`. RUN.
- C14 LEAVE. Cloud delete errors are ignored; the phone ignores deletion markers. `quill-sync.js:357`, `proof-sync.js:301`, `tombstones.js:156-171`. READ.
- Phone page. The dependency is one way (the desktop imports nothing from it). The shared sign-in screen offers account creation, so if sign-ups are enabled on the cloud project anyone reaching the public page can register; the server setting cannot be seen from the code and should be checked and switched off. Retiring the page means deleting `app/phone/**` and `scripts/vercel-root-to-phone.js`, removing the post-build step from `package.json`, taking down the web deployment, and updating the notes.
- Found fine: one cloud client only, limited to the six tables; the audio guard; error handling on pulls; flag pruning is time-guarded; exporter escaping for quotes, ampersands and line breaks.

### Whole project
- D1 FIX NOW (large). The desktop runtime (Electron 31) is far out of support; its known faults are fixed from version 42. Best done together with the packaging tool's major update. `package.json`.
- D2 FIX NOW (small). The page framework has critical advisories that the latest patch of the same major version (14.2.35) clears. They do not run inside the desktop app (static export) but do apply to the public phone page.
- D3 FIX SOON (small). The Word reader and the update checker have fixes available within their current major versions (mammoth 1.13.0, electron-updater 6.8.11).
- D4 FIX SOON. The installed app is 988 MB; about 300 MB of packed libraries are never used at run time. `electron-builder.yml:9-17`.
- D5 FIX SOON. The path-boundary guard exists twice: the tests check `packages/cloud-sync/path-safety.cjs` while the app runs its own copy in `main.js:45-75`.
- D6 FIX SOON. About 90 empty error handlers (26 in `main.js`, 21 in `app/page.js`); about 31,000 of 37,500 lines have no automated test, including sign-in, backups, the flag queue, deletion markers and the whole desktop shell.
- D7 FIX SOON. 53 native alert and confirm pop-ups in 8 files where the rules ask for the shared dialog; pictographs and symbol characters in the interface where the rules forbid them (including one stamped by `main.js:1352`).
- D8 FIX SOON. Small helpers are copied three to six times and some copies have drifted (spreadsheet quoting, word counting, safe file names, ids, text hashing, the two transcription workers, sign-in in four places).
- D9 FIX SOON. Notes and names: tests and a few comments use character names taken from a real manuscript and real-looking first names for narrators; one placeholder shows a real-looking name; a script and two commands carry a real book code; the old product name still shows in three screens and four image files; comments point to review numbers kept nowhere in the repository; the built app contains the home-folder path of the machine that built it; `main.js:23` fixes one personal Drive layout. No personal name and no tool name was found in tracked files or commit messages.
- D11 FIX SOON. A clean build cannot fetch the Intel audio-check binary any more: the download address in `scripts/ensure-ffmpeg.js` answers "gone" (HTTP 410), so `npm run ffmpeg:mac` fails unless `bin/ffmpeg-x64` is already present. The 4.0.33 build reused the existing file. The Mac build asks for the Intel binary even though only the Apple-silicon one ships.
- D10 LEAVE. A stale root `index.html`; unused exports; a styling toolchain used for little more than a reset; the sandbox seed script and its special case at `SessionsView.js:1847`.
- Installed app and code: the installed 4.0.32 is built from the current code (`main.js` and `preload.js` identical, re-checked; compiled screens compared with a fresh build).
- Tests: 163 pass in a copy with the libraries installed, none skipped. They cannot all run inside the Drive folder because the libraries are not installed there. The module-format warning is not a one-line fix: a root-level module setting would break `main.js`; a small `package.json` in each package folder is the safe route.
- Notes that no longer match: the release folder named in README and RULES no longer exists; RULES and LOG still read as if the keep-awake job runs from this repository; LOG stops at 4.0.31; `electron-builder.yml:75` says the repository can stay private while RULES says public; RULES says the shared reader is used by Quill only (Proof Listen also uses its word renderer) and that the desktop re-pulls on focus (desktop Quill does not). The cloud project is recorded elsewhere as being on a paid plan since 9 October 2026 (not re-checked live), so the free-plan pause note and the keep-awake job may no longer be needed.

## Proofing reader
- Individual chapter transcription has thrown a remote-call error and briefly frozen the app mid-queue; needs reproducing and the transcribe error handling hardened.
- Saved transcriptions have occasionally gone missing with no repro yet — next time it happens, the cloud transcription table needs checking against local save data before anything gets re-transcribed.
- The scene "split" nudge arrows still respond to clicks and move nothing when Split mode is off; they should hide or disable instead.
- Double-click word-jump in the reader still doesn't reliably seek the audio once the app is packaged; needs event-targeting/seek debugging.
- Page-number rework is intentionally paused until specifically reopened.
- Proof Listen retains its own audio/flag wrapper, while manuscript word rendering already uses the shared ChapterReader renderChapterBody helper and word-element lookup. Review remaining wrapper duplication without rebuilding the shared word renderer.
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
