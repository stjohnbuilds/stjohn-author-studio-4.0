'use client';

// Shared upload + chapter-picker for every mode that imports a manuscript.
// Replaces the per-mode rewrites that used to live in PrepManuscriptMode's
// SetupView and PrebuildManuscriptUpload. Proof's BookSetup still has its
// own (it adds PDF paging + narrator colour mapping on top); this file is
// the "core" both Prep and Duet share, with the same look as BookSetup so
// Proof can migrate later without changing how things feel.
//
// Returns to its caller via onConfirm:
//   {
//     title, fileName,
//     sourceDocxBytes (Uint8Array), sourceDocxBase64 (string),
//     fullHtml,
//     chapters: [
//       { id, chapterIndex, chapterNumber, title, html, wordCount,
//         included, isFirst,
//         splitGroup?, splitIndex?, splitTotal?, parentTitle? }
//     ],
//   }

import React, { useMemo, useState } from 'react';
import {
  STYLE_MAP,
  convertShadingToHighlight,
  applyHexColors,
} from './ManuscriptSetup.js';

const inp = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  background: 'white',
  color: 'var(--text)',
  outline: 'none',
};
const lbl = {
  display: 'block',
  fontSize: '0.68rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: 5,
};
const card = {
  background: 'white',
  borderRadius: 16,
  border: '1px solid var(--border)',
  padding: '1.15rem',
  marginBottom: '0.75rem',
};

function Badge({ n, accent }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      background: accent || 'var(--accent)', color: 'white',
      fontSize: '0.68rem', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>{n}</div>
  );
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function stripTags(s = '') {
  return String(s).replace(/<[^>]*>/g, '');
}
function countWords(text = '') {
  const m = String(text).match(/[A-Za-z0-9']+/g);
  return m ? m.length : 0;
}

// Given a chapter's HTML, return its sub-headings (h{N+1}) as a flat list
// of editable sub-sections. Each sub-section gets the chunk of HTML from
// its heading until the next sub-heading. Content BEFORE the first
// sub-heading becomes an unnamed "intro" entry so it can be unchecked
// independently (front-matter inside a chapter, for example).
function extractSubSections(chapterHtml, chapterLevel) {
  const subTag = chapterLevel < 6 ? `h${chapterLevel + 1}` : null;
  if (!subTag || !chapterHtml) return [];
  const host = document.createElement('div');
  host.innerHTML = chapterHtml;
  const out = [];
  let cur = { title: '', nodes: [] };
  Array.from(host.childNodes).forEach((node) => {
    const tag = node.nodeName ? node.nodeName.toLowerCase() : '';
    if (tag === subTag) {
      if (cur.nodes.length || cur.title) out.push(cur);
      cur = { title: (node.textContent || '').trim() || 'Untitled section', nodes: [node.cloneNode(true)] };
    } else {
      cur.nodes.push(node.cloneNode(true));
    }
  });
  if (cur.nodes.length || cur.title) out.push(cur);
  // Return sub-sections if the chapter has at least one titled sub-heading.
  // Previously this required >= 2 sub-headings, which silently hid the
  // "Show sub-headings" toggle's effect for any chapter with a single
  // scene break — exactly the "clicking it doesn't do shit" Marie hit.
  if (out.filter((s) => s.title).length < 1) return [];
  return out.map((s, i) => ({
    id: uid(),
    title: s.title || '(intro)',
    html: s.nodes.map((n) => n.outerHTML || n.textContent || '').join(''),
    wordCount: countWords(stripTags(s.nodes.map((n) => n.outerHTML || n.textContent || '').join(''))),
    included: true,
  }));
}

// Walk the full HTML, group child nodes under their chapter heading
// (h{level}). If splitOnSubheadings is true and a chapter has the
// next level of headings (h{level+1}), each sub-heading becomes its
// own row (with splitGroup metadata so the UI can group them).
//
// Exported so modes like Duet can reuse the same chapter-shape when
// they re-parse on manuscript re-upload, instead of carrying their
// own duplicate parser.
export function parseChaptersFromHtml(html, chapterLevel, splitOnSubheadings) {
  const chapterTag = `h${chapterLevel}`;
  const subTag = splitOnSubheadings && chapterLevel < 6 ? `h${chapterLevel + 1}` : null;
  const host = document.createElement('div');
  host.innerHTML = html;

  const raw = [];
  let cur = null;
  Array.from(host.childNodes).forEach((node) => {
    const tag = node.nodeName ? node.nodeName.toLowerCase() : '';
    if (tag === chapterTag) {
      if (cur) raw.push(cur);
      cur = { title: (node.textContent || '').trim() || 'Untitled chapter', nodes: [] };
    } else {
      if (!cur) cur = { title: '(Before first chapter)', nodes: [] };
      cur.nodes.push(node.cloneNode(true));
    }
  });
  if (cur) raw.push(cur);

  if (!raw.length) {
    // No chapter headings detected — treat the whole document as one row.
    return [{
      id: uid(), title: 'Manuscript',
      html, wordCount: countWords(stripTags(html)),
      included: true, isFirst: true,
    }];
  }

  const out = [];
  let groupNum = 0;
  for (const c of raw) {
    groupNum += 1;
    const fullHtml = c.nodes.map((n) => n.outerHTML || n.textContent || '').join('');
    const fullWordCount = countWords(stripTags(fullHtml));

    if (subTag) {
      // Split by sub-headings inside this chapter.
      const parts = [];
      let curPart = null;
      for (const node of c.nodes) {
        if (node.nodeName && node.nodeName.toLowerCase() === subTag) {
          if (curPart) parts.push(curPart);
          curPart = { subTitle: (node.textContent || '').trim(), nodes: [] };
        } else {
          if (!curPart) curPart = { subTitle: null, nodes: [node] };
          else curPart.nodes.push(node);
        }
      }
      if (curPart) parts.push(curPart);
      // Merge any preamble (content before the first sub-heading) into the
      // first titled part so it isn't dropped.
      if (parts.length > 1 && !parts[0].subTitle) {
        parts[1].nodes = [...parts[0].nodes, ...parts[1].nodes];
        parts.shift();
      }
      const titledParts = parts.filter((p) => p.subTitle);
      if (titledParts.length >= 2) {
        parts.forEach((part, pi) => {
          const partHtml = part.nodes.map((n) => n.outerHTML || n.textContent || '').join('');
          out.push({
            id: uid(),
            title: part.subTitle ? `${c.title} — ${part.subTitle}` : c.title,
            html: partHtml,
            wordCount: countWords(stripTags(partHtml)),
            included: true,
            isFirst: false,
            splitGroup: groupNum,
            splitIndex: pi,
            splitTotal: parts.length,
            parentTitle: c.title,
          });
        });
        continue;
      }
    }

    out.push({
      id: uid(),
      title: c.title,
      html: fullHtml,
      wordCount: fullWordCount,
      included: true,
      isFirst: out.length === 0,
      // Sub-sections are pre-computed so the "Show sub-headings" toggle
      // can expand/collapse them instantly. If a chapter has fewer than
      // two h{N+1} headings, subSections is an empty array.
      subSections: extractSubSections(fullHtml, chapterLevel),
    });
  }

  // Mark the first chapter as "first" by default; the user can override.
  if (out.length > 0 && !out.some((ch) => ch.isFirst)) out[0].isFirst = true;
  return out;
}

// Browser-safe bytes → base64 (chunked so >1MB files don't blow the stack).
function bytesToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

export default function ImportFlow({
  onConfirm,
  onCancel,
  // visual:
  accent,                       // e.g. PREP_INK or DUET_INK — used for badges + primary buttons
  heading = 'Import a manuscript',
  blurb = 'Upload the .docx, check the chapters you want to include, and continue.',
  submitLabel = 'Save & continue',
  // behaviour:
  allowSceneSplitting = false,  // expose the H1+H2 split toggle
  defaultSplitScenes = false,
  defaultChapterLevel = 1,
  initialTitle = '',
}) {
  const [bookTitle, setBookTitle] = useState(initialTitle);
  const [fileName, setFileName] = useState('');
  const [fullHtml, setFullHtml] = useState('');
  const [bytes, setBytes] = useState(null);            // Uint8Array of the .docx
  const [base64, setBase64] = useState('');            // base64 of the .docx
  const [chapterLevel, setChapterLevel] = useState(defaultChapterLevel);
  const [splitScenes, setSplitScenes] = useState(defaultSplitScenes);
  const [chapters, setChapters] = useState([]);        // parsed chapter list (with `included`)
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  // When true, the chapter list expands each chapter to show its
  // sub-headings as nested checkable rows. Marie can uncheck individual
  // sub-sections (front-matter inside a chapter, alternate-POV scenes
  // she doesn't want to tag, etc.) and the chapter's HTML is rebuilt
  // on commit from only the included sub-sections.
  const [showSubs, setShowSubs] = useState(false);
  // Marie 2026-05-26: page-scan status during commit. The docx→PDF
  // conversion takes ~10-30s for a long book and we want the user to see
  // what's happening, not stare at a frozen "Save" button.
  const [pageScanStatus, setPageScanStatus] = useState('');
  const [scanning, setScanning] = useState(false);
  // Marie 2026-05-26: optional user-supplied PDF. When provided, the app
  // uses THIS as the page-number source instead of LibreOffice's render
  // (LibreOffice can drift ±1-2 pages vs the user's actual reader).
  // Same docx import flow, just with a more accurate page anchor.
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null);
  // Pre-scanned PDF paging (when user has uploaded a PDF) + the editable
  // page-number adjustment with the auto-detected default. We pre-scan
  // user PDFs immediately on upload so the user can see + adjust the
  // suggested shift BEFORE clicking Save. For the docx-only LibreOffice
  // path the scan runs on commit (too slow to block on upload).
  const [preScannedPdfPaging, setPreScannedPdfPaging] = useState(null);
  const [currentAdjustment, setCurrentAdjustment] = useState(0);
  const [hasScanned, setHasScanned] = useState(false);

  const accentColor = accent || 'var(--accent)';
  const primaryBtn = {
    padding: '11px 18px',
    background: accentColor, color: 'white',
    border: 'none', borderRadius: 12,
    fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
  };
  const ghostBtn = {
    padding: '11px 18px',
    background: 'white', color: 'var(--text-muted)',
    border: '1px solid var(--border)', borderRadius: 12,
    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
  };

  function reparse(htmlNow, levelNow, splitNow) {
    if (!htmlNow) return;
    setChapters(parseChaptersFromHtml(htmlNow, levelNow, splitNow));
  }

  // Marie 2026-05-26: optional PDF path. User downloads the PDF from
  // the same Google Doc and uploads it here for exact page numbers.
  // We pre-scan immediately so the suggested adjustment is visible
  // before they click Save.
  async function handlePdfFile(file) {
    if (!file) {
      setPdfFile(null);
      setPdfBytes(null);
      setPreScannedPdfPaging(null);
      setHasScanned(false);
      setCurrentAdjustment(0);
      return;
    }
    setErr('');
    try {
      const ab = await file.arrayBuffer();
      const bytes = new Uint8Array(ab);
      setPdfFile(file);
      setPdfBytes(bytes);
      if (typeof window !== 'undefined' && window.electron?.extractPdfPaging) {
        setScanning(true);
        setPageScanStatus('Reading page numbers from your PDF…');
        try {
          const extracted = await window.electron.extractPdfPaging({
            fileName: file.name,
            data: bytes,
            pageOffset: 0,
          });
          if (extracted?.pages?.length) {
            setPreScannedPdfPaging(extracted);
            setCurrentAdjustment(Number(extracted.suggestedAdjustment) || 0);
            setHasScanned(true);
            const adj = Number(extracted.suggestedAdjustment) || 0;
            const beforeMsg = extracted.unnumberedBeforeFirstOne
              ? ` We saw ${extracted.unnumberedBeforeFirstOne} unnumbered page${extracted.unnumberedBeforeFirstOne === 1 ? '' : 's'} before footer "1" — shifted by ${adj} so footer "1" lines up with page 1.`
              : '';
            setPageScanStatus(`Page numbers read from your PDF — ${extracted.printedPageCount || 0} of ${extracted.pageCount || 0} numbered.${beforeMsg}`);
          }
        } finally {
          setScanning(false);
        }
      }
    } catch (e) {
      console.error('PDF read failed:', e);
      setErr(e?.message || 'Could not read that PDF.');
      setScanning(false);
    }
  }

  async function handleDocx(file) {
    setLoading(true);
    setErr('');
    try {
      const mammoth = (await import('mammoth')).default;
      const ab = await file.arrayBuffer();
      const u8 = new Uint8Array(ab);
      // Convert Google-Docs-style shading to Word highlights so colours
      // we want to see in the reader actually show up.
      const { buffer: processedAb, hexMap } = await convertShadingToHighlight(ab);
      const result = await mammoth.convertToHtml({ arrayBuffer: processedAb }, { styleMap: STYLE_MAP });
      const html = applyHexColors(result.value || '', hexMap || {});
      setFullHtml(html);
      setBytes(u8);
      setBase64(bytesToBase64(u8));
      setFileName(file.name);
      if (!bookTitle) setBookTitle(file.name.replace(/\.docx$/i, ''));
      setChapters(parseChaptersFromHtml(html, chapterLevel, splitScenes));
    } catch (e) {
      console.error('ImportFlow handleDocx failed:', e);
      setErr(e?.message || 'Could not read that .docx.');
    }
    setLoading(false);
  }

  function toggleIncluded(id) {
    setChapters((cs) => cs.map((c) => (c.id === id ? { ...c, included: !c.included } : c)));
  }
  function setAllIncluded(on) {
    setChapters((cs) => cs.map((c) => ({ ...c, included: !!on })));
  }
  function toggleFirst(id) {
    setChapters((cs) => cs.map((c) => ({ ...c, isFirst: c.id === id ? !c.isFirst : c.isFirst })));
  }
  function toggleSubIncluded(chapterId, subId) {
    setChapters((cs) => cs.map((c) => {
      if (c.id !== chapterId) return c;
      return {
        ...c,
        subSections: (c.subSections || []).map((s) => (s.id === subId ? { ...s, included: !s.included } : s)),
      };
    }));
  }

  const totalSelected = chapters.filter((c) => c.included).length;
  const allOn = chapters.length > 0 && chapters.every((c) => c.included);
  const anyOn = chapters.some((c) => c.included);

  async function commit() {
    if (!fullHtml || totalSelected === 0) return;
    // Re-number from "first" toggles so the user can keep front matter
    // out of the chapter count. The first chapter (by document order)
    // gets number 1 unless the user has explicitly set a different one
    // as "first" — then everything before that is left unnumbered.
    let chapterNumber = 0;
    const numbered = chapters
      .filter((c) => c.included)
      .map((c, i, arr) => {
        if (i === 0 || c.isFirst) chapterNumber = 1;
        else chapterNumber += 1;
        // If the user is reviewing sub-headings and excluded any, rebuild
        // the chapter's html from only the included sub-sections.
        let html = c.html;
        if (showSubs && (c.subSections || []).length > 0) {
          html = c.subSections.filter((s) => s.included).map((s) => s.html).join('');
        }
        return {
          ...c,
          html,
          chapterIndex: i,
          chapterNumber,
        };
      });

    // Marie 2026-05-26: page-number source priority —
    //   1. User-supplied PDF (exact match to their reader)
    //   2. LibreOffice auto-convert of the docx (close, ±1-2 pages)
    //   3. None (yellow warning banner on book detail)
    let pdfPaging = null;
    let pdfFileName = '';
    let pdfSource = null;
    // Auto-detected page nudge: when the PDF puts "Chapter 1" on
    // printed page 2 (because front matter like an Epigraph counted),
    // we shift everything by -1 so Chapter 1 lands on page 1 — matching
    // what the user expects.
    let pageNumberAdjustment = 0;

    // If the user uploaded a PDF earlier, we already pre-scanned it on
    // upload (so they could see + tweak the adjustment). Reuse that here.
    if (preScannedPdfPaging) {
      pdfPaging = preScannedPdfPaging;
      pdfFileName = pdfFile?.name || 'manuscript.pdf';
      pdfSource = 'user-pdf';
      pageNumberAdjustment = Number(currentAdjustment) || 0;
    }

    if (!pdfPaging && bytes && typeof window !== 'undefined' && window.electron?.convertDocxToPageMap) {
      setScanning(true);
      try {
        setPageScanStatus('Scanning page numbers — this can take 10-30 seconds for long books…');
        const converted = await window.electron.convertDocxToPageMap({
          name: fileName || 'manuscript.docx',
          data: bytes,
          pageOffset: 0,
        });
        if (converted?.pdfPaging) {
          pdfPaging = converted.pdfPaging;
          pdfFileName = converted.fileName || (fileName || '').replace(/\.docx$/i, '.pdf');
          pdfSource = 'libreoffice';
          // Use the editable adjustment if the user already tweaked it,
          // otherwise default to the auto-detected value.
          const auto = Number(pdfPaging.suggestedAdjustment) || 0;
          pageNumberAdjustment = hasScanned ? Number(currentAdjustment) || 0 : auto;
          if (!hasScanned) setCurrentAdjustment(auto);
          setPageScanStatus(`Page numbers scanned via LibreOffice (${pdfPaging.printedPageCount || 0} of ${pdfPaging.pageCount || 0} pages numbered). May drift ±1-2 pages.`);
        } else {
          setPageScanStatus('Page scan did not return a map. Importing without page numbers — you can rescan from book detail.');
        }
      } catch (e) {
        console.warn('ImportFlow page scan failed:', e);
        setPageScanStatus(`Page scan failed: ${e?.message || 'unknown error'}. Importing anyway — install LibreOffice to enable auto page numbers.`);
      } finally {
        setScanning(false);
      }
    }

    onConfirm({
      title: (bookTitle || fileName.replace(/\.docx$/i, '') || 'Untitled').trim(),
      fileName,
      sourceDocxBytes: bytes,
      sourceDocxBase64: base64,
      fullHtml,
      chapters: numbered,
      splitScenes,
      chapterLevel,
      // The PDF page map (if scanning succeeded) — every consumer can
      // store this on the project so page numbers work in flags + exports.
      pdfPaging,
      pdfFileName,
      pdfSource, // 'user-pdf' | 'libreoffice' | null
      pageNumberAdjustment, // auto-set so Chapter 1 = page 1; user can override in Edit book data
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '1.5rem 1.25rem 3.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: '0.25rem' }}>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>{heading}</h2>
          {onCancel && (
            <button type="button" onClick={onCancel} style={ghostBtn}>Cancel</button>
          )}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1.2rem' }}>{blurb}</p>

        {/* Step 1: Title */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
            <Badge n={1} accent={accentColor} /><span style={{ fontWeight: 600, fontSize: '0.925rem' }}>Project name</span>
          </div>
          <input
            type="text"
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            placeholder="e.g. The Lincoln Pack"
            style={inp}
          />
        </div>

        {/* Step 2: Upload + heading-level choice */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
            <Badge n={2} accent={accentColor} /><span style={{ fontWeight: 600, fontSize: '0.925rem' }}>Manuscript file</span>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={lbl}>Which heading level marks chapter starts?</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" onClick={() => {
                  setChapterLevel(n);
                  if (fullHtml) setTimeout(() => reparse(fullHtml, n, splitScenes), 0);
                }} style={{
                  padding: '6px 16px', borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: chapterLevel === n ? accentColor : 'white',
                  color: chapterLevel === n ? 'white' : 'var(--text)',
                  cursor: 'pointer', fontWeight: chapterLevel === n ? 700 : 500,
                  fontSize: '0.875rem',
                }}>H{n}</button>
              ))}
            </div>
            {/* Marie 2026-05-26: a quiet hint, not a deletion. Most users
                never need to change this — the default is right for most
                manuscripts. Only nudge it if the chapter list below looks
                wrong. */}
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
              Leave this on H1 unless the chapter list below looks wrong — only change it if your manuscript uses a different heading style for chapter titles.
            </div>
          </div>

          {allowSceneSplitting && (
            <div style={{ marginBottom: '0.75rem', padding: '10px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={lbl}>Split chapters on sub-headings</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {splitScenes ? `Each chapter will be split by H${Math.min(chapterLevel + 1, 6)} sub-headings.` : 'Each chapter stays as one row.'}
                  </div>
                </div>
                <button type="button" onClick={() => {
                  const next = !splitScenes;
                  setSplitScenes(next);
                  if (fullHtml) setTimeout(() => reparse(fullHtml, chapterLevel, next), 0);
                }} style={{
                  padding: '7px 14px', borderRadius: 999,
                  border: '1px solid ' + (splitScenes ? accentColor : 'var(--border)'),
                  background: splitScenes ? 'rgba(0,0,0,0.04)' : 'white',
                  color: splitScenes ? accentColor : 'var(--text)',
                  fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
                }}>{splitScenes ? 'Split scenes on' : 'Split scenes off'}</button>
              </div>
            </div>
          )}

          {!fullHtml ? (
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              border: '1.5px dashed var(--border)', borderRadius: 12,
              padding: '2rem', cursor: 'pointer', background: 'var(--cream)',
            }}>
              <input type="file" accept=".docx" style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleDocx(e.target.files[0])} />
              {loading ? (
                <>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Reading your manuscript…</p>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)', marginBottom: 0 }}>Upload manuscript .docx</p>
                </>
              )}
            </label>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'var(--success-light)', borderRadius: 10,
              border: '1px solid #d3ddd6',
            }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: 500 }}>
                ✓ {fileName} · {chapters.length} chapter{chapters.length === 1 ? '' : 's'} detected
              </span>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}>
                Re-upload
                <input type="file" accept=".docx" style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleDocx(e.target.files[0])} />
              </label>
            </div>
          )}
          {err && (<div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--danger)' }}>{err}</div>)}

          {/* Marie 2026-05-26: optional PDF upload for exact page numbers.
              The default (LibreOffice auto-convert) drifts ±1-2 pages on
              long books because the rendering engines differ. If the user
              has the PDF downloaded from the same Google Doc, that PDF
              IS what their narrators read from, so it gives exact pages.
              Marie 2026-05-26 (refresh): the upload area now looks like
              a real upload panel — big icon, "Click to choose or drop"
              wording — instead of just an info row. */}
          {fullHtml && (
            <div style={{ marginTop: 12 }}>
              {pdfFile ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', background: '#eaf5ec', borderRadius: 12,
                  border: '1px solid #b9d6bf', gap: 10,
                }}>
                  <span style={{ flex: 1, fontSize: '0.82rem', color: '#3d7a4a', fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    ✓ {pdfFile.name} — page numbers will come from this PDF
                  </span>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                    Change
                    <input type="file" accept="application/pdf,.pdf" style={{ display: 'none' }}
                      onChange={(e) => e.target.files?.[0] && handlePdfFile(e.target.files[0])} />
                  </label>
                  <button type="button" onClick={() => { setPdfFile(null); setPdfBytes(null); }} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>Clear</button>
                </div>
              ) : (
                <label style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                  padding: '18px 16px', borderRadius: 14,
                  border: '2px dashed var(--accent-border)', background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.85) 100%)',
                  cursor: 'pointer', gap: 8,
                }}>
                  {/* Marie 2026-05-26: line-work upload icon, no emoji. */}
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-dark)' }}>
                    <path d="M12 16V4" />
                    <path d="M7 9l5-5 5 5" />
                    <path d="M5 18v2a1 1 0 001 1h12a1 1 0 001-1v-2" />
                  </svg>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)' }}>
                    Optional — click to upload the matching PDF
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', maxWidth: 460, lineHeight: 1.4 }}>
                    For exact page numbers, download the same Google Doc as PDF and add it here. Without it, page numbers come from a software conversion and may drift ±1-2 pages on long books.
                  </div>
                  <input type="file" accept="application/pdf,.pdf" style={{ display: 'none' }}
                    onChange={(e) => e.target.files?.[0] && handlePdfFile(e.target.files[0])} />
                </label>
              )}
              {/* Page-number nudge sits RIGHT under the PDF upload so it's
                  not buried below the chapter picker. Shown after a PDF
                  scan completes (auto-set to the suggested offset; user
                  can override here). */}
              {hasScanned && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 12, border: '1px solid var(--accent-border)', background: 'white' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                    Page-number shift {currentAdjustment !== 0 ? `(${currentAdjustment > 0 ? '+' : ''}${currentAdjustment})` : '(0 — no shift)'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => setCurrentAdjustment((n) => Math.max(-50, (Number(n) || 0) - 1))} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: 'white', color: 'var(--text)', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer' }}>−</button>
                    <input type="number" value={currentAdjustment} onChange={(e) => setCurrentAdjustment(Math.trunc(Number(e.target.value) || 0))} min={-50} max={50} style={{ width: 80, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 8px', fontSize: '0.95rem', color: 'var(--text)' }} />
                    <button type="button" onClick={() => setCurrentAdjustment((n) => Math.min(50, (Number(n) || 0) + 1))} style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)', background: 'white', color: 'var(--text)', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer' }}>+</button>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    The PDF&apos;s footer says &ldquo;1&rdquo; on its page <strong>{(preScannedPdfPaging?.firstOneAtPdfPage) || '?'}</strong>, with <strong>{(preScannedPdfPaging?.unnumberedBeforeFirstOne) || 0}</strong> unnumbered page{(preScannedPdfPaging?.unnumberedBeforeFirstOne) === 1 ? '' : 's'} before it. Change this only if your manuscript counts the first &ldquo;1&rdquo; differently from what the app picked.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Chapter picker */}
        {chapters.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <Badge n={3} accent={accentColor} /><span style={{ fontWeight: 600, fontSize: '0.925rem' }}>Chapters to include</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setShowSubs((v) => !v)} style={{
                  padding: '5px 10px', borderRadius: 999,
                  border: '1px solid ' + (showSubs ? accentColor : 'var(--border)'),
                  background: showSubs ? accentColor : 'white',
                  color: showSubs ? 'white' : 'var(--text-muted)',
                  fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                }}>{showSubs ? 'Hide sub-headings' : 'Show sub-headings'}</button>
                <button type="button" onClick={() => setAllIncluded(!allOn)} style={{
                  padding: '5px 10px', borderRadius: 999,
                  border: '1px solid var(--border)', background: 'white',
                  fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                }}>{allOn ? 'Uncheck all' : 'Check all'}</button>
              </div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 10 }}>
              Uncheck front matter, copyright pages, or anything else you don&apos;t want to work with.
              {chapters.length > 1 && ' Use "Set as first" if the real Chapter 1 is further down.'}
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 10 }}>
              {chapters.map((ch) => {
                const isGroupStart = ch.splitGroup != null && ch.splitIndex === 0;
                const subs = ch.subSections || [];
                return (
                  <React.Fragment key={ch.id}>
                    {isGroupStart && (
                      <div style={{
                        padding: '6px 12px', background: 'rgba(0,0,0,0.03)',
                        borderBottom: '1px solid var(--border-light)',
                        fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)',
                      }}>
                        📂 {ch.parentTitle} <span style={{ fontWeight: 400 }}>({ch.splitTotal} parts)</span>
                      </div>
                    )}
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px',
                      paddingLeft: ch.splitGroup != null ? 28 : 12,
                      borderBottom: '1px solid var(--border-light)',
                      background: ch.included ? 'white' : '#f6f3ef',
                      opacity: ch.included ? 1 : 0.55,
                      cursor: 'pointer',
                    }}>
                      <input type="checkbox" checked={ch.included} onChange={() => toggleIncluded(ch.id)} style={{ accentColor: accentColor }} />
                      <span style={{
                        flex: 1, minWidth: 0,
                        fontSize: '0.86rem', fontWeight: 600, color: 'var(--text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{ch.title}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {ch.wordCount.toLocaleString()} words
                      </span>
                      <button type="button" onClick={(e) => { e.preventDefault(); toggleFirst(ch.id); }} style={{
                        padding: '3px 8px', borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: ch.isFirst ? accentColor : 'white',
                        color: ch.isFirst ? 'white' : 'var(--text-muted)',
                        cursor: 'pointer', fontSize: '0.66rem', fontWeight: 700,
                      }}>{ch.isFirst ? 'First' : 'Set first'}</button>
                    </label>
                    {showSubs && subs.length > 0 && ch.included && subs.map((sub) => (
                      <label key={sub.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 12px',
                        paddingLeft: 40,
                        borderBottom: '1px solid var(--border-light)',
                        background: sub.included ? '#fbfaf6' : '#f1ede5',
                        opacity: sub.included ? 1 : 0.55,
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                      }}>
                        <input type="checkbox" checked={sub.included} onChange={() => toggleSubIncluded(ch.id, sub.id)} style={{ accentColor: accentColor }} />
                        <span style={{
                          flex: 1, minWidth: 0,
                          color: 'var(--text-muted)', fontWeight: 500,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>↳ {sub.title}</span>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                          {sub.wordCount.toLocaleString()} words
                        </span>
                      </label>
                    ))}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {chapters.length > 0 && (
          <>
            {pageScanStatus && (
              <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--accent-border)', background: '#f7f3ff', fontSize: '0.78rem', color: 'var(--text)' }}>
                {pageScanStatus}
              </div>
            )}
            <button type="button" onClick={commit} disabled={!anyOn || !bookTitle.trim() || scanning} style={{
              ...primaryBtn,
              width: '100%',
              opacity: (!anyOn || !bookTitle.trim() || scanning) ? 0.5 : 1,
              cursor: (!anyOn || !bookTitle.trim() || scanning) ? 'not-allowed' : 'pointer',
            }}>
              {scanning ? 'Scanning page numbers…' : `${submitLabel} (${totalSelected} chapter${totalSelected === 1 ? '' : 's'})`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
