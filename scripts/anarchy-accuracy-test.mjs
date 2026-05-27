// Rigorous accuracy test:
//   1) Build the slim map for real Anarchy PDF
//   2) For every 5th printed page, take 10 words of body text from that
//      PDF page → find those words in the manuscript → verify the slim
//      map's reverse lookup gives the SAME page back.
//   3) Also: pick word positions evenly across the manuscript, look up
//      the claimed page, then verify those words actually appear on
//      that PDF page.
//   4) Pass / fail per check, total accuracy at the end.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { buildSlimPageMap, pageForWordIndexFromSlimMap, extractManuscriptWordsFromHtml } from '/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/app/lib/pdfPaging.js';

const require_ = createRequire(import.meta.url);
const DOCX = '/Users/mariemackay/Downloads/Anarchy Manuscript for Audiobook (4).docx';
const PDF  = '/Users/mariemackay/Downloads/Anarchy Manuscript for Audiobook (1).pdf';

const mammoth = require_('/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/node_modules/mammoth/lib/index.js');
const docxBuf = fs.readFileSync(DOCX);
const { value: html } = await mammoth.convertToHtml({ buffer: docxBuf });
const manuscriptWords = extractManuscriptWordsFromHtml(html);
console.log(`Manuscript words: ${manuscriptWords.length}`);

const pdfjs = await import('/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/node_modules/pdfjs-dist/legacy/build/pdf.mjs');

function parsePrinted(text) {
  const raw = String(text||'').replace(/[\s\-–—]+/g,'').trim();
  if (!/^\d{1,4}$/.test(raw)) return null;
  const n = Number(raw); return n > 0 ? n : null;
}
function groupLines(items) {
  const sorted = items.filter(i=>String(i?.str||'').trim()).map(i=>({str:i.str,x:Number(i.transform?.[4])||0,y:Number(i.transform?.[5])||0}))
    .sort((a,b)=>{const dy=b.y-a.y; if(Math.abs(dy)>2.5)return dy; return a.x-b.x;});
  const lines=[];
  for (const it of sorted) { const p=lines[lines.length-1]; if(!p||Math.abs(p.y-it.y)>2.5){lines.push({y:it.y,items:[it]});continue;} p.items.push(it); }
  return lines.map(l=>({y:l.y,text:l.items.slice().sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim()})).filter(l=>l.text);
}
function detectPrinted(lines) {
  const bottomFirst=[...lines].sort((a,b)=>a.y-b.y);
  const topFirst=[...lines].sort((a,b)=>b.y-a.y);
  const candidates=[...bottomFirst.slice(0,3),...topFirst.slice(0,2)];
  for (const l of candidates){const n=parsePrinted(l.text); if(n!=null)return n;}
  return null;
}
function tokenize(text) {
  return String(text||'').toLowerCase().replace(/[‘’]/g,"'").match(/[a-z0-9']+/g)||[];
}
function normalize(text) {
  return String(text||'').toLowerCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').replace(/[^a-z0-9 ]+/g,' ').trim();
}

const data = new Uint8Array(fs.readFileSync(PDF));
const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
const pages = [];
for (let i=1;i<=pdf.numPages;i++) {
  const p = await pdf.getPage(i);
  const tc = await p.getTextContent();
  const lines = groupLines(tc.items||[]);
  const fullText = lines.map(l=>l.text).join(' ').replace(/\s+/g,' ').trim();
  const printed = detectPrinted(lines);
  pages.push({
    pageIndex: i,
    pageNumber: printed != null ? printed : i,
    pageNumberSource: printed != null ? 'printed' : 'index',
    normalizedText: normalize(fullText),
    rawFullText: fullText,
  });
}
pdf.cleanup?.();
console.log(`PDF pages: ${pages.length}, printed-detected: ${pages.filter(p=>p.pageNumberSource==='printed').length}`);

const slimMap = buildSlimPageMap(pages, manuscriptWords);
console.log(`Slim map: ${slimMap.length} anchors`);
console.log('');

// ─────────────────────────────────────────────────────────────────────
// TEST 1: every 5th PDF page → take 10 body words → find in manuscript → reverse-lookup → same page?
// ─────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════════');
console.log('  TEST 1: PDF page → manuscript word index → slim map → same page?');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(`  ${'PDF page'.padStart(10)}  ${'Sample words from PDF page'.padEnd(48)}  ${'Found at word'.padStart(14)}  ${'Map says page'.padStart(14)}  Verdict`);
const results1 = [];
for (let pi = 0; pi < pages.length; pi += 5) {
  const page = pages[pi];
  const printedP = page.pageNumber;
  // Skip front-matter pages where page number wasn't detected (those are unnumbered)
  if (page.pageNumberSource !== 'printed') continue;
  // Extract body words (skip pure digits / very short tokens)
  const pageTokens = tokenize(page.normalizedText).filter(w => !/^\d+$/.test(w) && w.length >= 2);
  if (pageTokens.length < 10) { continue; }
  // Take 10 words from the middle of the page (more likely to be unique body text)
  const startMid = Math.floor((pageTokens.length - 10) / 2);
  const sample = pageTokens.slice(startMid, startMid + 10);
  // Find this sequence in the manuscript
  let foundAt = -1;
  outer: for (let i = 0; i <= manuscriptWords.length - 10; i++) {
    for (let j = 0; j < 10; j++) if (manuscriptWords[i+j] !== sample[j]) continue outer;
    foundAt = i; break;
  }
  if (foundAt < 0) {
    results1.push({ pdf: printedP, sample, foundAt: 'NOT FOUND', map: null, ok: null });
    console.log(`  ${String(printedP).padStart(10)}  ${sample.join(' ').padEnd(48).slice(0,48)}  ${'NOT FOUND'.padStart(14)}  ${'—'.padStart(14)}  ⚠ skipped (not in manuscript)`);
    continue;
  }
  const mapPage = pageForWordIndexFromSlimMap(foundAt, slimMap);
  const ok = mapPage === printedP;
  results1.push({ pdf: printedP, foundAt, map: mapPage, ok });
  console.log(`  ${String(printedP).padStart(10)}  ${sample.join(' ').padEnd(48).slice(0,48)}  ${String(foundAt).padStart(14)}  ${('p.'+mapPage).padStart(14)}  ${ok ? '✓' : '❌ off by ' + (mapPage - printedP)}`);
}

const pass1 = results1.filter(r => r.ok === true).length;
const fail1 = results1.filter(r => r.ok === false).length;
const skip1 = results1.filter(r => r.ok === null).length;
const offs = results1.filter(r => r.ok === false).map(r => r.map - r.pdf);
const avgDrift = offs.length ? (offs.reduce((s,d)=>s+Math.abs(d),0) / offs.length).toFixed(2) : '0';
console.log('');
console.log(`  TEST 1 result: ${pass1} pass, ${fail1} fail, ${skip1} skipped`);
console.log(`  Accuracy: ${((pass1 / (pass1+fail1)) * 100).toFixed(1)}% of testable pages`);
console.log(`  Average absolute drift on failures: ${avgDrift} pages`);

// ─────────────────────────────────────────────────────────────────────
// TEST 2: 21 word positions evenly across the manuscript → check the page
// ─────────────────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('  TEST 2: Word position → slim map page → does manuscript text appear on that PDF page?');
console.log('═══════════════════════════════════════════════════════════════════');
console.log(`  ${'Word idx'.padStart(10)}  ${'Map says page'.padStart(14)}  ${'Words there'.padEnd(40)}  Verdict`);
const results2 = [];
const NUM_SAMPLES = 21;
for (let s = 0; s < NUM_SAMPLES; s++) {
  const idx = Math.floor((s / (NUM_SAMPLES - 1)) * (manuscriptWords.length - 15));
  const sample = manuscriptWords.slice(idx, idx + 10);
  const mapPage = pageForWordIndexFromSlimMap(idx, slimMap);
  const pdfPage = pages.find(p => p.pageNumber === mapPage && p.pageNumberSource === 'printed');
  if (!pdfPage) {
    results2.push({ idx, mapPage, ok: null });
    console.log(`  ${String(idx).padStart(10)}  ${('p.'+mapPage).padStart(14)}  ${sample.slice(0,5).join(' ').padEnd(40).slice(0,40)}  ⚠ no PDF page with that printed#`);
    continue;
  }
  // Check if at least 8 of 10 sample words appear in this PDF page's text
  const pageTokens = new Set(tokenize(pdfPage.normalizedText));
  const matchCount = sample.filter(w => pageTokens.has(w)).length;
  const onThisPage = matchCount >= 8;
  // If not on this page, try previous and next
  let actualPage = null;
  if (!onThisPage) {
    for (const dp of [-1, 1, -2, 2, -3, 3]) {
      const p2 = pages.find(pp => pp.pageNumber === mapPage + dp && pp.pageNumberSource === 'printed');
      if (!p2) continue;
      const t2 = new Set(tokenize(p2.normalizedText));
      const m2 = sample.filter(w => t2.has(w)).length;
      if (m2 >= 8) { actualPage = mapPage + dp; break; }
    }
  }
  const ok = onThisPage;
  results2.push({ idx, mapPage, ok, matchCount, actualPage });
  if (ok) console.log(`  ${String(idx).padStart(10)}  ${('p.'+mapPage).padStart(14)}  ${sample.slice(0,5).join(' ').padEnd(40).slice(0,40)}  ✓ (${matchCount}/10 words on the page)`);
  else if (actualPage != null) console.log(`  ${String(idx).padStart(10)}  ${('p.'+mapPage).padStart(14)}  ${sample.slice(0,5).join(' ').padEnd(40).slice(0,40)}  ❌ actually on p.${actualPage} (off by ${actualPage - mapPage})`);
  else console.log(`  ${String(idx).padStart(10)}  ${('p.'+mapPage).padStart(14)}  ${sample.slice(0,5).join(' ').padEnd(40).slice(0,40)}  ❌ words don't match map page nor neighbours`);
}
const pass2 = results2.filter(r => r.ok === true).length;
const fail2 = results2.filter(r => r.ok === false).length;
const skip2 = results2.filter(r => r.ok === null).length;
const offs2 = results2.filter(r => r.ok === false && r.actualPage != null).map(r => r.actualPage - r.mapPage);
const avgDrift2 = offs2.length ? (offs2.reduce((s,d)=>s+Math.abs(d),0) / offs2.length).toFixed(2) : '0';
console.log('');
console.log(`  TEST 2 result: ${pass2} pass, ${fail2} fail, ${skip2} skipped`);
console.log(`  Accuracy: ${((pass2 / (pass2+fail2)) * 100).toFixed(1)}% of word positions`);
console.log(`  Average absolute drift on failures: ${avgDrift2} pages`);

console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('  OVERALL');
console.log('═══════════════════════════════════════════════════════════════════');
const totalPass = pass1 + pass2;
const totalFail = fail1 + fail2;
const totalSkip = skip1 + skip2;
console.log(`  ${totalPass} pass / ${totalFail} fail / ${totalSkip} skipped — ${((totalPass/(totalPass+totalFail))*100).toFixed(1)}% accuracy`);
