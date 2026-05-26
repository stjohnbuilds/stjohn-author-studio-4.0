#!/usr/bin/env node
// Post-build step that runs ONLY on Vercel.
// Overwrites out/index.html with the phone page so the root URL on
// Vercel serves the phone UI directly (no redirect, URL stays as /).
// Electron's `npm start` and packaged builds don't set the VERCEL env
// var, so this script no-ops there — Electron keeps the desktop UI at /.
//
// Why this exists: with output:'export' in next.config.js, Next.js
// pre-renders /  and /phone as separate static HTML files. Vercel's
// vercel.json rewrites get bypassed for the root because index.html
// is served as the default static asset. Swapping the file content
// at build time is the most direct fix.

const fs = require('node:fs');
const path = require('node:path');

if (process.env.VERCEL !== '1') {
  // Local / Electron build — leave the output untouched.
  process.exit(0);
}

const OUT_DIR = path.resolve(__dirname, '..', 'out');
const ROOT_HTML = path.join(OUT_DIR, 'index.html');

// Next.js app router with static export emits the phone page as either
// out/phone.html (no trailingSlash) or out/phone/index.html (with). We
// try both and use whichever exists.
const PHONE_CANDIDATES = [
  path.join(OUT_DIR, 'phone.html'),
  path.join(OUT_DIR, 'phone', 'index.html'),
];

const phoneSrc = PHONE_CANDIDATES.find((p) => fs.existsSync(p));
if (!phoneSrc) {
  console.error('[vercel-root-to-phone] No phone HTML found in', PHONE_CANDIDATES.join(' | '));
  process.exit(1);
}

if (!fs.existsSync(ROOT_HTML)) {
  console.error('[vercel-root-to-phone] No root index.html at', ROOT_HTML);
  process.exit(1);
}

fs.copyFileSync(phoneSrc, ROOT_HTML);
console.log(`[vercel-root-to-phone] Copied ${path.relative(OUT_DIR, phoneSrc)} → index.html`);
