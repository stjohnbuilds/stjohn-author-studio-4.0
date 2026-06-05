// Builds an exact plain-text view of a chapter's HTML plus per-word-box
// position metadata. The reader's flag-quote builder uses this to slice
// the ORIGINAL sentence out of the source, instead of re-joining word
// boxes with `.join(' ')` — which leaks a fake space whenever an inline
// formatting boundary (italic, span, tracked-change marker) falls inside
// a word ("Kar<span>ma</span>" → "Kar ma" bug).
//
// Same word-split order as ChapterReader's DOM walk, so the unit index a
// flag stores matches the entry in `unitMeta`.
//
// Pure string-based. Safe to import in tests, server components, etc.

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'UL', 'OL', 'LI',
]);

const NAMED_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
};

const ENTITY_RE = /&(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);/g;
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

function decodeEntities(s) {
  return String(s).replace(ENTITY_RE, (m) => {
    if (NAMED_ENTITIES[m]) return NAMED_ENTITIES[m];
    if (m.startsWith('&#x')) return String.fromCodePoint(parseInt(m.slice(3, -1), 16));
    if (m.startsWith('&#')) return String.fromCodePoint(Number(m.slice(2, -1)));
    return m;
  });
}

export function buildChapterPlainTextIndex(html, splitMode = 'whitespace') {
  const source = String(html || '');
  const splitSource = splitMode === 'whitespace' ? '\\S+' : "[A-Za-z0-9']+";
  const plainParts = [];
  let plainLen = 0;
  const unitMeta = [];

  function ensureBlockBreak() {
    if (plainLen === 0) return;
    const last = plainParts[plainParts.length - 1] || '';
    if (/\s$/.test(last)) return;
    plainParts.push('\n');
    plainLen += 1;
  }

  function processText(text) {
    if (!text) return;
    const re = new RegExp(splitSource, 'g');
    const matches = [];
    let mm;
    while ((mm = re.exec(text)) !== null) {
      matches.push({ value: mm[0], start: mm.index, end: mm.index + mm[0].length });
    }
    if (!matches.length) {
      plainParts.push(text);
      plainLen += text.length;
      return;
    }
    if (matches[0].start > 0) {
      const lead = text.slice(0, matches[0].start);
      plainParts.push(lead);
      plainLen += lead.length;
    }
    matches.forEach((it, i) => {
      const next = matches[i + 1];
      const after = text.slice(it.end, next ? next.start : text.length);
      const plainStart = plainLen;
      plainParts.push(it.value);
      plainLen += it.value.length;
      const plainNext = plainLen + after.length;
      plainParts.push(after);
      plainLen += after.length;
      unitMeta.push({ plainStart, plainNext });
    });
  }

  TAG_RE.lastIndex = 0;
  let cursor = 0;
  let m;
  while ((m = TAG_RE.exec(source)) !== null) {
    if (m.index > cursor) {
      processText(decodeEntities(source.slice(cursor, m.index)));
    }
    const isClose = !!m[1];
    const tag = m[2].toUpperCase();
    if (tag === 'BR') {
      ensureBlockBreak();
    } else if (BLOCK_TAGS.has(tag) && !isClose) {
      ensureBlockBreak();
    }
    cursor = TAG_RE.lastIndex;
  }
  if (cursor < source.length) {
    processText(decodeEntities(source.slice(cursor)));
  }

  return { plainText: plainParts.join(''), unitMeta };
}

// Slice the chapter's plain text from unit a through unit b (inclusive),
// collapsed and trimmed. Returns '' if either index is missing.
export function sliceUnitsRange(index, startIdx, endIdx) {
  if (!index || !Array.isArray(index.unitMeta)) return '';
  const a = index.unitMeta[startIdx];
  const b = index.unitMeta[endIdx];
  if (!a || !b) return '';
  return index.plainText.slice(a.plainStart, b.plainNext).replace(/\s+/g, ' ').trim();
}

// Position where unit's word ENDS (excluding its trailing whitespace).
// Used to build sentHtml where the clicked word gets wrapped in <em>.
export function unitWordEnd(index, idx) {
  if (!index || !Array.isArray(index.unitMeta)) return null;
  const u = index.unitMeta[idx];
  if (!u) return null;
  const span = index.plainText.slice(u.plainStart, u.plainNext);
  const wordOnly = span.match(/^\S*/);
  return u.plainStart + (wordOnly ? wordOnly[0].length : 0);
}

// Tally word counts per character within a chapter's HTML by walking
// the existing highlight-class spans that mammoth injected at import
// (<span class="hl-yellow"> / hl-pink / etc.). Each entry in
// narratorColors pairs a class name (and hex) with a character +
// narrator, so we use the SAME mapping the reader uses per-word.
//
// Inputs:
//   sectionHtml    — section.html as it came out of mammoth.
//   narratorColors — book.narratorColors. Each row: { cls, hex,
//                    characterName, narratorName }.
//
// Returns:
//   { tallies, narratorKey }  where tallies is { [characterName]: wordCount }
//   plus tallies[narratorKey] for words NOT in any character span.
//   Returns null if there are no mapped characters at all (caller can
//   then fall through to its old per-section behaviour).
//
// No DOM. No fetch. No new persisted data — derives entirely from
// what's already on disk + the existing mapping. The breakdown is
// proportional: a chapter that's 80% pink + 20% no-highlight emits two
// rows weighted 80/20, and the duration aggregator splits the chapter's
// runtime by that weight.
const NARRATOR_KEY = '__narrator__';
export { NARRATOR_KEY };

function normHex(h) {
  if (!h) return '';
  let s = String(h).trim().toLowerCase().replace(/^#/, '');
  // Expand 3-char hex (#abc → #aabbcc) so all comparisons are uniform.
  if (/^[0-9a-f]{3}$/.test(s)) s = s.split('').map((c) => c + c).join('');
  return /^[0-9a-f]{6}$/.test(s) ? s : '';
}

// Euclidean distance in RGB space — mirrors detectNarrator() in
// ProofingReader. Used to tolerate small drift between the .docx's
// actual color and the hex we saved on the narrator entry.
function hexDist(a, b) {
  if (!a || !b) return Infinity;
  const ah = parseInt(a, 16);
  const bh = parseInt(b, 16);
  if (!Number.isFinite(ah) || !Number.isFinite(bh)) return Infinity;
  let sum = 0;
  for (const s of [16, 8, 0]) {
    const av = (ah >> s) & 255;
    const bv = (bh >> s) & 255;
    sum += (av - bv) * (av - bv);
  }
  return Math.sqrt(sum);
}
const HEX_DIST_THRESHOLD = 85;
const SKIP_HEXES = new Set([
  'ffffff', 'fafafa', 'fafaf7', 'f5f5f5', 'f0fdf4', 'fffffe', 'fefefe',
]);

export function tallyCharacterWordCounts(sectionHtml, narratorColors) {
  const source = String(sectionHtml || '');
  // Build BOTH a class map and a hex map. The hex map is essential for
  // Marie's case: narrator entries created from shading-extraction OR
  // from the manual color-picker have `cls: null` (see ManuscriptSetup.js
  // lines 158-176), so the original class-only match silently produced
  // an empty classMap → null result → fallback to the old per-section
  // breakdown. Mammoth's output for any highlight has the hex baked in
  // as an inline style (`style="background:#FDDEE8"` from applyHexColors),
  // so a hex match catches every case the class match misses.
  const classMap = new Map();
  const hexList = []; // [{ name, hex }] — fuzzy-distance matched, not exact
  (narratorColors || []).forEach((nc) => {
    const name = String(nc?.characterName || '').trim();
    if (!name) return;
    const cls = String(nc?.cls || '').trim();
    if (cls) classMap.set(cls, name);
    const hex = normHex(nc?.hex);
    if (hex) hexList.push({ name, hex });
  });
  if (!classMap.size && !hexList.length) return null;
  function bestHexMatch(spanHex) {
    if (!spanHex || SKIP_HEXES.has(spanHex)) return null;
    let best = null;
    let bd = Infinity;
    for (const entry of hexList) {
      const d = hexDist(spanHex, entry.hex);
      if (d < bd) { bd = d; best = entry; }
    }
    return best && bd < HEX_DIST_THRESHOLD ? best.name : null;
  }

  const tallies = {};
  const add = (key, w) => { if (w > 0) tallies[key] = (tallies[key] || 0) + w; };
  const countWords = (s) => {
    const m = String(s || '').match(/\S+/g);
    return m ? m.length : 0;
  };

  function attrsToChar(attrs, parentChar) {
    // 1) Class match — predefined hl-yellow/hl-pink/etc. when narrator
    //    entry carries that class.
    const classMatch = attrs.match(/class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const classStr = classMatch ? (classMatch[1] || classMatch[2] || classMatch[3] || '') : '';
    if (classStr && classMap.size) {
      for (const c of classStr.split(/\s+/)) {
        if (classMap.has(c)) return classMap.get(c);
      }
    }
    // 2) Inline-style hex match. Fuzzy distance (mirrors Proof's
    //    detectNarrator) so a span hex that's a few RGB points off
    //    from the saved narrator hex still routes to the right
    //    character. Covers all cases where cls is null but hex is
    //    set — manual color picks, shading-detected colors, etc.
    if (hexList.length) {
      const styleMatch = attrs.match(/style\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const styleStr = styleMatch ? (styleMatch[1] || styleMatch[2] || '') : '';
      if (styleStr) {
        const hexAll = styleStr.match(/#([0-9a-fA-F]{3,6})/g) || [];
        for (const raw of hexAll) {
          const h = normHex(raw);
          const matched = bestHexMatch(h);
          if (matched) return matched;
        }
      }
    }
    return parentChar;
  }

  // Stack of active character contexts. Each frame is { tag, char }.
  const stack = [];
  let cursor = 0;
  TAG_RE.lastIndex = 0;
  let m;
  while ((m = TAG_RE.exec(source)) !== null) {
    if (m.index > cursor) {
      const text = source.slice(cursor, m.index);
      const decoded = text.replace(/&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;/g, ' ');
      const active = stack.length ? stack[stack.length - 1].char : null;
      add(active || NARRATOR_KEY, countWords(decoded));
    }
    const isClose = !!m[1];
    const tag = m[2].toUpperCase();
    if (tag === 'SPAN' && !isClose) {
      const parentChar = stack.length ? stack[stack.length - 1].char : null;
      const char = attrsToChar(m[0], parentChar);
      stack.push({ tag: 'SPAN', char });
    } else if (tag === 'SPAN' && isClose) {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].tag === 'SPAN') { stack.splice(i, 1); break; }
      }
    }
    cursor = TAG_RE.lastIndex;
  }
  if (cursor < source.length) {
    const text = source.slice(cursor);
    const decoded = text.replace(/&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;/g, ' ');
    const active = stack.length ? stack[stack.length - 1].char : null;
    add(active || NARRATOR_KEY, countWords(decoded));
  }
  return { tallies, narratorKey: NARRATOR_KEY };
}
