#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = process.cwd();
const configPath = path.join(repoRoot, 'scripts', 'protected-paths.json');

function toRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function loadProtectedPatterns() {
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const json = JSON.parse(raw);
    return Array.isArray(json.protected) ? json.protected : [];
  } catch (err) {
    console.error('Guardrails: could not read scripts/protected-paths.json');
    console.error(err.message);
    process.exit(1);
  }
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (err) {
    console.error('Guardrails: failed to read staged files.');
    console.error(err.message);
    process.exit(1);
  }
}

function formatList(items) {
  return items.map((f) => `  - ${f}`).join('\n');
}

const patterns = loadProtectedPatterns();
if (!patterns.length) process.exit(0);

const regexes = patterns.map((p) => ({ pattern: p, regex: toRegex(p) }));
const staged = getStagedFiles();
const touched = staged.filter((file) => regexes.some(({ regex }) => regex.test(file)));

if (!touched.length) process.exit(0);

const allow = process.env.ALLOW_PROTECTED_CHANGES === '1';
const reason = (process.env.PROTECTED_CHANGE_REASON || '').trim();

if (allow && reason.length >= 8) {
  console.log('Guardrails override accepted.');
  console.log(`Reason: ${reason}`);
  console.log('Protected files touched:\n' + formatList(touched));
  process.exit(0);
}

console.error('\nGuardrails blocked this commit.');
console.error('You changed protected engine/design files:');
console.error(formatList(touched));
console.error('\nIf this is intentional, commit again with:');
console.error('ALLOW_PROTECTED_CHANGES=1 PROTECTED_CHANGE_REASON="why this is necessary" git commit ...');
console.error('\nTip: keep changes scoped to non-protected files unless behavior/design changes are intended.\n');
process.exit(1);
