// Phone reader settings — the universal-across-services Reader Settings
// panel. Ported from the original StJohn Author Apps phone (the v1 that
// shipped to Marie before 3.0). She specifically pulled this out as
// "this has been thoroughly debugged — pull it in, don't re-invent it."
//
// All choices live as enum lists so the settings panel can render them as
// segmented controls. CSS values come back from `getX` accessors so the
// reader stays presentation-agnostic.

'use client';

export const PHONE_READER_SETTINGS_KEY = 'stjohn-phone-reader-settings-v1';
export const PHONE_READER_LOCATION_KEY = 'stjohn-phone-reader-location-v1';

export const PHONE_READER_FONTS = [
  { label: 'Book Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Classic Serif', value: '"Times New Roman", Times, serif' },
  { label: 'Clean Sans', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Soft Sans', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Draft Mono', value: '"Courier New", Courier, monospace' },
];

export const PHONE_READER_BACKGROUNDS = [
  { label: 'UI Background', value: 'ui', color: '#f4f1ee', navColor: '#eae4df' },
  { label: 'Soft White', value: 'white', color: '#fffefa', navColor: '#f5eee7' },
  { label: 'Blush', value: 'blush', color: '#fff3fb', navColor: '#f7e2f2' },
  { label: 'Petal Pink', value: 'petal', color: '#fde7fb', navColor: '#f4d7ef' },
  { label: 'Warm Ivory', value: 'ivory', color: '#fffaf1', navColor: '#f3eadc' },
  { label: 'Soft Lilac', value: 'lilac', color: '#f7f0ff', navColor: '#eae0f4' },
  { label: 'Pale Blue', value: 'blue', color: '#f0f7ff', navColor: '#dfeaf5' },
  { label: 'Mint', value: 'mint', color: '#f0faf4', navColor: '#dfeee5' },
];

export const PHONE_READER_LINE_HEIGHTS = [
  { label: 'Tight', value: 'tight', cssValue: 1.42 },
  { label: 'Standard', value: 'standard', cssValue: 1.58 },
  { label: 'Airy', value: 'airy', cssValue: 1.78 },
];

export const PHONE_READER_MARGINS = [
  { label: 'Narrow', value: 'narrow', x: 'clamp(20px, 6vw, 44px)', y: 'clamp(28px, 7vw, 52px)' },
  { label: 'Standard', value: 'standard', x: 'clamp(28px, 8vw, 58px)', y: 'clamp(34px, 8vw, 64px)' },
  { label: 'Wide', value: 'wide', x: 'clamp(36px, 10vw, 78px)', y: 'clamp(42px, 10vw, 78px)' },
];

export const PHONE_READER_PARAGRAPH_STYLES = [
  { label: 'Indent', value: 'indent' },
  { label: 'Space', value: 'space' },
];

export const PHONE_READER_ALIGNMENTS = [
  { label: 'Left', value: 'left' },
  { label: 'Justify', value: 'justify' },
];

export const PHONE_READER_MODES = [
  { label: 'Scroll', value: 'scroll' },
  { label: 'Page Swipe', value: 'page' },
];

export const DEFAULT_PHONE_READER_SETTINGS = {
  font: PHONE_READER_FONTS[0].value,
  readerSize: 19,
  background: PHONE_READER_BACKGROUNDS[0].value,
  readerMode: 'scroll',
  lineHeight: 'standard',
  margin: 'standard',
  paragraphStyle: 'indent',
  alignment: 'left',
};

function inSet(value, choices, fallback) {
  return choices.some((c) => c.value === value) ? value : fallback;
}

export function normalizePhoneReaderFont(font) {
  if (PHONE_READER_FONTS.some((f) => f.value === font)) return font;
  const v = String(font || '').toLowerCase();
  if (v.includes('times')) return PHONE_READER_FONTS[1].value;
  if (v.includes('arial') || v.includes('helvetica')) return PHONE_READER_FONTS[2].value;
  if (v.includes('verdana')) return PHONE_READER_FONTS[3].value;
  if (v.includes('courier')) return PHONE_READER_FONTS[4].value;
  return PHONE_READER_FONTS[0].value;
}

export function normalizePhoneReaderBackground(bg) {
  return PHONE_READER_BACKGROUNDS.some((b) => b.value === bg) ? bg : PHONE_READER_BACKGROUNDS[0].value;
}

export function normalizePhoneReaderSettings(input = {}) {
  const settings = input && typeof input === 'object' ? input : {};
  const sizeNumber = Number(settings.readerSize ?? DEFAULT_PHONE_READER_SETTINGS.readerSize);
  return {
    ...DEFAULT_PHONE_READER_SETTINGS,
    ...settings,
    font: normalizePhoneReaderFont(settings.font ?? DEFAULT_PHONE_READER_SETTINGS.font),
    background: normalizePhoneReaderBackground(settings.background ?? DEFAULT_PHONE_READER_SETTINGS.background),
    readerMode: settings.readerMode === 'page' ? 'page' : 'scroll',
    lineHeight: inSet(settings.lineHeight, PHONE_READER_LINE_HEIGHTS, DEFAULT_PHONE_READER_SETTINGS.lineHeight),
    margin: inSet(settings.margin, PHONE_READER_MARGINS, DEFAULT_PHONE_READER_SETTINGS.margin),
    paragraphStyle: inSet(settings.paragraphStyle, PHONE_READER_PARAGRAPH_STYLES, DEFAULT_PHONE_READER_SETTINGS.paragraphStyle),
    alignment: inSet(settings.alignment, PHONE_READER_ALIGNMENTS, DEFAULT_PHONE_READER_SETTINGS.alignment),
    readerSize: Number.isFinite(sizeNumber) ? Math.min(28, Math.max(16, sizeNumber)) : DEFAULT_PHONE_READER_SETTINGS.readerSize,
  };
}

export function getPhoneReaderBackgroundColor(bg) {
  return PHONE_READER_BACKGROUNDS.find((b) => b.value === normalizePhoneReaderBackground(bg))?.color
    || PHONE_READER_BACKGROUNDS[0].color;
}

export function getPhoneReaderNavColor(bg) {
  return PHONE_READER_BACKGROUNDS.find((b) => b.value === normalizePhoneReaderBackground(bg))?.navColor
    || PHONE_READER_BACKGROUNDS[0].navColor;
}

export function getPhoneReaderLineHeight(lineHeight) {
  return PHONE_READER_LINE_HEIGHTS.find((l) => l.value === lineHeight)?.cssValue
    || PHONE_READER_LINE_HEIGHTS.find((l) => l.value === DEFAULT_PHONE_READER_SETTINGS.lineHeight)?.cssValue
    || 1.58;
}

export function getPhoneReaderMargin(margin) {
  return PHONE_READER_MARGINS.find((m) => m.value === margin)
    || PHONE_READER_MARGINS.find((m) => m.value === DEFAULT_PHONE_READER_SETTINGS.margin)
    || PHONE_READER_MARGINS[0];
}

// localStorage load / save. Safe in SSR (returns defaults if window absent).
export function loadPhoneReaderSettings() {
  if (typeof window === 'undefined') return DEFAULT_PHONE_READER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(PHONE_READER_SETTINGS_KEY);
    return raw ? normalizePhoneReaderSettings(JSON.parse(raw)) : DEFAULT_PHONE_READER_SETTINGS;
  } catch {
    return DEFAULT_PHONE_READER_SETTINGS;
  }
}

export function savePhoneReaderSettings(settings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PHONE_READER_SETTINGS_KEY, JSON.stringify(normalizePhoneReaderSettings(settings)));
  } catch {
    // Private browsing may block localStorage — settings stay in-memory.
  }
}

export function loadPhoneReaderLocation(projectId) {
  if (!projectId || typeof window === 'undefined') return null;
  try {
    const all = JSON.parse(window.localStorage.getItem(PHONE_READER_LOCATION_KEY) || '{}');
    return (all && typeof all === 'object') ? (all[projectId] || null) : null;
  } catch {
    return null;
  }
}

export function savePhoneReaderLocation(projectId, location) {
  if (!projectId || typeof window === 'undefined') return;
  try {
    const all = JSON.parse(window.localStorage.getItem(PHONE_READER_LOCATION_KEY) || '{}');
    all[projectId] = { ...(all[projectId] || {}), ...location, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(PHONE_READER_LOCATION_KEY, JSON.stringify(all));
  } catch {
    // Ignore — non-critical.
  }
}

// Surface style applied to the reader root.
export function getReaderSurfaceStyle(settings) {
  const margin = getPhoneReaderMargin(settings.margin);
  return {
    fontFamily: settings.font,
    fontSize: `${settings.readerSize}px`,
    background: getPhoneReaderBackgroundColor(settings.background),
    lineHeight: getPhoneReaderLineHeight(settings.lineHeight),
    textAlign: settings.alignment === 'justify' ? 'justify' : 'left',
    '--phone-reader-padding-x': margin.x,
    '--phone-reader-padding-y': margin.y,
  };
}
