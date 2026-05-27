#!/usr/bin/env node
// Dump a clean ~10-word phrase from each of the listed PDF pages,
// preserving original punctuation/quotes so Marie can Cmd+F it
// directly in her Word doc.
//
// Usage:
//   node scripts/pull-page-text.mjs <pdf-path> <page1> <page2> ...

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const pdfPath = process.argv[2];
const pages = process.argv.slice(3).map(Number).filter(Number.isFinite);
if (!pdfPath || !pages.length) {
  console.error('Usage: node scripts/pull-page-text.mjs <pdf> <page#> [page# ...]');
  process.exit(1);
}

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
try {
  const workerPath = require_.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();
} catch {}

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;

for (const pageNum of pages) {
  if (pageNum < 1 || pageNum > pdf.numPages) {
    console.log(`page ${pageNum}: out of range (PDF has ${pdf.numPages} pages)`);
    continue;
  }
  const page = await pdf.getPage(pageNum);
  const tc = await page.getTextContent();
  // Group items into lines by Y, then join across lines for paragraphs.
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
    .sort((a, b) => b.y - a.y)
    .map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.text).join(''));
  // Pick a middle-ish line that's not just a page number.
  const candidates = sorted.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^\d{1,4}$/.test(trimmed)) return false; // page number
    if (trimmed.length < 25) return false;        // too short
    return true;
  });
  const pick = candidates[Math.floor(candidates.length / 2)] || candidates[0] || '';
  // Take ~10 words for searchability
  const words = pick.trim().split(/\s+/).slice(0, 10).join(' ');
  console.log(`page ${pageNum}: "${words}"`);
}
