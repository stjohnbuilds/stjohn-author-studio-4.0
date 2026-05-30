# Script and Sync Full-App Audit Plan

Source goals checked: `READ ME FIRST - OPEN THIS.txt`, `HANDOFF.md`,
`docs/BUILD_PLAN_V4.md`, `docs/FRONT_FUNCTION_TREE.md`,
`docs/INTERNAL_FUNCTION_TREE.md`, `docs/SHARED_COMPONENTS.md`,
`docs/WIRING_MATRIX.md`, `docs/CLOUD_SAFETY_AUDIT.md`.

## Goal

Create a serious AI audit plan for Script and Sync / StJohn Author Studio 4.0.
The plan should let a fresh AI crawl the app externally, test every visible
feature, use generated manuscripts/audio where safe, and produce a bug report
Marie can trust.

## Rules

- Do not work in Typing and Tomes. Use its audit docs as reference only.
- Do not touch Marie's real saved data except by making a backup/read-only
  inspection.
- Do not upload audio to Supabase.
- Do not mark a feature safe unless it was actually tested or traced.
- If generated test files cannot prove a workflow, ask Marie for a real
  manuscript/audio package.
- Before and after every step, re-check the source goals and structure docs.

## Steps

### 1. Re-check goals and structure

What to do:

- Read the source-goal docs and existing structure maps.
- Confirm generated folders, releases, and real Save Data are not mistaken for
  source code.

What to verify:

- The audit plan is grounded in the real app goals, not only chat context.

Before moving on:

- Re-check source goals and structure docs.

### 2. Create the app structure map

What to do:

- Create `docs/APP_STRUCTURE.md`.
- Summarize source areas, modes, data files, Electron bridge, and cloud tables.

What to verify:

- The map references the real files and excludes generated folders.

Before moving on:

- Re-check source goals and structure docs.

### 3. Build the full external audit prompt

What to do:

- Create a self-contained prompt for a fresh AI.
- Include source docs to read, test asset setup, every external workflow, save
  safety, cloud safety, export safety, phone checks, and output format.

What to verify:

- Every mode in `FRONT_FUNCTION_TREE.md` and `WIRING_MATRIX.md` is represented.
- The prompt tells the AI when generated assets are enough and when Marie's
  real files are needed.

Before moving on:

- Re-check source goals and structure docs.

### 4. Add an external review packet

What to do:

- Create a shorter scoring packet that asks a separate AI to judge whether the
  app is robust enough.

What to verify:

- The scoring packet covers data safety, feature coverage, exports, cloud,
  code health, release readiness, and plan adherence.

Before moving on:

- Re-check source goals and structure docs.

### 5. Verify the docs

What to do:

- Read back the new docs.
- Check git status.
- Do not run app tests because this task changes documentation only.

What to verify:

- New files are in the Script and Sync repo.
- `app/page.js` remains untouched by this plan.

Before closing:

- Ask Marie before archiving or closing this plan.

### 6. Begin the live bug ledger

What to do:

- Create an audit runbook.
- Create a live bug log with sections for confirmed bugs, navigation unknowns,
  real-file blockers, environment blockers, watchlist risks, and fixed/archive.
- Update the full-app audit prompt so hidden or unfound controls are logged as
  `needs-navigation-proof`, not bugs.

What to verify:

- The bug log has a template with reproduction steps, evidence, likely files,
  and verification needed after fix.
- No product code is changed.

Before moving on:

- Re-check source goals and structure docs.
