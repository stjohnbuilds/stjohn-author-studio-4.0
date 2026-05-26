#!/usr/bin/env bash
# UserPromptSubmit — Goodnight hook.
# Ported from Typing-and-Tomes-3.3-active/.claude/hooks/user-prompt-submit.sh
# (Part 7) on 2026-05-26. Marie 2026-05-26: "give me the goodnight hook
# from typing and tomes."
#
# When Marie says goodnight / bedtime / signing off, print the overnight
# polish checklist so any Claude session running overnight does ONE full
# visual hygiene pass across the whole app before stopping. Marie wants
# to wake up to an app that looks GOOD, not just functional.

EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0

PROMPT_JSON="$(cat 2>/dev/null || true)"
if command -v jq >/dev/null 2>&1; then
  USER_PROMPT="$(printf '%s' "$PROMPT_JSON" | jq -r '.prompt // empty' 2>/dev/null || true)"
else
  USER_PROMPT="$(printf '%s' "$PROMPT_JSON" | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1 || true)"
fi

if printf '%s' "$USER_PROMPT" | grep -qiE 'goodnight|good night|night night|nighty night|bedtime|going to bed|off to bed|im going to sleep|going to sleep|trigger.{0,30}goodnight|find.{0,30}goodnight|fire.{0,30}goodnight'; then
  echo ""
  echo "🌙 GOODNIGHT CHECK-IN — Marie is asleep, you are working overnight."
  echo ""
  echo "Before stopping for any overnight cycle, do ONE full polish pass"
  echo "across the whole app surface."
  echo ""
  echo "1) Gates first. Stop and document if any fail. Do not push."
  echo "   - node --check on every edited file (clean)"
  echo "   - npm test (all pass)"
  echo "   - npm run dev (Next builds without warnings)"
  echo ""
  echo "2) Open the app in preview and walk every visible surface."
  echo ""
  echo "3) For each surface ask: does it look modern, or does it look"
  echo "   like it's from the 2000s? Check:"
  echo "   - Are spacing and alignment crisp?"
  echo "   - Are paddings consistent across the page?"
  echo "   - Are there panels eating screen space for no reason?"
  echo "   - Are buttons and icons aligned to a real grid?"
  echo "   - Are colours, font weights, and corner radii consistent"
  echo "     with the rest of the app?"
  echo ""
  echo "4) If something looks outdated, frumpy, or wastes vertical"
  echo "   space, FIX it. Tighten paddings, lift redundant headers,"
  echo "   modernise spacing. No new logic — visual hygiene only."
  echo ""
  echo "5) Push when meaningful changes have landed. Report the SHA"
  echo "   in the morning summary."
  echo ""
  echo "Goal: Marie wakes up to an app that looks GOOD, not just"
  echo "functional."
  bash .claude/hooks/_log.sh "goodnight-trigger" "fired" "overnight visual hygiene checklist enforced"
fi

exit 0
