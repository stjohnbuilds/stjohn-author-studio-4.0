# Copilot Repo Guardrails

## Goal
Preserve stable engine behavior and design consistency unless a change is explicitly requested.

## Protected Areas
Do not modify these without explicit user intent in the current request:
- app/components/ProofingReader.js
- app/components/SessionsView.js
- app/components/ManuscriptSetup.js
- app/page.js
- app/layout.js
- app/globals.css
- main.js
- preload.js
- tailwind.config.js

## Required Behavior
Before touching any protected file:
1. State why the edit is required.
2. Confirm scope is minimal.
3. Prefer isolated feature flags over replacing existing logic.

If the request can be completed without touching protected files, do not touch them.

## UI Safety
Do not change typography, spacing, palette, or layout structure unless the user explicitly asks for visual redesign.

## Deployment — READ THIS
The user runs the app by double-clicking `Proofer 3.0.app` in Finder. NOT via terminal.
After ANY code change that needs to reach the user:
1. Run `npm run electron-build-mac`
2. Replace the old app: remove `Proofer 3.0.app` from project root, copy `dist/mac-arm64/Proofer 3.0.app` into project root.
3. Tell the user to open the app from Finder.

The `npm start` / `Start App.command` dev mode is ONLY for quick sandbox testing during development. The user does not use it for real work.
Never assume code changes are "live" without rebuilding the packaged app.
