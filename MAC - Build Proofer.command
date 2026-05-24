#!/usr/bin/env bash
# Build a fresh Mac app from source.
# Regular users should open Script and Sync.app instead.
#
# First run on macOS: right-click -> Open.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

log() { printf '%s\n' "$*" ; }

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  osascript <<'APPLESCRIPT' 2>/dev/null || true
display dialog "This build tool needs Node.js (one-time install)." & return & return & "Regular users should not need this. Click OK to open the download page if you are rebuilding the app." buttons {"Cancel", "OK"} default button "OK"
APPLESCRIPT
  open "https://nodejs.org/en/download/" 2>/dev/null || true
  exit 1
fi

log "Developer build tool"
log "Regular users should open Script and Sync Releases/Script and Sync.app instead."
log ""
log "Installing npm packages (may take a minute)..."
npm install

chmod +x "$ROOT"/bin/whisper-cli-* 2>/dev/null || true

log "Close any already-open Script and Sync windows before the build finishes replacing the app."
log "Building Script and Sync for Mac — Terminal will stay open until this finishes (often several minutes)..."
log "This will replace the release copy inside Script and Sync Releases with a fresh build."
npm run release:mac

log "Cleaning temporary build folders..."
rm -rf "$ROOT/dist" "$ROOT/.next" "$ROOT/out"

log "Done. Your Mac app is in Script and Sync Releases/Script and Sync.app."
log "Important: always open the rebuilt release copy there."
open "$ROOT/Script and Sync Releases/Script and Sync.app" 2>/dev/null || true

osascript <<'APPLESCRIPT' 2>/dev/null || true
display dialog "Build finished." & return & return & "Open Script and Sync Releases/Script and Sync.app." & return & return & "That is the app regular users should use." buttons {"OK"} default button "OK"
APPLESCRIPT
