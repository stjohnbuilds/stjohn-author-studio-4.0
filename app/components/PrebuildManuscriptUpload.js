'use client';
import React, { useState } from 'react';

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

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Map hex fill color to closest Word highlight name.
// Includes exact matches for Google Docs' highlight palette.
const GDOCS_PALETTE = {
  'FFFF00': 'yellow', 'FFF200': 'yellow', 'FEFF00': 'yellow',
  'FFD966': 'darkYellow', 'F1C232': 'darkYellow', 'E69138': 'darkYellow',
  '00FF00': 'green', '93C47D': 'green', '6AA84F': 'darkGreen', 'B6D7A8': 'green',
  '00FFFF': 'cyan', 'A2C4C9': 'cyan', '76A5AF': 'darkCyan',
  'FF00FF': 'magenta', 'A64D79': 'darkMagenta', 'C27BA0': 'magenta',
  'D5A6BD': 'magenta', 'EAD1DC': 'pink',
  'FF0000': 'red', 'E06666': 'red', 'CC0000': 'darkRed', 'EA9999': 'red',
  '0000FF': 'blue', '6D9EEB': 'blue', '3D85C6': 'darkBlue', '6FA8DC': 'blue',
  'A4C2F4': 'blue', '9FC5E8': 'blue', 'CFE2F3': 'blue',
  'CC99FF': 'magenta', '8E7CC3': 'darkMagenta', 'B4A7D6': 'magenta',
  'D9D2E9': 'magenta', '9900FF': 'darkMagenta',
  '999999': 'darkGray', 'CCCCCC': 'lightGray', 'D9D9D9': 'lightGray',
  'F4CCCC': 'red', 'FCE5CD': 'darkYellow', 'FFF2CC': 'yellow',
  'D9EAD3': 'green', 'D0E0E3': 'cyan',
};
function fillToHighlightName(hex) {
  const h = (hex || '').toUpperCase().replace('#', '');
  if (h.length !== 6) return 'yellow';
  // Check exact Google Docs palette first
  if (GDOCS_PALETTE[h]) return GDOCS_PALETTE[h];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Whitish / near-black / auto — not a real highlight
  if (r > 230 && g > 230 && b > 230) return null;
  if (r < 30 && g < 30 && b < 30) return null;
  // Yellow family
  if (r > 200 && g > 200 && b < 120) return 'yellow';
  if (r > 180 && g > 180 && b < 80) return 'darkYellow';
  // Green family
  if (g > 150 && r < 150 && b < 150) return 'green';
  if (g > 100 && r < 100 && b < 100) return 'darkGreen';
  // Cyan family
  if (b > 150 && g > 150 && r < 150) return 'cyan';
  if (b > 100 && g > 100 && r < 100) return 'darkCyan';
  // Red family
  if (r > 200 && g < 100 && b < 100) return 'red';
  if (r > 120 && g < 80 && b < 80) return 'darkRed';
  // Blue family
  if (b > 180 && r < 120 && g < 150) return 'blue';
  if (b > 120 && r < 80 && g < 80) return 'darkBlue';
  // Magenta/pink family
  if (r > 150 && b > 150 && g < 120) return 'magenta';
  if (r > 200 && b > 150 && g > 100) return 'pink';
  // Gray family
  if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && r > 150) return 'lightGray';
  if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30) return 'darkGray';
  return 'yellow'; // default fallback
}

const SLOT_NAMES = ['yellow','green','cyan','magenta','pink','blue','red','darkBlue','darkCyan','darkGreen','darkMagenta','darkRed','darkYellow','lightGray','darkGray'];

// Pre-process a DOCX to convert w:shd (shading/background) to w:highlight
// elements so mammoth's standard style map picks them up.
// Each unique fill hex gets its own named-color slot so colors stay distinct.
export async function convertShadingToHighlight(arrayBuffer) {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return { buffer: arrayBuffer, shdCount: 0, debug: 'No word/document.xml found', hexMap: {} };
    let docXml = await docXmlFile.async('string');

    let shdCount = 0;
    const debugParts = [];

    const existingHighlights = (docXml.match(/<w:highlight\b/g) || []).length;
    debugParts.push(`existing=${existingHighlights}`);

    // Collect all unique fill hex colors from w:shd elements
    const allShd = docXml.match(/<w:shd\b[^>]*>/g) || [];
    debugParts.push(`w:shd_total=${allShd.length}`);
    const fillSet = new Set();
    allShd.forEach(s => { const m = s.match(/w:fill\s*=\s*"([^"]+)"/); if (m) fillSet.add(m[1].toUpperCase()); });
    debugParts.push(`fills=[${[...fillSet].slice(0, 10).join(',')}]`);

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
    // First pass: use natural color mapping where the slot is free
    for (const hex of validFills) {
      const natural = fillToHighlightName(hex);
      if (natural && !usedSlots.has(natural)) {
        hexToSlot.set(hex, natural);
        usedSlots.add(natural);
      }
    }
    // Second pass: assign remaining hexes to any free slot
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

    // Reverse map: slotName → originalHex (for post-processing HTML)
    const hexMap = {};
    for (const [hex, slot] of hexToSlot) hexMap[slot] = hex;
    debugParts.push(`slots=${JSON.stringify(hexMap)}`);

    function getSlot(fill) {
      const h = (fill || '').toUpperCase().replace('#', '');
      return hexToSlot.get(h) || fillToHighlightName(fill) || 'yellow';
    }

    // ── Strategy 1: Run-level (w:rPr) shading → w:highlight ──
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

    const debug = debugParts.join(' | ') + ` | converted=${shdCount}`;
    if (shdCount === 0) return { buffer: arrayBuffer, shdCount: 0, debug, hexMap };

    zip.file('word/document.xml', docXml);
    const newBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    return { buffer: newBuffer, shdCount, debug, hexMap };
  } catch (err) {
    console.warn('Shading-to-highlight conversion failed, using original:', err);
    return { buffer: arrayBuffer, shdCount: 0, debug: 'Error: ' + err.message, hexMap: {} };
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

export function countWordsInHtml(html) {
  const text = String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ');
  const words = text.match(/[A-Za-z0-9']+/g);
  return words ? words.length : 0;
}

export function parseStructure(html, chapterTag) {
  const subTag = chapterTag === 'h1' ? 'h2' : chapterTag === 'h2' ? 'h3' : null;
  const div = document.createElement('div');
  div.innerHTML = html;
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

  const result = [];
  let groupNum = 0;

  for (const raw of rawChapters) {
    groupNum++;
    const fullHtml = raw.nodes.map(n => n.outerHTML || n.textContent || '').join('');
    const fullWordCount = countWordsInHtml(fullHtml);

    // Try to split on sub-headings within this chapter
    let parts = [];
    if (subTag) {
      let curPart = null;
      for (const node of raw.nodes) {
        if (node.nodeName?.toLowerCase() === subTag) {
          if (curPart) parts.push(curPart);
          curPart = { subTitle: node.textContent.trim(), nodes: [] };
        } else {
          if (!curPart) {
            curPart = { subTitle: null, nodes: [node] };
          } else {
            curPart.nodes.push(node);
          }
        }
      }
      if (curPart) parts.push(curPart);
      // Merge preamble (content before first sub-heading) into first titled part
      if (parts.length > 1 && !parts[0].subTitle) {
        parts[1].nodes = [...parts[0].nodes, ...parts[1].nodes];
        parts.shift();
      }
      // Only consider it a real split if 2+ parts with sub-titles
      const titledParts = parts.filter(p => p.subTitle);
      if (titledParts.length < 2) parts = [];
    }

    if (parts.length >= 2) {
      // Split chapter: create one entry per sub-part
      parts.forEach((part, pi) => {
        const partHtml = part.nodes.map(n => n.outerHTML || n.textContent || '').join('');
        result.push({
          id: uid(),
          title: part.subTitle ? `${raw.title} — ${part.subTitle}` : raw.title,
          html: partHtml,
          wordCount: countWordsInHtml(partHtml),
          audioFile: null, audioPath: null,
          whisperWords: null, whisperAlignment: null, whisperMatchQuality: null,
          transcribed: false,
          splitGroup: groupNum,
          splitIndex: pi,
          splitTotal: parts.length,
          parentTitle: raw.title,
          partTitle: part.subTitle || `Part ${String.fromCharCode(97 + pi)}`,
          combinedHtml: fullHtml,
          combinedWordCount: fullWordCount,
        });
      });
    } else {
      // Normal chapter (no sub-parts)
      result.push({
        id: uid(),
        title: raw.title,
        html: fullHtml,
        wordCount: fullWordCount,
        audioFile: null, audioPath: null,
        whisperWords: null, whisperAlignment: null, whisperMatchQuality: null,
        transcribed: false,
      });
    }
  }

  return result;
}

const inp = { width:'100%',border:'1px solid var(--border)',borderRadius:14,padding:'10px 14px',fontSize:'0.875rem',fontFamily:'inherit',background:'white',color:'var(--text)',outline:'none' };
const lbl = { display:'block',fontSize:'0.68rem',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text-muted)',marginBottom:5 };
const card = { background:'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, var(--accent-surface) 100%)',borderRadius:24,border:'1px solid var(--border)',padding:'1.5rem',marginBottom:'0.95rem',boxShadow:'0 14px 34px var(--accent-shadow)' };
function Badge({ n }) { return <div style={{ width:22,height:22,borderRadius:'50%',background:'var(--accent)',color:'white',fontSize:'0.68rem',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>{n}</div>; }

export default function PrebuildManuscriptUpload({ onSave, onBack }) {
  const [bookTitle, setBookTitle] = useState('');
  const [fileName, setFileName] = useState('');
  const [fullHtml, setFullHtml] = useState('');
  const [chapterLevel, setChapterLevel] = useState(1);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hlDiag, setHlDiag] = useState(null); // highlight diagnostics
  const [included, setIncluded] = useState({}); // { chapterId: boolean }
  const [editingIdx, setEditingIdx] = useState(-1);
  const [editValue, setEditValue] = useState('');

  const chapterTag = `h${chapterLevel}`;

  async function handleDocx(file) {
    setLoading(true);
    setHlDiag(null);
    try {
      const mammoth = (await import('mammoth')).default;
      const ab = await file.arrayBuffer();

      // Pre-process: convert w:shd (shading) to w:highlight in the DOCX XML
      // so mammoth picks up Google Docs highlights via its standard style map.
      const { buffer: processedAb, shdCount, debug, hexMap } = await convertShadingToHighlight(ab);

      const result = await mammoth.convertToHtml({ arrayBuffer: processedAb }, { styleMap: STYLE_MAP });
      const html = applyHexColors(result.value, hexMap);
      // Log mammoth warnings for debugging
      if (result.messages?.length) console.log('[Mammoth messages]', result.messages);

      // Count highlights in final HTML
      const testDiv = document.createElement('div');
      testDiv.innerHTML = html;
      const hlCount = testDiv.querySelectorAll('[class*="hl-"]').length;
      // Also check what hl classes mammoth generated
      const hlClasses = new Set();
      testDiv.querySelectorAll('[class*="hl-"]').forEach(el => {
        const m = el.className.match(/hl-\w+/);
        if (m) hlClasses.add(m[0]);
      });
      const hlClassStr = hlClasses.size ? [...hlClasses].join(',') : 'none';
      setHlDiag({ shdConverted: shdCount, htmlHighlights: hlCount, debug: (debug || '') + ` | html_hl=${hlCount} classes=${hlClassStr}` });

      setFullHtml(html);
      setFileName(file.name);
      if (!bookTitle) setBookTitle(file.name.replace(/\.docx$/i, ''));
      const parsed = parseStructure(html, chapterTag);
      setChapters(parsed);
      setIncluded(Object.fromEntries(parsed.map(c => [c.id, true])));
    } catch (e) { alert('Could not read file: ' + e.message); }
    setLoading(false);
  }

  function reparse() {
    if (!fullHtml) return;
    const parsed = parseStructure(fullHtml, chapterTag);
    setChapters(parsed);
    setIncluded(Object.fromEntries(parsed.map(c => [c.id, true])));
  }

  const totalWords = chapters.reduce((n, c) => n + c.wordCount, 0);
  const highlightCount = (() => {
    if (!fullHtml) return 0;
    const div = document.createElement('div');
    div.innerHTML = fullHtml;
    return div.querySelectorAll('[class*="hl-"]').length;
  })();

  const includedChapters = chapters.filter(c => included[c.id] !== false);

  function doSave() {
    if (!includedChapters.length) { alert('Select at least one chapter to import.'); return; }
    onSave({
      id: Date.now(),
      title: bookTitle || fileName || 'Untitled',
      fileName,
      fullHtml,
      chapterLevel,
      characterNames: {},
      exportOptions: {
        includeBook: true,
        bookLabel: bookTitle || fileName?.replace(/\.docx$/i, '') || 'Untitled',
        includeCharacter: true,
        includeContext: true,
        contextWordCount: 3,
        includeHighlight: true,
      },
      chapters: includedChapters,
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {onBack && <button onClick={onBack} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:'0.875rem',marginBottom:'1.5rem',padding:0 }}>← Back</button>}
        <h2 style={{ fontSize:'1.6rem',fontWeight:700,letterSpacing:'-0.02em',marginBottom:'0.25rem',color:'var(--text)' }}>New duet audio prep</h2>
        <p style={{ fontSize:'0.82rem',color:'var(--text-muted)',marginBottom:'1.5rem' }}>Upload the engineer manuscript and we will detect chapters and insertion highlights.</p>

        {/* Title */}
        <div style={card}>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:'0.875rem' }}><Badge n={1} /><span style={{ fontWeight:600,fontSize:'0.925rem' }}>Project title</span></div>
          <input type="text" value={bookTitle} onChange={e => setBookTitle(e.target.value)} placeholder="e.g. My Novel" style={inp} />
        </div>

        {/* Upload */}
        <div style={card}>
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:'0.875rem' }}>
            <Badge n={2} /><span style={{ fontWeight:600,fontSize:'0.925rem' }}>Manuscript</span>
          </div>
          <div style={{ marginBottom:'0.875rem' }}>
            <label style={lbl}>Which heading level marks chapters?</label>
            <div style={{ display:'flex',gap:6,alignItems:'center' }}>
              {[1,2,3].map(n => (
                <button key={n} onClick={() => { setChapterLevel(n); if (fullHtml) setTimeout(reparse, 0); }}
                  style={{ padding:'6px 16px',borderRadius:8,border:'1px solid var(--border)',background:chapterLevel===n?'var(--accent)':'white',color:chapterLevel===n?'white':'var(--text)',cursor:'pointer',fontWeight:chapterLevel===n?600:400,fontSize:'0.875rem' }}>H{n}</button>
              ))}
            </div>
          </div>
          {!fullHtml ? (
            <label style={{ display:'flex',flexDirection:'column',alignItems:'center',border:'1.5px dashed var(--border)',borderRadius:12,padding:'2rem',cursor:'pointer',background:'var(--cream)',transition:'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background='var(--accent-light)'}
              onMouseLeave={e => e.currentTarget.style.background='var(--cream)'}>
              <input type="file" accept=".docx" style={{ display:'none' }} onChange={e => e.target.files[0] && handleDocx(e.target.files[0])} />
              {loading
                ? <><div style={{ fontSize:24,marginBottom:8 }}>⏳</div><p style={{ color:'var(--text-muted)',fontSize:'0.875rem' }}>Scanning manuscript…</p></>
                : <><div style={{ fontSize:28,marginBottom:10 }}>📄</div>
                  <p style={{ fontWeight:600,fontSize:'0.875rem',color:'var(--text)',marginBottom:4 }}>Upload full manuscript .docx</p>
                  <p style={{ fontSize:'0.75rem',color:'var(--text-muted)' }}>We'll detect chapters and any highlighted text</p></>}
            </label>
          ) : (
            <div>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',background:'var(--success-light)',borderRadius:10,border:'1px solid #c6e4cd' }}>
                <span style={{ fontSize:'0.875rem',color:'var(--success)',fontWeight:500 }}>✓ {fileName} · {chapters.length} chapters{chapters.some(c => c.splitGroup) ? ` (${new Set(chapters.filter(c=>c.splitGroup).map(c=>c.splitGroup)).size} split)` : ''} · {totalWords.toLocaleString()} words · {highlightCount} highlights</span>
                <label style={{ fontSize:'0.75rem',color:'var(--text-muted)',cursor:'pointer',textDecoration:'underline' }}>Re-upload<input type="file" accept=".docx" style={{ display:'none' }} onChange={e => e.target.files[0] && handleDocx(e.target.files[0])} /></label>
              </div>
              {hlDiag && (
                <div style={{ marginTop:6,padding:'8px 14px',background:'var(--cream)',borderRadius:8,fontSize:'0.72rem',color:'var(--text-muted)' }}>
                  Highlights: {hlDiag.htmlHighlights} found · {hlDiag.shdConverted} converted from shading
                  {hlDiag.debug && <div style={{ marginTop:2,fontFamily:'monospace',fontSize:'0.65rem',wordBreak:'break-all' }}>{hlDiag.debug}</div>}
                  {hlDiag.htmlHighlights === 0 && hlDiag.shdConverted === 0 && (
                    <span style={{ color:'var(--warning)',display:'block',marginTop:4 }}>
                      No highlights found. Try highlighting text in Google Docs, then re-downloading as .docx.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chapter preview — select, edit, remove */}
        {chapters.length > 0 && (
          <div style={card}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.875rem' }}>
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <Badge n={3} /><span style={{ fontWeight:600,fontSize:'0.925rem' }}>Chapters detected</span>
                <span style={{ fontSize:'0.72rem',color:'var(--text-muted)' }}>{includedChapters.length} of {chapters.length} selected</span>
              </div>
              <div style={{ display:'flex',gap:6 }}>
                <button onClick={() => setIncluded(Object.fromEntries(chapters.map(c => [c.id, true])))}
                  style={{ fontSize:'0.72rem',color:'var(--accent)',background:'none',border:'none',cursor:'pointer',textDecoration:'underline' }}>All</button>
                <button onClick={() => setIncluded(Object.fromEntries(chapters.map(c => [c.id, false])))}
                  style={{ fontSize:'0.72rem',color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',textDecoration:'underline' }}>None</button>
              </div>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 10 }}>
              {chapters.map((ch, i) => {
                const isIncluded = included[ch.id] !== false;
                const isEditing = editingIdx === i;
                const isGroupStart = ch.splitGroup && ch.splitIndex === 0;
                const isInGroup = !!ch.splitGroup;
                // Compute display number: chapters in same splitGroup share a number
                let displayNum = '';
                {
                  let num = 0;
                  const seen = new Set();
                  for (let j = 0; j <= i; j++) {
                    const key = chapters[j].splitGroup;
                    if (key != null) { if (!seen.has(key)) { seen.add(key); num++; } }
                    else num++;
                  }
                  displayNum = ch.splitGroup != null ? `${num}${String.fromCharCode(97 + ch.splitIndex)}` : `${num}`;
                }
                return (
                  <React.Fragment key={ch.id}>
                    {isGroupStart && (
                      <div style={{ padding:'6px 12px',background:'var(--accent-light)',borderBottom:'1px solid var(--border-light)',fontSize:'0.72rem',fontWeight:600,color:'var(--accent-dark)',display:'flex',alignItems:'center',gap:6 }}>
                        <span>📂 {ch.parentTitle}</span>
                        <span style={{ fontWeight:400,color:'var(--text-muted)' }}>({ch.splitTotal} parts detected)</span>
                      </div>
                    )}
                    <div style={{ display:'flex',alignItems:'center',padding:'8px 12px',paddingLeft: isInGroup ? 28 : 12,borderBottom:'1px solid var(--border-light)',gap:8,opacity: isIncluded ? 1 : 0.4 }}>
                      <input type="checkbox" checked={isIncluded}
                        onChange={() => setIncluded(prev => ({ ...prev, [ch.id]: !isIncluded }))}
                        style={{ accentColor:'var(--accent)',flexShrink:0 }} />
                      <span style={{ fontSize:'0.72rem',fontFamily:'monospace',color:'var(--text-light)',minWidth:24 }}>{displayNum}</span>
                    {isEditing ? (
                      <input value={editValue} onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { const t = editValue.trim(); if (t) { setChapters(prev => prev.map((c, ci) => ci === i ? { ...c, title: t } : c)); } setEditingIdx(-1); }
                          if (e.key === 'Escape') setEditingIdx(-1);
                        }}
                        autoFocus style={{ ...inp, flex:1,padding:'4px 8px',fontSize:'0.82rem' }} />
                    ) : (
                      <span style={{ fontWeight:500,fontSize:'0.875rem',color:'var(--text)',flex:1,cursor:'pointer' }}
                        onDoubleClick={() => { setEditingIdx(i); setEditValue(ch.title); }}>
                        {ch.title}
                      </span>
                    )}
                    <span style={{ fontSize:'0.72rem',color:'var(--text-muted)',whiteSpace:'nowrap' }}>{ch.wordCount.toLocaleString()} words</span>
                    {isEditing ? (
                      <div style={{ display:'flex',gap:4 }}>
                        <button onClick={() => { const t = editValue.trim(); if (t) { setChapters(prev => prev.map((c, ci) => ci === i ? { ...c, title: t } : c)); } setEditingIdx(-1); }}
                          style={{ fontSize:'0.68rem',color:'var(--accent)',background:'none',border:'none',cursor:'pointer' }}>✓</button>
                        <button onClick={() => setEditingIdx(-1)}
                          style={{ fontSize:'0.68rem',color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingIdx(i); setEditValue(ch.title); }}
                        style={{ fontSize:'0.68rem',color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',padding:2 }} title="Edit title">✏️</button>
                    )}
                  </div>
                  </React.Fragment>
                );
              })}
            </div>
            <p style={{ fontSize:'0.68rem',color:'var(--text-muted)',marginTop:8 }}>Uncheck chapters to exclude them. Double-click a title to edit it.</p>
          </div>
        )}

        {/* Save */}
        {chapters.length > 0 && (
          <button onClick={doSave} disabled={!includedChapters.length} style={{ width:'100%',padding:'14px',borderRadius:12,border:'none',background: includedChapters.length ? 'var(--accent)' : 'var(--border)',color:'white',fontWeight:600,fontSize:'0.95rem',cursor: includedChapters.length ? 'pointer' : 'default',marginTop:8,opacity: includedChapters.length ? 1 : 0.5 }}>
            Create project ({includedChapters.length} chapters)
          </button>
        )}
      </div>
    </div>
  );
}
