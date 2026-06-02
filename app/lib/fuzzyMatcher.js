/**
 * Fuzzy matcher: align Whisper transcript words with manuscript text
 * Handles: slight variations, contractions, punctuation, filler words,
 * homophones, and phonetic similarity (knox/nox, witch/which, etc.)
 */

function normalizeWord(w) {
  return String(w || '')
    .toLowerCase()
    .replace(/[^\w'-]/g, '')
    .trim();
}

const CANONICAL_EQUIVS = new Map([
  ['youre', 'your'], ['youve', 'you'], ['youd', 'you'], ['youll', 'you'],
  ['theyre', 'their'], ['there', 'their'], ['theyve', 'they'], ['theyd', 'they'], ['theyll', 'they'],
  ['its', 'it'], ['itll', 'it'],
  ['im', 'i'], ['ive', 'i'], ['id', 'i'], ['ill', 'i'],
  ['hes', 'he'], ['hed', 'he'], ['hell', 'he'],
  ['shes', 'she'], ['shed', 'she'], ['shell', 'she'],
  ['weve', 'we'], ['wed', 'we'], ['well', 'we'], ['were', 'we'],
  ['cant', 'can'], ['cannot', 'can'],
  ['wont', 'will'], ['wouldnt', 'would'],
  ['dont', 'do'], ['doesnt', 'does'],
  ['didnt', 'did'], ['couldnt', 'could'], ['shouldnt', 'should'],
  ['isnt', 'is'], ['arent', 'are'], ['wasnt', 'was'], ['werent', 'were'],
  ['hasnt', 'has'], ['havent', 'have'], ['hadnt', 'had'],
  ['thats', 'that'], ['whats', 'what'], ['whos', 'who'], ['wheres', 'where'],
  ['heres', 'here'], ['theres', 'there'],
  ['lets', 'let'],
  ['to', 'to'], ['too', 'to'], ['two', 'to'],
]);

// Homophones: groups of words that sound identical.
// Each group maps every member to the same canonical sound key.
const HOMOPHONE_GROUPS = [
  ['to', 'too', 'two'],
  ['their', 'there', 'theyre', 'theyr'],
  ['your', 'youre', 'youer'],
  ['its', 'its'],
  ['witch', 'which'],
  ['weather', 'whether'],
  ['know', 'no'], ['knew', 'new'], ['knight', 'night'],
  ['knox', 'nox', 'knocks', 'nocks'],
  ['write', 'right', 'rite', 'wright'],
  ['read', 'red'], ['reed', 'read'],
  ['sea', 'see'], ['seen', 'scene'],
  ['hear', 'here'], ['heard', 'herd'],
  ['where', 'wear', 'ware'],
  ['bare', 'bear'], ['pair', 'pear', 'pare'],
  ['wait', 'weight'], ['waist', 'waste'],
  ['whole', 'hole'], ['soul', 'sole'],
  ['piece', 'peace'], ['break', 'brake'],
  ['through', 'threw'], ['though', 'tho'],
  ['would', 'wood'], ['could', 'cud'],
  ['been', 'bin'], ['by', 'buy', 'bye'],
  ['dies', 'dyes'], ['die', 'dye'],
  ['flower', 'flour'], ['meet', 'meat'],
  ['feat', 'feet'], ['steal', 'steel'],
  ['tale', 'tail'], ['male', 'mail'],
  ['sale', 'sail'], ['pale', 'pail'],
  ['made', 'maid'], ['rain', 'reign', 'rein'],
  ['plain', 'plane'], ['vain', 'vane', 'vein'],
  ['one', 'won'], ['some', 'sum'],
  ['son', 'sun'], ['none', 'nun'],
  ['four', 'for', 'fore'], ['ate', 'eight'],
  ['eye', 'i', 'aye'],
  ['not', 'knot'], ['our', 'hour'],
  ['altar', 'alter'], ['forth', 'fourth'],
  ['board', 'bored'], ['course', 'coarse'],
  ['morning', 'mourning'], ['principal', 'principle'],
  ['council', 'counsel'], ['stationary', 'stationery'],
  ['led', 'lead'], ['passed', 'past'],
  ['aloud', 'allowed'], ['affect', 'effect'],
  ['accept', 'except'], ['than', 'then'],
  ['loose', 'lose'],
  ['were', 'where', 'wear'],
];
const HOMOPHONE_MAP = new Map();
HOMOPHONE_GROUPS.forEach((group, gi) => {
  const key = `~h${gi}`;
  group.forEach(w => HOMOPHONE_MAP.set(w.toLowerCase().replace(/[^a-z]/g, ''), key));
});

const NUMBER_WORDS = new Map([
  ['zero', '0'], ['one', '1'], ['two', '2'], ['three', '3'], ['four', '4'],
  ['five', '5'], ['six', '6'], ['seven', '7'], ['eight', '8'], ['nine', '9'],
  ['ten', '10'], ['first', '1st'], ['second', '2nd'], ['third', '3rd'],
]);

/**
 * Simple English phonetic normalization.
 * Reduces words to a rough pronunciation key so that
 * "knox" → "noks", "which" → "wich", "knight" → "nit", etc.
 */
function phoneticKey(w) {
  let s = normalizeWord(w).replace(/['-]/g, '');
  if (!s) return '';
  // Leading silent letters
  s = s.replace(/^kn/, 'n')
       .replace(/^wr/, 'r')
       .replace(/^gn/, 'n')
       .replace(/^pn/, 'n')
       .replace(/^ps/, 's')
       .replace(/^wh/, 'w');
  // Common sound patterns
  s = s.replace(/ght/g, 't')
       .replace(/ph/g, 'f')
       .replace(/ck/g, 'k')
       .replace(/tch/g, 'ch')
       .replace(/tion/g, 'shun')
       .replace(/sion/g, 'zhun')
       .replace(/ough/g, 'uf')
       .replace(/igh/g, 'i')
       .replace(/eigh/g, 'ay')
       .replace(/ould/g, 'ud')
       .replace(/ous/g, 'us')
       .replace(/ious/g, 'eus');
  // Double letters to single
  s = s.replace(/(.)\1+/g, '$1');
  // Trailing silent e
  if (s.length > 2 && s.endsWith('e')) s = s.slice(0, -1);
  return s;
}

function canonicalWord(w) {
  const n = normalizeWord(w).replace(/['-]/g, '');
  if (!n) return '';
  if (NUMBER_WORDS.has(n)) return NUMBER_WORDS.get(n);
  return CANONICAL_EQUIVS.get(n) || n;
}

/** Check if two words are homophones */
function isHomophone(a, b) {
  const na = normalizeWord(a).replace(/['-]/g, '');
  const nb = normalizeWord(b).replace(/['-]/g, '');
  if (!na || !nb) return false;
  // Direct homophone map
  const ha = HOMOPHONE_MAP.get(na);
  const hb = HOMOPHONE_MAP.get(nb);
  if (ha && hb && ha === hb) return true;
  // Phonetic key match
  const pa = phoneticKey(a);
  const pb = phoneticKey(b);
  if (pa && pb && pa === pb) return true;
  return false;
}

/**
 * Levenshtein distance for word similarity
 */
function wordDistance(a, b) {
  const na = normalizeWord(a);
  const nb = normalizeWord(b);
  if (!na || !nb) return 999;
  if (na === nb) return 0;
  
  const m = na.length, n = nb.length;
  const dp = Array(n + 1).fill(0).map((_, i) => i);
  
  for (let i = 1; i <= m; i++) {
    let prev = i;
    for (let j = 1; j <= n; j++) {
      const cost = na[i - 1] === nb[j - 1] ? 0 : 1;
      const tmp = Math.min(
        dp[j] + 1,      // delete
        prev + 1,       // insert
        dp[j - 1] + cost // replace
      );
      dp[j] = prev;
      prev = tmp;
    }
    dp[n] = prev;
  }
  return dp[n];
}

function isSimilar(a, b, threshold = 0.8) {
  const ca = canonicalWord(a);
  const cb = canonicalWord(b);
  if (ca && cb && ca === cb) return true;
  if (isHomophone(a, b)) return true;
  const dist = wordDistance(a, b);
  const maxLen = Math.max(normalizeWord(a).length, normalizeWord(b).length);
  return maxLen > 0 && (1 - dist / maxLen) >= threshold;
}

// Filler words / speech tags to skip
const FILLER_WORDS = new Set(['um', 'uh', 'err', 'erm', 'hmm', 'mm', 'ah', 'oh']);

/**
 * Align Whisper words with manuscript words using banded sequence alignment.
 * Treats the two word arrays as nearly-identical sequences (like diff).
 * Returns array mapping: msWordIdx -> { wordIdx, wordObj, confidence }
 */
export function alignTranscriptToManuscript(msWords, whisperWords, msSentenceBounds, skipMsIndices) {
  const msLen = msWords.length;
  const wLen = whisperWords.length;
  if (!msLen || !wLen) return new Array(msLen).fill(null);

  // Marie 2026-06-01: `skipMsIndices` is an optional Set of manuscript-
  // word positions that the matcher must NOT try to match against the
  // transcript. Used by Duet, where highlighted dialogue belongs to a
  // second narrator who hasn't recorded yet — those words exist in the
  // manuscript but not in the audio. Without this, the matcher tries
  // to find those words anyway, fails, and the failed-search noise
  // pushes nearby timestamps off by a word or two.
  const skipSet = (skipMsIndices instanceof Set) ? skipMsIndices : null;
  const isSkipped = skipSet ? (mi) => skipSet.has(mi) : () => false;

  const msNorm = msWords.map(normalizeWord);
  const wNorm = whisperWords.map(w => normalizeWord(w?.word));
  const msCanon = msWords.map(canonicalWord);
  const wCanon = whisperWords.map(w => canonicalWord(w?.word));

  // Similarity score between manuscript word mi and whisper word wi.
  // Returns 0..1 (1 = perfect match).
  function sim(mi, wi) {
    const mw = msNorm[mi];
    const ww = wNorm[wi];
    if (!mw || !ww) return 0;
    if (FILLER_WORDS.has(ww)) return 0;
    if (mw === ww) return 1.0;
    if (msCanon[mi] && wCanon[wi] && msCanon[mi] === wCanon[wi]) return 0.95;
    if (isHomophone(msWords[mi], whisperWords[wi]?.word)) return 0.95;
    if (phoneticKey(msWords[mi]) === phoneticKey(whisperWords[wi]?.word)) return 0.90;
    const dist = wordDistance(mw, ww);
    const maxLen = Math.max(mw.length, ww.length);
    return maxLen > 0 ? Math.max(0, 1 - dist / maxLen) : 0;
  }

  // ── Banded Needleman-Wunsch sequence alignment ──────────────────────
  // Aligns the two word sequences like a diff algorithm.
  // Band width scales with length difference to handle insertions/deletions.
  const BAND = Math.max(80, Math.abs(msLen - wLen) + 40);
  const MATCH_BONUS = 2;   // reward for matching words
  const MISMATCH_COST = -1; // cost for aligning non-matching words
  const GAP_COST = -0.5;   // cost for skipping a word on either side

  // Use two rows of DP (only need previous row + current row).
  // dp[j] = best score aligning ms[0..i-1] with whisper[0..j-1]
  // trace: store the move at each cell to reconstruct the path.
  // For memory: store trace as flat array.
  const traceRows = msLen + 1;
  const traceCols = wLen + 1;
  // Trace values: 0=unset, 1=diagonal(match/mismatch), 2=up(skip ms), 3=left(skip whisper)
  const trace = new Uint8Array(traceRows * traceCols);
  const NEG_INF = -1e9;

  let prev = new Float32Array(wLen + 1).fill(NEG_INF);
  let curr = new Float32Array(wLen + 1).fill(NEG_INF);
  prev[0] = 0;
  // Initialize first row: gaps in whisper (skipping whisper words)
  for (let j = 1; j <= wLen && j <= BAND; j++) {
    prev[j] = j * GAP_COST;
    trace[j] = 3; // left
  }

  for (let i = 1; i <= msLen; i++) {
    curr.fill(NEG_INF);
    const jCenter = Math.round((i / msLen) * wLen);
    const jMin = Math.max(1, jCenter - BAND);
    const jMax = Math.min(wLen, jCenter + BAND);

    // Marie 2026-06-01: if the ms word at (i-1) is highlighted (second
    // narrator's line, not in the audio), force the path through this
    // row to ALWAYS skip it. The trace records "up" (skip ms word) at
    // every cell in the band, with NO cost — it's an expected absence,
    // not a normal gap. This stops the matcher from trying to match
    // these words against unrelated whisper words and pulling the
    // surrounding path off-track.
    if (isSkipped(i - 1)) {
      if (jMin === 1) {
        curr[0] = prev[0] > NEG_INF ? prev[0] : NEG_INF;
        trace[i * traceCols] = 2; // up
      }
      for (let j = jMin; j <= jMax; j++) {
        curr[j] = prev[j] > NEG_INF ? prev[j] : NEG_INF;
        trace[i * traceCols + j] = 2; // up — skip ms word, no penalty
      }
      const tmpS = prev; prev = curr; curr = tmpS;
      continue;
    }

    // Gap: skip this ms word
    if (jMin === 1) {
      curr[0] = i * GAP_COST;
      trace[i * traceCols] = 2; // up
    }

    for (let j = jMin; j <= jMax; j++) {
      const s = sim(i - 1, j - 1);
      const diagScore = (prev[j - 1] > NEG_INF)
        ? prev[j - 1] + (s >= 0.5 ? s * MATCH_BONUS : MISMATCH_COST)
        : NEG_INF;
      const upScore = (curr[j - 1] > NEG_INF) ? curr[j - 1] + GAP_COST : NEG_INF; // skip whisper word
      const leftScore = (prev[j] > NEG_INF) ? prev[j] + GAP_COST : NEG_INF; // skip ms word

      let best = diagScore;
      let move = 1;
      if (upScore > best) { best = upScore; move = 3; }
      if (leftScore > best) { best = leftScore; move = 2; }
      curr[j] = best;
      trace[i * traceCols + j] = move;
    }

    // Swap rows
    const tmp = prev; prev = curr; curr = tmp;
  }

  // ── Traceback ──────────────────────────────────────────────────────
  const alignment = new Array(msLen).fill(null);
  let i = msLen, j = wLen;
  // Find best j endpoint (in case band doesn't reach exact corner)
  if (prev[j] <= NEG_INF) {
    let bestJ = j;
    let bestVal = NEG_INF;
    for (let jj = Math.max(0, j - BAND); jj <= Math.min(wLen, j + BAND); jj++) {
      if (prev[jj] > bestVal) { bestVal = prev[jj]; bestJ = jj; }
    }
    j = bestJ;
  }

  while (i > 0 && j > 0) {
    const move = trace[i * traceCols + j];
    if (move === 1) { // diagonal — ms[i-1] aligned with whisper[j-1]
      const s = sim(i - 1, j - 1);
      if (s >= 0.35) {
        alignment[i - 1] = {
          wordIdx: j - 1,
          wordObj: whisperWords[j - 1],
          confidence: Math.max(0.4, Math.min(0.99, s)),
        };
      }
      i--; j--;
    } else if (move === 2) { // up — skip ms word (no whisper match)
      i--;
    } else if (move === 3) { // left — skip whisper word (extra in transcript)
      j--;
    } else {
      break; // shouldn't happen, safety exit
    }
  }

  const matchCount = alignment.filter(Boolean).length;
  console.log(`Sequence alignment: ${matchCount}/${msLen} matched (${(matchCount/msLen*100).toFixed(1)}%), band=${BAND}`);

  // ── Gap-fill pass: interpolate unmatched ms words between anchors ──
  // For ms words that didn't match (insertions/deletions), assign them
  // a whisper word by linear interpolation if a nearby whisper word is similar.
  const used = new Set();
  alignment.forEach(m => { if (m?.wordIdx != null) used.add(m.wordIdx); });

  for (let mi = 0; mi < msLen; mi++) {
    if (alignment[mi]) continue;
    if (!msNorm[mi]) continue;

    // Find nearest anchors on each side
    let prev = mi - 1;
    while (prev >= 0 && !alignment[prev]) prev--;
    let next = mi + 1;
    while (next < msLen && !alignment[next]) next++;

    const prevWi = prev >= 0 ? alignment[prev].wordIdx : -1;
    const nextWi = next < msLen ? alignment[next].wordIdx : wLen;
    const gapMs = (next < msLen ? next : msLen) - (prev >= 0 ? prev : -1) - 1;
    if (gapMs > 50) continue; // too large a gap to interpolate reliably

    const searchStart = Math.max(0, prevWi + 1);
    const searchEnd = Math.min(wLen - 1, nextWi - 1);
    if (searchEnd < searchStart) continue;

    // Project expected whisper position
    const alpha = prev >= 0 && next < msLen
      ? (mi - prev) / (next - prev)
      : prev >= 0 ? 1 : 0;
    const projected = prev >= 0 && next < msLen
      ? Math.round(prevWi + alpha * (nextWi - prevWi))
      : prev >= 0 ? prevWi + (mi - prev) : nextWi - (next - mi);

    let bestWi = -1, bestSim = 0;
    for (let wi = searchStart; wi <= searchEnd; wi++) {
      if (used.has(wi)) continue;
      const s = sim(mi, wi);
      if (s <= bestSim) continue;
      // Prefer candidates near projected position
      const posPenalty = Math.abs(wi - projected) * 0.01;
      if (s - posPenalty > bestSim - 0.01) {
        bestSim = s;
        bestWi = wi;
      }
    }

    if (bestWi >= 0 && bestSim >= 0.45) {
      alignment[mi] = {
        wordIdx: bestWi,
        wordObj: whisperWords[bestWi],
        confidence: Math.max(0.35, Math.min(0.85, bestSim * 0.9)),
      };
      used.add(bestWi);
    }
  }

  const finalCount = alignment.filter(Boolean).length;
  console.log(`After gap-fill: ${finalCount}/${msLen} matched (${(finalCount/msLen*100).toFixed(1)}%)`);

  return alignment;
}

/**
 * Convert alignment array into a function that gets timestamp for a manuscript word index
 */
export function buildTimestampLookup(alignment) {
  return (msWordIdx) => {
    const match = alignment[msWordIdx];
    if (!match || !match.wordObj) return null;
    return {
      start: match.wordObj.start,
      end: match.wordObj.end,
      confidence: match.confidence,
    };
  };
}
