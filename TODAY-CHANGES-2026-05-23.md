# Script and Sync 3.0 changes made on 2026-05-23

## Sync and proofing behavior

- Fixed merged chapter timing so later scenes use the saved transcription/alignment anchors instead of rough word-count guesses.
- Fixed reopen/return behavior so chapter proofing comes back to the right place instead of drifting after leaving and returning.
- Fixed chapter scene proof openings so later scene rows jump into the correct point inside shared chapter audio.
- Fixed click and double-click word actions so proofing actions use the saved alignment more reliably.
- Fixed `Jump here` plumbing so it uses the saved merged alignment data instead of broken per-scene offsets.
- Made saved transcription/alignment effectively lock to its source.
- Added saved source metadata (`whisperAudioKey`, `whisperTextHash`) to chapter transcription results.
- If chapter audio changes, old saved transcription/alignment is now invalidated instead of being silently reused.
- If chapter manuscript text changes, old saved transcription/alignment is now invalidated instead of being silently reused.
- Reader navigation now refuses stale transcription data when the saved source no longer matches the current chapter audio/text.

## Transcription workflow

- Replaced the old single-screen transcription status with a persistent queue model.
- Manual chapter `Transcribe` clicks now queue instead of failing when another chapter is already running.
- Added a `Transcriptions` tab in the side panel to show queued, running, done, cancelled, and failed jobs.
- Added progress, status text, and remove/cancel controls inside that side panel queue.
- Leaving proofing and coming back no longer loses the visible transcription status, because queue state now lives outside the chapter screen.
- Removed the large per-chapter transcription progress bars from the chapter list.
- `Transcribe All Chapters` now queues chapters into the same background queue instead of trying to own a separate transient batch state.
- Queue items for a chapter are cleared or cancelled when that chapter’s audio/text source changes.

## Chapter list and UI cleanup

- Reduced the right-side navigation panel size a bit.
- Turned the right-side panel into two tabs: `Navigation` and `Transcriptions`.
- Simplified chapter action buttons:
- Chapter audio button is now an upload-style icon.
- Chapter transcription button now shows `T` instead of the confusing `Text` label.
- Removed the word `Play` from chapter and scene play buttons, leaving the play icon only.
- Kept chapter rows as the main audio rows in chapter-audio mode.
- Kept scene rows as navigation rows in chapter-audio mode rather than duplicate audio rows.
- Removed the visible `Re-align only` button while keeping Option/Alt-click realign on the transcribe control.
- Kept narrator/character hover labels so narrator names are available on hover.
- Removed the reader flag popup microphone icon and flattened the old gradient styling there.
- Kept `Follow text` defaulting on and clarified its on/off state in the reader footer.
- Made the side-panel `Nav / Queue` tabs a fixed-size pill so they do not jump around when switching tabs.
- Removed the extra side-panel header words above those tabs.
- Added a small pulsing running indicator to the `Queue` tab without changing the tab width.
- Widened the `Nav / Queue` pill slightly so the running indicator is not cramped.
- Split chapter transcription state into two pieces:
- a small action pill (`T`, `...`, percent, or `↻` for re-transcribe)
- a separate green saved-alignment badge (`✓ 99%`)
- Added a little more spacing to the proofing scene dropdown arrow in the top bar.
- Replaced delayed browser `title` hovers on narrator chips with faster in-app tooltips.
- Disabled `Jump here` when a chapter does not have usable transcription data yet, with a hover explanation.
- Reduced idle reader work by stopping the proofing sync animation loop when audio is paused.
- Set proofing audio to preload automatically to help first-play responsiveness.
- Made the proofing text scrollbar stay subtle until hover.

## Import and scene handling

- Added a top-level `Split chapters into scenes` toggle for import/setup flow, defaulting off.
- Simplified chapter mode so chapter audio stays on the chapter row while scene names remain available underneath for navigation.

## Tooltip and layout fixes

- Raised tooltip z-index so info tips no longer disappear behind the side panel.

## Release workflow guardrails

- Added a top-of-file release rule to `READ ME FIRST - OPEN THIS.txt`.
- Added the same release rule to `DEVELOPER ONLY - EDIT AND BUILD HERE.txt`.
- Documented clearly that `dist` is temporary Electron build output, not the real handoff location.
- Updated `scripts/copy-release.js` so Mac and Windows releases archive the previous app/files into `Script and Sync Releases/Old` with a date-and-time stamp before replacing them.
- Updated the Windows release flow so the final user-facing portable build is named `Script and Sync (Windows).exe`.
- Updated the Windows build launcher to copy both the runnable `.exe` and `Script and Sync Setup.exe` back into `Script and Sync Releases`, while archiving the old release files first.

## Verification done today

- `npm run build` passes in `Script and Sync 3.0`.
- `npm run electron-build-mac` passes in `Script and Sync 3.0`.
- Packaged Mac app was opened during this work session.
- The book detail screen showed queued chapter states after returning from proofing, which confirms the visible transcription state is no longer tied only to the proofing screen being open.
