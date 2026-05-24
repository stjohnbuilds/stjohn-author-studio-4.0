// Diagnose: what does the sync table actually do at specific times?
// Simulates exactly what ProofingReader.buildDirectSyncTable + getMsIdxAtTime does.
import fs from 'fs';

const data = JSON.parse(fs.readFileSync('Save Data/books.json', 'utf8'));
const sec = data[0].chapters[0].sections[0];
const alignment = sec.whisperAlignment || [];
const whisperWords = sec.whisperWords || [];
const html = (sec.html || '').replace(/<[^>]+>/g, ' ');
const msWords = html.match(/[A-Za-z0-9']+/g) || [];

console.log(`MS words: ${msWords.length}, Whisper words: ${whisperWords.length}`);
console.log(`Alignment entries: ${alignment.length}, non-null: ${alignment.filter(Boolean).length}`);

// Rebuild sync table exactly as ProofingReader does
const rows = [];
(alignment || []).forEach((match, msIdx) => {
  if (!match?.wordObj || !Number.isFinite(match.wordObj.start)) return;
  if ((Number(match.confidence) || 0) < 0.35) return;
  rows.push({ t: match.wordObj.start, msIdx, conf: match.confidence });
});
rows.sort((a, b) => a.t - b.t);

const mono = [rows[0]];
for (let i = 1; i < rows.length; i++) {
  const prev = mono[mono.length - 1];
  if (rows[i].t <= prev.t + 0.01 || rows[i].msIdx <= prev.msIdx) continue;
  mono.push(rows[i]);
}

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

console.log(`\nSync table: ${rows.length} raw → ${mono.length} monotonic → ${cleaned.length} cleaned`);
console.log(`avgWps=${avgWps.toFixed(2)}, maxWps=${maxWps.toFixed(2)}`);
console.log(`Time range: ${cleaned[0].t.toFixed(1)}s to ${cleaned[cleaned.length-1].t.toFixed(1)}s`);
console.log(`Word range: ms[${cleaned[0].msIdx}] to ms[${cleaned[cleaned.length-1].msIdx}]`);

// Find "For as long as I was here" in manuscript
const searchPhrases = [
  'For as long as I was here',
  'At our side Ace and Knox remained',
  'After another hazy nap',
  'while I put together a',
];
console.log('\n=== KEY PHRASE LOCATIONS ===');
const fullText = msWords.join(' ');
for (const phrase of searchPhrases) {
  const words = phrase.split(/\s+/);
  for (let i = 0; i <= msWords.length - words.length; i++) {
    const slice = msWords.slice(i, i + words.length).join(' ');
    if (slice.toLowerCase() === phrase.toLowerCase()) {
      const m = alignment[i];
      const whisperTime = m?.wordObj?.start;
      console.log(`  "${phrase}" → ms[${i}], whisper time=${whisperTime?.toFixed(1) ?? 'none'}s`);
      break;
    }
  }
}

// Binary search function (same as ProofingReader)
function getMsIdxAtTime(tbl, audioTime) {
  if (tbl.length < 2) return -1;
  let lo = 0, hi = tbl.length - 1, left = null, right = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tbl[mid].t <= audioTime) { left = tbl[mid]; lo = mid + 1; }
    else { right = tbl[mid]; hi = mid - 1; }
  }
  if (left && right) {
    const alpha = (audioTime - left.t) / (right.t - left.t);
    return Math.round(left.msIdx + alpha * (right.msIdx - left.msIdx));
  }
  if (left) return left.msIdx;
  if (right) return right.msIdx;
  return -1;
}

// Simulate what happens at every 30 seconds
console.log('\n=== SYNC TABLE LOOKUP (every 30s) ===');
console.log('Audio Time → msIdx → word | Whisper at same time');
for (let t = 0; t <= 1320; t += 30) {
  const msIdx = getMsIdxAtTime(cleaned, t);
  const word = msWords[msIdx] || '?';
  // Also find what whisper word is at this time
  let wIdx = 0;
  for (let w = 0; w < whisperWords.length; w++) {
    if (whisperWords[w]?.start <= t) wIdx = w;
    else break;
  }
  const wWord = whisperWords[wIdx]?.word || '?';
  const mins = Math.floor(t / 60);
  const secs = t % 60;
  const aligned = alignment[msIdx];
  const alignedWi = aligned?.wordIdx;
  const alignedWord = alignedWi != null ? whisperWords[alignedWi]?.word : '?';
  console.log(`  ${mins}:${String(secs).padStart(2,'0')} → ms[${msIdx}]="${word}" (aligned→whisper[${alignedWi}]="${alignedWord}") | audio_whisper[${wIdx}]="${wWord}"`);
}

// Detailed view around 20:36 (1236 seconds)
console.log('\n=== DETAILED VIEW AT 20:30-20:45 ===');
for (let t = 1230; t <= 1245; t += 1) {
  const msIdx = getMsIdxAtTime(cleaned, t);
  const word = msWords[msIdx] || '?';
  let wIdx = 0;
  for (let w = 0; w < whisperWords.length; w++) {
    if (whisperWords[w]?.start <= t) wIdx = w;
    else break;
  }
  const wWord = whisperWords[wIdx]?.word || '?';
  const context = whisperWords.slice(Math.max(0, wIdx-3), wIdx+4).map(w => w?.word).join(' ');
  console.log(`  ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')} → ms[${msIdx}]="${word}" | audio="${context}"`);
}

// Check: are there sync table entries that jump too far?
console.log('\n=== SYNC TABLE GAPS (biggest jumps) ===');
const gaps = [];
for (let i = 1; i < cleaned.length; i++) {
  const dt = cleaned[i].t - cleaned[i-1].t;
  const dw = cleaned[i].msIdx - cleaned[i-1].msIdx;
  const wps = dt > 0 ? dw / dt : 0;
  gaps.push({ i, dt, dw, wps, t: cleaned[i-1].t, msIdx: cleaned[i-1].msIdx });
}
gaps.sort((a, b) => b.wps - a.wps);
console.log('Top 10 highest WPS (words-per-second) jumps:');
gaps.slice(0, 10).forEach(g => {
  const mins = Math.floor(g.t / 60);
  const secs = (g.t % 60).toFixed(1);
  console.log(`  @${mins}:${secs.padStart(4,'0')} → dt=${g.dt.toFixed(2)}s dw=${g.dw} wps=${g.wps.toFixed(1)} ms[${g.msIdx}]="${msWords[g.msIdx]}"`);
});

// Also show the last 20 entries of the sync table
console.log('\n=== LAST 20 SYNC TABLE ENTRIES ===');
const last20 = cleaned.slice(-20);
last20.forEach(entry => {
  const mins = Math.floor(entry.t / 60);
  const secs = (entry.t % 60).toFixed(1);
  console.log(`  ${mins}:${secs.padStart(4,'0')} → ms[${entry.msIdx}] "${msWords[entry.msIdx]}" conf=${entry.conf.toFixed(2)}`);
});
