// Runs v6 alignment offline and writes results directly to books.json.
// This bypasses the app/browser entirely, eliminating caching issues.
import fs from 'fs';
import { alignTranscriptToManuscript } from '../app/lib/fuzzyMatcher.js';

const BOOKS_PATH = 'Save Data/books.json';
const data = JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf8'));
const book = data[0];
const chapter = book.chapters[0];
const sections = chapter.sections || [];

// Gather all section HTML to form one continuous manuscript
// Tokenize by whitespace (matching ProofingReader's wrapWords) — NOT by [A-Za-z0-9']+
// This prevents the index mismatch where contractions like "wasn't" split into 2 tokens
const allHtml = sections.map(s => s.html || '').join('');
const divText = allHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&mdash;/gi, '\u2014').replace(/&ndash;/gi, '\u2013').replace(/&rsquo;/gi, "\u2019").replace(/&lsquo;/gi, "\u2018").replace(/&rdquo;/gi, '\u201D').replace(/&ldquo;/gi, '\u201C').replace(/&amp;/gi, '&');
const msWords = divText.split(/\s+/).filter(s => s.length > 0);

// Get whisper words from the section that has them
const sectionWithWords = sections.find(s => s.whisperWords?.length);
if (!sectionWithWords) {
  console.log('ERROR: No whisperWords found. Run transcription first.');
  process.exit(1);
}
const whisperWords = sectionWithWords.whisperWords;

console.log(`MS words: ${msWords.length}, Whisper words: ${whisperWords.length}`);

// Build sentence boundaries
const sentenceChunks = divText.split(/(?<=[.!?])\s+/);
const msSentenceBounds = [];
let wordIdx = 0;
for (const chunk of sentenceChunks) {
  const wordsInChunk = (chunk.match(/[A-Za-z0-9']+/g) || []).length;
  if (wordsInChunk > 0) {
    wordIdx += wordsInChunk;
    msSentenceBounds.push(wordIdx - 1);
  }
}

// Run v6 alignment
console.log('Running v6 banded Needleman-Wunsch alignment...');
const t0 = Date.now();
const alignment = alignTranscriptToManuscript(msWords, whisperWords, msSentenceBounds);
const elapsed = Date.now() - t0;

const matched = alignment.filter(Boolean).length;
console.log(`Done in ${elapsed}ms — ${matched}/${msWords.length} (${(matched / msWords.length * 100).toFixed(1)}%)`);

// Verify first few matches
console.log('\nFirst 10 matches:');
for (let i = 0; i < 10; i++) {
  const m = alignment[i];
  if (m) {
    console.log(`  ms[${i}]="${msWords[i]}" → whisper[${m.wordIdx}]="${whisperWords[m.wordIdx]?.word}" conf=${m.confidence.toFixed(2)}`);
  } else {
    console.log(`  ms[${i}]="${msWords[i]}" → (no match)`);
  }
}

// Monotonicity check
let violations = 0;
let lastWi = -1;
for (let i = 0; i < alignment.length; i++) {
  if (!alignment[i]) continue;
  if (alignment[i].wordIdx <= lastWi) violations++;
  else lastWi = alignment[i].wordIdx;
}
console.log(`\nMonotonicity violations: ${violations}`);

// Compute scoring alignment (exclude headings)
const scoreHtml = allHtml.replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi, '');
const scoreText = scoreHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&mdash;/gi, '\u2014').replace(/&ndash;/gi, '\u2013').replace(/&rsquo;/gi, "\u2019").replace(/&lsquo;/gi, "\u2018").replace(/&rdquo;/gi, '\u201D').replace(/&ldquo;/gi, '\u201C').replace(/&amp;/gi, '&');
const scoreWords = scoreText.split(/\s+/).filter(s => s.length > 0);
const scoreAlignment = alignTranscriptToManuscript(scoreWords, whisperWords);
const matchedCount = scoreAlignment.filter(Boolean).length;
const matchQuality = scoreWords.length ? (matchedCount / scoreWords.length) : 0;

// Split alignment by section
const sectionWordCounts = sections.map(s => {
  const text = (s.html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&mdash;/gi, '\u2014').replace(/&ndash;/gi, '\u2013').replace(/&rsquo;/gi, "\u2019").replace(/&lsquo;/gi, "\u2018").replace(/&rdquo;/gi, '\u201D').replace(/&ldquo;/gi, '\u201C').replace(/&amp;/gi, '&');
  return text.split(/\s+/).filter(t => t.length > 0).length;
});

let wOff = 0;
const sectionAlignments = sectionWordCounts.map(count => {
  const slice = alignment.slice(wOff, wOff + count);
  wOff += count;
  return slice;
});

// Write back to books.json
for (let si = 0; si < sections.length; si++) {
  sections[si].whisperAlignment = sectionAlignments[si] || [];
  sections[si].whisperMatchedCount = matchedCount;
  sections[si].whisperManuscriptWordCount = scoreWords.length;
  sections[si].whisperMatchQuality = matchQuality;
}

fs.writeFileSync(BOOKS_PATH, JSON.stringify(data, null, 2));
console.log(`\nWrote v6 alignment to ${BOOKS_PATH}`);
console.log(`Match quality: ${(matchQuality * 100).toFixed(1)}% (${matchedCount}/${scoreWords.length} scoring words)`);

// Verify the write
const verify = JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf8'));
const vAl = verify[0].chapters[0].sections[0].whisperAlignment;
const v1 = vAl[1];
if (v1 && v1.wordIdx === 1) {
  console.log('\n✅ VERIFIED: v6 alignment is now saved (al[1].wordIdx=1)');
} else {
  console.log(`\n⚠️  al[1].wordIdx=${v1?.wordIdx} — check alignment logic`);
}

// Time mapping diagnostic at key points
console.log('\n=== TIME MAPPING AT KEY POINTS ===');
const timePoints = [0, 60, 120, 300, 600, 840, 1200, 1500, 1800];
const syncRows = [];
alignment.forEach((m, msIdx) => {
  if (!m?.wordObj || !Number.isFinite(m.wordObj.start)) return;
  if ((m.confidence || 0) < 0.35) return;
  syncRows.push({ t: m.wordObj.start, msIdx });
});
syncRows.sort((a, b) => a.t - b.t);
// Enforce monotonic
const monoSync = [syncRows[0]];
for (let i = 1; i < syncRows.length; i++) {
  const prev = monoSync[monoSync.length - 1];
  if (syncRows[i].t > prev.t + 0.01 && syncRows[i].msIdx > prev.msIdx) {
    monoSync.push(syncRows[i]);
  }
}

for (const targetTime of timePoints) {
  // Binary search
  let lo = 0, hi = monoSync.length - 1, left = null, right = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (monoSync[mid].t <= targetTime) { left = monoSync[mid]; lo = mid + 1; }
    else { right = monoSync[mid]; hi = mid - 1; }
  }
  let msIdx;
  if (left && right) {
    const alpha = (targetTime - left.t) / (right.t - left.t);
    msIdx = Math.round(left.msIdx + alpha * (right.msIdx - left.msIdx));
  } else if (left) {
    msIdx = left.msIdx;
  } else if (right) {
    msIdx = right.msIdx;
  } else {
    msIdx = 0;
  }
  const mins = Math.floor(targetTime / 60);
  const secs = targetTime % 60;
  const word = msWords[msIdx] || '?';
  const pct = (msIdx / msWords.length * 100).toFixed(1);
  console.log(`  ${mins}:${String(secs).padStart(2,'0')} → ms[${msIdx}] "${word}" (${pct}% through)`);
}
