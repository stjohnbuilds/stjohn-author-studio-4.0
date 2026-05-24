// StJohn Author Studio 4.0 — Supabase account helpers.
//
// Ported from the quill-and-ink alpha (packages/core/src/auth/account.js).
// Plain-English error messages, a 20s timeout so Marie never sees the app
// hang silently if Supabase is slow, and one validation pass before any
// network call.

const MIN_PASSWORD_LENGTH = 6;
const AUTH_TIMEOUT_MS = 20000;

export function normalizeAccountEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

export function validateAccountCredentials(email = '', password = '') {
  const cleanEmail = normalizeAccountEmail(email);
  if (!cleanEmail) return { ok: false, message: 'Enter your email first.' };
  if (!cleanEmail.includes('@')) return { ok: false, message: 'Enter a valid email address.' };
  if (!password) return { ok: false, message: 'Enter your password first.' };
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  return { ok: true, email: cleanEmail, password };
}

async function withAuthTimeout(promise, actionLabel) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          resolve({
            data: null,
            error: {
              message: `${actionLabel} took too long because the cloud login server did not answer. Your internet may still be working; try again in a few minutes.`,
            },
          });
        }, AUTH_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    return {
      data: null,
      error: {
        message: error?.message || `${actionLabel} could not reach the cloud login server.`,
      },
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function signInSupabaseAccount(supabase, { email, password }) {
  if (!supabase) return { ok: false, message: 'Supabase login is not configured yet.' };
  const validation = validateAccountCredentials(email, password);
  if (!validation.ok) return validation;
  const { data, error } = await withAuthTimeout(
    supabase.auth.signInWithPassword({ email: validation.email, password: validation.password }),
    'Sign in',
  );
  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    session: data?.session || null,
    email: data?.session?.user?.email || validation.email,
    message: 'Signed in.',
  };
}

export async function createSupabaseAccount(supabase, { email, password, redirectTo }) {
  if (!supabase) return { ok: false, message: 'Supabase login is not configured yet.' };
  const validation = validateAccountCredentials(email, password);
  if (!validation.ok) return validation;

  const options = redirectTo ? { emailRedirectTo: redirectTo } : undefined;
  const { data, error } = await withAuthTimeout(
    supabase.auth.signUp({ email: validation.email, password: validation.password, options }),
    'Create account',
  );

  if (error) return { ok: false, message: error.message };

  const identities = data?.user?.identities;
  if (Array.isArray(identities) && identities.length === 0) {
    return { ok: false, message: 'An account already exists for this email. Sign in instead.' };
  }

  if (data?.session?.user) {
    return {
      ok: true,
      session: data.session,
      email: data.session.user.email || validation.email,
      message: 'Account created. You are signed in.',
    };
  }

  return {
    ok: true,
    session: null,
    email: validation.email,
    needsConfirmation: true,
    message: `Account created. Check ${validation.email} to confirm it, then sign in.`,
  };
}

export async function resendSupabaseConfirmation(supabase, { email, redirectTo }) {
  if (!supabase) return { ok: false, message: 'Supabase login is not configured yet.' };
  const cleanEmail = normalizeAccountEmail(email);
  if (!cleanEmail) return { ok: false, message: 'Enter your email first.' };
  if (!cleanEmail.includes('@')) return { ok: false, message: 'Enter a valid email address.' };
  const options = redirectTo ? { emailRedirectTo: redirectTo } : undefined;
  const { error } = await withAuthTimeout(
    supabase.auth.resend({ type: 'signup', email: cleanEmail, options }),
    'Send confirmation email',
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true, email: cleanEmail, message: `Confirmation email sent to ${cleanEmail}.` };
}

export async function sendPasswordResetEmail(supabase, { email, redirectTo }) {
  if (!supabase) return { ok: false, message: 'Supabase login is not configured yet.' };
  const cleanEmail = normalizeAccountEmail(email);
  if (!cleanEmail) return { ok: false, message: 'Enter your email first.' };
  if (!cleanEmail.includes('@')) return { ok: false, message: 'Enter a valid email address.' };
  const options = redirectTo ? { redirectTo } : undefined;
  const { error } = await withAuthTimeout(
    supabase.auth.resetPasswordForEmail(cleanEmail, options),
    'Send reset email',
  );
  if (error) return { ok: false, message: error.message };
  return { ok: true, email: cleanEmail, message: `Password reset email sent to ${cleanEmail}. Click the link in the email to set a new one.` };
}

export async function signOutSupabaseAccount(supabase) {
  if (!supabase) return { ok: true };
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
