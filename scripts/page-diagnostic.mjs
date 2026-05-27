#!/usr/bin/env node
// Diagnostic: for each PDF page, show what printed-number was detected
// AND a snippet of the page's first/last line. So we can spot where
// the numbering starts and whether front matter is throwing things off.
//
// Usage: node scripts/page-diagnostic.mjs <pdf> [maxPages]

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const pdfPath = process.argv[2];
const maxPages = Number(process.argv[3]) || 15;
if (!pdfPath) { console.error('Usage: pull-page-text <pdf> [n]'); process.exit(1); }

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
try {
  const workerPath = require_.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();
} catch {}

function parseStandalone(t) {
  const raw = String(t || '').replace(/[\s\-–—]+/g, '').trim();
  if (!/^\d{1,5}$/.test(raw)) return null;
  return Number(raw) > 0 ? Number(raw) : null;
}

function detectPrinted(lines) {
  const bottomFirst = [...lines].sort((a, b) => a.y - b.y);
  const topFirst = [...lines].sort((a, b) => b.y - a.y);
  const candidates = [...bottomFirst.slice(0, 3), ...topFirst.slice(0, 2)];
  for (const line of candidates) {
    const value = parseStandalone(line.text);
    if (value != null) return { value, from: line };
  }
  return null;
}

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
console.log(`PDF: ${pdf.numPages} pages\n`);
const upTo = Math.min(maxPages, pdf.numPages);
for (let i = 1; i <= upTo; i++) {
  const page = await pdf.getPage(i);
  const tc = await page.getTextContent();
  const lines = [];
  for (const item of tc.items || []) {
    if (!item.str) continue;
    const y = item.transform?.[5] ?? 0;
    const x = item.transform?.[4] ?? 0;
    let line = lines.find((l) => Math.abs(l.y - y) < 2);
    if (!line) { line = { y, parts: [] }; lines.push(line); }
    line.parts.push({ x, text: item.str });
  }
  const sorted = lines
    .map((l) => ({ y: l.y, text: l.parts.sort((a, b) => a.x - b.x).map((p) => p.text).join('').trim() }))
    .filter((l) => l.text)
    .sort((a, b) => b.y - a.y); // top-first
  const printed = detectPrinted(sorted);
  const firstLine = sorted[0]?.text || '';
  const lastLine = sorted[sorted.length - 1]?.text || '';
  console.log(`PDF page ${String(i).padStart(3)} → printed# = ${printed ? printed.value : '(none)'}`);
  console.log(`              top:    "${firstLine.slice(0, 70)}"`);
  console.log(`              bottom: "${lastLine.slice(0, 70)}"`);
}
