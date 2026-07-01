// Tiny stable hash for *_hash / content_hash columns. Not cryptographic —
// just enough to short-circuit no-op writes (same content → same hash →
// skip the upload). Shared by proof-sync.js and quill-sync.js so both
// modes hash identically.
export function hashString(input) {
  const str = String(input || '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
