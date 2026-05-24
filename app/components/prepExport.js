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

// Walk an HTML string and return paragraph-level blocks in document
// order, with their tag and a plain-text representation. Used to
// rebuild the manuscript's paragraph structure in the export.
function paragraphsFromHtml(html = '') {
  const blocks = [];
  const re = /<(p|h1|h2|h3|h4|h5|h6|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const text = stripTags(m[2]).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    blocks.push({ tag, text });
  }
  if (blocks.length === 0) {
    const fallback = stripTags(html).replace(/\s+/g, ' ').trim();
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
  characters.forEach((c) => {
    const main = ensure(c.narratorName || '');
    if (c.name) main.characters.add(c.name);
    (c.sideVoices || []).forEach((sv) => {
      const sn = ensure(sv.narratorName || c.narratorName || '');
      sn.sideVoices.push({ characterName: c.name, sideName: sv.name });
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

function narratorBreakdownXml(project = {}) {
  const breakdown = buildNarratorBreakdown(project);
  if (!breakdown.length) return '';
  const heading = headingParagraph('Narrator breakdown', 'Heading1');
  const blocks = breakdown.map((entry) => {
    const lines = [
      paragraph(textRun(entry.narrator || '(no narrator assigned)') + textRun(':', '')),
      // (narrator name as a Heading2)
    ];
    // Replace the first line with a proper Heading2 so it stands out.
    lines.length = 0;
    lines.push(headingParagraph(entry.narrator || '(no narrator assigned)', 'Heading2'));
    lines.push(paragraph(textRun('Characters: ') + textRun(entry.characters.length ? entry.characters.join(', ') : '—')));
    if (entry.sideVoices.length) {
      const svText = entry.sideVoices.map((sv) => `${sv.sideName} (side voice of ${sv.characterName})`).join('; ');
      lines.push(paragraph(textRun('Side characters: ') + textRun(svText)));
    } else {
      lines.push(paragraph(textRun('Side characters: ') + textRun('—')));
    }
    lines.push(paragraph(textRun('Chapters: ') + textRun(entry.chapters.length ? entry.chapters.join(', ') : '—')));
    lines.push(paragraph(textRun(' ')));
    return lines.join('');
  }).join('');
  // Page break after the breakdown so the chapter text starts fresh.
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
