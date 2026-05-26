#!/bin/bash
# Scope guard: refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0

# Cross-mode parity hook (Marie's request 2026-05-25).
#
# Reason: Quill, Proof, Duet, Prep all render the same shared components
# (SessionsView, ChapterReader, ImportFlow, AudioDock). The components
# work the same in every mode IF the mode file passes a real handler to
# each callback prop. When a mode passes an EMPTY stub like
#   onToggleComplete={() => {}}
# the feature looks present but does nothing — which has burned Marie
# more than once (the chapter "done" tick, the bulk-audio attach, the
# Edit book data save). This hook scans all four mode files on every
# edit and warns if any of them carries an empty handler stub.
#
# What counts as a stub:
#   onSomething={() => {}}
#   onSomething={()=>{}}
#   onSomething={() => { /* comment only */ }}
#   onSomething={() => null}
#   onSomething={() => undefined}
#
# Behaviour: prints a warning to stdout (model sees it) and logs to
# .claude/hook-activity.log. Does NOT block the edit — soft warn only,
# because some empty stubs are deliberate (e.g. "Quill doesn't gate by
# completion" might be intentional). The model must then defend the
# stub OR fix it.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

INPUT=$(cat)
EDITED=$(printf '%s' "$INPUT" | /usr/bin/env jq -r '.tool_input.file_path // .tool_response.filePath // empty' 2>/dev/null)

# Mode entry files — the four places that compose the shared components.
MODE_FILES=(
  "app/page.js"
  "app/components/PrepManuscriptMode.js"
  "app/components/PrebuildMode.js"
  "app/components/QuillAndInkMode.js"
)

# Was the edited file one of the mode files?
IS_MODE=0
for mf in "${MODE_FILES[@]}"; do
  case "$EDITED" in
    *"$mf"|"$mf") IS_MODE=1; break ;;
  esac
done

if [ "$IS_MODE" -ne 1 ]; then
  bash "$SCRIPT_DIR/_log.sh" "cross-mode-parity" "skipped" "not a mode file"
  printf '{"suppressOutput":true}'
  exit 0
fi

# Stub regex — matches arrow-function handlers with an empty / no-op
# body. Tolerant of whitespace, comment-only bodies, and `=> null` /
# `=> undefined`.
STUB_RE='on[A-Z][a-zA-Z]+=\{\(\)[[:space:]]*=>[[:space:]]*(\{[[:space:]]*(/\*([^*]|\*[^/])*\*/[[:space:]]*)*\}|null|undefined)\}'

WARNINGS=""
TOTAL=0
for mf in "${MODE_FILES[@]}"; do
  [ -f "$mf" ] || continue
  # Use grep -nE so the model sees file:line for every stub.
  hits=$(grep -nE "$STUB_RE" "$mf" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    file_warnings=""
    while IFS= read -r line; do
      # Skip if the line itself OR the immediately preceding line is
      # tagged "// intentional:" (or "/* intentional:") — that's how
      # deliberate stubs are exempt from the warning. Forces a code
      # comment explaining WHY, not just a silent stub.
      lineno=$(echo "$line" | cut -d: -f1)
      prev=$((lineno - 1))
      if echo "$line" | grep -qE 'intentional:' \
        || sed -n "${prev}p" "$mf" 2>/dev/null | grep -qE 'intentional:'; then
        continue
      fi
      file_warnings+="\n    $line"
      TOTAL=$((TOTAL + 1))
    done <<< "$hits"
    if [ -n "$file_warnings" ]; then
      WARNINGS+="\n  $mf:$file_warnings"
    fi
  fi
done

if [ "$TOTAL" -gt 0 ]; then
  bash "$SCRIPT_DIR/_log.sh" "cross-mode-parity" "WARN" "$TOTAL empty handler stub(s) across modes"
  echo "⚠ CROSS-MODE-PARITY WARNING"
  echo ""
  echo "$TOTAL empty handler stub(s) detected across mode files."
  echo "When one mode wires a prop, the others usually should too — or the"
  echo "stub should be deliberate with a comment explaining why."
  echo ""
  echo "Stubs found:"
  printf '%b\n' "$WARNINGS"
  echo ""
  echo "Verify each stub is intentional. If a stub is a missed wire-up"
  echo "(like the onToggleComplete bug from 2026-05-25), fix it now."
  printf '{"suppressOutput":false}'
else
  bash "$SCRIPT_DIR/_log.sh" "cross-mode-parity" "ran" "no stubs in mode files"
  printf '{"suppressOutput":true}'
fi
