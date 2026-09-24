#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_NAME="StJohn Author Studio.app"
RELEASE_DIR="$ROOT/Script and Sync Releases"

APP_CANDIDATES=(
  "$RELEASE_DIR/$APP_NAME"
  "$ROOT/$APP_NAME"
)

for app_path in "${APP_CANDIDATES[@]}"; do
  if [ -d "$app_path" ]; then
    open "$app_path"
    exit 0
  fi
done

osascript <<'APPLESCRIPT' 2>/dev/null || true
display dialog "Mac app not found." & return & return & "If you are a regular user, open the Script and Sync Releases folder and look for StJohn Author Studio.app there." & return & return & "If you are rebuilding from source, use MAC - Build StJohn Author Studio.command." buttons {"OK"} default button "OK"
APPLESCRIPT

exit 1
