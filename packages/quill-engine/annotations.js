// Annotation tree + selection helpers for Quill & Ink.
// Ported from the alpha at packages/core/src/annotations/projectOptions.js.
//
// Four base classes:
//   - image      (Inline / Full Spread — emit a [INSERT IMG] marker)
//   - highlight  (plain highlight, no inline marker)
//   - emotion    (Dramatic / Romantic / Funny + custom)
//   - character  (markerOnly — attaches a [name] marker, no fill colour)

export const BASE_ANNOTATION_CLASSES = [
  {
    id: 'image',
    label: 'Image',
    color: '#8BB070',
    allowCustom: false,
    options: [
      { id: 'image-inline', label: 'Inline Image', color: '#8BB070' },
      { id: 'image-full-spread', label: 'Full Spread', color: '#8BB070' },
    ],
  },
  {
    id: 'highlight',
    label: 'Highlight',
    color: '#f0aac0',
    allowCustom: false,
    options: [],
  },
  {
    id: 'emotion',
    label: 'Emotion',
    color: '#E2B4C5',
    allowCustom: true,
    options: [
      { id: 'emotion-dramatic', label: 'Dramatic', color: '#C68DA0' },
      { id: 'emotion-romantic', label: 'Romantic', color: '#E2B4C5' },
      { id: 'emotion-funny', label: 'Funny', color: '#F0CFD8' },
    ],
  },
  {
    id: 'character',
    label: 'Character',
    color: '#6d6663',
    allowCustom: true,
    options: [],
    markerOnly: true,
  },
];

const CUSTOM_COLOR_PALETTE = ['#7d8fa6', '#9f8b9e', '#d8a6a0', '#b98145', '#a84f70', '#718b79', '#8c6d62'];
const CLASS_CUSTOM_DEFAULTS = {
  emotion: '#9f8b9e',
  character: '#6d6663',
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function createCustomOption(label, classId = 'emotion', existingOptions = []) {
  const cleanLabel = String(label || '').trim();
  if (!cleanLabel) return null;
  const paletteIndex = Array.isArray(existingOptions) ? existingOptions.length % CUSTOM_COLOR_PALETTE.length : 0;
  return {
    id: `custom-${classId}-${Date.now()}-${slugify(cleanLabel)}`,
    classId,
    label: cleanLabel,
    color: classId === 'emotion'
      ? CUSTOM_COLOR_PALETTE[paletteIndex]
      : (CLASS_CUSTOM_DEFAULTS[classId] || '#c66f8d'),
    createdAt: new Date().toISOString(),
  };
}

export function getAnnotationClassTree(projectOptions = []) {
  const customOptions = Array.isArray(projectOptions)
    ? projectOptions.filter((option) => option?.id?.startsWith('custom-'))
    : [];

  return BASE_ANNOTATION_CLASSES.map((annotationClass) => ({
    ...annotationClass,
    options: [
      ...annotationClass.options.map((option) => ({ ...option, classId: annotationClass.id })),
      ...customOptions
        .filter((option) => option.classId === annotationClass.id || (!option.classId && annotationClass.id === 'emotion'))
        .map((option) => ({ ...option, classId: annotationClass.id })),
    ],
  }));
}

export function resolveAnnotationSelection({ classId, optionId, projectOptions }) {
  const classes = getAnnotationClassTree(projectOptions);
  const annotationClass = classes.find((item) => item.id === classId) || classes[0];
  const option = annotationClass.options.find((item) => item.id === optionId) || annotationClass.options[0] || null;

  if (!option) {
    return {
      classId: annotationClass.id,
      classLabel: annotationClass.label,
      optionId: annotationClass.id,
      optionLabel: '',
      label: annotationClass.label,
      color: annotationClass.color,
      markerOnly: !!annotationClass.markerOnly,
    };
  }

  return {
    classId: annotationClass.id,
    classLabel: annotationClass.label,
    optionId: option.id,
    optionLabel: option.label,
    label: `${annotationClass.label}: ${option.label}`,
    color: option.color || annotationClass.color,
    markerOnly: !!annotationClass.markerOnly,
  };
}

// Returns the set of annotation ids that should be removed when the
// user deletes `target`. A "main" annotation (not character/markerOnly)
// is treated as a bundle with any same-range character markers
// attached to it — saveAnnotation already groups them on load and
// save, so delete must do the same or the markers get orphaned.
// (Audit fix SAS-AUD-20260602-006, Block 4.)
//
// Deleting a character marker is the inverse: only its own id, never
// cascading to peer markers or to the main annotation they accompany.
export function idsForAnnotationBundle(target, allAnnotations) {
  const ids = new Set();
  if (!target?.id) return ids;
  ids.add(target.id);
  const isMarker = target.classId === 'character' || !!target.markerOnly;
  if (isMarker) return ids;
  const start = Number(target.wordStart);
  const end = Number(target.wordEnd ?? target.wordStart);
  for (const a of allAnnotations || []) {
    if (!a?.id || a.id === target.id) continue;
    if (!(a.classId === 'character' || a.markerOnly)) continue;
    if (a.sectionId !== target.sectionId) continue;
    if (Number(a.wordStart) !== start) continue;
    if (Number(a.wordEnd ?? a.wordStart) !== end) continue;
    ids.add(a.id);
  }
  return ids;
}

export function createAnnotation({ selection, option, sectionId, sectionTitle, chapterNumber, wordStart, wordEnd, selectedText, textContext, timestamp, note }) {
  const resolved = selection || {
    classId: option?.classId || option?.category || 'highlight',
    classLabel: option?.classLabel || option?.category || 'Highlight',
    optionId: option?.id || 'highlight',
    optionLabel: option?.label || '',
    label: option?.label || 'Highlight',
    color: option?.color || '#c66f8d',
    markerOnly: false,
  };

  return {
    id: `annotation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    classId: resolved.classId,
    classLabel: resolved.classLabel,
    optionId: resolved.optionId,
    optionLabel: resolved.optionLabel,
    label: resolved.label,
    category: resolved.classId,
    color: resolved.color,
    markerOnly: !!resolved.markerOnly,
    sectionId: sectionId || '',
    sectionTitle: sectionTitle || '',
    chapterNumber: chapterNumber || null,
    wordStart,
    wordEnd,
    selectedText,
    textContext: textContext || null,
    timestamp,
    note: note || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
