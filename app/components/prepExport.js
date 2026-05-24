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

function headingParagraph(text = '', level = 'Heading1') {
  return `<w:p><w:pPr><w:pStyle w:val="${level}"/></w:pPr>${textRun(text)}</w:p>`;
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

function buildDocumentXml(project = {}) {
  const characters = project.characters || [];
  const charactersById = new Map(characters.map((c) => [c.id, c]));

  const title = headingParagraph(project.title || 'Prep Manuscript', 'Title');
  const subtitle = paragraph(textRun(`Source file: ${project.fileName || ''}`));
  const blank = paragraph(textRun(' '));

  const breakdownXml = narratorBreakdownXml(project);

  const chapterXml = (project.chapters || []).map((ch) => {
    const heading = headingParagraph(ch.title || 'Untitled chapter', 'Heading1');
    const lines = (ch.spans || []).map((sp) => {
      const char = sp.characterId ? charactersById.get(sp.characterId) : null;
      const sv = char && sp.sideVoiceId ? (char.sideVoices || []).find((s) => s.id === sp.sideVoiceId) : null;
      const highlight = char?.colorHex || '';
      const narrator = sp.narratorOverride || char?.narratorName || '';
      const charLabel = char ? char.name || 'Unnamed' : 'Unassigned';
      const svLabel = sv ? ` — ${sv.name}` : '';
      const narLabel = narrator ? ' / ' + narrator : '';
      const label = char ? `[${charLabel}${svLabel}${narLabel}] ` : '[Unassigned] ';
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
</Relationships>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

export async function buildPrepHighlightedDocxBlob(project = {}) {
  const mod = await import('jszip');
  const JSZip = mod.default || mod;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.folder('_rels').file('.rels', RELS_XML);
  zip.folder('word').file('document.xml', buildDocumentXml(project));
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
