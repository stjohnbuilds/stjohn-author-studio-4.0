#!/usr/bin/env bash
# UI / visual / usability-check trigger — Marie's 24-point walk.
#
# When her prompt contains any trigger phrase ("usability check",
# "interface check", "visual check", "UI check", "walk the 24 points",
# "look at the screen", "design check", etc.) this hook injects the
# 12+12 checklist and the reporting format so the model walks every
# point honestly and reports ✓ pass / ⚠ minor / ❌ broken.
#
# Like the other triggers (deep-check, handover), this exists because
# AIs keep self-certifying UI as "done" without doing the actual walk.
#
# The checklist is intentionally project-neutral so it can be copied
# to other projects unchanged. Project-specific components belong in
# context-check.sh / build-checker.sh, not here.

# Scope guard — refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read the JSON payload that Claude Code sends on UserPromptSubmit.
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

# Match any trigger phrase (case-insensitive). One alternation so a
# single grep handles them all.
TRIGGER_RE='(usability|interface|visual|design|ui|ux)[[:space:]]+(check|sweep|walk|pass|audit|review)|walk[[:space:]]+the[[:space:]]+(24|twenty.four)|24[-[:space:]]?point|twenty.four[-[:space:]]?point|does[[:space:]]+(this|it)[[:space:]]+look[[:space:]]+(right|good|nice|ok)|how[[:space:]]+does[[:space:]]+(this|it)[[:space:]]+look|is[[:space:]]+(this|it)[[:space:]]+pretty|look[[:space:]]+at[[:space:]]+the[[:space:]]+(screen|page|ui|interface|design)|tidy[[:space:]]+up[[:space:]]+the[[:space:]]+(screen|page|ui|interface|design)|polish[[:space:]]+(pass|check|sweep)'

if ! echo "$PROMPT" | grep -iEq "$TRIGGER_RE"; then
  printf '{"suppressOutput":true}'
  exit 0
fi

bash "$SCRIPT_DIR/_log.sh" "ui-check-trigger" "FIRED" "24-point checklist injected"

# Echo the 24-point checklist back as a systemMessage so the model
# can't proceed without walking every point. Project-neutral wording.
cat <<'EOF'
{"systemMessage":"USABILITY + INTERFACE CHECK (24 points, triggered).\n\nWalk EVERY numbered point on the feature you're working on right now. Report each as ✓ pass / ⚠ minor / ❌ broken with a short honest note. No self-certifying. If you cannot test a point (e.g. needs real auth), say so.\n\n🧭 USABILITY (12)\n1. MAIN GOAL — Can the user complete the goal in a natural order? Are steps clear from start to finish? Does the flow guide them or rush/drop them?\n2. EXPECTED BEHAVIOUR — Would a normal person get what they expect? Are button labels and next steps obvious? Anything surprising, hidden, or confusing?\n3. CLOSE / ESCAPE — Can popouts be closed easily? Clear × button, click-outside, Escape key? If they shouldn't close easily, is that because it's truly crucial?\n4. DATA SAFETY — If the user clicks away, closes, refreshes, or goes back — what happens? Is their work saved, drafted, or lost? Does the app warn first?\n5. ACCIDENTAL ACTIONS — Can they accidentally delete / overwrite / submit / cancel something important? Do destructive actions need confirmation? Can they undo?\n6. ERROR STATES — Plain English errors? Tells the user what to do next? Can they retry without starting over?\n7. EMPTY STATES — What does this look like with no data yet? Is the first useful action obvious? Does it avoid feeling broken?\n8. LOADING / WAITING — Spinner / disabled button / clear waiting state? Can the user tell if the app is working or stuck? Can they double-click and cause duplicates?\n9. RETURNING LATER — Is their place remembered? Are filters, drafts, tabs, or selections preserved? If state resets, is that expected and harmless?\n10. KEYBOARD / BASIC ACCESS — Can important actions be reached without awkward clicking? Enter submits when it makes sense? Escape closes popups? Focus placed sensibly when a popup opens?\n11. MOBILE COMMON SENSE — Would this flow still make sense on phone? Tappable buttons? Usable popups on small screens?\n12. MATCH THE APP — Does it behave like the rest of the app? Buttons, labels, flows, wording consistent? Feels like one app, not a bolted-on extra?\n\n🎨 INTERFACE (12)\n1. FIRST IMPRESSION — Clean, modern, calm? Is the purpose of the screen obvious at a glance?\n2. SPACE USE — Anything taking up twice the space it needs? Wasted panels / headers / empty areas?\n3. CRAMPED AREAS — Anything squeezed, overlapping, hard to scan? Buttons too close together? Text has breathing room?\n4. ALIGNMENT — Do buttons / labels / fields / panels line up cleanly? Consistent left edges, spacing, columns? Layout feels intentional?\n5. VISUAL PRIORITY — Most important thing easy to find? Primary actions stronger than secondary? Anything shouting that should be quiet, or too faint when it matters?\n6. TEXT AND LABELS — Short and clear? Text wraps nicely? Long titles / paragraphs don't break layout?\n7. LONG CONTENT — Long lists, long titles, 1 item vs 20 vs 100 — does scrolling feel natural?\n8. SMALL SCREENS — Anything overflows on phone / tablet? Buttons still tappable? Sticky headers / footers stealing too much space?\n9. CONTRAST / READABILITY — Text easy to read? Important buttons visible enough? Anything too pale, tiny, low-contrast?\n10. CONSISTENCY — Similar things look the same? Button styles consistent? Icons, colours, spacing, borders, corners consistent with the rest of the app?\n11. TOOLTIP AND LAYERING CHECK — If behaviour is not obvious, is there a small info hover or tooltip? Do tooltips appear above panels, menus, canvas areas, and other UI? Are tooltip boxes fully visible, not clipped or cut off? Do panels, popups, dropdowns, and menus stack in the correct order? Does anything disappear behind the canvas, sidebar, modal, or another panel?\n12. SCROLL BEHAVIOUR — Scrolling feels natural? Sticky elements useful or just taking space? User can still see what they need while scrolling? Anything jumps unexpectedly?\n13. TIREDNESS CHECK — Does the screen feel exhausting to look over? Too many boxes / borders / sections / competing elements? Could this be calmer with less decoration?\n\nAt the end, report a confidence percentage AND a list of what is still uncertain. Do not self-certify."}
EOF
