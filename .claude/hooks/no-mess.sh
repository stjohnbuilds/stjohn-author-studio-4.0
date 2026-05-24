#!/bin/bash
# Scope guard: refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0
# Hook 4 from Marie's setup bible: Stop-hook "No mess left behind" checklist.
# Prints a self-review checklist after every assistant response so Marie
# (and Claude) can sanity-check before moving on.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/_log.sh" "no-mess" "ran" "checklist printed"

CHECKLIST="NO MESS LEFT BEHIND\\n"
CHECKLIST+="- Did I leave half-finished code or TODOs in the code?\\n"
CHECKLIST+="- Did I remove all debug / console.log statements?\\n"
CHECKLIST+="- Did I follow the plan, or go off on a tangent?\\n"
CHECKLIST+="- Did I create anything that already exists in this project?\\n"
CHECKLIST+="- Are there broken imports or missing files?\\n"
CHECKLIST+="- Did I update TODO.md if something was completed or added?"

printf '{"systemMessage":"%s"}' "$CHECKLIST"
