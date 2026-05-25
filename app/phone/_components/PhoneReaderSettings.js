// Universal Reader Settings panel — same fields across Quill + Script.
// Rendered as a full-screen overlay when the user taps the cog top-right.
// Ported from the original Studio phone (the v1 that shipped to Marie).

'use client';

import {
  PHONE_READER_FONTS,
  PHONE_READER_BACKGROUNDS,
  PHONE_READER_LINE_HEIGHTS,
  PHONE_READER_MARGINS,
  PHONE_READER_PARAGRAPH_STYLES,
  PHONE_READER_ALIGNMENTS,
  PHONE_READER_MODES,
  normalizePhoneReaderBackground,
} from '../_lib/readerSettings.js';

const INK = '#4C4846';
const ACCENT = '#834D5C';
const PANEL_BG = '#FBF7F2';
const BORDER = '#DDD0C4';

function Segmented({ label, value, options, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6D6663', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'grid', gap: 6, gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, background: 'white', borderRadius: 999, padding: 3, border: `1px solid ${BORDER}` }}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                padding: '8px 10px',
                background: active ? ACCENT : 'transparent',
                color: active ? 'white' : INK,
                border: 'none',
                borderRadius: 999,
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PhoneReaderSettings({ settings, onChange, onClose }) {
  function set(patch) {
    onChange({ ...settings, ...patch });
  }
  return (
    <main style={{ minHeight: '100vh', background: PANEL_BG, paddingBottom: 32 }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 14px',
        background: 'rgba(251,247,242,0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ fontSize: '0.94rem', fontWeight: 700, color: ACCENT }}>Reader settings</div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          style={{ width: 34, height: 34, borderRadius: 999, background: 'white', border: `1px solid ${BORDER}`, color: INK, fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </button>
      </header>

      <section style={{ padding: '16px 14px', maxWidth: 480, margin: '0 auto' }}>
        {/* Font */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6D6663', marginBottom: 6 }}>Font</div>
          <select
            value={settings.font}
            onChange={(e) => set({ font: e.target.value })}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: `1px solid ${BORDER}`, background: 'white', fontSize: '0.92rem', color: INK }}
          >
            {PHONE_READER_FONTS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Text size */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6D6663' }}>Text size</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: INK }}>{settings.readerSize}px</div>
          </div>
          <input
            type="range"
            min={16}
            max={28}
            value={settings.readerSize}
            onChange={(e) => set({ readerSize: Number(e.target.value) })}
            style={{ width: '100%', accentColor: ACCENT }}
          />
        </div>

        <Segmented
          label="Reader mode"
          value={settings.readerMode}
          options={PHONE_READER_MODES}
          onChange={(readerMode) => set({ readerMode })}
        />
        <Segmented
          label="Line spacing"
          value={settings.lineHeight}
          options={PHONE_READER_LINE_HEIGHTS}
          onChange={(lineHeight) => set({ lineHeight })}
        />
        <Segmented
          label="Margins"
          value={settings.margin}
          options={PHONE_READER_MARGINS}
          onChange={(margin) => set({ margin })}
        />
        <Segmented
          label="Paragraphs"
          value={settings.paragraphStyle}
          options={PHONE_READER_PARAGRAPH_STYLES}
          onChange={(paragraphStyle) => set({ paragraphStyle })}
        />
        <Segmented
          label="Alignment"
          value={settings.alignment}
          options={PHONE_READER_ALIGNMENTS}
          onChange={(alignment) => set({ alignment })}
        />

        {/* Background */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6D6663', marginBottom: 8 }}>Background</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {PHONE_READER_BACKGROUNDS.map((bg) => {
              const active = normalizePhoneReaderBackground(settings.background) === bg.value;
              return (
                <button
                  key={bg.value}
                  type="button"
                  aria-label={bg.label}
                  title={bg.label}
                  onClick={() => set({ background: bg.value })}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    border: active ? `2px solid ${ACCENT}` : `1px solid ${BORDER}`,
                    background: bg.color,
                    boxShadow: active ? `0 0 0 3px rgba(131,77,92,0.18)` : 'none',
                    cursor: 'pointer',
                  }}
                />
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
