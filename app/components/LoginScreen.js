'use client';

// StJohn Author Studio 4.0 — Login screen.
//
// First screen Marie sees on launch. Sign in / Create account / Forgot
// password / Check email — all modes live here. Pastel palette to match
// the home page (var(--accent), --cream, etc.). Show/hide eye on the
// password field (Marie asked for this specifically).
//
// Submits via the shared cloud-sync package. The page.js gate listens
// to supabase.auth.onAuthStateChange and unmounts this once the
// session resolves.

import { useState } from 'react';
import {
  getSupabaseClient,
  signInSupabaseAccount,
  createSupabaseAccount,
  resendSupabaseConfirmation,
  sendPasswordResetEmail,
} from '../../packages/cloud-sync';

function EyeIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 12s4-7.5 10.5-7.5S22.5 12 22.5 12s-4 7.5-10.5 7.5S1.5 12 1.5 12z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

function EyeOffIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.42 10.42 0 0 1 12 19.5C5.5 19.5 1.5 12 1.5 12a18.6 18.6 0 0 1 4.06-5.06" />
      <path d="M9.9 4.74A9.86 9.86 0 0 1 12 4.5c6.5 0 10.5 7.5 10.5 7.5a18.6 18.6 0 0 1-3.16 4.18" />
      <path d="M14.12 14.12a3.2 3.2 0 1 1-4.24-4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

const inputStyle = {
  width: '100%',
  padding: '11px 13px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'white',
  fontSize: '0.92rem',
  color: 'var(--text)',
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

const fieldLabel = {
  display: 'block',
  marginBottom: 12,
  fontSize: '0.74rem',
  fontWeight: 700,
  color: 'var(--accent-dark)',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const linkBtnStyle = {
  display: 'block',
  width: '100%',
  background: 'none',
  border: 'none',
  padding: '8px 4px',
  marginTop: 4,
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--accent-dark)',
  cursor: 'pointer',
  textAlign: 'center',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

function primaryBtnStyle(busy) {
  return {
    width: '100%',
    padding: '12px 18px',
    background: busy ? 'var(--accent-dark)' : 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: 14,
    fontSize: '0.92rem',
    fontWeight: 700,
    cursor: busy ? 'progress' : 'pointer',
    marginTop: 8,
    transition: 'background 0.15s ease',
    letterSpacing: '0.02em',
  };
}

const eyeBtnStyle = {
  position: 'absolute',
  right: 8,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  padding: '6px 8px',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
};

export default function LoginScreen({ onSignedIn, usesCustomDragRegion = false }) {
  const [mode, setMode] = useState('sign-in'); // sign-in | sign-up | check-email | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [statusTone, setStatusTone] = useState('info'); // info | error | success

  function setMsg(message, tone = 'info') {
    setStatus(message || '');
    setStatusTone(tone);
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const supabase = getSupabaseClient();

    if (mode === 'sign-in') {
      setBusy(true); setMsg('Signing in…', 'info');
      const res = await signInSupabaseAccount(supabase, { email, password });
      setBusy(false);
      if (res.ok) {
        setMsg('', 'info');
        onSignedIn?.(res.session);
      } else {
        setMsg(res.message, 'error');
      }
      return;
    }

    if (mode === 'sign-up') {
      setBusy(true); setMsg('Creating account…', 'info');
      const res = await createSupabaseAccount(supabase, { email, password });
      setBusy(false);
      if (!res.ok) { setMsg(res.message, 'error'); return; }
      if (res.session) {
        setMsg('', 'info');
        onSignedIn?.(res.session);
      } else {
        setMode('check-email');
        setMsg('', 'info');
      }
      return;
    }

    if (mode === 'forgot') {
      setBusy(true); setMsg('Sending reset email…', 'info');
      const res = await sendPasswordResetEmail(supabase, { email });
      setBusy(false);
      setMsg(res.message, res.ok ? 'success' : 'error');
    }
  }

  async function resend() {
    if (busy) return;
    setBusy(true); setMsg('Sending confirmation email…', 'info');
    const res = await resendSupabaseConfirmation(getSupabaseClient(), { email });
    setBusy(false);
    setMsg(res.message, res.ok ? 'success' : 'error');
  }

  const heading =
    mode === 'sign-in' ? 'Sign in'
      : mode === 'sign-up' ? 'Create account'
      : mode === 'check-email' ? 'Check your email'
      : 'Reset your password';

  const submitLabel =
    mode === 'sign-in' ? (busy ? 'Signing in…' : 'Sign in')
      : mode === 'sign-up' ? (busy ? 'Creating…' : 'Create account')
      : mode === 'forgot' ? (busy ? 'Sending…' : 'Send reset email')
      : '';

  const statusColor =
    statusTone === 'error' ? 'var(--danger)'
      : statusTone === 'success' ? 'var(--success)'
      : 'var(--text-muted)';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--cream)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.25rem',
        position: 'relative',
      }}
    >
      {usesCustomDragRegion && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 38, WebkitAppRegion: 'drag', zIndex: 10 }} />
      )}
      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
          <div style={{ fontSize: '1.55rem', fontWeight: 600, letterSpacing: '0.02em', color: 'var(--accent-dark)' }}>
            StJohn Author Studio
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Proof Listen · Prep Manuscript · Duet Prep · Quill &amp; Ink
          </div>
        </div>

        <form
          onSubmit={submit}
          style={{
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid var(--border)',
            borderRadius: 22,
            padding: '1.5rem 1.4rem',
            boxShadow: '0 14px 34px var(--accent-shadow)',
          }}
        >
          <h2
            style={{
              margin: 0,
              marginBottom: 16,
              fontSize: '1.05rem',
              fontWeight: 700,
              textAlign: 'center',
              color: 'var(--text)',
              letterSpacing: '0.02em',
            }}
          >
            {heading}
          </h2>

          {mode === 'check-email' ? (
            <>
              <p style={{ fontSize: '0.86rem', lineHeight: 1.55, color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 14px' }}>
                We sent a confirmation link to <strong>{email || 'your email'}</strong>. Click it, then come back here to sign in.
              </p>
              <button
                type="button"
                onClick={() => { setMode('sign-in'); setMsg('', 'info'); }}
                style={primaryBtnStyle(false)}
              >
                Back to sign in
              </button>
              <button
                type="button"
                onClick={resend}
                disabled={busy}
                style={linkBtnStyle}
              >
                {busy ? 'Sending…' : 'Resend confirmation email'}
              </button>
            </>
          ) : (
            <>
              <label style={fieldLabel}>
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  disabled={busy}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ ...inputStyle, marginTop: 5 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-light)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </label>

              {mode !== 'forgot' && (
                <label style={fieldLabel}>
                  <span>Password</span>
                  <div style={{ position: 'relative', marginTop: 5 }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                      value={password}
                      disabled={busy}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-light)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      disabled={busy}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={eyeBtnStyle}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </label>
              )}

              <button type="submit" disabled={busy} style={primaryBtnStyle(busy)}>
                {submitLabel}
              </button>

              {mode === 'sign-in' && process.env.NODE_ENV !== 'production' && (
                <button
                  type="button"
                  onClick={() => {
                    // Dev-only escape hatch so Claude / Marie can drive the
                    // app past the auth gate without a real Supabase round
                    // trip. The fake session has only what page.js reads
                    // (user.email + user.id). Cloud sync features still
                    // need real auth — this is for visual / layout
                    // verification only.
                    onSignedIn?.({
                      access_token: 'dev-skip',
                      refresh_token: 'dev-skip',
                      user: { id: 'dev-skip-user', email: 'dev@local' },
                    });
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 14,
                    padding: '8px 12px',
                    background: 'rgba(255, 200, 80, 0.18)',
                    color: '#7a5a10',
                    border: '1px dashed #d8a04c',
                    borderRadius: 10,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Dev · skip login (fake session)
                </button>
              )}

              {mode === 'sign-in' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); setMsg('', 'info'); }}
                    disabled={busy}
                    style={linkBtnStyle}
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('sign-up'); setMsg('', 'info'); }}
                    disabled={busy}
                    style={linkBtnStyle}
                  >
                    Don&apos;t have an account? Create one
                  </button>
                </>
              )}
              {mode === 'sign-up' && (
                <button
                  type="button"
                  onClick={() => { setMode('sign-in'); setMsg('', 'info'); }}
                  disabled={busy}
                  style={linkBtnStyle}
                >
                  Already have an account? Sign in
                </button>
              )}
              {mode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => { setMode('sign-in'); setMsg('', 'info'); }}
                  disabled={busy}
                  style={linkBtnStyle}
                >
                  Back to sign in
                </button>
              )}
            </>
          )}

          {status && (
            <p
              style={{
                fontSize: '0.8rem',
                color: statusColor,
                textAlign: 'center',
                margin: '12px 0 0',
                lineHeight: 1.4,
              }}
            >
              {status}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
