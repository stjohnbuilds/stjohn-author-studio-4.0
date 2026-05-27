'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
// Shared upload + chapter picker. Same component every mode uses, so a
// fix to the chapter-checkbox list lands everywhere at once.
import ImportFlow, { parseChaptersFromHtml } from './ImportFlow';
import BookDetail from './BookDetail';
import ProofBookDetail from './SessionsView';
import {
  STYLE_MAP,
  convertShadingToHighlight,
  applyHexColors,
} from './ManuscriptSetup';

function parseChapters(html, chapterTag) {
  // Duet always splits chapters on sub-headings — that's how engineers
  // mark the multi-part rows the audio gets aligned against.
  const level = Math.max(1, Math.min(6, Number(String(chapterTag).replace(/[^0-9]/g, '')) || 1));
  return parseChaptersFromHtml(html, level, true);
}

const el = () => typeof window !== 'undefined' && window.electron;
const PREBUILD_STORAGE_KEY = 'ap-prebuild-projects';
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// Compute display number like "1", "2a", "2b", "3" based on splitGroup metadata
function getChapterDisplayNum(chapters, idx) {
  let num = 0;
  const seen = new Set();
  for (let i = 0; i <= idx; i++) {
    const key = chapters[i].splitGroup;
    if (key != null) {
      if (!seen.has(key)) { seen.add(key); num++; }
    } else {
      // Merged chapters (treatAsOne) or normal chapters
      num++;
    }
  }
  const ch = chapters[idx];
  if (ch.splitGroup != null) {
    return `${num}${String.fromCharCode(97 + ch.splitIndex)}`;
  }
  return `${num}`;
}

// Check if any chapters in the array have split groups
function hasSplitChapters(chapters) {
  return chapters.some(c => c.splitGroup != null || c.mergedParts);
}

async function loadProjects() {
  if (el()) return (await window.electron.readPrebuildData?.()) || [];
  try { return JSON.parse(localStorage.getItem(PREBUILD_STORAGE_KEY) || '[]'); } catch { return []; }
}

async function persistProjects(projects) {
  if (el()) { await window.electron.writePrebuildData?.(projects); return; }
  try { localStorage.setItem(PREBUILD_STORAGE_KEY, JSON.stringify(projects)); }
  catch { alert('Storage full.'); }
}

function countWordsInHtml(html) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ');
  return (text.match(/[A-Za-z0-9']+/g) || []).length;
}

function htmlToWords(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  const words = [];
  const blockTags = new Set(['P','H1','H2','H3','H4','H5','H6','DIV','LI','BR','TR']);
  const walk = (node) => {
    if (node.nodeType === 3) {
      const tokens = node.textContent.split(/(\s+)/);
      tokens.forEach(t => { if (t.trim()) words.push({ text: t, highlight: null }); });
    } else if (node.nodeType === 1) {
      // Insert paragraph break before block-level elements
      if (blockTags.has(node.tagName) && words.length > 0 && !words[words.length - 1].paraBreak) {
        words.push({ text: null, highlight: null, paraBreak: true });
      }
      const cls = node.className || '';
      const hlMatch = cls.match(/hl-\w+/);
      if (hlMatch) {
        // Check for inline background color (preserves original hex from DOCX)
        const style = node.getAttribute('style') || '';
        const bgMatch = style.match(/background:\s*#([0-9a-fA-F]{6})/);
        const highlightId = bgMatch ? `hl-hex-${bgMatch[1].toUpperCase()}` : hlMatch[0];
        const innerWords = [];
        const walkInner = (n) => {
          if (n.nodeType === 3) {
            n.textContent.split(/(\s+)/).forEach(t => { if (t.trim()) innerWords.push(t); });
          } else if (n.nodeType === 1) { Array.from(n.childNodes).forEach(walkInner); }
        };
        Array.from(node.childNodes).forEach(walkInner);
        innerWords.forEach(w => words.push({ text: w, highlight: highlightId }));
      } else {
        Array.from(node.childNodes).forEach(walk);
      }
    }
  };
  Array.from(div.childNodes).forEach(walk);
  return words;
}

// Filter out paraBreak markers for alignment/highlight operations
function realWords(words) { return words.filter(w => !w.paraBreak); }

// Find contiguous blocks of highlighted words
function findHighlightBlocks(words) {
  const blocks = [];
  let current = null;
  for (let i = 0; i < words.length; i++) {
    if (words[i].highlight) {
      if (!current || current.highlight !== words[i].highlight) {
        if (current) blocks.push(current);
        current = { startIdx: i, endIdx: i, highlight: words[i].highlight, words: [words[i].text] };
      } else {
        current.endIdx = i;
        current.words.push(words[i].text);
      }
    } else {
      if (current) { blocks.push(current); current = null; }
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function getWordsBeforeBlock(words, block, count = 3) {
  const context = [];
  for (let i = block.startIdx - 1; i >= 0 && context.length < count; i--) {
    const word = words[i]?.text?.trim();
    if (!word) continue;
    context.unshift(word);
  }
  return context.join(' ');
}

function cleanExportText(text) {
  return String(text || '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanExportFilePart(text, fallback = 'Chapter') {
  return cleanExportText(text)
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .trim() || fallback;
}

function getChapterExportLabel(chapters, index) {
  const chapter = chapters[index];
  const fallback = `Chapter ${getChapterDisplayNum(chapters, index)}`;
  return cleanExportText(chapter?.title || fallback) || fallback;
}

function getChapterHighlightMeta(chapter) {
  const counts = {};
  const blocks = findHighlightBlocks(realWords(htmlToWords(chapter?.html || '')));
  for (const block of blocks) {
    counts[block.highlight] = (counts[block.highlight] || 0) + 1;
  }
  return Object.entries(counts).map(([cls, count]) => ({ cls, hex: hlHex(cls), count }));
}

function getDefaultExportOptions(bookTitle = '') {
  return {
    includeBook: true,
    bookLabel: bookTitle,
    includeCharacter: true,
    includeContext: true,
    contextWordCount: 3,
    includeHighlight: true,
  };
}

function getExportOptions(proj) {
  const defaults = getDefaultExportOptions(proj?.title || '');
  const current = proj?.exportOptions || {};
  return {
    ...defaults,
    ...current,
    bookLabel: current.bookLabel ?? defaults.bookLabel,
    contextWordCount: Math.min(5, Math.max(1, Number(current.contextWordCount ?? defaults.contextWordCount) || defaults.contextWordCount)),
  };
}

function formatTimestamp(seconds) {
  if (!Number.isFinite(seconds)) return '--:--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// Adobe Audition decimal time: M:SS.mmm  (e.g. 2:41.199) or H:MM:SS.mmm if ≥1h
function formatAuditionTime(seconds) {
  if (!Number.isFinite(seconds)) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const whole = Math.floor(s);
  const ms = Math.round((s - whole) * 1000);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(whole).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
  return `${m}:${String(whole).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
}

// ─── Highlight class → hex mapping ────────────────────────────────────────────
const HL_HEX = {
  'hl-yellow': '#FFF8DC', 'hl-green': '#DFF2E3', 'hl-cyan': '#DFF4F7',
  'hl-magenta': '#FDDEE8', 'hl-pink': '#FDDEE8', 'hl-blue': '#DDEEFF',
  'hl-red': '#FDDEDE', 'hl-darkblue': '#D4E5F9', 'hl-darkcyan': '#D4F0F5',
  'hl-darkgreen': '#D4EDD9', 'hl-darkmagenta': '#F0D9F7', 'hl-darkred': '#F9D9D9',
  'hl-darkyellow': '#FFF0CC', 'hl-lightgray': '#F2F2F0', 'hl-darkgray': '#E6E5E0',
};
function hlHex(cls) {
  if (cls && cls.startsWith('hl-hex-')) return '#' + cls.slice(7);
  return HL_HEX[cls] || '#FFF8DC';
}

// Find the timestamp of the last matched word BEFORE a highlight block.
// This is the "insertion point" — where the second narrator's dialogue should go.
// Falls back to the first matched word AFTER the block if nothing before.
function findInsertionTimestamp(alignment, block) {
  // Search backwards from start of highlight for nearest aligned word
  for (let offset = 1; offset <= 30; offset++) {
    const idx = block.startIdx - offset;
    if (idx < 0) break;
    const ts = alignment[idx]?.wordObj?.end; // use END time of the word before (the insertion comes after it)
    if (Number.isFinite(ts)) return ts;
  }
  // Fallback: search forward from end of highlight
  for (let offset = 1; offset <= 30; offset++) {
    const idx = block.endIdx + offset;
    if (idx >= alignment.length) break;
    const ts = alignment[idx]?.wordObj?.start;
    if (Number.isFinite(ts)) return ts;
  }
  return undefined;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card = { background:'white',borderRadius:22,border:'1px solid var(--accent-border)',padding:0,marginBottom:'1rem',boxShadow:'0 18px 44px var(--accent-shadow)',overflow:'hidden' };
const btn = (active) => ({ padding:'9px 18px',borderRadius:999,border:'1px solid var(--border)',background:active?'var(--accent)':'white',color:active?'white':'var(--text)',cursor:'pointer',fontWeight:active?600:500,fontSize:'0.82rem',transition:'all 0.15s',boxShadow:active?'0 10px 22px var(--accent-shadow)':'none' });
const btnPrimary = { padding:'12px 28px',borderRadius:999,border:'none',background:'var(--accent)',color:'white',fontWeight:600,fontSize:'0.9rem',cursor:'pointer',boxShadow:'0 12px 28px var(--accent-shadow)' };

export default function PrebuildMode({ modeToggle = null }) {
  const [view, setView] = useState('home');
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [scanChapterIdx, setScanChapterIdx] = useState(-1);
  const [selectedChapter, setSelectedChapter] = useState(0);
  const cancelRef = useRef(false);
  const [exportFilter, setExportFilter] = useState({}); // { 'hl-yellow': true, 'hl-cyan': false, ... }
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [bulkStartIdx, setBulkStartIdx] = useState(0);
  const [bulkTreatAsOne, setBulkTreatAsOne] = useState(false);
  const [chapterEditMode, setChapterEditMode] = useState(false);
  const [selectedChapterIds, setSelectedChapterIds] = useState({});
  const [editingCharacterKey, setEditingCharacterKey] = useState(null);
  const [characterDraft, setCharacterDraft] = useState('');
  const [chapterMenuOpen, setChapterMenuOpen] = useState(false);
  const [showHomeInfo, setShowHomeInfo] = useState(false);
  const [showFloatingNav, setShowFloatingNav] = useState(false);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [exportDraft, setExportDraft] = useState(null);
  const [exportFilterDraft, setExportFilterDraft] = useState({});
  const [exportSaveStatus, setExportSaveStatus] = useState('');
  const reuploadRef = useRef(null);
  const chapterRefs = useRef({});

  useEffect(() => {
    loadProjects().then(setProjects);
  }, []);

  useEffect(() => {
    const handleResize = () => setShowFloatingNav(window.innerWidth >= 760);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setExportFilter(activeProject?.exportFilter || {});
  }, [activeProject?.id]);

  const save = useCallback(async (updated) => {
    setProjects(updated);
    await persistProjects(updated);
  }, []);

  const updateProject = useCallback((proj) => {
    setActiveProject(proj);
    setProjects(prev => {
      const next = prev.map(p => p.id === proj.id ? proj : p);
      persistProjects(next);
      return next;
    });
  }, []);

  const startCharacterEdit = useCallback((proj, highlightKey) => {
    setEditingCharacterKey(highlightKey);
    setCharacterDraft(proj.characterNames?.[highlightKey] || '');
  }, []);

  const cancelCharacterEdit = useCallback(() => {
    setEditingCharacterKey(null);
    setCharacterDraft('');
  }, []);

  const saveCharacterName = useCallback((proj, highlightKey) => {
    const trimmed = characterDraft.trim();
    const nextNames = { ...(proj.characterNames || {}) };
    if (trimmed) nextNames[highlightKey] = trimmed;
    else delete nextNames[highlightKey];
    updateProject({ ...proj, characterNames: nextNames });
    setEditingCharacterKey(null);
    setCharacterDraft('');
  }, [characterDraft, updateProject]);

  // ─── Home view ────────────────────────────────────────────────────────────
  if (view === 'newProject') {
    return (
      <ImportFlow
        accent="#7FA1C9"
        heading="New duet audio prep"
        blurb="Upload the engineer manuscript. We'll detect chapters and the highlighted insertions."
        submitLabel="Create project"
        allowSceneSplitting={true}
        defaultSplitScenes={true}
        onCancel={() => setView('home')}
        onConfirm={(payload) => {
          const chapters = (payload.chapters || []).map((c) => ({
            ...c,
            audioFile: null,
            audioPath: null,
            whisperWords: null,
            whisperAlignment: null,
            whisperMatchQuality: null,
            transcribed: false,
          }));
          const proj = {
            id: Date.now(),
            title: payload.title || payload.fileName?.replace(/\.docx$/i, '') || 'Untitled',
            fileName: payload.fileName,
            fullHtml: payload.fullHtml,
            chapterLevel: payload.chapterLevel,
            characterNames: {},
            exportOptions: {
              includeBook: true,
              bookLabel: payload.title || payload.fileName?.replace(/\.docx$/i, '') || 'Untitled',
              includeCharacter: true,
              includeContext: true,
              contextWordCount: 3,
              includeHighlight: true,
            },
            chapters,
            // Marie 2026-05-26: PDF page map from auto-scan during import.
            pdfPaging: payload.pdfPaging || null,
            pdfFileName: payload.pdfFileName || '',
            pdfSource: payload.pdfSource || null,
            pageNumberAdjustment: 0,
          };
          const updated = [...projects, proj];
          save(updated);
          setActiveProject(proj);
          setView('project');
        }}
      />
    );
  }

  if (view === 'home') {
    return (
      <div style={{ minHeight:'100vh',background:'var(--cream)' }}>
        {modeToggle}
        {showHomeInfo && (
          <div
            onClick={() => setShowHomeInfo(false)}
            style={{ position:'fixed',inset:0,background:'rgba(28, 18, 44, 0.18)',backdropFilter:'blur(4px)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width:'min(520px, 100%)',background:'white',border:'1px solid var(--accent-border)',borderRadius:24,boxShadow:'0 24px 60px var(--accent-shadow-strong)',padding:'20px 20px 18px' }}
            >
              <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:12 }}>
                <div style={{ fontSize:'1rem',fontWeight:700,color:'var(--text)' }}>About Duet Audio Prep</div>
                <button onClick={() => setShowHomeInfo(false)} style={{ ...btn(false), padding:'6px 10px',fontSize:'0.74rem',color:'var(--accent-dark)',borderColor:'var(--accent-border)',fontWeight:700 }}>
                  Close
                </button>
              </div>
              <div style={{ display:'grid',gap:10,fontSize:'0.85rem',lineHeight:1.6,color:'var(--text-muted)' }}>
                <p style={{ margin:0 }}>
                  Script and Sync Duet Audio Prep helps audio engineers line up a multi-cast audiobook manuscript with raw chapter audio so highlighted lines can be located accurately by timestamp. This only works with manuscripts that use highlights to note different speakers.
                </p>
                <p style={{ margin:0 }}>
                  It transcribes and aligns the main narration, scanning for highlights in the document, then generates timestamped Adobe Audition markers the engineer can export for use during editing.
                </p>
              </div>
            </div>
          </div>
        )}
        <div style={{ maxWidth:640,margin:'0 auto',padding:'4.7rem 1.25rem 4.25rem' }}>
          <div style={{ marginBottom:'1.9rem', textAlign:'center', position:'relative' }}>
            <button
              onClick={() => setShowHomeInfo(true)}
              aria-label="About Duet Audio Prep"
              title="About Duet Audio Prep"
              style={{
                position:'absolute',
                top:0,
                right:'max(4%, 0px)',
                width:42,
                height:42,
                borderRadius:'50%',
                border:'1px solid var(--accent-border)',
                background:'white',
                color:'var(--accent-dark)',
                fontSize:'1.1rem',
                fontWeight:700,
                cursor:'pointer',
                boxShadow:'0 10px 24px var(--accent-shadow)',
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
              }}
            >
              ?
            </button>
            <img
              src="/branding/script-and-sync-header-for-duet.png"
              alt="Script and Sync Duet Audio Prep"
              style={{ width:'min(420px, 92%)',height:'auto',display:'block',margin:'0 auto 0.85rem' }}
            />
            <h1 style={{ position:'absolute',width:1,height:1,padding:0,margin:-1,overflow:'hidden',clip:'rect(0, 0, 0, 0)',whiteSpace:'nowrap',border:0 }}>Script and Sync Duet Audio Prep</h1>
          </div>

          <div style={{ display:'grid', gap:14 }}>
            <section style={{ background:'rgba(255,255,255,0.78)', border:'1px solid var(--border)', borderRadius:22, padding:'1rem' }}>
              <button
                onClick={() => setView('newProject')}
                style={{ display:'block',width:'100%',padding:'14px 18px',background:'var(--accent)',color:'white',border:'none',borderRadius:16,fontSize:'0.96rem',fontWeight:600,cursor:'pointer',textAlign:'left',marginBottom:12 }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--accent-dark)'}
                onMouseLeave={e=>e.currentTarget.style.background='var(--accent)'}
              >
                + New audiobook
              </button>
            </section>

            <section style={{ background:'rgba(255,255,255,0.72)', border:'1px solid var(--border)', borderRadius:22, padding:'1rem' }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginBottom:projects.length>0 ? 10 : 0,textAlign:'center' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'0.74rem',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--accent-dark)',marginBottom:2 }}>Build queue</div>
                  <div style={{ fontSize:'0.82rem',color:'var(--text-muted)' }}>
                    {projects.length>0 ? `${projects.length} saved ${projects.length===1 ? 'duet audio prep project' : 'duet audio prep projects'}` : 'Saved duet audio prep projects will appear here'}
                  </div>
                </div>
              </div>

              {projects.length > 0 ? (
                <div style={{ display:'flex',flexDirection:'column',gap:7,maxHeight:'min(46vh, 420px)',overflowY:'auto',paddingRight:4 }}>
                  {/* Last-touched first. Marie 2026-05-26: same as Proof + Phone. */}
                  {[...projects].sort((a, b) => {
                    const at = Date.parse(a?.updatedAt || '') || Number(a?.updatedAt) || 0;
                    const bt = Date.parse(b?.updatedAt || '') || Number(b?.updatedAt) || 0;
                    return bt - at;
                  }).map(proj => (
                    <button
                      key={proj.id}
                      onClick={() => { setActiveProject(proj); setView('project'); }}
                      style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'white',border:'1px solid var(--border)',borderRadius:14,cursor:'pointer',textAlign:'left',transition:'border-color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='#ccc'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
                    >
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontWeight:600,fontSize:'0.92rem',color:'var(--text)',marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{proj.title}</div>
                        <div style={{ fontSize:'0.75rem',color:'var(--text-muted)' }}>
                          {proj.chapters?.length || 0} chapters · {proj.chapters?.filter(c => c.transcribed).length || 0} scanned
                        </div>
                      </div>
                      <span style={{ color:'var(--text-light)',fontSize:'1.2rem',paddingLeft:10 }}>›</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign:'center',color:'var(--text-light)',fontSize:'0.82rem',padding:'1.2rem 0 0.35rem' }}>
                  No duet audio prep projects yet
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ─── Project detail view ──────────────────────────────────────────────────
  if (view === 'project' && activeProject) {
    const proj = activeProject;
    const chapters = proj.chapters || [];
    const allScanned = chapters.length > 0 && chapters.every(c => c.transcribed);
    const audioAssigned = chapters.every(c => c.audioPath);
    const anyAudio = chapters.some(c => c.audioPath);
    const scannedCount = chapters.filter(c => c.transcribed).length;
    const readyToScanCount = chapters.filter(c => !!(c.audioPath && c.html)).length;

    const getChapterStatus = (chapter, index) => {
      const ready = !!(chapter.audioPath && chapter.html);
      const scanned = !!chapter.transcribed;
      const scanningNow = scanChapterIdx === index && scanning;
      return { ready, scanned, scanningNow };
    };

    const scrollToChapterRow = (chapterId) => {
      const node = chapterRefs.current[chapterId];
      if (node?.scrollIntoView) node.scrollIntoView({ behavior:'smooth', block:'center' });
    };

    function renderReadyNavigator(isInline = false) {
      if (!chapters.length) return null;
      const navProgress = chapters.length ? Math.round((readyToScanCount / chapters.length) * 100) : 0;

      return (
        <div
          style={isInline
            ? { background:'white',border:'1px solid var(--border)',borderRadius:16,padding:'6px 7px 4px',boxShadow:'0 10px 24px var(--accent-shadow)',height:'fit-content',marginTop:10 }
            : { position:'fixed',right:12,top:86,width:236,maxHeight:'calc(100vh - 106px)',overflow:'hidden',background:'rgba(255,255,255,0.96)',backdropFilter:'blur(10px)',border:'1px solid var(--accent-border)',borderRadius:16,boxShadow:'0 16px 32px var(--accent-shadow-strong)',zIndex:980 }}
        >
          <div style={{ padding:isInline ? 0 : '8px 8px 6px',borderBottom:isInline ? 'none' : '1px solid var(--accent-border)' }}>
            <div style={{ fontSize:'0.72rem',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--accent-dark)' }}>Navigation</div>
            <div style={{ fontSize:'0.68rem',color:'var(--text-muted)',marginTop:1 }}>Ready to scan</div>
            <div style={{ marginTop:6 }}>
              <div style={{ height:5,borderRadius:999,background:'var(--accent-light)',overflow:'hidden' }}>
                <div style={{ width:`${navProgress}%`,height:'100%',background:'linear-gradient(90deg, var(--accent-dark) 0%, var(--accent) 100%)' }} />
              </div>
            </div>
          </div>
          <div style={{ padding:isInline ? '3px 0 0' : '3px 4px 5px',overflowY:'auto',maxHeight:isInline ? 'min(240px, 38vh)' : 'calc(100vh - 160px)' }}>
            {chapters.map((chapter, index) => {
              const displayNum = getChapterDisplayNum(chapters, index);
              const status = getChapterStatus(chapter, index);
              return (
                <div key={`nav-${chapter.id}`} style={{ display:'grid',gridTemplateColumns:'1fr 20px',gap:6,alignItems:'center',padding:'1px 1px' }}>
                  <button
                    onClick={() => scrollToChapterRow(chapter.id)}
                    style={{
                      border:'1px solid transparent',
                      background:status.scanned ? '#f6f1ff' : status.ready ? 'var(--accent-soft)' : 'transparent',
                      color:'var(--text)',
                      borderRadius:10,
                      padding:'5px 7px',
                      textAlign:'left',
                      cursor:'pointer',
                    }}
                  >
                    <div style={{ minWidth:0,display:'flex',alignItems:'center',gap:8 }}>
                      <span style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:38,padding:'2px 8px',borderRadius:999,background:'white',border:'1px solid var(--border-light)',fontSize:'0.68rem',fontWeight:800,color:'var(--text-muted)',flex:'0 0 auto' }}>
                        {displayNum}
                      </span>
                      <div style={{ fontSize:'0.74rem',fontWeight:500,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:'var(--text)',lineHeight:1.15 }}>
                        {chapter.title}
                      </div>
                    </div>
                  </button>
                  <div aria-label={status.scanned ? 'Scanned' : 'Not scanned'} title={status.scanned ? 'Scanned' : 'Not scanned'} style={{ color:status.scanned ? 'var(--success)' : 'var(--danger)',fontSize:status.scanningNow ? '0.7rem' : '0.86rem',fontWeight:900,textAlign:'center' }}>
                    {status.scanningNow ? '...' : status.scanned ? '✓' : '×'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // ── Merge a split group into one chapter entry ──
    function mergeGroup(groupNum) {
      const groupEntries = chapters.filter(c => c.splitGroup === groupNum);
      if (groupEntries.length < 2) return;
      const hasData = groupEntries.some(c => c.audioPath || c.transcribed);
      if (hasData && !confirm('Merging will reset audio and scan data for this chapter. Continue?')) return;

      const firstIdx = chapters.findIndex(c => c.splitGroup === groupNum);
      const combinedHtml = groupEntries[0].combinedHtml || groupEntries.map(e => e.html).join('');
      const combinedWordCount = groupEntries.reduce((n, e) => n + e.wordCount, 0);

      const merged = {
        id: uid(),
        title: groupEntries[0].parentTitle,
        html: combinedHtml,
        wordCount: combinedWordCount,
        audioFile: null, audioPath: null,
        whisperWords: null, whisperAlignment: null, whisperMatchQuality: null,
        transcribed: false,
        treatAsOne: true,
        mergedParts: groupEntries.map(e => ({
          id: e.id, title: e.title, html: e.html, wordCount: e.wordCount,
          partTitle: e.partTitle, splitGroup: e.splitGroup,
          splitIndex: e.splitIndex, splitTotal: e.splitTotal,
          parentTitle: e.parentTitle, combinedHtml: e.combinedHtml,
          combinedWordCount: e.combinedWordCount,
        })),
      };

      const newChapters = [];
      let groupInserted = false;
      for (const ch of chapters) {
        if (ch.splitGroup === groupNum) {
          if (!groupInserted) { newChapters.push(merged); groupInserted = true; }
        } else {
          newChapters.push(ch);
        }
      }
      updateProject({ ...proj, chapters: newChapters });
    }

    // ── Unmerge a merged chapter back into individual parts ──
    function unmergeChapter(chapterId) {
      const idx = chapters.findIndex(c => c.id === chapterId);
      if (idx === -1 || !chapters[idx].mergedParts) return;
      const merged = chapters[idx];
      const hasData = merged.audioPath || merged.transcribed;
      if (hasData && !confirm('Splitting will reset audio and scan data for this chapter. Continue?')) return;

      const restored = merged.mergedParts.map(p => ({
        ...p,
        id: uid(),
        audioFile: null, audioPath: null,
        whisperWords: null, whisperAlignment: null, whisperMatchQuality: null,
        transcribed: false,
      }));
      const newChapters = [...chapters.slice(0, idx), ...restored, ...chapters.slice(idx + 1)];
      updateProject({ ...proj, chapters: newChapters });
    }

    // ── Batch merge or unmerge all split groups ──
    function batchToggleMerge(mergeAll) {
      let current = { ...proj, chapters: [...chapters] };
      if (mergeAll) {
        const groups = new Set(chapters.filter(c => c.splitGroup != null).map(c => c.splitGroup));
        if (!groups.size) return;
        const hasData = chapters.some(c => c.splitGroup != null && (c.audioPath || c.transcribed));
        if (hasData && !confirm('Merging will reset audio and scan data for split chapters. Continue?')) { setBulkTreatAsOne(false); return; }
        for (const g of groups) {
          const chs = current.chapters;
          const groupEntries = chs.filter(c => c.splitGroup === g);
          if (groupEntries.length < 2) continue;
          const firstIdx = chs.findIndex(c => c.splitGroup === g);
          const combinedHtml = groupEntries[0].combinedHtml || groupEntries.map(e => e.html).join('');
          const merged = {
            id: uid(), title: groupEntries[0].parentTitle,
            html: combinedHtml,
            wordCount: groupEntries.reduce((n, e) => n + e.wordCount, 0),
            audioFile: null, audioPath: null,
            whisperWords: null, whisperAlignment: null, whisperMatchQuality: null,
            transcribed: false, treatAsOne: true,
            mergedParts: groupEntries.map(e => ({
              id: e.id, title: e.title, html: e.html, wordCount: e.wordCount,
              partTitle: e.partTitle, splitGroup: e.splitGroup,
              splitIndex: e.splitIndex, splitTotal: e.splitTotal,
              parentTitle: e.parentTitle, combinedHtml: e.combinedHtml,
              combinedWordCount: e.combinedWordCount,
            })),
          };
          const newChs = [];
          let inserted = false;
          for (const ch of chs) {
            if (ch.splitGroup === g) { if (!inserted) { newChs.push(merged); inserted = true; } }
            else newChs.push(ch);
          }
          current = { ...current, chapters: newChs };
        }
      } else {
        // Unmerge all merged chapters
        const mergedIds = chapters.filter(c => c.mergedParts).map(c => c.id);
        if (!mergedIds.length) return;
        const hasData = chapters.some(c => c.mergedParts && (c.audioPath || c.transcribed));
        if (hasData && !confirm('Splitting will reset audio and scan data for merged chapters. Continue?')) { setBulkTreatAsOne(true); return; }
        let newChs = [...current.chapters];
        for (const mid of mergedIds) {
          const mIdx = newChs.findIndex(c => c.id === mid);
          if (mIdx === -1 || !newChs[mIdx].mergedParts) continue;
          const restored = newChs[mIdx].mergedParts.map(p => ({
            ...p, id: uid(),
            audioFile: null, audioPath: null,
            whisperWords: null, whisperAlignment: null, whisperMatchQuality: null,
            transcribed: false,
          }));
          newChs = [...newChs.slice(0, mIdx), ...restored, ...newChs.slice(mIdx + 1)];
        }
        current = { ...current, chapters: newChs };
      }
      updateProject(current);
    }

    async function handleAudioUpload() {
      if (!el()) return;
      const files = await window.electron.openAudioDialog({ multiple: true });
      if (!files || !files.length) return;
      const updated = { ...proj, chapters: chapters.map((ch, i) => {
        const fileIdx = i - bulkStartIdx;
        if (fileIdx >= 0 && fileIdx < files.length) return { ...ch, audioFile: files[fileIdx].name, audioPath: files[fileIdx].storedPath || files[fileIdx].path };
        return ch;
      })};
      updateProject(updated);
    }

    async function handleSingleAudio(chapterIdx) {
      if (!el()) return;
      const file = await window.electron.openAudioDialog();
      if (!file) return;
      const updatedChapters = [...chapters];
      updatedChapters[chapterIdx] = { ...updatedChapters[chapterIdx], audioFile: file.name, audioPath: file.storedPath || file.path };
      updateProject({ ...proj, chapters: updatedChapters });
    }

    function clearChapterAudio(chapterIdx) {
      const updatedChapters = [...chapters];
      updatedChapters[chapterIdx] = { ...updatedChapters[chapterIdx], audioFile: null, audioPath: null, transcribed: false, whisperWords: null, whisperAlignment: null, whisperMatchQuality: null };
      updateProject({ ...proj, chapters: updatedChapters });
    }

    function enterChapterEditMode() {
      setChapterEditMode(true);
      setSelectedChapterIds({});
    }

    function exitChapterEditMode() {
      setChapterEditMode(false);
      setSelectedChapterIds({});
    }

    function toggleChapterSelection(chapterId) {
      setSelectedChapterIds(prev => ({
        ...prev,
        [chapterId]: !prev[chapterId],
      }));
    }

    function deleteSelectedChapters() {
      const idsToDelete = Object.entries(selectedChapterIds)
        .filter(([, selected]) => selected)
        .map(([id]) => id);
      if (!idsToDelete.length) return;

      const selectedEntries = chapters.filter(ch => idsToDelete.includes(ch.id));
      const count = selectedEntries.length;
      const label = count === 1
        ? `"${selectedEntries[0].title || 'Untitled chapter'}"`
        : `${count} chapters`;

      if (!confirm(`Delete ${label} from this project? This cannot be undone.`)) return;

      const updatedChapters = chapters.filter(ch => !idsToDelete.includes(ch.id));
      const nextBulkStartIdx = updatedChapters.length ? Math.min(bulkStartIdx, updatedChapters.length - 1) : 0;
      setBulkStartIdx(nextBulkStartIdx);
      updateProject({ ...proj, chapters: updatedChapters });
      setChapterEditMode(false);
      setSelectedChapterIds({});
    }

    async function scanChapterIntoProject(currentProj, chapterIdx, deps, options = {}) {
      const { transcribeAudio, alignTranscriptToManuscript } = deps;
      const { force = false } = options;
      const ch = currentProj.chapters[chapterIdx];
      const dNum = getChapterDisplayNum(currentProj.chapters, chapterIdx);
      if (!ch.audioPath) { setScanProgress(`Skipping ${dNum} — no audio`); return currentProj; }
      if (!ch.html) { setScanProgress(`Skipping ${dNum} — no manuscript text`); return currentProj; }
      if (ch.transcribed && !force) { setScanProgress(`${dNum} already scanned`); return currentProj; }

      setScanChapterIdx(chapterIdx);
      setScanProgress(`Scanning ${dNum} of ${currentProj.chapters.length}: "${ch.title}"`);

      // Transcribe directly from file path (no need to load into renderer memory)
      const result = await transcribeAudio(null, (p) => {
        setScanProgress(`${dNum}/${currentProj.chapters.length}: ${p.message}`);
      }, ch.audioPath);

      // Align to manuscript (filter out paraBreak markers)
      // Build set of highlighted word indices so aligner knows to skip them
      const allMsWords = realWords(htmlToWords(ch.html));
      const msWords = allMsWords.map(w => w.text);
      const highlightedIndices = new Set();
      allMsWords.forEach((w, idx) => { if (w.highlight) highlightedIndices.add(idx); });
      const alignment = alignTranscriptToManuscript(msWords, result.words, undefined, highlightedIndices);
      // Match quality: only count non-highlighted words (highlighted words are expected to be unmatched)
      const spokenCount = msWords.length - highlightedIndices.size;
      const matched = alignment.filter((a, idx) => a && !highlightedIndices.has(idx)).length;
      const quality = spokenCount > 0 ? Math.round((matched / spokenCount) * 100) : 0;

      const updatedChapters = [...currentProj.chapters];
      updatedChapters[chapterIdx] = {
        ...ch,
        whisperWords: result.words,
        whisperAlignment: alignment,
        whisperMatchQuality: quality,
        transcribed: true,
      };
      const updatedProject = { ...currentProj, chapters: updatedChapters };
      updateProject(updatedProject);
      setScanProgress(`${dNum} done — ${quality}% match quality`);
      return updatedProject;
    }

    async function scanSingleChapter(chapterIdx) {
      if (scanning) {
        setScanProgress('Wait for the current transcription to finish, then try again.');
        return;
      }
      cancelRef.current = false;
      setScanning(true);

      const { transcribeAudio } = await import('../lib/transcriptionWorker');
      const { alignTranscriptToManuscript } = await import('../lib/fuzzyMatcher');

      try {
        const currentProj = { ...proj };
        const ch = currentProj.chapters[chapterIdx];
        await scanChapterIntoProject(currentProj, chapterIdx, { transcribeAudio, alignTranscriptToManuscript }, { force: !!ch?.transcribed });
      } catch (err) {
        const dNum = getChapterDisplayNum(proj.chapters || [], chapterIdx);
        console.error(`Error scanning ${dNum}:`, err);
        setScanProgress(`${dNum} error: ${err.message}`);
      } finally {
        setScanning(false);
        setScanChapterIdx(-1);
      }
    }

    async function scanAll() {
      if (scanning) {
        cancelRef.current = true;
        // Kill the running whisper process immediately
        if (window.electron?.whisperCancel) window.electron.whisperCancel().catch(() => {});
        return;
      }
      cancelRef.current = false;
      setScanning(true);

      const { transcribeAudio } = await import('../lib/transcriptionWorker');
      const { alignTranscriptToManuscript } = await import('../lib/fuzzyMatcher');

      let currentProj = { ...proj };

      for (let i = 0; i < currentProj.chapters.length; i++) {
        if (cancelRef.current) break;
        const dNum = getChapterDisplayNum(currentProj.chapters, i);

        try {
          const beforeProject = currentProj;
          currentProj = await scanChapterIntoProject(currentProj, i, { transcribeAudio, alignTranscriptToManuscript });

          // Give OS 3 seconds between chapters to reclaim GPU/memory from whisper
          if (currentProj !== beforeProject && i < currentProj.chapters.length - 1 && !cancelRef.current) {
            await new Promise(r => setTimeout(r, 3000));
          }
        } catch (err) {
          console.error(`Error scanning ${dNum}:`, err);
          setScanProgress(`${dNum} error: ${err.message}`);
        }
      }

      setScanning(false);
      setScanChapterIdx(-1);
      if (cancelRef.current) setScanProgress('Scan cancelled.');
      else setScanProgress('All chapters scanned!');
    }

    async function realignAll() {
      const { alignTranscriptToManuscript } = await import('../lib/fuzzyMatcher');
      let currentProj = { ...proj };
      let realigned = 0;

      for (let i = 0; i < currentProj.chapters.length; i++) {
        const ch = currentProj.chapters[i];
        if (!ch.whisperWords?.length) continue;
        const allMsWords = realWords(htmlToWords(ch.html));
        const msWords = allMsWords.map(w => w.text);
        const highlightedIndices = new Set();
        allMsWords.forEach((w, idx) => { if (w.highlight) highlightedIndices.add(idx); });
        const alignment = alignTranscriptToManuscript(msWords, ch.whisperWords, undefined, highlightedIndices);
        const spokenCount = msWords.length - highlightedIndices.size;
        const matched = alignment.filter((a, idx) => a && !highlightedIndices.has(idx)).length;
        const quality = spokenCount > 0 ? Math.round((matched / spokenCount) * 100) : 0;
        const updatedChapters = [...currentProj.chapters];
        updatedChapters[i] = { ...ch, whisperAlignment: alignment, whisperMatchQuality: quality };
        currentProj = { ...currentProj, chapters: updatedChapters };
        realigned++;
      }

      updateProject(currentProj);
      setScanProgress(`Re-aligned ${realigned} chapters (no re-transcription needed).`);
    }

    function exportCsv(optionsOverride = null, filterOverride = null) {
      // Build per-chapter Audition marker data for duet insertion points
      const chapEntries = [];       // { displayLabel, markers: [{start, dialogue}] }
      const skipped = [];
      const bookTitle = (proj.title || '').trim();
      const exportOptions = optionsOverride || getExportOptions(proj);
      const activeExportFilter = filterOverride || exportFilter;

      for (let ci = 0; ci < chapters.length; ci++) {
        const ch = chapters[ci];
        if (!ch.whisperAlignment) continue;
        const words = realWords(htmlToWords(ch.html));
        const blocks = findHighlightBlocks(words);
        const displayLabel = getChapterExportLabel(chapters, ci);
        const markers = [];

        for (const block of blocks) {
          if (activeExportFilter[block.highlight] === false) continue;
          const ts = findInsertionTimestamp(ch.whisperAlignment, block);
          const dialogue = cleanExportText(block.words.join(' '));
          const preRoll = cleanExportText(getWordsBeforeBlock(words, block, exportOptions.contextWordCount));
          const character = cleanExportText(proj.characterNames?.[block.highlight] || hlHex(block.highlight));
          if (!Number.isFinite(ts)) {
            skipped.push({ chapter: displayLabel, dialogue: dialogue.slice(0, 60) });
            continue;
          }
          markers.push({ start: ts, dialogue, preRoll, character });
        }
        if (markers.length) chapEntries.push({ displayLabel, markers });
      }

      // Sort each chapter's markers by ascending time
      for (const entry of chapEntries) {
        entry.markers.sort((a, b) => a.start - b.start);
      }

      // Build one tab-delimited file per chapter
      const TAB = '\t';
      const HEADER = ['Name', 'Start', 'Duration', 'Time Format', 'Type', 'Description'].join(TAB);
      const files = [];
      const bookPrefix = bookTitle ? `${cleanExportFilePart(bookTitle, 'book')}_` : '';

      chapEntries.forEach(({ displayLabel, markers }) => {
        const rows = [HEADER];
        markers.forEach((row, ri) => {
          const name = `Insert ${String(ri + 1).padStart(2, '0')}`;
          const start = formatAuditionTime(row.start);
          const parts = [];
          if (exportOptions.includeBook) {
            const bookLabel = cleanExportText(exportOptions.bookLabel || bookTitle);
            if (bookLabel) parts.push(bookLabel);
          }
          if (exportOptions.includeCharacter) {
            const characterLabel = cleanExportText(row.character);
            if (characterLabel) parts.push(characterLabel);
          }
          if (exportOptions.includeContext) {
            const contextLabel = cleanExportText(row.preRoll);
            if (contextLabel) parts.push(contextLabel);
          }
          if (exportOptions.includeHighlight) {
            const dialogueLabel = cleanExportText(row.dialogue);
            if (dialogueLabel) parts.push(dialogueLabel);
          }
          const desc = parts.map(part => `[${part}]`).join('');
          rows.push([name, start, '0:00.000', 'decimal', 'Cue', desc].join(TAB));
        });
        const safeName = cleanExportFilePart(displayLabel);
        files.push({ name: `${bookPrefix}${safeName}_markers.csv`, content: rows.join('\n') });
      });

      if (!files.length) { alert('Nothing to export — no insertion points found. Make sure your manuscript has highlights.'); return; }

      if (skipped.length) {
        console.warn('Skipped rows (missing chapter or timestamp):', skipped);
      }

      const folderName = `${proj.title || 'markers'}_duet_markers`;

      if (el()) {
        window.electron.exportMarkersFolder({ folderName, files }).then(outDir => {
          if (outDir) alert(`Exported ${files.length} chapter file(s) to:\n${outDir}`);
        });
      } else {
        // Browser fallback: download each file individually
        for (const f of files) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([f.content], { type: 'text/csv' }));
          a.download = f.name;
          a.click();
        }
      }
    }

    function deleteProject() {
      if (!confirm(`Delete "${proj.title}"? This cannot be undone.`)) return;
      const updated = projects.filter(p => p.id !== proj.id);
      save(updated);
      setActiveProject(null);
      setView('home');
    }

    async function reuploadManuscript(file) {
      if (!file) return;
      setScanProgress('Re-uploading manuscript…');
      try {
        // Backup current project state before overwriting
        const backup = JSON.parse(JSON.stringify(proj));
        console.log('[re-upload] Backup saved:', backup.chapters.length, 'chapters,', backup.chapters.filter(c => c.audioPath).length, 'with audio');

        const mammoth = (await import('mammoth')).default;
        const ab = await file.arrayBuffer();
        const { buffer: processedAb, hexMap } = await convertShadingToHighlight(ab);
        const result = await mammoth.convertToHtml({ arrayBuffer: processedAb }, { styleMap: STYLE_MAP });
        const html = applyHexColors(result.value, hexMap);
        const chapterTag = `h${proj.chapterLevel || 1}`;
        const newChapters = parseChapters(html, chapterTag);

        // Match by position (primary) — re-uploading the same manuscript keeps chapter order
        const oldChapters = [...chapters];
        const merged = newChapters.map((nc, ni) => {
          const match = ni < oldChapters.length ? oldChapters[ni] : null;
          if (match) {
            return {
              ...nc,
              audioFile: match.audioFile,
              audioPath: match.audioPath,
              whisperWords: match.whisperWords,
              whisperAlignment: match.whisperAlignment,
              whisperMatchQuality: match.whisperMatchQuality,
              transcribed: match.transcribed,
            };
          }
          return nc;
        });

        const audioKept = merged.filter(c => c.audioPath).length;
        const updated = { ...proj, fullHtml: html, chapters: merged };
        updateProject(updated);
        setScanProgress(`Manuscript re-uploaded: ${merged.length} chapters, ${audioKept} with audio preserved.`);
      } catch (err) {
        setScanProgress(`Re-upload failed: ${err.message}`);
      }
    }

    // Count total highlights across all chapters
    const totalHighlights = chapters.reduce((n, ch) => {
      const words = realWords(htmlToWords(ch.html));
      return n + findHighlightBlocks(words).length;
    }, 0);

    const timestampedHighlights = chapters.reduce((n, ch) => {
      if (!ch.whisperAlignment) return n;
      const words = realWords(htmlToWords(ch.html));
      const blocks = findHighlightBlocks(words);
      return n + blocks.filter(b => Number.isFinite(findInsertionTimestamp(ch.whisperAlignment, b))).length;
    }, 0);

    // Collect all unique highlight colors with counts
    const highlightColors = (() => {
      const counts = {};
      for (const ch of chapters) {
        const words = realWords(htmlToWords(ch.html));
        const blocks = findHighlightBlocks(words);
        for (const b of blocks) {
          counts[b.highlight] = (counts[b.highlight] || 0) + 1;
        }
      }
      return Object.entries(counts).map(([cls, count]) => ({ cls, hex: hlHex(cls), count }));
    })();
    const selectedChapterCount = Object.values(selectedChapterIds).filter(Boolean).length;
    const exportOptions = getExportOptions(proj);
    const currentExportDraft = exportDraft || exportOptions;
    const currentFilterDraft = exportFilterDraft || {};
    const openExportPanel = () => {
      setExportDraft(getExportOptions(proj));
      setExportFilterDraft(proj.exportFilter || exportFilter || {});
      setExportSaveStatus('');
      setExportPanelOpen(true);
    };
    const updateExportDraft = (patch) => {
      setExportDraft(prev => ({
        ...(prev || getExportOptions(proj)),
        ...patch,
      }));
      setExportSaveStatus('');
    };
    const saveExportSettings = () => {
      const nextOptions = exportDraft || getExportOptions(proj);
      const nextFilter = exportFilterDraft || {};
      setExportFilter(nextFilter);
      updateProject({
        ...proj,
        exportOptions: nextOptions,
        exportFilter: nextFilter,
      });
      setExportSaveStatus('Saved');
    };

    // Adapter — Duet project shape → Proof book shape — so SessionsView
    // renders Duet too. Same component everywhere. Narrators panel is
    // hidden (mode==='duet'); Engineer progress is passed as a slot;
    // Transcribe button is hidden (Duet doesn't transcribe).
    const adaptedBook = {
      id: proj.id,
      title: proj.title,
      fileName: proj.fileName || '',
      // Marie 2026-05-26: when a Duet import splits on H2 sub-headings
      // (defaultSplitScenes=true), each H2 scene becomes a separate flat
      // entry in `chapters` with the same `splitGroup` as its siblings.
      // Group them back into one parent chapter with multiple sections so
      // the Split toggle on book detail actually shows scene rows. Without
      // this, SessionsView tries to derive scenes by re-finding H2s in the
      // section HTML — but the parser already consumed those H2s during
      // import, so nothing renders.
      chapters: (() => {
        const groups = [];
        let current = null;
        for (const ch of chapters) {
          const groupKey = ch.splitGroup != null ? `g:${ch.splitGroup}` : `c:${ch.id}`;
          if (!current || current.key !== groupKey) {
            current = { key: groupKey, parent: ch, items: [] };
            groups.push(current);
          }
          current.items.push(ch);
        }
        return groups.map(group => ({
          id: group.parent.id,
          title: group.parent.parentTitle || group.parent.title,
          chapterTitle: group.parent.parentTitle || group.parent.title,
          sections: group.items.map((ch, i) => ({
            id: ch.id,
            title: ch.title,
            html: ch.html || ch.textHtml || '',
            // Duet's ch.audioFile is a string (the file name) in most code
            // paths, but historic code wrote it as { name } objects. Handle
            // both so a mix of old + new project data still shows the name.
            audioFileName: (typeof ch.audioFile === 'string' ? ch.audioFile : ch.audioFile?.name) || null,
            audioPath: ch.audioPath || null,
            audioPaths: ch.audioPaths || null,
            flags: [],
            // Manual tick overrides auto-scanned signal — so Marie can
            // mark a chapter done even if it hasn't been scanned, or
            // un-mark a scanned chapter she wants to revisit.
            completed: typeof ch.completed === 'boolean' ? ch.completed : !!ch.scanned,
            characterName: null,
            narratorName: null,
            chapterTitle: ch.title,
            isFirstSectionInChapter: i === 0,
          })),
        }));
      })(),
      narratorColors: [],
    };

    return (
      <ProofBookDetail
        mode="duet"
        book={adaptedBook}
        isElectron={typeof window !== 'undefined' && !!window.electron}
        usesCustomDragRegion={true}
        onProof={(section) => {
          const idx = chapters.findIndex(c => c.id === section?.id);
          if (idx >= 0) { setSelectedChapter(idx); setView('reader'); }
        }}
        onUpdateBook={(updated) => {
          if (updated.title && updated.title !== proj.title) {
            const u = { ...proj, title: updated.title };
            updateProject(u);
            save(projects.map(p => p.id === proj.id ? u : p));
          }
          if (Array.isArray(updated.chapters)) {
            // Mirror the shared book-page edits back to Duet's project:
            //   - chapter `completed` ticks
            //   - chapter list (so unchecking removes from Duet too)
            //   - audio file name + full path (so bulk-audio attaches
            //     survive a full app restart). Paths stay local — the
            //     audio-guard strips them before any cloud push.
            //
            // Marie 2026-05-26: adaptedBook now groups sibling split scenes
            // into one parent chapter with multiple sections, but Duet's
            // underlying project keeps each scene as a flat chapter. Walk
            // sections (not chapters) when mapping back so every scene gets
            // its updates — not just the first one.
            const bySectionId = new Map();
            for (const parent of updated.chapters) {
              for (const sec of (parent?.sections || [])) {
                if (sec?.id) bySectionId.set(sec.id, sec);
              }
            }
            const u = {
              ...proj,
              chapters: (proj.chapters || [])
                .filter((ch) => bySectionId.has(ch.id))
                .map((ch) => {
                  const sec = bySectionId.get(ch.id);
                  const patch = { ...ch, completed: !!(sec?.completed ?? ch.completed) };
                  if (sec) {
                    if (sec.audioFileName !== undefined) {
                      patch.audioFile = sec.audioFileName || null;
                    }
                    if (sec.audioPath !== undefined) {
                      patch.audioPath = sec.audioPath || null;
                    }
                    if (sec.audioPaths !== undefined) {
                      patch.audioPaths = sec.audioPaths || null;
                    }
                  }
                  return patch;
                }),
            };
            updateProject(u);
            save(projects.map((p) => p.id === proj.id ? u : p));
          }
        }}
        onToggleComplete={(sectionId) => {
          // Duet renders one section per chapter (id = chapter id), so
          // toggling the section toggles the chapter's done flag.
          const u = {
            ...proj,
            chapters: (proj.chapters || []).map((ch) =>
              ch.id === sectionId ? { ...ch, completed: !ch.completed } : ch
            ),
          };
          updateProject(u);
          save(projects.map((p) => p.id === proj.id ? u : p));
        }}
        onDelete={deleteProject}
        onBack={() => { setView('home'); setScanning(false); cancelRef.current = true; }}
        persistentAudioUrl={null}
        persistentAudioLabel=""
        persistentAudioState={null}
        // intentional: Duet doesn't use the persistent home-level audio
        // dock that Proof has. Engineer scan flow doesn't need it.
        onPersistentAudioStateChange={() => {}}
        onReturnToScene={() => {}}
        onClearPersistentAudio={() => {}}
        engineerProgress={(
          <div style={{ background:'var(--accent-soft)',borderRadius:16,border:'1px solid var(--accent-border)',padding:'8px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap' }}>
            <div style={{ fontWeight:700,fontSize:'0.86rem',color:'var(--text)' }}>Engineer progress</div>
            <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
              <div style={{ display:'inline-flex',alignItems:'baseline',gap:5,padding:'4px 10px',borderRadius:999,background:'white',border:'1px solid var(--accent-border)' }}>
                <span style={{ fontSize:'0.66rem',textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-light)',fontWeight:700 }}>Ready</span>
                <span style={{ fontSize:'0.88rem',fontWeight:700,color:'var(--text)' }}>{readyToScanCount}/{chapters.length}</span>
              </div>
              <div style={{ display:'inline-flex',alignItems:'baseline',gap:5,padding:'4px 10px',borderRadius:999,background:'white',border:'1px solid var(--accent-border)' }}>
                <span style={{ fontSize:'0.66rem',textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-light)',fontWeight:700 }}>Scanned</span>
                <span style={{ fontSize:'0.88rem',fontWeight:700,color:'var(--text)' }}>{scannedCount}/{chapters.length}</span>
              </div>
            </div>
          </div>
        )}
        actionButtonsOverride={(
          <>
            <button type="button" onClick={() => { setSelectedChapter(0); setView('reader'); }} style={{ padding:'8px 14px',borderRadius:999,border:'1px solid var(--accent-border)',background:'white',color:'var(--accent-dark)',fontSize:'0.78rem',fontWeight:700,cursor:'pointer' }}>Review manuscript</button>
            <button type="button" onClick={openExportPanel} disabled={!scannedCount} style={{ padding:'8px 18px',borderRadius:999,border:'none',background:'var(--accent)',color:'white',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',opacity: scannedCount ? 1 : 0.4 }}>Export</button>
          </>
        )}
      />
    );
  }

  // ─── Reader view ──────────────────────────────────────────────────────────
  if (view === 'reader' && activeProject) {
    const proj = activeProject;
    const chapters = proj.chapters || [];
    const chapterSummaries = chapters.map((chapter, index) => ({
      chapter,
      index,
      displayNum: getChapterDisplayNum(chapters, index),
      highlightMeta: getChapterHighlightMeta(chapter),
    }));
    const selectedSummary = chapterSummaries[selectedChapter] || null;
    const ch = selectedSummary?.chapter;

    const allWords = ch ? htmlToWords(ch.html) : [];
    const words = realWords(allWords); // for alignment/blocks (no paraBreaks)
    const blocks = ch ? findHighlightBlocks(words) : [];
    const alignment = ch?.whisperAlignment || [];

    return (
      <div style={{ minHeight:'100vh',background:'var(--cream)' }}>
        <button
          onClick={() => setView('project')}
          aria-label="Back to project"
          title="Back to project"
          style={{ position:'fixed',top:52,left:16,zIndex:1210,width:48,height:48,borderRadius:'50%',border:'1px solid var(--border)',background:'white',color:'var(--text-muted)',fontSize:'1.35rem',fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 6px 16px rgba(0,0,0,0.08)',WebkitAppRegion:'no-drag' }}
        >
          ←
        </button>
        <div style={{ maxWidth:900,margin:'0 auto',padding:'1.5rem 1.5rem 4rem' }}>
          {/* Top bar */}
          <div style={{ WebkitAppRegion:'drag',paddingTop:28 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem',WebkitAppRegion:'no-drag' }}>
              <span />
              <div style={{ display:'flex',gap:8 }}>
                <button onClick={() => exportCsv()} style={btnPrimary}>Export for Engineer</button>
              </div>
            </div>
          </div>

          {/* Chapter selector */}
          <div style={{ marginBottom:'1rem',position:'relative' }}>
            <div style={{ fontSize:'0.72rem',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:6 }}>
              Chapter
            </div>
            <button
              onClick={() => setChapterMenuOpen(open => !open)}
              style={{ width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'10px 14px',borderRadius:12,border:'1px solid var(--border)',background:'white',cursor:'pointer',color:'var(--text)',boxShadow:'0 1px 2px rgba(0,0,0,0.03)' }}
            >
              <div style={{ display:'flex',alignItems:'center',gap:10,minWidth:0 }}>
                <span style={{ fontSize:'0.78rem',fontWeight:700,color:'var(--accent-dark)',fontFamily:'monospace',flex:'0 0 auto' }}>
                  {selectedSummary?.displayNum || '--'}
                </span>
                <span style={{ fontSize:'0.88rem',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                  {selectedSummary?.chapter?.title || 'Select a chapter'}
                </span>
              </div>
              <div style={{ display:'flex',alignItems:'center',gap:10,flex:'0 0 auto' }}>
                <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                  {selectedSummary?.highlightMeta?.length ? selectedSummary.highlightMeta.map(({ cls, hex, count }) => (
                    <span
                      key={`${cls}-${count}`}
                      title={`${hex} (${count})`}
                      style={{ display:'inline-block',width:12,height:12,borderRadius:'50%',background:hex,border:'1px solid rgba(0,0,0,0.12)' }}
                    />
                  )) : (
                    <span style={{ fontSize:'0.72rem',color:'var(--text-light)' }}>No highlights</span>
                  )}
                </div>
                <span style={{ fontSize:'0.85rem',color:'var(--text-muted)' }}>{chapterMenuOpen ? '▲' : '▼'}</span>
              </div>
            </button>
            {chapterMenuOpen && (
              <div style={{ marginTop:8,border:'1px solid var(--border)',borderRadius:12,background:'white',overflow:'hidden',boxShadow:'0 10px 30px rgba(28,28,26,0.08)' }}>
                {chapterSummaries.map(({ chapter, index, displayNum, highlightMeta }) => (
                  <button
                    key={chapter.id}
                    onClick={() => {
                      setSelectedChapter(index);
                      setChapterMenuOpen(false);
                    }}
                    style={{ width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'10px 14px',border:'none',borderBottom:index === chapterSummaries.length - 1 ? 'none' : '1px solid var(--border-light)',background:selectedChapter === index ? 'var(--accent-light)' : 'white',cursor:'pointer',textAlign:'left' }}
                  >
                    <div style={{ display:'flex',alignItems:'center',gap:10,minWidth:0 }}>
                      <span style={{ fontSize:'0.76rem',fontWeight:700,color:'var(--accent-dark)',fontFamily:'monospace',flex:'0 0 auto' }}>
                        {displayNum}
                      </span>
                      <span style={{ fontSize:'0.84rem',fontWeight:selectedChapter === index ? 600 : 500,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                        {chapter.title}
                      </span>
                    </div>
                    <div style={{ display:'flex',alignItems:'center',gap:4,flex:'0 0 auto' }}>
                      {highlightMeta.length ? highlightMeta.map(({ cls, hex, count }) => (
                        <span
                          key={`${cls}-${count}`}
                          title={`${hex} (${count})`}
                          style={{ display:'inline-block',width:11,height:11,borderRadius:'50%',background:hex,border:'1px solid rgba(0,0,0,0.12)' }}
                        />
                      )) : (
                        <span style={{ fontSize:'0.72rem',color:'var(--text-light)' }}>No highlights</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chapter content */}
          {ch && (
            <div style={{ ...card,padding:'18px 20px 20px',overflow:'visible' }}>
              <h3 style={{ fontSize:'1.15rem',fontWeight:600,margin:'0 0 0.65rem',color:'var(--text)' }}>{ch.title}</h3>
              {ch.transcribed && <div style={{ fontSize:'0.72rem',color:'var(--success)',marginBottom:14 }}>✓ Scanned · {ch.whisperMatchQuality}% match (spoken words only) · {blocks.length} insertion points</div>}

              {/* Rendered text with highlights and timestamps */}
              <div style={{ fontSize:'0.95rem',lineHeight:1.8,color:'var(--text)',paddingTop:2 }}>
                {(() => {
                  const elements = [];
                  let blockIdx = 0;
                  let nextBlockStart = blocks[0]?.startIdx ?? Infinity;
                  let realIdx = 0; // tracks index into alignment/blocks (skips paraBreaks)

                  for (let i = 0; i < allWords.length; i++) {
                    const word = allWords[i];

                    // Render paragraph breaks
                    if (word.paraBreak) {
                      elements.push(<br key={`br-${i}`} />);
                      elements.push(<br key={`br2-${i}`} />);
                      continue;
                    }

                    // Render a whole highlighted insertion block so its timestamp can sit above the phrase.
                    if (realIdx === nextBlockStart) {
                      const currentBlock = blocks[blockIdx];
                      const ts = findInsertionTimestamp(alignment, currentBlock);
                      elements.push(
                        <span key={`block-${blockIdx}-${i}`} style={{ display:'inline-block',verticalAlign:'baseline',margin:'0 2px 0 0' }}>
                          <span style={{ display:'block',fontSize:'0.58rem',fontWeight:700,color:'var(--accent-dark)',fontFamily:'monospace',lineHeight:1,marginBottom:1 }}>
                            ▸{formatTimestamp(ts)}
                          </span>
                          <span style={{ padding:'1px 2px',borderRadius:3,background:hlHex(currentBlock.highlight),boxDecorationBreak:'clone',WebkitBoxDecorationBreak:'clone' }}>
                            {currentBlock.words.join(' ')}
                          </span>
                        </span>
                      );
                      elements.push(' ');
                      const wordsToSkip = currentBlock.endIdx - currentBlock.startIdx;
                      let skipped = 0;
                      while (skipped < wordsToSkip && i < allWords.length - 1) {
                        i++;
                        if (!allWords[i].paraBreak) skipped++;
                      }
                      realIdx = currentBlock.endIdx + 1;
                      blockIdx++;
                      nextBlockStart = blocks[blockIdx]?.startIdx ?? Infinity;
                      continue;
                    }

                    elements.push(<span key={i}>{word.text}</span>);
                    elements.push(' ');
                    realIdx++;
                  }
                  return elements;
                })()}
              </div>
            </div>
          )}

          {/* Highlights table for this chapter */}
          {ch && blocks.length > 0 && (
            <div style={{ ...card,padding:'18px 20px 20px',overflow:'visible' }}>
              <h4 style={{ fontSize:'0.9rem',fontWeight:600,margin:'0 0 0.75rem',color:'var(--text)' }}>Insertion points in this chapter ({blocks.length})</h4>
              <div style={{ border:'1px solid var(--border-light)',borderRadius:10,overflow:'hidden' }}>
                <div style={{ display:'grid',gridTemplateColumns:'100px 100px 1fr',padding:'8px 12px',background:'var(--cream)',borderBottom:'1px solid var(--border)',fontSize:'0.68rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)' }}>
                  <span>Insert at</span>
                  <span>Color</span>
                  <span>Dialogue</span>
                </div>
                {blocks.map((block, bi) => {
                  const ts = findInsertionTimestamp(alignment, block);
                  return (
                    <div key={bi} style={{ display:'grid',gridTemplateColumns:'100px 100px 1fr',padding:'8px 12px',borderBottom:'1px solid var(--border-light)',fontSize:'0.82rem',alignItems:'center' }}>
                      <span style={{ fontFamily:'monospace',color:'var(--accent-dark)',fontWeight:500 }}>▸{formatTimestamp(ts)}</span>
                      <span style={{ display:'flex',alignItems:'center',gap:4 }}><span style={{ display:'inline-block',width:12,height:12,borderRadius:3,background:hlHex(block.highlight),border:'1px solid rgba(0,0,0,0.1)' }} /><span style={{ fontFamily:'monospace',fontSize:'0.68rem',color:'var(--text-muted)' }}>{hlHex(block.highlight)}</span></span>
                      <span style={{ color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{block.words.join(' ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
