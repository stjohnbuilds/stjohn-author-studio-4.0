#!/bin/bash
# Scope guard: refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0

# Stop hook — block self-certifying assistant responses.
#
# CLAUDE.md golden rule: "Never self-certify gates as 90%+ — Marie
# reviews everything." For months Marie has been burned by responses
# that say "I'm 95% confident this works" without real evidence. This
# hook reads the most recent assistant transcript and either blocks
# (Tier A — auto-block, exit 1) or warns (Tier B — soft warn, exit 0).
#
# macOS gotchas: no `tac`, so we read forward and `tail -200`.
# Backtick-wrapped content (code blocks, inline code) is stripped first
# so meta-discussion about these rules doesn't false-positive on itself.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PAYLOAD="$(cat)"
TRANSCRIPT_PATH="$(printf '%s' "$PAYLOAD" | /usr/bin/env jq -r '.transcript_path // empty' 2>/dev/null)"
[ -z "$TRANSCRIPT_PATH" ] && { bash "$SCRIPT_DIR/_log.sh" "no-self-cert" "skipped" "no transcript path"; exit 0; }
[ -f "$TRANSCRIPT_PATH" ] || { bash "$SCRIPT_DIR/_log.sh" "no-self-cert" "skipped" "transcript missing"; exit 0; }

# Pull last 200 assistant text segments, flatten to a single line.
LAST="$(/usr/bin/env jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text' "$TRANSCRIPT_PATH" 2>/dev/null | tail -200 | tr '\n' ' ')"
[ -z "$LAST" ] && { bash "$SCRIPT_DIR/_log.sh" "no-self-cert" "skipped" "no assistant text"; exit 0; }

# Strip fenced code blocks and inline backticks so the model can
# discuss these rules in code samples without tripping itself.
STRIPPED="$(printf '%s' "$LAST" | perl -0777 -pe 's/```[\s\S]*?```//g; s/`[^`]*`//g')"
LOWER="$(printf '%s' "$STRIPPED" | tr '[:upper:]' '[:lower:]')"

# Tier A — hard block (exit 1). Self-certifying confidence numbers and
# explicit "self-certify" phrasing. One -e per regex (bash chokes on
# apostrophes in giant alternations).
TIER_A="$(printf '%s\n' "$LOWER" | grep -oE \
  -e '[0-9]{1,3}[[:space:]]*%[[:space:]]*(confidence|confident|sure|certain|passed|passing)' \
  -e 'confidence[[:space:]]+(level|score|rating|of)[[:space:]]+[0-9]+' \
  -e 'self[ -]certif(y|ied|ying|ication)' \
  -e 'trust[[:space:]]+me[[:space:]]+(it|this|that)[[:space:]]+(works|is fine)' \
  -e 'gate[[:space:]]+(at|is)[[:space:]]+[0-9]+[[:space:]]*%' \
  -e 'grade[[:space:]]+(myself|this)[[:space:]]+(at|as)' \
  | head -5)"

if [ -n "$TIER_A" ]; then
  bash "$SCRIPT_DIR/_log.sh" "no-self-cert" "BLOCKED" "tier A phrase(s) detected"
  echo "🛑 SELF-CERTIFYING DETECTED — response blocked."
  printf '%s\n' "$TIER_A" | sed 's/^/   • /'
  echo "Redo with real findings: what you checked, what passed, what"
  echo "failed, what's still uncertain. Let the user decide."
  exit 1
fi

# Tier B — soft warn (exit 0). Hand-wavy "should work" phrasing — Marie
# wants to see it surfaced but not blocked, because sometimes it's
# legitimate ("the existing logic should work, I didn't touch it").
TIER_B="$(printf '%s\n' "$LOWER" | grep -oE \
  -e 'should[[:space:]]+(just[[:space:]]+)?work' \
  -e 'looks[[:space:]]+good[[:space:]]+to[[:space:]]+me' \
  -e 'feels[[:space:]]+(good|fine|right|ok)' \
  -e 'probably[[:space:]]+(fine|works|good)' \
  | head -5)"
if [ -n "$TIER_B" ]; then
  bash "$SCRIPT_DIR/_log.sh" "no-self-cert" "WARN" "tier B phrase(s) detected"
  echo "⚠️  Soft self-cert phrasing detected (warning):"
  printf '%s\n' "$TIER_B" | sed 's/^/   • /'
fi

bash "$SCRIPT_DIR/_log.sh" "no-self-cert" "ran" "no Tier A matches"
exit 0
