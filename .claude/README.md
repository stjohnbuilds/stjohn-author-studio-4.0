# `.claude/` — Project Safety Net

This folder is the working seatbelt set up from Marie's Claude Code Setup Bible.
Every future Claude Code session in this project will automatically run the
hooks below. You do NOT need to set this up again per session.

## What's in here

- `settings.json` — wires the hooks to Claude Code's lifecycle.
- `hooks/context-check.sh` — UserPromptSubmit. Reminds Claude to read
  `CLAUDE.md`, check git, and review `TODO.md` before doing anything.
- `hooks/git-backup.sh` — PreToolUse on Write/Edit. Auto-commits any dirty
  changes as `auto-backup: before Claude edit <timestamp>` before Claude edits.
- `hooks/file-tracker.sh` — PostToolUse on Write/Edit. Silently logs every
  edited file to `.claude/edit-log.txt`.
- `hooks/build-checker.sh` — Stop hook. Runs `node --check` on every
  Node source file edited in this turn, then clears the log.
- `hooks/no-mess.sh` — Stop hook. Always prints the bible's
  "No mess left behind" checklist.
- `edit-log.txt` — per-session scratch file written by file-tracker and
  cleared by build-checker. Not committed (see `.gitignore`).

## Reusing on a new project

```
cp -r .claude /path/to/new-project/.claude
chmod +x /path/to/new-project/.claude/hooks/*.sh
```

Then run Steps 3 and 4 of the bible (create fresh `CLAUDE.md` and `TODO.md`).
