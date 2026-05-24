#!/bin/bash
# Scope guard: refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0
# Hook 5 from Marie's setup bible: PreToolUse git safety auto-backup.
# Before any Write/Edit, if the working tree has uncommitted changes,
# commit them as an auto-backup. If the tree is clean, do nothing.
#
# This is Marie's seatbelt against losing in-progress work mid-session.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT" || { printf '{"suppressOutput":true}'; exit 0; }

# Bail out quietly if this isn't a git repo.
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  printf '{"suppressOutput":true}'
  exit 0
fi

# If there are no changes (staged or unstaged), nothing to back up.
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  printf '{"suppressOutput":true}'
  exit 0
fi

STAMP=$(date '+%Y-%m-%d %H:%M:%S')
git add -A >/dev/null 2>&1
if git commit -m "auto-backup: before Claude edit $STAMP" >/dev/null 2>&1; then
  bash "$SCRIPT_DIR/_log.sh" "git-backup" "BACKED UP" "auto-commit created at $STAMP"
else
  bash "$SCRIPT_DIR/_log.sh" "git-backup" "skipped" "commit failed or nothing to commit"
fi
printf '{"suppressOutput":true}'
