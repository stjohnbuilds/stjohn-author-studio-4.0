// Path-boundary helpers for any file path built from data that came
// from OUTSIDE the app (imported books, transfer manifests, IPC
// payloads). Without these, a crafted backup with `../../etc/passwd`-
// style segments could trick Electron's main process into reading or
// writing outside the intended root.
//
// CommonJS (.cjs) so main.js can `require()` it directly. Tests
// import it via ESM interop. Originally lived inline in main.js
// (Block 3a, audit fix SAS-AUD-20260602-016 / -017); extracted here
// so both the app and the regression tests share one source.

const path = require('path');

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
  // Reject obviously-absolute paths upfront. After segment split they
  // would re-anchor under rootDir and *look* safe — but the intent was
  // clearly to escape (or to hand the app a system path), so refuse.
  if (/^[\\/]/.test(relativePath)) {
    throw new Error(`Refused unsafe path: absolute input ${JSON.stringify(relativePath)}.`);
  }
  // Reject scheme-like inputs (file://, http:, C:, etc). These have no
  // business reaching this helper from a backup or manifest field.
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

module.exports = { assertResolvedInsideDir, safeJoinInsideDir };
