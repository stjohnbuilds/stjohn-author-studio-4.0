// Battery for the ACX engine. Two layers:
//   1. Unit tests against REAL ffmpeg 7.1 output strings (captured from the
//      bundled binary) — fast, run everywhere incl. CI.
//   2. Live-ffmpeg integration — generates audio with known properties and
//      runs the exact commands main.js uses. Skipped automatically when
//      bin/ffmpeg-x64 is absent (e.g. CI, where it's gitignored).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const acx = require('../packages/acx-engine/index.cjs');
const __dirname = dirname(fileURLToPath(import.meta.url));
const FFMPEG = join(__dirname, '..', 'bin', 'ffmpeg-x64');

// ── Real captured ffmpeg output ───────────────────────────────────────
const VOL_WAV = `
  Duration: 00:00:08.60, bitrate: 705 kb/s
  Stream #0:0: Audio: pcm_s16le ([1][0][0][0] / 0x0001), 44100 Hz, mono, s16, 705 kb/s
[Parsed_volumedetect_0 @ 0x7f8dd9721b80] mean_volume: -20.1 dB
[Parsed_volumedetect_0 @ 0x7f8dd9721b80] max_volume: -3.2 dB
`;
const STREAM_MP3 = `  Duration: 00:00:08.65, start: 0.025057, bitrate: 192 kb/s
  Stream #0:0: Audio: mp3 (mp3float), 44100 Hz, mono, fltp, 192 kb/s`;
const STREAM_STEREO = `  Stream #0:0: Audio: pcm_s16le ([1][0][0][0] / 0x0001), 44100 Hz, stereo, s16, 1411 kb/s`;
const STREAM_48K = `  Stream #0:0: Audio: pcm_s16le ([1][0][0][0] / 0x0001), 48000 Hz, mono, s16, 768 kb/s`;
const STREAM_COVERART = `  Stream #0:0: Video: mjpeg (Baseline), yuvj420p(pc), 600x600 [SAR 96:96 DAR 1:1], 90k tbr
  Stream #0:1: Audio: mp3 (mp3float), 44100 Hz, mono, fltp, 256 kb/s`;
const HEAD_SILENCE = `[silencedetect @ 0x1] silence_start: 0
[silencedetect @ 0x1] silence_end: 0.600045 | silence_duration: 0.600045
[silencedetect @ 0x1] silence_start: 5.599977
[silencedetect @ 0x1] silence_end: 8.6 | silence_duration: 3.000023`;
const TAIL_SILENCE = `[silencedetect @ 0x2] silence_start: 0
[silencedetect @ 0x2] silence_end: 3.000023 | silence_duration: 3.000023`;

// ── Parser unit tests ─────────────────────────────────────────────────
test('parseVolumeDetect reads mean + max', () => {
  const { meanVolume, maxVolume } = acx.parseVolumeDetect(VOL_WAV);
  assert.equal(meanVolume, -20.1);
  assert.equal(maxVolume, -3.2);
});

test('parseVolumeDetect handles -inf (silent)', () => {
  const { meanVolume } = acx.parseVolumeDetect('mean_volume: -inf dB\nmax_volume: -inf dB');
  assert.equal(meanVolume, -Infinity);
});

test('parseMediaInfo reads wav stream', () => {
  const i = acx.parseMediaInfo(VOL_WAV);
  assert.equal(i.durationSec, 8.6);
  assert.equal(i.sampleRate, 44100);
  assert.equal(i.channels, 1);
  assert.equal(i.codec, 'pcm_s16le');
  assert.equal(i.bitrateKbps, 705);
});

test('parseMediaInfo reads mp3 bitrate + codec', () => {
  const i = acx.parseMediaInfo(STREAM_MP3);
  assert.equal(i.codec, 'mp3');
  assert.equal(i.sampleRate, 44100);
  assert.equal(i.channels, 1);
  assert.equal(i.bitrateKbps, 192);
});

test('parseMediaInfo: stereo + 48k', () => {
  assert.equal(acx.parseMediaInfo(STREAM_STEREO).channels, 2);
  assert.equal(acx.parseMediaInfo(STREAM_48K).sampleRate, 48000);
});

test('parseMediaInfo skips cover-art video stream, picks audio', () => {
  const i = acx.parseMediaInfo(STREAM_COVERART);
  assert.equal(i.codec, 'mp3');
  assert.equal(i.sampleRate, 44100);
  assert.equal(i.bitrateKbps, 256);
});

test('parseLeadingSilence: leading silence -> its end', () => {
  assert.equal(acx.parseLeadingSilence(HEAD_SILENCE), 0.600045);
  assert.equal(acx.parseLeadingSilence(TAIL_SILENCE), 3.000023);
});

test('parseLeadingSilence: no silence at all -> 0', () => {
  assert.equal(acx.parseLeadingSilence(''), 0);
});

test('parseLeadingSilence: first silence not at start -> 0', () => {
  const mid = `silence_start: 4.2\nsilence_end: 5.0 | silence_duration: 0.8`;
  assert.equal(acx.parseLeadingSilence(mid), 0);
});

test('isSampleFile matches _sample only', () => {
  assert.equal(acx.isSampleFile('Book_sample.mp3'), true);
  assert.equal(acx.isSampleFile('Chapter 1.wav'), false);
});

// ── evaluateFile threshold tests ──────────────────────────────────────
const passing = {
  fileName: 'Chapter 1.wav', durationSec: 600, sampleRate: 44100, channels: 1,
  codec: 'pcm_s16le', bitrateKbps: 705, meanVolume: -20.1, maxVolume: -3.5,
  headSec: 0.6, tailSec: 3.0,
};

test('evaluateFile: clean file passes', () => {
  const r = acx.evaluateFile(passing);
  assert.equal(r.pass, true, JSON.stringify(r.checks.filter((c) => !c.ok)));
});

test('evaluateFile: peak above -3 is a heads-up, not a fail', () => {
  const r = acx.evaluateFile({ ...passing, maxVolume: -1.5 });
  const peak = r.checks.find((c) => c.key === 'peak');
  assert.equal(peak.ok, false);          // above the -3 guideline
  assert.equal(peak.severity, 'warn');   // but only a warning
  assert.equal(r.pass, true);            // so the file still passes
  assert.equal(r.hasWarnings, true);
});

test("evaluateFile: Marie's real ACX-accepted file passes (peak -1.5, head 0.96, tail 1.65)", () => {
  const r = acx.evaluateFile({
    fileName: '03_Pack of lies_Chapter 2.mp3', durationSec: 21 * 60 + 16, sampleRate: 44100,
    channels: 1, codec: 'mp3', bitrateKbps: 192, meanVolume: -22.4, maxVolume: -1.5,
    headSec: 0.96, tailSec: 1.65,
  });
  assert.equal(r.pass, true, JSON.stringify(r.checks.filter((c) => !c.ok && c.severity !== 'warn')));
  assert.equal(r.checks.find((c) => c.key === 'head').ok, true);
  assert.equal(r.checks.find((c) => c.key === 'tail').ok, true);
});

test('evaluateFile: RMS too quiet and too loud', () => {
  assert.equal(acx.evaluateFile({ ...passing, meanVolume: -30 }).checks.find((c) => c.key === 'rms').ok, false);
  assert.equal(acx.evaluateFile({ ...passing, meanVolume: -10 }).checks.find((c) => c.key === 'rms').ok, false);
  assert.equal(acx.evaluateFile({ ...passing, meanVolume: -18 }).checks.find((c) => c.key === 'rms').ok, true);
  assert.equal(acx.evaluateFile({ ...passing, meanVolume: -23 }).checks.find((c) => c.key === 'rms').ok, true);
});

test('evaluateFile: wrong sample rate fails', () => {
  assert.equal(acx.evaluateFile({ ...passing, sampleRate: 48000 }).checks.find((c) => c.key === 'sampleRate').ok, false);
});

test('evaluateFile: head/tail bounds (ACX: head 0.5-1, tail 1-5)', () => {
  // head
  assert.equal(acx.evaluateFile({ ...passing, headSec: 0.3 }).checks.find((c) => c.key === 'head').ok, false);
  assert.equal(acx.evaluateFile({ ...passing, headSec: 0.9 }).checks.find((c) => c.key === 'head').ok, true);
  assert.equal(acx.evaluateFile({ ...passing, headSec: 1.0 }).checks.find((c) => c.key === 'head').ok, true);
  assert.equal(acx.evaluateFile({ ...passing, headSec: 1.1 }).checks.find((c) => c.key === 'head').ok, false);
  // tail
  assert.equal(acx.evaluateFile({ ...passing, tailSec: 0.5 }).checks.find((c) => c.key === 'tail').ok, false);
  assert.equal(acx.evaluateFile({ ...passing, tailSec: 1.0 }).checks.find((c) => c.key === 'tail').ok, true);
  assert.equal(acx.evaluateFile({ ...passing, tailSec: 1.65 }).checks.find((c) => c.key === 'tail').ok, true);
  assert.equal(acx.evaluateFile({ ...passing, tailSec: 6.0 }).checks.find((c) => c.key === 'tail').ok, false);
});

test('evaluateFile: over 120 minutes fails length', () => {
  assert.equal(acx.evaluateFile({ ...passing, durationSec: 121 * 60 }).checks.find((c) => c.key === 'length').ok, false);
});

test('evaluateFile: mp3 bitrate bonus check', () => {
  assert.equal(acx.evaluateFile({ ...passing, codec: 'mp3', bitrateKbps: 128 }).checks.find((c) => c.key === 'bitrate').ok, false);
  assert.equal(acx.evaluateFile({ ...passing, codec: 'mp3', bitrateKbps: 192 }).checks.find((c) => c.key === 'bitrate').ok, true);
  // wav has no bitrate check
  assert.equal(acx.evaluateFile(passing).checks.some((c) => c.key === 'bitrate'), false);
});

test('evaluateFile: _sample skips head/tail, caps at 5 min', () => {
  const r = acx.evaluateFile({ ...passing, fileName: 'Book_sample.mp3', codec: 'mp3', bitrateKbps: 256, headSec: 0, tailSec: 0, durationSec: 280 });
  assert.equal(r.checks.find((c) => c.key === 'head').ok, true);
  assert.equal(r.checks.find((c) => c.key === 'tail').ok, true);
  assert.equal(r.checks.find((c) => c.key === 'length').ok, true);
  const tooLong = acx.evaluateFile({ ...passing, fileName: 'Book_sample.mp3', codec: 'mp3', bitrateKbps: 256, durationSec: 360 });
  assert.equal(tooLong.checks.find((c) => c.key === 'length').ok, false);
});

// ── batch + CSV ───────────────────────────────────────────────────────
test('batchWarnings flags mixed sample rate / channels', () => {
  const results = [
    acx.evaluateFile({ ...passing }),
    acx.evaluateFile({ ...passing, sampleRate: 48000, channels: 2 }),
  ];
  const w = acx.batchWarnings(results);
  assert.equal(w.length, 2);
});

test('buildCsv emits a header + one row per file, splitting issues vs notes', () => {
  const csv = acx.buildCsv([
    acx.evaluateFile(passing),                                                  // PASS, clean
    acx.evaluateFile({ ...passing, fileName: 'Loud.wav', maxVolume: -1 }),       // PASS, peak heads-up (Notes)
    acx.evaluateFile({ ...passing, fileName: 'Wrong.wav', sampleRate: 48000 }),  // CHECK, hard fail (Issues)
    { fileName: 'broken.wav', error: 'could not read' },
  ]);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0].startsWith('File,Result'), true);
  assert.match(lines[0], /Issues,Notes$/);
  assert.equal(lines.length, 5);
  assert.match(csv, /PASS/);
  assert.match(csv, /CHECK/);
  assert.match(csv, /could not read/);
  // the loud file passes but carries a peak note in the Notes column
  assert.match(lines[2], /PASS.*guideline/);
});

// ── Live ffmpeg integration ───────────────────────────────────────────
function ffStderr(args) {
  const r = spawnSync(FFMPEG, ['-nostdin', '-hide_banner', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return (r.stderr || '') + (r.stdout || '');
}
function analyzeReal(file) {
  const vol = ffStderr(['-i', file, '-vn', '-sn', '-dn', '-af', 'volumedetect', '-f', 'null', '-']);
  const info = acx.parseMediaInfo(vol);
  const { meanVolume, maxVolume } = acx.parseVolumeDetect(vol);
  const head = acx.isSampleFile(file) ? 0 : acx.parseLeadingSilence(ffStderr(['-i', file, '-vn', '-af', 'silencedetect=n=-60dB:d=0.05', '-f', 'null', '-']));
  const tail = acx.isSampleFile(file) ? 0 : acx.parseLeadingSilence(ffStderr(['-i', file, '-vn', '-af', 'areverse,silencedetect=n=-60dB:d=0.05,areverse', '-f', 'null', '-']));
  return acx.evaluateFile({ fileName: file.split('/').pop(), ...info, meanVolume, maxVolume, headSec: head, tailSec: tail });
}

test('LIVE ffmpeg: real measurements parse + judge correctly', { skip: !fs.existsSync(FFMPEG) }, () => {
  const dir = fs.mkdtempSync(join(os.tmpdir(), 'acx-it-'));
  const gen = (name, args) => { const p = join(dir, name); execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args, p]); return p; };

  // 0.5s silence + 5s sine + 3s silence, mono 44100 -> head/tail in range
  const good = gen('good.wav', [
    '-f', 'lavfi', '-t', '0.6', '-i', 'anullsrc=r=44100:cl=mono',
    '-f', 'lavfi', '-t', '5', '-i', 'sine=frequency=300:r=44100',
    '-f', 'lavfi', '-t', '3', '-i', 'anullsrc=r=44100:cl=mono',
    '-filter_complex', '[1:a]volume=-17dB[s];[0:a][s][2:a]concat=n=3:v=0:a=1[o]', '-map', '[o]', '-ac', '1', '-ar', '44100',
  ]);
  const rGood = analyzeReal(good);
  assert.equal(rGood.measured.sampleRate, 44100);
  assert.equal(rGood.measured.channels, 1);
  // head ~0.6 in [0.5,0.75], tail ~3.0 in [2.5,5]
  assert.equal(rGood.checks.find((c) => c.key === 'head').ok, true, `head=${rGood.measured.headSec}`);
  assert.equal(rGood.checks.find((c) => c.key === 'tail').ok, true, `tail=${rGood.measured.tailSec}`);

  // 48kHz sine -> sample rate must fail
  const sr48 = gen('sr48.wav', ['-f', 'lavfi', '-t', '2', '-i', 'sine=r=48000:frequency=200', '-ar', '48000', '-ac', '1']);
  assert.equal(analyzeReal(sr48).checks.find((c) => c.key === 'sampleRate').ok, false);

  // boosted-to-clipping sine -> peak must fail (>-3 dB)
  const loud = gen('loud.wav', ['-f', 'lavfi', '-t', '2', '-i', 'sine=r=44100:frequency=200', '-af', 'volume=25dB', '-ac', '1', '-ar', '44100']);
  const rLoud = analyzeReal(loud);
  assert.equal(rLoud.checks.find((c) => c.key === 'peak').ok, false, `peak=${rLoud.measured.maxVolume}`);

  // no leading/trailing silence -> head & tail must fail
  const noTone = gen('notone.wav', ['-f', 'lavfi', '-t', '4', '-i', 'sine=frequency=200:r=44100', '-ac', '1', '-ar', '44100']);
  const rNo = analyzeReal(noTone);
  assert.equal(rNo.checks.find((c) => c.key === 'head').ok, false);
  assert.equal(rNo.checks.find((c) => c.key === 'tail').ok, false);

  // stereo detected
  const st = gen('st.wav', ['-f', 'lavfi', '-t', '2', '-i', 'sine=r=44100:frequency=200', '-ac', '2', '-ar', '44100']);
  assert.equal(analyzeReal(st).measured.channels, 2);

  fs.rmSync(dir, { recursive: true, force: true });
});
