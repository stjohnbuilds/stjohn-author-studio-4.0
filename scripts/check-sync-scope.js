#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = process.cwd();
const modePath = path.join(repoRoot, 'scripts', 'guardrails-mode.json');
const allowPath = path.join(repoRoot, 'scripts', 'sync-allowed-paths.json');

function toRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getStagedFiles() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatList(items) {
  return items.map((f) => `  - ${f}`).join('\n');
}

const modeJson = readJson(modePath, { mode: 'normal' });
if (modeJson.mode !== 'sync-only') process.exit(0);

const allowJson = readJson(allowPath, { allowed: [] });
const patterns = Array.isArray(allowJson.allowed) ? allowJson.allowed : [];
if (!patterns.length) {
  console.error('Guardrails: sync-only mode is on but no allowed paths are configured.');
  process.exit(1);
}

const allowRegexes = patterns.map((p) => toRegex(p));
const staged = getStagedFiles();
const disallowed = staged.filter((file) => !allowRegexes.some((rx) => rx.test(file)));
if (!disallowed.length) process.exit(0);

const allowOverride = process.env.ALLOW_SYNC_SCOPE_OVERRIDE === '1';
const reason = (process.env.SYNC_SCOPE_REASON || '').trim();

if (allowOverride && reason.length >= 8) {
  console.log('Sync scope override accepted.');
  console.log(`Reason: ${reason}`);
  console.log('Out-of-scope files touched:\n' + formatList(disallowed));
  process.exit(0);
}

console.error('\nGuardrails blocked this commit (sync-only mode).');
console.error('These staged files are outside sync scope:');
console.error(formatList(disallowed));
console.error('\nEither:');
console.error('1) Move changes out of this commit, or');
console.error('2) Override intentionally:');
console.error('ALLOW_SYNC_SCOPE_OVERRIDE=1 SYNC_SCOPE_REASON="why this is necessary" git commit ...');
console.error('\nTo exit sync-only mode: npm run guardrails:sync:off\n');
process.exit(1);
