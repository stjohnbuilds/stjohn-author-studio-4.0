# Context — Phase 6 Prep Manuscript

## Files in play

| File | Role |
|---|---|
| `app/page.js` (`APP_MODES`) | Where the Prep mode tab is registered. Flip `enabled: true` when ready. |
| `app/prep-manuscript/page.js` | NEW — Prep Manuscript home + assignment list. |
| `packages/manuscript-engine/dialogue-detection/index.js` | NEW (port from 2.0). Pure function: text → dialogue spans. |
| `packages/manuscript-engine/dialogue-safety-check/index.js` | NEW (port from 2.0). Pure function: spans → safety warnings. |
| `packages/manuscript-engine/index.js` | NEW — re-export entrypoint. |
| `packages/exports/docx/` | NEW (port from 2.0). Builds highlighted Word doc. |
| `main.js` | Existing — `readManuscriptFile` IPC stays as is. Add `prep:export-docx` IPC in Pass 5. |
| `preload.js` | Existing — add `prepExportDocx` bridge method in Pass 5. |

## Decisions to confirm with Marie before Pass 4

- **Character color palette:** the 2.0 used hex like `#d8cfe7`. The
  4.0 pastel palette is `#E5DCEF / #DCEBE0 / #DCE6F0 / #F4DCE0`. Use
  shades of those for characters? Or per-character custom picker?
- **Side characters vs main characters:** the 2.0 had `mainCharacters`
  and `sideCharacters` arrays. Keep that distinction or merge?
- **Auto-narrator detection:** the 2.0 tried to auto-assign based on
  attribution ("she said", "Lucien replied"). Worth the complexity, or
  manual-only first cut?

## Constraints

- No fake `sampleProjects` data anywhere — Pass 2's empty state must
  say "Import a manuscript" and mean it.
- Audio is irrelevant to Prep. Don't add audio buttons.
- Reuse SaS 3.0's `writeData` for Save Data persistence; don't invent
  a new storage layer.
- Hooks must fire during dev (use `cd ~/Dev/StJohn-Author-Studio-4.0
  && claude` to start the Claude session inside this folder so 4.0
  hooks log entries).

## Helpful greps (once we're working in 4.0)

```
grep -n "readManuscriptFile" main.js preload.js
grep -n "ap-prebuild-projects" app/components/PrebuildMode.js
grep -n "writeData" main.js
```
