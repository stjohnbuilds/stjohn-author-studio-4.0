# Conflict Ledger - Zone 2 Desktop Shell And Settings

The three inspectors agreed that the shell exists and that shell docs are stale. The remaining differences were about whether specific static findings are already-confirmed bugs, intended partial scope, or risks that still need safe live proof.

## Conflict 1 - Are save-folder and broader shell settings wrongly restricted to Proof mode?

- Original Inspector A claim: shared shell settings are not actually shared; a user can reopen directly into Prep, Duet, or Quill and lose access to save location and broader shell controls until they know to switch back to Proof.
- Original Inspector B claim: the shell settings scope is intentionally partial; profile, tutorial, and Drive snapshots are shared, while broader controls are intentionally Proof-only and this matches `docs/FRONT_FUNCTION_TREE.md:27`.
- Original Inspector C claim: the save-folder control is effectively Proof-only, not a shared shell setting as the shell docs suggest.
- Evidence:
  - `app/page.js:1518-1651`
  - `app/page.js:1790-1978`
  - `app/components/PrepManuscriptMode.js:238`, `651`
  - `app/components/PrebuildMode.js:246`, `380`
  - `app/components/QuillAndInkMode.js:383`, `750`, `1027`
  - `docs/FRONT_FUNCTION_TREE.md:20-27`
- Checker follow-up audit: confirmed the broader settings block is intentionally behind `isProof`, but also confirmed Prep, Duet, and Quill still render the shared mode toggle, so users can switch back to Proof.
- Checker assessment: likely a UX/docs mismatch, not a confirmed hard lockout.
- Status: `likely`
- Next check needed: safe live Electron run to see whether real users are materially trapped or just routed through Proof for these controls.

## Conflict 2 - Does the global login gate break local-only Prep and Duet access?

- Original Inspector A claim: did not raise this as a separate issue.
- Original Inspector B claim: auth/session wiring is real and expected; did not classify the login gate as a failure.
- Original Inspector C claim: if Supabase config exists and no session is present, the shell returns `LoginScreen` before any mode renders, which blocks logged-out access to local-only Prep and Duet.
- Evidence:
  - `app/page.js:1498-1515`
  - `docs/APP_STRUCTURE.md:95-115`, `116-131`
  - `docs/BUILD_PLAN_V4.md:74-85`
- Checker follow-up audit: confirmed the login gate and the local-only plan wording, but did not find an explicit source statement that logged-out desktop access must remain available whenever Supabase config is present.
- Checker assessment: real product-intent tension, but not explicit enough to confirm from static evidence alone.
- Status: `audit unclear`
- Next check needed: safe live verification plus product-intent decision on whether local-only desktop modes should remain usable without sign-in.

## Conflict 3 - Does the daily backup code have a real day-rollover bug?

- Original Inspector A claim: the app mixes a UTC ref tag in `app/page.js` with local-day logic in `packages/backups/index.js`, which can skip a local calendar day.
- Original Inspector B claim: did not raise this item.
- Original Inspector C claim: did not raise this item.
- Evidence:
  - `app/page.js:719-727`
  - `packages/backups/index.js:27-33`
  - `packages/backups/index.js:63-70`
  - `packages/backups/index.js:119-134`
- Checker follow-up audit: confirmed the UTC/local mismatch is real in code, but also confirmed the in-memory ref resets on app relaunch, which narrows the likely impact.
- Checker assessment: plausible bug, not reproduced enough to confirm.
- Status: `audit unclear`
- Next check needed: controlled signed-in desktop test around local midnight or a forced auth/session refresh after local-day rollover.

## Conflict 4 - Shell doc drift scope

- Original Inspector A claim: did not elevate the shell docs as a separate bug from the broader doc-drift family.
- Original Inspector B claim: `docs/WIRING_MATRIX.md` and `READ ME FIRST - OPEN THIS.txt` both contain shell-specific stale wording that should be absorbed into the existing documentation-drift bug.
- Original Inspector C claim: `docs/WIRING_MATRIX.md` still conflicts with the current shell source and should not become a separate bug from the existing drift item.
- Evidence:
  - `docs/WIRING_MATRIX.md:28-30`
  - `READ ME FIRST - OPEN THIS.txt:1-55`
  - `main.js:10-15`
  - `main.js:139-143`
  - `preload.js:19-20`
- Checker follow-up audit: confirmed the stale shell wording and bridge naming.
- Checker assessment: shell doc drift is real and belongs under existing bug `SAS-AUD-20260602-001`.
- Status: `resolved`
- Next check needed: docs-only cleanup after the monitor pass.
