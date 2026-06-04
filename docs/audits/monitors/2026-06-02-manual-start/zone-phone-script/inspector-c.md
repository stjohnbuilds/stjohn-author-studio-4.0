# Inspector C - Zone 7 - Phone Script

## Scope

Independent read-only static audit of Phone Script only:

- auth and project-list load path
- cache + refresh behavior
- local-audio-only boundary
- flag add/delete + offline queue flow
- phone Proof export path
- doc drift for Phone Script status rows

## Source Docs Checked

- `docs/audits/STJOHN_MONITOR_SOURCE_OF_TRUTH.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_AUTOMATION.md`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/SHARED_COMPONENTS.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Commands Run With Exit Codes

- `git status --short` -> exit `0`
- `npm test -- --test-reporter=spec` -> exit `0`
- `find docs/audits/monitors -maxdepth 3 -type f | sed 's#^#/#' | sort` -> exit `0`
- `rg -n "Phone Script|phone script|app/phone|PhoneReader|script_sync|flag|annotation|audio stays local|audio" docs/WIRING_MATRIX.md docs/FRONT_FUNCTION_TREE.md docs/SHARED_COMPONENTS.md docs/CLOUD_SCHEMA.md docs/CLOUD_SAFETY_AUDIT.md docs/APP_STRUCTURE.md` -> exit `0`
- `rg -n "signIn|signUp|resendConfirmation|signOut|retryFlagQueue|recordPendingFlag|export.*CSV|build.*Csv|delete.*flag|update.*flag|save.*flag|audio|pick local audio|Script mode|flag" app/phone/page.js app/phone/_components app/phone/_lib packages/cloud-sync packages/quill-engine app/page.js` -> exit `0`
- `sed -n '1,320p' app/phone/page.js` -> exit `0`
- `sed -n '321,760p' app/phone/page.js` -> exit `0`
- `nl -ba app/phone/page.js | sed -n '1480,1865p'` -> exit `0`
- `nl -ba app/phone/page.js | sed -n '1866,3145p'` -> exit `0`
- `nl -ba app/phone/page.js | sed -n '3146,3420p'` -> exit `0`
- `nl -ba app/phone/_components/PhoneReader.js | sed -n '1,320p'` -> exit `0`
- `nl -ba app/phone/_lib/projectCache.js | sed -n '1,260p'` -> exit `0`
- `nl -ba app/phone/_lib/audioFolderMemory.js | sed -n '1,260p'` -> exit `0`
- `nl -ba packages/cloud-sync/flag-queue.js | sed -n '1,320p'` -> exit `0`
- `nl -ba packages/cloud-sync/proof-sync.js | sed -n '1,380p'` -> exit `0`
- `nl -ba packages/cloud-sync/account.js | sed -n '1,220p'` -> exit `0`
- `nl -ba packages/cloud-sync/client.js | sed -n '1,220p'` -> exit `0`
- `nl -ba docs/WIRING_MATRIX.md | sed -n '78,90p'` -> exit `0`
- `nl -ba docs/FRONT_FUNCTION_TREE.md | sed -n '84,96p'` -> exit `0`
- `rg -n "Phone Script|phone script|flag queue|pending flag|Proof export|quote column|audio folder|Pick local audio|account swap|sign out|Edit / delete flag|phone Proof" docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md docs/audits/monitors/2026-06-02-manual-start -g '*.md'` -> exit `0`

## Evidence Paths

- `app/phone/page.js`
- `app/phone/_components/PhoneReader.js`
- `app/phone/_lib/projectCache.js`
- `app/phone/_lib/audioFolderMemory.js`
- `packages/cloud-sync/account.js`
- `packages/cloud-sync/client.js`
- `packages/cloud-sync/flag-queue.js`
- `packages/cloud-sync/proof-sync.js`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SCHEMA.md`
- `docs/CLOUD_SAFETY_AUDIT.md`
- `docs/audits/SCRIPT_AND_SYNC_BUG_LOG.md`
- `docs/audits/STJOHN_PROJECT_MONITOR_REPORT.md`

## Pass Items

1. Phone Script has a real auth, cache, and refresh path. The phone shell reads the Supabase session, uses per-user IndexedDB cache, applies a 10-second refresh timeout, and refreshes again on focus/visibility. Evidence: `app/phone/page.js:602-611`, `1481-1617`; `app/phone/_lib/projectCache.js:1-69`; `packages/cloud-sync/account.js:54-139`.
2. The phone Proof audio boundary is still local-only in this static read. Audio is picked from phone files/folders, folder memory stays on-device, cloud pushes strip audio paths, and the Supabase client hard-blocks non-whitelisted tables/RPCs. Evidence: `app/phone/page.js:1831-1858`, `2521-2765`, `3113-3389`; `app/phone/_lib/audioFolderMemory.js:1-143`; `packages/cloud-sync/proof-sync.js:14-18`, `46-57`; `packages/cloud-sync/client.js:22-61`.
3. Phone Script does have a real add/delete flag flow with an offline retry queue. The service updates local state eagerly, writes queued save/delete intents, merges queued work back into pulled cloud books, and retries single-row flag upserts/deletes. Evidence: `app/phone/page.js:1668-1764`, `2209-2274`, `3037-3110`; `packages/cloud-sync/flag-queue.js:87-239`; `packages/cloud-sync/proof-sync.js:299-340`.
4. The repo test suite passed in this run. Evidence: `npm test -- --test-reporter=spec` exit `0`, 13 passing tests, no failing suite output.

## Fail Items

1. Phone Proof export still writes the quoted misread text under a `Note` header. `buildFlagsCsv()` emits `['...','Type','Note','Should Say']` but places `fl.sentPlain` in column seven and `fl.note` in column eight. Evidence: `app/phone/page.js:152-170`. This appears to be the same bug already logged as `SAS-AUD-20260602-004`.
2. Phone Script status docs still drift. `docs/WIRING_MATRIX.md` leaves the Phone Script rows as `MISSING`, while `docs/FRONT_FUNCTION_TREE.md` marks the same controls as `REAL` or `PARTIAL`, and the current source has live handlers for sign-in, project list, chapter open, audio pick/play, flag save/delete, and export. Evidence: `docs/WIRING_MATRIX.md:81-87`; `docs/FRONT_FUNCTION_TREE.md:88-95`; `app/phone/page.js:1481-1959`, `1997-2535`. This appears to stay under existing doc-drift item `SAS-AUD-20260602-001`.

## Watchlist Items

1. Successful empty cloud pulls appear unable to clear stale cached books. In `refresh()`, a successful `pullProofProjects()` result of `[]` falls through to `return current` whenever local state already contains cached books, so a user whose cloud library is now empty may keep seeing stale phone books until some other state change occurs. Evidence: `app/phone/page.js:1522-1550`, `1593-1599`; `app/phone/_lib/projectCache.js:34-68`. I did not live-reproduce this, so this stays a code-traced risk for checker follow-up.
2. The pending Proof flag queue count still looks global rather than user-scoped. The queue store key is shared (`stjohn-cloud-flag-queue-v1`), `countAllFlagQueues()` sums every bucket, and Phone Script shows that total directly in its pending banner. Evidence: `packages/cloud-sync/flag-queue.js:23-25`, `149-159`; `app/phone/page.js:1596-1598`, `1824-1829`, `1953`. This looks like the same watchlist already logged as `SAS-AUD-20260602-003`.
3. I found no direct automated coverage for Phone Script refresh-empty behavior, offline queue retry on account changes, or phone Proof export header alignment. The repo tests that passed in this run target cloud helpers, Prep export, Quill export, and Whisper parsing, but not a phone-specific Script flow.

## What Was Not Tested

- No live Supabase sign-in, sign-out, resend-confirmation, or account-swap session.
- No live phone browser run, touch interaction, or visual reader check.
- No live phone audio folder/file pick or playback check.
- No live offline/airplane-mode queue retry check.
- No live CSV or ZIP export opened after generation.
- No real manuscript, real audio, or real Save Data touched.

## Possible Duplicate Bug References

- `SAS-AUD-20260602-001` - app tree / wiring doc drift
- `SAS-AUD-20260602-003` - pending Proof flag queue count may not be user-scoped
- `SAS-AUD-20260602-004` - Proof export header mismatch
- No existing duplicate found yet for the stale-cache-on-empty-pull watchlist item

## Next Checks

1. Run a safe live phone Proof check for the empty-pull scenario: start with cached books, clear the cloud list, refresh, and confirm whether stale books remain visible.
2. Run a two-account phone check for the pending banner: create a queued flag in Account A, sign out, sign in as Account B, and confirm whether the banner carries over.
3. Open one real phone Proof export ZIP/CSV and confirm the visible header mismatch from `buildFlagsCsv()`.
4. Add focused automated coverage for phone Proof refresh-empty behavior, export header shape, and pending-queue/account-swap behavior.
