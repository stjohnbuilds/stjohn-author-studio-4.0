// StJohn Author Studio 4.0 — shared Supabase client.
//
// One client, one place. Every mode + the phone go through this.
// Reads NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// from .env.local (gitignored). Returns null if either is missing, so
// callers can degrade gracefully when running without cloud config.
//
// detectSessionInUrl is off because the Electron renderer never gets a
// redirect URL with a session token. persistSession + autoRefreshToken
// keep Marie signed in across app restarts via localStorage.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_SUPABASE_URL) || '';
const SUPABASE_KEY =
  (typeof process !== 'undefined' && process.env &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) || '';

export const hasSupabaseConfig = !!(SUPABASE_URL && SUPABASE_KEY);

// Marie 2026-06-01: HARD WHITELIST. StJohn Author Studio 4.0 is allowed
// to touch ONLY these six tables. The Supabase project is shared with
// Typing and Tomes (which writes to `app_data` via a `save_app_data_revisioned`
// RPC) — if anything in this codebase EVER tries to call .from(...) on a
// non-whitelisted table, or call ANY .rpc(...) at all, the guard throws
// LOUDLY and writes a console.error. This is a belt-and-suspenders
// defense so a future bug, a stray library call, or a copy-paste mistake
// cannot leak this app's data into another app's tables.
const ALLOWED_TABLES = new Set([
  'script_sync_projects',
  'script_sync_section_transcriptions',
  'script_sync_flags',
  'quill_projects',
  'quill_chapters',
  'quill_annotations',
]);

function installCloudGuard(client) {
  if (!client || client.__stjohnGuardInstalled) return client;
  const originalFrom = client.from.bind(client);
  const originalRpc = client.rpc ? client.rpc.bind(client) : null;
  client.from = function guardedFrom(table) {
    const name = String(table || '');
    if (!ALLOWED_TABLES.has(name)) {
      const msg = `[StJohn cloud guard] BLOCKED supabase.from("${name}"). This app is only allowed to touch: ${[...ALLOWED_TABLES].join(', ')}. If this fires, a bug is trying to write to another app's data — please screenshot and tell Marie.`;
      console.error(msg);
      throw new Error(msg);
    }
    return originalFrom(table);
  };
  if (originalRpc) {
    client.rpc = function guardedRpc(fnName, ...rest) {
      const msg = `[StJohn cloud guard] BLOCKED supabase.rpc("${String(fnName || '')}"). StJohn 4.0 does not call any RPC. If this fires, a bug or library is trying to invoke a stored procedure — please screenshot and tell Marie.`;
      console.error(msg);
      throw new Error(msg);
    };
  }
  client.__stjohnGuardInstalled = true;
  return client;
}

let cachedClient = null;

export function getSupabaseClient() {
  if (!hasSupabaseConfig) return null;
  if (typeof window === 'undefined') return null;
  if (!cachedClient) {
    const raw = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    cachedClient = installCloudGuard(raw);
  }
  return cachedClient;
}
