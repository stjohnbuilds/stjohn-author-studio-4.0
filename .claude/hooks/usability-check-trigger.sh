#!/usr/bin/env bash
# UserPromptSubmit — Usability check hook (12-point user-journey).
# Ported from Typing-and-Tomes-3.3-active/.claude/hooks/user-prompt-submit.sh
# (Part 8) on 2026-05-26.
#
# When Marie says "usability check" / "user journey check" / "ux check",
# print the 12-point usability checklist. Forces the AI to actually walk
# the user's path through the feature, not just admire the code.

EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0

PROMPT_JSON="$(cat 2>/dev/null || true)"
if command -v jq >/dev/null 2>&1; then
  USER_PROMPT="$(printf '%s' "$PROMPT_JSON" | jq -r '.prompt // empty' 2>/dev/null || true)"
else
  USER_PROMPT="$(printf '%s' "$PROMPT_JSON" | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p' | head -1 || true)"
fi

if printf '%s' "$USER_PROMPT" | grep -qiE 'usability[ -]?check|user[ -]?journey[ -]?check|user[ -]?journey|ux[ -]?check|trigger.{0,30}usability|find.{0,30}usability|fire.{0,30}usability|do a usability|run.{0,15}usability'; then
  echo ""
  echo "🧭 USABILITY CHECK — walk the actual user journey before declaring done."
  echo ""
  echo "1) MAIN GOAL"
  echo "   - What is the user trying to do here?"
  echo "   - Can they complete that goal in a natural order?"
  echo "   - Are the steps clear from start to finish?"
  echo "   - Does the flow guide them, or does it rush/drop them?"
  echo ""
  echo "2) EXPECTED BEHAVIOUR"
  echo "   - Would a normal person get what they expect?"
  echo "   - Are button labels and next steps obvious?"
  echo "   - Anything surprising, hidden, or confusing?"
  echo "   - Does the user always know what just happened?"
  echo ""
  echo "3) CLOSE / ESCAPE"
  echo "   - If a popout opens, can it be closed easily at all times?"
  echo "   - Is there a clear X / close button, pinned even when scrolling?"
  echo "   - Can the user click outside to close?"
  echo "   - Does Escape close it where expected?"
  echo "   - If it should NOT close easily, is that because it's truly crucial?"
  echo ""
  echo "4) DATA SAFETY"
  echo "   - If the user clicks away, closes, refreshes, or goes back — what happens?"
  echo "   - Is their work saved, drafted, or lost?"
  echo "   - If data could be lost, does the app warn them first?"
  echo "   - If the right behaviour is unclear, STOP and ask Marie."
  echo ""
  echo "5) ACCIDENTAL ACTIONS"
  echo "   - Can the user accidentally delete / overwrite / submit / cancel something important?"
  echo "   - Do destructive actions need confirmation?"
  echo "   - Can the user undo or recover from mistakes?"
  echo "   - Are dangerous buttons visually different from normal ones?"
  echo ""
  echo "6) ERROR STATES"
  echo "   - What happens if something fails?"
  echo "   - Is the error plain English (no jargon)?"
  echo "   - Does it tell the user what to do next?"
  echo "   - Can they retry without starting over?"
  echo ""
  echo "7) EMPTY STATES"
  echo "   - What does this look like with no data yet?"
  echo "   - Is the first useful action obvious?"
  echo "   - Does it avoid feeling broken or blank?"
  echo ""
  echo "8) LOADING / WAITING"
  echo "   - If something takes time, does the user see progress?"
  echo "   - Spinner, disabled button, or clear waiting state?"
  echo "   - Can they tell whether the app is working or stuck?"
  echo "   - Can they accidentally click twice and cause duplicates?"
  echo ""
  echo "9) RETURNING LATER"
  echo "   - If the user leaves and comes back, is their place remembered where it should be?"
  echo "   - Are filters, drafts, tabs, or selections preserved if useful?"
  echo "   - If state resets, is that expected and harmless?"
  echo ""
  echo "10) KEYBOARD / BASIC ACCESS"
  echo "    - Can important actions be reached without awkward clicking?"
  echo "    - Does Enter submit only when it makes sense?"
  echo "    - Does Escape close popups where expected?"
  echo "    - Is focus placed somewhere sensible when a popup opens?"
  echo ""
  echo "11) MOBILE COMMON SENSE"
  echo "    - Would this flow still make sense on phone?"
  echo "    - Are buttons easy to tap?"
  echo "    - Are popups usable on a small screen?"
  echo "    - If not mobile-ready, is it built in a way that can adapt later?"
  echo ""
  echo "12) MATCH THE APP"
  echo "    - Does this behave like the rest of the app?"
  echo "    - Are buttons, labels, flows, and wording consistent?"
  echo "    - Does it feel like one app, not a bolted-on extra?"
  echo ""
  echo "Walk all twelve. Don't self-certify. Report findings honestly."
  bash .claude/hooks/_log.sh "usability-trigger" "fired" "12-point usability checklist enforced"
fi

exit 0
