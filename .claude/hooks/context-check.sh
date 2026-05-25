#!/bin/bash
# Scope guard: refuse to run outside the 4.0 project root.
EXPECTED_DIR="/Users/mariemackay/Dev/StJohn-Author-Studio-4.0"
[ "${CLAUDE_PROJECT_DIR:-$(pwd)}" = "$EXPECTED_DIR" ] || exit 0
cd "$EXPECTED_DIR" || exit 0
# Hook 1 from Marie's setup bible: UserPromptSubmit context check.
# Runs before Claude reads each new user message. Reminds Claude to read
# the project map, check git, and review TODO.md before doing anything.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

bash "$SCRIPT_DIR/_log.sh" "context-check" "ran" "UserPromptSubmit reminders printed"

MSG=""

if [ -f "$PROJECT_ROOT/CLAUDE.md" ]; then
  MSG+="CONTEXT CHECK: Read CLAUDE.md before doing anything. Do NOT create new database tables, components, or data structures if one already exists for this purpose.\n"
else
  MSG+="CONTEXT CHECK: CLAUDE.md is missing in this project. Create or restore it before doing any architectural work.\n"
fi

MSG+="GIT STATUS: Check for uncommitted changes before editing.\n"
MSG+="SHARED COMPONENTS — there is ONE of each, do not write a new one: <BookDetail> (app/components/BookDetail.js), <ChapterReader>+renderChapterBody (app/components/ChapterReader.js), <AudioDock> (app/components/AudioDock.js), <ImportFlow> (app/components/ImportFlow.js), ReaderChrome exports incl. <HomeBackPill>/<ProfilePill>/MODE_TOKENS (app/components/ReaderChrome.js). The build-checker hook hard-blocks fresh function .*BookDetail/HomeView/ChapterRow/ReaderView/Setup/Panel/AudioDock/Picker in any mode file. See CLAUDE.md top section.\n"

if [ -f "$PROJECT_ROOT/TODO.md" ]; then
  MSG+="TODO CHECK: Review TODO.md. If this task relates to an existing item, work from that.\n"
fi

# Emit as additionalContext so it lands in the model's context for this turn.
printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}' "$MSG"
