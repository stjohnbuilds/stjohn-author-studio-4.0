# `.claude/` — Project Safety Net

This folder is the working seatbelt set up from Marie's Claude Code Setup Bible.
Every future Claude Code session in this project will automatically run the
hooks below. You do NOT need to set this up again per session.

Hook activity is logged to `.claude/hook-activity.log` (gitignored). To
verify a hook actually ran: `cat .claude/hook-activity.log`.

## What's in here

- `settings.json` — wires the hooks to Claude Code's lifecycle.
- `hooks/_log.sh` — shared one-line audit logger. Every other hook calls
  it so Marie can `cat .claude/hook-activity.log` and see proof that
  hooks fired. Truncates the log at 1000 lines.
- `hooks/context-check.sh` — **UserPromptSubmit**. Reminds Claude to read
  `CLAUDE.md`, check git, review `TODO.md`, and lists the shared
  components it MUST import (vs. duplicate) before doing anything.
- `hooks/deep-check-trigger.sh` — **UserPromptSubmit**. Watches for
  Marie's battery-test phrases ("deep check", "scrub it", "trigger the
  hook", "really thorough", etc.) and injects the 7-step deep-check
  protocol so Claude can't self-certify without driving the live app.
- `hooks/handover-trigger.sh` — **UserPromptSubmit**. Watches for
  handover phrases ("make a handover", "write the handover", "handoff
  doc", etc.) and injects the 8-section handover template. Claude
  writes the result to `HANDOFF.md`.
- `hooks/ui-check-trigger.sh` — **UserPromptSubmit**. Watches for
  UI / visual / usability check phrases ("usability check", "interface
  check", "ui sweep", "walk the 24 points", "does this look right",
  etc.) and injects the project-neutral 12+12 checklist plus the
  "report each as ✓ pass / ⚠ minor / ❌ broken" reporting format so
  Claude can't self-certify the look + feel.
- `hooks/git-backup.sh` — **PreToolUse** on Write/Edit/NotebookEdit.
  Auto-commits any dirty working tree as
  `auto-backup: before Claude edit <timestamp>` before Claude edits, so
  Marie can always `git checkout` back to last-known-good.
- `hooks/file-tracker.sh` — **PostToolUse** on Write/Edit/NotebookEdit.
  Silently appends each edited file path to `.claude/edit-log.txt`.
- `hooks/no-mess.sh` — **Stop** (runs FIRST). Prints the bible's
  "No mess left behind" checklist. Reads the edit log to count files
  touched this session and warns LOUDLY if >2 files changed and
  `TODO.md` was not one of them. **Must run before `build-checker.sh`**
  because `build-checker.sh` clears the edit log.
- `hooks/build-checker.sh` — **Stop** (runs SECOND). Reads the edit
  log, runs `node --check` on each edited `.js`/`.mjs`/`.cjs`, runs
  shared-component duplication guards (project-specific —
  StJohn-only — see CLAUDE.md top section), then clears the log.
  Exit 2 on duplication block, exit 0 otherwise.
- `edit-log.txt` — per-session scratch file written by file-tracker,
  read by no-mess (counts files touched) and build-checker (which
  files to syntax-check), then cleared by build-checker. Gitignored.
- `hook-activity.log` — append-only audit trail of every hook
  invocation. Gitignored.
- `blocked-edits.log` — append-only log of every duplication block
  raised by build-checker. Gitignored.

## Stop-hook order matters

`settings.json` runs **`no-mess.sh` before `build-checker.sh`**.

If you swap them, the TODO-update warning will silently break:
`build-checker.sh` truncates `edit-log.txt` at the end of its run, so
`no-mess.sh` would see an empty log and conclude no files were edited.

## Reusing on a new project

```
cp -r .claude /path/to/new-project/.claude
chmod +x /path/to/new-project/.claude/hooks/*.sh
```

Then:
1. Update every `EXPECTED_DIR=...` line in every `.sh` file to point at
   the new project root (the scope-guard pattern from the bible).
2. Update the shared-components reminder in `context-check.sh` for the
   new project (or remove the StJohn-specific paragraph).
3. Update the shared-components duplication rules in `build-checker.sh`
   for the new project (or remove the StJohn-specific rules).
4. Run Steps 3 and 4 of the bible (create fresh `CLAUDE.md` + `TODO.md`).
