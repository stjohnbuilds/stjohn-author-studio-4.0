#!/bin/bash
# Scope guard: refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0
# Hook 4 from Marie's setup bible: Stop-hook "No mess left behind" checklist.
# Prints a self-review checklist after every assistant response so Marie
# (and Claude) can sanity-check before moving on.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/_log.sh" "no-mess" "ran" "checklist printed"

# Active TODO-update check: count unique files in this session's
# edit-log; if >2 files were touched and TODO.md was NOT one of them,
# inject a louder warning. (Marie's session-end mess: AI does 30 edits,
# forgets to update TODO.md, next AI sees stale tasks.)
LOG_FILE="$SCRIPT_DIR/../edit-log.txt"
TODO_WARNING=""
if [ -f "$LOG_FILE" ] && [ -s "$LOG_FILE" ]; then
  TOTAL_FILES=$(awk -F'\t' '{print $2}' "$LOG_FILE" | sort -u | wc -l | tr -d ' ')
  TODO_TOUCHED=$(awk -F'\t' '{print $2}' "$LOG_FILE" | grep -c 'TODO\.md$' || true)
  if [ "$TOTAL_FILES" -gt 2 ] && [ "$TODO_TOUCHED" -eq 0 ]; then
    TODO_WARNING="\\n\\n⚠️  TODO.md WAS NOT UPDATED this session despite $TOTAL_FILES files being changed. Per Marie's rule (CLAUDE.md): every session that completes tasks MUST move them to ## Archived in TODO.md. Update TODO.md NOW before stopping."
  fi
fi

CHECKLIST="NO MESS LEFT BEHIND\\n"
CHECKLIST+="- Did I leave half-finished code or TODOs in the code?\\n"
CHECKLIST+="- Did I remove all debug / console.log statements?\\n"
CHECKLIST+="- Did I follow the plan, or go off on a tangent?\\n"
CHECKLIST+="- Did I create anything that already exists in this project?\\n"
CHECKLIST+="- Are there broken imports or missing files?\\n"
CHECKLIST+="- Did I update TODO.md if something was completed or added?${TODO_WARNING}"

printf '{"systemMessage":"%s"}' "$CHECKLIST"
