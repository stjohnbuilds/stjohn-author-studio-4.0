// Text normalization for Quill & Ink. Ported from the alpha at
// packages/core/src/text/normalize.js. Word spans + selection context
// are how annotations stay locatable when the .docx is reflowed.

export function htmlToPlainText(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeWords(text = '') {
  const matches = String(text).match(/[A-Za-z0-9']+/g);
  return matches || [];
}

export function countWords(text = '') {
  return tokenizeWords(text).length;
}

export function buildWordSpans(text = '') {
  const spans = [];
  const re = /[A-Za-z0-9']+/g;
  let match;
  while ((match = re.exec(String(text)))) {
    spans.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return spans;
}

export function buildSelectionTextContext(text = '', wordSpans = [], selectionStart = 0, selectionEnd = 0, contextWords = 5) {
  const source = String(text || '');
  const spans = Array.isArray(wordSpans) && wordSpans.length ? wordSpans : buildWordSpans(source);
  if (!spans.length) return null;

  const start = Math.max(0, Math.min(Number(selectionStart), Number(selectionEnd)));
  const end = Math.min(spans.length - 1, Math.max(Number(selectionStart), Number(selectionEnd)));
  if (!Number.isFinite(start) || !Number.isFinite(end) || !spans[start] || !spans[end]) return null;

  const selectedWordCount = end - start + 1;
  const radius = Math.max(1, Number(contextWords) || 5);
  const contextStartWord = Math.max(0, start - radius);
  const contextEndWord = Math.min(spans.length - 1, end + radius);
  const contextStart = spans[contextStartWord].start;
  const contextEnd = spans[contextEndWord].end;
  const targetStart = spans[start].start;
  const targetEnd = spans[end].end;

  return {
    before: source.slice(contextStart, targetStart),
    target: source.slice(targetStart, targetEnd),
    after: source.slice(targetEnd, contextEnd),
    phrase: source.slice(contextStart, contextEnd),
    targetOffset: targetStart - contextStart,
    selectedWordCount,
    beforeWordCount: start - contextStartWord,
    afterWordCount: contextEndWord - end,
  };
}
