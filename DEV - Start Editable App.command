#!/bin/bash

# Developer launcher for the editable app.
# Regular users should open Proofer 5.0.app instead.

# Go to the folder this script lives in (the project folder)
cd "$(dirname "$0")"

echo "──────────────────────────────────────"
echo "  Proofer 5.0 Developer Mode"
echo "──────────────────────────────────────"

# Check Node.js is installed
if ! command -v node &> /dev/null; then
  echo ""
  echo "❌  Node.js is not installed."
  echo ""
  echo "  Please go to https://nodejs.org and install the LTS version,"
  echo "  then double-click this file again."
  echo ""
  read -p "Press Enter to close..."
  exit 1
fi

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
  echo ""
  echo "📦  First time setup for developer mode — installing... (this takes ~1 minute)"
  echo ""
  npm install
  echo ""
  echo "✅  Done! Launching editable desktop app..."
else
  echo ""
  echo "✅  Launching editable desktop app..."
fi

echo ""
echo "Regular users should close this window and open Proofer 5.0.app."
echo ""

# Start the editable desktop app (Next.js + Electron)
npm start
