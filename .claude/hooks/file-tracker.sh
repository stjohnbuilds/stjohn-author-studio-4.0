#!/bin/bash
# Scope guard: refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0
# Hook 2 from Marie's setup bible: PostToolUse silent file tracker.
# After every Write/Edit, append the edited file + timestamp to the
# session edit log. Build/error checker reads this on Stop, then clears it.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/../edit-log.txt"

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | /usr/bin/env jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)

if [ -n "$FILE" ]; then
  printf '%s\t%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$FILE" >> "$LOG_FILE"
  bash "$SCRIPT_DIR/_log.sh" "file-tracker" "logged" "$FILE"
fi

# Silent: emit nothing visible.
printf '{"suppressOutput":true}'
