const fs = require('fs');
const https = require('https');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const binDir = path.join(rootDir, 'bin');
const modelName = 'ggml-base.en.bin';
const modelPath = path.join(binDir, modelName);
const tempPath = modelPath + '.download';
const modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';
const minimumBytes = 100 * 1024 * 1024;

function formatMb(bytes) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

function existingModelLooksValid() {
  try {
    return fs.existsSync(modelPath) && fs.statSync(modelPath).size >= minimumBytes;
  } catch {
    return false;
  }
}

function download(url, destination, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const status = response.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        if (redirectCount > 5) {
          reject(new Error('Too many redirects while downloading Whisper model.'));
          return;
        }
        resolve(download(new URL(response.headers.location, url).toString(), destination, redirectCount + 1));
        return;
      }

      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${status}`));
        return;
      }

      const total = Number(response.headers['content-length']) || 0;
      let received = 0;
      let lastLog = Date.now();
      const output = fs.createWriteStream(destination);

      response.on('data', (chunk) => {
        received += chunk.length;
        const now = Date.now();
        if (now - lastLog > 5000) {
          lastLog = now;
          const suffix = total ? ` / ${formatMb(total)}` : '';
          console.log(`Downloading ${modelName}: ${formatMb(received)}${suffix}`);
        }
      });

      response.pipe(output);
      output.on('finish', () => output.close(resolve));
      output.on('error', reject);
    });

    request.setTimeout(10 * 60 * 1000, () => {
      request.destroy(new Error('Timed out while downloading Whisper model.'));
    });
    request.on('error', reject);
  });
}

async function main() {
  if (existingModelLooksValid()) {
    console.log(`Whisper model ready: bin/${modelName} (${formatMb(fs.statSync(modelPath).size)})`);
    return;
  }

  if (process.env.SKIP_WHISPER_MODEL_DOWNLOAD === '1') {
    throw new Error(`Missing bin/${modelName}. Unset SKIP_WHISPER_MODEL_DOWNLOAD to download it.`);
  }

  fs.mkdirSync(binDir, { recursive: true });
  try { fs.rmSync(tempPath, { force: true }); } catch {}

  console.log(`Downloading fast Whisper model to bin/${modelName}...`);
  await download(modelUrl, tempPath);

  const bytes = fs.statSync(tempPath).size;
  if (bytes < minimumBytes) {
    try { fs.rmSync(tempPath, { force: true }); } catch {}
    throw new Error(`Downloaded model is too small (${formatMb(bytes)}).`);
  }

  fs.renameSync(tempPath, modelPath);
  console.log(`Whisper model ready: bin/${modelName} (${formatMb(bytes)})`);
}

main().catch((error) => {
  try { fs.rmSync(tempPath, { force: true }); } catch {}
  console.error(error.message || error);
  process.exit(1);
});
