const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const port = process.env.PORT || '3007';
const appUrl = `http://localhost:${port}`;

function isServerReachable(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });

    req.on('error', () => resolve(false));
  });
}

function waitForServer(url, attempts = 60) {
  return new Promise((resolve, reject) => {
    let remaining = attempts;
    const tryConnect = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        remaining -= 1;
        if (remaining <= 0) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tryConnect, 1000);
      });
    };

    tryConnect();
  });
}

const nextCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const electronCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

let nextProcess = null;
let electronProcess = null;

function shutdown(code = 0) {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill();
  }
  process.exit(code);
}

function launchNextDevServer() {
  nextProcess = spawn(nextCommand, ['next', 'dev', '-p', port], {
    cwd: projectRoot,
    env: { ...process.env, PORT: port },
    stdio: 'inherit',
  });

  nextProcess.on('exit', (code) => {
    if (!electronProcess) {
      process.exit(code || 0);
      return;
    }
    shutdown(code || 0);
  });
}

Promise.resolve()
  .then(async () => {
    const reachable = await isServerReachable(appUrl);
    if (!reachable) {
      launchNextDevServer();
      await waitForServer(appUrl);
    }
  })
  .then(() => {
    electronProcess = spawn(electronCommand, ['electron', '.'], {
      cwd: projectRoot,
      env: { ...process.env, NODE_ENV: 'development', APP_URL: appUrl },
      stdio: 'inherit',
    });

    electronProcess.on('exit', (code) => shutdown(code || 0));
  })
  .catch((error) => {
    console.error(error.message);
    shutdown(1);
  });

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));