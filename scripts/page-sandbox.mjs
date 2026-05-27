#!/usr/bin/env node
// Page-number sandbox — runs the SAME docx → PDF → page-map pipeline
// the desktop app uses (LibreOffice headless → pdf.js → footer page-
// number detection), then accepts quote lookups so Marie can compare
// what the app would say vs the printed book.
//
// Marie 2026-05-26: replaces the old direct-docx-XML version, which
// only saw manual page breaks and gave wildly wrong numbers when the
// docx came out of Google Docs (no rendered page-break markers).
//
// Usage:
//   node scripts/page-sandbox.mjs "/path/to/manuscript.docx" "exact quote"
//   node scripts/page-sandbox.mjs "/path/to/manuscript.docx"   (interactive)
//
// Requires: LibreOffice installed at /Applications/LibreOffice.app

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const require_ = createRequire(import.meta.url);

// Accept either a .docx (auto-convert via LibreOffice) OR a .pdf
// (use as-is). The third argument onwards is the quote.
const inputPath = process.argv[2];
const quoteArg = process.argv.slice(3).join(' ').trim();

if (!inputPath) {
  console.error('Usage:');
  console.error('  node scripts/page-sandbox.mjs <docx-or-pdf-path> [quote]');
  console.error('');
  console.error('  docx → LibreOffice auto-converts → page lookup');
  console.error('  pdf  → used directly → page lookup (most accurate)');
  process.exit(1);
}
if (!fs.existsSync(inputPath)) {
  console.error('File not found:', inputPath);
  process.exit(1);
}

const isDirectPdf = /\.pdf$/i.test(inputPath);

// ────────────────────────────────────────────────────────────────────
// 1. Get the PDF — either use the supplied .pdf directly, or convert
//    .docx → PDF via LibreOffice (same binary the app uses).
// ────────────────────────────────────────────────────────────────────
function findSofficeBinary() {
  const candidates = [
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/local/bin/soffice',
    '/opt/homebrew/bin/soffice',
    '/usr/bin/soffice',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

let pdfPath;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'page-sandbox-'));
const inputName = path.basename(inputPath);

if (isDirectPdf) {
  pdfPath = inputPath;
  console.log(`Using PDF directly: ${inputName}`);
} else {
  const soffice = findSofficeBinary();
  if (!soffice) {
    console.error('LibreOffice not found. Install it from https://www.libreoffice.org/ and re-run.');
    process.exit(2);
  }
  const safeDocxName = inputName.replace(/[^a-z0-9._ -]/gi, '_');
  const localDocx = path.join(tmpDir, safeDocxName);
  fs.copyFileSync(inputPath, localDocx);

  console.log('Converting to PDF via LibreOffice…');
  const t0 = Date.now();
  await execFileAsync(soffice, [
    '--headless', '--convert-to', 'pdf', '--outdir', tmpDir, localDocx,
  ], { timeout: 180000, windowsHide: true });
  pdfPath = path.join(tmpDir, safeDocxName.replace(/\.docx$/i, '.pdf'));
  if (!fs.existsSync(pdfPath)) {
    console.error('LibreOffice did not produce a PDF at', pdfPath);
    process.exit(3);
  }
  console.log(`PDF generated in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${pdfPath}`);
}

// ────────────────────────────────────────────────────────────────────
// 2. Extract per-page text and detect printed page numbers
//    (Mirror of main.js extractPdfPagingFromBuffer + helpers)
// ────────────────────────────────────────────────────────────────────
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
try {
  const workerPath = require_.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();
} catch {}

function groupPdfTextItemsIntoLines(items) {
  const lines = [];
  for (const item of items || []) {
    if (!item || !item.str) continue;
    const y = item.transform?.[5] ?? 0;
    const x = item.transform?.[4] ?? 0;
    let line = lines.find((entry) => Math.abs(entry.y - y) < 2);
    if (!line) { line = { y, parts: [] }; lines.push(line); }
    line.parts.push({ x, text: item.str });
  }
  return lines
    .map((line) => ({ y: line.y, text: line.parts.sort((a, b) => a.x - b.x).map((p) => p.text).join(' ').replace(/\s+/g, ' ').trim() }))
    .filter((line) => line.text);
}

function parseStandalonePageNumber(text) {
  const raw = String(text || '').replace(/[\s\-–—]+/g, '').trim();
  if (!/^\d{1,5}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function detectPrintedPageNumberFromLines(lines) {
  const bottomFirst = [...lines].sort((a, b) => a.y - b.y);
  const topFirst = [...lines].sort((a, b) => b.y - a.y);
  const candidates = [...bottomFirst.slice(0, 3), ...topFirst.slice(0, 2)];
  for (const line of candidates) {
    const value = parseStandalonePageNumber(line.text);
    if (value != null) return value;
  }
  return null;
}

function normalizePdfSearchText(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const pdfData = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await pdfjs.getDocument({ data: pdfData, disableWorker: true }).promise;

const pages = [];
let printedCount = 0;
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const tc = await page.getTextContent();
  const lines = groupPdfTextItemsIntoLines(tc.items || []);
  const fullText = lines.map((l) => l.text).join('\n').replace(/\s+/g, ' ').trim();
  const printed = detectPrintedPageNumberFromLines(lines);
  if (printed != null) printedCount++;
  pages.push({ pageIndex: i, printed, normalized: normalizePdfSearchText(fullText) });
}

console.log('────────────────────────────────────────────────────────');
console.log(' File:        ', inputName);
console.log(' PDF pages:   ', pdf.numPages);
console.log(' Printed#:    ', `${printedCount} of ${pdf.numPages} pages had a footer/header page number`);
console.log('────────────────────────────────────────────────────────');

// ────────────────────────────────────────────────────────────────────
// 3. Look up a quote — return the printed page number from its PDF page
// ────────────────────────────────────────────────────────────────────
function lookupQuote(quote) {
  const clean = String(quote || '').trim();
  if (!clean) return;
  const needle = normalizePdfSearchText(clean);
  const hit = pages.find((p) => p.normalized.includes(needle));
  if (!hit) {
    console.log(`❌  Quote not found in PDF: "${clean.slice(0, 80)}${clean.length > 80 ? '…' : ''}"`);
    return;
  }
  const reported = hit.printed != null ? hit.printed : `(no printed#, PDF index ${hit.pageIndex})`;
  console.log(`✓  "${clean}"`);
  console.log(`   PDF page ${hit.pageIndex}  →  Printed page ${reported}`);
}

if (quoteArg) {
  lookupQuote(quoteArg);
  process.exit(0);
}

console.log('Paste a quote and press Enter. Ctrl-C to quit.');
console.log('');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => lookupQuote(line));
