'use client';
//
// AcxScanDialog — "Check files for ACX". Opened from the proofer book screen.
// Two sources via a toggle:
//   • This audiobook — scans the audio files already attached to the open book
//     (by their saved paths; nothing is uploaded).
//   • A folder — pick any folder of finished audio files.
// Measures each file against ACX's submission rules with the bundled ffmpeg
// (same measurements as Steven Jay Cohen's "Second Opinion"). Heavy lifting
// lives in main.js + packages/acx-engine; this only drives it and shows the
// result in plain English. Uses the shared <AppDialog> for accessibility.

import { useEffect, useRef, useState, useCallback } from 'react';
import AppDialog from './AppDialog';

const C = {
  pass: '#15803d', passBg: '#eaf6ee', passBorder: '#bfe3cb',
  fail: '#b4232a', failBg: '#fbecec', failBorder: '#f0c4c4',
  warn: '#8a6a0a', warnBg: '#fdf6e3', warnBorder: '#ecdca6',
};

const btn = (kind) => ({
  fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', padding: '9px 14px', borderRadius: 10,
  border: kind === 'primary' ? '1px solid var(--accent-dark)' : '1px solid var(--border)',
  background: kind === 'primary' ? 'var(--accent-dark)' : 'white',
  color: kind === 'primary' ? 'white' : 'var(--text)',
});

const smallBtn = { fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: '7px 11px', borderRadius: 9, border: '1px solid var(--border)', background: 'white', color: 'var(--text)' };

function statsLine(result) {
  const get = (k) => result.checks?.find((c) => c.key === k)?.value;
  return [get('length'), get('channels'), get('sampleRate'),
    get('rms') ? `${get('rms')} avg` : null, get('peak') ? `${get('peak')} peak` : null, get('bitrate'),
  ].filter(Boolean).join('  ·  ');
}

export default function AcxScanDialog({ open, onClose, isElectron, audiobook = null }) {
  const hasAudiobook = !!(audiobook && Array.isArray(audiobook.files) && audiobook.files.length);

  const [info, setInfo] = useState(null);
  const [source, setSource] = useState('folder');      // 'audiobook' | 'folder'
  const [folderPath, setFolderPath] = useState('');
  const [items, setItems] = useState([]);              // [{ fileName, storedPath?, label? }]
  const [results, setResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const runToken = useRef(0);

  const resetRun = useCallback(() => { setResults([]); setProgress({ done: 0, total: 0 }); setError(''); setSaveMsg(''); }, []);

  // On open: check the tool, and default the source to the audiobook if we have one.
  useEffect(() => {
    if (!open) return;
    resetRun();
    setSource(hasAudiobook ? 'audiobook' : 'folder');
    setFolderPath('');
    setItems(hasAudiobook ? audiobook.files : []);
    if (isElectron && window.electron?.acxGetInfo) {
      window.electron.acxGetInfo().then(setInfo).catch(() => setInfo({ available: false }));
    } else {
      setInfo({ available: false });
    }
  }, [open, isElectron, hasAudiobook]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop any in-flight scan when the dialog closes.
  useEffect(() => { if (!open) { runToken.current += 1; setScanning(false); } }, [open]);

  const pickSource = useCallback((next) => {
    runToken.current += 1;
    setScanning(false);
    setSource(next);
    resetRun();
    if (next === 'audiobook') {
      setFolderPath('');
      setItems(hasAudiobook ? audiobook.files : []);
    } else {
      setItems([]);
    }
  }, [hasAudiobook, audiobook, resetRun]);

  const chooseFolder = useCallback(async () => {
    resetRun();
    try {
      const picked = await window.electron.acxPickFolder();
      if (!picked) return;
      setFolderPath(picked.folderPath);
      setItems((picked.files || []).map((fileName) => ({ fileName })));
      if (!picked.files || picked.files.length === 0) {
        setError('No audio files in that folder. Pick the folder that holds your finished MP3 or WAV files.');
      }
    } catch (e) {
      setError(e?.message || 'Could not open that folder.');
    }
  }, [resetRun]);

  const runScan = useCallback(async () => {
    if (!items.length) return;
    resetRun();
    setScanning(true);
    setProgress({ done: 0, total: items.length });
    const token = ++runToken.current;
    const collected = [];
    for (let i = 0; i < items.length; i += 1) {
      if (token !== runToken.current) return;
      const it = items[i];
      let res;
      try {
        res = await window.electron.acxAnalyzeFile(
          it.storedPath ? { storedPath: it.storedPath, fileName: it.fileName } : { folderPath, fileName: it.fileName },
        );
      } catch (e) {
        res = { fileName: it.fileName, error: e?.message || 'Could not check this file.' };
      }
      if (token !== runToken.current) return;
      collected.push(res);
      setResults([...collected]);
      setProgress({ done: i + 1, total: items.length });
    }
    setScanning(false);
  }, [items, folderPath, resetRun]);

  const stopScan = useCallback(() => { runToken.current += 1; setScanning(false); }, []);

  const reportMeta = useCallback(() => ({
    title: source === 'audiobook' && audiobook?.title ? `ACX check — ${audiobook.title}` : 'ACX file check',
    source: source === 'audiobook' ? (audiobook?.title || 'This audiobook') : folderPath,
  }), [source, audiobook, folderPath]);

  const copyReport = useCallback(async () => {
    setSaveMsg('');
    try {
      const text = await window.electron.acxBuildReport({ results, format: 'txt', ...reportMeta() });
      await navigator.clipboard.writeText(text);
      setSaveMsg('Copied the report to your clipboard.');
    } catch (e) {
      setError('Could not copy — try “Save text” instead.');
    }
  }, [results, reportMeta]);

  const saveReport = useCallback(async (format) => {
    setSaveMsg('');
    try {
      const m = reportMeta();
      const base = source === 'audiobook' && audiobook?.title ? `ACX-check — ${audiobook.title}` : 'ACX-check';
      const saved = await window.electron.acxSaveReport({ results, format, defaultName: `${base}.${format}`, ...m });
      if (saved) setSaveMsg(`Saved to ${saved}`);
    } catch (e) {
      setError(e?.message || 'Could not save the report.');
    }
  }, [results, reportMeta, source, audiobook]);

  if (!open) return null;

  const done = results.filter((r) => r && !r.error);
  const passCount = done.filter((r) => r.pass).length;
  const headsUpCount = done.filter((r) => r.pass && r.hasWarnings).length;
  const errorCount = results.filter((r) => r && r.error).length;
  const allChecked = !scanning && results.length === items.length && items.length > 0;
  const available = info?.available;

  // Once done, show the ones that need a look first (matches the export order).
  const rank = (r) => (r?.error ? 0 : r?.pass ? 2 : 1);
  const shownResults = allChecked ? [...results].sort((a, b) => rank(a) - rank(b)) : results;

  // Batch consistency (a real ACX rule: all files must match each other).
  const warnings = [];
  if (allChecked && done.length > 1) {
    const rates = [...new Set(done.map((r) => r.measured?.sampleRate).filter(Boolean))];
    if (rates.length > 1) warnings.push(`Your files don't all use the same sample rate (${rates.map((r) => r.toLocaleString()).join(', ')} Hz). ACX wants every file the same.`);
    const chans = [...new Set(done.map((r) => r.measured?.channels).filter(Boolean))];
    if (chans.length > 1) {
      const lbl = (c) => (c === 1 ? 'mono' : c === 2 ? 'stereo' : `${c}ch`);
      warnings.push(`Your files aren't all the same — some are ${chans.map(lbl).join(', ')}. ACX wants every file the same.`);
    }
  }

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      ariaLabel="Check files for ACX"
      panelStyle={{
        // Fixed height so the window never grows/jumps as results stream in.
        width: 'min(640px, 94vw)', height: 'min(680px, 88vh)', display: 'flex', flexDirection: 'column',
        background: 'white', border: '1px solid var(--border)', borderRadius: 18,
        boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px 12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>Check files for ACX</h2>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            I&apos;ll check each finished audio file against ACX&apos;s rules and tell you what&apos;s wrong in plain words.
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" title="Close"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, padding: 4 }}>
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '0 20px', overflowY: 'auto', flex: 1 }}>
        {!available ? (
          <div style={{ background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 12, padding: '14px 16px', fontSize: '0.86rem', color: 'var(--text)', lineHeight: 1.5, margin: '4px 0 16px' }}>
            {isElectron
              ? 'The audio tool isn’t installed in this version of the app yet (this happens on Windows until the next build). It works on your Mac.'
              : 'This check only runs in the desktop app, not the browser version.'}
          </div>
        ) : (
          <>
            {/* Source toggle — only when opened from a book */}
            {hasAudiobook && (
              <div style={{ display: 'inline-flex', gap: 0, marginBottom: 14, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {[['audiobook', 'This audiobook'], ['folder', 'A folder']].map(([key, label]) => (
                  <button key={key} type="button" onClick={() => pickSource(key)} disabled={scanning}
                    style={{
                      fontSize: '0.8rem', fontWeight: 700, cursor: scanning ? 'default' : 'pointer', padding: '8px 14px', border: 'none',
                      background: source === key ? 'var(--accent-dark)' : 'white',
                      color: source === key ? 'white' : 'var(--text)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Source detail */}
            {source === 'folder' ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <button type="button" onClick={chooseFolder} disabled={scanning} style={{ ...btn('default'), opacity: scanning ? 0.5 : 1 }}>
                    {folderPath ? 'Choose a different folder' : 'Choose folder'}
                  </button>
                  {folderPath && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{items.length} audio file{items.length === 1 ? '' : 's'} found</span>}
                </div>
                {folderPath && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', marginBottom: 14 }}>
                    {folderPath}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '0.84rem', color: 'var(--text)', marginBottom: 14 }}>
                {items.length > 0
                  ? <><strong>{audiobook?.title || 'This audiobook'}</strong> — {items.length} audio file{items.length === 1 ? '' : 's'} attached.</>
                  : 'This audiobook has no audio files attached yet. Add audio to its chapters first, or switch to “A folder”.'}
              </div>
            )}

            {/* Scan / progress */}
            {items.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                {!scanning ? (
                  <button type="button" onClick={runScan} style={btn('primary')}>
                    {results.length ? 'Check again' : 'Check these files'}
                  </button>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 180, height: 8, background: 'var(--cream)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, height: '100%', background: 'var(--accent-dark)', transition: 'width 0.2s' }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Checking {progress.done} of {progress.total}…</span>
                    <button type="button" onClick={stopScan} style={btn('default')}>Stop</button>
                  </>
                )}
              </div>
            )}

            {error && (
              <div style={{ background: C.failBg, border: `1px solid ${C.failBorder}`, borderRadius: 10, padding: '10px 12px', fontSize: '0.84rem', color: C.fail, marginBottom: 14 }}>{error}</div>
            )}

            {/* Summary */}
            {allChecked && (
              <div style={{
                background: passCount === items.length ? C.passBg : C.failBg,
                border: `1px solid ${passCount === items.length ? C.passBorder : C.failBorder}`,
                borderRadius: 12, padding: '12px 14px', marginBottom: 12, fontSize: '0.92rem', fontWeight: 700,
                color: passCount === items.length ? C.pass : C.fail,
              }}>
                {passCount === items.length
                  ? `All ${items.length} file${items.length === 1 ? '' : 's'} passed 🎉`
                  : `${passCount} of ${items.length} passed — ${items.length - passCount} need${items.length - passCount === 1 ? 's' : ''} a look`}
                {headsUpCount > 0 && <span style={{ fontWeight: 500, color: C.warn }}> ({headsUpCount} with a heads-up)</span>}
                {errorCount > 0 && <span style={{ fontWeight: 500 }}> ({errorCount} couldn&apos;t be read)</span>}
              </div>
            )}

            {/* Batch warnings */}
            {warnings.map((w, i) => (
              <div key={i} style={{ background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 10, padding: '10px 12px', fontSize: '0.84rem', color: 'var(--text)', marginBottom: 10 }}>⚠️ {w}</div>
            ))}

            {/* Per-file results — needs-a-look first once finished */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
              {shownResults.map((r, i) => {
                if (r?.error) {
                  return (
                    <div key={i} style={{ border: `1px solid ${C.failBorder}`, background: C.failBg, borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all' }}>{r.fileName}</div>
                      <div style={{ fontSize: '0.82rem', color: C.fail, marginTop: 3 }}>{r.error}</div>
                    </div>
                  );
                }
                const hardFails = (r.checks || []).filter((c) => !c.ok && c.severity !== 'warn');
                const warns = (r.checks || []).filter((c) => !c.ok && c.severity === 'warn');
                return (
                  <div key={i} style={{ border: `1px solid ${r.pass ? C.passBorder : C.failBorder}`, background: r.pass ? C.passBg : C.failBg, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span aria-hidden="true">{r.pass ? '✅' : '❌'}</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all', flex: 1 }}>{r.fileName}</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 4, marginLeft: 24 }}>{statsLine(r)}</div>
                    {(hardFails.length > 0 || warns.length > 0) && (
                      <ul style={{ margin: '8px 0 0 24px', padding: 0, listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {hardFails.map((c, j) => <li key={`f${j}`} style={{ fontSize: '0.82rem', color: C.fail, lineHeight: 1.4 }}>{c.message}</li>)}
                        {warns.map((c, j) => <li key={`w${j}`} style={{ fontSize: '0.82rem', color: C.warn, lineHeight: 1.4 }}>Heads up: {c.message}</li>)}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--cream)' }}>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', flex: 1, wordBreak: 'break-all' }}>{saveMsg}</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {allChecked && available && (
            <>
              <button type="button" onClick={copyReport} style={smallBtn} title="Copy the report as text">Copy</button>
              <button type="button" onClick={() => saveReport('txt')} style={smallBtn} title="Save the report as a text file">Save text</button>
              <button type="button" onClick={() => saveReport('csv')} style={smallBtn} title="Save the report as a spreadsheet (CSV)">Save CSV</button>
            </>
          )}
          <button type="button" onClick={onClose} style={btn('primary')}>Done</button>
        </div>
      </div>
    </AppDialog>
  );
}
