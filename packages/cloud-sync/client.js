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

let cachedClient = null;

export function getSupabaseClient() {
  if (!hasSupabaseConfig) return null;
  if (typeof window === 'undefined') return null;
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return cachedClient;
}
