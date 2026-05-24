const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const mode = process.argv[2];
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packagedReleaseDir = path.join(rootDir, 'Script and Sync Releases');
const archivedReleaseDir = path.join(packagedReleaseDir, 'Old');

const WINDOWS_RELEASE_NAME = 'Script and Sync (Windows).exe';
const WINDOWS_PORTABLE_BUILD_NAME = 'Script and Sync (Portable).exe';
const WINDOWS_SETUP_NAME = 'Script and Sync Setup.exe';
const MAC_RELEASE_NAME = 'Script and Sync.app';

if (!mode || !['mac', 'win'].includes(mode)) {
  console.error('Usage: node scripts/copy-release.js <mac|win>');
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  console.error('dist folder not found. Run the build first.');
  process.exit(1);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildArchiveStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

function uniqueTargetPath(targetPath) {
  if (!fs.existsSync(targetPath)) return targetPath;
  const parsed = path.parse(targetPath);
  let attempt = 2;
  while (true) {
    const candidate = path.join(parsed.dir, `${parsed.name} (${attempt})${parsed.ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    attempt += 1;
  }
}

function runCommand(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, { stdio: 'pipe' });
  if (result.error) {
    if (allowFailure) return false;
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim();
    if (allowFailure) return false;
    throw new Error(stderr || `${command} failed with code ${result.status}`);
  }
  return true;
}

function movePath(sourcePath, targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
  try {
    fs.renameSync(sourcePath, targetPath);
    return;
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
  }

  const stats = fs.statSync(sourcePath);
  if (stats.isDirectory()) runCommand('ditto', [sourcePath, targetPath]);
  else fs.copyFileSync(sourcePath, targetPath);
  fs.rmSync(sourcePath, { recursive: true, force: true });
}

function archiveExistingArtifact(sourcePath, archivedFileName) {
  if (!fs.existsSync(sourcePath)) return null;
  ensureDir(archivedReleaseDir);
  const archivedTarget = uniqueTargetPath(path.join(archivedReleaseDir, archivedFileName));
  movePath(sourcePath, archivedTarget);
  return archivedTarget;
}

function repairMacAppBundle(targetPath) {
  runCommand('xattr', ['-cr', targetPath], { allowFailure: true });
  runCommand('codesign', ['--force', '--deep', '--sign', '-', targetPath]);
}

function findMacApps() {
  const matches = [];
  for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('mac')) continue;
    const candidateDir = path.join(distDir, entry.name);
    for (const nested of fs.readdirSync(candidateDir, { withFileTypes: true })) {
      if (!nested.isDirectory() || !nested.name.endsWith('.app')) continue;
      const fullPath = path.join(candidateDir, nested.name);
      const stats = fs.statSync(fullPath);
      matches.push({ fullPath, name: nested.name, mtimeMs: stats.mtimeMs });
    }
  }
  return matches.sort((left, right) => right.mtimeMs - left.mtimeMs);
}

if (mode === 'win') {
  ensureDir(packagedReleaseDir);
  const archiveStamp = buildArchiveStamp();

  archiveExistingArtifact(
    path.join(packagedReleaseDir, WINDOWS_RELEASE_NAME),
    `Script and Sync (Windows) old ${archiveStamp}.exe`,
  );
  archiveExistingArtifact(
    path.join(packagedReleaseDir, WINDOWS_PORTABLE_BUILD_NAME),
    `Script and Sync Portable old ${archiveStamp}.exe`,
  );
  archiveExistingArtifact(
    path.join(packagedReleaseDir, WINDOWS_SETUP_NAME),
    `Script and Sync Setup old ${archiveStamp}.exe`,
  );

  const copied = [];
  const builtPortablePath = path.join(distDir, WINDOWS_PORTABLE_BUILD_NAME);
  const builtSetupPath = path.join(distDir, WINDOWS_SETUP_NAME);

  if (fs.existsSync(builtPortablePath)) {
    const releasePortablePath = path.join(packagedReleaseDir, WINDOWS_RELEASE_NAME);
    fs.copyFileSync(builtPortablePath, releasePortablePath);
    copied.push(releasePortablePath);
  }

  if (fs.existsSync(builtSetupPath)) {
    const releaseSetupPath = path.join(packagedReleaseDir, WINDOWS_SETUP_NAME);
    fs.copyFileSync(builtSetupPath, releaseSetupPath);
    copied.push(releaseSetupPath);
  }

  if (!copied.length) {
    console.error('No current Windows .exe artifacts were found in dist.');
    process.exit(1);
  }

  console.log(`Copied ${copied.length} Windows artifact(s) to ${packagedReleaseDir}`);
  process.exit(0);
}

const macApps = findMacApps();

if (!macApps.length) {
  console.error('No Mac release artifacts were found in dist.');
  process.exit(1);
}

const latestApp = macApps[0];
ensureDir(packagedReleaseDir);
archiveExistingArtifact(
  path.join(packagedReleaseDir, MAC_RELEASE_NAME),
  `Script and Sync old ${buildArchiveStamp()}.app`,
);

const packagedAppPath = path.join(packagedReleaseDir, MAC_RELEASE_NAME);
movePath(latestApp.fullPath, packagedAppPath);
repairMacAppBundle(packagedAppPath);
console.log(`Moved Mac app bundle to ${packagedAppPath}`);
