import {
  decodeXmlText,
  displayWordsFromText,
  stripHtml
} from '../text-normalize/index.js';
import { parseHtmlBlocks } from '../word-import/index.js';

const OPEN_CURLY_QUOTE = '\u201c';
const CLOSE_CURLY_QUOTE = '\u201d';
const STRAIGHT_QUOTE = '"';
const REVIEW_CONTEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote']);
const SPEECH_VERB_PATTERN = '(said|asked|answered|replied|whispered|murmured|called|shouted|cried|snapped|breathed|continued|added)';

function cleanText(value = '') {
  return decodeXmlText(String(value || ''));
}

function displayWordRangesFromText(text = '') {
  const ranges = [];
  const pattern = /\S+/g;
  let match;

  while ((match = pattern.exec(text))) {
    ranges.push({
      index: ranges.length,
      text: match[0],
      start: match.index,
      end: match.index + match[0].length - 1
    });
  }

  return ranges;
}

function wordIndexAfterOffset(wordRanges = [], offset = 0) {
  const word = wordRanges.find((range) => range.end >= offset);
  return word ? word.index : Math.max(0, wordRanges.length - 1);
}

function wordIndexBeforeOffset(wordRanges = [], offset = 0) {
  for (let index = wordRanges.length - 1; index >= 0; index -= 1) {
    if (wordRanges[index].start <= offset) return wordRanges[index].index;
  }

  return 0;
}

function isDialogueQuote(char = '') {
  return char === STRAIGHT_QUOTE || char === OPEN_CURLY_QUOTE || char === CLOSE_CURLY_QUOTE;
}

function quoteKind(char = '') {
  if (char === OPEN_CURLY_QUOTE) return 'open';
  if (char === CLOSE_CURLY_QUOTE) return 'close';
  return 'straight';
}

function cleanAfterText(text = '') {
  return cleanText(text)
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSpeakerHint(afterText = '') {
  const cleaned = cleanAfterText(afterText).replace(/^[\s,.;:!?-]+/, '').trim();
  const nameBeforeVerb = cleaned.match(new RegExp(`^([A-Z][A-Za-z'’-]+(?:\\s+[A-Z][A-Za-z'’-]+){0,2})\\s+${SPEECH_VERB_PATTERN}\\b`));
  if (nameBeforeVerb) return nameBeforeVerb[1].trim();

  const verbBeforeName = cleaned.match(new RegExp(`^${SPEECH_VERB_PATTERN}\\s+([A-Z][A-Za-z'’-]+(?:\\s+[A-Z][A-Za-z'’-]+){0,2})\\b`, 'i'));
  return verbBeforeName ? verbBeforeName[2].trim() : '';
}

function makeIssue({
  type,
  message,
  quoteIndex = null,
  wordStartIndex = 0,
  wordEndIndex = 0,
  severity = 'warning',
  blocking = true
}) {
  return {
    type,
    message,
    quoteIndex,
    wordStartIndex,
    wordEndIndex: Math.max(wordStartIndex, wordEndIndex),
    severity,
    blocking
  };
}

// Builds a single dialogue span between an open quote and a close quote.
// We deliberately don't emit "tiny / long / empty" warnings any more —
// Marie only wants one warning, and that's a missing-close that has no
// follow-up quote nearby (handled at the block level in detectDialogueSpansInHtml).
function makeDialogueSpan({
  openQuote,
  closeQuote,
  text,
  wordRanges
}) {
  const innerText = text.slice(openQuote.index + 1, closeQuote.index).trim();
  const afterText = cleanAfterText(text.slice(closeQuote.index + 1, closeQuote.index + 90));
  const speakerHint = extractSpeakerHint(afterText);
  const startIndex = wordIndexAfterOffset(wordRanges, openQuote.index + 1);
  const endIndex = wordIndexBeforeOffset(wordRanges, closeQuote.index - 1);

  return {
    wordStartIndex: startIndex,
    wordEndIndex: Math.max(startIndex, endIndex),
    text: innerText,
    afterText,
    speakerHint,
    startsWithFirstPerson: /^I\b/.test(innerText.trim()),
    quoteStartIndex: openQuote.index,
    quoteEndIndex: closeQuote.index
  };
}

export function collectDialogueQuoteMarks(text = '') {
  const normalized = cleanText(text);
  const marks = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (!isDialogueQuote(char)) continue;

    marks.push({
      index,
      char,
      kind: quoteKind(char)
    });
  }

  return marks;
}

// Find the dialogue spans within a chunk of text. Spans are returned
// every time we see an open + close pair. We deliberately do NOT emit
// any per-paragraph issues here — the only warning Marie wants
// ("you forgot a close quote and the next one is far away") is a
// block-level check done in detectDialogueSpansInHtml.
export function detectDialogueSpansInText(text = '') {
  const normalized = cleanText(text);
  const quoteMarks = collectDialogueQuoteMarks(normalized);
  const wordRanges = displayWordRangesFromText(normalized);
  const spans = [];
  let openQuote = null;

  for (const quote of quoteMarks) {
    if (openQuote?.kind === 'open' && quote.kind === 'straight') {
      // Treat nested straight quote inside curly-opened dialogue as decorative;
      // skip it without ending the span or flagging.
      continue;
    }

    const shouldOpen = quote.kind === 'open' || (quote.kind === 'straight' && !openQuote);
    const shouldClose = quote.kind === 'close' || (quote.kind === 'straight' && openQuote);

    if (shouldOpen) {
      // If we were already open, just replace the marker (the previous
      // open will be picked up by the block-level orphan check if it
      // really was missing a close).
      openQuote = quote;
      continue;
    }

    if (shouldClose) {
      if (!openQuote) continue;
      spans.push(makeDialogueSpan({
        openQuote,
        closeQuote: quote,
        text: normalized,
        wordRanges
      }));
      openQuote = null;
    }
  }

  return {
    text: normalized,
    quoteMarks,
    totalQuoteMarks: quoteMarks.length,
    quoteMarksEven: quoteMarks.length % 2 === 0,
    dialogueSpans: spans,
    issues: []
  };
}

export function detectDialogueSpansInHtml(html = '', options = {}) {
  const blocks = parseHtmlBlocks(html);
  const dialogueSpans = [];
  const issues = [];
  let totalQuoteMarks = 0;
  let wordOffset = 0;

  for (const block of blocks) {
    const blockText = stripHtml(block.html || block.text || '');
    const result = detectDialogueSpansInText(blockText, options);
    const blockWordCount = displayWordsFromText(blockText).length;
    const isReviewContext = REVIEW_CONTEXT_TAGS.has(block.tag);

    totalQuoteMarks += result.totalQuoteMarks;

    for (const span of result.dialogueSpans) {
      dialogueSpans.push({
        ...span,
        wordStartIndex: span.wordStartIndex + wordOffset,
        wordEndIndex: span.wordEndIndex + wordOffset,
        sourceTag: block.tag
      });
    }

    for (const issue of result.issues) {
      issues.push({
        ...issue,
        wordStartIndex: issue.wordStartIndex + wordOffset,
        wordEndIndex: issue.wordEndIndex + wordOffset,
        sourceTag: block.tag
      });
    }

    if (isReviewContext && result.totalQuoteMarks > 0) {
      issues.push(makeIssue({
        type: 'quote-context-review',
        message: 'Review quote marks in a heading, epigraph, or quoted block before assigning dialogue.',
        wordStartIndex: wordOffset,
        wordEndIndex: Math.max(wordOffset, wordOffset + blockWordCount - 1),
        blocking: false
      }));
    }

    wordOffset += blockWordCount;
  }

  return {
    totalQuoteMarks,
    quoteMarksEven: totalQuoteMarks % 2 === 0,
    dialogueSpans,
    issues
  };
}
