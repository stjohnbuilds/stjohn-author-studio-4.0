// HTML-preserving phone reader walker. Ported from the v1 Studio phone.
//
// The naive version of the phone reader just splits plainText into word
// spans, which loses paragraphs, italics, scene-breaks etc. This walker
// keeps the HTML structure (h1/h2/h3/p/em/strong/br/span) and only
// replaces text nodes with word-level spans.
//
// renderWord({ word, after, index, key }) is what the caller passes —
// it controls the styling + tap handlers per word.

'use client';

import React from 'react';

const WORD_RE = /[A-Za-z0-9']+/g;

export function renderReaderContent({ html, words, renderWord, keyPrefix = 'reader' }) {
  if (!renderWord) return null;
  if (typeof document === 'undefined' || !html) {
    // SSR fallback: render flat list of words.
    return (words || []).map((word, index) => (
      renderWord({
        word: word.word,
        after: ' ',
        index,
        key: `${keyPrefix}-fallback-${index}`,
      })
    ));
  }

  let wordIndex = 0;
  const host = document.createElement('div');
  host.innerHTML = html;

  const renderText = (text, localKeyPrefix) => {
    const source = String(text || '');
    const matches = [];
    WORD_RE.lastIndex = 0;
    let match;
    while ((match = WORD_RE.exec(source)) !== null) {
      matches.push({ value: match[0], start: match.index, end: match.index + match[0].length });
    }
    if (!matches.length) return source ? [source] : [];

    let lastIndex = 0;
    const pieces = [];
    matches.forEach((item, matchIndex) => {
      if (item.start > lastIndex) pieces.push(source.slice(lastIndex, item.start));
      const idx = wordIndex;
      wordIndex += 1;
      const next = matches[matchIndex + 1];
      const after = source.slice(item.end, next ? next.start : source.length);
      pieces.push(renderWord({
        word: item.value,
        after,
        index: idx,
        key: `${localKeyPrefix}-w-${idx}`,
      }));
      lastIndex = next ? next.start : source.length;
    });
    return pieces;
  };

  const renderNode = (node, key) => {
    if (node.nodeType === Node.TEXT_NODE) return renderText(node.textContent || '', key);
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const children = Array.from(node.childNodes).flatMap((child, index) => renderNode(child, `${key}-${index}`));
    const tag = node.tagName;
    if (tag === 'H1') return <h1 key={key}>{children}</h1>;
    if (tag === 'H2') return <h2 key={key}>{children}</h2>;
    if (tag === 'H3') return <h3 key={key}>{children}</h3>;
    if (tag === 'P') return <p key={key}>{children}</p>;
    if (tag === 'EM' || tag === 'I') return <em key={key}>{children}</em>;
    if (tag === 'STRONG' || tag === 'B') return <strong key={key}>{children}</strong>;
    if (tag === 'BR') return <br key={key} />;
    return <span key={key}>{children}</span>;
  };

  return Array.from(host.childNodes).flatMap((node, index) => renderNode(node, `${keyPrefix}-node-${index}`));
}
