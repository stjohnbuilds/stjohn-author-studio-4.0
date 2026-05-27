#!/usr/bin/env node
// Runs the SAME PDF-paging pipeline the app uses on a given PDF, then
// looks up each quote: which PDF page contains it, what's the printed
// page number on that page. Page numbers come from the printed footer
// detected on each PDF page (parseStandalonePageNumber +
// detectPrintedPageNumberFromLines — mirrored from main.js).

import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);

const pdfPath = process.argv[2];
const quotes = process.argv.slice(3);
if (!pdfPath || !quotes.length) {
  console.error('Usage: node scripts/pdf-quote-test.mjs <pdf-path> <quote1> [quote2 ...]');
  process.exit(1);
}

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
try {
  const workerPath = require_.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();
} catch {}

// ─── Mirror of main.js helpers ───────────────────────────────────────
function groupPdfTextItemsIntoLines(items) {
  const lines = [];
  for (const item of items || []) {
    if (!item || !item.str) continue;
    const y = item.transform?.[5] ?? 0;
    const x = item.transform?.[4] ?? 0;
    let line = lines.find((entry) => Math.abs(entry.y - y) < 2);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x, text: item.str });
  }
  return lines
    .map((line) => ({
      y: line.y,
      text: line.parts.sort((a, b) => a.x - b.x).map((p) => p.text).join(' ').replace(/\s+/g, ' ').trim(),
    }))
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
  const candidates = [
    ...bottomFirst.slice(0, 3),
    ...topFirst.slice(0, 2),
  ];
  for (const line of candidates) {
    const value = parseStandalonePageNumber(line.text);
    if (value != null) return value;
  }
  return null;
}

function normalizePdfSearchText(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Load + extract ───────────────────────────────────────────────────
const pdfData = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await pdfjs.getDocument({ data: pdfData, disableWorker: true }).promise;
console.log('PDF pages:', pdf.numPages);

const pages = [];
let printedCount = 0;
for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i);
  const tc = await page.getTextContent();
  const lines = groupPdfTextItemsIntoLines(tc.items || []);
  const fullText = lines.map(l => l.text).join('\n').replace(/\s+/g, ' ').trim();
  const printed = detectPrintedPageNumberFromLines(lines);
  if (printed != null) printedCount++;
  pages.push({ pageIndex: i, printed, normalized: normalizePdfSearchText(fullText) });
}
console.log('Printed-page-number detected on', printedCount, 'of', pdf.numPages, 'pages');
console.log('────────────────────────────────────────');

// ─── Look up each quote ──────────────────────────────────────────────
for (const q of quotes) {
  const needle = normalizePdfSearchText(q);
  const hit = pages.find(p => p.normalized.includes(needle));
  if (!hit) {
    console.log(`❌  "${q}"`);
    console.log(`    not found on any PDF page (normalized: "${needle}")`);
    continue;
  }
  const reported = hit.printed != null ? hit.printed : `(no printed#, PDF index ${hit.pageIndex})`;
  console.log(`✓  "${q}"`);
  console.log(`    PDF page ${hit.pageIndex} → printed page ${reported}`);
}
