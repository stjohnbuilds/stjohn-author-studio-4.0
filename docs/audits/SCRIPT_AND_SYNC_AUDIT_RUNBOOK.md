# Script and Sync Audit Runbook

Purpose: keep the audit honest. A missing button, unclear screen, bad test
file, or tester confusion is not automatically a product bug.

Source goals checked before writing:

- `READ ME FIRST - OPEN THIS.txt`
- `docs/BUILD_PLAN_V4.md`
- `docs/APP_STRUCTURE.md`
- `docs/FRONT_FUNCTION_TREE.md`
- `docs/INTERNAL_FUNCTION_TREE.md`
- `docs/WIRING_MATRIX.md`
- `docs/CLOUD_SAFETY_AUDIT.md`

## Main Rule

Do not fix bugs during the audit. Document them with enough detail that the fix
can happen later without losing context.

## Finding Types

Use one of these labels for every issue.

| Type | Meaning |
|---|---|
| `confirmed-bug` | The expected behavior is clear, the tester found the real UI path, and the app failed. |
| `needs-navigation-proof` | The tester could not find the button/control/path yet. This is not a bug. |
| `needs-real-file` | Generated data cannot prove the workflow. Ask Marie for a real package. |
| `environment-blocked` | The audit could not continue because of login, permissions, missing model, missing app, network, or OS limits. |
| `doc-drift` | The docs and app disagree. This may or may not be a product bug. |
| `watchlist-risk` | Static code reading suggests a risk, but it has not been reproduced. |
| `fixed-archived` | The bug was fixed and verified later. Keep it at the bottom of the bug log. |

## Before Calling Something A Bug

All confirmed bugs need these five checks:

1. Source-goal check: cite the doc, UI label, or app behavior that says this
   feature should exist.
2. Navigation check: document exactly how the tester got to the control.
3. Retest check: try the same path twice, or explain why a second try was unsafe.
4. Evidence check: include screenshot path, exported file path, console/log
   excerpt, command output, or saved data path.
5. Fix handoff check: list likely files and the verification test needed after
   the fix.

If the tester cannot complete the navigation check, file it as
`needs-navigation-proof`, not `confirmed-bug`.

## Electron Safety Rule

Electron dev mode can write a mirror save to the user's Documents folder even
when the app is launched from a temp copy. Before any future Electron file,
save, export, or restart test:

1. Use a temp project copy.
2. Launch with an isolated `HOME` under `/tmp`.
3. Confirm the app's displayed save path is under the temp location.
4. Confirm `~/Documents/StJohn Author Studio/Save Data/` did not change after
   the test.

If those checks cannot be met, stop Electron testing and log
`environment-blocked`.

## Required Bug Entry Fields

Every bug or blocked item must include:

- ID
- Date found
- Type
- Status
- Severity
- Area
- User-facing title
- Plain-English summary
- Source goal or expected behavior
- Navigation path tried
- Exact test data used
- Expected result
- Actual result
- Evidence
- Why this is not tester confusion
- Likely files to inspect
- Suggested fix direction
- Verification needed after fix
- Archive notes once fixed

## Severity Rules

| Severity | Meaning |
|---|---|
| P0 | Can lose work, corrupt saved data, upload audio, block app launch, or block release. |
| P1 | Breaks a core workflow such as proofing, annotation, export, restart, cloud sync, or phone round-trip. |
| P2 | Feature works partly but has a clear user-facing failure or confusing recovery path. |
| P3 | Polish, wording, small layout, unclear but not blocking. |

## Fix Archive Rule

When a bug is fixed, do not delete it. Move it to the `Fixed / archived` section
of `SCRIPT_AND_SYNC_BUG_LOG.md` with:

- Fix date
- Files changed
- Tests run
- Manual verification done
- Anything still uncertain

## Audit Pace

Audit one workflow at a time. Finish the log entry for that workflow before
moving to the next one.

Recommended order:

1. Source docs and navigation map.
2. App launch and shell.
3. Proof Listen.
4. Prep Manuscript.
5. Duet Prep.
6. Quill & Ink.
7. Phone Script.
8. Phone Quill.
9. Cloud/audio safety.
10. Export/import safety.
11. Save/restart safety.
12. Release packaging.

At the start and end of each workflow, re-check the source goals and
`docs/APP_STRUCTURE.md`.
