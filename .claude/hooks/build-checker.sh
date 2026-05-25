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
# bar instead of importing the shared components.
#
# Strategy: only block when the CURRENT edit *added* a new function
# whose name ends in BookDetail / HomeView / ChapterRow / StickyTopBar
# / ProjectList AND the file doesn't import ./BookDetail or
# ./ReaderChrome. This means:
#   ✓ Wrappers pass — `function QuillBookDetail` that returns
#     <BookDetail .../> is fine because the file imports BookDetail.
#   ✓ Existing pre-edit duplicates don't block unrelated edits — only
#     NEW additions are caught.
#   ✗ Adding a fresh inline `function ProofBookDetail` to ProofingReader
#     without importing the shared one HARD FAILS with exit 2.
#
# Prep is exempt: PrepManuscriptMode is intentionally separate
# (characters + dialogue, no audio). Remove from EXEMPT when its
# book-detail is also unified.
GUARDED_MODE_FILES='^(ProofingReader|PrebuildMode|SessionsView|QuillAndInkMode|PrepManuscriptMode|ManuscriptSetup)\.js$'
AUDIO_ALLOWED='^(AudioDock|ProofingReader)\.js$'
WORD_RENDER_ALLOWED='^(ChapterReader|ProofingReader)\.js$'
FILE_PICKER_ALLOWED='^(AudioDock|ImportFlow|ManuscriptSetup|SessionsView|QuillAndInkMode|BookDetail|PrebuildMode)\.js$'
DUP_NAME_RE='(BookDetail|HomeView|ChapterRow|ReaderView|BookSetup|Setup|Panel|AudioDock|Picker|StickyTopBar|ProjectList)'
DUP_FAILURES=""
while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  BASENAME=$(basename "$FILE")
  if [ ! -f "$FILE" ]; then continue; fi
  DIFF=$(git -C "$PROJECT_ROOT" diff HEAD -- "$FILE" 2>/dev/null)
  [ -z "$DIFF" ] && continue

  # Rule 1 — fresh component-shaped function in a mode file. No exemption.
  # The OLD hook let any wrapper pass if the file imported the shared
  # component. That loophole built QuillBookDetail. Closed.
  if echo "$BASENAME" | grep -Eq "$GUARDED_MODE_FILES"; then
    ADDED_DUPS=$(echo "$DIFF" | grep -E '^\+[[:space:]]*(export[[:space:]]+default[[:space:]]+)?function[[:space:]]+[A-Za-z0-9_]*'"$DUP_NAME_RE"'[[:space:]]*\(' || true)
    ADDED_READER=$(echo "$DIFF" | grep -E '^\+[[:space:]]*(export[[:space:]]+default[[:space:]]+)?function[[:space:]]+([A-Za-z0-9_]*Reader|renderChapter[A-Za-z0-9_]*|renderWord[A-Za-z0-9_]*)[[:space:]]*\(' || true)
    if [ -n "$ADDED_DUPS" ]; then
      DUP_FAILURES+="\\n  • $BASENAME added new component-shaped function(s):\\n$(echo "$ADDED_DUPS" | sed 's/^/      /')\\n    -> Render shared <BookDetail>/<ImportFlow>/<AudioDock> INLINE. Use props/slots for mode differences."
    fi
    if [ -n "$ADDED_READER" ]; then
      DUP_FAILURES+="\\n  • $BASENAME added new reader-shaped function(s):\\n$(echo "$ADDED_READER" | sed 's/^/      /')\\n    -> Render <ChapterReader> or call renderChapterBody from ChapterReader.js."
    fi
  fi

  # Rule 2 — new <audio> JSX outside AudioDock.
  if ! echo "$BASENAME" | grep -Eq "$AUDIO_ALLOWED"; then
    ADDED_AUDIO=$(echo "$DIFF" | grep -E '^\+[[:space:]]*<audio[[:space:]>]' || true)
    if [ -n "$ADDED_AUDIO" ]; then
      DUP_FAILURES+="\\n  • $BASENAME added new <audio> JSX:\\n$(echo "$ADDED_AUDIO" | sed 's/^/      /')\\n    -> Use <AudioDock> from app/components/AudioDock.js."
    fi
  fi

  # Rule 3 — new inline word rendering outside ChapterReader.
  if ! echo "$BASENAME" | grep -Eq "$WORD_RENDER_ALLOWED"; then
    ADDED_WORDS=$(echo "$DIFF" | grep -E '^\+.*(class=["'\''][^"'\'']*\bw\b|wrapWords[[:space:]]*\()' || true)
    if [ -n "$ADDED_WORDS" ]; then
      DUP_FAILURES+="\\n  • $BASENAME added new word renderer:\\n$(echo "$ADDED_WORDS" | sed 's/^/      /')\\n    -> Use renderChapterBody from ChapterReader.js."
    fi
  fi

  # Rule 4 — new audio file picker outside allowed components.
  if ! echo "$BASENAME" | grep -Eq "$FILE_PICKER_ALLOWED"; then
    ADDED_PICKER=$(echo "$DIFF" | grep -E '^\+.*<input[^>]+type=["'\'']file["'\''][^>]+accept=["'\''][^"'\'']*audio' || true)
    if [ -n "$ADDED_PICKER" ]; then
      DUP_FAILURES+="\\n  • $BASENAME added new audio file picker:\\n$(echo "$ADDED_PICKER" | sed 's/^/      /')\\n    -> File pickers live in AudioDock / ImportFlow / BookDetail / SessionsView."
    fi
  fi

  # Rule 5 — soft warn when a single edit balloons JSX in a mode file.
  if echo "$BASENAME" | grep -Eq "$GUARDED_MODE_FILES"; then
    JSX_LINES=$(echo "$DIFF" | grep -cE '^\+[[:space:]]*<[A-Za-z][A-Za-z0-9.]*' || true)
    if [ "$JSX_LINES" -gt 80 ]; then
      DUP_FAILURES+="\\n  • $BASENAME edit added $JSX_LINES JSX lines in one go.\\n    -> Big inline UI in a mode file is almost always a hidden duplicate. Check the shared component first."
    fi
  fi
done <<< "$FILES"

if [ -n "$ERRORS" ]; then
  bash "$SCRIPT_DIR/_log.sh" "build-checker" "FAILED" "$CHECKED file(s) checked, syntax errors found"
  printf '{"systemMessage":"Build check FAILED on edited files:%s"}' "$ERRORS"
elif [ -n "$DUP_FAILURES" ]; then
  bash "$SCRIPT_DIR/_log.sh" "build-checker" "BLOCKED" "inline-component duplication"
  # Record the blocked edit so Marie can inspect: cat .claude/blocked-edits.log
  echo "$(date '+%Y-%m-%d %H:%M:%S')  blocked: duplication$DUP_FAILURES" >> "$SCRIPT_DIR/../blocked-edits.log"
  printf '{"systemMessage":"BUILD-CHECKER BLOCK — shared-component duplication.%s\\n\\n    → Import from app/components/BookDetail.js (BookDetail, ChapterRow)\\n    → Or app/components/ReaderChrome.js (StickyTopBar, MODE_TOKENS, etc.)\\n    → See docs/SHARED_COMPONENTS.md for the full list and extension pattern (props / slots — never fork)."}' "$DUP_FAILURES"
  exit 2
else
  bash "$SCRIPT_DIR/_log.sh" "build-checker" "PASSED" "$CHECKED file(s) checked"
  printf '{"systemMessage":"Build check passed (%d file(s) checked)."}' "$CHECKED"
fi
