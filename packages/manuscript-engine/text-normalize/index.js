const HTML_ENTITY_MAP = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
};

export function decodeXmlText(value = '') {
  return String(value).replace(
    /&#(\d+);|&#x([0-9a-f]+);|&(amp|lt|gt|quot|apos|nbsp);/gi,
    (_match, decimal, hex, named) => {
      if (decimal) return String.fromCodePoint(Number(decimal));
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
      return HTML_ENTITY_MAP[String(named).toLowerCase()] || _match;
    }
  );
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripHtml(html = '') {
  return decodeXmlText(
    String(html)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

export function textToHtml(text = '') {
  const paragraphs = String(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (!paragraphs.length) return '';

  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n');
}

export function displayWordsFromText(text = '') {
  return String(text).match(/\S+/g) || [];
}

export function displayWordsFromHtml(html = '') {
  return displayWordsFromText(stripHtml(html));
}

export function countDisplayWordsFromHtml(html = '') {
  return displayWordsFromHtml(html).length;
}

export function normalizeSearchText(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function nameMatches(left = '', right = '') {
  const normalizedLeft = normalizeSearchText(left);
  const normalizedRight = normalizeSearchText(right);

  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft === normalizedRight
    || normalizedLeft.includes(normalizedRight)
    || normalizedRight.includes(normalizedLeft);
}

export function normalizeHeadingLevel(level = 1) {
  const numericLevel = Number(level);

  if (!Number.isFinite(numericLevel)) return 1;
  return Math.min(6, Math.max(1, Math.round(numericLevel)));
}

export function chapterTagFromLevel(level = 1) {
  return `h${normalizeHeadingLevel(level)}`;
}

export function nextSectionTag(chapterTag = 'h1') {
  const match = String(chapterTag).toLowerCase().match(/^h([1-6])$/);
  if (!match) return null;

  const nextLevel = Number(match[1]) + 1;
  if (nextLevel > 3) return null;

  return `h${nextLevel}`;
}

export function stableSlug(value = '') {
  const slug = normalizeSearchText(value).replace(/\s+/g, '-');
  return slug || 'untitled';
}
