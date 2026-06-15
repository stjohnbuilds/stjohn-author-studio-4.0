// ACX engine — the one place that knows the ACX audio rules and how to
// read ffmpeg's output. Pure functions only: NO electron, NO fs, NO spawn.
// main.js runs ffmpeg and feeds the raw stderr text in here; this module
// parses it, judges each file against the ACX limits, and formats the
// plain-English report + CSV. Kept framework-free so tests/acx-engine.test.mjs
// can exercise it with canned ffmpeg output (Marie's "battery" method).
//
// Why ffmpeg (not Web Audio): this mirrors Steven Jay Cohen's "Second
// Opinion" tool exactly — same volumedetect (RMS/peak) + silencedetect
// (head/tail room tone) measurements, so the numbers agree with the tool
// Marie already trusts. Second Opinion does NOT check bitrate; we add a
// simple MP3-only bitrate check as a clearly-labelled bonus.

'use strict';

// ── ACX limits ────────────────────────────────────────────────────────
// These are Second Opinion's shipped defaults (Steven Jay Cohen's
// recommended ACX targets). Tweak here if Marie ever wants different
// numbers — every check reads from this one object.
const ACX = {
  maxPeak: -3,            // dB — loudest point must be at or below this
  minRMS: -23,            // dB — average loudness floor
  maxRMS: -18,            // dB — average loudness ceiling
  maxFloor: -60,          // dB — the "this counts as silence" threshold
  minHead: 0.5,           // sec — room tone at the start (min) — ACX: 0.5–1
  maxHead: 1.0,           // sec — room tone at the start (max) — ACX: 0.5–1
  minTail: 1.0,           // sec — room tone at the end (min) — ACX: 1–5
  maxTail: 5.0,           // sec — room tone at the end (max) — ACX: 1–5
  detectDuration: 0.05,   // sec — silencedetect d= (detection granularity)
  sampleRate: 44100,      // Hz — ACX requires 44.1kHz
  minBitrateKbps: 192,    // kbps — bonus, MP3 only
  maxMinutes: 120,        // per-file length cap
  maxSampleMinutes: 5,    // retail-sample length cap
};

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'm4a', 'm4b', 'aac', 'ogg', 'opus', 'aif', 'aiff', 'wma'];

// A file whose name ends in _sample.<ext> is an ACX retail sample: it gets
// NO head/tail room-tone requirement and a 5-minute length cap instead.
function isSampleFile(name) {
  return /_sample\.[a-z0-9]+$/i.test(String(name || ''));
}

// ── Parsers (read ffmpeg's stderr text) ───────────────────────────────

// volumedetect prints "mean_volume: -20.1 dB" and "max_volume: -3.2 dB".
// Pure-silence files print "-inf" — return null for those (shown as N/A).
function parseVolumeDetect(stderr) {
  const text = String(stderr || '');
  const grab = (label) => {
    const m = text.match(new RegExp(label + ':\\s*(-?(?:\\d+(?:\\.\\d+)?|inf))\\s*dB'));
    if (!m) return null;
    if (/inf/i.test(m[1])) return -Infinity;
    return parseFloat(m[1]);
  };
  return { meanVolume: grab('mean_volume'), maxVolume: grab('max_volume') };
}

// Reads the first AUDIO stream line + the Duration line. mp3s can carry an
// embedded cover-art Video stream, so we must pick the Audio stream, not
// just the first Stream line.
function parseMediaInfo(stderr) {
  const text = String(stderr || '');

  let durationSec = null;
  const dm = text.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (dm) durationSec = (+dm[1]) * 3600 + (+dm[2]) * 60 + parseFloat(dm[3]);

  // First audio stream line, e.g.
  //   Stream #0:0: Audio: mp3, 44100 Hz, mono, fltp, 192 kb/s
  const audioLine = text.split('\n').find((l) => /Stream #\d+:\d+.*:\s*Audio:/.test(l)) || '';

  let sampleRate = null;
  const sr = audioLine.match(/(\d{3,6})\s*Hz/);
  if (sr) sampleRate = parseInt(sr[1], 10);

  let channels = null;
  if (/\bmono\b/.test(audioLine)) channels = 1;
  else if (/\bstereo\b/.test(audioLine)) channels = 2;
  else {
    const chN = audioLine.match(/(\d+)\s*channels/);
    if (chN) channels = parseInt(chN[1], 10);
  }

  const codecMatch = audioLine.match(/Audio:\s*([A-Za-z0-9_]+)/);
  const codec = codecMatch ? codecMatch[1].toLowerCase() : null;

  // Bitrate: take the LAST "NNN kb/s" on the audio stream line (the stream's
  // own bitrate, not the container's). Fall back to the Duration line.
  let bitrateKbps = null;
  const streamRates = [...audioLine.matchAll(/(\d+)\s*kb\/s/g)];
  if (streamRates.length) bitrateKbps = parseInt(streamRates[streamRates.length - 1][1], 10);
  else {
    const cb = text.match(/Duration:[^\n]*bitrate:\s*(\d+)\s*kb\/s/);
    if (cb) bitrateKbps = parseInt(cb[1], 10);
  }

  return { durationSec, sampleRate, channels, codec, bitrateKbps };
}

// silencedetect prints pairs of "silence_start: X" / "silence_end: Y".
// We only want silence that LEADS the stream (start at ~0). For the tail
// check the audio is reversed first, so leading silence in the reversed
// stream == trailing silence in the real file. Returns seconds (0 if the
// file does not open with silence — e.g. audio starts immediately).
function parseLeadingSilence(stderr) {
  const text = String(stderr || '');
  const startMatch = text.match(/silence_start:\s*(-?[\d.]+)/);
  if (!startMatch) return 0;
  const start = parseFloat(startMatch[1]);
  if (!(start <= 0.1)) return 0; // first silence isn't at the very start
  const endMatch = text.match(/silence_end:\s*([\d.]+)/);
  if (!endMatch) return 0;
  return parseFloat(endMatch[1]);
}

// ── Formatting helpers ────────────────────────────────────────────────

function formatDuration(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function fmtDb(v) {
  if (v === null || v === undefined) return 'N/A';
  if (v === -Infinity) return 'silent';
  return `${v.toFixed(1)} dB`;
}

// ── The judgement ─────────────────────────────────────────────────────
// Build the per-file result from already-parsed measurements. `acx`
// defaults to the ACX object above but is injectable for tests.
function evaluateFile(measured, acx = ACX) {
  const {
    fileName,
    durationSec,
    sampleRate,
    channels,
    codec,
    bitrateKbps,
    meanVolume,
    maxVolume,
    headSec,
    tailSec,
  } = measured;

  const sample = isSampleFile(fileName);
  const checks = [];
  const add = (key, label, ok, value, message) =>
    checks.push({ key, label, ok, value, message: ok ? '' : message });

  // Peak — loudest point must be <= -3 dB
  if (typeof maxVolume === 'number') {
    const ok = maxVolume <= acx.maxPeak;
    add('peak', 'Peak loudness', ok, fmtDb(maxVolume),
      `Too loud at its peak (${fmtDb(maxVolume)}). The loudest point needs to be ${acx.maxPeak} dB or quieter.`);
  } else {
    add('peak', 'Peak loudness', false, 'N/A', `Could not measure the peak loudness.`);
  }

  // Average loudness (RMS) — between -23 and -18 dB
  if (typeof meanVolume === 'number' && meanVolume !== -Infinity) {
    const ok = meanVolume >= acx.minRMS && meanVolume <= acx.maxRMS;
    const why = meanVolume < acx.minRMS
      ? `Average volume ${fmtDb(meanVolume)} is too quiet — it needs to be between ${acx.minRMS} and ${acx.maxRMS} dB.`
      : `Average volume ${fmtDb(meanVolume)} is too loud — it needs to be between ${acx.minRMS} and ${acx.maxRMS} dB.`;
    add('rms', 'Average loudness', ok, fmtDb(meanVolume), why);
  } else {
    add('rms', 'Average loudness', false, fmtDb(meanVolume), `Could not measure the average loudness.`);
  }

  // Sample rate — must be 44.1kHz
  {
    const ok = sampleRate === acx.sampleRate;
    add('sampleRate', 'Sample rate', ok,
      sampleRate ? `${sampleRate.toLocaleString()} Hz` : 'N/A',
      `Sample rate is ${sampleRate ? sampleRate.toLocaleString() + ' Hz' : 'unknown'} — ACX needs 44,100 Hz (44.1kHz).`);
  }

  // Channels — mono or stereo (consistency across files is checked in the batch)
  {
    const ok = channels === 1 || channels === 2;
    const label = channels === 1 ? 'mono' : channels === 2 ? 'stereo' : (channels ? `${channels} channels` : 'unknown');
    add('channels', 'Channels', ok, label,
      `This file is ${label} — ACX needs mono or stereo.`);
  }

  // Head / tail room tone — skipped for retail-sample files
  if (sample) {
    add('head', 'Start room tone', true, 'sample — not needed', '');
    add('tail', 'End room tone', true, 'sample — not needed', '');
  } else {
    const headH = Math.round((Number(headSec) || 0) * 100);
    const headOk = headH >= acx.minHead * 100 && headH <= acx.maxHead * 100;
    const headVal = `${((headH) / 100).toFixed(2)} sec`;
    add('head', 'Start room tone', headOk, headVal,
      headH < acx.minHead * 100
        ? `Only ${headVal} of quiet at the start — needs ${acx.minHead}–${acx.maxHead} sec of room tone.`
        : `${headVal} of quiet at the start — too much, needs ${acx.minHead}–${acx.maxHead} sec.`);

    const tailH = Math.round((Number(tailSec) || 0) * 100);
    const tailOk = tailH >= acx.minTail * 100 && tailH <= acx.maxTail * 100;
    const tailVal = `${((tailH) / 100).toFixed(2)} sec`;
    add('tail', 'End room tone', tailOk, tailVal,
      tailH < acx.minTail * 100
        ? `Only ${tailVal} of quiet at the end — needs ${acx.minTail}–${acx.maxTail} sec of room tone.`
        : `${tailVal} of quiet at the end — too much, needs ${acx.minTail}–${acx.maxTail} sec.`);
  }

  // Length cap
  {
    const limit = (sample ? acx.maxSampleMinutes : acx.maxMinutes) * 60;
    const ok = typeof durationSec === 'number' ? durationSec <= limit : false;
    add('length', 'Length', ok, formatDuration(durationSec),
      sample
        ? `Retail sample is ${formatDuration(durationSec)} — must be ${acx.maxSampleMinutes} minutes or less.`
        : `File is ${formatDuration(durationSec)} — ACX limit is ${acx.maxMinutes} minutes.`);
  }

  // Bitrate — BONUS, MP3 only (Second Opinion does not check this)
  if (codec === 'mp3') {
    if (typeof bitrateKbps === 'number') {
      const ok = bitrateKbps >= acx.minBitrateKbps;
      add('bitrate', 'MP3 bitrate', ok, `${bitrateKbps} kbps`,
        `MP3 bitrate is ${bitrateKbps} kbps — ACX needs ${acx.minBitrateKbps} kbps or higher.`);
    } else {
      add('bitrate', 'MP3 bitrate', false, 'N/A', `Could not read the MP3 bitrate.`);
    }
  }

  const pass = checks.every((c) => c.ok);
  return {
    fileName,
    pass,
    sample,
    checks,
    measured: { durationSec, sampleRate, channels, codec, bitrateKbps, meanVolume, maxVolume, headSec, tailSec },
  };
}

// ── Batch-level consistency (a real ACX rule: files must match) ───────
function batchWarnings(results) {
  const ok = results.filter((r) => r && !r.error);
  const warnings = [];
  const rates = new Set(ok.map((r) => r.measured?.sampleRate).filter(Boolean));
  if (rates.size > 1) {
    warnings.push(`Your files don't all use the same sample rate (${[...rates].map((r) => r.toLocaleString()).join(', ')} Hz). ACX wants every file the same.`);
  }
  const chans = new Set(ok.map((r) => r.measured?.channels).filter(Boolean));
  if (chans.size > 1) {
    const label = (c) => (c === 1 ? 'mono' : c === 2 ? 'stereo' : `${c}ch`);
    warnings.push(`Your files aren't all the same — some are ${[...chans].map(label).join(', ')}. ACX wants every file the same.`);
  }
  return warnings;
}

// ── CSV (download report) ─────────────────────────────────────────────
function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(results) {
  const header = ['File', 'Result', 'Length', 'Channels', 'Sample rate', 'Avg loudness', 'Peak', 'Start tone', 'End tone', 'MP3 bitrate', 'Issues'];
  const rows = [header.map(csvCell).join(',')];
  for (const r of results) {
    if (!r) continue;
    if (r.error) {
      rows.push([r.fileName, 'Could not read', '', '', '', '', '', '', '', '', r.error].map(csvCell).join(','));
      continue;
    }
    const get = (k) => r.checks.find((c) => c.key === k);
    const issues = r.checks.filter((c) => !c.ok).map((c) => c.message).join(' ');
    rows.push([
      r.fileName,
      r.pass ? 'PASS' : 'CHECK',
      get('length')?.value || '',
      get('channels')?.value || '',
      get('sampleRate')?.value || '',
      get('rms')?.value || '',
      get('peak')?.value || '',
      get('head')?.value || '',
      get('tail')?.value || '',
      get('bitrate')?.value || 'n/a',
      issues,
    ].map(csvCell).join(','));
  }
  return rows.join('\n') + '\n';
}

module.exports = {
  ACX,
  AUDIO_EXTENSIONS,
  isSampleFile,
  parseVolumeDetect,
  parseMediaInfo,
  parseLeadingSilence,
  evaluateFile,
  batchWarnings,
  buildCsv,
  formatDuration,
  fmtDb,
};
