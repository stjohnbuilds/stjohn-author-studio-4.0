'use client';

// StJohn Author Studio 4.0 — Prep Manuscript mode.
//
// Phase 6 pass 2-3:
//  - Import a .docx via standard file picker (no Electron IPC needed —
//    mammoth runs in the browser/renderer).
//  - Run the shared manuscript-engine's detectDialogueSpansInHtml.
//  - Render a chapter-grouped list of every dialogue line found, with
//    a couple of words of surrounding context on each side.
// Pass 4 adds character assignment. Pass 5 adds export.

import React, { useState } from 'react';
import {
  detectDialogueSpansInHtml,
} from '../../packages/manuscript-engine/index.js';

const PASTEL_PREP = '#DCEBE0';
const PREP_INK = '#3F6A52';

function splitHtmlIntoChapters(html = '') {
  // Split on h1/h2 boundaries. Each chapter keeps its heading + body.
  // Pure string-level split — no DOM, works server-side too.
  if (!html) return [];
  const re = /<(h1|h2)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const breaks = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    breaks.push({ index: m.index, end: m.index + m[0].length, title: stripTags(m[2]).trim() });
  }
  if (!breaks.length) {
    return [{ title: 'Untitled chapter', html }];
  }
  const chapters = [];
  for (let i = 0; i < breaks.length; i++) {
    const start = breaks[i].index;
    const end = i + 1 < breaks.length ? breaks[i + 1].index : html.length;
    chapters.push({
      title: breaks[i].title || `Chapter ${i + 1}`,
      html: html.slice(start, end),
    });
  }
  return chapters;
}

function stripTags(s = '') {
  return String(s).replace(/<[^>]*>/g, '');
}

function snippet(text = '', max = 70) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trim() + '…';
}

export default function PrepManuscriptMode({ modeToggle, usesCustomDragRegion }) {
  const [fileName, setFileName] = useState('');
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalDialogue = chapters.reduce((n, ch) => n + (ch.spans?.length || 0), 0);

  async function handleFile(file) {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const mammoth = (await import('mammoth')).default;
      const ab = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: ab });
      const html = result.value || '';
      const parts = splitHtmlIntoChapters(html);
      const withSpans = parts.map((p) => {
        const detect = detectDialogueSpansInHtml(p.html) || {};
        const spans = Array.isArray(detect.dialogueSpans) ? detect.dialogueSpans : (Array.isArray(detect) ? detect : []);
        return { ...p, spans };
      });
      setChapters(withSpans);
      setFileName(file.name);
    } catch (err) {
      setError(err?.message || 'Could not read this manuscript.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {usesCustomDragRegion && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 1100 }} />
      )}
      {modeToggle}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '5.2rem 1.25rem 4rem' }}>
        <header style={{ marginBottom: '1.4rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: PREP_INK }}>
            Prep Manuscript
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Import a Word manuscript. Every line of dialogue is detected so you can assign characters before recording.
          </div>
        </header>

        {chapters.length === 0 && (
          <section
            style={{
              padding: '24px 22px',
              background: PASTEL_PREP,
              border: '1px solid ' + PREP_INK + '33',
              borderRadius: 22,
              color: 'var(--text)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 10 }}>No manuscript yet</div>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.55, color: 'var(--text-muted)', marginBottom: 16 }}>
              Pick a .docx file. The app will scan for dialogue automatically — you don&apos;t have to do anything else.
            </div>
            <label
              style={{
                display: 'inline-block',
                padding: '13px 22px',
                background: PREP_INK,
                color: 'white',
                fontSize: '0.86rem',
                fontWeight: 700,
                borderRadius: 14,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Reading…' : 'Import manuscript (.docx)'}
              <input
                type="file"
                accept=".docx"
                disabled={loading}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </label>
            {error && (
              <div style={{ marginTop: 14, fontSize: '0.78rem', color: 'var(--danger)' }}>{error}</div>
            )}
          </section>
        )}

        {chapters.length > 0 && (
          <>
            <section
              style={{
                marginBottom: 16,
                padding: '14px 18px',
                background: PASTEL_PREP,
                border: '1px solid ' + PREP_INK + '33',
                borderRadius: 16,
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PREP_INK }}>
                  Loaded
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>
                  {fileName}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {chapters.length} chapter{chapters.length === 1 ? '' : 's'} · {totalDialogue} dialogue line{totalDialogue === 1 ? '' : 's'}
                </div>
              </div>
              <label
                style={{
                  padding: '8px 14px',
                  background: 'white',
                  border: '1px solid ' + PREP_INK,
                  color: PREP_INK,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  borderRadius: 999,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Replace
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
              </label>
            </section>

            {chapters.map((ch, ci) => (
              <section
                key={ci}
                style={{
                  marginBottom: 14,
                  padding: '14px 16px',
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                }}
              >
                <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, gap: 10 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)' }}>
                    {ch.title || `Chapter ${ci + 1}`}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {ch.spans.length} dialogue{ch.spans.length === 1 ? '' : 's'}
                  </div>
                </header>
                {ch.spans.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>No dialogue detected in this chapter.</div>
                ) : (
                  <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ch.spans.map((s, si) => (
                      <li
                        key={si}
                        style={{
                          padding: '9px 12px',
                          background: 'var(--accent-surface)',
                          border: '1px solid var(--border-light)',
                          borderRadius: 10,
                          fontSize: '0.84rem',
                          lineHeight: 1.4,
                          color: 'var(--text)',
                        }}
                      >
                        <span style={{ color: PREP_INK, fontWeight: 700, fontFamily: 'Georgia, serif' }}>“{snippet(s.text, 220)}”</span>
                        {s.afterText && (
                          <span style={{ marginLeft: 6, fontSize: '0.78rem', color: 'var(--text-light)', fontStyle: 'italic' }}>
                            — {snippet(s.afterText, 60)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
