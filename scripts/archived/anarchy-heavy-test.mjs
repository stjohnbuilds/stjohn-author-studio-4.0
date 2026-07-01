// 100+ samples per path. Tests:
//   PATH A — slim map built from real PDF
//   PATH B — slim map built from LibreOffice-rendered docx (no real PDF)
// For each: take 100 word positions evenly spaced across the manuscript,
// look up the page in the slim map, verify the manuscript text at that
// position actually appears on the claimed PDF page. Report accuracy
// bucketed by FRONT / EARLY / MID / LATE chapter.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { buildSlimPageMap, pageForWordIndexFromSlimMap, extractManuscriptWordsFromHtml } from '/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/app/lib/pdfPaging.js';

const execFileAsync = promisify(execFile);
const require_ = createRequire(import.meta.url);
const DOCX = '/Users/mariemackay/Downloads/Anarchy Manuscript for Audiobook (4).docx';
const PDF  = '/Users/mariemackay/Downloads/Anarchy Manuscript for Audiobook (1).pdf';

const mammoth = require_('/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/node_modules/mammoth/lib/index.js');
const { value: html } = await mammoth.convertToHtml({ buffer: fs.readFileSync(DOCX) });
const manuscriptWords = extractManuscriptWordsFromHtml(html);

const pdfjs = await import('/Users/mariemackay/Dev/StJohn-Author-Studio-4.0/node_modules/pdfjs-dist/legacy/build/pdf.mjs');

function parsePrinted(t) { const r=String(t||'').replace(/[\s\-–—]+/g,'').trim(); if(!/^\d{1,4}$/.test(r))return null; const n=Number(r); return n>0?n:null; }
function groupLines(items) {
  const sorted=items.filter(i=>String(i?.str||'').trim()).map(i=>({str:i.str,x:Number(i.transform?.[4])||0,y:Number(i.transform?.[5])||0}))
    .sort((a,b)=>{const dy=b.y-a.y; if(Math.abs(dy)>2.5)return dy; return a.x-b.x;});
  const lines=[]; for(const it of sorted){const p=lines[lines.length-1]; if(!p||Math.abs(p.y-it.y)>2.5){lines.push({y:it.y,items:[it]});continue;} p.items.push(it);}
  return lines.map(l=>({y:l.y,text:l.items.slice().sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim()})).filter(l=>l.text);
}
function detectPrinted(lines){const bf=[...lines].sort((a,b)=>a.y-b.y);const tf=[...lines].sort((a,b)=>b.y-a.y);for(const l of [...bf.slice(0,3),...tf.slice(0,2)]){const n=parsePrinted(l.text); if(n!=null)return n;} return null;}
function tokenize(t){return String(t||'').toLowerCase().replace(/[‘’]/g,"'").match(/[a-z0-9']+/g)||[];}
function normalize(t){return String(t||'').toLowerCase().replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').replace(/[^a-z0-9 ]+/g,' ').trim();}

async function extractPdfPages(p) {
  const data = new Uint8Array(fs.readFileSync(p));
  const pdf = await pdfjs.getDocument({data,disableWorker:true}).promise;
  const pages=[];
  for(let i=1;i<=pdf.numPages;i++){
    const pg=await pdf.getPage(i);
    const tc=await pg.getTextContent();
    const lines=groupLines(tc.items||[]);
    const fullText=lines.map(l=>l.text).join(' ').replace(/\s+/g,' ').trim();
    const printed=detectPrinted(lines);
    pages.push({pageIndex:i,pageNumber:printed!=null?printed:i,pageNumberSource:printed!=null?'printed':'index',normalizedText:normalize(fullText)});
  }
  pdf.cleanup?.(); return pages;
}

console.log(`Manuscript words: ${manuscriptWords.length}\n`);

// Path A: real PDF
const pdfPagesA = await extractPdfPages(PDF);
const slimMapA = buildSlimPageMap(pdfPagesA, manuscriptWords);
console.log(`PATH A (real PDF): ${pdfPagesA.length} pages, ${slimMapA.length} anchors`);

// Path B: LibreOffice render of docx
const SOFFICE = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
let slimMapB = null;
let pdfPagesB = null;
if (fs.existsSync(SOFFICE)) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'heavy-test-'));
  fs.copyFileSync(DOCX, path.join(tmp, 'anarchy.docx'));
  await execFileAsync(SOFFICE, ['--headless','--convert-to','pdf','--outdir',tmp,path.join(tmp,'anarchy.docx')], { timeout: 120000 });
  pdfPagesB = await extractPdfPages(path.join(tmp,'anarchy.pdf'));
  slimMapB = buildSlimPageMap(pdfPagesB, manuscriptWords);
  console.log(`PATH B (LibreOffice): ${pdfPagesB.length} pages, ${slimMapB.length} anchors`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

// ─────────────────────────────────────────────────────────────────────
function bucket(idx, total) {
  const pct = idx / total;
  if (pct < 0.05) return 'FRONT';
  if (pct < 0.30) return 'EARLY';
  if (pct < 0.70) return 'MID';
  return 'LATE';
}

function checkSample(idx, slimMap, pages) {
  const sample = manuscriptWords.slice(idx, idx + 10);
  const mapPage = pageForWordIndexFromSlimMap(idx, slimMap);
  const pdfPage = pages.find(p => p.pageNumber === mapPage && p.pageNumberSource === 'printed');
  if (!pdfPage) return { ok: 'skip', reason: 'no printed page' };
  const pageTokens = new Set(tokenize(pdfPage.normalizedText));
  const matchCount = sample.filter(w => pageTokens.has(w)).length;
  const onThisPage = matchCount >= 8;
  if (onThisPage) return { ok: true, matchCount, mapPage };
  // Check neighbours
  for (const dp of [-1, 1, -2, 2, -3, 3, -5, 5, -10, 10]) {
    const p2 = pages.find(pp => pp.pageNumber === mapPage + dp && pp.pageNumberSource === 'printed');
    if (!p2) continue;
    const t2 = new Set(tokenize(p2.normalizedText));
    const m2 = sample.filter(w => t2.has(w)).length;
    if (m2 >= 8) return { ok: false, mapPage, actualPage: mapPage + dp, drift: dp };
  }
  return { ok: false, mapPage, actualPage: null, drift: null };
}

function runHeavyTest(label, slimMap, pages) {
  if (!slimMap || !pages) return;
  console.log(`\n═══════════════════════════════════════════════════════════════════`);
  console.log(`  ${label} — 100 samples evenly spaced across manuscript`);
  console.log(`═══════════════════════════════════════════════════════════════════`);
  const NUM = 100;
  const results = [];
  for (let s = 0; s < NUM; s++) {
    const idx = Math.floor((s / (NUM - 1)) * (manuscriptWords.length - 15));
    const r = checkSample(idx, slimMap, pages);
    results.push({ idx, b: bucket(idx, manuscriptWords.length), ...r });
  }
  // Summary by bucket
  const buckets = ['FRONT','EARLY','MID','LATE'];
  for (const b of buckets) {
    const arr = results.filter(r => r.b === b);
    const pass = arr.filter(r => r.ok === true).length;
    const fail = arr.filter(r => r.ok === false).length;
    const skip = arr.filter(r => r.ok === 'skip').length;
    const drifts = arr.filter(r => r.ok === false && r.drift != null).map(r => r.drift);
    const avgDrift = drifts.length ? (drifts.reduce((s,d)=>s+Math.abs(d),0)/drifts.length).toFixed(2) : '—';
    const acc = (pass + fail) > 0 ? ((pass / (pass + fail)) * 100).toFixed(1) : '—';
    console.log(`  ${b.padEnd(6)}: ${String(pass).padStart(3)} pass  ${String(fail).padStart(3)} fail  ${String(skip).padStart(3)} skip  → ${acc}% accuracy  (avg drift ${avgDrift})`);
  }
  const totalPass = results.filter(r => r.ok === true).length;
  const totalFail = results.filter(r => r.ok === false).length;
  const totalSkip = results.filter(r => r.ok === 'skip').length;
  const allDrifts = results.filter(r => r.ok === false && r.drift != null).map(r => r.drift);
  const overallAcc = (totalPass + totalFail) > 0 ? ((totalPass / (totalPass + totalFail)) * 100).toFixed(1) : '—';
  console.log(`  ─────────────────────────────────────────────────────────────────`);
  console.log(`  OVERALL: ${totalPass}/${totalPass+totalFail+totalSkip} = ${overallAcc}% on testable, ${totalSkip} skipped`);
  console.log(`  Drift distribution: ${JSON.stringify(allDrifts.reduce((acc,d)=>{acc[d]=(acc[d]||0)+1;return acc;},{}))}`);
}

runHeavyTest('PATH A — real Anarchy PDF', slimMapA, pdfPagesA);
runHeavyTest('PATH B — LibreOffice auto-converted docx (no PDF)', slimMapB, pdfPagesB);
