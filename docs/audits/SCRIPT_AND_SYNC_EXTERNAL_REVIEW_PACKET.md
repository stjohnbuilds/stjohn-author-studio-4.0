# Script and Sync External Review Packet

Give this to a separate AI or senior reviewer after the full-app audit prompt
has been run. This is a scoring review, not a bug-fixing task.

## App To Review

```txt
/Users/mariemackay/Dev/StJohn-Author-Studio-4.0
```

Do not work in Typing and Tomes. That app was only a reference for audit style.

## Read First

```txt
HANDOFF.md
CLAUDE.md
TODO.md
READ ME FIRST - OPEN THIS.txt
docs/BUILD_PLAN_V4.md
docs/APP_STRUCTURE.md
docs/FRONT_FUNCTION_TREE.md
docs/INTERNAL_FUNCTION_TREE.md
docs/SHARED_COMPONENTS.md
docs/WIRING_MATRIX.md
docs/CLOUD_SCHEMA.md
docs/CLOUD_SAFETY_AUDIT.md
docs/audits/SCRIPT_AND_SYNC_FULL_APP_AUDIT_PROMPT.md
```

If a completed audit report exists, read the newest:

```txt
docs/audits/*script-sync-full-app-audit.md
```

## What To Score

Score each area from 0 to 100:

- Proof Listen reliability.
- Prep Manuscript reliability.
- Duet Prep reliability.
- Quill & Ink reliability.
- Phone companion reliability.
- Save/restart safety.
- Cloud/audio safety.
- Export/import integrity.
- Code structure health.
- Release/package readiness.
- Plan adherence.

Then give one overall answer:

```txt
Is this robust enough for Marie to trust with real work today?
```

Allowed answers:

- Yes.
- Yes, except for named limits.
- No, because of named blockers.
- Not enough evidence yet.

## Required Checks

Run or verify evidence for:

```bash
git status --short
npm test -- --test-reporter=spec
npm run build
```

Also verify:

- The release app lives in `Script and Sync Releases/`.
- No recommendation points Marie at `dist/`.
- Existing dirty files are not ignored.
- Source docs and audit report agree on what is verified live.
- Audio is not uploaded to Supabase.
- Prep and Duet stay local-only unless the source plan has changed.
- Phone can work without Mac local paths.

## Things To Inspect Closely

- Proof page numbers after PDF/DOCX page mapping.
- Proof flags after save, restart, cloud refresh, CSV export.
- Prep repeated dialogue and side-voice DOCX comments.
- Duet marker ordering and export contents.
- Quill annotation counts across UI, CSV, JSX, restart, and cloud pull.
- Phone offline flag queue and account switching.
- Drive snapshot ZIP contents and retention.
- Transfer bundle import/export with missing audio.
- Claims in `WIRING_MATRIX.md` that are not backed by real filenames/dates.

## Requested Output

Use this format:

```md
# EXTERNAL REVIEW - Script and Sync - <date>

## Plain-English Verdict

<One short paragraph for Marie.>

## Scores

| Area | Score | Why |
|---|---:|---|
| Proof Listen reliability | 0-100 | ... |
| Prep Manuscript reliability | 0-100 | ... |
| Duet Prep reliability | 0-100 | ... |
| Quill & Ink reliability | 0-100 | ... |
| Phone companion reliability | 0-100 | ... |
| Save/restart safety | 0-100 | ... |
| Cloud/audio safety | 0-100 | ... |
| Export/import integrity | 0-100 | ... |
| Code structure health | 0-100 | ... |
| Release/package readiness | 0-100 | ... |
| Plan adherence | 0-100 | ... |

## Top Blockers

1. <blocker>
2. <blocker>
3. <blocker>

## Evidence That Supports The Score

- <command, file, test, report, or real workflow>

## Evidence Still Missing

- <missing test or real file>

## Smallest Next Steps To Reach Trustworthy

1. <step>
2. <step>
3. <step>
```
