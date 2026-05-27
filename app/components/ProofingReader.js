'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { getPageNumberForWordIndex } from '../lib/manuscriptPaging';
import { findPdfPageForQuote } from '../lib/pdfPaging';
import InfoTip from './InfoTip';
import AudioDock from './AudioDock';
import { HomeBackPill } from './ReaderChrome';
import {
  renderChapterBody,
  getChapterReaderWordEl,
  READER_BODY_CLASS,
} from './ChapterReader';
// Audio-time ↔ manuscript-word-index helpers. Extracted to a shared
// package so Quill, Duet, and the phone Script mode use the same
// sync math without copy-pasting.
import {
  buildSyncTable as buildDirectSyncTable,
  getMsIdxAtTime,
  getAudioTimeForMsIdx,
} from '../../packages/audio-engine';

function fmtTime(sec){const s=Math.floor(sec),m=Math.floor(s/60);return m+':'+(s%60<10?'0':'')+s%60;}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function rgbToHex(rgb){const m=rgb.match(/\d+/g);if(!m||m.length<3)return null;return '#'+m.slice(0,3).map(n=>parseInt(n).toString(16).padStart(2,'0')).join('');}
function hexDist(a,b){const ah=parseInt(a.slice(1),16),bh=parseInt(b.slice(1),16);return Math.sqrt([16,8,0].map(s=>((ah>>s&255)-(bh>>s&255))**2).reduce((a,b)=>a+b,0));}
function normText(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function nameMatches(a,b){const na=normText(a),nb=normText(b);if(!na||!nb)return false;return na===nb||na.includes(nb)||nb.includes(na);}

function detectNarrator(wordEl, narratorColors, fallback, container) {
  const mappings = narratorColors||[];
  const colorMappings = mappings.filter(nc=>!!nc.hex);
  const charNames=mappings.map(nc=>({name:(nc.characterName||''),nar:nc.narratorName||nc.characterName||fallback})).filter(c=>normText(c.name));
  if (!wordEl||!container) return fallback;
  // 1. Optional highlight colour mapping
  if (colorMappings.length) {
    let el=wordEl;
    while(el&&el!==container){
      const bg=window.getComputedStyle(el).backgroundColor;
      if(bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent'){
        const hex=rgbToHex(bg);
        const SKIP=['#fafaf7','#ffffff','#f5f5f5','#fafafa','#f0fdf4'];
        if(hex&&!SKIP.includes(hex)){
          let best=null,bd=999;
          colorMappings.forEach(nc=>{const d=hexDist(hex,nc.hex);if(d<bd){bd=d;best=nc;}});
          // Slightly looser threshold helps with pastel shades that render a little differently.
          if(best&&bd<85)return best.narratorName||best.characterName||fallback;
        }
      }
      el=el.parentElement;
    }
  }
  // 2. Primary H2 character heading mapping (works even without highlights)
  const h2s=Array.from(container.querySelectorAll('h2'));
  let headingText='';
  let matched=null;
  for(const h2 of h2s){
    if(h2.compareDocumentPosition(wordEl)&Node.DOCUMENT_POSITION_FOLLOWING){
      headingText = h2.textContent.trim();
      const m=charNames.find(c=>nameMatches(headingText,c.name));
      if(m)matched=m.nar;
    }
  }
  if(matched)return matched;
  if(headingText)return headingText;
  return fallback;
}

function detectCharacterLabel(wordEl, narratorColors, fallback, container) {
  const mappings = narratorColors || [];
  if (!wordEl || !container) return fallback;
  const colorMappings = mappings.filter(nc => !!nc.hex);
  if (colorMappings.length) {
    let el = wordEl;
    while (el && el !== container) {
      const bg = window.getComputedStyle(el).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        const hex = rgbToHex(bg);
        const SKIP = ['#fafaf7','#ffffff','#f5f5f5','#fafafa','#f0fdf4'];
        if (hex && !SKIP.includes(hex)) {
          let best = null;
          let bd = 999;
          colorMappings.forEach(nc => {
            const d = hexDist(hex, nc.hex);
            if (d < bd) { bd = d; best = nc; }
          });
          if (best && bd < 85) return best.characterName || best.narratorName || fallback;
        }
      }
      el = el.parentElement;
    }
  }
  const heading = detectSceneHeading(wordEl, container, fallback);
  if (heading) {
    const matched = mappings.find(nc => nameMatches(heading, nc.characterName));
    if (matched) return matched.characterName || matched.narratorName || heading;
  }
  return heading || fallback;
}

function getNarratorForCharacterName(characterName, narratorColors, fallback = '') {
  const matched = (narratorColors || []).find(nc => nameMatches(characterName, nc.characterName));
  return matched?.narratorName || matched?.characterName || fallback;
}

function detectSceneHeading(wordEl, container, fallback = '') {
  if (!wordEl || !container) return fallback;
  const h2s = Array.from(container.querySelectorAll('h2'));
  let headingText = fallback;
  for (const h2 of h2s) {
    if (h2.compareDocumentPosition(wordEl) & Node.DOCUMENT_POSITION_FOLLOWING) {
      const nextText = h2.textContent.trim();
      if (nextText) headingText = nextText;
    }
  }
  return headingText || fallback;
}

function wrapWords(container){
  const words=[];let idx=0;
  function walk(node){
    if(node.nodeType===3){
      const txt=node.textContent;if(!txt.trim())return;
      const parts=txt.split(/(\s+)/);const frag=document.createDocumentFragment();
      parts.forEach(p=>{if(!p)return;if(/^\s+$/.test(p)){frag.appendChild(document.createTextNode(p));return;}
        const sp=document.createElement('span');sp.className='w';sp.dataset.idx=idx;sp.textContent=p;words.push(p);idx++;frag.appendChild(sp);});
      node.parentNode.replaceChild(frag,node);
    }else if(node.nodeType===1){Array.from(node.childNodes).forEach(walk);}
  }
  Array.from(container.childNodes).forEach(walk);return words;
}

function getSentence(words,idx){
  let s=idx,e=idx;
  while(s>0&&!/[.!?]['"]?$/.test(words[s-1])&&idx-s<50)s--;
  while(e<words.length-1&&!/[.!?]['"]?$/.test(words[e])&&e-idx<50)e++;
  return{start:s,end:e};
}

function withChapterPrerollHtml(section, includePreroll){
  if(!includePreroll) return String(section?.html || '');
  if(!section?.isFirstSectionInChapter) return String(section?.html || '');
  const rawHtml = String(section?.html || '');
  const chapterTitle = String(section?.chapterTitle || '').trim();
  if(!chapterTitle) return rawHtml;
  const firstH1 = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if(firstH1){
    const existing = String(firstH1[1] || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
    if(existing === chapterTitle.toLowerCase()) return rawHtml;
  }
  return `<h1 class="doc-h1">${esc(chapterTitle)}</h1>${rawHtml}`;
}

function normWord(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9']+/g,'').trim();
}

function parseSrtTime(value){
  const m = String(value||'').trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if(!m) return null;
  const hh = Number(m[1]) || 0;
  const mm = Number(m[2]) || 0;
  const ss = Number(m[3]) || 0;
  const ms = Number(m[4]) || 0;
  return hh * 3600 + mm * 60 + ss + (String(m[4]).length === 2 ? ms / 100 : ms / 1000);
}

function parseSrtCues(srtText){
  const text = String(srtText||'').replace(/\r/g,'');
  const blocks = text.split(/\n\s*\n/).map(b=>b.trim()).filter(Boolean);
  const cues = [];
  blocks.forEach(block=>{
    const lines = block.split('\n').map(l=>l.trim()).filter(Boolean);
    const timeLine = lines.find(l=>l.includes('-->'));
    if(!timeLine) return;
    const [startRaw,endRaw] = timeLine.split('-->').map(s=>s.trim());
    const start = parseSrtTime(startRaw);
    const end = parseSrtTime(endRaw);
    if(start == null || end == null || end <= start) return;
    const textLines = lines.filter(l=>l!==timeLine && !/^\d+$/.test(l));
    const cueText = textLines.join(' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    if(!cueText) return;
    cues.push({ start, end, text: cueText });
  });
  return cues;
}

function buildSrtAnchors(manuscriptWords, srtText){
  const cues = parseSrtCues(srtText);
  if(!cues.length) return [];
  const msNorm = manuscriptWords.map(normWord);
  if(!msNorm.length) return [];
  const anchors = [];
  let cursor = 0;
  for(const cue of cues){
    const cueWords = cue.text
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .map(normWord)
      .filter(w=>w && w.length >= 1)
      .slice(0, 12);
    if(cueWords.length < 1) continue;

    const searchStart = cursor;
    const searchEnd = Math.min(msNorm.length - 1, searchStart + 420);
    let bestStart = -1;
    let bestEnd = -1;
    let bestScore = 0;

    for(let i=searchStart;i<=searchEnd;i++){
      let score = 0;
      let j = 0;
      let k = i;
      while(j < cueWords.length && k < msNorm.length && k <= i + 220){
        if(msNorm[k] === cueWords[j] || msNorm[k].includes(cueWords[j]) || cueWords[j].includes(msNorm[k])){
          score += 1;
          j += 1;
        }
        k += 1;
      }
      if(score > bestScore){
        bestScore = score;
        bestStart = i;
        bestEnd = k - 1;
      }
    }

    const minNeeded = Math.max(1, Math.ceil(Math.min(cueWords.length, 8) * 0.25));
    if(bestStart >= 0 && bestScore >= minNeeded){
      const anchorIdx = Math.max(0, Math.min(msNorm.length - 1, Math.round((bestStart + bestEnd) / 2)));
      const anchorTime = (cue.start + cue.end) / 2;
      anchors.push({ t: anchorTime, i: anchorIdx });
      cursor = Math.max(cursor, bestStart + 1);
      if(cursor >= msNorm.length) break;
    }
  }

  const cleaned = [];
  for(const a of anchors){
    const prev = cleaned[cleaned.length - 1];
    if(!prev){ cleaned.push(a); continue; }
    if(a.t <= prev.t || a.i <= prev.i) continue;
    if((a.t - prev.t) < 0.12) continue;
    cleaned.push(a);
  }

  return cleaned.length >= 1 ? cleaned : [];
}

function getSrtAnchoredIndex(anchors, displayTime, fallback){
  if(!anchors?.length) return fallback;
  let left = null;
  let right = null;
  for(const a of anchors){
    if(a.t <= displayTime) left = a;
    if(a.t >= displayTime){ right = a; break; }
  }
  if(left && right && left !== right && right.t > left.t){
    const slope = (right.i - left.i) / (right.t - left.t);
    // Guardrail: reject impossible speeds that cause runaway jumps.
    if(slope < 0.35 || slope > 6.5) return fallback;
    return Math.round(left.i + (displayTime - left.t) * slope);
  }
  if(left) return Math.round(left.i + (displayTime - left.t) * 2.1);
  if(right) return Math.round(right.i - (right.t - displayTime) * 2.1);
  return fallback;
}

function getWhisperAnchoredIndex(anchors, displayTime, fallback){
  if(!anchors?.length) return fallback;
  let left = null;
  let right = null;
  for(const a of anchors){
    if(a.t <= displayTime) left = a;
    if(a.t >= displayTime){ right = a; break; }
  }
  if(left && right && left !== right && right.t > left.t){
    const slope = (right.i - left.i) / (right.t - left.t);
    if(slope < 0.2 || slope > 9) return fallback;
    return Math.round(left.i + (displayTime - left.t) * slope);
  }
  if(left) return Math.round(left.i + (displayTime - left.t) * 2.1);
  if(right) return Math.round(right.i - (right.t - displayTime) * 2.1);
  return fallback;
}

// buildDirectSyncTable, getMsIdxAtTime, getAudioTimeForMsIdx moved
// to packages/audio-engine/index.js so every mode shares one engine.
// Imported at the top of this file.

function looseWordEq(a, b){
  const na = normWord(a);
  const nb = normWord(b);
  if(!na || !nb) return false;
  if(na === nb) return true;
  if(na.length >= 4 && nb.length >= 4 && (na.includes(nb) || nb.includes(na))) return true;
  return false;
}

function sequenceSimilarity(msWords, txWords){
  const ms = (msWords || []).map(normWord).filter(Boolean);
  const tx = (txWords || []).map(normWord).filter(Boolean);
  if(!ms.length || !tx.length) return 0;
  let i = 0;
  let j = 0;
  let match = 0;
  while(i < ms.length && j < tx.length){
    if(looseWordEq(ms[i], tx[j])) { match++; i++; j++; continue; }
    if(j + 1 < tx.length && looseWordEq(ms[i], tx[j + 1])) { j++; continue; }
    if(i + 1 < ms.length && looseWordEq(ms[i + 1], tx[j])) { i++; continue; }
    i++;
    j++;
  }
  return match / Math.max(ms.length, tx.length);
}

function buildWhisperGuideText(whisperWords, wi){
  const words = Array.isArray(whisperWords) ? whisperWords : [];
  if(!words.length || !Number.isFinite(wi) || wi < 0 || wi >= words.length) return '';
  const start = Math.max(0, wi - 7);
  const end = Math.min(words.length - 1, wi + 7);
  return words.slice(start, end + 1).map(w => String(w?.word || '')).filter(Boolean).join(' ');
}

function getWhisperWordIndexAtTime(whisperWords, timeSec){
  const words = Array.isArray(whisperWords) ? whisperWords : [];
  if(!words.length || !Number.isFinite(timeSec)) return null;
  let lo = 0;
  let hi = words.length - 1;
  let best = 0;
  while(lo <= hi){
    const mid = (lo + hi) >> 1;
    const start = Number(words[mid]?.start) || 0;
    if(start <= timeSec){
      best = mid;
      lo = mid + 1;
    }else{
      hi = mid - 1;
    }
  }
  const start = Number(words[best]?.start) || 0;
  const end = Number(words[best]?.end) || start + 0.25;
  if(timeSec >= start && timeSec <= end) return best;
  if(best + 1 < words.length){
    const nextStart = Number(words[best + 1]?.start) || start;
    if(Math.abs(nextStart - timeSec) < Math.abs(timeSec - end)) return best + 1;
  }
  return best;
}

function clearInlineTranscriptLines(container){
  if(!container) return;
  container.querySelectorAll('.w-suboverlay').forEach(el => el.remove());
}

function buildInlineTranscriptLines(container, msWords, wordEls, alignment, whisperWords){
  clearInlineTranscriptLines(container);
  return 0;
}

const cbtn=(style={})=>({padding:'6px 12px',borderRadius:8,fontSize:'0.78rem',border:'1px solid var(--border)',background:'white',color:'var(--text)',cursor:'pointer',...style});
const SYNC_RATE_BOOST = 1.18;
const SYNC_PLAYBACK_CALIBRATION = 0.925;
const WHISPER_LEAD_SEC = 0.0;

export default function ProofingReader({ section, audioUrl, narratorColors, manuscriptPaging = null, pdfPaging = null, pageNumberAdjustment = 0, includeChapterPreroll = true, defaultListeningSpeed = 2, onSaveFlags, onBack, canPrevChapter = false, canNextChapter = false, onPrevChapter, onNextChapter, sceneOptions = [], onJumpToScene = null, usesCustomDragRegion = false }) {
  const isMacElectron = typeof window !== 'undefined' && !!window.electron && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const [flags, setFlags] = useState(section.flags||[]);
  const [flagPanel, setFlagPanel] = useState(null);
  const [flagDraft, setFlagDraft] = useState(null);
  const [sheetCopyStatus, setSheetCopyStatus] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [saved, setSaved] = useState(false);
  const [syncSpeed, setSyncSpeed] = useState(1);
  const [listenSpeed, setListenSpeed] = useState(defaultListeningSpeed || 2);
  const [useWhisperSync, setUseWhisperSync] = useState(false);
  const [followPlayback, setFollowPlayback] = useState(true);
  const [whisperGuideText, setWhisperGuideText] = useState('');
  const [activeSceneHeading, setActiveSceneHeading] = useState(section.title || section.characterName || section.chapterTitle || '');
  const [activeCharacterLabel, setActiveCharacterLabel] = useState(section.characterName || section.title || section.chapterTitle || '');
  const [activeNarratorLabel, setActiveNarratorLabel] = useState(section.narratorName || section.characterName || 'Narrator');
  const [wordAction, setWordAction] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState([]);
  const [searchHitIdx, setSearchHitIdx] = useState(0);
  const searchInputRef = useRef(null);

  const audioRef=useRef(null),textRef=useRef(null),rafRef=useRef(null);
  const wordElsRef=useRef([]),msWordsRef=useRef([]),wpsRef=useRef(0);
  const curRef=useRef(0),lastRef=useRef(-1),offRef=useRef(0);
  const syncTableRef=useRef([]);
  const useWhisperSyncRef=useRef(false);
  const whisperGuideTextRef=useRef('');
  const whisperGuideUpdateAtRef=useRef(0);
  const syncSpeedRef=useRef(1),playbackRateRef=useRef(1);
  const followPlaybackRef=useRef(true);
  const noteRef=useRef(null);
  const manualScrollUntilRef=useRef(0);
  const forceFollowUntilRef=useRef(0);
  const autoScrollingRef=useRef(false);
  const activeSceneHeadingRef=useRef(section.title || section.characterName || section.chapterTitle || '');
  const activeCharacterLabelRef=useRef(section.characterName || section.title || section.chapterTitle || '');
  const activeNarratorLabelRef=useRef(section.narratorName || section.characterName || 'Narrator');

  useEffect(()=>{
    useWhisperSyncRef.current = useWhisperSync;
  },[useWhisperSync]);

  useEffect(()=>{
    followPlaybackRef.current = followPlayback;
  },[followPlayback]);

  function getEffectiveWordRate(){
    const pbr = Math.max(0.25, playbackRateRef.current || 1);
    const speed = Math.max(0.25, syncSpeedRef.current || 1);
    return wpsRef.current * (speed / pbr) * SYNC_RATE_BOOST * SYNC_PLAYBACK_CALIBRATION;
  }

  function clampAudioTimeValue(rawValue, duration) {
    const safeDuration = Number.isFinite(Number(duration)) ? Number(duration) : 0;
    const maxTime = safeDuration > 0.2 ? safeDuration - 0.2 : safeDuration;
    return Math.max(0, Math.min(maxTime, Number(rawValue) || 0));
  }

  function getDisplayAudioTime(currentTime){ return currentTime; }

  // Render the manuscript through the shared ChapterReader body. The
  // resulting DOM has data-cr-unit spans, queryable via the shared
  // getChapterReaderWordEl helper. All of Proof's audio sync / narrator
  // detection / flag pin code reads those spans via .reader-text +
  // data-cr-unit selectors, so it keeps working without copying the
  // word-wrapping logic.
  const renderedBody = useMemo(() => renderChapterBody({
    chapter: { id: section?.id, textHtml: withChapterPrerollHtml(section, includeChapterPreroll) },
    tone: 'proof',
  }), [section?.id, section?.html, includeChapterPreroll]);

  // Re-init section
  useEffect(()=>{
    if(!textRef.current||!section)return;
    // The DOM is populated by React from renderedBody. We just need to
    // cache the word spans for the audio-sync hot path + extract their
    // text for msWordsRef.
    wordElsRef.current = Array.from(textRef.current.querySelectorAll('[data-cr-unit]'));
    msWordsRef.current = wordElsRef.current.map(el => el.textContent || '');
    const alignment = Array.isArray(section.whisperAlignment) ? section.whisperAlignment : [];
    const syncTable = buildDirectSyncTable(alignment);
    syncTableRef.current = syncTable;
    const hasWhisper = syncTable.length >= 4;
    setUseWhisperSync(hasWhisper);
    useWhisperSyncRef.current = hasWhisper;
    clearInlineTranscriptLines(textRef.current);
    whisperGuideTextRef.current = '';
    setWhisperGuideText('');
    lastRef.current=-1;curRef.current=0;offRef.current=0;
    manualScrollUntilRef.current = 0;
    forceFollowUntilRef.current = 0;
    const heading = section.title || section.characterName || section.chapterTitle || '';
    activeSceneHeadingRef.current = heading;
    setActiveSceneHeading(heading);
    const character = section.characterName || section.title || section.chapterTitle || heading;
    activeCharacterLabelRef.current = character;
    setActiveCharacterLabel(character);
    const narrator = sceneMappedNarrator || section.narratorName || defaultNarrator;
    activeNarratorLabelRef.current = narrator;
    setActiveNarratorLabel(narrator);
    setWordAction(null);
    setFlags(section.flags||[]);
  },[section.id, section.whisperAlignment, section.whisperWords, includeChapterPreroll]);

  // Mark existing flags
  useEffect(()=>{
    (section.flags||[]).forEach(fl=>{if(wordElsRef.current[fl.idx])wordElsRef.current[fl.idx].classList.add('w-flagged');});
  },[section.id]);

  useEffect(()=>{
    const audio=audioRef.current;if(!audio||!audioUrl)return;
    audio.preload = 'auto';
    audio.src=audioUrl;
    try { audio.load(); } catch {}
    const onMeta=()=>{
      const proofWordCount = Number(section.proofWordCount) || msWordsRef.current.length;
      wpsRef.current = audio.duration ? (proofWordCount / audio.duration) : 0;
      const initialWordOffset = Math.max(0, Number(section.proofInitialWordOffset) || 0);
      const requestedStart = Number(section.proofStartSec);
      const effRate = getEffectiveWordRate();
      const hasTranscriptSync = syncTableRef.current.length >= 4;
      let nextStart = 0;
      let nextOffset = 0;

      if (Number.isFinite(requestedStart) && requestedStart > 0) {
        nextStart = clampAudioTimeValue(requestedStart, audio.duration);
        nextOffset = hasTranscriptSync ? 0 : initialWordOffset - Math.round(nextStart * effRate);
      } else if (hasTranscriptSync && initialWordOffset > 0) {
        const exactStart = getAudioTimeForMsIdx(syncTableRef.current, initialWordOffset);
        if (Number.isFinite(exactStart)) {
          nextStart = clampAudioTimeValue(exactStart, audio.duration);
          nextOffset = 0;
        } else if (wpsRef.current > 0) {
          const estimatedStart = clampAudioTimeValue(initialWordOffset / wpsRef.current, audio.duration);
          nextStart = estimatedStart;
          nextOffset = initialWordOffset - Math.round(estimatedStart * effRate);
        }
      } else if (initialWordOffset > 0 && wpsRef.current > 0) {
        const estimatedStart = clampAudioTimeValue(initialWordOffset / wpsRef.current, audio.duration);
        nextStart = estimatedStart;
        nextOffset = initialWordOffset - Math.round(estimatedStart * effRate);
      }

      audio.currentTime = nextStart;
      offRef.current = nextOffset;
      audio.playbackRate = Math.max(0.5, Math.min(3, defaultListeningSpeed || 2));
      startSync();
    };
    audio.addEventListener('loadedmetadata',onMeta,{once:true});
    return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[audioUrl, section.id, defaultListeningSpeed]);

  useEffect(()=>{
    const audio = audioRef.current;
    if(!audio) return;
    const handlePlayState = ()=>startSync();
    audio.addEventListener('play', handlePlayState);
    audio.addEventListener('pause', handlePlayState);
    audio.addEventListener('ended', handlePlayState);
    return ()=>{
      audio.removeEventListener('play', handlePlayState);
      audio.removeEventListener('pause', handlePlayState);
      audio.removeEventListener('ended', handlePlayState);
    };
  },[audioUrl, section.id]);

  useEffect(()=>{
    const audio = audioRef.current;
    if(!audio) return;
    const onRateChange = ()=>{
      const pbr = Math.max(0.25, Math.min(3, Number(audio.playbackRate) || 1));
      playbackRateRef.current = pbr;
      syncSpeedRef.current = pbr;
      setSyncSpeed(pbr);
      setListenSpeed(pbr);
    };
    onRateChange();
    audio.addEventListener('ratechange', onRateChange);
    return ()=>audio.removeEventListener('ratechange', onRateChange);
  },[audioUrl, section.id]);

  useEffect(()=>{
    const audio = audioRef.current;
    if(!audio) return;
    const handleSeek = ()=>{
      if(!followPlayback) return;
      manualScrollUntilRef.current = 0;
      forceFollowUntilRef.current = Date.now() + 1400;
      startSync();
    };
    audio.addEventListener('seeking', handleSeek);
    audio.addEventListener('seeked', handleSeek);
    return ()=>{
      audio.removeEventListener('seeking', handleSeek);
      audio.removeEventListener('seeked', handleSeek);
    };
  },[audioUrl, section.id, followPlayback]);

  useEffect(()=>{
    if(!followPlayback) return;
    manualScrollUntilRef.current = 0;
    forceFollowUntilRef.current = Date.now() + 1200;
    scrollTo(curRef.current, true);
  },[followPlayback]);

  useEffect(()=>{
    if(!wordAction) return;
    function handlePointerDown(e){
      if(e.target?.closest?.('.reader-word-action')) return;
      if(e.target?.closest?.('.w')) return;
      setWordAction(null);
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return ()=>document.removeEventListener('pointerdown', handlePointerDown, true);
  },[wordAction]);

  useEffect(()=>{
    const timer = window.setTimeout(()=>updateActiveSceneMetaFromViewport(), 0);
    return ()=>window.clearTimeout(timer);
  },[section.id]);

  function updateActiveSceneMetaFromWord(wordEl){
    if(!wordEl || !textRef.current) return;
    const nextHeading = detectSceneHeading(wordEl, textRef.current, section.title || section.characterName || section.chapterTitle || '');
    if(nextHeading && nextHeading !== activeSceneHeadingRef.current){
      activeSceneHeadingRef.current = nextHeading;
      setActiveSceneHeading(nextHeading);
    }
    const nextCharacter = detectCharacterLabel(wordEl, narratorColors, section.characterName || nextHeading || section.title || section.chapterTitle || '', textRef.current);
    if(nextCharacter && nextCharacter !== activeCharacterLabelRef.current){
      activeCharacterLabelRef.current = nextCharacter;
      setActiveCharacterLabel(nextCharacter);
    }
    const nextNarrator = getNarratorForCharacterName(nextCharacter, narratorColors, detectNarrator(wordEl, narratorColors, defaultNarrator, textRef.current) || defaultNarrator);
    if(nextNarrator && nextNarrator !== activeNarratorLabelRef.current){
      activeNarratorLabelRef.current = nextNarrator;
      setActiveNarratorLabel(nextNarrator);
    }
  }

  function updateActiveSceneMetaFromViewport(){
    const container = textRef.current;
    if(!container) return;
    const headings = Array.from(container.querySelectorAll('h2'));
    if(!headings.length) return;
    const marker = container.scrollTop + 86;
    let candidate = headings[0];
    for(const h2 of headings){
      if(h2.offsetTop <= marker) candidate = h2;
      else break;
    }
    const nextHeading = candidate?.textContent?.trim();
    if(!nextHeading) return;
    if(nextHeading !== activeSceneHeadingRef.current){
      activeSceneHeadingRef.current = nextHeading;
      setActiveSceneHeading(nextHeading);
    }
    const nextCharacter = (narratorColors || []).find(nc => nameMatches(nextHeading, nc.characterName))?.characterName || nextHeading;
    if(nextCharacter !== activeCharacterLabelRef.current){
      activeCharacterLabelRef.current = nextCharacter;
      setActiveCharacterLabel(nextCharacter);
    }
    const nextNarrator = getNarratorForCharacterName(nextCharacter, narratorColors, activeNarratorLabelRef.current || defaultNarrator);
    if(nextNarrator && nextNarrator !== activeNarratorLabelRef.current){
      activeNarratorLabelRef.current = nextNarrator;
      setActiveNarratorLabel(nextNarrator);
    }
  }

  function startSync(){
    if(rafRef.current)cancelAnimationFrame(rafRef.current);
    const tick=()=>{
      const a=audioRef.current;
      if(!a){
        rafRef.current = null;
        return;
      }
      const rate=getEffectiveWordRate();
      const displayTime = getDisplayAudioTime(a.currentTime);
      const naiveRounded = Math.round(displayTime * rate);
      let rawIdx;
      if (useWhisperSyncRef.current && syncTableRef.current.length >= 4) {
        const alignedIndex = getMsIdxAtTime(syncTableRef.current, displayTime, naiveRounded);
        rawIdx = alignedIndex + offRef.current;
      } else {
        rawIdx = naiveRounded + offRef.current;
      }
      // Update guide text independently (display only — does not affect sync).
      if (section.whisperWords?.length) {
        const whisperTime = Math.max(0, Math.min((a.duration || 0), displayTime + WHISPER_LEAD_SEC));
        const guideWi = getWhisperWordIndexAtTime(section.whisperWords, whisperTime);
        const nextGuideText = Number.isFinite(guideWi) ? buildWhisperGuideText(section.whisperWords, guideWi) : '';
        if (nextGuideText !== whisperGuideTextRef.current) {
          const now = performance.now();
          if ((now - whisperGuideUpdateAtRef.current) > 110) {
            whisperGuideTextRef.current = nextGuideText;
            whisperGuideUpdateAtRef.current = now;
            setWhisperGuideText(nextGuideText);
          }
        }
      }
      const inRange=rawIdx>=0&&rawIdx<msWordsRef.current.length;
      const idx=inRange?rawIdx:Math.min(msWordsRef.current.length-1,Math.max(0,rawIdx));
      if(!inRange){
        const els=wordElsRef.current;
        if(els[lastRef.current])els[lastRef.current].classList.remove('w-cur');
        lastRef.current=-1;
        curRef.current=idx;
        if(!a.paused || a.seeking) rafRef.current=requestAnimationFrame(tick);
        else rafRef.current = null;
        return;
      }
      if(idx!==lastRef.current){
        const els=wordElsRef.current;
        if(els[lastRef.current])els[lastRef.current].classList.remove('w-cur');
        if(els[idx]){
          els[idx].classList.add('w-cur');
          updateActiveSceneMetaFromWord(els[idx]);
          scrollTo(idx);
        }
        lastRef.current=idx;curRef.current=idx;
      }
      if(!a.paused || a.seeking) rafRef.current=requestAnimationFrame(tick);
      else rafRef.current = null;
    };
    rafRef.current=requestAnimationFrame(tick);
  }

  function markManualScroll(){ manualScrollUntilRef.current = Date.now() + 5000; }
  function scrollTo(idx, force = false){
    const shouldForce = force || Date.now() < forceFollowUntilRef.current;
    if(!followPlaybackRef.current && !shouldForce) return;
    if(!shouldForce && Date.now() < manualScrollUntilRef.current) return;
    const el=wordElsRef.current[idx],c=textRef.current;if(!el||!c)return;
    const eT=el.offsetTop,ch=c.clientHeight,sc=c.scrollTop;
    if(eT<sc+80||eT>sc+ch-100){
      autoScrollingRef.current = true;
      c.scrollTo({top:eT-ch*0.38,behavior:'smooth'});
      setTimeout(()=>{ autoScrollingRef.current = false; }, 220);
    }
  }
  function jumpSec(d){
    const a=audioRef.current;
    if(!a)return;
    const duration=Number.isFinite(Number(a.duration))?Number(a.duration):0;
    const next=Math.max(0,Math.min(duration||0,(Number(a.currentTime)||0)+d));
    const wasPlaying=!!(a&&!a.paused&&!a.ended);
    try{
      if(typeof a.fastSeek==='function')a.fastSeek(next);
      else a.currentTime=next;
    }catch{
      try{a.currentTime=next;}catch{}
    }
    manualScrollUntilRef.current = 0;
    forceFollowUntilRef.current = Date.now() + 1400;
    startSync();
    if(wasPlaying){
      const resume=()=>a.play().catch(()=>{});
      if(a.seeking)a.addEventListener('seeked',resume,{once:true});
      else resume();
    }
  }
  function nudge(n){offRef.current+=n;}
  function applyPlaybackSpeed(v){
    const clamped = Math.max(0.5, Math.min(3, Number(v) || 1));
    const audio = audioRef.current;
    if(audio){
      audio.playbackRate = clamped;
      playbackRateRef.current = clamped;
      syncSpeedRef.current = clamped;
      setSyncSpeed(clamped);
    }
    setListenSpeed(clamped);
  }

  function stepPlaybackSpeed(delta){
    const current = Number(audioRef.current?.playbackRate) || Number(listenSpeed) || 1;
    const next = Math.round((current + delta) * 10) / 10;
    applyPlaybackSpeed(next);
  }

  function hasClickableWordSync(){
    const syncTable = syncTableRef.current;
    return Array.isArray(syncTable) && syncTable.length >= 4;
  }

  function seekMsWordFromClick(idx){
    const audio = audioRef.current;
    if(!audio || !Number.isFinite(idx)) return null;
    if(!hasClickableWordSync()) return null;
    const syncTable = syncTableRef.current;
    const targetTime = getAudioTimeForMsIdx(syncTable, idx);
    if(targetTime != null && Number.isFinite(targetTime)){
      audio.currentTime = clampAudioTimeValue(targetTime, audio.duration);
      offRef.current = 0;
      manualScrollUntilRef.current = 0;
      forceFollowUntilRef.current = Date.now() + 1400;
      startSync();
      return Number(audio.currentTime) || 0;
    }
    return null;
  }
  function setSyncSpeedFromSlider(v){
    const speed = Math.max(0.25, Math.min(4, Number(v) || 1));
    syncSpeedRef.current = speed;
    setSyncSpeed(speed);
  }

  function stepSyncSpeed(delta){
    setSyncSpeedFromSlider((syncSpeedRef.current || 1) + delta);
  }

  const mappedNarrator = (narratorColors || []).find(nc => (
    nameMatches(section.characterName, nc.characterName) ||
    nameMatches(section.chapterTitle, nc.characterName) ||
    nameMatches(section.title, nc.characterName)
  ));
  const sceneMappedNarrator = mappedNarrator?.narratorName || mappedNarrator?.characterName || '';

  // Default narrator: mapped scene narrator first, then explicit section narrator, then section character.
  const defaultNarrator =
    sceneMappedNarrator ||
    section.narratorName ||
    section.characterName ||
    'Narrator';

  function getChapterAudioMeta(){
    const match = String(section.html||'').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const chapterFromH1 = match ? String(match[1]).replace(/<[^>]+>/g, '').trim() : '';
    return {
      chapterName: section.chapterTitle || chapterFromH1 || '',
      audioName: section.audioFileName || '',
    };
  }

  function getAutoPageNumber(wordIdx, quoteText){
    // Marie 2026-05-26: PDF-rendered page map is the ONLY accepted source.
    // No 250-words-per-page estimates anywhere. If we can't find an exact
    // page, the field comes back as '?' so it's obvious the book needs a
    // PDF. Marie 2026-05-26 (later): book.pageNumberAdjustment lets the
    // user nudge ±N pages when LibreOffice rendering drifts from Word.
    const idx = Math.max(0, Number(wordIdx) || 0);
    const effectivePdfPaging = pdfPaging || section.pdfPaging;
    const hasPdfPageMap = Array.isArray(effectivePdfPaging?.pages) && effectivePdfPaging.pages.length > 0;
    const sectionWordStart = Number(section.manuscriptWordStart);
    const proofInitialWordOffset = Math.max(0, Number(section.proofInitialWordOffset) || 0);
    const manuscriptWordIdx = Number.isFinite(sectionWordStart)
      ? Math.max(0, sectionWordStart - proofInitialWordOffset + idx)
      : null;
    const hasExactManuscriptMap = Array.isArray(manuscriptPaging?.pageMap) && manuscriptPaging.pageMap.length > 1;
    const hintPageNumber = manuscriptWordIdx != null && hasExactManuscriptMap
      ? getPageNumberForWordIndex(manuscriptWordIdx, manuscriptPaging.pageMap)
      : null;
    const pdfMatch = findPdfPageForQuote(quoteText, effectivePdfPaging, hintPageNumber);
    const adjustment = Number(section.pageNumberAdjustment) || 0;

    if (pdfMatch?.pageNumber) {
      return String(pdfMatch.pageNumber + adjustment);
    }

    if (hasExactManuscriptMap && manuscriptWordIdx != null) {
      return String(getPageNumberForWordIndex(manuscriptWordIdx, manuscriptPaging.pageMap) + adjustment);
    }

    // No exact map available — flag it. Marie's rule: never guess.
    return '?';
  }

  function buildSheetCells(draft, timestampSec){
    const { chapterName, audioName } = getChapterAudioMeta();
    return [
      chapterName,
      audioName,
      (draft?.page || '#').trim() || '#',
      fmtTime(timestampSec || 0),
      (draft?.narrator || defaultNarrator).trim() || defaultNarrator,
      draft?.type || 'Edit',
      draft?.quote || '',
      draft?.note || '',
    ];
  }

  function clearDraftWordFlag(idx){
    const targetIdx = Number(idx);
    if (!Number.isFinite(targetIdx)) return;
    const stillSaved = flags.some(fl => Number(fl?.idx) === targetIdx);
    if (!stillSaved && wordElsRef.current[targetIdx]) {
      wordElsRef.current[targetIdx].classList.remove('w-flagged');
    }
  }

  function copySheetRow(){
    if(!flagPanel || !flagDraft) return;
    const row = buildSheetCells(flagDraft, flagPanel.ts).map(v=>String(v||'').replace(/\r?\n/g,' ')).join('\t');
    const done = ()=>{ setSheetCopyStatus('Copied row for Sheets'); setTimeout(()=>setSheetCopyStatus(''),1200); };
    const fail = ()=>{ setSheetCopyStatus('Copy failed'); setTimeout(()=>setSheetCopyStatus(''),1400); };
    if(navigator.clipboard?.writeText){
      navigator.clipboard.writeText(row).then(done).catch(fail);
      return;
    }
    try{
      const ta=document.createElement('textarea');
      ta.value=row;
      ta.setAttribute('readonly','');
      ta.style.position='absolute';
      ta.style.left='-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    }catch{ fail(); }
  }

  function openFlagAtIndex(targetIdx, timestampSec){
    const words=msWordsRef.current;
    if(!words.length) return;
    const rawIdx = Math.max(0, Math.min(words.length - 1, Number(targetIdx) || 0));
    const idx=rawIdx;
    const inRange=idx>=0&&idx<words.length;
    const sent=inRange?getSentence(words,idx):null;
    const before=inRange?words.slice(sent.start,idx).join(' '):'';
    const after=inRange?words.slice(idx+1,sent.end+1).join(' '):'';
    const sentHtml=inRange?((before?before+' ':'')+'<em class="fw">'+esc(words[idx])+'</em>'+(after?' '+after:'')):'';
    const sentPlain=inRange?words.slice(sent.start,sent.end+1).join(' '):'';
    const detectedNar=inRange?detectNarrator(wordElsRef.current[idx],narratorColors,defaultNarrator,textRef.current):defaultNarrator;
    const autoNar=sceneMappedNarrator||detectedNar;
    const autoPage=getAutoPageNumber(idx, sentPlain);
    if(flagPanel) clearDraftWordFlag(flagPanel.idx);
    setWordAction(null);
    if(wordElsRef.current[idx])wordElsRef.current[idx].classList.add('w-flagged');
    setFlagPanel({ts:Math.max(0, Number(timestampSec) || 0),sentHtml,sentPlain,idx,autoNar,autoPage});
    setFlagDraft({ page:autoPage, note:'', narrator:autoNar, type:'Edit', quote:sentPlain });
    setSheetCopyStatus('');
    setTimeout(()=>noteRef.current?.focus(),60);
  }

  function openFlag(){
    const a=audioRef.current;if(!a)return;
    const rate=getEffectiveWordRate();
    const displayTime = getDisplayAudioTime(a.currentTime);
    const naiveRounded = Math.round(displayTime * rate);
    const rawIdx = useWhisperSyncRef.current && syncTableRef.current.length >= 4
      ? getMsIdxAtTime(syncTableRef.current, displayTime, naiveRounded) + offRef.current
      : naiveRounded + offRef.current;
    const words = msWordsRef.current;
    if(!words.length) return;
    const idx = Math.min(words.length - 1, Math.max(0, rawIdx));
    openFlagAtIndex(idx, a.currentTime);
  }

  function saveFlag(){
    if(!flagPanel||!flagDraft)return;
    const editedQuote = (flagDraft.quote || flagPanel.sentPlain || '').trim();
    const f={idx:flagPanel.idx,ts:flagPanel.ts,sentHtml:esc(editedQuote),sentPlain:editedQuote,narrator:(flagDraft.narrator||flagPanel.autoNar||defaultNarrator).trim()||defaultNarrator,page:(flagDraft.page||flagPanel.autoPage||'#').trim()||'#',note:(flagDraft.note||'').trim(),type:flagDraft.type||'Edit'};
    setFlags(prev=>{
      const next=[...prev,f];
      onSaveFlags(null,section.id,next);
      return next;
    });
    setSaved(true);setTimeout(()=>setSaved(false),1200);
    setFlagDraft(null);
    setFlagPanel(null);
  }

  function dismissFlag(){
    if(flagPanel) clearDraftWordFlag(flagPanel.idx);
    setFlagDraft(null);
    setSheetCopyStatus('');
    setFlagPanel(null);
  }

  function openWordActionMenu(idx, wordEl){
    if(!Number.isFinite(idx) || !wordEl) return;
    const rect = wordEl.getBoundingClientRect();
    const menuWidth = 186;
    const centerX = rect.left + (rect.width / 2);
    const left = Math.max(14, Math.min(window.innerWidth - menuWidth - 14, centerX - (menuWidth / 2)));
    const placeBelow = rect.top < 138;
    const top = placeBelow ? rect.bottom + 10 : rect.top - 8;
    setWordAction({
      idx,
      left,
      top,
      placeBelow,
      word: msWordsRef.current[idx] || '',
    });
  }

  function jumpToWordAction(){
    if(!wordAction) return;
    if(!hasClickableWordSync()) return;
    seekMsWordFromClick(wordAction.idx);
    setWordAction(null);
  }

  function flagFromWordAction(){
    if(!wordAction) return;
    const jumpedTime = seekMsWordFromClick(wordAction.idx);
    openFlagAtIndex(wordAction.idx, Number.isFinite(jumpedTime) ? jumpedTime : Number(audioRef.current?.currentTime) || 0);
    setWordAction(null);
  }

  function backToBook(){
    const a = audioRef.current;
    onBack?.({
      currentTime: Number(a?.currentTime) || 0,
      isPlaying: !!(a && !a.paused && !a.ended),
      playbackRate: Number(a?.playbackRate) || 1,
    });
  }

  const hasTranscription = syncTableRef.current.length >= 4 || (Array.isArray(section.whisperWords) && section.whisperWords.length > 0);
  const showWordTracker = !hasTranscription || !useWhisperSync;
  const showManualSyncControls = !hasTranscription || !useWhisperSync;

  function openSearch(){
    setSearchOpen(true);
    setSearchQuery('');
    setSearchHits([]);
    setSearchHitIdx(0);
    setTimeout(()=>searchInputRef.current?.focus(),60);
  }

  function closeSearch(){
    // Remove search highlights
    wordElsRef.current.forEach(el=>el?.classList.remove('w-search','w-search-cur'));
    setSearchOpen(false);
    setSearchQuery('');
    setSearchHits([]);
    setSearchHitIdx(0);
  }

  function runSearch(q){
    wordElsRef.current.forEach(el=>el?.classList.remove('w-search','w-search-cur'));
    if(!q.trim()){setSearchHits([]);setSearchHitIdx(0);return;}
    const needle = q.trim().toLowerCase().replace(/[^a-z0-9']+/g,' ');
    const words = msWordsRef.current;
    const needleWords = needle.split(' ').filter(Boolean);
    const hits = [];
    for(let i=0;i<=words.length-needleWords.length;i++){
      const slice = words.slice(i,i+needleWords.length).map(w=>w.toLowerCase().replace(/[^a-z0-9']+/g,''));
      if(needleWords.every((nw,j)=>slice[j]&&slice[j].includes(nw.replace(/[^a-z0-9']/g,'')))){
        hits.push(i);
        for(let k=0;k<needleWords.length;k++) wordElsRef.current[i+k]?.classList.add('w-search');
      }
    }
    setSearchHits(hits);
    setSearchHitIdx(0);
    if(hits.length){
      wordElsRef.current[hits[0]]?.classList.add('w-search-cur');
      scrollTo(hits[0], true);
    }
  }

  function searchStep(dir){
    if(!searchHits.length) return;
    wordElsRef.current[searchHits[searchHitIdx]]?.classList.remove('w-search-cur');
    const next = (searchHitIdx + dir + searchHits.length) % searchHits.length;
    setSearchHitIdx(next);
    wordElsRef.current[searchHits[next]]?.classList.add('w-search-cur');
    scrollTo(searchHits[next], true);
  }

  function removeFlag(i){setFlags(f=>{const u=[...f];if(wordElsRef.current[u[i].idx])wordElsRef.current[u[i].idx].classList.remove('w-flagged');u.splice(i,1);onSaveFlags(null,section.id,u);return u;});setSaved(true);setTimeout(()=>setSaved(false),1200);}

  function jumpToFlag(fl){
    const a=audioRef.current;if(!a)return;
    setShowReport(false);
    a.currentTime=fl.ts;
    a.play();
    manualScrollUntilRef.current = 0;
    forceFollowUntilRef.current = Date.now() + 1400;
    const rate = getEffectiveWordRate();
    const naiveRounded = Math.round(fl.ts * rate);
    if(useWhisperSyncRef.current && syncTableRef.current.length >= 4){
      const alignedIndex = getMsIdxAtTime(syncTableRef.current, fl.ts, naiveRounded);
      offRef.current = fl.idx - alignedIndex;
      return;
    }
    offRef.current = fl.idx - naiveRounded;
  }

  function handleSave(){onSaveFlags(null,section.id,flags);setSaved(true);setTimeout(()=>setSaved(false),2000);}

  function exportCSV(){
    const { chapterName, audioName } = getChapterAudioMeta();
    const rows=[['Chapter','Audio File','Page','Timestamp','Narrator/Engineer','Type','Note','Should Say']];
    flags.forEach(fl=>rows.push([`"${chapterName}"`,`"${audioName}"`,`"${fl.page}"`,`"${fmtTime(fl.ts)}"`,`"${fl.narrator}"`,`"${fl.type}"`,`"${(fl.sentPlain||'').replace(/"/g,'""')}"`,`"${(fl.note||'').replace(/"/g,'""')}"`]));
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\r\n')],{type:'text/csv'}));a.download=`${section.title||'section'}.csv`;a.click();
  }

  const { chapterName, audioName } = getChapterAudioMeta();

  useEffect(()=>{
    function onKey(e){
      const t=e.target.tagName;
      if(e.key==='Escape'){if(searchOpen){e.preventDefault();closeSearch();return;}if(flagPanel){dismissFlag();return;}}
      if((e.ctrlKey||e.metaKey)&&e.key==='f'){e.preventDefault();openSearch();return;}
      if(t==='INPUT'||t==='TEXTAREA'||t==='SELECT')return;
      if(e.key==='f'||e.key==='F'){e.preventDefault();openFlag();}
      if(e.key==='ArrowLeft'&&!e.shiftKey){e.preventDefault();jumpSec(-10);}
      if(e.key==='ArrowRight'&&!e.shiftKey){e.preventDefault();jumpSec(10);}
      if(e.key==='['&&canPrevChapter){e.preventDefault();onPrevChapter?.();}
      if(e.key===']'&&canNextChapter){e.preventDefault();onNextChapter?.();}
      if(e.key==='{'&&canPrevChapter){e.preventDefault();onPrevChapter?.();}
      if(e.key==='}'&&canNextChapter){e.preventDefault();onNextChapter?.();}
    }
    document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);
  },[flagPanel,searchOpen,narratorColors,section.id,canPrevChapter,canNextChapter,onPrevChapter,onNextChapter]);

  const Btn=({children,onClick,style={},disabled=false})=>(
    <button disabled={disabled} onClick={onClick} style={cbtn({opacity:disabled?0.45:1,cursor:disabled?'not-allowed':'pointer',...style})} onMouseEnter={e=>{if(!disabled)e.currentTarget.style.background='var(--cream)';}} onMouseLeave={e=>{if(!disabled)e.currentTarget.style.background=style.background||'white';}}>{children}</button>
  );

  const readerShellWidth = 'min(940px, calc(100vw - 32px))';
  const readerContentWidth = 'min(740px, calc(100vw - 40px))';
  const displaySceneTitle = activeSceneHeading || section.title || section.characterName || section.chapterTitle || 'Reader';
  const topCharacterLabel = activeCharacterLabel || section.characterName || displaySceneTitle;
  const showSceneSelect = Array.isArray(sceneOptions) && sceneOptions.length > 1;
  const activeSceneOptionId = sceneOptions.find(opt => nameMatches(opt.title, displaySceneTitle))?.id || section.id;
  const topNarratorLabel = activeNarratorLabel || sceneMappedNarrator || section.narratorName || '';
  const showExtraControls = !hasTranscription || !useWhisperSync;
  const canJumpFromWordAction = hasClickableWordSync();

  return (
    <div style={{ display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:'linear-gradient(180deg, #fbfaf7 0%, #ffffff 16%, #ffffff 100%)',paddingTop:isMacElectron?24:0 }}>
      <HomeBackPill icon="←" tone="proof" usesCustomDragRegion={usesCustomDragRegion || isMacElectron} onClick={backToBook} />
      <div style={{ flexShrink:0,padding:'14px 16px 12px',borderBottom:'1px solid var(--border-light)',background:'rgba(255,255,255,0.92)',backdropFilter:'blur(16px)' }}>
        <div style={{ width:readerShellWidth,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:12,alignItems:'center' }}>
          <div />

          <div style={{ textAlign:'center' }}>
            {section.chapterTitle && (
              <div style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'6px 13px',borderRadius:999,background:'var(--accent-surface)',border:'1px solid var(--accent-border)',fontSize:'0.73rem',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--accent-dark)' }}>
                <span>{section.chapterTitle}</span>
                {topCharacterLabel && <span style={{ width:1,height:14,background:'var(--accent-border)' }} />}
                {topCharacterLabel && <span style={{ textTransform:'none',letterSpacing:'0',fontWeight:600,color:'var(--text)' }}>{topCharacterLabel}</span>}
                {topNarratorLabel && <span style={{ width:1,height:14,background:'var(--accent-border)' }} />}
                {topNarratorLabel && <span style={{ textTransform:'none',letterSpacing:'0',fontWeight:600,color:'var(--text-muted)' }}>{topNarratorLabel}</span>}
              </div>
            )}
          </div>

          <div style={{ display:'flex',alignItems:'center',justifyContent:'flex-end',gap:7,flexWrap:'wrap' }}>
            {showSceneSelect && (
              <select
                value={activeSceneOptionId}
                onChange={e=>onJumpToScene?.(e.target.value)}
                style={{ border:'1px solid var(--border)',borderRadius:999,padding:'7px 34px 7px 12px',fontSize:'0.79rem',fontWeight:600,color:'var(--text)',background:'white',boxShadow:'0 6px 16px rgba(0,0,0,0.04)',cursor:'pointer',maxWidth:178 }}
                title="Jump to scene"
              >
                {sceneOptions.map(opt=>(
                  <option key={opt.id} value={opt.id}>{opt.title}</option>
                ))}
              </select>
            )}
            {(onPrevChapter || onNextChapter) && (
              <>
                <button onClick={()=>onPrevChapter?.()} disabled={!canPrevChapter} title="Previous chapter" style={{ ...cbtn({padding:'6px 9px',borderRadius:999,background:'transparent'}), opacity:canPrevChapter?1:0.38 }}>←</button>
                <button onClick={()=>onNextChapter?.()} disabled={!canNextChapter} title="Next chapter" style={{ ...cbtn({padding:'6px 9px',borderRadius:999,background:'transparent'}), opacity:canNextChapter?1:0.38 }}>→</button>
              </>
            )}
            <button onClick={openSearch} style={{ background:'transparent',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:'1rem',padding:'4px 5px' }} title="Search text (Ctrl/⌘+F)">🔍</button>
            {flags.length>0&&<Btn onClick={()=>setShowReport(true)} style={{ borderRadius:999,padding:'9px 14px',fontWeight:700 }}>Report</Btn>}
            {flags.length>0&&<Btn onClick={exportCSV} style={{ color:'var(--success)',borderColor:'#c6e4cd',borderRadius:999,padding:'9px 12px' }}>⬇ CSV</Btn>}
            <Btn onClick={handleSave} style={saved ? { color:'var(--accent-dark)',borderColor:'var(--accent-border-strong)',background:'var(--accent-soft)',fontWeight:700,borderRadius:999,padding:'9px 16px' } : { color:'var(--accent)',borderColor:'var(--accent-border-strong)',borderRadius:999,padding:'9px 16px' }}>{saved ? 'Saved' : 'Save'}</Btn>
          </div>
        </div>

        <div style={{ width:readerContentWidth,margin:'10px auto 0',display:'flex',justifyContent:'center',flexWrap:'wrap',gap:8,alignItems:'center',fontSize:'0.72rem',color:'var(--text-muted)' }}>
          {(narratorColors||[]).map((nc,i)=>(
            <span
              key={i}
              className="ap-quick-tip ap-quick-tip-top"
              data-tip={nc.narratorName && nc.narratorName !== nc.characterName ? `${nc.characterName}\nNarrator: ${nc.narratorName}` : nc.characterName}
              style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:999,background:'rgba(255,255,255,0.9)',border:'1px solid var(--border-light)',position:'relative' }}
            >
              <span style={{ display:'inline-block',width:10,height:10,borderRadius:2,background:nc.hex }}></span>{nc.characterName}
            </span>
          ))}
          <InfoTip tip={'Double-click a word to open actions. Use Jump here or Flag here from the popup. F flags the current spot. Left and right arrows jump ±10 seconds.'} side="bottom" />
        </div>
      </div>

      {searchOpen&&(
        <div style={{ flexShrink:0,padding:'10px 16px 0' }}>
          <div style={{ width:readerContentWidth,margin:'0 auto',display:'flex',alignItems:'center',gap:8,padding:'8px 10px',background:'rgba(255,255,255,0.96)',border:'1px solid var(--border-light)',borderRadius:14,boxShadow:'0 10px 24px rgba(0,0,0,0.04)' }}>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            placeholder="Search manuscript…"
            onChange={e=>{setSearchQuery(e.target.value);runSearch(e.target.value);}}
            onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();searchStep(e.shiftKey?-1:1);}if(e.key==='Escape'){e.preventDefault();closeSearch();}}}
            style={{ flex:1,border:'1px solid var(--border)',borderRadius:10,padding:'8px 12px',fontSize:'0.9rem',fontFamily:'inherit',outline:'none',background:'white' }}
          />
          {searchHits.length>0&&<span style={{ fontSize:'0.72rem',color:'var(--text-muted)',whiteSpace:'nowrap' }}>{searchHitIdx+1} / {searchHits.length}</span>}
          {searchHits.length===0&&searchQuery.trim()&&<span style={{ fontSize:'0.72rem',color:'var(--danger)',whiteSpace:'nowrap' }}>Not found</span>}
          <button onClick={()=>searchStep(-1)} disabled={searchHits.length<2} style={{ ...cbtn(),padding:'4px 8px',opacity:searchHits.length<2?0.4:1 }}>↑</button>
          <button onClick={()=>searchStep(1)} disabled={searchHits.length<2} style={{ ...cbtn(),padding:'4px 8px',opacity:searchHits.length<2?0.4:1 }}>↓</button>
          <button onClick={closeSearch} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:'0.875rem',padding:'0 4px' }}>✕</button>
        </div>
        </div>
      )}

      <div style={{ flex:1,minHeight:0,overflow:'hidden',padding:'12px 16px 0' }}>
        <div
          ref={textRef}
          className={`reader-text ${READER_BODY_CLASS}`}
          style={{ position:'relative',height:'100%',width:readerContentWidth,margin:'0 auto',overflowY:'auto',padding:'0.5rem 0.35rem 2rem',fontSize:'16.5px',lineHeight:'1.92',minHeight:0,color:'var(--text)' }}
          onScroll={()=>{
            if(!autoScrollingRef.current) markManualScroll();
            updateActiveSceneMetaFromViewport();
          }}
          onWheel={()=>markManualScroll()}
          onTouchStart={()=>markManualScroll()}
          onDoubleClick={e=>{
            const t=e.target.closest?.('[data-cr-unit]');
            if(!t)return;
            e.preventDefault();
            const idx=parseInt(t.getAttribute('data-cr-unit'),10);
            if(!Number.isFinite(idx))return;
            openWordActionMenu(idx, t);
          }}
        >{renderedBody}</div>
      </div>

      {wordAction&&(
        <div
          className="reader-word-action"
          style={{
            position:'fixed',
            left:wordAction.left,
            top:wordAction.top,
            transform:wordAction.placeBelow ? 'translateY(0)' : 'translateY(-100%)',
            zIndex:1250,
            minWidth:186,
            padding:'8px',
            borderRadius:16,
            border:'1px solid var(--accent-border)',
            background:'rgba(255,255,255,0.98)',
            boxShadow:'0 18px 42px rgba(28, 18, 44, 0.18)',
            backdropFilter:'blur(14px)',
          }}
        >
          <div style={{ fontSize:'0.68rem',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text-light)',marginBottom:6 }}>Word action</div>
          <div style={{ fontSize:'0.82rem',fontWeight:600,color:'var(--text)',marginBottom:8,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
            {wordAction.word || 'Selected word'}
          </div>
          <div style={{ display:'flex',gap:6 }}>
            <button
              onClick={jumpToWordAction}
              disabled={!canJumpFromWordAction}
              title={canJumpFromWordAction ? 'Jump to this word in the audio' : 'Jump needs transcription first'}
              style={{ flex:1,padding:'8px 10px',borderRadius:10,border:'1px solid '+(canJumpFromWordAction?'var(--accent-border-strong)':'var(--border)'),background:canJumpFromWordAction?'var(--accent-light)':'var(--cream)',color:canJumpFromWordAction?'var(--accent-dark)':'var(--text-light)',fontSize:'0.78rem',fontWeight:700,cursor:canJumpFromWordAction?'pointer':'not-allowed' }}
            >
              Jump here
            </button>
            <button onClick={flagFromWordAction} style={{ flex:1,padding:'8px 10px',borderRadius:10,border:'1px solid #f0b8b8',background:'var(--danger-light)',color:'var(--danger)',fontSize:'0.78rem',fontWeight:700,cursor:'pointer' }}>
              Flag here
            </button>
          </div>
        </div>
      )}

      {useWhisperSync && whisperGuideText && (
        <div style={{ flexShrink:0,padding:'0 16px 10px' }}>
          <div style={{ width:readerContentWidth,margin:'0 auto',display:'flex',alignItems:'center',gap:8,padding:'7px 12px',background:'#fafaf7',border:'1px solid var(--border-light)',borderRadius:999 }}>
            <span style={{ fontSize:'0.58rem',fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text-light)' }}>Transcript</span>
            <span style={{ fontSize:'0.68rem',color:'var(--text-muted)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{whisperGuideText}</span>
          </div>
        </div>
      )}

      {flagPanel&&(
        <div style={{ flexShrink:0,padding:'0 16px 12px' }}>
        <div style={{ width:readerContentWidth,margin:'0 auto',border:'1px solid var(--border)',background:'white',borderRadius:18,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8,boxShadow:'0 14px 32px rgba(0,0,0,0.05)' }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <span style={{ fontFamily:'monospace',fontWeight:700,color:'var(--accent)',fontSize:'0.95rem' }}>{fmtTime(flagPanel.ts)}</span>
              <span style={{ fontSize:'0.72rem',background:'var(--cream)',color:'var(--text-muted)',padding:'2px 8px',borderRadius:20,fontWeight:600,border:'1px solid var(--border-light)' }}>{flagPanel.autoNar}</span>
            </div>
            <button onClick={dismissFlag} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:'0.875rem' }}>✕</button>
          </div>
          <div>
            <div style={{ fontSize:'0.65rem',fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase',color:'var(--text-muted)',marginBottom:4 }}>Quote</div>
            <textarea
              value={flagDraft?.quote||''}
              onChange={e=>setFlagDraft(prev=>({...(prev||{}),quote:e.target.value}))}
              rows={2}
              style={{ width:'100%',border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px',fontSize:'0.875rem',lineHeight:1.6,fontFamily:'inherit',background:'white',outline:'none',resize:'vertical' }}
            />
          </div>
          <div style={{ display:'grid',gridTemplateColumns:'70px 1fr 1fr 110px',gap:8 }}>
            {[{lbl:'Page',key:'page',ph:'#'},{lbl:'Should say / note',key:'note',ph:'Correction…'},{lbl:'Narrator override',key:'narrator',ph:flagPanel.autoNar,dv:flagPanel.autoNar}].map((f,i)=>(
              <div key={i}>
                <div style={{ fontSize:'0.65rem',fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase',color:'var(--text-muted)',marginBottom:4 }}>{f.lbl}</div>
                <input ref={f.key==='note'?noteRef:null} type="text" placeholder={f.ph} value={flagDraft?.[f.key]??(f.dv||'')} onChange={e=>setFlagDraft(prev=>({...(prev||{}),[f.key]:e.target.value}))} style={{ width:'100%',border:'1px solid var(--border)',borderRadius:8,padding:'7px 10px',fontSize:'0.875rem',fontFamily:'inherit',background:'white',outline:'none' }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize:'0.65rem',fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase',color:'var(--text-muted)',marginBottom:4 }}>Type</div>
              <select value={flagDraft?.type||'Edit'} onChange={e=>setFlagDraft(prev=>({...(prev||{}),type:e.target.value}))} style={{ width:'100%',border:'1px solid var(--border)',borderRadius:8,padding:'7px 10px',fontSize:'0.875rem',fontFamily:'inherit',background:'white',outline:'none',cursor:'pointer' }}>
                {['Edit','Emphasis','Pronunciation','Special Edition','Unclear','Misread','Other'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ background:'white',border:'1px dashed var(--border)',borderRadius:10,padding:'8px 10px' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:6 }}>
              <div style={{ fontSize:'0.68rem',fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase',color:'var(--text-muted)' }}>Sheets row preview</div>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                {sheetCopyStatus&&<span style={{ fontSize:'0.72rem',color:'var(--success)' }}>{sheetCopyStatus}</span>}
                <Btn onClick={copySheetRow} style={{ fontSize:'0.72rem' }}>Copy row</Btn>
              </div>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1.1fr 1fr 0.55fr 0.6fr 1fr 0.7fr 1.4fr 1.1fr',gap:6,fontSize:'0.68rem' }}>
              {['Chapter','Audio File','Page','Timestamp','Narrator/Engineer','Type','Note','Should Say'].map((h)=><div key={h} style={{ fontWeight:600,color:'var(--text-muted)' }}>{h}</div>)}
              {buildSheetCells(flagDraft,flagPanel.ts).map((v,i)=><div key={i} style={{ color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }} title={v}>{v||' '}</div>)}
            </div>
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={saveFlag} style={{ padding:'8px 18px',background:'var(--accent)',color:'white',border:'none',borderRadius:8,fontSize:'0.875rem',fontWeight:600,cursor:'pointer' }}>Save flag</button>
            <Btn onClick={dismissFlag}>Dismiss</Btn>
          </div>
        </div>
        </div>
      )}

      <AudioDock
        floating={false}
        audioRef={audioRef}
        audioUrl={audioUrl}
        contentWidth={readerContentWidth}
        speed={listenSpeed}
        onSpeedChange={applyPlaybackSpeed}
        rightActions={(
          <>
            {hasTranscription && (
              <button
                type="button"
                onClick={()=>setUseWhisperSync(v=>!v)}
                title={useWhisperSync ? 'Transcription on. Click to turn it off.' : 'Transcription off. Click to turn it on.'}
                style={{ width:38,height:38,border:'1px solid '+(useWhisperSync?'#8fbf8f':'var(--border)'),borderRadius:999,background:useWhisperSync?'#e7f6e7':'white',fontSize:'0.82rem',fontWeight:700,cursor:'pointer',color:useWhisperSync?'#2b7a2b':'var(--text-muted)' }}
              >
                T
              </button>
            )}
            <button
              type="button"
              onClick={()=>setFollowPlayback(v=>!v)}
              title={`Follow text is ${followPlayback ? 'on' : 'off'}. When on, moving the audio keeps the text following along.`}
              style={{ minWidth:132,padding:'7px 12px',border:'1px solid '+(followPlayback?'var(--accent)':'var(--border)'),borderRadius:999,background:followPlayback?'var(--accent-soft)':'white',fontSize:'0.74rem',fontWeight:700,cursor:'pointer',color:followPlayback?'var(--accent-dark)':'var(--text-muted)' }}
            >
              Follow text: {followPlayback ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              onClick={openFlag}
              title="Flag the current spot"
              style={{ width:38,height:38,background:'var(--danger-light)',color:'var(--danger)',border:'1px solid #f0b8b8',borderRadius:999,fontSize:'0.82rem',fontWeight:700,cursor:'pointer' }}
              onMouseEnter={e=>e.currentTarget.style.background='#f9d9d9'}
              onMouseLeave={e=>e.currentTarget.style.background='var(--danger-light)'}
            >
              F
            </button>
          </>
        )}
        extraRow={showExtraControls && (
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,flexWrap:'wrap' }}>
            {showWordTracker && (
              <div style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'7px 10px',borderRadius:999,background:'rgba(255,255,255,0.96)',border:'1px solid var(--border-light)' }}>
                <span style={{ fontSize:'0.68rem',color:'var(--text-muted)',fontWeight:700,letterSpacing:'0.05em',textTransform:'uppercase' }}>Words</span>
                {[[-10,'−10'],[-3,'−3'],[3,'+3'],[10,'+10']].map(([n,l])=><Btn key={n} onClick={()=>nudge(n)} title="Nudge manuscript highlight" style={{ borderRadius:999,padding:'6px 9px' }}>{l}</Btn>)}
              </div>
            )}
            {showManualSyncControls && (
              <div style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'7px 10px',borderRadius:999,background:'rgba(255,255,255,0.96)',border:'1px solid var(--border-light)' }}>
                <span style={{ fontSize:'0.68rem',color:'var(--text-muted)',fontWeight:700,letterSpacing:'0.05em',textTransform:'uppercase',whiteSpace:'nowrap' }}>Sync</span>
                <Btn onClick={()=>stepSyncSpeed(-0.05)} aria-label="Decrease sync speed" style={{ borderRadius:999,padding:'6px 9px' }}>−</Btn>
                <input type="range" min={0.5} max={4} step={0.01} value={syncSpeed} onChange={e=>setSyncSpeedFromSlider(e.target.value)} style={{ width:120,maxWidth:'34vw',cursor:'pointer',accentColor:'var(--accent)' }} title="Fine-tune text vs audio" />
                <Btn onClick={()=>stepSyncSpeed(0.05)} aria-label="Increase sync speed" style={{ borderRadius:999,padding:'6px 9px' }}>+</Btn>
                <span style={{ fontSize:'0.74rem',color:'var(--text-muted)',fontVariantNumeric:'tabular-nums',minWidth:40 }}>{syncSpeed.toFixed(2)}×</span>
              </div>
            )}
          </div>
        )}
      />

      {showReport&&(
        <div style={{ position:'absolute',inset:0,background:'white',zIndex:20,display:'flex',flexDirection:'column' }}>
          <div style={{ display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderBottom:'1px solid var(--border)',flexShrink:0 }}>
            <span style={{ fontWeight:700,fontSize:'0.95rem' }}>Errors — {section.title}</span>
            {chapterName&&<span style={{ fontSize:'0.72rem',color:'var(--text-muted)',background:'var(--cream)',padding:'2px 8px',borderRadius:20,border:'1px solid var(--border-light)' }}>Chapter: {chapterName}</span>}
            {audioName&&<span style={{ fontSize:'0.72rem',color:'var(--text-muted)',background:'var(--cream)',padding:'2px 8px',borderRadius:20,border:'1px solid var(--border-light)' }}>Audio: {audioName}</span>}
            <span style={{ padding:'3px 10px',background:'var(--danger-light)',color:'var(--danger)',borderRadius:20,fontSize:'0.72rem',fontWeight:600 }}>{flags.length}</span>
            <div style={{ marginLeft:'auto',display:'flex',gap:8 }}>
              <Btn onClick={exportCSV} style={{ color:'var(--success)',borderColor:'#c6e4cd' }}>⬇ CSV</Btn>
              <Btn onClick={()=>setShowReport(false)}>← Back</Btn>
            </div>
          </div>
          <div style={{ flex:1,overflowY:'auto',padding:'1rem 1.25rem' }}>
            {flags.length===0?<p style={{ color:'var(--text-muted)',fontSize:'0.875rem' }}>No flags yet.</p>
              :flags.map((fl,i)=>(
                <div key={i} style={{ padding:'10px 0',borderBottom:'1px solid var(--border-light)' }}>
                  <div style={{ display:'flex',gap:10,marginBottom:4 }}>
                    <span style={{ fontFamily:'monospace',fontWeight:700,color:'var(--accent)',fontSize:'0.875rem' }}>{fmtTime(fl.ts)}</span>
                    <span style={{ fontSize:'0.72rem',color:'var(--text-muted)' }}>p.{fl.page} · {fl.narrator} · {fl.type}</span>
                  </div>
                  <div style={{ fontSize:'0.875rem',color:'var(--text-muted)',lineHeight:1.6,marginBottom:fl.note?4:0 }} dangerouslySetInnerHTML={{ __html:'\u201c'+fl.sentHtml+'\u201d' }} />
                  {fl.note&&<div style={{ fontSize:'0.875rem',color:'var(--text)' }}><strong style={{ fontWeight:600 }}>Should say:</strong> {fl.note}</div>}
                  <div style={{ display:'flex',gap:6,marginTop:6 }}>
                    <Btn onClick={()=>jumpToFlag(fl)}>▶ Jump</Btn>
                    <Btn onClick={()=>removeFlag(i)} style={{ color:'var(--danger)',borderColor:'#f0b8b8' }}>Remove</Btn>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <style>{`
        .reader-text{scrollbar-width:thin;scrollbar-color:transparent transparent}
        .reader-text:hover,.reader-text:focus-within{scrollbar-color:rgba(140,124,148,0.42) transparent}
        .reader-text::-webkit-scrollbar{width:10px}
        .reader-text::-webkit-scrollbar-track{background:transparent}
        .reader-text::-webkit-scrollbar-thumb{background:transparent;border-radius:999px}
        .reader-text:hover::-webkit-scrollbar-thumb,.reader-text:focus-within::-webkit-scrollbar-thumb{background:rgba(140,124,148,0.42)}
        .reader-text::-webkit-scrollbar-thumb:hover{background:rgba(140,124,148,0.58)}
        .reader-text [data-cr-unit]{border-radius:5px;transition:background-color 0.12s ease, box-shadow 0.12s ease, filter 0.08s}
        .reader-text [data-cr-unit]:hover{filter:brightness(0.96)}
        .reader-text .w-cur{background:color-mix(in srgb, var(--accent-light) 88%, white);border-radius:6px;box-shadow:0 0 0 1px color-mix(in srgb, var(--accent-border-strong) 65%, transparent), inset 0 -1px 0 var(--accent-border-strong)}
        .reader-text .w-flagged{text-decoration:underline;text-decoration-style:wavy;text-decoration-color:#e24b4a}
        .reader-text .w-search{background:#fff3a0;border-radius:3px}
        .reader-text .w-search-cur{background:#f59e0b;color:white;border-radius:3px}
        .reader-text .w-suboverlay{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:0}
        .reader-text .w-subline{position:absolute;max-width:82%;font-size:0.68em;line-height:1.1;color:#b8b8b8;font-style:italic;letter-spacing:0.01em;opacity:0.88;pointer-events:none;user-select:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;z-index:0}
        .reader-text span[class*="hl-"]{display:inline !important;box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:0.08em 0.18em;margin:0 0.03em;border-radius:3px;vertical-align:baseline}
        .reader-text h1{font-size:1.58rem;font-weight:700;margin:1.1rem auto 0.85rem;letter-spacing:-0.03em;text-align:center;max-width:22ch;line-height:1.2}
        .reader-text h2{font-size:1.08rem;font-weight:700;margin:1.35rem auto 0.75rem;letter-spacing:0.01em;text-align:center;max-width:18ch;line-height:1.3;color:var(--text)}
        .reader-text h3{font-size:0.95rem;font-weight:600;margin:0.9rem auto 0.45rem;text-align:center}
        .reader-text p{margin-bottom:0.58rem}.reader-text strong{font-weight:600}
        .fw{font-style:normal;font-weight:700;color:#c4514a}
        .reader-text .hl-yellow{background:#FFF8DC}.reader-text .hl-green{background:#DFF2E3}
        .reader-text .hl-cyan{background:#DFF4F7}.reader-text .hl-magenta,.reader-text .hl-pink{background:#FDDEE8}
        .reader-text .hl-blue{background:#DDEEFF}.reader-text .hl-red{background:#FDDEDE}
        .reader-text .hl-darkblue{background:#D4E5F9}.reader-text .hl-darkcyan{background:#D4F0F5}
        .reader-text .hl-darkgreen{background:#D4EDD9}.reader-text .hl-darkmagenta{background:#F0D9F7}
        .reader-text .hl-darkred{background:#F9D9D9}.reader-text .hl-darkyellow{background:#FFF0CC}
        .reader-text .hl-lightgray{background:#F2F2F0}.reader-text .hl-darkgray{background:#E6E5E0}
      `}</style>
    </div>
  );
}
