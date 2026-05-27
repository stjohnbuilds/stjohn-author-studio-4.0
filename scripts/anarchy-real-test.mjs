// Real Anarchy test:
//   1) Use the ACTUAL PDF Marie uploads → extract pages → build slim map → look up known quotes
//   2) Use ONLY the docx → run LibreOffice → extract pages → build slim map → look up same quotes
//   3) Compare both paths
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import {
  buildSlimPageMap,
  pageForWordIndexFromSlimMap,
  extractManuscriptWordsFromHtml,
} from '/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/app/lib/pdfPaging.js';

const execFileAsync = promisify(execFile);
const require_ = createRequire(import.meta.url);

const DOCX = '/Users/mariemackay/Downloads/Anarchy Manuscript for Audiobook (4).docx';
const PDF  = '/Users/mariemackay/Downloads/Anarchy Manuscript for Audiobook (1).pdf';

// ────────────────────────────────────────────────────────────────────
// 1. Read manuscript HTML via mammoth (same as the app does)
// ────────────────────────────────────────────────────────────────────
const mammoth = require_('/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/node_modules/mammoth/lib/index.js');
const docxBuf = fs.readFileSync(DOCX);
const mammothResult = await mammoth.convertToHtml({ buffer: docxBuf });
const html = mammothResult.value;
const manuscriptWords = extractManuscriptWordsFromHtml(html);
console.log(`Manuscript: ${manuscriptWords.length} words extracted from .docx`);

// ────────────────────────────────────────────────────────────────────
// 2. Helper — extract pdf pages with printed-footer detection
// ────────────────────────────────────────────────────────────────────
const pdfjs = await import('/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/node_modules/pdfjs-dist/legacy/build/pdf.mjs');

function parsePrinted(text) {
  const raw = String(text || '').replace(/[\s\-–—]+/g, '').trim();
  if (!/^\d{1,4}$/.test(raw)) return null;
  const n = Number(raw);
  return n > 0 ? n : null;
}

function groupLines(items) {
  const sorted = items
    .filter(i => String(i?.str || '').trim())
    .map(i => ({ str: i.str, x: Number(i.transform?.[4])||0, y: Number(i.transform?.[5])||0 }))
    .sort((a,b) => { const dy = b.y - a.y; if (Math.abs(dy) > 2.5) return dy; return a.x - b.x; });
  const lines = [];
  for (const it of sorted) {
    const p = lines[lines.length-1];
    if (!p || Math.abs(p.y - it.y) > 2.5) { lines.push({ y: it.y, items: [it] }); continue; }
    p.items.push(it);
  }
  return lines.map(l => ({ y: l.y, text: l.items.slice().sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim() })).filter(l => l.text);
}

function detectPrintedFromLines(lines) {
  const bottomFirst = [...lines].sort((a,b)=>a.y-b.y);
  const topFirst = [...lines].sort((a,b)=>b.y-a.y);
  const candidates = [...bottomFirst.slice(0,3), ...topFirst.slice(0,2)];
  for (const l of candidates) { const n = parsePrinted(l.text); if (n != null) return n; }
  return null;
}

function normalizeText(s) {
  return String(s||'').toLowerCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').replace(/[^a-z0-9 ]+/g,' ').trim();
}

async function extractPdfPages(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const lines = groupLines(tc.items || []);
    const fullText = lines.map(l => l.text).join('\n').replace(/\s+/g,' ').trim();
    const printed = detectPrintedFromLines(lines);
    pages.push({
      pageIndex: i,
      pageNumber: printed != null ? printed : i,
      pageNumberSource: printed != null ? 'printed' : 'index',
      normalizedText: normalizeText(fullText),
    });
  }
  pdf.cleanup?.();
  return pages;
}

// ────────────────────────────────────────────────────────────────────
// 3. PATH A: Real PDF Marie uploads
// ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════');
console.log('  PATH A — Marie\'s real Anarchy PDF');
console.log('══════════════════════════════════════════════════════════');
console.log(`Reading PDF: ${path.basename(PDF)}`);
const pdfPagesA = await extractPdfPages(PDF);
console.log(`  PDF pages: ${pdfPagesA.length}`);
const printedDetectedA = pdfPagesA.filter(p => p.pageNumberSource === 'printed').length;
console.log(`  Pages with detected printed footer: ${printedDetectedA}/${pdfPagesA.length}`);
const slimMapA = buildSlimPageMap(pdfPagesA, manuscriptWords);
console.log(`  Slim map anchors built: ${slimMapA.length}`);
console.log(`  First 5 anchors: ${JSON.stringify(slimMapA.slice(0,5))}`);
console.log(`  Last 3 anchors: ${JSON.stringify(slimMapA.slice(-3))}`);

// ────────────────────────────────────────────────────────────────────
// 4. PATH B: LibreOffice render the docx → PDF → extract
// ────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════');
console.log('  PATH B — LibreOffice auto-converts docx to PDF');
console.log('══════════════════════════════════════════════════════════');
const SOFFICE = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
if (!fs.existsSync(SOFFICE)) {
  console.log('  ⚠ LibreOffice not installed — skipping Path B');
} else {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anarchy-libreoffice-'));
  const localDocx = path.join(tmpDir, 'anarchy.docx');
  fs.copyFileSync(DOCX, localDocx);
  console.log(`  Converting via LibreOffice (this takes a moment)...`);
  await execFileAsync(SOFFICE, ['--headless','--convert-to','pdf','--outdir', tmpDir, localDocx], { timeout: 120000 });
  const renderedPdf = path.join(tmpDir, 'anarchy.pdf');
  if (!fs.existsSync(renderedPdf)) {
    console.log('  ⚠ LibreOffice did not produce a PDF');
  } else {
    const sizeKB = (fs.statSync(renderedPdf).size / 1024).toFixed(0);
    console.log(`  LibreOffice PDF: ${sizeKB} KB`);
    const pdfPagesB = await extractPdfPages(renderedPdf);
    console.log(`  PDF pages: ${pdfPagesB.length}`);
    const printedDetectedB = pdfPagesB.filter(p => p.pageNumberSource === 'printed').length;
    console.log(`  Pages with detected printed footer: ${printedDetectedB}/${pdfPagesB.length}`);
    const slimMapB = buildSlimPageMap(pdfPagesB, manuscriptWords);
    console.log(`  Slim map anchors built: ${slimMapB.length}`);
    console.log(`  First 5 anchors: ${JSON.stringify(slimMapB.slice(0,5))}`);
    console.log(`  Last 3 anchors: ${JSON.stringify(slimMapB.slice(-3))}`);

    // ──── Comparison: pick word indices throughout the book and see what each path says
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  COMPARISON — both paths look up same word indices');
    console.log('══════════════════════════════════════════════════════════');
    const samples = [
      0, 500, 2000, 5000, 10000, 25000, 50000, 75000, 100000,
      Math.floor(manuscriptWords.length / 2),
      manuscriptWords.length - 100,
    ];
    console.log(`  ${'WORD INDEX'.padStart(12)}  ${'PATH A (real PDF)'.padStart(20)}  ${'PATH B (LibreOffice)'.padStart(22)}  DIFF`);
    for (const idx of samples) {
      if (idx >= manuscriptWords.length) continue;
      const pageA = pageForWordIndexFromSlimMap(idx, slimMapA);
      const pageB = pageForWordIndexFromSlimMap(idx, slimMapB);
      const diff = pageA != null && pageB != null ? pageB - pageA : '—';
      console.log(`  ${String(idx).padStart(12)}  ${String('p.'+pageA).padStart(20)}  ${String('p.'+pageB).padStart(22)}  ${diff}`);
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

console.log('\n══════════════════════════════════════════════════════════');
console.log('  Done.\n');
