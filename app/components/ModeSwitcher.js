'use client';

// StJohn Author Studio 4.0 — home-screen 4-mode segmented switcher.
//
// Today (Phase 4 of v4.0): only Proof Listen is active. Prep Manuscript,
// Duet Prep, and Quill & Ink show a friendly "Coming in Phase X" panel
// when selected. Each mode has its own soft color from the brand palette
// — these are the same theme colors used by the per-mode shells in the
// 2.0 rebuild's `packages/ui/brand-themes`.
//
// When a mode is added (Phases 6, 7, 8) just flip its `enabled: true` in
// MODES below and route its panel to the real component. No other change
// to this file is required.

export const MODES = [
  {
    id: 'proof-listen',
    label: 'Proof Listen',
    shortLabel: 'Proof',
    color: '#8C7C94',        // violet — audiobook
    soft: '#F4EFF5',
    border: '#D8CFDC',
    enabled: true,
    phase: null,
    blurb: 'Listen to audio against the manuscript, flag mistakes for the engineer.',
  },
  {
    id: 'prep-manuscript',
    label: 'Prep Manuscript',
    shortLabel: 'Prep',
    color: '#74897D',        // sage — prep
    soft: '#EEF2EF',
    border: '#C8D6CC',
    enabled: false,
    phase: 6,
    blurb: 'Assign dialogue to characters/narrators. Export highlighted Word doc + narrator chapter list.',
  },
  {
    id: 'duet-prep',
    label: 'Duet Prep',
    shortLabel: 'Duet',
    color: '#C47F2A',        // warm tan — duet
    soft: '#FDF3E3',
    border: '#E3CBA1',
    enabled: false,
    phase: 7,
    blurb: 'Find and export duet/engineer markers in the audio.',
  },
  {
    id: 'quill',
    label: 'Quill & Ink',
    shortLabel: 'Quill',
    color: '#C4514A',        // pink/red — quill
    soft: '#FAEDEC',
    border: '#E6B9B5',
    enabled: false,
    phase: 8,
    blurb: 'Add annotations for special-edition print design. Export to InDesign.',
  },
];

export default function ModeSwitcher({ activeMode = 'proof-listen', onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Studio mode"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6,
        marginBottom: 16,
        padding: 4,
        background: 'rgba(255,255,255,0.6)',
        border: '1px solid var(--border)',
        borderRadius: 16,
      }}
    >
      {MODES.map((mode) => {
        const isActive = mode.id === activeMode;
        return (
          <button
            key={mode.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange && onChange(mode.id)}
            title={mode.enabled ? mode.label : `${mode.label} — Coming in Phase ${mode.phase}`}
            style={{
              padding: '10px 6px',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.02em',
              border: '1px solid ' + (isActive ? mode.color : 'transparent'),
              borderRadius: 12,
              background: isActive ? mode.soft : 'transparent',
              color: isActive ? mode.color : (mode.enabled ? 'var(--text-muted)' : 'var(--text-light)'),
              cursor: 'pointer',
              opacity: mode.enabled ? 1 : 0.85,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
          >
            <span style={{ display: 'block' }}>{mode.label}</span>
            {!mode.enabled && (
              <span style={{ display: 'block', fontSize: '0.6rem', fontWeight: 600, marginTop: 2, opacity: 0.8 }}>
                Phase {mode.phase}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ComingSoonPanel({ mode }) {
  const found = MODES.find((m) => m.id === mode);
  if (!found) return null;
  return (
    <section
      style={{
        marginBottom: 16,
        padding: '20px 18px',
        background: found.soft,
        border: '1px solid ' + found.border,
        borderRadius: 18,
        color: 'var(--text)',
      }}
    >
      <div style={{ fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: found.color, marginBottom: 4 }}>
        Coming in Phase {found.phase}
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
        {found.label}
      </div>
      <div style={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
        {found.blurb}
      </div>
      <div style={{ marginTop: 12, fontSize: '0.74rem', color: 'var(--text-light)' }}>
        This mode is part of the 4.0 build plan and isn&apos;t built yet. Use Proof Listen for now.
      </div>
    </section>
  );
}
