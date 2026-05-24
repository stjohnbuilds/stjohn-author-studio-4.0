#!/usr/bin/env bash
# Shared logger from Marie's bible Step 2.5.
# Every other hook calls this to write a one-line audit entry to
# .claude/hook-activity.log so Marie can verify hooks actually ran.
# Usage: bash _log.sh "<hook-name>" "<STATUS>" "<detail>"

# Scope guard: refuse to run if we're not in THIS project.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0

LOG_FILE="$EXPECTED_DIR/.claude/hook-activity.log"
MAX_LINES=1000

mkdir -p "$(dirname "$LOG_FILE")"
echo "$(date '+%Y-%m-%d %H:%M:%S')  [${1:-unknown}]  ${2:-ran}  ${3:-}" >> "$LOG_FILE"

# Keep only the most recent MAX_LINES so the file never grows unbounded.
if [ -f "$LOG_FILE" ]; then
  LINE_COUNT=$(wc -l < "$LOG_FILE" | tr -d ' ')
  if [ "$LINE_COUNT" -gt "$MAX_LINES" ]; then
    tail -n "$MAX_LINES" "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
  fi
fi
