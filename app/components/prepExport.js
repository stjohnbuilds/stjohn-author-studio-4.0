// Pure helpers for Prep Manuscript exports.
//
// Builds a minimal-but-valid OOXML (.docx) zip and a CSV string from
// the 4.0 prep-project shape. Runs in the browser/renderer — no
// Electron IPC needed. JSZip is already a project dependency for the
// docx import path.

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

function darkenHexExport(hex, amount = 0.15) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return hex;
  const r = Math.max(0, parseInt(h.slice(0, 2), 16) - Math.round(255 * amount));
  const g = Math.max(0, parseInt(h.slice(2, 4), 16) - Math.round(255 * amount));
  const b = Math.max(0, parseInt(h.slice(4, 6), 16) - Math.round(255 * amount));
  const px = (n) => n.toString(16).padStart(2, '0');
  return '#' + px(r) + px(g) + px(b);
}

function exportColorFor(char, sv) {
  if (!char) return '';
  if (!sv) return char.colorHex;
  const idx = (char.sideVoices || []).findIndex((s) => s.id === sv.id);
  const step = Math.max(1, idx + 1);
  return darkenHexExport(char.colorHex, Math.min(0.45, 0.12 * step));
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
// Garamond 12pt body with proper Heading 1/2/3 + Title styles. Marie
// can still re-format in Word — but at least the starting point is
// readable.
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
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
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

  // 2) Replay any in-app paragraph edits Marie made via the Fix button
  //    (e.g. inserting a missing close quote). Without this the export
  //    still has the original missing quote. Done BEFORE the breakdown
  //    is injected and BEFORE highlights, so the paragraph text matches
  //    the dialogue spans the engine detected against the edited text.
  documentXml = applyManualEdits(documentXml, project);

  // 3) Inject the fresh narrator-breakdown at the very top of <w:body>.
  const breakdown = narratorBreakdownXml(project);
  if (breakdown) {
    documentXml = documentXml.replace('<w:body>', '<w:body>' + breakdown);
  }

  // 2) Patch in highlight runs around each assigned dialogue text.
  //    Strategy: substring-replace inside <w:t>…</w:t> bodies. For each
  //    occurrence in a single <w:t>, split that run into three: before
  //    (original rPr), highlighted (rPr + shd), after (original rPr).
  //    Multi-run dialogues (where the source has formatting changes
  //    mid-quote, e.g. italic emphasis) are left un-highlighted in
  //    place — they're rare and round-tripping them would risk
  //    breaking the document.
  const characters = project.characters || [];
  const charsById = new Map(characters.map((c) => [c.id, c]));
  const assignments = [];
  (project.chapters || []).forEach((ch) => {
    (ch.sections || []).forEach((sec) => {
      (sec.dialogueSpans || []).forEach((sp) => {
        if (!sp.characterId || !sp.text) return;
        const char = charsById.get(sp.characterId);
        if (!char) return;
        const sv = sp.sideVoiceId ? (char.sideVoices || []).find((s) => s.id === sp.sideVoiceId) : null;
        assignments.push({ text: sp.text, color: exportColorFor(char, sv) });
      });
    });
  });

  documentXml = applyHighlightsInPlace(documentXml, assignments);

  zip.file('word/document.xml', documentXml);
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

// If the source .docx already contains a "Narrator breakdown" block we
// previously injected (Marie ran an earlier export, then re-imported
// the result), remove it before adding a new one. Otherwise breakdowns
// pile up on top of each other every time she re-exports.
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

// Replay Marie's in-app paragraph edits into the original docx body.
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

function escapeForRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// For each assignment, find <w:r>[rPr]<w:t…>…DIALOGUE…</w:t></w:r>
// occurrences and wrap the dialogue with a shaded sibling run. Skips
// dialogues whose text doesn't fit in a single <w:t> (formatting
// changes mid-quote).
//
// The rPr capture is constrained so it cannot include `<w:r ` / `<w:r>` /
// `</w:r>` — without this, when a dialogue text only appears in a later
// paragraph, the regex would back-track its rPr across run boundaries
// (and across the narrator-breakdown we just injected at the top of the
// body) until it found a `</w:rPr>` deep in the document. The fallout
// was matched spans that swallowed the whole breakdown and pasted
// fragments of it back into the export wherever the regex landed — Marie
// saw the narrator-breakdown heading copied 6 times into chapter 1.
function applyHighlightsInPlace(docXml, assignments) {
  // Matches rPr content but not characters that would cross a run
  // boundary. `(?!</?w:r[\s>])` blocks `<w:r `, `<w:r>`, `</w:r>` —
  // `</w:rPr>` is fine because the character after `</w:r` is `P`, not
  // whitespace or `>`.
  const rPrInner = '(?:(?!<\\/?w:r[\\s>])[\\s\\S])*?';
  let out = docXml;
  for (const a of assignments) {
    const xmlDialogue = xml(a.text);
    const fill = String(a.color || '').replace('#', '').toUpperCase();
    if (!xmlDialogue || !fill) continue;
    const re = new RegExp(
      '<w:r\\b[^>]*>(\\s*<w:rPr>' + rPrInner + '<\\/w:rPr>)?\\s*<w:t([^>]*)>([^<]*?' + escapeForRegex(xmlDialogue) + '[^<]*?)</w:t>\\s*</w:r>',
      'g'
    );
    out = out.replace(re, (match, rPr = '', wtAttrs = '', wtText = '') => {
      const idx = wtText.indexOf(xmlDialogue);
      if (idx === -1) return match;
      const before = wtText.slice(0, idx);
      const after = wtText.slice(idx + xmlDialogue.length);
      const baseRPr = rPr || '';
      const shadedRPr = baseRPr
        ? baseRPr.replace('</w:rPr>', `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/></w:rPr>`)
        : `<w:rPr><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/></w:rPr>`;
      const beforeRun = before
        ? `<w:r>${baseRPr}<w:t xml:space="preserve">${before}</w:t></w:r>`
        : '';
      const dialogueRun =
        `<w:r>${shadedRPr}<w:t xml:space="preserve">${xmlDialogue}</w:t></w:r>`;
      const afterRun = after
        ? `<w:r>${baseRPr}<w:t xml:space="preserve">${after}</w:t></w:r>`
        : '';
      return beforeRun + dialogueRun + afterRun;
    });
  }
  return out;
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
