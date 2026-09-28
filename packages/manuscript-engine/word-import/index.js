import {
  chapterTagFromLevel,
  countDisplayWordsFromHtml,
  decodeXmlText,
  displayWordsFromText,
  escapeHtml,
  nameMatches,
  nextSectionTag,
  stableSlug,
  stripHtml,
  textToHtml
} from '../text-normalize/index.js';

const BLOCK_TAG_PATTERN = /<(h[1-6]|p|div|li|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi;

function normalizeHtmlInput(input = '') {
  const text = String(input || '');
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return textToHtml(text);
}

function blockFromLooseText(text) {
  const plainText = stripHtml(text);
  if (!plainText) return null;

  return {
    tag: 'p',
    html: `<p>${escapeHtml(plainText)}</p>`,
    text: plainText
  };
}

export function parseHtmlBlocks(input = '') {
  const html = normalizeHtmlInput(input);
  const blocks = [];
  let lastIndex = 0;
  let match;

  BLOCK_TAG_PATTERN.lastIndex = 0;

  while ((match = BLOCK_TAG_PATTERN.exec(html))) {
    const looseText = html.slice(lastIndex, match.index);
    const looseBlock = blockFromLooseText(looseText);
    if (looseBlock) blocks.push(looseBlock);

    const tag = match[1].toLowerCase();
    const blockHtml = match[0];
    const text = stripHtml(blockHtml);

    if (text) {
      blocks.push({
        tag,
        html: blockHtml,
        text
      });
    }

    lastIndex = BLOCK_TAG_PATTERN.lastIndex;
  }

  const trailingBlock = blockFromLooseText(html.slice(lastIndex));
  if (trailingBlock) blocks.push(trailingBlock);

  if (!blocks.length) {
    const fallback = blockFromLooseText(html);
    if (fallback) blocks.push(fallback);
  }

  return blocks;
}

function joinBlockHtml(blocks = []) {
  return blocks.map((block) => block.html).filter(Boolean).join('\n');
}

function resolveNarratorInfo(sectionTitle, narratorMap = []) {
  for (const entry of narratorMap || []) {
    const characterName = entry.characterName || entry.character || entry.name || '';
    if (!nameMatches(sectionTitle, characterName)) continue;

    return {
      characterName,
      narratorName: entry.narratorName || entry.narrator || null,
      isCharPOV: true
    };
  }

  return {
    characterName: null,
    narratorName: null,
    isCharPOV: false
  };
}

function createSection({
  chapterIndex,
  chapterTitle,
  sectionIndex,
  sectionTitle,
  blocks,
  narratorMap,
  wordStart
}) {
  const html = joinBlockHtml(blocks);
  const wordCount = countDisplayWordsFromHtml(html);
  const narratorInfo = resolveNarratorInfo(sectionTitle, narratorMap);

  return {
    id: `chapter-${chapterIndex + 1}-section-${sectionIndex + 1}-${stableSlug(sectionTitle)}`,
    chapterIndex,
    chapterTitle,
    sectionIndex,
    title: sectionTitle || chapterTitle || `Section ${sectionIndex + 1}`,
    html,
    plainText: stripHtml(html),
    wordCount,
    wordStart,
    wordEnd: wordCount > 0 ? wordStart + wordCount - 1 : wordStart,
    audioFileName: null,
    transcriptId: null,
    timingId: null,
    flags: [],
    annotations: [],
    completed: false,
    ...narratorInfo
  };
}

function splitChapterIntoSections({
  chapter,
  chapterIndex,
  sectionTag,
  narratorMap,
  wordStart
}) {
  if (!sectionTag) {
    return [
      createSection({
        chapterIndex,
        chapterTitle: chapter.title,
        sectionIndex: 0,
        sectionTitle: chapter.title,
        blocks: chapter.blocks,
        narratorMap,
        wordStart
      })
    ];
  }

  const sections = [];
  const prefixBlocks = [];
  let currentSection = null;

  for (const block of chapter.blocks) {
    if (block.tag === sectionTag) {
      currentSection = {
        title: block.text,
        blocks: []
      };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      prefixBlocks.push(block);
      continue;
    }

    currentSection.blocks.push(block);
  }

  if (!sections.length) {
    return [
      createSection({
        chapterIndex,
        chapterTitle: chapter.title,
        sectionIndex: 0,
        sectionTitle: chapter.title,
        blocks: chapter.blocks,
        narratorMap,
        wordStart
      })
    ];
  }

  if (prefixBlocks.length) {
    sections[0].blocks = [...prefixBlocks, ...sections[0].blocks];
  }

  let nextWordStart = wordStart;
  return sections.map((section, sectionIndex) => {
    const result = createSection({
      chapterIndex,
      chapterTitle: chapter.title,
      sectionIndex,
      sectionTitle: section.title,
      blocks: section.blocks,
      narratorMap,
      wordStart: nextWordStart
    });
    nextWordStart += result.wordCount;
    return result;
  });
}

export function parseManuscriptStructure(input = '', options = {}) {
  const blocks = parseHtmlBlocks(input);
  const chapterTag = chapterTagFromLevel(options.chapterLevel || 1);
  const sectionTag = options.sectionTag === undefined ? nextSectionTag(chapterTag) : options.sectionTag;
  const narratorMap = options.narratorMap || [];
  const chapters = [];
  let currentChapter = null;

  for (const block of blocks) {
    if (block.tag === chapterTag) {
      currentChapter = {
        title: block.text || `Chapter ${chapters.length + 1}`,
        headingHtml: block.html,
        blocks: []
      };
      chapters.push(currentChapter);
      continue;
    }

    if (!currentChapter) {
      currentChapter = {
        title: 'Before first chapter',
        headingHtml: '',
        blocks: []
      };
      chapters.push(currentChapter);
    }

    currentChapter.blocks.push(block);
  }

  if (!chapters.length) {
    chapters.push({
      title: 'Manuscript',
      headingHtml: '',
      blocks
    });
  }

  let nextWordStart = 0;

  return chapters.map((chapter, chapterIndex) => {
    const sections = splitChapterIntoSections({
      chapter,
      chapterIndex,
      sectionTag,
      narratorMap,
      wordStart: nextWordStart
    });

    const wordCount = sections.reduce((total, section) => total + section.wordCount, 0);
    nextWordStart += wordCount;

    return {
      id: `chapter-${chapterIndex + 1}-${stableSlug(chapter.title)}`,
      chapterIndex,
      title: chapter.title,
      headingHtml: chapter.headingHtml,
      wordCount,
      sections
    };
  });
}

export function applyChapterNumbers(chapters = []) {
  return chapters.map((chapter, chapterIndex) => ({
    ...chapter,
    chapterNumber: chapterIndex + 1,
    sections: (chapter.sections || []).map((section, sectionIndex) => ({
      ...section,
      chapterIndex,
      chapterNumber: chapterIndex + 1,
      sectionIndex,
      isFirstSectionInChapter: sectionIndex === 0
    }))
  }));
}

export function flattenSections(chapters = []) {
  return chapters.flatMap((chapter) => chapter.sections || []);
}

export function toLightweightPhoneSections(chapters = []) {
  return flattenSections(chapters).map((section) => ({
    id: section.id,
    chapterIndex: section.chapterIndex,
    sectionIndex: section.sectionIndex,
    title: section.title,
    chapterTitle: section.chapterTitle,
    audioFileName: section.audioFileName,
    transcriptId: section.transcriptId,
    timingId: section.timingId,
    wordStart: section.wordStart,
    wordEnd: section.wordEnd,
    wordCount: section.wordCount
  }));
}

function openingTagName(tag = '') {
  const match = String(tag).match(/^<\s*([a-z0-9:-]+)/i);
  return match ? match[1].toLowerCase() : null;
}

function closingTagName(tag = '') {
  const match = String(tag).match(/^<\s*\/\s*([a-z0-9:-]+)/i);
  return match ? match[1].toLowerCase() : null;
}

function isSelfClosingTag(tag = '') {
  return /\/\s*>$/.test(String(tag)) || /^<\s*(br|hr|img|input)\b/i.test(String(tag));
}

function highlightFromTag(tag = '') {
  const classMatch = String(tag).match(/\bclass\s*=\s*["'][^"']*\b(?:hl|highlight)-([a-z0-9_-]+)/i);
  if (classMatch) {
    return {
      key: classMatch[1].toLowerCase(),
      source: 'class'
    };
  }

  const styleMatch = String(tag).match(/\bbackground(?:-color)?\s*:\s*([^;"']+)/i);
  if (styleMatch) {
    const value = styleMatch[1].trim().toLowerCase();
    const hexMatch = value.match(/#([0-9a-f]{3,8})/i);

    return {
      key: hexMatch ? hexMatch[1].toLowerCase() : value.replace(/[^a-z0-9]+/g, '-'),
      color: value,
      source: 'style'
    };
  }

  if (/^<\s*mark\b/i.test(String(tag))) {
    return {
      key: 'yellow',
      source: 'mark'
    };
  }

  return null;
}

function activeHighlight(stack) {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index].highlight) return stack[index].highlight;
  }

  return null;
}

export function extractHighlightedWordBlocks(input = '') {
  const html = normalizeHtmlInput(input);
  const tokenPattern = /<[^>]+>|[^<]+/g;
  const stack = [];
  const blocks = [];
  let wordIndex = 0;
  let token;

  while ((token = tokenPattern.exec(html))) {
    const value = token[0];
    const closingName = closingTagName(value);

    if (closingName) {
      const stackIndex = stack.findLastIndex((entry) => entry.name === closingName);
      if (stackIndex >= 0) stack.splice(stackIndex, 1);
      continue;
    }

    const openingName = openingTagName(value);
    if (openingName) {
      if (!isSelfClosingTag(value)) {
        const highlight = highlightFromTag(value);
        if (highlight) stack.push({ name: openingName, highlight });
      }
      continue;
    }

    const words = displayWordsFromText(decodeXmlText(value));
    const highlight = activeHighlight(stack);

    for (const word of words) {
      if (highlight) {
        const previous = blocks[blocks.length - 1];
        const canExtend =
          previous &&
          previous.highlightKey === highlight.key &&
          previous.wordEndIndex === wordIndex - 1;

        if (canExtend) {
          previous.wordEndIndex = wordIndex;
          previous.text = `${previous.text} ${word}`;
        } else {
          blocks.push({
            id: `highlight-${blocks.length + 1}`,
            highlightKey: highlight.key,
            color: highlight.color || null,
            source: highlight.source,
            wordStartIndex: wordIndex,
            wordEndIndex: wordIndex,
            text: word
          });
        }
      }

      wordIndex += 1;
    }
  }

  return blocks;
}
