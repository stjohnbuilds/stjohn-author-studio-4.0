#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const modePath = path.join(repoRoot, 'scripts', 'guardrails-mode.json');

const arg = String(process.argv[2] || '').trim().toLowerCase();
const mode = arg === 'sync' ? 'sync-only' : arg === 'normal' ? 'normal' : null;

if (!mode) {
  console.error('Usage: node scripts/set-guardrails-mode.js <normal|sync>');
  process.exit(1);
}

fs.writeFileSync(modePath, JSON.stringify({ mode }, null, 2) + '\n', 'utf8');
console.log(`Guardrails mode set to: ${mode}`);
