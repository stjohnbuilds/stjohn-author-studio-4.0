#!/usr/bin/env bash
# Handover trigger — Marie's "make a handover" protocol.
#
# When her prompt contains any handover trigger phrase, this hook
# injects a systemMessage instructing the model to produce a full
# 8-section handover note BEFORE doing anything else.
#
# Why: hand-offs between AI sessions keep losing critical Marie-
# context (she's non-coder, plain English, specific banned vocab,
# the live URL keeps going stale, etc.). The 8-section template
# guarantees the next AI gets bootstrapped properly.

# Scope guard — refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read the JSON payload Claude Code sends on UserPromptSubmit.
PAYLOAD=$(cat)
PROMPT=""
if command -v jq >/dev/null 2>&1; then
  PROMPT=$(echo "$PAYLOAD" | jq -r '.prompt // empty' 2>/dev/null)
fi
if [ -z "$PROMPT" ]; then
  PROMPT=$(echo "$PAYLOAD" | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1)
fi
if [ -z "$PROMPT" ]; then
  printf '{"suppressOutput":true}'
  exit 0
fi

# Trigger phrases (case-insensitive, single alternation):
#   make handover / make a handover
#   write the handover / update the handover
#   do a handover / give me a handover
#   trigger the handover hook / find the handover hook
#   build a handover / generate a handover
#   fresh handover / new handover
#   handoff note / handoff doc / handoff file
TRIGGER_RE='(make|write|update|do|build|generate)[[:space:]]+(a[[:space:]]+|the[[:space:]]+)?handover|give[[:space:]]+me[[:space:]]+(a[[:space:]]+|the[[:space:]]+)?handover|(trigger|find)[[:space:]]+the[[:space:]]+handover|(fresh|new)[[:space:]]+handover|handoff[[:space:]]+(note|doc|file)'

if ! echo "$PROMPT" | grep -iEq "$TRIGGER_RE"; then
  printf '{"suppressOutput":true}'
  exit 0
fi

# Log that the trigger fired.
bash "$SCRIPT_DIR/_log.sh" "handover-trigger" "FIRED" "8-section handover template injected"

# Inject the full 8-section template. The model MUST fill it in
# before doing anything else this turn.
cat <<'EOF'
{"systemMessage":"HANDOVER PROTOCOL (Marie's bootstrap doc, triggered).\n\nBEFORE anything else this turn, produce a COMPLETE handover note. All 8 sections below, in this exact order. Do not skip any.\n\nAt the very TOP put a COPY-PASTE block that Marie (or the next AI) can paste verbatim into a fresh chat to bootstrap context.\n\n1. WHO IS THE USER — Marie. Non-coder. Plain English, short sentences, no jargon. Banned coder vocabulary. Talk like she's 10.\n\n2. HARD RULES — bullet list of rules that have bitten before:\n   - No dual-write (one source of truth, never copy-paste).\n   - No self-certifying — battery-test before claiming done.\n   - Plain English only.\n   - 'Files I changed' footer is mandatory on every response that touches files.\n   - Always give clickable links where possible.\n   - Bottom toolbar is sacred — that's the audio dock, do not pile other stuff there.\n   - Double-confirm destructive actions.\n   - Never suggest stopping or pausing — keep going.\n   - Push is fine without asking.\n\n3. READ THESE FILES (IN ORDER) — exact paths of bootstrap docs the next AI must read first.\n\n4. BROAD VISION — 2-3 sentences on what the project is meant to be, why it matters, who it's for. THE DREAM.\n\n5. CURRENT STATE — % done, latest pushed commit SHA, test count, typecheck status, CORRECT live URL (warn about any stale URLs).\n\n6. TOP 5 NEXT JOBS — priority order, each with an effort tag: Easy / Marie / Design call / Big multi-week.\n\n7. WHAT ONLY MARIE CAN DO — migrations, hands-tests, design calls, push authorisation.\n\n8. WHERE THINGS LIVE — file map + the commands she actually uses (paste-ready).\n\nWrite the doc to HANDOFF.md at the project root (overwrite). Then summarise what changed since the previous handover in plain English for Marie."}
EOF
