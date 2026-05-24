/**
 * Diagnostic script: analyzes the PAC3 sandbox alignment data
 * and produces a detailed report showing where alignment breaks.
 *
 * Run: node scripts/diagnose-alignment.js
 */
const fs = require('fs');
const path = require('path');

const BOOKS_PATH = path.join(__dirname, '..', 'Save Data', 'books.json');
const books = JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf8'));
const pac3 = books.find(b => b.id === 'dev-sandbox-pac3');
if (!pac3) { console.error('PAC3 sandbox not found in books.json'); process.exit(1); }

const sec = pac3.chapters[0].sections[0];
const whisperWords = sec.whisperWords;   // [{word, start, end}, ...]
const alignment = sec.whisperAlignment;  // [{wordIdx, wordObj, confidence}, ...] indexed by ms word idx

// Extract manuscript words from HTML (same way the app does it)
const htmlText = sec.html.replace(/<[^>]+>/g, ' ');
const msWords = htmlText.match(/[A-Za-z0-9']+/g) || [];

console.log('='.repeat(80));
console.log('ALIGNMENT DIAGNOSTIC REPORT');
console.log('='.repeat(80));
console.log(`Manuscript words: ${msWords.length}`);
console.log(`Whisper words: ${whisperWords.length}`);
console.log(`Alignment entries: ${alignment.length}`);
console.log(`Matched: ${alignment.filter(Boolean).length} (${(alignment.filter(Boolean).length / msWords.length * 100).toFixed(1)}%)`);
console.log(`Match quality (saved): ${(sec.whisperMatchQuality * 100).toFixed(1)}%`);
console.log();

// Show first 20 manuscript words
console.log('FIRST 20 MS WORDS:', msWords.slice(0, 20).join(' '));
console.log('FIRST 20 WHISPER WORDS:', whisperWords.slice(0, 20).map(w => w.word).join(' '));
console.log();

// Build the sync table the same way ProofingReader does
const rows = [];
(alignment || []).forEach((match, msIdx) => {
  if (!match?.wordObj || !Number.isFinite(match.wordObj.start)) return;
  if ((Number(match.confidence) || 0) < 0.35) return;
  rows.push({ t: match.wordObj.start, msIdx, wIdx: match.wordIdx, conf: match.confidence });
});
rows.sort((a, b) => a.t - b.t);

// Monotonic filter
const mono = [rows[0]];
for (let i = 1; i < rows.length; i++) {
  const prev = mono[mono.length - 1];
  const cur = rows[i];
  if (cur.t <= prev.t + 0.01) continue;
  if (cur.msIdx <= prev.msIdx) continue;
  mono.push(cur);
}

console.log(`Sync table: ${rows.length} raw → ${mono.length} monotonic`);
console.log();

// Analyze: show every 50th anchor point and check for problems
console.log('SYNC TABLE ANCHORS (every ~50th entry):');
console.log('-'.repeat(90));
console.log('Row#  | AudioTime | ms_word_idx | whisper_idx | ms_word       | whisper_word  | Conf  | WPS');
console.log('-'.repeat(90));

let prevEntry = null;
for (let i = 0; i < mono.length; i++) {
  const e = mono[i];
  const msWord = msWords[e.msIdx] || '???';
  const wWord = whisperWords[e.wIdx]?.word || '???';
  
  let wps = '';
  if (prevEntry) {
    const dt = e.t - prevEntry.t;
    const dw = e.msIdx - prevEntry.msIdx;
    if (dt > 0) wps = (dw / dt).toFixed(1);
  }

  if (i % 50 === 0 || i === mono.length - 1) {
    console.log(
      `${String(i).padStart(5)} | ` +
      `${e.t.toFixed(1).padStart(9)}s | ` +
      `${String(e.msIdx).padStart(11)} | ` +
      `${String(e.wIdx).padStart(11)} | ` +
      `${msWord.padEnd(13)} | ` +
      `${wWord.padEnd(13)} | ` +
      `${(e.conf || 0).toFixed(2).padStart(5)} | ` +
      `${wps.padStart(5)}`
    );
  }
  prevEntry = e;
}

console.log();

// Find PROBLEM spots: where words-per-second between anchors is abnormal
console.log('PROBLEM ANCHORS (WPS > 8 or < 0.3 between consecutive anchors):');
console.log('-'.repeat(100));
let problems = 0;
for (let i = 1; i < mono.length; i++) {
  const prev = mono[i - 1];
  const cur = mono[i];
  const dt = cur.t - prev.t;
  const dw = cur.msIdx - prev.msIdx;
  if (dt <= 0) continue;
  const wps = dw / dt;
  if (wps > 8 || wps < 0.3) {
    const prevMsWord = msWords[prev.msIdx] || '?';
    const curMsWord = msWords[cur.msIdx] || '?';
    const prevWWord = whisperWords[prev.wIdx]?.word || '?';
    const curWWord = whisperWords[cur.wIdx]?.word || '?';
    console.log(
      `[${i}] ${prev.t.toFixed(1)}s→${cur.t.toFixed(1)}s (${dt.toFixed(1)}s) ` +
      `msIdx ${prev.msIdx}→${cur.msIdx} (Δ${dw}) ` +
      `WPS=${wps.toFixed(1)} ` +
      `"${prevMsWord}"→"${curMsWord}" ` +
      `whisper:"${prevWWord}"→"${curWWord}"`
    );
    problems++;
  }
}
if (!problems) console.log('(none found)');
console.log(`Total problem spots: ${problems}`);
console.log();

// Show MISMATCHES: where ms word and whisper word look very different
console.log('WORST MISMATCHES (top 30 most different matched pairs):');
console.log('-'.repeat(80));
const mismatches = [];
alignment.forEach((match, mi) => {
  if (!match) return;
  const ms = (msWords[mi] || '').toLowerCase().replace(/[^a-z]/g, '');
  const wh = (whisperWords[match.wordIdx]?.word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!ms || !wh) return;
  if (ms === wh) return;
  // Simple diff score
  const maxLen = Math.max(ms.length, wh.length);
  let same = 0;
  for (let i = 0; i < Math.min(ms.length, wh.length); i++) {
    if (ms[i] === wh[i]) same++;
  }
  const diffPct = 1 - same / maxLen;
  mismatches.push({ mi, ms: msWords[mi], wh: whisperWords[match.wordIdx]?.word, diffPct, conf: match.confidence, wIdx: match.wordIdx, time: match.wordObj?.start });
});
mismatches.sort((a, b) => b.diffPct - a.diffPct);
mismatches.slice(0, 30).forEach(m => {
  console.log(`  ms[${m.mi}]="${m.ms}" → whisper[${m.wIdx}]="${m.wh}" @${m.time?.toFixed(1)}s conf=${m.conf?.toFixed(2)} diff=${(m.diffPct*100).toFixed(0)}%`);
});
console.log();

// Show ALIGNMENT POSITION DRIFT: for every 100th ms word, where does it think it is vs where it should be?
console.log('POSITION CHECK (expected vs actual whisper index for every 100th word):');
console.log('-'.repeat(80));
const expectedRatio = whisperWords.length / msWords.length;
for (let mi = 0; mi < msWords.length; mi += 100) {
  const match = alignment[mi];
  const expectedWi = Math.round(mi * expectedRatio);
  if (match) {
    const drift = match.wordIdx - expectedWi;
    const flag = Math.abs(drift) > 50 ? ' *** DRIFT ***' : '';
    console.log(`  ms[${mi}] "${msWords[mi]}" → whisper[${match.wordIdx}] "${whisperWords[match.wordIdx]?.word}" expected~${expectedWi} drift=${drift > 0 ? '+' : ''}${drift}${flag}`);
  } else {
    console.log(`  ms[${mi}] "${msWords[mi]}" → (no match) expected~${expectedWi}`);
  }
}
console.log();
console.log('='.repeat(80));
console.log('END OF REPORT');
