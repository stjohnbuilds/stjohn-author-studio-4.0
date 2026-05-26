#!/usr/bin/env bash
# UserPromptSubmit — Progress hook.
# Ported from Typing-and-Tomes-3.3-active/.claude/hooks/user-prompt-submit.sh
# (Part 2) on 2026-05-26. Counts checkboxes in TODO.md and prints overall
# progress so Marie sees how close the project is to done on every turn.

EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0

TODO_FILE="TODO.md"
if [ -f "$TODO_FILE" ]; then
  TOTAL=$(grep -cE "^- \[[ x]\]" "$TODO_FILE" 2>/dev/null || echo 0)
  DONE=$(grep -cE "^- \[x\]" "$TODO_FILE" 2>/dev/null || echo 0)
  if [ "$TOTAL" -gt 0 ]; then
    PCT=$(( DONE * 100 / TOTAL ))
    echo "📊 PROGRESS in TODO.md: $DONE / $TOTAL tasks done ($PCT%)"
    echo ""
    bash .claude/hooks/_log.sh "progress" "shown" "$DONE/$TOTAL ($PCT%) overall"
  fi
fi

exit 0
