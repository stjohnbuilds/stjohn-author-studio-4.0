function normalizeSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim();
}

function parsePrintedPageNumber(text) {
  const raw = String(text || '').replace(/[\s\-–—]+/g, '').trim();
  if (!/^\d{1,4}$/.test(raw)) return null;
  const pageNumber = Number(raw);
  return pageNumber > 0 ? pageNumber : null;
}

function buildLineText(items) {
  return items
    .slice()
    .sort((a, b) => a.x - b.x)
    .map(item => String(item.str || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupTextItemsIntoLines(items) {
  const sorted = items
    .filter(item => String(item?.str || '').trim())
    .map(item => ({
      str: String(item.str || ''),
      x: Number(item.transform?.[4]) || 0,
      y: Number(item.transform?.[5]) || 0,
    }))
    .sort((a, b) => {
      const dy = b.y - a.y;
      if (Math.abs(dy) > 2.5) return dy;
      return a.x - b.x;
    });

  const lines = [];
  for (const item of sorted) {
    const prev = lines[lines.length - 1];
    if (!prev || Math.abs(prev.y - item.y) > 2.5) {
      lines.push({ y: item.y, items: [item] });
      continue;
    }
    prev.items.push(item);
  }

  return lines.map(line => ({
    y: line.y,
    text: buildLineText(line.items),
  })).filter(line => line.text);
}

function detectPrintedPageNumber(lines) {
  const bottomFirst = [...lines].sort((a, b) => a.y - b.y);
  const topFirst = [...lines].sort((a, b) => b.y - a.y);
  const candidates = [
    ...bottomFirst.slice(0, 3).map(line => ({ ...line, position: 'bottom' })),
    ...topFirst.slice(0, 2).map(line => ({ ...line, position: 'top' })),
  ];

  for (const line of candidates) {
    const pageNumber = parsePrintedPageNumber(line.text);
    if (pageNumber != null) {
      return { pageNumber, position: line.position };
    }
  }

  return null;
}

function extractQuotedChunks(rawText) {
  const text = String(rawText || '');
  const chunks = [];
  const patterns = [/"([^\"]+)"/g, /'([^']+)'/g];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const chunk = normalizeSearchText(match[1]);
      if (chunk.length >= 12) chunks.push(chunk);
    }
  }

  return chunks;
}

function buildSearchKeys(rawQuote) {
  const keys = [];
  keys.push(...extractQuotedChunks(rawQuote));

  const full = normalizeSearchText(rawQuote);
  if (full.length >= 18) keys.push(full);

  for (const length of [80, 60, 45, 30]) {
    const key = full.slice(0, length).trim();
    if (key.length >= 18) keys.push(key);
  }

  const deduped = [];
  const seen = new Set();
  for (const key of keys) {
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(key);
    }
  }
  return deduped;
}

function getMedian(values) {
  const sorted = values
    .filter(v => Number.isFinite(v))
    .slice()
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function inferPdfPageNumbers(rawPages) {
  const pages = Array.isArray(rawPages) ? rawPages.slice() : [];
  if (!pages.length) return pages;

  const printedAnchors = pages.filter(p => p.pageNumberSource === 'printed');
  if (!printedAnchors.length) return pages;

  const rawOffsets = printedAnchors.map(p => Number(p.pageNumber) - Number(p.pageIndex));
  const medianOffset = getMedian(rawOffsets);
  const stableAnchors = printedAnchors.filter(p => {
    const offset = Number(p.pageNumber) - Number(p.pageIndex);
    return medianOffset == null ? true : Math.abs(offset - medianOffset) <= 8;
  });
  const anchors = stableAnchors.length >= 2 ? stableAnchors : printedAnchors;

  const byIndex = new Map(anchors.map(a => [Number(a.pageIndex), a]));
  const sortedAnchors = anchors.slice().sort((a, b) => Number(a.pageIndex) - Number(b.pageIndex));
  const fallbackOffset = getMedian(anchors.map(a => Number(a.pageNumber) - Number(a.pageIndex))) ?? 0;

  for (let i = 0; i < pages.length; i += 1) {
    const current = pages[i];
    if (current.pageNumberSource === 'printed') continue;

    const pageIndex = Number(current.pageIndex) || i + 1;
    let left = null;
    let right = null;

    for (let j = i - 1; j >= 0; j -= 1) {
      const candidate = pages[j];
      if (byIndex.has(Number(candidate.pageIndex))) {
        left = byIndex.get(Number(candidate.pageIndex));
        break;
      }
    }

    for (let j = i + 1; j < pages.length; j += 1) {
      const candidate = pages[j];
      if (byIndex.has(Number(candidate.pageIndex))) {
        right = byIndex.get(Number(candidate.pageIndex));
        break;
      }
    }

    let inferred;
    if (left && right) {
      const fromLeft = Number(left.pageNumber) + (pageIndex - Number(left.pageIndex));
      const fromRight = Number(right.pageNumber) - (Number(right.pageIndex) - pageIndex);
      inferred = Math.abs(fromLeft - fromRight) <= 2
        ? Math.round((fromLeft + fromRight) / 2)
        : Math.round(pageIndex + fallbackOffset);
    } else if (left) {
      inferred = Math.round(Number(left.pageNumber) + (pageIndex - Number(left.pageIndex)));
    } else if (right) {
      inferred = Math.round(Number(right.pageNumber) - (Number(right.pageIndex) - pageIndex));
    } else {
      inferred = Math.round(pageIndex + fallbackOffset);
    }

    current.pageNumber = Math.max(1, inferred);
    current.pageNumberSource = 'inferred';
  }

  // Final monotonic cleanup for noisy anchors.
  for (let i = 1; i < pages.length; i += 1) {
    const prev = Number(pages[i - 1].pageNumber) || 1;
    const curr = Number(pages[i].pageNumber) || prev;
    if (curr < prev) pages[i].pageNumber = prev;
  }

  // Ensure anchors themselves stay trusted if they are stable.
  for (const anchor of sortedAnchors) {
    const idx = Number(anchor.pageIndex) - 1;
    if (idx >= 0 && idx < pages.length) {
      pages[idx].pageNumber = Number(anchor.pageNumber);
      pages[idx].pageNumberSource = 'printed';
    }
  }

  return pages;
}

let pdfWorkerConfigured = false;

function ensurePdfWorkerConfigured(pdfjs) {
  if (pdfWorkerConfigured) return;
  try {
    // In Electron we parse PDFs on the main thread, but pdf.js still expects
    // workerSrc to be set in some code paths.
    const workerSrc = 'data:application/javascript;base64,IA==';
    if (pdfjs?.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      pdfWorkerConfigured = true;
    }
  } catch {
    // Keep going; getDocument may still succeed depending on runtime.
  }
}

export async function extractPdfPagingFromFile(file, options = {}) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  ensurePdfWorkerConfigured(pdfjs);
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data, disableWorker: true });
  const pdf = await loadingTask.promise;
  const pages = [];
  const normalizedOffset = Number.isFinite(Number(options?.pageOffset)) ? Number(options.pageOffset) : 0;

  try {
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const lines = groupTextItemsIntoLines(textContent.items || []);
      const fullText = lines.map(line => line.text).join(' ').replace(/\s+/g, ' ').trim();
      const printed = detectPrintedPageNumber(lines);

      pages.push({
        pageIndex,
        pageNumber: printed?.pageNumber || Math.max(1, pageIndex + normalizedOffset),
        pageNumberSource: printed ? 'printed' : (normalizedOffset !== 0 ? 'offset' : 'index'),
        normalizedText: normalizeSearchText(fullText),
      });
    }
  } finally {
    pdf.cleanup?.();
    loadingTask.destroy?.();
  }

  const calibratedPages = inferPdfPageNumbers(pages);

  return {
    mode: 'pdf-text',
    fileName: file.name,
    pageOffset: normalizedOffset,
    pageCount: pdf.numPages,
    printedPageCount: calibratedPages.filter(page => page.pageNumberSource === 'printed').length,
    pages: calibratedPages,
  };
}

export function findPdfPageForQuote(quote, pdfPaging, hintPageNumber) {
  const rawPages = Array.isArray(pdfPaging?.pages) ? pdfPaging.pages : [];
  const pages = rawPages.map(page => ({ ...page }));
  if (!pages.length) return null;
  const pageCount = Math.max(1, Number(pdfPaging?.pageCount) || pages.length);
  const offset = Number.isFinite(Number(pdfPaging?.pageOffset)) ? Number(pdfPaging.pageOffset) : -1;
  const maxBound = Math.max(1, pageCount + Math.max(0, offset));

  const keys = buildSearchKeys(quote);
  if (!keys.length) return null;

  for (const key of keys) {
    const matches = pages.filter(page => String(page.normalizedText || '').includes(key));
    if (!matches.length) continue;

    const uniquePages = [...new Set(matches.map(match => Number(match.pageNumber) || Number(match.pageIndex) || 1))].sort((a, b) => a - b);

    // Single match — the easy case, exact answer.
    if (uniquePages.length === 1) {
      const candidatePage = uniquePages[0];
      if (candidatePage < 1 || candidatePage > maxBound) return null;
      const only = matches.find(match => (Number(match.pageNumber) || Number(match.pageIndex) || 1) === uniquePages[0]) || matches[0];
      return {
        pageNumber: candidatePage,
        pageIndex: Number(only.pageIndex) || 1,
        score: 100,
        distance: Number.isFinite(hintPageNumber) ? Math.abs(candidatePage - hintPageNumber) : 0,
        source: only.pageNumberSource || 'index',
      };
    }

    // Marie 2026-06-01: 3.0 returned null here. We do better — when the
    // sentence appears on multiple pages (e.g. a duplicated line of
    // dialogue), pick the page closest to the word-count hint. Only
    // applies when we have a hint; otherwise fall through to the next
    // (shorter) search key.
    if (Number.isFinite(hintPageNumber)) {
      const inBounds = uniquePages.filter(p => p >= 1 && p <= maxBound);
      if (inBounds.length) {
        let best = inBounds[0];
        let bestDist = Math.abs(best - hintPageNumber);
        for (const p of inBounds.slice(1)) {
          const d = Math.abs(p - hintPageNumber);
          if (d < bestDist) { best = p; bestDist = d; }
        }
        const winner = matches.find(match => (Number(match.pageNumber) || Number(match.pageIndex) || 1) === best) || matches[0];
        return {
          pageNumber: best,
          pageIndex: Number(winner.pageIndex) || 1,
          score: 80,
          distance: bestDist,
          source: winner.pageNumberSource || 'index',
        };
      }
    }

    // No hint — give up on this key, try a shorter one (or fall through).
  }

  return null;
}

// Marie 2026-05-26: the slim word-index → printed-page map. Built once
// at PDF import; the ONLY thing we keep from the heavy `pdfPaging.pages`
// array (which we strip from cloud uploads). Replaces the fragile
// quote-search approach with a deterministic lookup.
//
// Returns an array of { wordStart, pageNumber } anchors, sorted by
// wordStart. To look up "what page is word #N on?", find the last
// anchor whose wordStart <= N.

function tokenizeForMatch(text) {
  // Same token rule as the reader: lowercase, alphanumeric + apostrophe.
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .match(/[a-z0-9']+/g) || [];
}

export function extractManuscriptWordsFromHtml(html) {
  if (!html) return [];
  const text = String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return tokenizeForMatch(text);
}

function findWordSequence(haystack, needle, startIdx) {
  if (!needle.length || !haystack.length) return -1;
  const end = haystack.length - needle.length;
  for (let i = Math.max(0, startIdx); i <= end; i += 1) {
    let match = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}

export function buildSlimPageMap(pdfPages, manuscriptHtmlOrWords) {
  if (!Array.isArray(pdfPages) || !pdfPages.length) return [];
  const manuscriptWords = Array.isArray(manuscriptHtmlOrWords)
    ? manuscriptHtmlOrWords.map((w) => tokenizeForMatch(w)[0] || '')
    : extractManuscriptWordsFromHtml(manuscriptHtmlOrWords);
  if (!manuscriptWords.length) return [];

  // Marie 2026-05-26 v2: a longer anchor (10 words instead of 5) makes
  // each page's "first words" much more likely to be unique in the
  // manuscript — drops the off-by-one drift dramatically. Try several
  // starting offsets so a chapter title at the top of the page doesn't
  // throw us off.
  const ANCHOR_LEN = 10;

  // Pass 1: collect a candidate anchor for every printed page.
  const rawAnchors = [];
  let cursor = 0;
  let pdfWordCursor = 0;
  for (let pi = 0; pi < pdfPages.length; pi += 1) {
    const page = pdfPages[pi];
    const pageNumber = Number(page?.pageNumber) || null;
    if (!pageNumber) continue;

    const pageWords = tokenizeForMatch(page.normalizedText || '')
      .filter((w) => !/^\d+$/.test(w) && w.length >= 2);
    const pdfWordStartGuess = Math.min(manuscriptWords.length - 1, Math.max(0, pdfWordCursor));
    pdfWordCursor += pageWords.length;
    if (pageWords.length < 3) {
      rawAnchors.push({ pageNumber, wordStart: null, pageIndex: pi, pdfWordStartGuess });
      continue;
    }

    const tryAnchor = (len) => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const offset = attempt * 2;
        if (offset + len > pageWords.length) return -1;
        const anchor = pageWords.slice(offset, offset + len);
        const at = findWordSequence(manuscriptWords, anchor, cursor);
        if (at >= 0) return at;
      }
      return -1;
    };

    // Long anchor first (high uniqueness), then shorter as fallback.
    let foundIdx = tryAnchor(ANCHOR_LEN);
    if (foundIdx < 0) foundIdx = tryAnchor(7);
    if (foundIdx < 0) foundIdx = tryAnchor(5);

    if (foundIdx < 0) {
      rawAnchors.push({ pageNumber, wordStart: null, pageIndex: pi, pdfWordStartGuess });
      continue;
    }

    rawAnchors.push({ pageNumber, wordStart: foundIdx, pageIndex: pi, pdfWordStartGuess });
    cursor = foundIdx;
  }

  if (!rawAnchors.length) return [];

  // Pass 2: validation. An anchor must come AFTER the previous found
  // anchor by at least MIN_GAP_WORDS (a sane "pages can't be empty"
  // floor). If it doesn't, the anchor probably matched a stray
  // occurrence earlier in the manuscript — drop it, let interpolation
  // handle the page.
  const MIN_GAP_WORDS = 40;
  const cleaned = [];
  let lastFoundWordStart = -Infinity;
  for (const a of rawAnchors) {
    if (a.wordStart == null) { cleaned.push(a); continue; }
    if (a.wordStart < lastFoundWordStart + MIN_GAP_WORDS) {
      cleaned.push({ ...a, wordStart: null }); // mark for interpolation
      continue;
    }
    cleaned.push(a);
    lastFoundWordStart = a.wordStart;
  }

  // Pass 3: interpolate missing anchors between known neighbors. If a
  // page is between found anchor X (page Px) and found anchor Y (page
  // Py), put it at X + (Y - X) * (its_page - Px) / (Py - Px).
  for (let i = 0; i < cleaned.length; i += 1) {
    if (cleaned[i].wordStart != null) continue;
    // Walk backwards to find the previous found anchor.
    let leftIdx = i - 1;
    while (leftIdx >= 0 && cleaned[leftIdx].wordStart == null) leftIdx -= 1;
    // Walk forwards to find the next found anchor.
    let rightIdx = i + 1;
    while (rightIdx < cleaned.length && cleaned[rightIdx].wordStart == null) rightIdx += 1;

    const left = leftIdx >= 0 ? cleaned[leftIdx] : null;
    const right = rightIdx < cleaned.length ? cleaned[rightIdx] : null;

    if (left && right) {
      const span = right.pageNumber - left.pageNumber;
      const distance = cleaned[i].pageNumber - left.pageNumber;
      const wordSpan = right.wordStart - left.wordStart;
      const interp = Math.round(left.wordStart + wordSpan * (distance / span));
      cleaned[i] = { ...cleaned[i], wordStart: interp };
    } else if (left) {
      // No right neighbour — extrapolate using average word density.
      const avg = manuscriptWords.length / Math.max(1, pdfPages.length);
      const interp = Math.round(left.wordStart + avg * (cleaned[i].pageNumber - left.pageNumber));
      cleaned[i] = { ...cleaned[i], wordStart: Math.min(manuscriptWords.length - 1, interp) };
    } else if (right) {
      const avg = manuscriptWords.length / Math.max(1, pdfPages.length);
      const interp = Math.round(right.wordStart - avg * (right.pageNumber - cleaned[i].pageNumber));
      cleaned[i] = { ...cleaned[i], wordStart: Math.max(0, interp) };
    } else {
      const guess = Number(cleaned[i].pdfWordStartGuess);
      cleaned[i] = {
        ...cleaned[i],
        wordStart: Number.isFinite(guess)
          ? Math.max(0, Math.min(manuscriptWords.length - 1, Math.round(guess)))
          : 0,
      };
    }
  }

  // Pass 4: dedupe + sort by wordStart.
  const sorted = cleaned
    .filter((a) => a.wordStart != null)
    .map((a) => ({ wordStart: Math.max(0, a.wordStart), pageNumber: a.pageNumber }))
    .sort((a, b) => a.wordStart - b.wordStart || a.pageNumber - b.pageNumber);
  const out = [];
  for (const entry of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.wordStart === entry.wordStart) {
      out[out.length - 1] = entry; // later page wins on tie
      continue;
    }
    out.push(entry);
  }
  // Make sure word 0 always maps to a page.
  if (!out.length || out[0].wordStart !== 0) {
    out.unshift({ wordStart: 0, pageNumber: out[0]?.pageNumber || Number(pdfPages[0]?.pageNumber) || 1 });
  }
  return out;
}

export function pageForWordIndexFromSlimMap(wordIndex, slimMap) {
  if (!Array.isArray(slimMap) || !slimMap.length) return null;
  const target = Math.max(0, Math.floor(Number(wordIndex) || 0));
  let page = slimMap[0].pageNumber;
  for (const entry of slimMap) {
    if (entry.wordStart > target) break;
    page = entry.pageNumber;
  }
  return page;
}
