#!/bin/bash
# Scope guard: refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0
# Hook 3 from Marie's setup bible: Stop-hook build/error checker.
# Reads the per-session edit log, runs a fast syntax check (node --check)
# on each edited .js / .mjs / .cjs file, then clears the log.
#
# This project is Node.js (Electron desktop + Vercel phone). The bible's
# pattern is "Next.js / React -> npm run build". `npm test` runs the
# entire suite (slow). `node --check` is the closest fast syntax-only
# equivalent that catches the kind of breakage Marie cares about.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/../edit-log.txt"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ ! -f "$LOG_FILE" ] || [ ! -s "$LOG_FILE" ]; then
  printf '{"suppressOutput":true}'
  exit 0
fi

FILES=$(awk -F'\t' '{print $2}' "$LOG_FILE" | sort -u)
ERRORS=""
CHECKED=0

while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  # Only check Node source files that still exist.
  case "$FILE" in
    *.js|*.mjs|*.cjs)
      if [ -f "$FILE" ]; then
        CHECKED=$((CHECKED+1))
        if ! OUT=$(node --check "$FILE" 2>&1); then
          ERRORS+="\\n$FILE\\n$OUT\\n"
        fi
      fi
      ;;
  esac
done <<< "$FILES"

# Clear the log so the next turn starts fresh.
: > "$LOG_FILE"

if [ "$CHECKED" -eq 0 ]; then
  printf '{"suppressOutput":true}'
  exit 0
fi

if [ -n "$ERRORS" ]; then
  bash "$SCRIPT_DIR/_log.sh" "build-checker" "FAILED" "$CHECKED file(s) checked, syntax errors found"
  printf '{"systemMessage":"Build check FAILED on edited files:%s"}' "$ERRORS"
else
  bash "$SCRIPT_DIR/_log.sh" "build-checker" "PASSED" "$CHECKED file(s) checked"
  printf '{"systemMessage":"Build check passed (%d file(s) checked)."}' "$CHECKED"
fi
