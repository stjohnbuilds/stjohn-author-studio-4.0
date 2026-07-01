// Compare word counts: alignment regex vs ProofingReader's whitespace-split
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('Save Data/books.json', 'utf8'));
const sec = data[0].chapters[0].sections[0];
const html = sec.html || '';

// Strip HTML to get plain text (same as both code paths do)
const plainText = html.replace(/<[^>]+>/g, ' ');

// Method 1: Alignment regex (from fuzzyMatcher / realignChapter)
const alignWords = plainText.match(/[A-Za-z0-9']+/g) || [];

// Method 2: Simulate wrapWords (splits by whitespace, keeps everything non-whitespace)
const wrapWordsTokens = plainText.split(/\s+/).filter(s => s.length > 0);

console.log(`Alignment regex words: ${alignWords.length}`);
console.log(`WrapWords (whitespace) tokens: ${wrapWordsTokens.length}`);
console.log(`DIFFERENCE: ${alignWords.length - wrapWordsTokens.length}`);

// Find where they diverge
let ai = 0, wi = 0;
let divergences = [];
while (ai < alignWords.length && wi < wrapWordsTokens.length) {
  const aw = alignWords[ai];
  const ww = wrapWordsTokens[wi];
  
  // Check if wrapWords token contains the alignment word
  const wwClean = ww.replace(/[^A-Za-z0-9']+/g, '');
  
  if (aw === wwClean) {
    // Perfect match, advance both
    ai++;
    wi++;
  } else {
    // Divergence! 
    // Case: alignment regex splits a hyphenated word, wrapWords keeps it together
    // e.g. "well-known" → align: ["well","known"] vs wrap: ["well-known"]
    const nextAlign = ai + 1 < alignWords.length ? alignWords[ai + 1] : '';
    const combined = aw + nextAlign;
    if (wwClean.toLowerCase().includes(aw.toLowerCase()) && wwClean.toLowerCase().includes(nextAlign.toLowerCase()) && wwClean.length > aw.length) {
      divergences.push({
        pos: wi,
        type: 'hyphenated',
        wrap: ww,
        alignWords: [aw, nextAlign],
        alignIdx: ai,
        wrapIdx: wi,
      });
      ai += 2; // alignment consumed 2
      wi += 1; // wrap consumed 1
    } else if (/^[^A-Za-z0-9']+$/.test(ww)) {
      // Punctuation-only token in wrapWords, skipped by alignment regex
      divergences.push({
        pos: wi,
        type: 'punct-only',
        wrap: ww,
        alignIdx: ai,
        wrapIdx: wi,
      });
      wi++; // only advance wrap
    } else {
      // Unknown divergence
      divergences.push({
        pos: wi,
        type: 'unknown',
        wrap: ww,
        align: aw,
        alignIdx: ai,
        wrapIdx: wi,
      });
      ai++;
      wi++;
    }
  }
}

console.log(`\nTotal divergences: ${divergences.length}`);
console.log(`Hyphenated (wrap=1, align=2): ${divergences.filter(d => d.type === 'hyphenated').length}`);
console.log(`Punct-only (wrap=1, align=0): ${divergences.filter(d => d.type === 'punct-only').length}`);
console.log(`Unknown: ${divergences.filter(d => d.type === 'unknown').length}`);

console.log('\nFirst 20 divergences:');
divergences.slice(0, 20).forEach((d, i) => {
  if (d.type === 'hyphenated') {
    console.log(`  ${i}: wrapIdx=${d.wrapIdx} "${d.wrap}" → align splits into [${d.alignWords.map(w => `"${w}"`).join(', ')}] at alignIdx=${d.alignIdx}`);
  } else if (d.type === 'punct-only') {
    console.log(`  ${i}: wrapIdx=${d.wrapIdx} "${d.wrap}" → punct-only token (alignment skips it)`);
  } else {
    console.log(`  ${i}: wrapIdx=${d.wrapIdx} wrap="${d.wrap}" vs align="${d.align}" at alignIdx=${d.alignIdx}`);
  }
});

// Show the cumulative offset at various points
console.log('\n=== CUMULATIVE OFFSET OVER TIME ===');
let cumOffset = 0;
let checkPoints = [0, 500, 1000, 1500, 2000, 2500, 2800, 2900, 3000, 3030];
let divIdx = 0;
let lastCheck = 0;
for (const cp of checkPoints) {
  while (divIdx < divergences.length && divergences[divIdx].alignIdx <= cp) {
    if (divergences[divIdx].type === 'hyphenated') cumOffset++;
    else if (divergences[divIdx].type === 'punct-only') cumOffset--;
    divIdx++;
  }
  console.log(`  At alignIdx=${cp}: cumulative offset = ${cumOffset} (wrapIdx would be ${cp - cumOffset})`);
}

// Critical check: at alignIdx=2890, what word does ProofingReader actually show?
console.log('\n=== CRITICAL: alignIdx 2890 (sync table output at 20:36) ===');
// The sync table says msIdx=2890 at time 20:36
// In the alignment, ms[2890] = ?
// In ProofingReader, wordEls[2890] = ? 
console.log(`Alignment ms[2890] = "${alignWords[2890]}"`);
// Calculate the wrapWords equivalent
let totalHyphen = divergences.filter(d => d.type === 'hyphenated' && d.alignIdx <= 2890).length;
let totalPunct = divergences.filter(d => d.type === 'punct-only' && d.wrapIdx <= 2890 - totalHyphen).length;
const wrapEquiv = 2890 - totalHyphen + totalPunct;
console.log(`WrapWords equivalent index: ~${wrapEquiv}`);
console.log(`WrapWords token at ${wrapEquiv}: "${wrapWordsTokens[wrapEquiv]}"`);
console.log(`Offset at this point: ${totalHyphen} hyphenated splits`);
console.log(`\nThis means when sync table says "show word 2890", ProofingReader shows word 2890 in ITS list,`);
console.log(`which is actually word ${wrapEquiv} in the alignment list — ${2890 - wrapEquiv} words AHEAD.`);
