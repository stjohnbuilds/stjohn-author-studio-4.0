// Ensures the bundled ffmpeg binary the ACX file checker needs is present
// in bin/ before electron-builder packages the app. Mirrors
// ensure-whisper-model.js: the big binaries are gitignored and fetched on
// demand rather than committed.
//
//   node scripts/ensure-ffmpeg.js mac   -> bin/ffmpeg-x64      (macOS, x86_64; runs natively on Intel
//                                          and under Rosetta on Apple Silicon — same as Second Opinion)
//   node scripts/ensure-ffmpeg.js win   -> bin/ffmpeg-x64.exe  (Windows x64)
//
// If the binary already exists it does nothing. Downloads are best-effort:
// on failure it prints a clear message and exits non-zero so the build stops
// rather than shipping a scanner that can't run.

const fs = require('fs');
const https = require('https');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const binDir = path.join(rootDir, 'bin');

const TARGETS = {
  mac: {
    out: 'ffmpeg-x64',
    url: 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip',
    member: /(^|\/)ffmpeg$/,      // evermeet zip holds a single "ffmpeg"
    chmod: true,
  },
  // Apple-silicon ffmpeg. Without this the app falls back to the Intel
  // ffmpeg-x64 and runs it under Rosetta, which macOS flags (and which
  // breaks on macOS 28+). eugeneware/ffmpeg-static ships a raw arm64
  // binary (not zipped), so this target downloads it directly.
  'mac-arm64': {
    out: 'ffmpeg-arm64',
    url: 'https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/ffmpeg-darwin-arm64',
    raw: true,
    chmod: true,
  },
  win: {
    out: 'ffmpeg-x64.exe',
    url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
    member: /(^|\/)ffmpeg\.exe$/, // BtbN zip holds .../bin/ffmpeg.exe
    chmod: false,
  },
};

function download(url, destination, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'stjohn-author-studio' } }, (response) => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        if (redirectCount > 6) { reject(new Error('Too many redirects.')); return; }
        resolve(download(new URL(response.headers.location, url).toString(), destination, redirectCount + 1));
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Download failed (HTTP ${status}) for ${url}`));
        return;
      }
      const total = Number(response.headers['content-length']) || 0;
      let received = 0;
      let lastPct = -1;
      const file = fs.createWriteStream(destination);
      response.on('data', (chunk) => {
        received += chunk.length;
        if (total) {
          const pct = Math.floor((received / total) * 100);
          if (pct !== lastPct && pct % 10 === 0) { process.stdout.write(`  ${pct}%\r`); lastPct = pct; }
        }
      });
      response.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', (err) => { fs.unlink(destination, () => reject(err)); });
    });
    request.on('error', reject);
  });
}

async function ensure(targetKey) {
  const target = TARGETS[targetKey];
  if (!target) { throw new Error(`Unknown target "${targetKey}". Use "mac" or "win".`); }
  const outPath = path.join(binDir, target.out);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1024 * 1024) {
    console.log(`ffmpeg: ${target.out} already present — skipping.`);
    return;
  }
  fs.mkdirSync(binDir, { recursive: true });

  // Raw targets are a bare binary, not a zip — download straight to bin/.
  if (target.raw) {
    console.log(`ffmpeg: downloading ${target.out} …`);
    await download(target.url, outPath);
    if (target.chmod) fs.chmodSync(outPath, 0o755);
    console.log(`\nffmpeg: wrote ${path.relative(rootDir, outPath)} (${Math.round(fs.statSync(outPath).size / 1024 / 1024)} MB).`);
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-dl-'));
  const zipPath = path.join(tmpDir, 'ffmpeg.zip');
  console.log(`ffmpeg: downloading ${target.out} …`);
  await download(target.url, zipPath);
  console.log(`\nffmpeg: extracting …`);
  const extractDir = path.join(tmpDir, 'x');
  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync('unzip', ['-qo', zipPath, '-d', extractDir]);

  // Find the binary inside the extracted tree.
  const found = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (target.member.test(p.replace(/\\/g, '/'))) found.push(p);
    }
  };
  walk(extractDir);
  if (!found.length) { throw new Error('Could not find the ffmpeg binary in the downloaded archive.'); }
  fs.copyFileSync(found[0], outPath);
  if (target.chmod) fs.chmodSync(outPath, 0o755);
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  console.log(`ffmpeg: wrote ${path.relative(rootDir, outPath)} (${Math.round(fs.statSync(outPath).size / 1024 / 1024)} MB).`);
}

const arg = (process.argv[2] || '').toLowerCase();
// "mac" fetches BOTH the Intel and Apple-silicon ffmpeg so the packaged
// app is native on Apple silicon and still runs on Intel Macs.
const expand = (k) => (k === 'mac' ? ['mac', 'mac-arm64'] : [k]);
const keys = arg ? expand(arg) : (process.platform === 'win32' ? ['win'] : ['mac', 'mac-arm64']);

(async () => {
  for (const key of keys) {
    await ensure(key);
  }
})().catch((err) => {
  console.error(`\nffmpeg: ${err.message}`);
  console.error('The ACX file checker needs ffmpeg in bin/. Fix the download or copy a static ffmpeg there manually.');
  process.exit(1);
});
