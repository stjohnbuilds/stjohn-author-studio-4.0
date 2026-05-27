#!/usr/bin/env node
// Page-number sandbox — run the SAME code the app uses to compute the
// printed page number for any quote in a .docx.
//
// Marie 2026-05-26: she gives a quote, the app spits out a page number,
// we compare to the printed book to confirm correctness.
//
// Usage:
//   node scripts/page-sandbox.mjs "/path/to/manuscript.docx" "exact quote text"
//
// Or interactive — omit the quote and you can type quotes line by line:
//   node scripts/page-sandbox.mjs "/path/to/manuscript.docx"
//
// What it does:
//   1. Reads word/document.xml from the .docx
//   2. Runs extractRenderedPageMapFromDocxXml — the SAME function the
//      app uses at import time
//   3. Builds a flat word list from the manuscript (matches the app's
//      countWordsInText regex)
//   4. For each quote: finds where the quote starts in the word list,
//      asks the page map for that word's page number, prints the result

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import JSZip from 'jszip';
import {
  extractRenderedPageMapFromDocxXml,
  getPageNumberForWordIndex,
  normalizePageMap,
  DEFAULT_ESTIMATED_WORDS_PER_PAGE,
} from '../app/lib/manuscriptPaging.js';

const docxPath = process.argv[2];
const quoteArg = process.argv.slice(3).join(' ').trim();

if (!docxPath) {
  console.error('Usage: node scripts/page-sandbox.mjs <docx-path> [quote]');
  process.exit(1);
}
if (!fs.existsSync(docxPath)) {
  console.error('File not found:', docxPath);
  process.exit(1);
}

// ────────────────────────────────────────────────────────────────────
// 1. Load the .docx, pull out word/document.xml
// ────────────────────────────────────────────────────────────────────
const buf = fs.readFileSync(docxPath);
const zip = await JSZip.loadAsync(buf);
const docFile = zip.file('word/document.xml');
if (!docFile) {
  console.error('word/document.xml not found inside the .docx');
  process.exit(1);
}
const documentXml = await docFile.async('string');

// ────────────────────────────────────────────────────────────────────
// 2. Run the same page-map extractor the app uses
// ────────────────────────────────────────────────────────────────────
const paging = extractRenderedPageMapFromDocxXml(documentXml);

if (!paging) {
  console.error('');
  console.error('⚠️  No rendered page breaks were found in this .docx.');
  console.error('   The app falls back to an estimated', DEFAULT_ESTIMATED_WORDS_PER_PAGE, 'words-per-page in this case.');
  console.error('   The page numbers below are ESTIMATED, not exact.');
  console.error('');
}

const pageMap = paging?.pageMap || normalizePageMap([], 1);
const mode = paging?.mode || 'estimated';
const startPage = paging?.startPageNumber || 1;
const totalWords = paging?.totalWordCount || 0;

console.log('────────────────────────────────────────────────────────');
console.log(' File:        ', path.basename(docxPath));
console.log(' Mode:        ', mode === 'rendered' ? '✓ rendered (exact)' : '⚠ estimated (no page breaks in docx)');
console.log(' Start page:  ', startPage);
console.log(' Total words: ', totalWords);
console.log(' Page entries:', pageMap.length);
if (paging?.exactPageCount) console.log(' Exact pages: ', paging.exactPageCount);
console.log('────────────────────────────────────────────────────────');

// ────────────────────────────────────────────────────────────────────
// 3. Flatten the manuscript into an ordered word list matching the
//    same regex the app uses (countWordsInText: /[A-Za-z0-9']+/g)
// ────────────────────────────────────────────────────────────────────
//    We rebuild a positional word list with running word indices so we
//    can answer "what word index is this quote at?".

function decodeXmlEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

const textRunRx = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi;
const fullTextPieces = [];
let m;
while ((m = textRunRx.exec(documentXml)) !== null) {
  fullTextPieces.push(decodeXmlEntities(m[1]));
}
const fullText = fullTextPieces.join(' ');
const fullWords = fullText.match(/[A-Za-z0-9']+/g) || [];

console.log(' Word list:   ', fullWords.length, 'words rebuilt from <w:t> runs');
console.log('────────────────────────────────────────────────────────');

// ────────────────────────────────────────────────────────────────────
// 4. Quote lookup — find where a quote starts in the word list and
//    look up the page number for that word index.
// ────────────────────────────────────────────────────────────────────
function findFirstWordIndex(quote) {
  const quoteWords = String(quote).match(/[A-Za-z0-9']+/g) || [];
  if (!quoteWords.length) return -1;
  const needle = quoteWords.map(w => w.toLowerCase());
  const hayLen = fullWords.length;
  for (let i = 0; i <= hayLen - needle.length; i += 1) {
    let ok = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (fullWords[i + j].toLowerCase() !== needle[j]) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

function lookupQuote(quote) {
  const cleanQuote = String(quote || '').trim();
  if (!cleanQuote) {
    console.log('(empty quote, skipping)');
    return;
  }
  const idx = findFirstWordIndex(cleanQuote);
  if (idx < 0) {
    console.log(`❌  Quote not found in manuscript:`);
    console.log(`    "${cleanQuote.slice(0, 80)}${cleanQuote.length > 80 ? '…' : ''}"`);
    return;
  }
  let page;
  if (mode === 'rendered') {
    page = getPageNumberForWordIndex(idx, pageMap);
  } else {
    page = Math.floor(idx / DEFAULT_ESTIMATED_WORDS_PER_PAGE) + 1;
  }
  // Show ±3 words of context for sanity
  const ctxFrom = Math.max(0, idx - 2);
  const ctxTo = Math.min(fullWords.length, idx + (cleanQuote.match(/[A-Za-z0-9']+/g) || []).length + 2);
  const ctx = fullWords.slice(ctxFrom, ctxTo).join(' ');
  console.log(`✓  Word index ${idx}  →  Page ${page}  (${mode})`);
  console.log(`   …${ctx}…`);
}

if (quoteArg) {
  lookupQuote(quoteArg);
  process.exit(0);
}

// Interactive: read quotes from stdin
console.log('Paste a quote and press Enter. Ctrl-C to quit.');
console.log('');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => lookupQuote(line));
