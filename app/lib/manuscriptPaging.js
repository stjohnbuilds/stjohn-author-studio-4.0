export const DEFAULT_ESTIMATED_WORDS_PER_PAGE = 250;

export function countWordsInText(text) {
  const words = String(text || '').match(/[A-Za-z0-9']+/g);
  return words ? words.length : 0;
}

export function countWordsInHtml(html) {
  const text = String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ');
  return countWordsInText(text);
}

function decodeXmlEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function normalizePageMap(pageMap, startPageNumber = 1) {
  const sorted = (Array.isArray(pageMap) ? pageMap : [])
    .filter(entry => Number.isFinite(entry?.wordStart) && Number.isFinite(entry?.pageNumber))
    .map(entry => ({
      wordStart: Math.max(0, Math.floor(Number(entry.wordStart) || 0)),
      pageNumber: Math.max(1, Math.floor(Number(entry.pageNumber) || startPageNumber)),
    }))
    .sort((a, b) => a.wordStart - b.wordStart || a.pageNumber - b.pageNumber);

  const out = [];
  for (const entry of sorted) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(entry);
      continue;
    }
    if (entry.wordStart === prev.wordStart) {
      out[out.length - 1] = entry;
      continue;
    }
    if (entry.pageNumber === prev.pageNumber) continue;
    out.push(entry);
  }

  if (!out.length || out[0].wordStart !== 0) {
    out.unshift({ wordStart: 0, pageNumber: Math.max(1, Math.floor(startPageNumber || 1)) });
  }

  return out;
}

export function getPageNumberForWordIndex(wordIndex, pageMap) {
  const idx = Math.max(0, Math.floor(Number(wordIndex) || 0));
  const normalized = normalizePageMap(pageMap);
  let pageNumber = normalized[0]?.pageNumber || 1;
  for (const entry of normalized) {
    if (entry.wordStart > idx) break;
    pageNumber = entry.pageNumber;
  }
  return pageNumber;
}

export function extractRenderedPageMapFromDocxXml(documentXml) {
  const xml = String(documentXml || '');
  if (!xml.trim()) return null;

  const explicitStartMatch = xml.match(/<w:pgNumType\b[^>]*\bw:start="(\d+)"[^>]*\/?/i);
  const startPageNumber = Math.max(1, Number(explicitStartMatch?.[1]) || 1);

  const pageMap = [{ wordStart: 0, pageNumber: startPageNumber }];
  let currentPageNumber = startPageNumber;
  let wordCount = 0;
  let breakCount = 0;

  const tokenRx = /<w:lastRenderedPageBreak\b[^>]*\/?>(?:<\/w:lastRenderedPageBreak>)?|<w:br\b[^>]*\bw:type="page"[^>]*\/?>(?:<\/w:br>)?|<w:pgNumType\b[^>]*\bw:start="(\d+)"[^>]*\/?>(?:<\/w:pgNumType>)?|<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi;
  let match;

  while ((match = tokenRx.exec(xml)) !== null) {
    const [full, pgStartRaw, textRaw] = match;

    if (typeof textRaw === 'string') {
      wordCount += countWordsInText(decodeXmlEntities(textRaw));
      continue;
    }

    if (pgStartRaw) {
      const nextPageNumber = Math.max(1, Number(pgStartRaw) || currentPageNumber);
      if (pageMap[0] && wordCount === 0 && pageMap.length === 1) {
        pageMap[0].pageNumber = nextPageNumber;
      } else {
        const prev = pageMap[pageMap.length - 1];
        if (!prev || prev.wordStart !== wordCount || prev.pageNumber !== nextPageNumber) {
          pageMap.push({ wordStart: wordCount, pageNumber: nextPageNumber });
        }
      }
      currentPageNumber = nextPageNumber;
      continue;
    }

    if (/lastRenderedPageBreak|w:br\b/i.test(full)) {
      breakCount += 1;
      currentPageNumber += 1;
      const prev = pageMap[pageMap.length - 1];
      if (!prev || prev.wordStart !== wordCount || prev.pageNumber !== currentPageNumber) {
        pageMap.push({ wordStart: wordCount, pageNumber: currentPageNumber });
      }
    }
  }

  if (breakCount < 1) return null;

  return {
    mode: 'rendered',
    pageMap: normalizePageMap(pageMap, startPageNumber),
    totalWordCount: wordCount,
    exactPageCount: normalizePageMap(pageMap, startPageNumber).length,
    startPageNumber,
  };
}

export function annotateManuscriptPositions(chapters, options = {}) {
  // Marie 2026-05-26: PDF-rendered page map is the ONLY accepted source.
  // No more 250-words-per-page estimates. When the rendered map is
  // missing, exactPageStart/End come back null and the UI flags it.
  const pageMap = normalizePageMap(options.pageMap, options.startPageNumber || 1);
  const hasExactPageMap = Array.isArray(options.pageMap) && options.pageMap.length > 1;
  let wordCursor = 0;

  const annotatedChapters = (chapters || []).map(chapter => ({
    ...chapter,
    sections: (chapter.sections || []).map(section => {
      const manuscriptWordCount = countWordsInHtml(section.html);
      const manuscriptWordStart = wordCursor;
      const lastWordIndex = manuscriptWordCount > 0
        ? manuscriptWordStart + manuscriptWordCount - 1
        : manuscriptWordStart;
      const exactPageStart = hasExactPageMap ? getPageNumberForWordIndex(manuscriptWordStart, pageMap) : null;
      const exactPageEnd = hasExactPageMap ? getPageNumberForWordIndex(lastWordIndex, pageMap) : null;

      wordCursor += manuscriptWordCount;

      return {
        ...section,
        manuscriptWordStart,
        manuscriptWordCount,
        // Estimated fields kept but explicitly null — older code that
        // checks them will fall through to a "?" placeholder.
        estimatedPageStart: null,
        estimatedPageEnd: null,
        estimatedWordsPerPage: null,
        exactPageStart,
        exactPageEnd: hasExactPageMap ? Math.max(exactPageStart, exactPageEnd) : null,
      };
    }),
  }));

  return {
    chapters: annotatedChapters,
    totalWordCount: wordCursor,
    estimatedPageCount: null,
    exactPageCount: hasExactPageMap ? pageMap.length : null,
    wordsPerPage: null,
    pageMap: hasExactPageMap ? pageMap : null,
    mode: hasExactPageMap ? 'rendered' : 'unknown',
  };
}

export function normalizeBookPaging(book) {
  if (!book || !Array.isArray(book.chapters)) return book;

  // Marie 2026-05-26: PDF-rendered page map is the ONLY accepted source.
  const pageMap = Array.isArray(book.manuscriptPaging?.pageMap) ? book.manuscriptPaging.pageMap : null;
  const paging = annotateManuscriptPositions(book.chapters, {
    pageMap,
    startPageNumber: Number(book.manuscriptPaging?.startPageNumber) || 1,
  });

  return {
    ...book,
    chapters: paging.chapters,
    manuscriptPaging: {
      mode: paging.mode,
      totalWordCount: paging.totalWordCount,
      exactPageCount: paging.exactPageCount,
      pageMap: paging.mode === 'rendered' ? paging.pageMap : undefined,
      startPageNumber: paging.pageMap?.[0]?.pageNumber || 1,
      // Whether this book has a usable page map. The UI surfaces a warning
      // when this is false.
      hasUsablePageMap: paging.mode === 'rendered',
    },
  };
}