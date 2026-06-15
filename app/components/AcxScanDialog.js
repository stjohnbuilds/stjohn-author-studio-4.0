'use client';
//
// AcxScanDialog — "Check files for ACX" tool, opened from the proofer's
// ⚙ Settings. Pick a folder of finished audio files and it measures each
// one against ACX's submission rules (peak, average loudness, room tone at
// the start/end, 44.1kHz, mono/stereo, length) using the bundled ffmpeg —
// the same measurements as Steven Jay Cohen's "Second Opinion" tool.
//
// All the heavy lifting (ffmpeg + the ACX rules) lives in main.js +
// packages/acx-engine. This component only drives it and shows the result
// in plain English. Uses the shared <AppDialog> for accessibility.

import { useEffect, useRef, useState, useCallback } from 'react';
import AppDialog from './AppDialog';

const C = {
  pass: '#15803d',
  passBg: '#eaf6ee',
  passBorder: '#bfe3cb',
  fail: '#b4232a',
  failBg: '#fbecec',
  failBorder: '#f0c4c4',
  warn: '#8a6a0a',
  warnBg: '#fdf6e3',
  warnBorder: '#ecdca6',
};

const btn = (kind) => ({
  fontSize: '0.85rem',
  fontWeight: 700,
  cursor: 'pointer',
  padding: '9px 14px',
  borderRadius: 10,
  border: kind === 'primary' ? '1px solid var(--accent-dark)' : '1px solid var(--border)',
  background: kind === 'primary' ? 'var(--accent-dark)' : 'white',
  color: kind === 'primary' ? 'white' : 'var(--text)',
});

function statsLine(result) {
  const get = (k) => result.checks?.find((c) => c.key === k)?.value;
  const parts = [
    get('length'),
    get('channels'),
    get('sampleRate'),
    get('rms') ? `${get('rms')} avg` : null,
    get('peak') ? `${get('peak')} peak` : null,
    get('bitrate') ? `${get('bitrate')}` : null,
  ].filter(Boolean);
  return parts.join('  ·  ');
}

export default function AcxScanDialog({ open, onClose, isElectron }) {
  const [info, setInfo] = useState(null);          // { available }
  const [folderPath, setFolderPath] = useState('');
  const [files, setFiles] = useState([]);          // [name]
  const [results, setResults] = useState([]);      // [result]
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const runToken = useRef(0);

  // Check the tool is available whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setError('');
    setSaveMsg('');
    if (isElectron && window.electron?.acxGetInfo) {
      window.electron.acxGetInfo().then(setInfo).catch(() => setInfo({ available: false }));
    } else {
      setInfo({ available: false });
    }
  }, [open, isElectron]);

  // Stop any in-flight scan when the dialog closes.
  useEffect(() => {
    if (!open) { runToken.current += 1; setScanning(false); }
  }, [open]);

  const chooseFolder = useCallback(async () => {
    setError('');
    setSaveMsg('');
    try {
      const picked = await window.electron.acxPickFolder();
      if (!picked) return; // cancelled
      setFolderPath(picked.folderPath);
      setFiles(picked.files || []);
      setResults([]);
      setProgress({ done: 0, total: picked.files?.length || 0 });
      if (!picked.files || picked.files.length === 0) {
        setError('No audio files in that folder. Pick the folder that holds your finished MP3 or WAV files.');
      }
    } catch (e) {
      setError(e?.message || 'Could not open that folder.');
    }
  }, []);

  const runScan = useCallback(async () => {
    if (!folderPath || !files.length) return;
    setError('');
    setSaveMsg('');
    setResults([]);
    setScanning(true);
    setProgress({ done: 0, total: files.length });
    const token = ++runToken.current;
    const collected = [];
    for (let i = 0; i < files.length; i += 1) {
      if (token !== runToken.current) return; // cancelled / closed
      let res;
      try {
        res = await window.electron.acxAnalyzeFile({ folderPath, fileName: files[i] });
      } catch (e) {
        res = { fileName: files[i], error: e?.message || 'Could not check this file.' };
      }
      if (token !== runToken.current) return;
      collected.push(res);
      setResults([...collected]);
      setProgress({ done: i + 1, total: files.length });
    }
    setScanning(false);
  }, [folderPath, files]);

  const stopScan = useCallback(() => { runToken.current += 1; setScanning(false); }, []);

  const saveReport = useCallback(async () => {
    setSaveMsg('');
    try {
      const name = folderPath ? `ACX-check — ${folderPath.split(/[\\/]/).pop()}.csv` : 'ACX-check.csv';
      const saved = await window.electron.acxSaveReport({ results, defaultName: name });
      if (saved) setSaveMsg(`Saved report to ${saved}`);
    } catch (e) {
      setError(e?.message || 'Could not save the report.');
    }
  }, [results, folderPath]);

  if (!open) return null;

  const done = results.filter((r) => r && !r.error);
  const passCount = done.filter((r) => r.pass).length;
  const errorCount = results.filter((r) => r && r.error).length;
  const allChecked = !scanning && results.length === files.length && files.length > 0;

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

  const available = info?.available;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      ariaLabel="Check files for ACX"
      panelStyle={{
        // Fixed height so the window never grows/jumps as results stream in —
        // the results list scrolls inside instead.
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
            Pick a folder of finished audio files. I&apos;ll check each one against ACX&apos;s rules and tell you what&apos;s wrong in plain words.
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
            {/* Step 1 — choose folder */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <button type="button" onClick={chooseFolder} disabled={scanning} style={{ ...btn('default'), opacity: scanning ? 0.5 : 1 }}>
                {folderPath ? 'Choose a different folder' : 'Choose folder'}
              </button>
              {folderPath && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {files.length} audio file{files.length === 1 ? '' : 's'} found
                </span>
              )}
            </div>
            {folderPath && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all', background: 'var(--cream)', border: '1px solid var(--border-light, var(--border))', borderRadius: 8, padding: '7px 10px', marginBottom: 14 }}>
                {folderPath}
              </div>
            )}

            {/* Step 2 — scan / progress */}
            {files.length > 0 && (
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
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      Checking {progress.done} of {progress.total}…
                    </span>
                    <button type="button" onClick={stopScan} style={btn('default')}>Stop</button>
                  </>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ background: C.failBg, border: `1px solid ${C.failBorder}`, borderRadius: 10, padding: '10px 12px', fontSize: '0.84rem', color: C.fail, marginBottom: 14 }}>
                {error}
              </div>
            )}

            {/* Summary */}
            {allChecked && (
              <div style={{
                background: passCount === files.length ? C.passBg : C.failBg,
                border: `1px solid ${passCount === files.length ? C.passBorder : C.failBorder}`,
                borderRadius: 12, padding: '12px 14px', marginBottom: 12,
                fontSize: '0.92rem', fontWeight: 700,
                color: passCount === files.length ? C.pass : C.fail,
              }}>
                {passCount === files.length
                  ? `All ${files.length} file${files.length === 1 ? '' : 's'} passed 🎉`
                  : `${passCount} of ${files.length} passed — ${files.length - passCount} need${files.length - passCount === 1 ? 's' : ''} a look`}
                {errorCount > 0 && <span style={{ fontWeight: 500 }}> ({errorCount} couldn&apos;t be read)</span>}
              </div>
            )}

            {/* Batch warnings */}
            {warnings.map((w, i) => (
              <div key={i} style={{ background: C.warnBg, border: `1px solid ${C.warnBorder}`, borderRadius: 10, padding: '10px 12px', fontSize: '0.84rem', color: 'var(--text)', marginBottom: 10 }}>
                ⚠️ {w}
              </div>
            ))}

            {/* Per-file results */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
              {results.map((r, i) => {
                if (r?.error) {
                  return (
                    <div key={i} style={{ border: `1px solid ${C.failBorder}`, background: C.failBg, borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all' }}>{r.fileName}</div>
                      <div style={{ fontSize: '0.82rem', color: C.fail, marginTop: 3 }}>{r.error}</div>
                    </div>
                  );
                }
                const fails = (r.checks || []).filter((c) => !c.ok);
                return (
                  <div key={i} style={{
                    border: `1px solid ${r.pass ? C.passBorder : C.failBorder}`,
                    background: r.pass ? C.passBg : C.failBg,
                    borderRadius: 10, padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span aria-hidden="true">{r.pass ? '✅' : '❌'}</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all', flex: 1 }}>{r.fileName}</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 4, marginLeft: 24 }}>{statsLine(r)}</div>
                    {fails.length > 0 && (
                      <ul style={{ margin: '8px 0 0 24px', padding: 0, listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {fails.map((c, j) => (
                          <li key={j} style={{ fontSize: '0.82rem', color: C.fail, lineHeight: 1.4 }}>{c.message}</li>
                        ))}
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
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flex: 1, wordBreak: 'break-all' }}>{saveMsg}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {allChecked && available && (
            <button type="button" onClick={saveReport} style={btn('default')}>Download report</button>
          )}
          <button type="button" onClick={onClose} style={btn('primary')}>Done</button>
        </div>
      </div>
    </AppDialog>
  );
}
