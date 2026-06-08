const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const { execFile, spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');
const { parseWhisperJsonWords } = require('./packages/audio-engine/whisper-json.cjs');

// Module-level reference to the main window so the auto-updater's
// async events (update-available / download-progress / update-
// downloaded) can post messages to the renderer without threading the
// window through every callback.
let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development';
// 4.0 rebrand: Save Data folder is now under "StJohn Author Studio". If
// you want to migrate books from a Script and Sync 3.0 install, open
// Settings inside the app and point Save Folder at the old location.
const APP_FOLDER_NAME = 'StJohn Author Studio';
const SAVE_DATA_FOLDER_NAME = 'Save Data';
const DRIVE_SUBFOLDER = path.join('Game Dev', 'GitHub');
const WHISPER_DEFAULT_MODEL = 'ggml-base.en.bin';
const WHISPER_MODEL_CANDIDATES = [
  WHISPER_DEFAULT_MODEL,
  'ggml-small.en.bin',
  'ggml-large-v3-turbo.bin',
];
const CURRENT_PLATFORM_KEY = process.platform;
const WINDOWS_APP_USER_MODEL_ID = 'com.stjohnbuilds.authorstudio';
let staticServer = null;

// Path-boundary helpers — Block 3a (audit findings SAS-AUD-20260602-016
// + -017). Use these for ANY file path built from data that came from
// outside the app (imported books, transfer manifests, IPC payloads).
// Inlined here (instead of `require('./packages/cloud-sync/path-safety.cjs')`)
// because that cross-file require kept resolving to "cannot find module"
// on Marie's installed Windows build even though the .cjs WAS in the
// asar — Wine-cross-compiled asar quirk for non-root paths under
// /packages/. The regression tests still import the .cjs version
// directly (tests/path-boundary.test.mjs); this inline copy is byte-
// identical to that file's exports.
function assertResolvedInsideDir(rootDir, candidate) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, candidate);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error(`Refused unsafe path: "${candidate}" would resolve outside ${rootDir}.`);
  }
  return resolved;
}
function safeJoinInsideDir(rootDir, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.length) {
    throw new Error('Refused unsafe path: empty input.');
  }
  if (/^[\\/]/.test(relativePath)) {
    throw new Error(`Refused unsafe path: absolute input ${JSON.stringify(relativePath)}.`);
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(relativePath)) {
    throw new Error(`Refused unsafe path: scheme-like input ${JSON.stringify(relativePath)}.`);
  }
  const segments = relativePath.split(/[\\/]+/).filter(Boolean);
  if (!segments.length) {
    throw new Error('Refused unsafe path: no usable segments.');
  }
  for (const seg of segments) {
    if (seg === '..' || seg === '.' || seg.includes('\0')) {
      throw new Error(`Refused unsafe path: contains ${JSON.stringify(seg)}.`);
    }
  }
  return assertResolvedInsideDir(rootDir, path.join(...segments));
}

function getWindowsIconPath() {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'build', 'icon.ico'),
        path.join(__dirname, 'build', 'icon.ico'),
      ]
    : [path.join(__dirname, 'build', 'icon.ico')];
  return candidates.find(fileExists) || null;
}

// ── Data persistence ──────────────────────────────────────────────────────────
// Dev mode always saves in the project folder so it stays beside the source.
// Built apps can use a user-chosen folder (Google Drive recommended), fall back
// to auto-detected Google Drive, then finally fall back to Documents.

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonFile(filePath, value) {
  try {
    ensureDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function readSettings() {
  const settings = readJsonFile(settingsPath());
  return settings && typeof settings === 'object' ? settings : {};
}

function writeSettings(settings) {
  return writeJsonFile(settingsPath(), settings || {});
}

function existingDir(dirPath) {
  try {
    return !!dirPath && fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean))];
}

// Marie 2026-05-26: every export should suggest a fresh filename when one
// already exists in the same folder — no more "Anarchy.csv already exists.
// Replace?" prompts. Given a desired absolute path, return one that does
// NOT collide by appending " (1)", " (2)", etc. before the extension.
// Works for files and folders.
function uniqueExportPath(targetPath) {
  if (!targetPath) return targetPath;
  try {
    if (!fs.existsSync(targetPath)) return targetPath;
    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const base = path.basename(targetPath, ext);
    for (let i = 1; i < 1000; i += 1) {
      const candidate = path.join(dir, `${base} (${i})${ext}`);
      if (!fs.existsSync(candidate)) return candidate;
    }
    return targetPath;
  } catch {
    return targetPath;
  }
}

function getGoogleDriveCandidates() {
  const home = app.getPath('home');
  const candidates = [];

  if (process.platform === 'darwin') {
    const cloudStorage = path.join(home, 'Library', 'CloudStorage');
    try {
      if (fs.existsSync(cloudStorage)) {
        const entries = fs.readdirSync(cloudStorage).filter(entry => entry.startsWith('GoogleDrive-'));
        for (const entry of entries) {
          candidates.push(path.join(cloudStorage, entry, 'My Drive'));
        }
      }
    } catch {}
  }

  if (process.platform === 'win32') {
    candidates.push(path.join(home, 'Google Drive'));
    candidates.push(path.join(home, 'Google Drive', 'My Drive'));
    candidates.push(path.join(home, 'My Drive'));
    for (const driveLetter of ['G', 'H', 'I']) {
      candidates.push(`${driveLetter}:\\My Drive`);
    }
  }

  return uniquePaths(candidates).filter(existingDir);
}

function getConfiguredDataDir() {
  const settings = readSettings();
  const dirPath = settings?.dataDirectory;
  return existingDir(dirPath) ? dirPath : null;
}

function getDefaultProdDataDir() {
  const googleDriveRoot = getGoogleDriveCandidates()[0];
  if (googleDriveRoot) return path.join(googleDriveRoot, DRIVE_SUBFOLDER, APP_FOLDER_NAME, SAVE_DATA_FOLDER_NAME);
  return path.join(app.getPath('userData'), SAVE_DATA_FOLDER_NAME);
}

function ensureDirPath(dirPath) {
  if (!dirPath) return dirPath;
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {}
  return dirPath;
}

function isProjectFolder(dirPath) {
  if (!dirPath) return false;
  try {
    return fs.existsSync(path.join(dirPath, 'package.json'))
      && fs.existsSync(path.join(dirPath, 'main.js'))
      && fs.existsSync(path.join(dirPath, 'app'));
  } catch {
    return false;
  }
}

function getPortableSearchDirs() {
  if (isDev || !app.isPackaged) return [];
  const dirs = [];
  try {
    const portableExecutableDir = process.env.PORTABLE_EXECUTABLE_DIR;
    const startDirs = portableExecutableDir
      ? [portableExecutableDir, path.dirname(process.execPath)]
      : [path.dirname(process.execPath)];
    for (const startDir of startDirs) {
      if (!startDir) continue;
      let currentDir = startDir;
      for (let depth = 0; depth < 6; depth += 1) {
        dirs.push(currentDir);
        const parentDir = path.dirname(currentDir);
        if (!parentDir || parentDir === currentDir) break;
        currentDir = parentDir;
      }
    }
  } catch {}
  return uniquePaths(dirs);
}

function isTempDir(dirPath) {
  try {
    const tempDir = path.resolve(app.getPath('temp')).toLowerCase();
    const resolvedDir = path.resolve(dirPath).toLowerCase();
    const relativePath = path.relative(tempDir, resolvedDir);
    return !relativePath || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
  } catch {
    return false;
  }
}

function getPortableBaseDir() {
  const isPortableRuntime = !!process.env.PORTABLE_EXECUTABLE_DIR;
  const searchDirs = getPortableSearchDirs();

  for (const dirPath of searchDirs) {
    const candidate = path.join(dirPath, SAVE_DATA_FOLDER_NAME);
    if (existingDir(candidate)) return dirPath;
  }

  for (const dirPath of searchDirs) {
    if (isProjectFolder(dirPath)) return dirPath;
  }

  const releasesIndex = searchDirs.findIndex(dirPath => path.basename(dirPath).toLowerCase().includes('releases'));
  if (isPortableRuntime && releasesIndex >= 1) return searchDirs[releasesIndex - 1];

  const appBundleDir = searchDirs.find(dirPath => dirPath.endsWith('.app'));
  if (appBundleDir) {
    const parentDir = path.dirname(appBundleDir);
    const siblingDataDir = parentDir ? path.join(parentDir, SAVE_DATA_FOLDER_NAME) : null;
    if (parentDir && parentDir !== appBundleDir && existingDir(siblingDataDir)) return parentDir;
  }

  return isPortableRuntime ? (searchDirs.find(dirPath => !isTempDir(dirPath)) || null) : null;
}

function getPortablePackagedDataDir() {
  const baseDir = getPortableBaseDir();
  return baseDir ? path.join(baseDir, SAVE_DATA_FOLDER_NAME) : null;
}

function getPrimaryDataDir() {
  if (isDev) return ensureDirPath(path.join(__dirname, SAVE_DATA_FOLDER_NAME));
  const portableDataDir = getPortablePackagedDataDir();
  if (portableDataDir) return ensureDirPath(portableDataDir);
  return ensureDirPath(getConfiguredDataDir() || getDefaultProdDataDir());
}

const primaryDataPath = () => path.join(getPrimaryDataDir(), 'books.json');
const prebuildDataPath = () => path.join(getPrimaryDataDir(), 'prebuild-projects.json');
const prepDataPath = () => path.join(getPrimaryDataDir(), 'prep-manuscript-projects.json');
const quillDataPath = () => path.join(getPrimaryDataDir(), 'quill-projects.json');
const quillSummaryDataPath = () => path.join(getPrimaryDataDir(), 'quill-project-list.json');

const mirrorDataPath = () =>
  isDev
    ? path.join(app.getPath('documents'), APP_FOLDER_NAME, SAVE_DATA_FOLDER_NAME, 'books.json')
    : path.join(app.getPath('userData'), 'books.json');

const prebuildMirrorDataPath = () =>
  isDev
    ? path.join(app.getPath('documents'), APP_FOLDER_NAME, SAVE_DATA_FOLDER_NAME, 'prebuild-projects.json')
    : path.join(app.getPath('userData'), 'prebuild-projects.json');

const prepMirrorDataPath = () =>
  isDev
    ? path.join(app.getPath('documents'), APP_FOLDER_NAME, SAVE_DATA_FOLDER_NAME, 'prep-manuscript-projects.json')
    : path.join(app.getPath('userData'), 'prep-manuscript-projects.json');

const quillMirrorDataPath = () =>
  isDev
    ? path.join(app.getPath('documents'), APP_FOLDER_NAME, SAVE_DATA_FOLDER_NAME, 'quill-projects.json')
    : path.join(app.getPath('userData'), 'quill-projects.json');

const quillSummaryMirrorDataPath = () =>
  isDev
    ? path.join(app.getPath('documents'), APP_FOLDER_NAME, SAVE_DATA_FOLDER_NAME, 'quill-project-list.json')
    : path.join(app.getPath('userData'), 'quill-project-list.json');

function quillRecoveryDataPaths() {
  return uniquePaths([
    quillDataPath(),
    quillMirrorDataPath(),
    path.join(app.getPath('documents'), APP_FOLDER_NAME, SAVE_DATA_FOLDER_NAME, 'quill-projects.json'),
  ]);
}

function legacyDataPaths() {
  const paths = [];
  if (isDev) {
    paths.push(path.join(__dirname, 'data', 'books.json'));
  } else {
    paths.push(path.join(app.getPath('userData'), 'books.json'));
    paths.push(path.join(app.getPath('home'), 'Library', 'Application Support', 'proofer-5-0', 'books.json'));
    const googleDriveRoot = getGoogleDriveCandidates()[0];
    if (googleDriveRoot) {
      paths.push(path.join(googleDriveRoot, APP_FOLDER_NAME, 'books.json'));
    }
    paths.push(path.join(app.getPath('documents'), APP_FOLDER_NAME, 'books.json'));
    paths.push(path.join(app.getPath('documents'), 'Audioproofer', SAVE_DATA_FOLDER_NAME, 'books.json'));
    paths.push(path.join(app.getPath('documents'), 'Proofer 3.0', SAVE_DATA_FOLDER_NAME, 'books.json'));
  }
  return uniquePaths(paths).filter(candidate => candidate !== primaryDataPath());
}

function getDataLocationInfo() {
  const primaryDir = getPrimaryDataDir();
  const autoGoogleDriveRoot = getGoogleDriveCandidates()[0] || null;
  return {
    primaryPath: primaryDataPath(),
    primaryDir,
    mirrorPath: mirrorDataPath(),
    isDev,
    usesCustomFolder: !isDev && !!getConfiguredDataDir(),
    usesGoogleDrive: !!autoGoogleDriveRoot && primaryDir.startsWith(autoGoogleDriveRoot),
    googleDriveDetected: !!autoGoogleDriveRoot,
  };
}

function toPortableRelativePath(relativePath) {
  return String(relativePath || '').split(path.sep).join('/');
}

function relativePathIfInside(basePath, targetPath) {
  try {
    const base = path.resolve(basePath);
    const target = path.resolve(targetPath);
    const relativePath = path.relative(base, target);
    if (!relativePath) return '';
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null;
    return toPortableRelativePath(relativePath);
  } catch {
    return null;
  }
}

function joinPortablePath(basePath, portableRelativePath) {
  const segments = String(portableRelativePath || '')
    .split('/')
    .filter(Boolean);
  return path.join(basePath, ...segments);
}

function encodeStoredFilePath(filePath) {
  if (!filePath) return null;

  const absolutePath = path.resolve(String(filePath));
  for (const googleDriveRoot of getGoogleDriveCandidates()) {
    const relativePath = relativePathIfInside(googleDriveRoot, absolutePath);
    if (relativePath !== null) return `gdrive://${relativePath}`;
  }

  const dataRelativePath = relativePathIfInside(getPrimaryDataDir(), absolutePath);
  if (dataRelativePath !== null) return `data://${dataRelativePath}`;

  return absolutePath;
}

function isPortableStoredPath(filePath) {
  return typeof filePath === 'string' && (filePath.startsWith('gdrive://') || filePath.startsWith('data://'));
}

function detectStoredPathPlatform(filePath) {
  if (typeof filePath !== 'string' || !filePath) return null;
  if (isPortableStoredPath(filePath)) return 'portable';
  if (/^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\')) return 'win32';
  if (filePath.startsWith('/')) return 'darwin';
  return null;
}

function getCurrentPlatformStoredPath(filePath) {
  if (!filePath) return null;
  if (typeof filePath === 'string') return filePath;
  if (typeof filePath === 'object') {
    const candidate = filePath[CURRENT_PLATFORM_KEY];
    return typeof candidate === 'string' && candidate ? candidate : null;
  }
  return null;
}

function decodeStoredFilePath(filePath) {
  const currentPath = getCurrentPlatformStoredPath(filePath);
  if (!currentPath || typeof currentPath !== 'string') return null;

  if (currentPath.startsWith('gdrive://')) {
    const relativePath = currentPath.slice('gdrive://'.length);
    for (const googleDriveRoot of getGoogleDriveCandidates()) {
      const candidate = joinPortablePath(googleDriveRoot, relativePath);
      if (fs.existsSync(candidate)) return candidate;
    }
    const fallbackRoot = getGoogleDriveCandidates()[0];
    return fallbackRoot ? joinPortablePath(fallbackRoot, relativePath) : null;
  }

  if (currentPath.startsWith('data://')) {
    return joinPortablePath(getPrimaryDataDir(), currentPath.slice('data://'.length));
  }

  return currentPath;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureUniqueFilePath(filePath) {
  if (!fs.existsSync(filePath)) return filePath;
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  let index = 2;
  let candidate = filePath;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base}-${index}${ext}`);
    index += 1;
  }
  return candidate;
}

function sanitizeFileName(value, fallback = 'Untitled') {
  const cleaned = String(value || fallback)
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || fallback).slice(0, 120);
}

function copyDirectoryContents(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
    } else if (entry.isFile()) {
      ensureDir(targetPath);
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function findTransferManifestPath(rootDir) {
  // Current filename first, then legacy filenames from prior brands.
  // Marie can still import old "script and sync" bundles. (Block 7.)
  const candidates = [
    'stjohn-author-studio-transfer.json',
    'script-and-sync-transfer.json',
    'transfer-manifest.json',
    path.join('data', 'stjohn-author-studio-transfer.json'),
    path.join('data', 'script-and-sync-transfer.json'),
  ];
  return candidates.map(candidate => path.join(rootDir, candidate)).find(fileExists) || null;
}

function getSectionBundleAudioPath(section) {
  if (typeof section?.transferAudioPath === 'string' && section.transferAudioPath) return section.transferAudioPath;
  if (typeof section?.audioPaths?.bundle === 'string' && section.audioPaths.bundle) return section.audioPaths.bundle;
  return null;
}

function rewriteBookAudioPathsForTransferImport(book, importDir) {
  return {
    ...book,
    chapters: Array.isArray(book?.chapters)
      ? book.chapters.map(chapter => ({
          ...chapter,
          sections: Array.isArray(chapter?.sections)
            ? chapter.sections.map(section => {
                const relativeAudioPath = getSectionBundleAudioPath(section);
                const next = { ...section };
                delete next.transferAudioPath;
                if (!relativeAudioPath) return next;
                // safeJoinInsideDir rejects `..` segments so a tampered
                // transfer manifest cannot point at files outside the
                // unpacked transfer folder.
                const audioPath = safeJoinInsideDir(importDir, String(relativeAudioPath));
                return {
                  ...next,
                  audioPath: null,
                  audioPaths: {
                    [CURRENT_PLATFORM_KEY]: encodeStoredFilePath(audioPath),
                  },
                };
              })
            : [],
        }))
      : [],
  };
}

function getSofficeCandidates() {
  const candidates = [];

  if (process.platform === 'win32') {
    const programFiles = [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
      process.env.LOCALAPPDATA,
    ].filter(Boolean);

    for (const baseDir of programFiles) {
      candidates.push(path.join(baseDir, 'LibreOffice', 'program', 'soffice.com'));
      candidates.push(path.join(baseDir, 'LibreOffice', 'program', 'soffice.exe'));
      candidates.push(path.join(baseDir, 'OpenOffice 4', 'program', 'soffice.com'));
      candidates.push(path.join(baseDir, 'OpenOffice 4', 'program', 'soffice.exe'));
    }

    candidates.push('soffice.com');
    candidates.push('soffice.exe');
    candidates.push('soffice');
    return uniquePaths(candidates);
  }

  if (process.platform === 'darwin') {
    candidates.push('/Applications/LibreOffice.app/Contents/MacOS/soffice');
    candidates.push('/Applications/OpenOffice.app/Contents/MacOS/soffice');
  }

  candidates.push('soffice');
  return uniquePaths(candidates);
}

function fileExists(filePath) {
  try {
    return !!filePath && fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function findSofficeBinary() {
  for (const candidate of getSofficeCandidates()) {
    if (!candidate.includes(path.sep) || fileExists(candidate)) return candidate;
  }
  return null;
}

function escapePowerShellString(value) {
  return String(value || '').replace(/'/g, "''");
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function convertDocxBufferToPdf({ name, data }) {
  const baseName = path.basename(String(name || 'manuscript.docx')).replace(/[^a-z0-9._ -]/gi, '_');
  const docxName = baseName.toLowerCase().endsWith('.docx') ? baseName : `${baseName}.docx`;
  const pdfName = docxName.replace(/\.docx$/i, '.pdf');
  const tempDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'proofer-docx-'));
  const docxPath = path.join(tempDir, docxName);
  const pdfPath = path.join(tempDir, pdfName);

  async function readConvertedPdf(converter) {
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`${converter === 'word' ? 'Microsoft Word' : 'LibreOffice'} did not produce a PDF for this manuscript.`);
    }

    return {
      fileName: pdfName,
      pdfData: fs.readFileSync(pdfPath),
      converter,
    };
  }

  async function convertWithSoffice() {
    const soffice = findSofficeBinary();
    if (!soffice) {
      throw new Error('LibreOffice was not found.');
    }

    await execFileAsync(
      soffice,
      ['--headless', '--convert-to', 'pdf', '--outdir', tempDir, docxPath],
      { timeout: 120000, windowsHide: true }
    );

    return readConvertedPdf('libreoffice');
  }

  async function convertWithMicrosoftWord() {
    if (process.platform !== 'win32') {
      throw new Error('Microsoft Word conversion is only available on Windows.');
    }

    const scriptPath = path.join(tempDir, 'export-docx-to-pdf.ps1');
    const script = [
      "$ErrorActionPreference = 'Stop'",
      `$docxPath = '${escapePowerShellString(docxPath)}'`,
      `$pdfPath = '${escapePowerShellString(pdfPath)}'`,
      '$word = $null',
      '$document = $null',
      'try {',
      '  $word = New-Object -ComObject Word.Application',
      '  $word.Visible = $false',
      '  $word.DisplayAlerts = 0',
      '  $document = $word.Documents.Open($docxPath, $false, $true)',
      '  $document.ExportAsFixedFormat($pdfPath, 17)',
      '} finally {',
      '  if ($document -ne $null) { try { $document.Close($false) } catch {} }',
      '  if ($word -ne $null) { try { $word.Quit() } catch {} }',
      '  [System.GC]::Collect()',
      '  [System.GC]::WaitForPendingFinalizers()',
      '}',
    ].join('\r\n');

    fs.writeFileSync(scriptPath, script, 'utf8');
    await execFileAsync(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { timeout: 120000, windowsHide: true }
    );

    return readConvertedPdf('word');
  }

  try {
    fs.writeFileSync(docxPath, Buffer.from(data));

    const attempts = process.platform === 'win32'
      ? [
          { name: 'Microsoft Word', run: convertWithMicrosoftWord },
          { name: 'LibreOffice', run: convertWithSoffice },
        ]
      : [
          { name: 'LibreOffice', run: convertWithSoffice },
        ];

    const failures = [];
    for (const attempt of attempts) {
      try {
        return await attempt.run();
      } catch (error) {
        failures.push(`${attempt.name}: ${error.message}`);
      }
    }

    if (process.platform === 'win32') {
      throw new Error(`Could not convert this Word file to PDF automatically. ${failures.join(' ')}`);
    }
    throw new Error(`Could not convert this Word file to PDF automatically. ${failures[0] || 'LibreOffice was not found.'}`);
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

function normalizePdfSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .trim();
}

function buildPdfLineText(items) {
  return items
    .slice()
    .sort((a, b) => a.x - b.x)
    .map(item => String(item.str || '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupPdfTextItemsIntoLines(items) {
  const sorted = items
    .filter(item => String(item?.str || '').trim())
    .map(item => ({
      str: String(item.str || ''),
      x: Number(item.transform?.[4]) || 0,
      y: Number(item.transform?.[5]) || 0,
    }))
    .sort((a, b) => {
      const dy = b.y - a.y;
      if (Math.abs(dy) > 2.5) return dy;
      return a.x - b.x;
    });

  const lines = [];
  for (const item of sorted) {
    const prev = lines[lines.length - 1];
    if (!prev || Math.abs(prev.y - item.y) > 2.5) {
      lines.push({ y: item.y, items: [item] });
      continue;
    }
    prev.items.push(item);
  }

  return lines
    .map(line => ({ y: line.y, text: buildPdfLineText(line.items) }))
    .filter(line => line.text);
}

function parseStandalonePageNumber(text) {
  const raw = String(text || '').replace(/[\s\-–—]+/g, '').trim();
  if (!/^\d{1,5}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function detectPrintedPageNumberFromLines(lines) {
  const bottomFirst = [...lines].sort((a, b) => a.y - b.y);
  const topFirst = [...lines].sort((a, b) => b.y - a.y);
  const candidates = [
    ...bottomFirst.slice(0, 3),
    ...topFirst.slice(0, 2),
  ];
  for (const line of candidates) {
    const value = parseStandalonePageNumber(line.text);
    if (value != null) return value;
  }
  return null;
}

let pdfjsImportPromise = null;

async function getPdfJsModule() {
  if (!pdfjsImportPromise) {
    pdfjsImportPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  const pdfjs = await pdfjsImportPromise;
  if (pdfjs?.GlobalWorkerOptions) {
    try {
      const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();
    } catch {
      // Fallback to disableWorker option when worker module path is unavailable.
    }
  }
  return pdfjs;
}

async function extractPdfPagingFromBuffer({ fileName, data, pageOffset = -1 }) {
  const pdfjs = await getPdfJsModule();
  const pdfData = Buffer.isBuffer(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : data instanceof Uint8Array
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(Buffer.from(data));
  const loadingTask = pdfjs.getDocument({ data: pdfData, disableWorker: true });
  const pdf = await loadingTask.promise;
  const pages = [];
  const normalizedOffset = Number.isFinite(Number(pageOffset)) ? Number(pageOffset) : -1;

  try {
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const textContent = await page.getTextContent();
      const lines = groupPdfTextItemsIntoLines(textContent.items || []);
      const rawText = lines.map(line => line.text).join('\n').trim();
      const fullText = rawText.replace(/\s+/g, ' ').trim();
      const printedPageNumber = detectPrintedPageNumberFromLines(lines);
      const pageNumber = Number.isFinite(printedPageNumber)
        ? printedPageNumber
        : pageIndex + normalizedOffset;

      pages.push({
        pageIndex,
        pageNumber: Math.max(1, pageNumber),
        pageNumberSource: Number.isFinite(printedPageNumber) ? 'printed' : 'offset',
        normalizedText: normalizePdfSearchText(fullText),
      });
    }
  } finally {
    pdf.cleanup?.();
    loadingTask.destroy?.();
  }

  // Marie 2026-05-26: auto-detect a sensible default offset by walking
  // the PDF and finding the FIRST physical page whose printed footer
  // says "1". Whatever number of unnumbered pages came before is the
  // adjustment. Example: PDF has an Opening Credits page (no number)
  // then an Epigraph with "1" in the footer — that's 1 unnumbered page
  // before "1", so adj = -1 so the printed-page-1 lines up with what
  // the user sees in their Word doc.
  //
  // (Earlier I made the mistake of looking for the text "Chapter 1" —
  // wrong. Marie wants this anchored to the footer numbering itself.)
  let suggestedOffset = 0;
  let firstOneAtPdfPage = null;
  let unnumberedBeforeFirstOne = 0;
  for (const page of pages) {
    if (page.pageNumberSource === 'printed' && page.pageNumber === 1) {
      firstOneAtPdfPage = page.pageIndex;
      unnumberedBeforeFirstOne = page.pageIndex - 1;
      suggestedOffset = -unnumberedBeforeFirstOne;
      break;
    }
  }

  return {
    mode: 'pdf-text',
    fileName,
    pageOffset: normalizedOffset,
    pageCount: pdf.numPages,
    printedPageCount: pages.filter(page => page.pageNumberSource === 'printed').length,
    pages,
    // Suggested per-book page-number adjustment so the page that has
    // "1" in its footer ends up reported as page 1 (and pages before
    // shift accordingly). Surfaced in import + Upload PDF flows so
    // the user can confirm or override.
    suggestedAdjustment: suggestedOffset,
    firstOneAtPdfPage,
    unnumberedBeforeFirstOne,
  };
}

function readFromPath(p) {
  try {
    if (!fs.existsSync(p)) return null;
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function writeToPath(p, books) {
  try { ensureDir(p); fs.writeFileSync(p, JSON.stringify(books, null, 2), 'utf8'); return true; }
  catch { return false; }
}

function getCurrentBooksForMigration() {
  return readFromPath(primaryDataPath()) || readFromPath(mirrorDataPath()) || [];
}

function getCurrentPrebuildProjectsForMigration() {
  return readFromPath(prebuildDataPath()) || readFromPath(prebuildMirrorDataPath()) || [];
}

function getCurrentPrepProjectsForMigration() {
  return readFromPath(prepDataPath()) || readFromPath(prepMirrorDataPath()) || [];
}

function annotationSortTime(annotation) {
  const updated = Date.parse(annotation?.updatedAt || '') || 0;
  const created = Date.parse(annotation?.createdAt || '') || 0;
  return Math.max(updated, created, 0);
}

function mergeQuillAnnotations(a = [], b = []) {
  const byId = new Map();
  for (const annotation of [...a, ...b]) {
    if (!annotation || typeof annotation !== 'object') continue;
    const id = annotation.id || `${annotation.sectionId || ''}:${annotation.wordStart || 0}:${annotation.wordEnd || 0}:${annotation.label || ''}:${annotation.selectedText || ''}`;
    const existing = byId.get(id);
    if (!existing || annotationSortTime(annotation) >= annotationSortTime(existing)) {
      byId.set(id, annotation);
    }
  }
  return Array.from(byId.values()).sort((x, y) => annotationSortTime(x) - annotationSortTime(y));
}

function projectSortTime(project) {
  const projectTime = Date.parse(project?.updatedAt || '') || 0;
  const annotationTime = Math.max(0, ...(project?.annotations || []).map(annotationSortTime));
  return Math.max(projectTime, annotationTime);
}

function mergeQuillProjectCopies(primaryProjects = [], mirrorProjects = []) {
  if (!Array.isArray(primaryProjects) || !primaryProjects.length) return Array.isArray(mirrorProjects) ? mirrorProjects : [];
  if (!Array.isArray(mirrorProjects) || !mirrorProjects.length) return primaryProjects;

  const mirrorById = new Map(mirrorProjects.filter(p => p?.id).map(p => [p.id, p]));
  return primaryProjects.map((project) => {
    const mirrorProject = mirrorById.get(project?.id);
    if (!mirrorProject) return project;
    const base = projectSortTime(mirrorProject) > projectSortTime(project) ? mirrorProject : project;
    const other = base === project ? mirrorProject : project;
    return {
      ...base,
      annotations: mergeQuillAnnotations(other.annotations || [], base.annotations || []),
      updatedAt: new Date(Math.max(projectSortTime(project), projectSortTime(mirrorProject))).toISOString(),
    };
  });
}

function getCurrentQuillProjectsForMigration() {
  return quillRecoveryDataPaths()
    .map(readFromPath)
    .filter(Array.isArray)
    .reduce((merged, projects) => mergeQuillProjectCopies(merged, projects), []);
}

function normalizeBooksForStorage(books) {
  if (!Array.isArray(books)) return [];
  return books.map(book => ({
    ...book,
    chapters: Array.isArray(book?.chapters)
      ? book.chapters.map(chapter => ({
          ...chapter,
          sections: Array.isArray(chapter?.sections)
            ? chapter.sections.map(section => {
                const nextAudioPaths = section?.audioPaths && typeof section.audioPaths === 'object'
                  ? { ...section.audioPaths }
                  : {};

                const legacyAudioPath = typeof section?.audioPath === 'string' ? section.audioPath : null;
                const legacyPlatform = detectStoredPathPlatform(legacyAudioPath);
                if (legacyAudioPath && legacyPlatform && legacyPlatform !== 'portable' && !nextAudioPaths[legacyPlatform]) {
                  nextAudioPaths[legacyPlatform] = legacyAudioPath;
                }

                const currentAudioPath = typeof nextAudioPaths[CURRENT_PLATFORM_KEY] === 'string'
                  ? nextAudioPaths[CURRENT_PLATFORM_KEY]
                  : (
                    legacyAudioPath && (
                      legacyPlatform === CURRENT_PLATFORM_KEY ||
                      (legacyPlatform === 'portable' && !nextAudioPaths[CURRENT_PLATFORM_KEY])
                    )
                  )
                    ? legacyAudioPath
                    : null;

                if (currentAudioPath) {
                  const resolvedAudioPath = decodeStoredFilePath(currentAudioPath);
                  nextAudioPaths[CURRENT_PLATFORM_KEY] = resolvedAudioPath && fs.existsSync(resolvedAudioPath)
                    ? encodeStoredFilePath(resolvedAudioPath)
                    : currentAudioPath;
                }

                const normalizedAudioPaths = Object.fromEntries(
                  Object.entries(nextAudioPaths).filter(([, value]) => typeof value === 'string' && value)
                );

                const normalizedLegacyAudioPath = legacyPlatform === 'portable' ? legacyAudioPath : null;
                return {
                  ...section,
                  audioPath: normalizedLegacyAudioPath,
                  audioPaths: Object.keys(normalizedAudioPaths).length ? normalizedAudioPaths : undefined,
                };
              })
            : [],
        }))
      : [],
  }));
}

function normalizeStoredAudioFields(entity) {
  if (!entity || typeof entity !== 'object') return entity;

  const nextAudioPaths = entity.audioPaths && typeof entity.audioPaths === 'object'
    ? { ...entity.audioPaths }
    : {};

  const legacyAudioPath = typeof entity.audioPath === 'string' ? entity.audioPath : null;
  const legacyPlatform = detectStoredPathPlatform(legacyAudioPath);
  if (legacyAudioPath && legacyPlatform && legacyPlatform !== 'portable' && !nextAudioPaths[legacyPlatform]) {
    nextAudioPaths[legacyPlatform] = legacyAudioPath;
  }

  const currentAudioPath = typeof nextAudioPaths[CURRENT_PLATFORM_KEY] === 'string'
    ? nextAudioPaths[CURRENT_PLATFORM_KEY]
    : (
      legacyAudioPath && (
        legacyPlatform === CURRENT_PLATFORM_KEY ||
        (legacyPlatform === 'portable' && !nextAudioPaths[CURRENT_PLATFORM_KEY])
      )
    )
      ? legacyAudioPath
      : null;

  if (currentAudioPath) {
    const resolvedAudioPath = decodeStoredFilePath(currentAudioPath);
    nextAudioPaths[CURRENT_PLATFORM_KEY] = resolvedAudioPath && fs.existsSync(resolvedAudioPath)
      ? encodeStoredFilePath(resolvedAudioPath)
      : currentAudioPath;
  }

  const normalizedAudioPaths = Object.fromEntries(
    Object.entries(nextAudioPaths).filter(([, value]) => typeof value === 'string' && value)
  );

  const normalizedLegacyAudioPath = legacyPlatform === 'portable' ? legacyAudioPath : null;
  return {
    ...entity,
    audioPath: normalizedLegacyAudioPath,
    audioPaths: Object.keys(normalizedAudioPaths).length ? normalizedAudioPaths : undefined,
  };
}

function normalizeQuillProjectsForStorage(projects) {
  if (!Array.isArray(projects)) return [];
  return projects.map(project => ({
    ...project,
    chapters: Array.isArray(project?.chapters)
      ? project.chapters.map(chapter => normalizeStoredAudioFields(chapter))
      : [],
  }));
}

function readMergedQuillProjects({ repairCopies = false } = {}) {
  const copies = quillRecoveryDataPaths().map(readFromPath).filter(Array.isArray);
  if (!copies.length) return [];
  const merged = normalizeQuillProjectsForStorage(
    copies.reduce((acc, projects) => mergeQuillProjectCopies(acc, projects), [])
  );
  if (repairCopies && copies.length > 1) {
    writeToPath(quillDataPath(), merged);
    writeToPath(quillMirrorDataPath(), merged);
  }
  return merged;
}

function summarizeQuillProject(project) {
  const chapters = Array.isArray(project?.chapters) ? project.chapters : [];
  const annotations = Array.isArray(project?.annotations) ? project.annotations : [];
  return {
    _summaryOnly: true,
    id: project?.id,
    cloudId: project?.cloudId,
    title: project?.title || 'Untitled',
    fileName: project?.fileName || '',
    importedAt: project?.importedAt || '',
    updatedAt: project?.updatedAt || '',
    chapterCount: chapters.length,
    annotationCount: annotations.length,
    chapters: chapters.map((chapter) => ({
      id: chapter?.id,
      title: chapter?.title || '',
      chapterNumber: chapter?.chapterNumber || null,
      completed: !!chapter?.completed,
      audioFileName: chapter?.audioFileName || '',
      transcribedAt: chapter?.transcribedAt || null,
      hasTranscription: !!(
        chapter?.transcribedAt ||
        chapter?.whisperTranscript ||
        (Array.isArray(chapter?.alignment) && chapter.alignment.length) ||
        (Array.isArray(chapter?.whisperAlignment) && chapter.whisperAlignment.length)
      ),
    })),
  };
}

function quillSummaryPaths() {
  return uniquePaths([quillSummaryDataPath(), quillSummaryMirrorDataPath()]);
}

function newestExistingMtime(paths) {
  return paths.reduce((latest, filePath) => {
    try {
      if (!fs.existsSync(filePath)) return latest;
      return Math.max(latest, fs.statSync(filePath).mtimeMs || 0);
    } catch {
      return latest;
    }
  }, 0);
}

function readQuillProjectSummaries() {
  const newestFullData = newestExistingMtime(quillRecoveryDataPaths());
  for (const summaryPath of quillSummaryPaths()) {
    try {
      if (!fs.existsSync(summaryPath)) continue;
      const summaryMtime = fs.statSync(summaryPath).mtimeMs || 0;
      if (newestFullData && summaryMtime < newestFullData) continue;
      const parsed = readFromPath(summaryPath);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return null;
}

function writeQuillProjectSummaries(projects) {
  const summaries = (Array.isArray(projects) ? projects : []).map(summarizeQuillProject);
  for (const summaryPath of quillSummaryPaths()) {
    writeToPath(summaryPath, summaries);
  }
  return summaries;
}

function writeQuillProjects(projects) {
  const normalizedProjects = normalizeQuillProjectsForStorage(projects);
  const ok = writeToPath(quillDataPath(), normalizedProjects);
  writeToPath(quillMirrorDataPath(), normalizedProjects);
  writeQuillProjectSummaries(normalizedProjects);
  return ok;
}

function getManuscriptSourcesDir() {
  const dir = path.join(getPrimaryDataDir(), 'Manuscript Sources');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getManuscriptSourcePath(bookId) {
  // Use safeJoinInsideDir so a crafted bookId like "../../etc/passwd"
  // cannot escape Save Data/Manuscript Sources/ on save, read, or
  // rescan. Throws on any escape attempt — callers should let the
  // error bubble to the IPC reply so the renderer can show it.
  return safeJoinInsideDir(getManuscriptSourcesDir(), `${String(bookId)}.docx`);
}

function saveManuscriptSource({ bookId, data }) {
  if (!bookId) throw new Error('Missing book id for manuscript source storage.');
  const targetPath = getManuscriptSourcePath(bookId);
  fs.writeFileSync(targetPath, Buffer.isBuffer(data) ? data : Buffer.from(data));
  return targetPath;
}

function readManuscriptSource(bookId) {
  const sourcePath = getManuscriptSourcePath(bookId);
  if (!fs.existsSync(sourcePath)) {
    throw new Error('No stored manuscript source was found for this book. Attach the DOCX once, then rescan.');
  }
  return fs.readFileSync(sourcePath);
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.txt': return 'text/plain; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.ico': return 'image/x-icon';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    default: return 'application/octet-stream';
  }
}

function startStaticServer() {
  if (staticServer?.url) return Promise.resolve(staticServer.url);

  const rootDir = path.join(__dirname, 'out');

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');
        let reqPath = decodeURIComponent(reqUrl.pathname || '/');
        if (reqPath === '/') reqPath = '/index.html';
        const safePath = path.normalize(reqPath).replace(/^([.][.][/\\])+/, '');
        let filePath = path.join(rootDir, safePath);

        if (!filePath.startsWith(rootDir)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }

        if (!fs.existsSync(filePath)) {
          // Only SPA-fallback for navigation requests (HTML pages), not assets
          const ext = path.extname(filePath).toLowerCase();
          const isAsset = ['.js', '.css', '.wasm', '.json', '.map', '.woff', '.woff2', '.png', '.jpg', '.svg'].includes(ext);
          const fallbackPath = path.join(rootDir, 'index.html');
          if (isAsset || !fs.existsSync(fallbackPath)) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          filePath = fallbackPath;
        }

        res.writeHead(200, { 'Content-Type': getMimeType(filePath), 'Cache-Control': 'no-cache' });
        fs.createReadStream(filePath).pipe(res);
      } catch (error) {
        res.writeHead(500);
        res.end(String(error.message || error));
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not determine static server address.'));
        return;
      }
      staticServer = {
        instance: server,
        url: `http://127.0.0.1:${address.port}`,
      };
      resolve(staticServer.url);
    });
  });
}

async function createWindow() {
  const windowIconPath = getWindowsIconPath();
  const win = new BrowserWindow({
    width: 1280, height: 860,
    minWidth: 900, minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    ...(process.platform === 'win32' && windowIconPath ? { icon: windowIconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow local file:// audio playback
      webSecurity: false,
    },
  });

  // Marie 2026-05-29: ONE place that makes EVERY in-app download collision-
  // proof. Any file the renderer hands to the browser via an <a download>
  // link — Quill Word/CSV/InDesign, Proof CSVs, Prep, Prebuild, the home
  // backup, config JSON, every tab in every mode — flows through this
  // session hook. If a file of that name already exists in Downloads we
  // auto-append " (1)", " (2)", " (3)", ... instead of overwriting it (or
  // popping a Save dialog). Same uniqueExportPath() the IPC exports use, so
  // the behaviour is identical everywhere in the app.
  win.webContents.session.on('will-download', (event, item) => {
    try {
      const target = uniqueExportPath(path.join(app.getPath('downloads'), item.getFilename()));
      item.setSavePath(target);
    } catch (err) {
      console.warn('[download] could not set a unique save path, using default:', err);
    }
  });

  if (isDev) {
    win.loadURL(process.env.APP_URL || 'http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    const serverUrl = await startStaticServer();
    win.loadURL(serverUrl);
  }
}

if (process.platform === 'win32') {
  app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID);
}

app.whenReady().then(async () => {
  // Register file protocol so audio files load correctly
  protocol.registerFileProtocol('localfile', (request, callback) => {
    const filePath = decodeURIComponent(request.url.replace('localfile://', ''));
    callback({ path: filePath });
  });
  await createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('before-quit', () => {
  try { staticServer?.instance?.close(); } catch {}
  staticServer = null;
  // Kill any running whisper process on quit
  if (activeWhisperChild) {
    try { activeWhisperChild.kill('SIGKILL'); } catch {}
    activeWhisperChild = null;
  }
});

// ── IPC handlers ──────────────────────────────────────────────────────────────

// Read all books data — tries primary first, falls back to mirror
ipcMain.handle('read-data', () => {
  const primaryPath = primaryDataPath();
  const primary = readFromPath(primaryPath);
  if (primary !== null) return primary;
  for (const legacyPath of legacyDataPaths()) {
    const legacy = readFromPath(legacyPath);
    if (legacy !== null) {
      writeToPath(primaryPath, legacy);
      return legacy;
    }
  }
  const mirror = readFromPath(mirrorDataPath());
  if (mirror !== null) {
    // Silently restore primary from mirror so next write finds it in the right place
    writeToPath(primaryPath, mirror);
    return mirror;
  }
  return [];
});

ipcMain.handle('read-prebuild-data', () => {
  const primary = readFromPath(prebuildDataPath());
  if (primary !== null) return primary;
  const mirror = readFromPath(prebuildMirrorDataPath());
  if (mirror !== null) {
    writeToPath(prebuildDataPath(), mirror);
    return mirror;
  }
  return [];
});

// Write all books data — writes to primary AND mirror for safety
ipcMain.handle('write-data', (_, books) => {
  const normalizedBooks = normalizeBooksForStorage(books);
  const ok = writeToPath(primaryDataPath(), normalizedBooks);
  writeToPath(mirrorDataPath(), normalizedBooks); // mirror — fire and forget
  return ok;
});

ipcMain.handle('write-prebuild-data', (_, projects) => {
  const normalizedProjects = Array.isArray(projects) ? projects : [];
  const ok = writeToPath(prebuildDataPath(), normalizedProjects);
  writeToPath(prebuildMirrorDataPath(), normalizedProjects);
  return ok;
});

ipcMain.handle('read-prep-data', () => {
  const primary = readFromPath(prepDataPath());
  if (primary !== null) return primary;
  const mirror = readFromPath(prepMirrorDataPath());
  if (mirror !== null) {
    writeToPath(prepDataPath(), mirror);
    return mirror;
  }
  return [];
});

ipcMain.handle('write-prep-data', (_, projects) => {
  const normalizedProjects = Array.isArray(projects) ? projects : [];
  const ok = writeToPath(prepDataPath(), normalizedProjects);
  writeToPath(prepMirrorDataPath(), normalizedProjects);
  return ok;
});

ipcMain.handle('read-quill-data', () => {
  return readMergedQuillProjects({ repairCopies: true });
});

ipcMain.handle('read-quill-project-list', () => {
  const cached = readQuillProjectSummaries();
  if (cached) return cached;
  const projects = readMergedQuillProjects({ repairCopies: true });
  return writeQuillProjectSummaries(projects);
});

ipcMain.handle('read-quill-project', (_, projectId) => {
  return readMergedQuillProjects({ repairCopies: true }).find((project) => project?.id === projectId) || null;
});

ipcMain.handle('write-quill-data', (_, projects) => {
  return writeQuillProjects(projects);
});

ipcMain.handle('write-quill-project', (_, project) => {
  if (!project?.id || project?._summaryOnly) return false;
  const normalizedProject = normalizeQuillProjectsForStorage([project])[0];
  const projects = readMergedQuillProjects({ repairCopies: true });
  const index = projects.findIndex((existing) => existing?.id === normalizedProject.id);
  if (index >= 0) projects[index] = normalizedProject;
  else projects.push(normalizedProject);
  return writeQuillProjects(projects);
});

ipcMain.handle('delete-quill-project-data', (_, projectId) => {
  if (!projectId) return false;
  const projects = readMergedQuillProjects({ repairCopies: true }).filter((project) => project?.id !== projectId);
  return writeQuillProjects(projects);
});

ipcMain.handle('get-data-location', () => getDataLocationInfo());

ipcMain.handle('choose-data-location', async () => {
  const currentBooks = getCurrentBooksForMigration();
  const currentPrebuildProjects = getCurrentPrebuildProjectsForMigration();
  const currentPrepProjects = getCurrentPrepProjectsForMigration();
  const currentQuillProjects = getCurrentQuillProjectsForMigration();
  const result = await dialog.showOpenDialog({
    title: 'Choose StJohn Author Studio data folder',
    defaultPath: getPrimaryDataDir(),
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Use this folder',
  });
  if (result.canceled || !result.filePaths.length) return null;

  const selectedDir = result.filePaths[0];
  const settings = readSettings();
  settings.dataDirectory = selectedDir;
  writeSettings(settings);

  const targetPath = path.join(selectedDir, 'books.json');
  if (!readFromPath(targetPath) && currentBooks.length) {
    writeToPath(targetPath, currentBooks);
  }

  const prebuildTargetPath = path.join(selectedDir, 'prebuild-projects.json');
  if (!readFromPath(prebuildTargetPath) && currentPrebuildProjects.length) {
    writeToPath(prebuildTargetPath, currentPrebuildProjects);
  }

  const prepTargetPath = path.join(selectedDir, 'prep-manuscript-projects.json');
  if (!readFromPath(prepTargetPath) && currentPrepProjects.length) {
    writeToPath(prepTargetPath, currentPrepProjects);
  }

  const quillTargetPath = path.join(selectedDir, 'quill-projects.json');
  if (!readFromPath(quillTargetPath) && currentQuillProjects.length) {
    writeToPath(quillTargetPath, normalizeQuillProjectsForStorage(currentQuillProjects));
  }

  return getDataLocationInfo();
});

// Open native audio file dialog — returns { path, name } or an array when multiple
ipcMain.handle('open-audio-dialog', async (_, options = {}) => {
  const multiple = !!options?.multiple;
  const result = await dialog.showOpenDialog({
    title: 'Select audio file',
    filters: [{ name: 'Audio', extensions: ['mp3','wav','m4a','aac','flac','ogg','wma'] }],
    properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return multiple ? [] : null;
  const entries = result.filePaths.map(filePath => ({
    path: filePath,
    storedPath: encodeStoredFilePath(filePath),
    name: path.basename(filePath),
  }));
  return multiple ? entries : entries[0];
});

// Get audio URL from stored path (file:// protocol)
ipcMain.handle('get-audio-url', (_, filePath) => {
  const resolvedPath = decodeStoredFilePath(filePath);
  if (!resolvedPath || !fs.existsSync(resolvedPath)) return null;
  // Use localfile:// protocol registered above
  return 'localfile://' + encodeURIComponent(resolvedPath);
});

// Export backup JSON
ipcMain.handle('export-backup', async (_, books) => {
  const result = await dialog.showSaveDialog({
    title: 'Save backup',
    defaultPath: uniqueExportPath(path.join(app.getPath('downloads'), 'stjohn-author-studio-backup.json')),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled) return false;
  fs.writeFileSync(result.filePath, JSON.stringify(books, null, 2), 'utf8');
  return true;
});

// Import backup JSON
ipcMain.handle('import-backup', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Open backup file',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return fs.readFileSync(result.filePaths[0], 'utf8');
});

// Read audio file as buffer — used by in-app transcription
ipcMain.handle('read-audio-file', (_, filePath) => {
  const resolvedPath = decodeStoredFilePath(filePath);
  if (!resolvedPath || !fs.existsSync(resolvedPath)) return null;
  return fs.readFileSync(resolvedPath); // returns Buffer, transferred as Uint8Array
});

// Export CSV
ipcMain.handle('export-csv', async (_, { content, defaultName }) => {
  const result = await dialog.showSaveDialog({
    title: 'Save CSV',
    defaultPath: uniqueExportPath(path.join(app.getPath('downloads'), defaultName || 'proofing.csv')),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (result.canceled) return false;
  fs.writeFileSync(result.filePath, content, 'utf8');
  return true;
});

ipcMain.handle('export-markers-folder', async (_, { folderName, files }) => {
  const result = await dialog.showSaveDialog({
    title: 'Export Audition Markers',
    defaultPath: uniqueExportPath(path.join(app.getPath('downloads'), folderName || 'audition-markers')),
    buttonLabel: 'Export',
  });
  if (result.canceled || !result.filePath) return false;
  fs.mkdirSync(result.filePath, { recursive: true });
  for (const file of Array.isArray(files) ? files : []) {
    if (!file?.name) continue;
    fs.writeFileSync(path.join(result.filePath, file.name), file.content || '', 'utf8');
  }
  return result.filePath;
});

ipcMain.handle('export-transfer-bundle', async (event, book) => {
  if (!book?.id) throw new Error('No audiobook was provided for transfer.');
  const transferRoot = app.getPath('downloads');
  fs.mkdirSync(transferRoot, { recursive: true });
  const sendTransferProgress = (payload) => {
    try { event.sender.send('transfer-progress', payload); } catch {}
  };

  const safeTitle = sanitizeFileName(book.title || book.fileName || 'Audiobook');
  const result = await dialog.showSaveDialog({
    title: 'Create Transfer Folder',
    defaultPath: uniqueExportPath(path.join(transferRoot, `${safeTitle} Transfer`)),
    buttonLabel: 'Create Transfer Folder',
  });
  if (result.canceled || !result.filePath) return null;

  const bundleDir = result.filePath;
  const audioDir = path.join(bundleDir, 'audio');
  const manuscriptDir = path.join(bundleDir, 'manuscript');
  const dataDir = path.join(bundleDir, 'data');
  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(manuscriptDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const copiedBook = JSON.parse(JSON.stringify(book));
  const copiedAudioBySource = new Map();
  const missingAudio = [];
  const failedAudio = [];
  const audioFiles = [];
  const audioRefCount = (Array.isArray(copiedBook.chapters) ? copiedBook.chapters : [])
    .reduce((count, chapter) => count + (Array.isArray(chapter?.sections) ? chapter.sections.filter(section => section.audioPaths || section.audioPath || section.audioFileName).length : 0), 0);
  const totalSteps = Math.max(1, audioRefCount + 4);
  let completedSteps = 0;
  const bumpTransferProgress = (message) => {
    completedSteps += 1;
    sendTransferProgress({
      active: true,
      percent: Math.min(99, Math.round((completedSteps / totalSteps) * 100)),
      message,
    });
  };

  sendTransferProgress({ active: true, percent: 3, message: 'Creating transfer folder...' });

  for (const chapter of Array.isArray(copiedBook.chapters) ? copiedBook.chapters : []) {
    for (const section of Array.isArray(chapter.sections) ? chapter.sections : []) {
      const storedAudioPath = getCurrentPlatformStoredPath(section.audioPaths || section.audioPath);
      const sourceAudioPath = decodeStoredFilePath(storedAudioPath);
      if (!sourceAudioPath || !fs.existsSync(sourceAudioPath)) {
        if (section.audioFileName || storedAudioPath) {
          missingAudio.push(section.audioFileName || storedAudioPath);
        }
        bumpTransferProgress(`Skipping missing audio: ${section.audioFileName || 'audio'}`);
        continue;
      }

      let relativeAudioPath = copiedAudioBySource.get(sourceAudioPath);
      if (!relativeAudioPath) {
        const ext = path.extname(sourceAudioPath) || path.extname(section.audioFileName || '') || '.audio';
        const baseName = sanitizeFileName(path.basename(section.audioFileName || sourceAudioPath, ext), 'audio');
        const targetAudioPath = ensureUniqueFilePath(path.join(audioDir, `${baseName}${ext}`));
        fs.copyFileSync(sourceAudioPath, targetAudioPath);
        const sourceStats = fs.statSync(sourceAudioPath);
        const targetStats = fs.statSync(targetAudioPath);
        if (!targetStats.isFile() || targetStats.size <= 0 || (sourceStats.size > 0 && targetStats.size !== sourceStats.size)) {
          failedAudio.push(section.audioFileName || sourceAudioPath);
          try { fs.rmSync(targetAudioPath, { force: true }); } catch {}
          continue;
        }
        relativeAudioPath = toPortableRelativePath(path.relative(bundleDir, targetAudioPath));
        copiedAudioBySource.set(sourceAudioPath, relativeAudioPath);
        audioFiles.push({
          originalName: section.audioFileName || path.basename(sourceAudioPath),
          relativePath: relativeAudioPath,
          bytes: targetStats.size,
        });
      }
      bumpTransferProgress(`Copied ${section.audioFileName || path.basename(sourceAudioPath)}`);

      section.audioPath = null;
      section.audioPaths = { bundle: relativeAudioPath };
      section.transferAudioPath = relativeAudioPath;
    }
  }

  let manuscriptSource = { stored: false, fileName: copiedBook.fileName || '' };
  const sourceManuscriptPath = getManuscriptSourcePath(book.id);
  if (fs.existsSync(sourceManuscriptPath)) {
    const manuscriptName = sanitizeFileName(copiedBook.fileName || `${safeTitle}.docx`);
    const targetManuscriptPath = path.join(manuscriptDir, manuscriptName.toLowerCase().endsWith('.docx') ? manuscriptName : `${manuscriptName}.docx`);
    fs.copyFileSync(sourceManuscriptPath, targetManuscriptPath);
    manuscriptSource = {
      stored: true,
      fileName: copiedBook.fileName || path.basename(targetManuscriptPath),
      relativePath: toPortableRelativePath(path.relative(bundleDir, targetManuscriptPath)),
    };
    bumpTransferProgress('Copied manuscript source.');
  }
  copiedBook.manuscriptSource = manuscriptSource;

  const manifest = {
    manifestType: 'stjohn-author-studio-transfer',
    manifestVersion: 1,
    exportedAt: new Date().toISOString(),
    app: 'StJohn Author Studio',
    projectType: 'audiobook-proofer',
    notes: [
      'Select this root folder with Import from other account.',
      'Audio files are copied into this folder and relinked during import.',
      'Page numbers are stored as the app page-map data; the generated PDF is not retained by the app.',
    ],
    book: copiedBook,
    includedFiles: {
      audio: audioFiles,
      manuscript: manuscriptSource,
      pageMapStoredInBookJson: !!copiedBook.pdfPaging,
    },
    warnings: {
      missingAudio,
      failedAudio,
    },
  };

  fs.writeFileSync(path.join(bundleDir, 'stjohn-author-studio-transfer.json'), JSON.stringify(manifest, null, 2), 'utf8');
  bumpTransferProgress('Wrote transfer manifest.');
  fs.writeFileSync(path.join(dataDir, 'book.json'), JSON.stringify(copiedBook, null, 2), 'utf8');
  fs.writeFileSync(path.join(bundleDir, 'README.txt'), [
    'StJohn Author Studio Transfer Folder',
    '',
    'In StJohn Author Studio, choose Create new book, then Import from other account.',
    'Select this folder. The app will copy the bundled audio/manuscript into its Save Data folder and relink the imported audiobook.',
  ].join('\n'), 'utf8');
  sendTransferProgress({ active: true, percent: 100, message: 'Transfer folder ready.' });

  return {
    folderPath: bundleDir,
    audioCount: audioFiles.length,
    copiedAudioBytes: audioFiles.reduce((total, file) => total + (Number(file.bytes) || 0), 0),
    missingAudio,
    failedAudio,
    hasManuscript: manuscriptSource.stored,
    hasPageMap: !!copiedBook.pdfPaging,
  };
});

ipcMain.handle('import-transfer-bundle', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select StJohn Author Studio transfer folder',
    properties: ['openDirectory'],
    buttonLabel: 'Import Transfer Folder',
  });
  if (result.canceled || !result.filePaths.length) return null;

  const sourceDir = result.filePaths[0];
  const manifestPath = findTransferManifestPath(sourceDir);
  if (!manifestPath) throw new Error('No StJohn Author Studio transfer manifest was found in that folder.');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  // Accept current and legacy manifest types so old "script and sync"
  // bundles still import. (Block 7 — preserve compatibility.)
  const acceptedManifestTypes = new Set(['stjohn-author-studio-transfer', 'script-and-sync-transfer']);
  if (!acceptedManifestTypes.has(manifest?.manifestType) || manifest?.projectType !== 'audiobook-proofer') {
    throw new Error('That folder is not a StJohn Author Studio transfer folder.');
  }
  if (!manifest.book) throw new Error('The transfer folder does not contain audiobook data.');

  const importedRoot = path.join(getPrimaryDataDir(), 'Transfer Imports');
  fs.mkdirSync(importedRoot, { recursive: true });
  const safeTitle = sanitizeFileName(manifest.book.title || 'Imported Audiobook');
  const importDir = path.join(importedRoot, `${safeTitle}-${Date.now()}`);
  copyDirectoryContents(sourceDir, importDir);

  const newBookId = Date.now();
  let importedBook = rewriteBookAudioPathsForTransferImport(manifest.book, importDir);
  importedBook = {
    ...importedBook,
    id: newBookId,
    title: importedBook.title || 'Imported Audiobook',
    importedFromTransfer: {
      importedAt: new Date().toISOString(),
      sourceFolderName: path.basename(sourceDir),
      importDir,
    },
  };

  const manuscriptRelativePath = manifest.book?.manuscriptSource?.relativePath;
  // safeJoinInsideDir rejects `..` segments so a tampered transfer
  // manifest cannot read manuscript bytes from outside the unpacked
  // transfer folder.
  const sourceManuscriptPath = manuscriptRelativePath
    ? safeJoinInsideDir(importDir, String(manuscriptRelativePath))
    : null;
  if (sourceManuscriptPath && fs.existsSync(sourceManuscriptPath)) {
    saveManuscriptSource({
      bookId: newBookId,
      data: fs.readFileSync(sourceManuscriptPath),
    });
    importedBook.manuscriptSource = {
      stored: true,
      fileName: manifest.book?.manuscriptSource?.fileName || path.basename(sourceManuscriptPath),
    };
  } else {
    importedBook.manuscriptSource = {
      ...(importedBook.manuscriptSource || {}),
      stored: false,
    };
  }

  return {
    book: importedBook,
    importDir,
    audioCount: manifest.includedFiles?.audio?.length || 0,
    missingAudio: manifest.warnings?.missingAudio || [],
    failedAudio: manifest.warnings?.failedAudio || [],
  };
});

ipcMain.handle('convert-docx-to-pdf', async (_, payload = {}) => {
  const data = payload?.data;
  if (!data) throw new Error('No DOCX data was provided.');
  return convertDocxBufferToPdf({
    name: payload?.name,
    data: Buffer.isBuffer(data) ? data : Buffer.from(data),
  });
});

ipcMain.handle('convert-docx-to-page-map', async (_, payload = {}) => {
  const data = payload?.data;
  if (!data) throw new Error('No DOCX data was provided.');
  const converted = await convertDocxBufferToPdf({
    name: payload?.name,
    data: Buffer.isBuffer(data) ? data : Buffer.from(data),
  });
  const pdfPaging = await extractPdfPagingFromBuffer({
    fileName: converted.fileName,
    data: converted.pdfData,
    pageOffset: payload?.pageOffset,
  });
  return {
    fileName: converted.fileName,
    converter: converted.converter,
    pdfPaging,
  };
});

ipcMain.handle('extract-pdf-paging', async (_, payload = {}) => {
  const data = payload?.data;
  if (!data) throw new Error('No PDF data was provided.');
  return extractPdfPagingFromBuffer({
    fileName: payload?.fileName || 'document.pdf',
    data: Buffer.isBuffer(data) ? data : Buffer.from(data),
    pageOffset: payload?.pageOffset,
  });
});

ipcMain.handle('save-manuscript-source', async (_, payload = {}) => {
  const data = payload?.data;
  if (!data) throw new Error('No manuscript DOCX data was provided.');
  saveManuscriptSource({
    bookId: payload?.bookId,
    data: Buffer.isBuffer(data) ? data : Buffer.from(data),
  });
  return { stored: true };
});

ipcMain.handle('rescan-book-pdf', async (_, payload = {}) => {
  const bookId = payload?.bookId;
  const data = readManuscriptSource(bookId);
  return convertDocxBufferToPdf({
    name: payload?.fileName || `${String(bookId || 'manuscript')}.docx`,
    data,
  });
});

ipcMain.handle('rescan-book-page-map', async (_, payload = {}) => {
  const bookId = payload?.bookId;
  const data = readManuscriptSource(bookId);
  const converted = await convertDocxBufferToPdf({
    name: payload?.fileName || `${String(bookId || 'manuscript')}.docx`,
    data,
  });
  const pdfPaging = await extractPdfPagingFromBuffer({
    fileName: converted.fileName,
    data: converted.pdfData,
    pageOffset: payload?.pageOffset,
  });
  return {
    fileName: converted.fileName,
    converter: converted.converter,
    pdfPaging,
  };
});

// ── whisper.cpp native transcription ──────────────────────────────────────────

function getWhisperBinDir() {
  // In packaged app, bin/ is next to app.asar in Resources/
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin');
  }
  return path.join(__dirname, 'bin');
}

function getWhisperBinary() {
  const binDir = getWhisperBinDir();
  const resolveWhisperBinary = (name) => {
    const candidates = process.platform === 'win32'
      ? [path.join(binDir, name + '.exe'), path.join(binDir, name)]
      : [path.join(binDir, name)];
    return candidates.find(fileExists) || candidates[0];
  };
  // Check settings for manual override
  try {
    const settings = readJsonFile(settingsPath());
    if (settings?.whisperArch === 'x64') return resolveWhisperBinary('whisper-cli-x64');
    if (settings?.whisperArch === 'arm64') return resolveWhisperBinary('whisper-cli-arm64');
  } catch {}
  // Auto-detect
  const arch = os.arch(); // 'arm64' or 'x64'
  const binary = arch === 'arm64' ? 'whisper-cli-arm64' : 'whisper-cli-x64';
  return resolveWhisperBinary(binary);
}

function getWhisperModel() {
  return getWhisperModelInfo().modelPath;
}

function getWhisperModelInfo() {
  const binDir = getWhisperBinDir();
  const settings = readSettings();
  const configuredModel = typeof settings.whisperModel === 'string' ? settings.whisperModel : '';
  const names = uniquePaths([configuredModel, ...WHISPER_MODEL_CANDIDATES]);
  const candidates = names.map((name) => (
    path.isAbsolute(name) ? name : path.join(binDir, path.basename(name))
  ));
  const modelPath = candidates.find(fileExists) || path.join(binDir, WHISPER_DEFAULT_MODEL);
  const availableModels = candidates.filter(fileExists).map(candidate => path.basename(candidate));
  let modelSizeMb = null;
  try { modelSizeMb = Math.round(fs.statSync(modelPath).size / 1024 / 1024); } catch {}
  return {
    modelPath,
    modelName: path.basename(modelPath),
    availableModels,
    modelSizeMb,
  };
}

function getWhisperThreadCount() {
  const configured = Number(readSettings().whisperThreads);
  if (Number.isInteger(configured) && configured >= 1 && configured <= 8) return configured;
  const cpuCount = Math.max(1, (os.cpus() || []).length);
  return Math.max(2, Math.min(4, Math.floor(cpuCount / 2)));
}

ipcMain.handle('whisper-get-info', async () => {
  const binary = getWhisperBinary();
  const modelInfo = getWhisperModelInfo();
  const arch = os.arch();
  let settings = {};
  try { settings = readJsonFile(settingsPath()) || {}; } catch {}
  return {
    binaryExists: fs.existsSync(binary),
    modelExists: fs.existsSync(modelInfo.modelPath),
    detectedArch: arch,
    selectedArch: settings.whisperArch || 'auto',
    binaryPath: binary,
    modelPath: modelInfo.modelPath,
    modelName: modelInfo.modelName,
    modelSizeMb: modelInfo.modelSizeMb,
    availableModels: modelInfo.availableModels,
    threadCount: getWhisperThreadCount(),
  };
});

ipcMain.handle('whisper-set-arch', async (_, arch) => {
  const s = readJsonFile(settingsPath()) || {};
  s.whisperArch = arch; // 'auto', 'arm64', or 'x64'
  ensureDir(settingsPath());
  fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
  return { ok: true };
});

// Track active whisper process for cleanup/cancellation
let activeWhisperChild = null;

ipcMain.handle('whisper-cancel', async () => {
  if (activeWhisperChild) {
    try { activeWhisperChild.kill('SIGTERM'); } catch {}
    // Force kill after 3s if still alive
    setTimeout(() => {
      if (activeWhisperChild) {
        try { activeWhisperChild.kill('SIGKILL'); } catch {}
        activeWhisperChild = null;
      }
    }, 3000);
    return { cancelled: true };
  }
  return { cancelled: false };
});

ipcMain.handle('whisper-transcribe', async (event, { audioPath }) => {
  if (activeWhisperChild) {
    throw new Error('Whisper is already transcribing. Wait for that transcription to finish, then try again.');
  }

  const binary = getWhisperBinary();
  const model = getWhisperModel();

  if (!fs.existsSync(binary)) throw new Error('whisper-cli binary not found: ' + binary);
  if (!fs.existsSync(model)) throw new Error('Whisper model not found: ' + model);
  const resolvedAudioPath = decodeStoredFilePath(audioPath);
  if (!resolvedAudioPath || !fs.existsSync(resolvedAudioPath)) throw new Error('Audio file not found: ' + audioPath);

  const tmpOutput = path.join(os.tmpdir(), `whisper-${Date.now()}`);

  return new Promise((resolve, reject) => {
    const args = [
      '-m', model,
      '-f', resolvedAudioPath,
      '-t', String(getWhisperThreadCount()),
      '-bo', '1',
      '-bs', '1',
      '-ojf',                  // full JSON with token timestamps
      '-of', tmpOutput,        // output file prefix
      '-l', 'en',              // language
      '--no-prints',           // suppress stderr noise
      '--print-progress',      // but still emit progress lines
    ];

    const child = spawn(binary, args, {
      env: { ...process.env, GGML_METAL_PATH_RESOURCES: getWhisperBinDir() },
    });
    activeWhisperChild = child;

    // CRITICAL: drain stdout to prevent pipe buffer from filling up and blocking
    // whisper-cli writes transcript text to stdout even with --no-prints
    child.stdout.on('data', () => {}); // discard stdout content

    // Timeout: kill whisper if it runs longer than 30 minutes
    const timeout = setTimeout(() => {
      if (activeWhisperChild === child) {
        try { child.kill('SIGKILL'); } catch {}
        activeWhisperChild = null;
        reject(new Error('whisper-cli timed out after 30 minutes'));
      }
    }, 30 * 60 * 1000);

    // Only keep last 2KB of stderr for progress parsing (avoid unbounded growth)
    let stderrTail = '';
    child.stderr.on('data', (chunk) => {
      stderrTail += chunk.toString();
      if (stderrTail.length > 2048) stderrTail = stderrTail.slice(-1024);
      const match = stderrTail.match(/progress\s*=\s*(\d+)%/i);
      if (match) {
        try { event.sender.send('whisper-progress', { progress: parseInt(match[1], 10) }); } catch {}
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      activeWhisperChild = null;
      reject(new Error('Failed to start whisper-cli: ' + err.message));
    });

    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      activeWhisperChild = null;
      const jsonPath = tmpOutput + '.json';

      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        try { fs.unlinkSync(jsonPath); } catch {}
        reject(new Error('Transcription was cancelled'));
        return;
      }
      if (code !== 0) {
        reject(new Error(`whisper-cli exited with code ${code}: ${stderrTail.slice(-500)}`));
        return;
      }
      if (!fs.existsSync(jsonPath)) {
        reject(new Error('whisper-cli did not produce output JSON'));
        return;
      }
      try {
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const data = JSON.parse(raw);
        const segmentCount = Array.isArray(data?.transcription)
          ? data.transcription.length
          : (Array.isArray(data?.segments) ? data.segments.length : 0);
        // Clean up temp file
        try { fs.unlinkSync(jsonPath); } catch {}

        const words = parseWhisperJsonWords(data);

        const fullText = words.map(w => w.word).join(' ');
        resolve({
          text: fullText,
          words,
          chunks: [],
          diagnostics: {
            modelId: `whisper.cpp/${path.basename(model, '.bin').replace(/^ggml-/, '')}`,
            engine: 'native',
            segmentCount,
            wordCount: words.length,
          },
        });
      } catch (err) {
        reject(new Error('Failed to parse whisper output: ' + err.message));
      }
    });
  });
});

// ── Drive snapshot backups ───────────────────────────────────────────────────
//
// Marie 2026-05-27: opt-in per Supabase user. When enabled, the first
// app-open of each local day takes one zip snapshot of every local
// JSON save + the cloud snapshot supplied by the renderer, writes it
// into Google Drive at
//   My Drive/Game Dev/GitHub/App Backups/<timestamp>.zip
// then prunes the oldest if more than 25 zips remain.
//
// If Drive is not detected on this Mac, the snapshot is SKIPPED — no
// local fallback. The renderer's Settings card surfaces this with a
// "⚠ Drive not detected" status so Marie knows.

const BACKUP_FOLDER_NAME = 'App Backups';

function getBackupTargetDir() {
  const driveRoots = getGoogleDriveCandidates();
  if (!driveRoots.length) return null;
  const target = path.join(driveRoots[0], DRIVE_SUBFOLDER, BACKUP_FOLDER_NAME);
  ensureDirPath(target);
  return target;
}

function listBackupSnapshots() {
  const dir = getBackupTargetDir();
  if (!dir) return { driveDetected: false, drivePath: null, snapshots: [] };
  try {
    const entries = fs.readdirSync(dir)
      .filter((name) => /^\d{4}-\d{2}-\d{2}.*\.zip$/.test(name))
      .map((name) => {
        const filePath = path.join(dir, name);
        const stat = fs.statSync(filePath);
        return { name, path: filePath, mtimeMs: stat.mtimeMs, sizeBytes: stat.size };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    return { driveDetected: true, drivePath: dir, snapshots: entries };
  } catch {
    return { driveDetected: true, drivePath: dir, snapshots: [] };
  }
}

ipcMain.handle('backup-get-info', () => {
  const info = listBackupSnapshots();
  const snaps = info.snapshots || [];
  const totalBytes = snaps.reduce((sum, s) => sum + (Number(s.sizeBytes) || 0), 0);
  return {
    driveDetected: info.driveDetected,
    drivePath: info.drivePath,
    snapshotCount: snaps.length,
    lastSnapshotAt: snaps[0]?.mtimeMs || null,
    lastSnapshotName: snaps[0]?.name || null,
    oldestSnapshotAt: snaps[snaps.length - 1]?.mtimeMs || null,
    totalBytes,
  };
});

ipcMain.handle('backup-prune', (_, payload = {}) => {
  const keep = Math.max(1, Number(payload?.keepCount) || 25);
  const info = listBackupSnapshots();
  if (!info.driveDetected) return { ok: false, error: 'Drive not detected.' };
  const extras = info.snapshots.slice(keep);
  let deleted = 0;
  for (const snap of extras) {
    try { fs.unlinkSync(snap.path); deleted += 1; } catch {}
  }
  return { ok: true, deleted };
});

ipcMain.handle('backup-make-snapshot', async (_, payload = {}) => {
  const target = getBackupTargetDir();
  if (!target) return { ok: false, driveDetected: false, error: 'Drive not detected.' };

  const cloudSnapshot = payload?.cloudSnapshot || null;
  const userEmail = String(payload?.userEmail || '').slice(0, 120);
  const userId = String(payload?.userId || '').slice(0, 60);

  // jszip is already a dependency (used by the manuscript/quill engines).
  const JSZip = require('jszip');
  const zip = new JSZip();

  const safeRead = (filePath) => {
    try {
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath, 'utf8');
    } catch { return null; }
  };

  const localFiles = {
    'books.json': safeRead(primaryDataPath()),
    'prebuild-projects.json': safeRead(prebuildDataPath()),
    'prep-manuscript-projects.json': safeRead(prepDataPath()),
    'quill-projects.json': safeRead(quillDataPath()),
  };

  for (const [name, content] of Object.entries(localFiles)) {
    if (content) zip.file(`local/${name}`, content);
  }

  if (cloudSnapshot) {
    zip.file('cloud/cloud-snapshot.json', JSON.stringify(cloudSnapshot, null, 2));
  }

  // Honest cloud status: cloudIncluded is only true when every cloud
  // read succeeded. A partial-or-failed snapshot still writes the local
  // backup (Marie's daily safety net) but the manifest says so clearly.
  const snapshotStatus = cloudSnapshot?.status
    || (cloudSnapshot ? 'partial-or-failed' : 'not-included');
  zip.file('manifest.json', JSON.stringify({
    snapshotType: 'stjohn-author-studio-backup',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    userId,
    userEmail,
    contents: {
      localFiles: Object.fromEntries(
        Object.entries(localFiles).map(([name, content]) => [name, content ? content.length : 0])
      ),
      cloudIncluded: snapshotStatus === 'complete',
      cloudStatus: snapshotStatus,
      cloudProofStatus: cloudSnapshot?.proof?.status || null,
      cloudQuillStatus: cloudSnapshot?.quill?.status || null,
      cloudProofError: cloudSnapshot?.proof?.error || null,
      cloudQuillError: cloudSnapshot?.quill?.error || null,
    },
  }, null, 2));

  const stamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const fileName = `${stamp}.zip`;
  const fullPath = path.join(target, fileName);

  try {
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    fs.writeFileSync(fullPath, buffer);
    return {
      ok: true,
      driveDetected: true,
      path: fullPath,
      sizeBytes: buffer.length,
      fileName,
    };
  } catch (error) {
    return { ok: false, driveDetected: true, error: String(error?.message || error) };
  }
});
