// Pure helpers for Prep Manuscript exports.
//
// Builds a minimal-but-valid OOXML (.docx) zip and a CSV string from
// the 4.0 prep-project shape. Runs in the browser/renderer — no
// Electron IPC needed. JSZip is already a project dependency for the
// docx import path.

import { darkenHex } from '../lib/characterPalette.js';

function xml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeFileName(value = 'export', ext = '') {
  const cleaned = String(value || 'export')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'export';
  return ext && !cleaned.toLowerCase().endsWith(ext) ? `${cleaned}${ext}` : cleaned;
}

function hexToRgb(hex = '#cccccc') {
  const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{6})$/i);
  return m ? m[1].toUpperCase() : 'CCCCCC';
}

function textRun(text = '', highlightHex = '') {
  const safe = xml(text);
  const shading = highlightHex
    ? `<w:rPr><w:shd w:val="clear" w:color="auto" w:fill="${hexToRgb(highlightHex)}"/></w:rPr>`
    : '';
  return `<w:r>${shading}<w:t xml:space="preserve">${safe}</w:t></w:r>`;
}

function paragraph(runs = '') {
  return `<w:p>${runs}</w:p>`;
}

function styledParagraph(style = '', runs = '') {
  if (!style) return `<w:p>${runs}</w:p>`;
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${runs}</w:p>`;
}

function headingParagraph(text = '', level = 'Heading1') {
  return `<w:p><w:pPr><w:pStyle w:val="${level}"/></w:pPr>${textRun(text)}</w:p>`;
}

function stripTags(s = '') {
  return String(s).replace(/<[^>]*>/g, '');
}

// Match the engine's stripHtml exactly: replace each tag with a SPACE
// (not an empty string), then decode XML entities and collapse runs of
// whitespace. The reader and the engine both need to see the same text
// for span.text indexOf lookups to succeed — when an inline `<em>` or
// `<span>` splits a word, the engine includes a space between the parts
// and the reader has to as well.
function stripHtmlForText(s = '') {
  return String(s)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|blockquote|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);|&#x([0-9a-fA-F]+);|&(amp|lt|gt|quot|apos|nbsp);/g,
      (_, dec, hex, named) => {
        if (dec) return String.fromCodePoint(Number(dec));
        if (hex) return String.fromCodePoint(parseInt(hex, 16));
        switch (named) {
          case 'amp': return '&';
          case 'lt': return '<';
          case 'gt': return '>';
          case 'quot': return '"';
          case 'apos': return "'";
          case 'nbsp': return ' ';
          default: return _;
        }
      })
    .replace(/\s+/g, ' ')
    .trim();
}

// Walk an HTML string and return paragraph-level blocks in document
// order, with their tag and a plain-text representation. Used to
// rebuild the manuscript's paragraph structure in the export.
function paragraphsFromHtml(html = '') {
  const blocks = [];
  const re = /<(p|h1|h2|h3|h4|h5|h6|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const text = stripHtmlForText(m[2]);
    if (!text) continue;
    blocks.push({ tag, text });
  }
  if (blocks.length === 0) {
    const fallback = stripHtmlForText(html);
    if (fallback) blocks.push({ tag: 'p', text: fallback });
  }
  return blocks;
}

function ooxmlStyleForTag(tag) {
  switch (tag) {
    case 'h1': return 'Heading1';
    case 'h2': return 'Heading2';
    case 'h3': return 'Heading3';
    case 'h4': return 'Heading4';
    case 'h5': return 'Heading5';
    case 'h6': return 'Heading6';
    case 'blockquote': return 'Quote';
    default: return '';   // body paragraph
  }
}

function exportColorFor(char, sv) {
  if (!char) return '';
  if (!sv) return char.colorHex;
  const idx = (char.sideVoices || []).findIndex((s) => s.id === sv.id);
  const step = Math.max(1, idx + 1);
  return darkenHex(char.colorHex, Math.min(0.45, 0.12 * step));
}

function escapeCsv(value = '') {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildPrepCsv(project = {}) {
  const charactersById = new Map();
  (project.characters || []).forEach((c) => charactersById.set(c.id, c));
  const rows = [['Chapter', 'Dialogue', 'Character', 'Narrator']];
  (project.chapters || []).forEach((ch) => {
    (ch.spans || []).forEach((sp) => {
      const char = sp.characterId ? charactersById.get(sp.characterId) : null;
      const narrator = sp.narratorOverride || char?.narratorName || '';
      rows.push([
        ch.title || '',
        sp.text || '',
        char?.name || '',
        narrator,
      ]);
    });
  });
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

export function buildPrepNarratorChapterCsv(project = {}) {
  const charactersById = new Map();
  (project.characters || []).forEach((c) => charactersById.set(c.id, c));
  const rows = [['Chapter', 'Narrators (deduped)']];
  (project.chapters || []).forEach((ch) => {
    const narrators = new Set();
    (ch.spans || []).forEach((sp) => {
      const char = sp.characterId ? charactersById.get(sp.characterId) : null;
      const narrator = (sp.narratorOverride || char?.narratorName || '').trim();
      if (narrator) narrators.add(narrator);
    });
    rows.push([ch.title || '', Array.from(narrators).join(' / ')]);
  });
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

function buildNarratorBreakdown(project = {}) {
  // Group characters + side voices by narrator. For each narrator,
  // collect the chapters they appear in (any of their characters or
  // side voices speaking counts).
  const characters = project.characters || [];
  const chapters = project.chapters || [];

  // narratorName -> { characters: Set<name>, sideVoices: [{ char, sideName }], chapterNums: Set<num> }
  const narratorMap = new Map();
  function ensure(narrator) {
    const key = narrator || '(no narrator assigned)';
    if (!narratorMap.has(key)) {
      narratorMap.set(key, { characters: new Set(), sideVoices: [], chapterNums: new Set() });
    }
    return narratorMap.get(key);
  }

  // Seed from characters list (so a character with no lines yet still shows).
  // Side voices belong to a NARRATOR (the voice actor), not the character.
  // A "side voice of Crescent" reads wrong to the engineer reading the
  // breakdown — what they need to know is that Alyssa (the narrator
  // voicing Crescent) ALSO does the side voice. So we attribute the
  // side voice to the parent character's narrator.
  characters.forEach((c) => {
    const main = ensure(c.narratorName || '');
    if (c.name) main.characters.add(c.name);
    (c.sideVoices || []).forEach((sv) => {
      const parentNarrator = c.narratorName || '';
      const sn = ensure(sv.narratorName || parentNarrator);
      sn.sideVoices.push({
        characterName: c.name,
        parentNarrator,                   // who actually voices this side voice
        sideName: sv.name,
      });
    });
  });

  // Walk dialogue lines, attribute chapter numbers.
  chapters.forEach((ch, ci) => {
    const chapterNum = ch.chapterNumber || (ci + 1);
    (ch.spans || []).forEach((sp) => {
      const char = sp.characterId ? characters.find((c) => c.id === sp.characterId) : null;
      if (!char) return;
      const sv = sp.sideVoiceId ? (char.sideVoices || []).find((s) => s.id === sp.sideVoiceId) : null;
      const narrator = sv?.narratorName || char.narratorName || '';
      const entry = ensure(narrator);
      entry.chapterNums.add(chapterNum);
    });
  });

  return Array.from(narratorMap.entries()).map(([narrator, info]) => ({
    narrator,
    characters: Array.from(info.characters).sort(),
    sideVoices: info.sideVoices,
    chapters: Array.from(info.chapterNums).sort((a, b) => a - b),
  }));
}

// Inline-styled run/paragraph helpers so the narrator breakdown renders
// the same when we inject it into the user's original .docx — that doc's
// styles.xml may not define Heading1/Heading2, so we set the bold +
// centering + size directly on each run/paragraph.
function centeredBoldParagraph(text, halfPtSize) {
  const rPr = `<w:rPr><w:b/><w:sz w:val="${halfPtSize}"/><w:szCs w:val="${halfPtSize}"/></w:rPr>`;
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:r>${rPr}<w:t xml:space="preserve">${xml(text)}</w:t></w:r></w:p>`;
}
function labeledParagraph(label, body) {
  const bold = `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${xml(label)}</w:t></w:r>`;
  const rest = `<w:r><w:t xml:space="preserve">${xml(body)}</w:t></w:r>`;
  return `<w:p>${bold}${rest}</w:p>`;
}

function narratorBreakdownXml(project = {}) {
  const breakdown = buildNarratorBreakdown(project);
  if (!breakdown.length) return '';
  const heading = centeredBoldParagraph('Narrator breakdown', 36); // 18pt
  const blocks = breakdown.map((entry) => {
    const lines = [];
    lines.push(centeredBoldParagraph(entry.narrator || '(no narrator assigned)', 28)); // 14pt
    lines.push(labeledParagraph('Characters: ', entry.characters.length ? entry.characters.join(', ') : '—'));
    if (entry.sideVoices.length) {
      // "Mom (side voice of Alyssa)" — Alyssa is who actually voices Mom
      // in the booth. The character whose side voice this is (Crescent)
      // is implied by which narrator block we're in.
      const svText = entry.sideVoices.map((sv) => {
        const parent = sv.parentNarrator || entry.narrator || '';
        return parent ? `${sv.sideName} (side voice of ${parent})` : sv.sideName;
      }).join('; ');
      lines.push(labeledParagraph('Side characters: ', svText));
    } else {
      lines.push(labeledParagraph('Side characters: ', '—'));
    }
    lines.push(labeledParagraph('Chapters: ', entry.chapters.length ? entry.chapters.join(', ') : '—'));
    lines.push(paragraph(textRun(' ')));
    return lines.join('');
  }).join('');
  const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  return heading + blocks + pageBreak;
}

// Build the OOXML body for a single section: walk the source HTML
// paragraph-by-paragraph and inject highlighted runs where dialogue
// spans appear. Paragraph structure + headings are preserved so the
// exported .docx is the user's original manuscript with just the
// dialogue tinted.
function sectionXmlPreservingLayout(section, characters) {
  const blocks = paragraphsFromHtml(section.html || '');
  const spans = section.dialogueSpans || [];
  // Span cursor advances across paragraphs — the engine returns spans
  // in document order, so a given span lives in exactly one paragraph.
  let spanCursor = 0;
  return blocks.map((block) => {
    const segments = [];
    let cursor = 0;
    const text = block.text;
    while (spanCursor < spans.length) {
      const sp = spans[spanCursor];
      const needle = sp.text || '';
      if (!needle) { spanCursor++; continue; }
      const where = text.indexOf(needle, cursor);
      if (where === -1) break;   // span isn't in this paragraph
      if (where > cursor) segments.push({ kind: 'plain', text: text.slice(cursor, where) });
      segments.push({ kind: 'dialogue', text: needle, span: sp });
      cursor = where + needle.length;
      spanCursor++;
    }
    if (cursor < text.length) segments.push({ kind: 'plain', text: text.slice(cursor) });
    if (segments.length === 0) segments.push({ kind: 'plain', text });

    const runs = segments.map((seg) => {
      if (seg.kind === 'plain') return textRun(seg.text);
      const char = seg.span.characterId ? characters.find((c) => c.id === seg.span.characterId) : null;
      const sv = char && seg.span.sideVoiceId ? (char.sideVoices || []).find((s) => s.id === seg.span.sideVoiceId) : null;
      const fill = exportColorFor(char, sv);
      return textRun(seg.text, fill);
    }).join('');

    return styledParagraph(ooxmlStyleForTag(block.tag), runs);
  }).join('');
}

function buildDocumentXml(project = {}) {
  const characters = project.characters || [];
  const title = headingParagraph(project.title || 'Prep Manuscript', 'Title');
  const subtitle = paragraph(textRun(`Source file: ${project.fileName || ''}`));
  const blank = paragraph(textRun(' '));
  const breakdownXml = narratorBreakdownXml(project);

  // The manuscript body — preserves original paragraph structure +
  // headings; highlights only the dialogue runs. If a chapter has no
  // section data (legacy shape) we fall back to the old simple
  // "[Character] text" line emission so old exports still work.
  const chapterXml = (project.chapters || []).map((ch) => {
    const heading = headingParagraph(ch.title || 'Untitled chapter', 'Heading1');
    if (Array.isArray(ch.sections) && ch.sections.length > 0) {
      const body = ch.sections.map((sec) => sectionXmlPreservingLayout(sec, characters)).join('');
      return heading + (body || paragraph(textRun('(Empty chapter.)')));
    }
    // Legacy / fallback path
    const lines = (ch.spans || []).map((sp) => {
      const char = sp.characterId ? characters.find((c) => c.id === sp.characterId) : null;
      const highlight = char?.colorHex || '';
      const label = char ? `[${char.name || 'Unnamed'}${sp.narratorOverride ? ' / ' + sp.narratorOverride : ''}] ` : '[Unassigned] ';
      return paragraph(textRun(`${label}"${sp.text}"`, highlight));
    }).join('');
    return heading + (lines || paragraph(textRun('(No dialogue detected.)')));
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${title}
    ${subtitle}
    ${blank}
    ${breakdownXml}
    ${chapterXml}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`;
}

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId10" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

// A book-style styles.xml so the exported .docx opens in Word looking
// like a novel manuscript instead of generic Calibri body. Defaults to
// Garamond 12pt body with proper Heading 1/2/3 + Title styles. The
// user can still re-format in Word — but at least the starting point
// is readable.
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Garamond" w:hAnsi="Garamond" w:cs="Garamond"/>
        <w:sz w:val="24"/>
        <w:szCs w:val="24"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="360" w:lineRule="auto"/>
        <w:ind w:firstLine="360"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr>
      <w:spacing w:before="360" w:after="240"/>
      <w:jc w:val="center"/>
      <w:ind w:firstLine="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Garamond" w:hAnsi="Garamond"/>
      <w:b/>
      <w:sz w:val="44"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="480" w:after="240"/>
      <w:jc w:val="center"/>
      <w:ind w:firstLine="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Garamond" w:hAnsi="Garamond"/>
      <w:b/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="320" w:after="160"/>
      <w:jc w:val="center"/>
      <w:ind w:firstLine="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Garamond" w:hAnsi="Garamond"/>
      <w:b/>
      <w:sz w:val="26"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:spacing w:before="240" w:after="120"/>
      <w:ind w:firstLine="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Garamond" w:hAnsi="Garamond"/>
      <w:b/>
      <w:i/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Quote">
    <w:name w:val="Quote"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:ind w:left="720" w:right="720" w:firstLine="0"/>
      <w:spacing w:before="120" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:i/>
    </w:rPr>
  </w:style>
</w:styles>`;

export async function buildPrepHighlightedDocxBlob(project = {}) {
  return (await buildPrepHighlightedDocx(project)).blob;
}

// Same export, plus a count of how many assigned lines were highlighted and
// which were not, so the screen can say so instead of handing over a file
// with silent gaps. `highlight` is null when the file had to be rebuilt
// from scratch (no original Word file was kept).
export async function buildPrepHighlightedDocx(project = {}) {
  // Preferred path: if we kept the original .docx bytes on import, use
  // them as the template and patch in just the narrator breakdown +
  // highlight runs around the detected dialogue. That preserves EVERY
  // bit of the user's original formatting (fonts, italics, page
  // numbers, custom styles) instead of rebuilding.
  if (project.sourceDocxBase64) {
    try {
      return await buildOriginalPlusHighlights(project);
    } catch (err) {
      // Fall back to the rebuilt path below so the user always gets
      // SOMETHING out of the export.
      console.warn('In-place .docx patch failed, falling back to rebuilt export:', err);
    }
  }

  const mod = await import('jszip');
  const JSZip = mod.default || mod;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.folder('_rels').file('.rels', RELS_XML);
  zip.folder('word').file('document.xml', buildDocumentXml(project));
  zip.folder('word').file('styles.xml', STYLES_XML);
  zip.folder('word').folder('_rels').file('document.xml.rels', DOC_RELS_XML);
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  return { blob, highlight: null };
}

// In-place export: open the original .docx, inject highlight runs
// where dialogue lives, prepend the narrator-breakdown paragraphs.
async function buildOriginalPlusHighlights(project) {
  const mod = await import('jszip');
  const JSZip = mod.default || mod;
  const bytes = base64ToUint8(project.sourceDocxBase64);
  const zip = await JSZip.loadAsync(bytes);
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('Original .docx has no word/document.xml');
  let documentXml = await docFile.async('string');

  // 1) If the source .docx already has a narrator-breakdown block from
  //    a previous export, strip it so we don't pile a new one on top.
  //    The marker is the "Narrator breakdown" heading we always emit,
  //    followed (somewhere shortly after) by our page break.
  documentXml = stripPreviousNarratorBreakdown(documentXml);

  // 2) Replay any in-app paragraph edits made via the Fix button
  //    (e.g. inserting a missing close quote). Without this the export
  //    still has the original missing quote. Done BEFORE the breakdown
  //    is injected and BEFORE highlights, so the paragraph text matches
  //    the dialogue spans the engine detected against the edited text.
  documentXml = applyManualEdits(documentXml, project);

  // 3) Shade each assigned dialogue line in its character's colour.
  //    Every detected line is passed in, assigned or not: the unassigned
  //    ones are not coloured but keep the search in the right place.
  //    This runs before the narrator breakdown is added so the breakdown
  //    text can never be mistaken for manuscript text.
  const characters = project.characters || [];
  const charsById = new Map(characters.map((c) => [c.id, c]));
  const lines = [];
  const comments = [];
  let nextCommentId = await nextCommentIdFromZip(zip);
  (project.chapters || []).forEach((ch) => {
    (ch.sections || []).forEach((sec) => {
      (sec.dialogueSpans || []).forEach((sp) => {
        if (!sp.text) return;
        const char = sp.characterId ? charsById.get(sp.characterId) : null;
        if (!char) {
          lines.push({ text: sp.text, color: '', commentId: null });
          return;
        }
        const sv = sp.sideVoiceId ? (char.sideVoices || []).find((s) => s.id === sp.sideVoiceId) : null;
        // Side voices get an inline Word comment so the engineer reading
        // the .docx sees who voices each variant + recurring/one-time.
        // Main-character lines just get the highlight (no comment noise).
        let commentId = null;
        if (sv) {
          commentId = nextCommentId++;
          comments.push({ id: commentId, lines: formatSideVoiceCommentLines(char, sv) });
        }
        lines.push({ text: sp.text, color: exportColorFor(char, sv), commentId });
      });
    });
  });

  const highlight = highlightDialogueInDocumentXml(documentXml, lines);
  documentXml = highlight.xml;

  // 4) Inject the fresh narrator-breakdown at the very top of <w:body>.
  const breakdown = narratorBreakdownXml(project);
  if (breakdown) {
    documentXml = documentXml.replace('<w:body>', '<w:body>' + breakdown);
  }

  const anchoredCommentIds = new Set(
    Array.from(documentXml.matchAll(/<w:commentRangeStart w:id="(\d+)"\/>/g)).map((m) => m[1])
  );
  const anchoredComments = comments.filter((c) => anchoredCommentIds.has(String(c.id)));

  zip.file('word/document.xml', documentXml);

  if (anchoredComments.length > 0) {
    await attachCommentsPart(zip, anchoredComments);
  }
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  return {
    blob,
    highlight: { wanted: highlight.wanted, highlighted: highlight.highlighted, missed: highlight.missed },
  };
}

// Build the per-dialogue side-voice note that lands inside an inline
// Word comment. Returns an array of LINES — each line becomes its own
// <w:p> inside the comment so Word lays them out top-to-bottom instead
// of jamming everything on one line.
function formatSideVoiceCommentLines(char, sv) {
  const lines = [];
  lines.push(`Character: ${sv.name || '(unnamed)'}`);
  const narrator = sv.narratorName || char.narratorName || '';
  if (narrator) lines.push(`Narrator: ${narrator}`);
  if (char.name) lines.push(`Side voice of ${char.name}`);
  if (sv.notes) lines.push(`Notes: ${sv.notes}`);
  lines.push(sv.recurring ? '[Recurring]' : '[One time]');
  return lines;
}

// Add a word/comments.xml part to the .docx zip and wire it into the
// content-types + document relationships. Word needs all three pieces
// or it ignores the comments entirely.
async function nextCommentIdFromZip(zip) {
  let maxId = -1;
  async function scanZipFile(name) {
    const file = zip.file(name);
    if (!file) return;
    const text = await file.async('string');
    const re = /w:id=["'](\d+)["']/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      maxId = Math.max(maxId, Number(match[1]));
    }
  }
  await scanZipFile('word/comments.xml');
  await scanZipFile('word/document.xml');
  return maxId + 1;
}

async function attachCommentsPart(zip, comments) {
  const author = 'StJohn Studio';
  const initials = 'SS';
  const date = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const items = comments.map((c) => {
    // One <w:p> per line so Word lays each field on its own line in
    // the comment pane — a single comma-joined line was hard to read.
    const paras = (c.lines || []).map((line) => (
      `<w:p><w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`
    )).join('');
    return (
      `<w:comment w:id="${c.id}" w:author="${xml(author)}" w:date="${date}" w:initials="${xml(initials)}">` +
        paras +
      `</w:comment>`
    );
  }).join('');
  const existingCommentsFile = zip.file('word/comments.xml');
  let commentsXml = '';
  if (existingCommentsFile) {
    const existing = await existingCommentsFile.async('string');
    commentsXml = existing.includes('</w:comments>')
      ? existing.replace('</w:comments>', `${items}</w:comments>`)
      : existing + items;
  } else {
    // Include the Markup-Compatibility + w14 namespaces Word emits in
    // its own comments.xml. Without these, Word repair flags the file
    // as "unreadable" and shows a dialog before opening — even though
    // the comments still render once accepted.
    commentsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14">${items}</w:comments>`;
  }
  zip.file('word/comments.xml', commentsXml);

  // Content types: declare the comments part if not already there.
  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    let ct = await ctFile.async('string');
    if (!/PartName="\/word\/comments\.xml"/.test(ct)) {
      ct = ct.replace(
        '</Types>',
        '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'
      );
      zip.file('[Content_Types].xml', ct);
    }
  }

  // Document relationships: point to comments.xml from document.xml.
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    let rels = await relsFile.async('string');
    if (!/Target="comments\.xml"/.test(rels)) {
      // Use a high, unlikely-to-clash id so we don't collide with the
      // source doc's existing relationships.
      const relId = 'rIdComments' + Math.floor(Date.now() % 100000);
      rels = rels.replace(
        '</Relationships>',
        `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>`
      );
      zip.file('word/_rels/document.xml.rels', rels);
    }
  }
}

// If the source .docx already contains a "Narrator breakdown" block
// previously injected (an earlier export was re-imported), remove it
// before adding a new one. Otherwise breakdowns pile up on top of
// each other every time the file is re-exported.
function stripPreviousNarratorBreakdown(documentXml) {
  const marker = 'Narrator breakdown';
  // Only scan the head of the document so we don't accidentally match
  // real prose deep in the book that happens to contain those words.
  const SCAN_LIMIT = 80_000;
  const head = documentXml.slice(0, Math.min(documentXml.length, SCAN_LIMIT));
  const markerIdx = head.indexOf(marker);
  if (markerIdx === -1) return documentXml;

  // Walk back to the start of the paragraph that contains the marker.
  const before = documentXml.slice(0, markerIdx);
  const pStart = before.lastIndexOf('<w:p');
  if (pStart === -1) return documentXml;

  // Walk forward to the end of the paragraph that contains our page
  // break. The breakdown block always ends with a page-break paragraph.
  const after = documentXml.slice(markerIdx);
  const pageBreakMatch = after.match(/<w:br[^>]*\bw:type=["']page["'][^>]*\/?>/);
  if (!pageBreakMatch) return documentXml;
  const pageBreakAbsoluteIdx = markerIdx + pageBreakMatch.index;
  // Find the closing </w:p> after the page-break tag.
  const afterPB = documentXml.slice(pageBreakAbsoluteIdx);
  const closeMatch = afterPB.match(/<\/w:p>/);
  if (!closeMatch) return documentXml;
  const removeEnd = pageBreakAbsoluteIdx + closeMatch.index + closeMatch[0].length;

  return documentXml.slice(0, pStart) + documentXml.slice(removeEnd);
}

// Replay the in-app paragraph edits into the original docx body.
// For each (oldText, newText) edit on each section, find the <w:p>
// whose concatenated <w:t> text equals oldText and replace its inner
// content with a single <w:r><w:t>newText</w:t></w:r>. The paragraph
// keeps its <w:pPr> (so spacing/alignment is preserved) but loses any
// per-run formatting inside — that's the trade-off for being able to
// surgically inject text without reauthoring the whole .docx.
function applyManualEdits(documentXml, project) {
  const edits = [];
  (project.chapters || []).forEach((ch) => {
    (ch.sections || []).forEach((sec) => {
      (sec.manualEdits || []).forEach((e) => {
        if (e && e.oldText && e.newText && e.oldText !== e.newText) {
          edits.push(e);
        }
      });
    });
  });
  if (edits.length === 0) return documentXml;

  let out = documentXml;
  for (const edit of edits) {
    out = replaceParagraphByText(out, edit.oldText, edit.newText);
  }
  return out;
}

function replaceParagraphByText(documentXml, oldText, newText) {
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  return documentXml.replace(pRegex, (match, inner) => {
    // Collect the concatenated <w:t> text in this paragraph and
    // collapse whitespace so it matches what the reader sees.
    const textParts = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let tm;
    while ((tm = tRegex.exec(inner)) !== null) textParts.push(tm[1]);
    const pText = decodeXmlText(textParts.join('')).replace(/\s+/g, ' ').trim();
    if (pText !== oldText) return match;
    // Keep the original pPr (paragraph properties) if any.
    const pprMatch = inner.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const pPr = pprMatch ? pprMatch[0] : '';
    return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${xml(newText)}</w:t></w:r></w:p>`;
  });
}

function decodeXmlText(s = '') {
  return String(s).replace(
    /&#(\d+);|&#x([0-9a-fA-F]+);|&(amp|lt|gt|quot|apos|nbsp);/g,
    (_, dec, hex, named) => {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      switch (named) {
        case 'amp': return '&';
        case 'lt': return '<';
        case 'gt': return '>';
        case 'quot': return '"';
        case 'apos': return "'";
        case 'nbsp': return ' ';
        default: return _;
      }
    }
  );
}

function base64ToUint8(b64) {
  const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ── Highlighting dialogue inside the original Word file ───────────────────
//
// Rule is: a dialogue line is matched against the joined text of a whole
// paragraph, never against a single text run, and the search never jumps
// ahead past lines it has not placed. Word splits one sentence into several
// runs for many reasons (a page-break marker, italics, spell-check or
// revision ids), so matching inside one run misses real lines; and a search
// that takes "the next match anywhere later" lets one missed short line drag
// every following line out of place.
//
// Every detected line is located, assigned or not, because the unassigned
// ones still tell us where we are in the document. Matching ignores white
// space on both sides, since the reader's text has a space wherever the
// Word file changed formatting.

const MATCH_SKIP_CHARS = /[\s­​-‍⁠﻿]/;
const MATCH_SKIP_CHARS_ALL = /[\s­​-‍⁠﻿]+/g;
const OPENING_QUOTE_CHARS = '“"‘\'«„‚';
// Lines at least this long are placed first and act as fixed points; the
// shorter ones ("Yes.", "No.") are then only looked for between two fixed
// points, where a repeat elsewhere in the book cannot be picked by mistake.
const FIXED_POINT_MIN_LENGTH = 20;
const NEARBY_PARAGRAPHS = 60;
const SHORT_LINE_NEEDS_QUOTE_BELOW = 8;

function matchKey(text = '') {
  return String(text ?? '').replace(MATCH_SKIP_CHARS_ALL, '');
}

// Innermost paragraphs only: a paragraph that holds a text box holds other
// paragraphs, and those inner ones are the ones with the text runs.
function findLeafParagraphs(docXml) {
  const tagRe = /<w:p(?=[\s>/])[^>]*>|<\/w:p>/g;
  const stack = [];
  const leaves = [];
  let match;
  while ((match = tagRe.exec(docXml)) !== null) {
    const tag = match[0];
    if (tag === '</w:p>') {
      const open = stack.pop();
      if (!open) continue;
      if (!open.hasChild) leaves.push({ start: open.start, end: match.index + tag.length });
      if (stack.length) stack[stack.length - 1].hasChild = true;
    } else if (!tag.endsWith('/>')) {
      stack.push({ start: match.index, hasChild: false });
    }
  }
  return leaves;
}

function tokenizeXmlText(raw = '') {
  const tokens = String(raw).match(/&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);|[\s\S]/g) || [];
  return tokens.map((token) => {
    const ch = token.length > 1 ? decodeXmlText(token) : token;
    return { raw: token, key: matchKey(ch), mark: -1 };
  });
}

// Break a paragraph into its runs, and each run into text pieces and
// everything else (tabs, breaks, page-break markers), kept in order.
function parseParagraphRuns(pXml) {
  const runs = [];
  const refs = [];
  let key = '';
  const runRe = /<w:r(?=[\s>])([^>]*)>([\s\S]*?)<\/w:r>/g;
  let match;
  while ((match = runRe.exec(pXml)) !== null) {
    const inner = match[2];
    const rPrMatch = inner.match(/^\s*(<w:rPr>[\s\S]*?<\/w:rPr>|<w:rPr\/>)/);
    const rPr = rPrMatch ? rPrMatch[1] : '';
    const body = rPrMatch ? inner.slice(rPrMatch[0].length) : inner;
    const parts = [];
    const textRe = /<w:t(?=[\s>])[^>]*>([^<]*)<\/w:t>/g;
    let last = 0;
    let textMatch;
    while ((textMatch = textRe.exec(body)) !== null) {
      if (textMatch.index > last) parts.push({ other: body.slice(last, textMatch.index) });
      parts.push({ units: tokenizeXmlText(textMatch[1]) });
      last = textMatch.index + textMatch[0].length;
    }
    if (last < body.length) parts.push({ other: body.slice(last) });
    const run = {
      start: match.index,
      end: match.index + match[0].length,
      attrs: match[1],
      rPr,
      parts,
      // A run that records a tracked formatting change nests a second
      // property block inside the first; leave such runs exactly as found.
      locked: inner.includes('<w:rPrChange'),
    };
    runs.push(run);
    for (const part of parts) {
      if (!part.units) continue;
      for (const unit of part.units) {
        unit.run = run;
        for (let i = 0; i < unit.key.length; i += 1) refs.push(unit);
        key += unit.key;
      }
    }
  }
  return { runs, refs, key };
}

function paragraphMatchKey(pXml) {
  let key = '';
  const runRe = /<w:r(?=[\s>])[^>]*>([\s\S]*?)<\/w:r>/g;
  let match;
  while ((match = runRe.exec(pXml)) !== null) {
    const textRe = /<w:t(?=[\s>])[^>]*>([^<]*)<\/w:t>/g;
    let textMatch;
    while ((textMatch = textRe.exec(match[1])) !== null) key += matchKey(decodeXmlText(textMatch[1]));
  }
  return key;
}

// Work out where each line sits: { p: paragraph number, start, end } in that
// paragraph's match key, or null when it cannot be placed.
function locateDialogueLines(paragraphKeys, lineKeys) {
  const found = new Array(lineKeys.length).fill(null);
  const lastParagraph = paragraphKeys.length - 1;
  if (lastParagraph < 0) return found;

  const startsAtQuote = (pKey, at) => at === 0 || OPENING_QUOTE_CHARS.includes(pKey[at - 1]);

  function search(needle, from, to, quoteOnly) {
    const endP = Math.min(to.p, lastParagraph);
    for (let p = from.p; p <= endP; p += 1) {
      const pKey = paragraphKeys[p];
      let at = pKey.indexOf(needle, p === from.p ? from.off : 0);
      while (at !== -1 && quoteOnly && !startsAtQuote(pKey, at)) at = pKey.indexOf(needle, at + 1);
      if (at === -1) continue;
      if (p === to.p && at + needle.length > to.off) return null;
      return { p, at };
    }
    return null;
  }

  const docEnd = { p: lastParagraph, off: Infinity };

  // First the long lines, in order, each one only after the one before it.
  const fixed = [];
  lineKeys.forEach((key, i) => { if (key.length >= FIXED_POINT_MIN_LENGTH) fixed.push(i); });
  let cursor = { p: 0, off: 0 };
  for (let f = 0; f < fixed.length; f += 1) {
    const i = fixed[f];
    const key = lineKeys[i];
    const hit = search(key, cursor, { p: cursor.p + NEARBY_PARAGRAPHS, off: Infinity }, true)
      || search(key, cursor, docEnd, false);
    if (!hit) continue;
    if (hit.p - cursor.p > NEARBY_PARAGRAPHS) {
      // A long jump is only believed when the next long lines do not sit
      // in the stretch it would skip; otherwise this is a repeat of the
      // sentence further on, and the real one could not be matched.
      let skipsLaterLine = false;
      for (let k = 1; k <= 2 && f + k < fixed.length && !skipsLaterLine; k += 1) {
        if (search(lineKeys[fixed[f + k]], cursor, { p: hit.p, off: hit.at }, false)) skipsLaterLine = true;
      }
      if (skipsLaterLine) continue;
    }
    found[i] = { p: hit.p, start: hit.at, end: hit.at + key.length };
    cursor = { p: hit.p, off: found[i].end };
  }

  // Then the short lines, each only between the placed lines around it.
  const nextFixed = new Array(lineKeys.length).fill(-1);
  let upcoming = -1;
  for (let i = lineKeys.length - 1; i >= 0; i -= 1) {
    nextFixed[i] = upcoming;
    if (found[i]) upcoming = i;
  }
  let previous = { p: 0, off: 0 };
  for (let i = 0; i < lineKeys.length; i += 1) {
    if (found[i]) {
      previous = { p: found[i].p, off: found[i].end };
      continue;
    }
    const key = lineKeys[i];
    if (!key) continue;
    const limit = nextFixed[i] !== -1
      ? { p: found[nextFixed[i]].p, off: found[nextFixed[i]].start }
      : { p: previous.p + NEARBY_PARAGRAPHS, off: Infinity };
    let hit = search(key, previous, limit, true);
    if (!hit && key.length >= SHORT_LINE_NEEDS_QUOTE_BELOW) hit = search(key, previous, limit, false);
    if (!hit) continue;
    found[i] = { p: hit.p, start: hit.at, end: hit.at + key.length };
    previous = { p: hit.p, off: found[i].end };
  }
  return found;
}

function normalizeFill(color = '') {
  const fill = String(color || '').replace('#', '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(fill) ? fill : '';
}

// One shading per run: Word's file format allows a single shading tag in a
// run's properties, and a yellow marker-pen highlight would hide it.
function shadedRunProperties(rPr = '', fill) {
  const shading = `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`;
  if (!rPr || rPr === '<w:rPr/>') return `<w:rPr>${shading}</w:rPr>`;
  let placed = false;
  let out = rPr
    .replace(/<w:highlight\b[^>]*\/>/g, '')
    .replace(/<w:shd\b[^>]*\/>/g, () => {
      if (placed) return '';
      placed = true;
      return shading;
    });
  if (!placed) out = out.replace(/<\/w:rPr>\s*$/, `${shading}</w:rPr>`);
  return out;
}

// Rewrite one paragraph so the marked stretches sit in their own shaded
// runs. Returns the new paragraph and which marks were applied. If the
// paragraph's text would come out any different, the original is kept.
function highlightParagraph(pXml, marks) {
  const parsed = parseParagraphRuns(pXml);
  const applied = new Array(marks.length).fill(false);
  if (parsed.key !== paragraphMatchKey(pXml)) return { xml: pXml, applied };

  marks.forEach((mark, markIndex) => {
    for (let k = mark.start; k < mark.end && k < parsed.refs.length; k += 1) parsed.refs[k].mark = markIndex;
  });

  // White space between two characters of the same line belongs to it.
  const units = [];
  parsed.runs.forEach((run) => run.parts.forEach((part) => { if (part.units) units.push(...part.units); }));
  let before = -1;
  const markBefore = units.map((unit) => {
    const value = before;
    if (unit.key) before = unit.mark;
    return value;
  });
  let after = -1;
  for (let i = units.length - 1; i >= 0; i -= 1) {
    const unit = units[i];
    if (unit.key) {
      after = unit.mark;
    } else if (markBefore[i] !== -1 && markBefore[i] === after) {
      unit.mark = after;
    }
  }

  // A line that touches a run we must not rewrite is left alone entirely.
  const blocked = new Set();
  units.forEach((unit) => { if (unit.mark !== -1 && unit.run.locked) blocked.add(unit.mark); });
  if (blocked.size) units.forEach((unit) => { if (blocked.has(unit.mark)) unit.mark = -1; });

  const runPieces = new Map();
  const firstPiece = new Map();
  const lastPiece = new Map();
  for (const run of parsed.runs) {
    const touched = run.parts.some((part) => part.units && part.units.some((unit) => unit.mark !== -1));
    if (!touched) continue;
    const pieces = [];
    let current = null;
    let pendingOther = '';
    let textBuffer = '';
    const flushText = () => {
      if (textBuffer && current) current.content += `<w:t xml:space="preserve">${textBuffer}</w:t>`;
      textBuffer = '';
    };
    for (const part of run.parts) {
      if (part.other != null) {
        if (current) {
          flushText();
          current.content += part.other;
        } else {
          pendingOther += part.other;
        }
        continue;
      }
      for (const unit of part.units) {
        if (!current || current.mark !== unit.mark) {
          flushText();
          current = { mark: unit.mark, content: pendingOther, prefix: '', suffix: '' };
          pendingOther = '';
          pieces.push(current);
        }
        textBuffer += unit.raw;
      }
      flushText();
    }
    if (pendingOther) pieces.push({ mark: -1, content: pendingOther, prefix: '', suffix: '' });
    runPieces.set(run, pieces);
    for (const piece of pieces) {
      if (piece.mark === -1) continue;
      if (!firstPiece.has(piece.mark)) firstPiece.set(piece.mark, piece);
      lastPiece.set(piece.mark, piece);
    }
  }

  marks.forEach((mark, markIndex) => {
    if (!firstPiece.has(markIndex)) return;
    applied[markIndex] = true;
    if (mark.commentId == null) return;
    // Word needs the range start, the range end and the reference run, all
    // three, for a comment to show.
    firstPiece.get(markIndex).prefix = `<w:commentRangeStart w:id="${mark.commentId}"/>`;
    lastPiece.get(markIndex).suffix = `<w:commentRangeEnd w:id="${mark.commentId}"/><w:r><w:commentReference w:id="${mark.commentId}"/></w:r>`;
  });

  let out = '';
  let position = 0;
  for (const run of parsed.runs) {
    const pieces = runPieces.get(run);
    if (!pieces) continue;
    out += pXml.slice(position, run.start);
    for (const piece of pieces) {
      const properties = piece.mark === -1 ? run.rPr : shadedRunProperties(run.rPr, marks[piece.mark].fill);
      out += `${piece.prefix}<w:r${run.attrs}>${properties}${piece.content}</w:r>${piece.suffix}`;
    }
    position = run.end;
  }
  out += pXml.slice(position);

  if (paragraphMatchKey(out) !== parsed.key) return { xml: pXml, applied: applied.map(() => false) };
  return { xml: out, applied };
}

// lines: every detected dialogue line in reading order, as
// { text, color, commentId }. A line with no colour is not highlighted but
// is still used to keep our place. Returns the new document plus a count of
// the coloured lines that were, and were not, highlighted.
export function highlightDialogueInDocumentXml(docXml, lines = []) {
  const paragraphs = findLeafParagraphs(docXml);
  const paragraphKeys = paragraphs.map((p) => paragraphMatchKey(docXml.slice(p.start, p.end)));
  const lineKeys = lines.map((line) => matchKey(line?.text || ''));
  const found = locateDialogueLines(paragraphKeys, lineKeys);

  const marksByParagraph = new Map();
  const missed = [];
  let wanted = 0;
  lines.forEach((line, i) => {
    const fill = normalizeFill(line?.color);
    if (!fill) return;
    wanted += 1;
    const place = found[i];
    if (!place) {
      missed.push(line.text);
      return;
    }
    if (!marksByParagraph.has(place.p)) marksByParagraph.set(place.p, []);
    marksByParagraph.get(place.p).push({ start: place.start, end: place.end, fill, commentId: line.commentId ?? null, text: line.text });
  });

  let out = '';
  let position = 0;
  let highlighted = 0;
  paragraphs.forEach((p, index) => {
    const marks = marksByParagraph.get(index);
    if (!marks) return;
    const result = highlightParagraph(docXml.slice(p.start, p.end), marks);
    marks.forEach((mark, markIndex) => {
      if (result.applied[markIndex]) highlighted += 1;
      else missed.push(mark.text);
    });
    out += docXml.slice(position, p.start) + result.xml;
    position = p.end;
  });
  out += docXml.slice(position);

  return { xml: out, wanted, highlighted, missed };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

export function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export const exportFileNames = {
  docx: (project) => safeFileName((project.title || 'prep') + '-prep-highlights', '.docx'),
  fullCsv: (project) => safeFileName((project.title || 'prep') + '-dialogue-by-line', '.csv'),
  chapterCsv: (project) => safeFileName((project.title || 'prep') + '-narrators-by-chapter', '.csv'),
};
