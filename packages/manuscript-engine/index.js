// Shared manuscript-engine entrypoint for StJohn Author Studio 4.0.
// Pure functions — no DOM, no Electron, no Supabase. Safe to import
// from server components, client components, electron main, and tests.
export * from './text-normalize/index.js';
export * from './word-import/index.js';
export * from './dialogue-detection/index.js';
export * from './dialogue-safety-check/index.js';
export * from './merge-dialogue-assignments.js';
export * from './chapter-plain-text/index.js';
