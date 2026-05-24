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

# Duplication guard — Marie's #1 complaint is that mode files keep
# growing their OWN inline BookDetail / HomeView / ChapterRow / sticky
# bar instead of importing the shared components. Wall, not nudge:
# a mode file FAILS the check if it has any function named like a
# shared component AND doesn't import from the shared module.
#
# Wrappers are fine — a `function QuillBookDetail` that returns
# `<BookDetail .../>` passes because the file imports BookDetail.
#
# Prep is exempt: PrepManuscriptMode is intentionally separate
# (characters + dialogue, no audio — different feature surface).
# Remove it from EXEMPT_FILES when its book-detail is also unified.
NON_PREP_MODE_FILES='^(ProofingReader|PrebuildMode|SessionsView|QuillAndInkMode)\.js$'
EXEMPT_FILES='^(PrepManuscriptMode)\.js$'
DUP_FAILURES=""
while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  BASENAME=$(basename "$FILE")
  if echo "$BASENAME" | grep -Eq "$EXEMPT_FILES"; then continue; fi
  if echo "$BASENAME" | grep -Eq "$NON_PREP_MODE_FILES"; then
    if [ -f "$FILE" ]; then
      HAS_NAMED=$(grep -cE '(^|[[:space:]])function[[:space:]]+[A-Z][A-Za-z0-9_]*(BookDetail|HomeView|ChapterRow|StickyTopBar|ProjectList)[[:space:]]*\(' "$FILE" 2>/dev/null)
      HAS_BOOKDETAIL_IMPORT=$(grep -cE "from[[:space:]]+['\"]\\./BookDetail['\"]" "$FILE" 2>/dev/null)
      HAS_CHROME_IMPORT=$(grep -cE "from[[:space:]]+['\"]\\./ReaderChrome['\"]" "$FILE" 2>/dev/null)
      if [ "$HAS_NAMED" -gt 0 ] && [ "$HAS_BOOKDETAIL_IMPORT" -eq 0 ] && [ "$HAS_CHROME_IMPORT" -eq 0 ]; then
        DUP_FAILURES+="\\n  • $BASENAME defines inline component(s) but imports neither ./BookDetail nor ./ReaderChrome.\\n    Import the shared component instead of writing a fresh copy.\\n    See docs/SHARED_COMPONENTS.md for what's available."
      fi
    fi
  fi
done <<< "$FILES"

if [ -n "$ERRORS" ]; then
  bash "$SCRIPT_DIR/_log.sh" "build-checker" "FAILED" "$CHECKED file(s) checked, syntax errors found"
  printf '{"systemMessage":"Build check FAILED on edited files:%s"}' "$ERRORS"
elif [ -n "$DUP_FAILURES" ]; then
  bash "$SCRIPT_DIR/_log.sh" "build-checker" "BLOCKED" "inline-component duplication"
  # Record the blocked edit for Marie to inspect.
  echo "$(date '+%Y-%m-%d %H:%M:%S')  blocked: duplication$DUP_FAILURES" >> "$SCRIPT_DIR/../blocked-edits.log"
  printf '{"systemMessage":"BUILD-CHECKER BLOCK — shared-component duplication.%s\\n\\nFix the file to import the shared component (or use a wrapper that delegates to it). If this edit is part of a planned unification, update .claude/hooks/build-checker.sh to remove the file from the guard once the duplication is gone."}' "$DUP_FAILURES"
  exit 2
else
  bash "$SCRIPT_DIR/_log.sh" "build-checker" "PASSED" "$CHECKED file(s) checked"
  printf '{"systemMessage":"Build check passed (%d file(s) checked)."}' "$CHECKED"
fi
