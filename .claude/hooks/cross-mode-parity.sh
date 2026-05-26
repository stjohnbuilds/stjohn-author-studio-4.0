#!/bin/bash
# Scope guard: refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0

# Cross-mode parity hook (Marie's request 2026-05-25).
#
# Reason: Quill, Proof, Duet, Prep all render the same shared components
# (SessionsView, ChapterReader, ImportFlow, AudioDock). The components
# work the same in every mode IF the mode file (a) doesn't pass empty
# stub handlers AND (b) actually handles every field the shared
# component forwards back through callbacks.
#
# CHECK 1 — Empty handler stubs:
#   onSomething={() => {}}
#   onSomething={()=>{}}
#   onSomething={() => { /* comment only */ }}
#   onSomething={() => null}
#   onSomething={() => undefined}
# These look like real wires but do nothing. Caught by regex.
# Deliberate stubs can be exempted with a "// intentional:" comment
# within 5 lines above the stub.
#
# CHECK 2 — Missing branches in selective handlers:
#   The shared book-page forwards a known set of fields through
#   onUpdateBook (title, narratorColors, chapters; and inside chapters
#   each section carries completed/audioFileName/audioPath/audioPaths).
#   When a mode's onUpdateBook is selective (handles some fields but
#   not others), it's easy to miss a branch — that's how the Quill
#   audio-path-doesn't-persist bug happened. This check warns when a
#   selective-handler mode file fails to mention a forwarded field by
#   name anywhere in the file.
#
# Both checks are SOFT WARNINGS — they don't block the edit. The model
# must either fix the issue or defend it with an intentional comment.

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

# Mode files with SELECTIVE onUpdateBook handlers (they branch on
# specific fields instead of passing the whole update through). These
# are the ones that can drop fields silently — Check 2 only runs on
# these. app/page.js is the Proof parent that owns the whole state via
# a shallow merge, so all fields are handled by default — exempt.
# Prep uses its own local BookDetailView (not the shared SessionsView),
# so the forwarded-field contract doesn't apply to it — also exempt.
SELECTIVE_HANDLER_MODE_FILES=(
  "app/components/PrebuildMode.js"
  "app/components/QuillAndInkMode.js"
)

# Fields the shared book-page forwards back through onUpdateBook.
# A selective handler MUST reference each of these somewhere in the
# file — either as a top-level branch (updated.title) or as a section
# property read (sec.audioFileName). If a field name doesn't appear in
# the mode file at all, the bridge is silently dropping it.
FORWARDED_FIELDS=(
  "title"
  "narratorColors"
  "chapters"
  "completed"
  "audioFileName"
  "audioPath"
  "audioPaths"
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

# ----------------------------------------------------------------------
# CHECK 1 — empty handler stubs
# ----------------------------------------------------------------------
STUB_RE='on[A-Z][a-zA-Z]+=\{\(\)[[:space:]]*=>[[:space:]]*(\{[[:space:]]*(/\*([^*]|\*[^/])*\*/[[:space:]]*)*\}|null|undefined)\}'

STUB_WARNINGS=""
STUB_TOTAL=0
for mf in "${MODE_FILES[@]}"; do
  [ -f "$mf" ] || continue
  hits=$(grep -nE "$STUB_RE" "$mf" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    file_warnings=""
    while IFS= read -r line; do
      # Skip stubs explicitly marked deliberate with "// intentional:"
      # in the line itself or within 5 lines above.
      lineno=$(echo "$line" | cut -d: -f1)
      start=$((lineno - 5))
      [ "$start" -lt 1 ] && start=1
      if echo "$line" | grep -qE 'intentional:' \
        || sed -n "${start},${lineno}p" "$mf" 2>/dev/null | grep -qE 'intentional:'; then
        continue
      fi
      file_warnings+="\n    $line"
      STUB_TOTAL=$((STUB_TOTAL + 1))
    done <<< "$hits"
    if [ -n "$file_warnings" ]; then
      STUB_WARNINGS+="\n  $mf:$file_warnings"
    fi
  fi
done

# ----------------------------------------------------------------------
# CHECK 2 — selective handlers missing branches for forwarded fields
# ----------------------------------------------------------------------
MISSING_WARNINGS=""
MISSING_TOTAL=0
for mf in "${SELECTIVE_HANDLER_MODE_FILES[@]}"; do
  [ -f "$mf" ] || continue
  file_missing=""
  for field in "${FORWARDED_FIELDS[@]}"; do
    # Field counts as referenced if the literal name appears anywhere
    # in the file as a property (foo.bar) or destructured key (bar)
    # surrounded by word boundaries. We strip strings/comments? No —
    # cheap version: just check the bare name appears with a word
    # boundary so it's not a substring match. Coarse but useful.
    if ! grep -qE "\b${field}\b" "$mf" 2>/dev/null; then
      file_missing+="\n      - $field"
      MISSING_TOTAL=$((MISSING_TOTAL + 1))
    fi
  done
  if [ -n "$file_missing" ]; then
    MISSING_WARNINGS+="\n  $mf — never references:$file_missing"
  fi
done

# ----------------------------------------------------------------------
# Output
# ----------------------------------------------------------------------
if [ "$STUB_TOTAL" -gt 0 ] || [ "$MISSING_TOTAL" -gt 0 ]; then
  detail="${STUB_TOTAL} stub(s), ${MISSING_TOTAL} missing field(s)"
  bash "$SCRIPT_DIR/_log.sh" "cross-mode-parity" "WARN" "$detail"
  echo "⚠ CROSS-MODE-PARITY WARNING"
  echo ""
  if [ "$STUB_TOTAL" -gt 0 ]; then
    echo "[Check 1] $STUB_TOTAL empty handler stub(s) detected."
    echo "When one mode wires a prop, the others usually should too — or the"
    echo "stub should be deliberate with a comment explaining why."
    echo ""
    echo "Stubs found:"
    printf '%b\n' "$STUB_WARNINGS"
    echo ""
  fi
  if [ "$MISSING_TOTAL" -gt 0 ]; then
    echo "[Check 2] $MISSING_TOTAL forwarded field(s) never referenced."
    echo "The shared book-page sends these fields through onUpdateBook."
    echo "If a mode's bridge doesn't read them, the value gets dropped:"
    printf '%b\n' "$MISSING_WARNINGS"
    echo ""
    echo "Fix: add a branch in the mode's onUpdateBook that reads the"
    echo "field and writes it onto the mode's own project shape."
  fi
  echo "Address each warning before saying 'done'. If a finding is a"
  echo "false positive, mark with a // intentional: comment + reason."
  printf '{"suppressOutput":false}'
else
  bash "$SCRIPT_DIR/_log.sh" "cross-mode-parity" "ran" "no stubs, no missing fields"
  printf '{"suppressOutput":true}'
fi
