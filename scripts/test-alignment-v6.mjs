// Quick test: run the new v6 banded alignment on saved data and check results.
import fs from 'fs';
import { alignTranscriptToManuscript } from '../app/lib/fuzzyMatcher.js';

const data = JSON.parse(fs.readFileSync('Save Data/books.json', 'utf8'));
const book = data[0];
const sec = book.chapters[0].sections[0];
const ww = sec.whisperWords;
const html = sec.html;

const divText = html.replace(/<[^>]+>/g, ' ');
const msWords = divText.match(/[A-Za-z0-9']+/g) || [];

console.log(`MS words: ${msWords.length}, Whisper words: ${ww.length}`);
console.log(`First 10 ms: ${msWords.slice(0, 10).join(' ')}`);
console.log(`First 10 whisper: ${ww.slice(0, 10).map(w => w.word).join(' ')}`);

// Run alignment
console.log('\nRunning v6 banded sequence alignment...');
const t0 = Date.now();
const alignment = alignTranscriptToManuscript(msWords, ww);
const elapsed = Date.now() - t0;
console.log(`Alignment took ${elapsed}ms`);

const matched = alignment.filter(Boolean).length;
console.log(`Matched: ${matched}/${msWords.length} (${(matched / msWords.length * 100).toFixed(1)}%)`);

// Check first 30 matches for correctness
console.log('\n=== FIRST 30 MATCHES ===');
for (let i = 0; i < Math.min(30, msWords.length); i++) {
  const m = alignment[i];
  if (m) {
    const wWord = ww[m.wordIdx]?.word || '?';
    const exact = msWords[i].toLowerCase() === wWord.toLowerCase().replace(/[^a-z0-9']/g, '');
    console.log(`  ms[${i}]="${msWords[i]}" → whisper[${m.wordIdx}]="${wWord}" conf=${m.confidence.toFixed(2)} ${exact ? '✓' : '✗'}`);
  } else {
    console.log(`  ms[${i}]="${msWords[i]}" → (no match)`);
  }
}

// Position drift check
console.log('\n=== POSITION DRIFT (every 100th word) ===');
for (let i = 0; i < msWords.length; i += 100) {
  const m = alignment[i];
  if (m) {
    const expectedWi = Math.round((i / msWords.length) * ww.length);
    const drift = m.wordIdx - expectedWi;
    const wWord = ww[m.wordIdx]?.word || '?';
    console.log(`  ms[${i}]="${msWords[i]}" → whisper[${m.wordIdx}]="${wWord}" expected~${expectedWi} drift=${drift > 0 ? '+' : ''}${drift}`);
  } else {
    console.log(`  ms[${i}]="${msWords[i]}" → (no match)`);
  }
}

// Monotonicity check
console.log('\n=== MONOTONICITY CHECK ===');
let violations = 0;
let lastWi = -1;
for (let i = 0; i < alignment.length; i++) {
  if (!alignment[i]) continue;
  if (alignment[i].wordIdx <= lastWi) {
    violations++;
    if (violations <= 5) {
      console.log(`  VIOLATION at ms[${i}]: whisper[${alignment[i].wordIdx}] <= prev whisper[${lastWi}]`);
    }
  }
  lastWi = alignment[i].wordIdx;
}
console.log(`Total monotonicity violations: ${violations}`);

// Sync table simulation
console.log('\n=== SIMULATED SYNC TABLE ===');
const rows = [];
alignment.forEach((m, msIdx) => {
  if (!m?.wordObj || !Number.isFinite(m.wordObj.start)) return;
  if ((m.confidence || 0) < 0.35) return;
  rows.push({ t: m.wordObj.start, msIdx, conf: m.confidence });
});
rows.sort((a, b) => a.t - b.t);
const mono = [rows[0]];
for (let i = 1; i < rows.length; i++) {
  const prev = mono[mono.length - 1];
  if (rows[i].t <= prev.t + 0.01 || rows[i].msIdx <= prev.msIdx) continue;
  mono.push(rows[i]);
}
// Outlier filter
const totalTime = mono[mono.length - 1].t - mono[0].t;
const totalWords = mono[mono.length - 1].msIdx - mono[0].msIdx;
const avgWps = totalTime > 0 ? totalWords / totalTime : 3;
const maxWps = Math.max(avgWps * 3, 10);
const cleaned = [mono[0]];
for (let i = 1; i < mono.length; i++) {
  const prev = cleaned[cleaned.length - 1];
  const dt = mono[i].t - prev.t;
  const dw = mono[i].msIdx - prev.msIdx;
  if (dt > 0.05 && dw / dt > maxWps) continue;
  cleaned.push(mono[i]);
}
console.log(`${rows.length} raw → ${mono.length} monotonic → ${cleaned.length} cleaned (avgWps=${avgWps.toFixed(1)}, maxWps=${maxWps.toFixed(1)})`);

// Count problem anchors
let problems = 0;
for (let i = 1; i < cleaned.length; i++) {
  const prev = cleaned[i - 1];
  const cur = cleaned[i];
  const dt = cur.t - prev.t;
  const dw = cur.msIdx - prev.msIdx;
  if (dt > 0) {
    const wps = dw / dt;
    if (wps > 8 || wps < 0.3) problems++;
  }
}
console.log(`Problem anchors (WPS>8 or <0.3): ${problems}`);
