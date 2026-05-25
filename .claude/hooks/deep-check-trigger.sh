#!/usr/bin/env bash
# Deep-check trigger — Marie's "battery test" protocol.
#
# When Marie's prompt contains any trigger phrase (deep check, scrub
# it, run the battery, trigger the hook, etc.) this hook prints the
# 7-step protocol back to the model so it CAN'T self-certify without
# actually running the battery against the live app.
#
# Background: AIs keep declaring "fixed" when bugs are still there.
# Pure unit tests miss React-state and browser-quirk bugs. The
# battery method drives real DOM events and verifies final state,
# which catches what unit tests miss.

# Scope guard — refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read the JSON payload that Claude Code sends on UserPromptSubmit.
# Prefer jq; fall back to a sed extractor if jq isn't installed.
PAYLOAD=$(cat)
PROMPT=""
if command -v jq >/dev/null 2>&1; then
  PROMPT=$(echo "$PAYLOAD" | jq -r '.prompt // empty' 2>/dev/null)
fi
if [ -z "$PROMPT" ]; then
  # Fallback: pull the "prompt" string out manually.
  PROMPT=$(echo "$PAYLOAD" | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1)
fi
if [ -z "$PROMPT" ]; then
  printf '{"suppressOutput":true}'
  exit 0
fi

# Match any of Marie's trigger phrases (case-insensitive). The regex
# is one alternation so a single grep handles them all.
TRIGGER_RE='deep[[:space:]]+(check|scrub|test)|battery[[:space:]]+(test|check)|verify[[:space:]]+everything|really[[:space:]]+(test[[:space:]]+this|thorough)|thoroughly[[:space:]]+(check|test)|thorough[[:space:]]+(check|test)|scrub[[:space:]]+it|trigger[[:space:]]+the[[:space:]]+(hook|check|test)|find[[:space:]]+the[[:space:]]+hook|do[[:space:]]+a[[:space:]]+proper[[:space:]]+(test|check)|test[[:space:]]+it[[:space:]]+properly|give[[:space:]]+it[[:space:]]+the[[:space:]]+works|run[[:space:]]+the[[:space:]]+(battery|deep|thorough)'

if ! echo "$PROMPT" | grep -iEq "$TRIGGER_RE"; then
  # No trigger phrase in the prompt — silent no-op.
  printf '{"suppressOutput":true}'
  exit 0
fi

# Log that the trigger fired so Marie can verify via hook-activity.log.
bash "$SCRIPT_DIR/_log.sh" "deep-check-trigger" "FIRED" "battery protocol injected"

# Echo the 7-step protocol back as a systemMessage so the model
# can't proceed without seeing it. Wrapped in JSON so Claude Code
# treats it as a system reminder.
cat <<'EOF'
{"systemMessage":"DEEP-CHECK PROTOCOL (Marie's battery test, triggered).\n\nDo NOT declare anything fixed until ALL 7 steps below are done. Self-certification without running the battery has burned Marie too many times.\n\n1. Boot the side preview (preview_start). Confirm the app loads with NO console errors (preview_console_logs level=error).\n2. Build SANDBOX tests — off-screen DOM elements or isolated harnesses. NEVER touch Marie's real data. Group as 'batteries' (one per behaviour type). For each test: run, capture a structured result, print pass/fail.\n3. Drive the LIVE UI end-to-end with REAL events at least once — mousemove, click, key, navigation — not just module function calls. Pure tests miss React-state and browser-quirk bugs.\n4. For any failing test: reproduce in a clean sandbox to isolate the cause, fix it, then re-run the ENTIRE battery to confirm the fix didn't break something else.\n5. Sweep the browser console for errors at the very end (preview_console_logs level=error).\n6. Clean up anything you touched in Marie's real data — restore paragraphs, undo test conversions, delete sandbox DOM nodes, etc.\n7. ONLY THEN report a confidence percentage AND a list of what is still uncertain. Name the limits honestly. Do not self-certify."}
EOF
