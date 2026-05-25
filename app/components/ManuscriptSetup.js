'use client';
import { useState } from 'react';
import InfoTip from './InfoTip';
import ImportFlow from './ImportFlow';
import { annotateManuscriptPositions, extractRenderedPageMapFromDocxXml } from '../lib/manuscriptPaging';
import { extractPdfPagingFromFile } from '../lib/pdfPaging';

const DEFAULT_MANUAL_COLORS = ['#f8bbd0', '#c8e6c9', '#bbdefb', '#e1bee7', '#ffcdd2', '#ffe0b2', '#fff9c4'];

export const STYLE_MAP = [
  "highlight[color='yellow'] => span.hl-yellow:fresh","highlight[color='green'] => span.hl-green:fresh",
  "highlight[color='cyan'] => span.hl-cyan:fresh","highlight[color='magenta'] => span.hl-magenta:fresh",
  "highlight[color='pink'] => span.hl-pink:fresh","highlight[color='blue'] => span.hl-blue:fresh",
  "highlight[color='red'] => span.hl-red:fresh","highlight[color='darkBlue'] => span.hl-darkblue:fresh",
  "highlight[color='darkCyan'] => span.hl-darkcyan:fresh","highlight[color='darkGreen'] => span.hl-darkgreen:fresh",
  "highlight[color='darkMagenta'] => span.hl-darkmagenta:fresh","highlight[color='darkRed'] => span.hl-darkred:fresh",
  "highlight[color='darkYellow'] => span.hl-darkyellow:fresh","highlight[color='lightGray'] => span.hl-lightgray:fresh",
  "highlight[color='darkGray'] => span.hl-darkgray:fresh",
  "highlight => span.hl-yellow:fresh",
  "p[style-name='Heading 1'] => h1.doc-h1:fresh","p[style-name='Heading 2'] => h2.doc-h2:fresh",
  "p[style-name='Heading 3'] => h3.doc-h3:fresh","b => strong","i => em",
];

// All highlight colours mammoth can produce, with their CSS display hex
const HIGHLIGHT_MAP = [
  { cls:'hl-yellow',     hex:'#FFF8DC', label:'Yellow' },
  { cls:'hl-green',      hex:'#DFF2E3', label:'Green' },
  { cls:'hl-cyan',       hex:'#DFF4F7', label:'Cyan' },
  { cls:'hl-pink',       hex:'#FDDEE8', label:'Pink' },
  { cls:'hl-magenta',    hex:'#FDDEE8', label:'Magenta' },
  { cls:'hl-blue',       hex:'#DDEEFF', label:'Blue' },
  { cls:'hl-red',        hex:'#FDDEDE', label:'Red' },
  { cls:'hl-darkblue',   hex:'#D4E5F9', label:'Dark blue' },
  { cls:'hl-darkcyan',   hex:'#D4F0F5', label:'Dark cyan' },
  { cls:'hl-darkgreen',  hex:'#D4EDD9', label:'Dark green' },
  { cls:'hl-darkmagenta',hex:'#F0D9F7', label:'Dark magenta' },
  { cls:'hl-darkred',    hex:'#F9D9D9', label:'Dark red' },
  { cls:'hl-darkyellow', hex:'#FFF0CC', label:'Dark yellow' },
  { cls:'hl-lightgray',  hex:'#F2F2F0', label:'Light grey' },
  { cls:'hl-darkgray',   hex:'#E6E5E0', label:'Dark grey' },
];

const WORD_HIGHLIGHT_HEX = {
  yellow: '#fff8dc',
  green: '#dff2e3',
  cyan: '#dff4f7',
  magenta: '#fddee8',
  pink: '#fddee8',
  blue: '#ddeeff',
  red: '#fddede',
  darkBlue: '#d4e5f9',
  darkCyan: '#d4f0f5',
  darkGreen: '#d4edd9',
  darkMagenta: '#f0d9f7',
  darkRed: '#f9d9d9',
  darkYellow: '#fff0cc',
  lightGray: '#f2f2f0',
  darkGray: '#e6e5e0',
};

const BG_SKIP_HEX = new Set(['#ffffff', '#fff']);

function normText(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function nameMatches(a, b) {
  const na = normText(a);
  const nb = normText(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function normalizeHex(hex) {
  if (!hex) return null;
  const h = String(hex).trim().toLowerCase();
  if (!h.startsWith('#')) return null;
  if (h.length === 4) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  if (h.length === 7) return h;
  return null;
}

function cssColorToHex(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  const fromHex = normalizeHex(v);
  if (fromHex) return fromHex;
  const m = v.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(',').map(p => p.trim());
  if (parts.length < 3) return null;
  const rgb = parts.slice(0, 3).map(n => Math.max(0, Math.min(255, parseInt(n, 10) || 0)));
  return '#' + rgb.map(n => n.toString(16).padStart(2, '0')).join('');
}

function collectStyleHexes(styleText) {
  if (!styleText) return [];
  const out = [];
  const rx = /background(?:-color)?\s*:\s*([^;]+)/gi;
  let match;
  while ((match = rx.exec(styleText)) !== null) {
    const hex = cssColorToHex(match[1]);
    if (hex) out.push(hex);
  }
  return out;
}

function collectComputedHexesFromHtml(html) {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '1px';
  host.style.height = '1px';
  host.style.overflow = 'hidden';
  host.style.opacity = '0';
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = html;
  document.body.appendChild(host);
  const out = [];
  try {
    const all = host.querySelectorAll('*');
    all.forEach(el => {
      const bg = window.getComputedStyle(el).backgroundColor;
      const hex = cssColorToHex(bg);
      if (hex) out.push(hex);
    });
  } finally {
    document.body.removeChild(host);
  }
  return out;
}

function scanHighlights(html) {
  const div = document.createElement('div');
  div.innerHTML = html;

  // Deduplicate by hex (pink + magenta are same colour)
  const seen = new Set();
  const found = [];
  function pushFound(h) {
    const hex = normalizeHex(h.hex);
    if (!hex || BG_SKIP_HEX.has(hex) || seen.has(hex)) return;
    seen.add(hex);
    found.push({ ...h, hex });
  }

  HIGHLIGHT_MAP.forEach(h => {
    if (div.getElementsByClassName(h.cls).length > 0) {
      pushFound(h);
    }
  });

  // Also detect custom inline pastel background colours (not in Word's named highlight palette).
  const styled = div.querySelectorAll('[style*="background"], [style*="background-color"]');
  styled.forEach(el => {
    const hexes = collectStyleHexes(el.getAttribute('style') || '');
    hexes.forEach(hex => pushFound({ cls:null, hex, label:'Custom' }));
  });

  // Catch highlight colours defined via CSS classes by checking computed styles.
  collectComputedHexesFromHtml(html).forEach(hex => {
    pushFound({ cls:null, hex, label:'Custom' });
  });

  return found;
}

function mergeHighlightSets(primary, secondary) {
  const seen = new Set();
  const out = [];
  [...(primary || []), ...(secondary || [])].forEach(h => {
    const hex = normalizeHex(h?.hex);
    if (!hex || BG_SKIP_HEX.has(hex) || seen.has(hex)) return;
    seen.add(hex);
    out.push({ cls: h?.cls || null, hex, label: h?.label || 'Custom' });
  });
  return out;
}

function fillToHighlightName(hex) {
  const h = (hex || '').toUpperCase().replace('#', '');
  if (h.length !== 6) return 'yellow';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (r > 230 && g > 230 && b > 230) return null;
  if (r < 30 && g < 30 && b < 30) return null;
  if (r > 200 && g > 200 && b < 120) return 'yellow';
  if (r > 180 && g > 180 && b < 80) return 'darkYellow';
  if (g > 150 && r < 150 && b < 150) return 'green';
  if (g > 100 && r < 100 && b < 100) return 'darkGreen';
  if (b > 150 && g > 150 && r < 150) return 'cyan';
  if (b > 100 && g > 100 && r < 100) return 'darkCyan';
  if (r > 200 && g < 100 && b < 100) return 'red';
  if (r > 120 && g < 80 && b < 80) return 'darkRed';
  if (b > 180 && r < 120 && g < 150) return 'blue';
  if (b > 120 && r < 80 && g < 80) return 'darkBlue';
  if (r > 150 && b > 150 && g < 120) return 'magenta';
  if (r > 200 && b > 150 && g > 100) return 'pink';
  if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && r > 150) return 'lightGray';
  if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30) return 'darkGray';
  return 'yellow';
}

const SLOT_NAMES = ['yellow','green','cyan','magenta','pink','blue','red','darkBlue','darkCyan','darkGreen','darkMagenta','darkRed','darkYellow','lightGray','darkGray'];

export async function convertShadingToHighlight(arrayBuffer) {
  try {
    const jszipMod = await import('jszip');
    const JSZip = jszipMod.default || jszipMod;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return { buffer: arrayBuffer, shdCount: 0, hexMap: {} };
    let docXml = await docXmlFile.async('string');
    let shdCount = 0;

    // Collect all unique fill hex colors from w:shd elements
    const allShd = docXml.match(/<w:shd\b[^>]*>/g) || [];
    const fillSet = new Set();
    allShd.forEach(s => { const m = s.match(/w:fill\s*=\s*"([^"]+)"/); if (m) fillSet.add(m[1].toUpperCase()); });

    // Find existing w:highlight color names (reserve those slots)
    const existingHlVals = new Set();
    (docXml.match(/<w:highlight\s+w:val="([^"]+)"/g) || []).forEach(m => {
      const v = m.match(/w:val="([^"]+)"/); if (v) existingHlVals.add(v[1]);
    });

    // Build unique hex → named-color slot mapping
    const hexToSlot = new Map();
    const usedSlots = new Set(existingHlVals);
    const validFills = [...fillSet].filter(h => {
      if (h === 'AUTO' || h === 'FFFFFF') return false;
      return fillToHighlightName(h) !== null;
    });
    for (const hex of validFills) {
      const natural = fillToHighlightName(hex);
      if (natural && !usedSlots.has(natural)) {
        hexToSlot.set(hex, natural);
        usedSlots.add(natural);
      }
    }
    const freeSlots = SLOT_NAMES.filter(s => !usedSlots.has(s));
    let freeIdx = 0;
    for (const hex of validFills) {
      if (!hexToSlot.has(hex)) {
        if (freeIdx < freeSlots.length) {
          hexToSlot.set(hex, freeSlots[freeIdx++]);
        } else {
          hexToSlot.set(hex, 'yellow');
        }
      }
    }

    const hexMap = {};
    for (const [hex, slot] of hexToSlot) hexMap[slot] = hex;

    function getSlot(fill) {
      const h = (fill || '').toUpperCase().replace('#', '');
      return hexToSlot.get(h) || fillToHighlightName(fill) || 'yellow';
    }

    // Strategy 1: Run-level (w:rPr) shading → w:highlight
    const rPrRegex = /<(?:w:)?rPr\b[^>]*>([\s\S]*?)<\/(?:w:)?rPr>/g;
    docXml = docXml.replace(rPrRegex, (match, inner) => {
      if (/<(?:w:)?highlight\b/.test(inner)) return match;
      const shdMatch = inner.match(/<(?:w:)?shd\b[^>]*(?:w:)?fill\s*=\s*"([^"]+)"[^>]*\/?>/i);
      if (!shdMatch) return match;
      const fill = shdMatch[1];
      if (!fill || fill.toLowerCase() === 'auto') return match;
      const hlName = getSlot(fill);
      if (!hlName) return match;
      shdCount++;
      const closeTag = match.match(/<\/(?:w:)?rPr>/)[0];
      return match.replace(closeTag, `<w:highlight w:val="${hlName}"/>${closeTag}`);
    });

    // Paragraph-level shading often means a Word/Docs line background, not a
    // word highlight. Leave it alone so we do not color a whole line by mistake.

    if (shdCount === 0) return { buffer: arrayBuffer, shdCount: 0, hexMap };
    zip.file('word/document.xml', docXml);
    const newBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    return { buffer: newBuffer, shdCount, hexMap };
  } catch (err) {
    console.warn('Shading-to-highlight conversion failed, using original:', err);
    return { buffer: arrayBuffer, shdCount: 0, hexMap: {} };
  }
}

// Post-process mammoth HTML: inject original hex colors as inline styles
export function applyHexColors(html, hexMap) {
  if (!hexMap || Object.keys(hexMap).length === 0) return html;
  let result = html;
  for (const [slot, hex] of Object.entries(hexMap)) {
    const cls = `hl-${slot.toLowerCase()}`;
    result = result.replaceAll(`class="${cls}"`, `class="${cls}" style="background:#${hex}"`);
  }
  return result;
}

async function extractDocxHighlightColors(arrayBuffer) {
  try {
    const jszipMod = await import('jszip');
    const JSZip = jszipMod.default || jszipMod;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const xmlPaths = Object.keys(zip.files).filter(p => /^word\/.*\.xml$/i.test(p));
    const xmlDocs = await Promise.all(xmlPaths.map(p => zip.files[p].async('string')));
    const found = [];

    xmlDocs.forEach(xml => {
      const highlightRx = /<w:highlight\b[^>]*\bw:val="([^"]+)"[^>]*\/?/gi;
      let hm;
      while ((hm = highlightRx.exec(xml)) !== null) {
        const key = hm[1];
        const hex = WORD_HIGHLIGHT_HEX[key];
        if (hex) found.push({ cls: null, hex, label: 'Word highlight' });
      }

      const shdRx = /<w:shd\b[^>]*\bw:fill="([^"]+)"[^>]*\/?/gi;
      let sm;
      while ((sm = shdRx.exec(xml)) !== null) {
        const raw = (sm[1] || '').trim();
        if (!raw || /^auto$/i.test(raw)) continue;
        const hex = normalizeHex(raw.startsWith('#') ? raw : `#${raw}`);
        if (hex) found.push({ cls: null, hex, label: 'Word shading' });
      }
    });

    return mergeHighlightSets([], found);
  } catch (e) {
    // Best-effort extraction only: never block setup if a DOCX has unusual XML.
    console.warn('DOCX highlight extraction fallback:', e);
    return [];
  }
}

export function parseStructure(html, chapterTag, narratorColors, options = {}) {
  const splitScenes = options.splitScenes !== false;
  const div = document.createElement('div');
  div.innerHTML = html;
  const charNames = narratorColors.map(nc => ({ name:(nc.characterName||''), nc })).filter(c=>normText(c.name));
  const rawChapters = [];
  let curCh = null;
  Array.from(div.childNodes).forEach(node => {
    const tag = node.nodeName?.toLowerCase();
    if (tag === chapterTag) {
      if (curCh) rawChapters.push(curCh);
      curCh = { title: node.textContent.trim(), nodes: [] };
    } else {
      if (!curCh) curCh = { title: '(Before first chapter)', nodes: [] };
      curCh.nodes.push(node.cloneNode(true));
    }
  });
  if (curCh) rawChapters.push(curCh);
  const subTag = chapterTag === 'h1' ? 'h2' : chapterTag === 'h2' ? 'h3' : null;
  return rawChapters.map(ch => ({ id: uid(), title: ch.title, sections: buildSections(ch.nodes, subTag, charNames, ch.title, splitScenes) }));
}

function buildSections(nodes, subTag, charNames, chapterTitle, splitScenes = true) {
  if (!subTag || !splitScenes) return [{ id:uid(), title:chapterTitle, html:nodes.map(n=>n.outerHTML||n.textContent||'').join(''), audioFileName:null, flags:[], completed:false, characterName:null, narratorName:null, isCharPOV:false }];
  const segments = []; let cur = { title:null, nodes:[] };
  nodes.forEach(node => {
    if (node.nodeName?.toLowerCase() === subTag) { if (cur.nodes.length||cur.title) segments.push(cur); cur = { title:node.textContent.trim(), nodes:[] }; }
    else cur.nodes.push(node);
  });
  if (cur.nodes.length||cur.title) segments.push(cur);
  if (!segments.length) return [{ id:uid(), title:chapterTitle, html:'', audioFileName:null, flags:[], completed:false, characterName:null, narratorName:null, isCharPOV:false }];
  const tagged = segments.map(seg => {
    if (!seg.title) return { ...seg, isChar:false, nc:null, inferredCharacterName:null, inferredNarratorName:null };
    const match = charNames.find(c => nameMatches(seg.title, c.name));
    const inferredCharacterName = match?.nc?.characterName || seg.title.trim();
    const inferredNarratorName = match?.nc?.narratorName || match?.nc?.characterName || seg.title.trim();
    return { ...seg, isChar:true, nc:match?.nc||null, inferredCharacterName, inferredNarratorName };
  });
  let pending = ''; const merged = [];
  for (const seg of tagged) {
    const segHtml = (seg.title ? `<h2 class="doc-h2">${esc(seg.title)}</h2>` : '') + seg.nodes.map(n=>n.outerHTML||n.textContent||'').join('');
    if (!seg.isChar) { pending += segHtml; }
    else {
      merged.push({
        title: seg.title,
        html: pending + segHtml,
        nc: seg.nc,
        characterName: seg.inferredCharacterName,
        narratorName: seg.inferredNarratorName,
      });
      pending='';
    }
  }
  if (pending) { if (merged.length) merged[merged.length-1].html += pending; else merged.push({ title:chapterTitle, html:pending, nc:null }); }
  if (!merged.length) return [{ id:uid(), title:chapterTitle, html:tagged.map(s=>(s.title?`<h2 class="doc-h2">${esc(s.title)}</h2>`:'')+s.nodes.map(n=>n.outerHTML||n.textContent||'').join('')).join(''), audioFileName:null, flags:[], completed:false, characterName:null, narratorName:null, isCharPOV:false }];
  return merged.map(m => {
    const hasCharacterHeading = !!(m.characterName || m.title);
    return {
      id:uid(),
      title:m.title||chapterTitle,
      html:m.html,
      audioFileName:null,
      flags:[],
      completed:false,
      characterName:m.characterName||null,
      narratorName:m.narratorName||m.characterName||null,
      isCharPOV:hasCharacterHeading,
    };
  });
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function uid() { return Math.random().toString(36).slice(2)+Date.now().toString(36); }

function withReviewState(parsed, previous = []) {
  return parsed.map((chapter, chapterIndex) => {
    const prevChapter = previous[chapterIndex];
    return {
      ...chapter,
      included: prevChapter?.included ?? true,
      firstChapter: prevChapter?.firstChapter ?? chapterIndex === 0,
      sections: (chapter.sections || []).map((section, sectionIndex) => ({
        ...section,
        included: prevChapter?.sections?.[sectionIndex]?.included ?? true,
      })),
    };
  });
}

function applyChapterNumbers(chapters) {
  let chapterNumber = 0;
  return (chapters || []).map((chapter, index) => {
    if (index === 0 || chapter.firstChapter) chapterNumber = 1;
    else chapterNumber += 1;
    return {
      ...chapter,
      chapterNumber,
    };
  });
}

function nextManualColor(existing) {
  const manualCount = (existing || []).filter(nc => !nc.cls).length;
  return DEFAULT_MANUAL_COLORS[manualCount % DEFAULT_MANUAL_COLORS.length];
}

const inp = { width:'100%',border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px',fontSize:'0.875rem',fontFamily:'inherit',background:'white',color:'var(--text)',outline:'none' };
const lbl = { display:'block',fontSize:'0.68rem',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5 };
const card = { background:'white',borderRadius:16,border:'1px solid var(--border)',padding:'1.15rem',marginBottom:'0.75rem' };
function Badge({ n }) { return <div style={{ width:22,height:22,borderRadius:'50%',background:'var(--accent)',color:'white',fontSize:'0.68rem',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{n}</div>; }

export default function BookSetup({ onSave, onBack, pageOffset = -1, isElectron = false, onImportTransfer }) {
  const [bookTitle, setBookTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [fullHtml, setFullHtml] = useState('');
  const [chapterLevel, setChapterLevel] = useState(1);
  const [splitScenes, setSplitScenes] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [docxSource, setDocxSource] = useState(null);
  // Narrator colours — either scanned from doc or manually added
  const [narratorColors, setNarratorColors] = useState([]);
  // Colours found in the doc waiting to be assigned
  const [scannedColors, setScannedColors] = useState(null); // null = not scanned yet
  const [loading, setLoading] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manuscriptPaging, setManuscriptPaging] = useState(null);
  const [pdfPaging, setPdfPaging] = useState(null);
  const [pdfFileName, setPdfFileName] = useState('');

  const chapterTag = `h${chapterLevel}`;
  const normalizedPageOffset = Number.isFinite(Number(pageOffset)) ? Number(pageOffset) : -1;

  function formatPdfError(errors, fallbackMessage) {
    const messages = [...new Set((errors || []).map(error => String(error?.message || '').trim()).filter(Boolean))];
    return messages[0] || fallbackMessage;
  }

  function toPdfFile(fileNameHint, data) {
    const pdfName = fileNameHint || 'document.pdf';
    const pdfBytes = data instanceof Uint8Array ? data : new Uint8Array(data || []);
    return {
      name: pdfName,
      async arrayBuffer() {
        return pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
      },
    };
  }

  async function extractPdfPagingInRenderer(file, fileNameHint = '') {
    const extracted = await extractPdfPagingFromFile(file, { pageOffset: normalizedPageOffset });
    return {
      ...extracted,
      fileName: fileNameHint || extracted.fileName || file?.name || 'document.pdf',
      pageOffset: Number.isFinite(Number(extracted?.pageOffset)) ? Number(extracted.pageOffset) : normalizedPageOffset,
    };
  }

  async function extractPdfPagingWithFallback(file) {
    const failures = [];

    if (window.electron?.extractPdfPaging) {
      try {
        return await window.electron.extractPdfPaging({
          fileName: file.name,
          data: new Uint8Array(await file.arrayBuffer()),
          pageOffset: normalizedPageOffset,
        });
      } catch (error) {
        console.warn('Electron PDF extraction failed, trying renderer fallback:', error);
        failures.push(error);
      }
    }

    try {
      return await extractPdfPagingInRenderer(file, file.name);
    } catch (error) {
      failures.push(error);
    }

    throw new Error(formatPdfError(failures, 'Could not scan page numbers from that PDF.'));
  }

  async function extractDocxPdfPaging(docxBytes, originalFileName) {
    const fallbackPdfName = originalFileName.replace(/\.docx$/i, '.pdf');
    const failures = [];

    if (window.electron?.convertDocxToPageMap) {
      try {
        const converted = await window.electron.convertDocxToPageMap({
          name: originalFileName,
          data: docxBytes,
          pageOffset: normalizedPageOffset,
        });
        if (converted?.pdfPaging) {
          return {
            pdfPaging: converted.pdfPaging,
            fileName: converted.fileName || fallbackPdfName,
          };
        }
        failures.push(new Error('The app converted the manuscript but did not return a page map.'));
      } catch (error) {
        console.warn('Main-process DOCX page scan failed, trying renderer fallback:', error);
        failures.push(error);
      }
    }

    if (!window.electron?.convertDocxToPdf) {
      throw new Error(formatPdfError(failures, 'Automatic DOCX page scanning is unavailable in this runtime.'));
    }

    try {
      const convertedPdf = await window.electron.convertDocxToPdf({
        name: originalFileName,
        data: docxBytes,
      });
      if (!convertedPdf?.pdfData) {
        throw new Error('The app created a PDF, but the PDF file was empty.');
      }
      const resolvedFileName = convertedPdf.fileName || fallbackPdfName;
      const rendererPaging = await extractPdfPagingInRenderer(
        toPdfFile(resolvedFileName, convertedPdf.pdfData),
        resolvedFileName
      );
      return {
        pdfPaging: rendererPaging,
        fileName: resolvedFileName,
      };
    } catch (error) {
      failures.push(error);
    }

    throw new Error(formatPdfError(failures, 'Could not scan page numbers automatically from this DOCX.'));
  }

  async function handleDocx(file) {
    setLoading(true);
    setPdfStatus('');
    try {
      const mammoth = (await import('mammoth')).default;
      const ab = await file.arrayBuffer();
      const docxBytes = new Uint8Array(ab);
      const { buffer: processedAb, hexMap } = await convertShadingToHighlight(ab);
      const result = await mammoth.convertToHtml({ arrayBuffer: processedAb }, { styleMap: STYLE_MAP });
      const jszipMod = await import('jszip');
      const JSZip = jszipMod.default || jszipMod;
      const zip = await JSZip.loadAsync(ab);
      const documentXml = await zip.file('word/document.xml')?.async('string');
      setManuscriptPaging(extractRenderedPageMapFromDocxXml(documentXml) || null);
      setPdfPaging(null);
      setPdfFileName('');
      const processedHtml = applyHexColors(result.value, hexMap);
      setFullHtml(processedHtml);
      setFileName(file.name);
      setDocxSource({ fileName: file.name, data: docxBytes });
      if (!bookTitle) setBookTitle(file.name.replace(/\.docx$/i,''));
      // Scan for highlight colours from rendered HTML and raw DOCX XML (highlight + shading).
      const htmlFound = scanHighlights(processedHtml);
      let docxFound = [];
      try {
        docxFound = await extractDocxHighlightColors(ab);
      } catch {
        docxFound = [];
      }
      const found = mergeHighlightSets(htmlFound, docxFound);
      setScannedColors(found);
      // Start with one gentle manual row instead of flooding the screen with every detected highlight.
      setNarratorColors([{ hex:DEFAULT_MANUAL_COLORS[0], cls:null, label:'Custom', characterName:'', narratorName:'' }]);
      // Parse chapters (names empty for now — will reparse on save)
      const parsed = parseStructure(processedHtml, chapterTag, [], { splitScenes });
      setChapters(withReviewState(parsed));

      if (window.electron?.convertDocxToPdf) {
        try {
          setPdfStatus('Generating page map from your DOCX…');
          const converted = await extractDocxPdfPaging(docxBytes, file.name);
          const nextPdfPaging = converted.pdfPaging;
          if (!nextPdfPaging) {
            throw new Error('The app did not return a page map for this manuscript.');
          }
          setPdfPaging(nextPdfPaging);
          setPdfFileName(converted.fileName || file.name.replace(/\.docx$/i, '.pdf'));
          setPdfStatus('Page numbers scanned automatically.');
        } catch (pdfError) {
          console.warn('Automatic DOCX-to-PDF conversion failed:', pdfError);
          setPdfStatus(`Could not scan page numbers automatically: ${pdfError.message}`);
        }
      }
    } catch(e) { alert('Could not read file: '+e.message); }
    setLoading(false);
  }

  async function handlePdf(file) {
    setLoading(true);
    try {
      const nextPdfPaging = await extractPdfPagingWithFallback(file);
      setPdfPaging(nextPdfPaging);
      setPdfFileName(file.name);
      setPdfStatus('Using your uploaded PDF for page numbers.');
    } catch(e) {
      setPdfStatus(`Could not read that PDF: ${e.message}`);
      alert('Could not read PDF: ' + e.message);
    }
    setLoading(false);
  }

  function reparse(overrides = {}) {
    if (!fullHtml) return;
    const nextChapterTag = overrides.chapterTag || chapterTag;
    const nextSplitScenes = overrides.splitScenes ?? splitScenes;
    const parsed = parseStructure(fullHtml, nextChapterTag, narratorColors.filter(nc=>nc.characterName), { splitScenes: nextSplitScenes });
    setChapters(prev => withReviewState(parsed, prev));
  }

  function updateNC(i, field, val) {
    setNarratorColors(nc => nc.map((n,idx) => idx===i ? {...n,[field]:val} : n));
  }

  function addManualNC() {
    setNarratorColors(nc => [...nc, { hex:nextManualColor(nc), cls:null, label:'Custom', characterName:'', narratorName:'' }]);
    setShowManualAdd(false);
  }

  function removeNC(i) {
    setNarratorColors(nc => nc.filter((_,idx) => idx!==i));
  }

  function toggleChapterIncluded(id, included) {
    setChapters(cs => cs.map(c => c.id === id ? { ...c, included, sections: c.sections.map(s => ({ ...s, included })) } : c));
  }

  function toggleSectionIncluded(chapId, secId, included) {
    setChapters(cs => cs.map(c => c.id === chapId
      ? {
          ...c,
          sections: c.sections.map(s => s.id === secId ? { ...s, included } : s),
          included: c.sections.some(s => s.id === secId ? included : s.included),
        }
      : c));
  }

  function setAllChaptersIncluded(included) {
    setChapters(cs => cs.map(c => ({
      ...c,
      included,
      sections: (c.sections || []).map(s => ({ ...s, included })),
    })));
  }

  function toggleFirstChapter(id) {
    setChapters(cs => cs.map((c, index) => {
      if (c.id !== id) return index === 0 ? { ...c, firstChapter: true } : c;
      if (index === 0) return { ...c, firstChapter: true };
      return { ...c, firstChapter: !c.firstChapter };
    }));
  }

  const totalSections = chapters.reduce((n,c)=>n+((c.included===false?[]:(c.sections||[])).filter(s=>s.included!==false).length),0);
  const allReviewItemsIncluded = chapters.length > 0 && chapters.every(c => c.included !== false && (c.sections || []).every(s => s.included !== false));
  const anyReviewItemsIncluded = chapters.some(c => c.included !== false && (c.sections || []).some(s => s.included !== false));
  const namedColors = narratorColors.filter(nc=>nc.characterName.trim());

  async function doSave() {
    const bookId = Date.now();
    const finalColors = namedColors;
    const numberedChapters = applyChapterNumbers(
      (chapters || [])
        .filter(ch => ch.included !== false)
        .map(ch => ({
          ...ch,
          sections: (ch.sections || []).filter(sec => sec.included !== false).map(sec => ({
            ...sec,
            included: undefined,
          })),
        }))
        .filter(ch => (ch.sections || []).length > 0)
        .map(ch => ({
          ...ch,
          included: undefined,
        }))
    );
    const paging = annotateManuscriptPositions(numberedChapters, {
      wordsPerPage: manuscriptPaging?.wordsPerPage,
      pageMap: manuscriptPaging?.pageMap,
      startPageNumber: manuscriptPaging?.startPageNumber,
    });
    const manuscriptSource = {
      stored: false,
      fileName,
    };

    if (window.electron?.saveManuscriptSource && docxSource?.data) {
      try {
        await window.electron.saveManuscriptSource({
          bookId,
          data: docxSource.data,
        });
        manuscriptSource.stored = true;
      } catch (error) {
        console.warn('Could not store manuscript source for rescan:', error);
      }
    }

    onSave({
      id:bookId,
      title:bookTitle||fileName||'Untitled',
      fileName,
      manuscriptSource,
      chapterLevel,
      splitScenes,
      narratorColors:finalColors,
      chapters:paging.chapters,
      manuscriptPaging: {
        mode: paging.mode,
        wordsPerPage: paging.wordsPerPage,
        totalWordCount: paging.totalWordCount,
        estimatedPageCount: paging.estimatedPageCount,
        exactPageCount: paging.exactPageCount,
        pageMap: paging.mode === 'rendered' ? paging.pageMap : undefined,
        startPageNumber: paging.pageMap[0]?.pageNumber || 1,
      },
      pdfPaging: pdfPaging ? {
        mode: pdfPaging.mode,
        fileName: pdfFileName || pdfPaging.fileName,
        pageOffset: Number.isFinite(Number(pdfPaging.pageOffset)) ? Number(pdfPaging.pageOffset) : Number(pageOffset) || -1,
        pageCount: pdfPaging.pageCount,
        printedPageCount: pdfPaging.printedPageCount,
        pages: pdfPaging.pages,
      } : undefined,
    });
  }

  function exportConfig() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ title:bookTitle, fileName, pdfFileName, chapterLevel, splitScenes, narratorColors, chapters, manuscriptPaging, pdfPaging },null,2)],{type:'application/json'}));
    a.download = `${bookTitle||'book'}-config.json`; a.click();
  }

  return (
    <div style={{ minHeight:'100vh',background:'var(--cream)' }}>
      <button
        onClick={onBack}
        aria-label="Back to home"
        title="Back to home"
        style={{ position:'fixed',top:52,left:16,zIndex:1210,width:48,height:48,borderRadius:'50%',border:'1px solid var(--border)',background:'white',color:'var(--text-muted)',fontSize:'1.35rem',fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 6px 16px rgba(0,0,0,0.08)' }}
      >
        ←
      </button>
      <div style={{ maxWidth:620,margin:'0 auto',padding:'1.5rem 1.25rem 3.25rem' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:'0.25rem' }}>
          <h2 style={{ fontSize:'1.5rem',fontWeight:700,letterSpacing:'-0.02em',color:'var(--text)' }}>Create new book</h2>
          {isElectron && onImportTransfer && (
            <button
              type="button"
              onClick={onImportTransfer}
              style={{ padding:'8px 14px',borderRadius:999,border:'1px solid var(--accent-border)',background:'white',color:'var(--accent-dark)',fontWeight:800,fontSize:'0.78rem',cursor:'pointer',whiteSpace:'nowrap',boxShadow:'0 8px 18px var(--accent-shadow)' }}
            >
              Import
            </button>
          )}
        </div>
        <p style={{ fontSize:'0.8rem',color:'var(--text-muted)',margin:'0 0 1.2rem' }}>Upload your manuscript and review the structure before audio setup.</p>

        {/* Step 1: Title */}
        <div style={{ ...card, padding:'1rem 1rem 1.1rem', minHeight:118 }} data-tutorial="book-title">
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:'0.875rem' }}><Badge n={1} /><span style={{ fontWeight:600,fontSize:'0.925rem' }}>Book title</span></div>
          <input type="text" value={bookTitle} onChange={e=>setBookTitle(e.target.value)} placeholder="e.g. The Lincoln Pack" style={inp} />
        </div>

        {/* Step 2: Upload */}
        <div style={card} data-tutorial="manuscript-upload">
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:'0.875rem' }}>
            <Badge n={2} /><span style={{ fontWeight:600,fontSize:'0.925rem' }}>Manuscript</span>
            <InfoTip tip={'Script and Sync imports manuscript files as .docx only right now. If your manuscript is in Google Docs, Pages, PDF, .doc, or .rtf, export it to .docx first.'} />
          </div>
          <div style={{ marginBottom:'0.875rem' }}>
            <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:5 }}>
              <label style={{ ...lbl, marginBottom:0 }}>Which heading level marks chapter numbers?</label>
              <InfoTip tip={'Choose the heading level used for chapter starts. The next heading level down is treated as the POV or scene break when present.'} />
            </div>
            <div style={{ display:'flex',gap:6,alignItems:'center' }}>
              {[1,2,3].map(n=>(
                <button key={n} onClick={()=>{setChapterLevel(n);if(fullHtml){setTimeout(()=>reparse({ chapterTag:`h${n}` }),0);}}}
                  style={{ padding:'6px 16px',borderRadius:8,border:'1px solid var(--border)',background:chapterLevel===n?'var(--accent)':'white',color:chapterLevel===n?'white':'var(--text)',cursor:'pointer',fontWeight:chapterLevel===n?600:400,fontSize:'0.875rem' }}>H{n}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:'0.875rem',padding:'10px 12px',background:'white',border:'1px solid var(--border)',borderRadius:10 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap' }}>
              <div>
                <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:3 }}>
                  <label style={{ ...lbl, marginBottom:0 }}>Scene splitting</label>
                  <InfoTip tip={'Leave this off when one audio file covers a full chapter. Turn it on only if you want separate POV or scene rows in the proofing list.'} />
                </div>
                <div style={{ fontSize:'0.78rem',color:'var(--text-muted)' }}>
                  {splitScenes ? 'Each chapter will be imported as separate scene rows.' : 'Each chapter will stay as one proofing row by default.'}
                </div>
              </div>
              <button
                type="button"
                onClick={()=>{
                  const next = !splitScenes;
                  setSplitScenes(next);
                  if(fullHtml){setTimeout(()=>reparse({ splitScenes:next }),0);}
                }}
                style={{
                  padding:'7px 14px',
                  borderRadius:999,
                  border:'1px solid ' + (splitScenes ? 'var(--accent)' : 'var(--border)'),
                  background:splitScenes ? 'var(--accent-light)' : 'white',
                  color:splitScenes ? 'var(--accent-dark)' : 'var(--text)',
                  fontWeight:700,
                  cursor:'pointer',
                  fontSize:'0.8rem',
                  whiteSpace:'nowrap',
                }}
              >
                {splitScenes ? 'Split scenes on' : 'Split scenes off'}
              </button>
            </div>
          </div>
          {!fullHtml ? (
            <label style={{ display:'flex',flexDirection:'column',alignItems:'center',border:'1.5px dashed var(--border)',borderRadius:12,padding:'2rem',cursor:'pointer',background:'var(--cream)',transition:'background 0.15s' }}
              onMouseEnter={e=>e.currentTarget.style.background='var(--accent-light)'}
              onMouseLeave={e=>e.currentTarget.style.background='var(--cream)'}>
              <input type="file" accept=".docx" style={{ display:'none' }} onChange={e=>e.target.files[0]&&handleDocx(e.target.files[0])} />
              {loading?<><div style={{ fontSize:24,marginBottom:8 }}>⏳</div><p style={{ color:'var(--text-muted)',fontSize:'0.875rem' }}>Scanning manuscript…</p></>
                :<><div style={{ fontSize:28,marginBottom:10 }}>📄</div>
                  <p style={{ fontWeight:600,fontSize:'0.875rem',color:'var(--text)',marginBottom:0 }}>Upload manuscript .docx</p></>}
            </label>
          ) : (
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'var(--success-light)',borderRadius:10,border:'1px solid #d3ddd6' }}>
              <span style={{ fontSize:'0.875rem',color:'var(--success)',fontWeight:500 }}>✓ {fileName} · {chapters.length} chapters · {totalSections} sections</span>
              <label style={{ fontSize:'0.75rem',color:'var(--text-muted)',cursor:'pointer',textDecoration:'underline' }}>Re-upload<input type="file" accept=".docx" style={{ display:'none' }} onChange={e=>e.target.files[0]&&handleDocx(e.target.files[0])} /></label>
            </div>
          )}
          {fullHtml && (
            <div style={{ marginTop:'0.875rem',padding:'12px 14px',background:'white',border:'1px solid var(--border)',borderRadius:10 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:6 }}>
                <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                  <div style={{ fontSize:'0.86rem',fontWeight:800,color:'var(--accent-dark)' }}>Page numbers</div>
                  <InfoTip tip={'Script and Sync first tries to scan page numbers from the .docx. If that does not work cleanly, upload a matching PDF of the same manuscript here.'} />
                </div>
                <label style={{ fontSize:'0.78rem',color:'var(--accent)',cursor:'pointer',textDecoration:'underline',whiteSpace:'nowrap' }}>
                  {pdfPaging ? 'Replace PDF' : 'Upload PDF manually'}
                  <input type="file" accept="application/pdf,.pdf" style={{ display:'none' }} onChange={e=>e.target.files[0]&&handlePdf(e.target.files[0])} />
                </label>
              </div>
              {pdfStatus && (
                <div style={{ fontSize:'0.72rem',color:'var(--accent)',fontWeight:700,marginTop:4,lineHeight:1.5 }}>
                  {pdfStatus}
                </div>
              )}
              {pdfPaging ? (
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:8 }}>
                  <span style={{ fontSize:'0.84rem',color:'var(--accent-dark)',fontWeight:800,lineHeight:1.45 }}>
                    {(pdfPaging.printedPageCount || 0) > 0
                      ? `Found ${pdfPaging.printedPageCount || 0} printed page numbers across ${pdfPaging.pageCount} PDF pages`
                      : `No printed page numbers were found across ${pdfPaging.pageCount} PDF pages`}
                  </span>
                  <button onClick={()=>{setPdfPaging(null);setPdfFileName('');setPdfStatus('');}} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'0.75rem',color:'var(--text-muted)',textDecoration:'underline',padding:0 }}>
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Step 3: Assign highlight colours (shown after upload) */}
        {scannedColors !== null && (
          <div style={card} data-tutorial="narrator-mapping">
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:'0.875rem' }}>
              <Badge n={3} />
              <span style={{ fontWeight:600,fontSize:'0.925rem' }}>Character ↔ narrator mapping (primary)</span>
              <InfoTip tip={`Match each POV character heading to the narrator name you want on flags. Highlight colors are optional; H${Math.min(chapterLevel+1,3)} headings are still the main matcher.`} />
              {scannedColors.length > 0
                ? <span style={{ fontSize:'0.72rem',color:'var(--success)',background:'var(--success-light)',padding:'2px 8px',borderRadius:20 }}>✓ {scannedColors.length} highlight colour{scannedColors.length!==1?'s':''} found</span>
                : <span style={{ fontSize:'0.72rem',color:'var(--text-muted)',background:'var(--cream)',padding:'2px 8px',borderRadius:20 }}>No highlights found — H2 mapping still works</span>}
            </div>

            {/* No highlight = narrator row */}
            <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'var(--cream)',borderRadius:10,marginBottom:10 }}>
              <div style={{ width:32,height:32,borderRadius:8,background:'white',border:'1px solid var(--border)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>—</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'0.8rem',fontWeight:500 }}>No highlight</div>
                <div style={{ fontSize:'0.7rem',color:'var(--text-muted)' }}>Narrating voice — use the narrator name set below</div>
              </div>
            </div>

            {/* Scanned colours */}
            {narratorColors.map((nc,i) => (
              <div key={i} style={{ display:'grid',gridTemplateColumns:'42px 1fr 1fr auto',gap:8,alignItems:'end',marginBottom:10 }}>
                {/* Colour swatch — editable if manual, fixed if from doc */}
                <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:3 }}>
                  {nc.cls ? (
                    <div style={{ width:36,height:36,borderRadius:8,background:nc.hex,border:'1px solid var(--border)',flexShrink:0 }} title={nc.label} />
                  ) : (
                    <input type="color" value={nc.hex} onChange={e=>updateNC(i,'hex',e.target.value)} style={{ width:36,height:36,borderRadius:8,border:'1px solid var(--border)',cursor:'pointer',padding:2 }} />
                  )}
                  <span style={{ fontSize:'0.58rem',color:'var(--text-light)',textAlign:'center',lineHeight:1.2 }}>{nc.label}</span>
                </div>
                <div>
                  <div style={lbl}>Character name <span style={{ color:'var(--text-light)',fontWeight:400,textTransform:'none',letterSpacing:0 }}>(main matcher for H{Math.min(chapterLevel+1,3)} headings)</span></div>
                  <input type="text" value={nc.characterName} onChange={e=>updateNC(i,'characterName',e.target.value)} placeholder="e.g. Crescent" style={inp} />
                </div>
                <div>
                  <div style={lbl}>Narrator name <span style={{ color:'var(--text-light)',fontWeight:400,textTransform:'none',letterSpacing:0 }}>(used as default narrator)</span></div>
                  <input type="text" value={nc.narratorName} onChange={e=>updateNC(i,'narratorName',e.target.value)} placeholder="e.g. Alyssa (Crescent)" style={inp} />
                </div>
                <button onClick={()=>removeNC(i)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-light)',fontSize:'1.2rem',padding:'0 2px',marginBottom:2,alignSelf:'flex-end' }}>×</button>
              </div>
            ))}

            <button onClick={addManualNC} style={{ width:'100%',background:'none',border:'1px dashed var(--border)',borderRadius:8,padding:'7px',fontSize:'0.8rem',color:'var(--text-muted)',cursor:'pointer',marginTop:4 }}>
              + Add character mapping
            </button>
          </div>
        )}

        {/* Chapter list preview */}
        {chapters.length > 0 && (
          <div style={card} data-tutorial="review-chapters">
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:'0.875rem' }}>
              <Badge n={scannedColors!==null?4:3} /><span style={{ fontWeight:600,fontSize:'0.925rem' }}>Review chapters</span>
              <InfoTip tip={'Untick anything you do not want to import. Use "Set as first" if front matter or bonus content means the next chapter should restart as Chapter 1.'} />
              <div style={{ display:'flex',alignItems:'center',gap:10,marginLeft:'auto' }}>
                <button onClick={reparse} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'0.78rem',color:'var(--accent)' }}>↻ Reparse with current names</button>
                <label style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'5px 8px',border:'1px solid var(--border)',borderRadius:8,background:'white',fontSize:'0.74rem',color:'var(--text-muted)',cursor:'pointer',whiteSpace:'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={allReviewItemsIncluded}
                    ref={el => { if (el) el.indeterminate = !allReviewItemsIncluded && anyReviewItemsIncluded; }}
                    onChange={() => setAllChaptersIncluded(!allReviewItemsIncluded)}
                    style={{ accentColor:'var(--accent)',margin:0 }}
                  />
                  {allReviewItemsIncluded ? 'Uncheck all' : 'Check all'}
                </label>
              </div>
            </div>
            <div style={{ maxHeight:240,overflowY:'auto',border:'1px solid var(--border-light)',borderRadius:10 }}>
              {chapters.map(ch=>(
                <div key={ch.id}>
                  <div style={{ display:'flex',alignItems:'center',padding:'8px 12px',background:'var(--cream)',borderBottom:'1px solid var(--border-light)',gap:8 }}>
                    <input type="checkbox" checked={ch.included !== false} onChange={e=>toggleChapterIncluded(ch.id, e.target.checked)} style={{ accentColor:'var(--accent)' }} />
                    <span style={{ fontSize:'0.65rem',fontFamily:'monospace',color:'var(--text-light)',minWidth:16 }}>H{chapterLevel}</span>
                    <span style={{ fontWeight:600,fontSize:'0.875rem',color:'var(--text)',flex:1,opacity:ch.included===false?0.5:1 }}>{ch.title}</span>
                    <span style={{ fontSize:'0.68rem',color:'var(--text-muted)' }}>Chapter {(applyChapterNumbers(chapters.filter(c => c.included !== false)).find(x => x.id === ch.id)?.chapterNumber) || 1}</span>
                    <button onClick={()=>toggleFirstChapter(ch.id)} style={{ padding:'4px 8px',borderRadius:8,border:'1px solid var(--border)',background:ch.firstChapter?'var(--accent-light)':'white',cursor:'pointer',fontSize:'0.68rem',color:'var(--text)' }}>
                      {ch.firstChapter ? (ch === chapters[0] ? 'First chapter' : 'Unset first') : 'Set as first'}
                    </button>
                  </div>
                  {(ch.sections||[]).map(sec=>{
                    const ncColor = narratorColors.find(nc=>nc.characterName===sec.characterName);
                    return (
                      <div key={sec.id} style={{ display:'flex',alignItems:'center',padding:'6px 12px 6px 24px',borderBottom:'1px solid var(--border-light)',gap:8,background:'white',opacity:(ch.included===false||sec.included===false)?0.5:1 }}>
                        <input type="checkbox" checked={ch.included !== false && sec.included !== false} disabled={ch.included===false} onChange={e=>toggleSectionIncluded(ch.id,sec.id,e.target.checked)} style={{ accentColor:'var(--accent)' }} />
                        <span style={{ fontSize:'0.65rem',fontFamily:'monospace',color:'var(--text-light)',minWidth:16 }}>H{Math.min(chapterLevel+1,3)}</span>
                        {ncColor && <div style={{ width:10,height:10,borderRadius:2,background:ncColor.hex,flexShrink:0 }} />}
                        <span style={{ fontSize:'0.8rem',color:sec.isCharPOV?'var(--text)':'var(--text-muted)',flex:1,fontStyle:sec.isCharPOV?'normal':'italic' }}>{sec.title}</span>
                        {sec.isCharPOV && <span style={{ fontSize:'0.65rem',color:'var(--text-muted)' }}>{sec.narratorName||sec.characterName}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {chapters.length > 0 && (
          <>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={doSave}
                data-tutorial="save-book"
                style={{ flex:1,padding:'13px',background:'var(--accent)',color:'white',border:'none',borderRadius:14,fontSize:'0.92rem',fontWeight:600,cursor:'pointer' }}>
                Save book ({totalSections} sections) →
              </button>
              <div style={{ display:'inline-flex',alignItems:'center',gap:8 }}>
                <button onClick={exportConfig} style={{ padding:'13px 16px',background:'white',border:'1px solid var(--border)',borderRadius:14,fontSize:'0.84rem',color:'var(--text-muted)',cursor:'pointer' }}>
                  💾 Export config
                </button>
                <InfoTip tip={'Exports the setup data for this book so you can restore it later if needed.'} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
