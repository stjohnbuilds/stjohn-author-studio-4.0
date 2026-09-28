import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAnnotationsCsv,
  buildInDesignJsx,
  buildSelectionTextContext,
  buildWordSpans,
  createAnnotation,
  createCustomOption,
  resolveAnnotationSelection,
} from '../packages/quill-engine/index.js';

function makeAnnotation({ projectOptions, plainText, chapter, classId, optionId, wordStart, wordEnd, note = '', timestamp = 12.345 }) {
  const wordSpans = buildWordSpans(plainText);
  const selection = resolveAnnotationSelection({ classId, optionId, projectOptions });
  const annotation = createAnnotation({
    selection,
    sectionId: chapter.id,
    sectionTitle: chapter.title,
    chapterNumber: chapter.chapterNumber,
    wordStart,
    wordEnd,
    selectedText: wordSpans.slice(wordStart, wordEnd + 1).map((span) => span.word).join(' '),
    textContext: buildSelectionTextContext(plainText, wordSpans, wordStart, wordEnd),
    timestamp,
    note,
  });
  annotation.audioFileName = chapter.audioFileName;
  return annotation;
}

function parseExportedAnnotations(jsx) {
  const match = jsx.match(/var lovewornAnnotations = ([\s\S]*?);\n\n  if \(app\.documents\.length === 0\)/);
  assert.ok(match, 'generated JSX should contain the annotation JSON payload');
  return JSON.parse(match[1]);
}

test('Quill export includes every current annotation category with real colors and metadata', () => {
  const customStorm = { ...createCustomOption('Storm dread', 'emotion', []), id: 'custom-emotion-storm', color: '#7d8fa6' };
  const customTender = { ...createCustomOption('Tender ache', 'emotion', [customStorm]), id: 'custom-emotion-tender', color: '#9f8b9e' };
  const mara = { id: 'custom-character-mara', classId: 'character', label: 'Mara', color: '#6d6663' };
  const cassian = { id: 'custom-character-cassian', classId: 'character', label: 'Cassian', color: '#6d6663' };
  const projectOptions = [customStorm, customTender, mara, cassian];

  const plainText = [
    'Chapter 1',
    'Mara crossed the moonlit hall and touched the silver door.',
    'The repeated promise waited in the dark.',
    'Cassian laughed because the broken crown glittered anyway.',
    'The repeated promise waited in the dark.',
    'A final breath asked for a full page image beside the sea.',
  ].join(' ');
  const chapter = {
    id: 'chapter-1',
    title: 'Chapter 1',
    chapterNumber: 1,
    plainText,
    audioFileName: 'chapter-01.mp3',
  };
  const base = { projectOptions, plainText, chapter };
  const annotations = [
    makeAnnotation({ ...base, classId: 'highlight', wordStart: 5, wordEnd: 7, note: 'normal highlight' }),
    makeAnnotation({ ...base, classId: 'image', optionId: 'image-inline', wordStart: 10, wordEnd: 11, note: 'inline ref' }),
    makeAnnotation({ ...base, classId: 'image', optionId: 'image-full-spread', wordStart: 43, wordEnd: 45, note: 'spread ref' }),
    makeAnnotation({ ...base, classId: 'emotion', optionId: 'emotion-dramatic', wordStart: 24, wordEnd: 25 }),
    makeAnnotation({ ...base, classId: 'emotion', optionId: 'emotion-romantic', wordStart: 13, wordEnd: 15 }),
    makeAnnotation({ ...base, classId: 'emotion', optionId: 'emotion-funny', wordStart: 28, wordEnd: 30 }),
    makeAnnotation({ ...base, classId: 'emotion', optionId: customStorm.id, wordStart: 16, wordEnd: 17 }),
    makeAnnotation({ ...base, classId: 'emotion', optionId: customTender.id, wordStart: 39, wordEnd: 40 }),
    makeAnnotation({ ...base, classId: 'character', optionId: mara.id, wordStart: 1, wordEnd: 1 }),
    makeAnnotation({ ...base, classId: 'character', optionId: cassian.id, wordStart: 24, wordEnd: 24 }),
    makeAnnotation({ ...base, classId: 'emotion', optionId: 'emotion-dramatic', wordStart: 32, wordEnd: 36, note: 'duplicate phrase 2' }),
  ];
  annotations.push(makeAnnotation({ ...base, classId: 'character', optionId: mara.id, wordStart: 32, wordEnd: 36 }));

  const project = { title: 'Export Audit Sandbox', chapters: [chapter], annotationOptions: projectOptions, annotations };
  const csv = buildAnnotationsCsv(project);
  const jsx = buildInDesignJsx(project);
  const exported = parseExportedAnnotations(jsx);

  assert.equal(exported.length, annotations.length);
  assert.ok(csv.includes('"Highlight"'));
  assert.ok(csv.includes('"Image: Inline Image"'));
  assert.ok(csv.includes('"Image: Full Spread"'));
  assert.ok(csv.includes('"Emotion: Dramatic"'));
  assert.ok(csv.includes('"Emotion: Romantic"'));
  assert.ok(csv.includes('"Emotion: Funny"'));
  assert.ok(csv.includes('"Emotion: Storm dread"'));
  assert.ok(csv.includes('"Character: Mara"'));
  assert.ok(csv.includes('"12.35"'), 'CSV should round numeric timestamps to two decimals');

  assert.deepEqual(new Set(exported.map((a) => a.classId)), new Set(['highlight', 'image', 'emotion', 'character']));
  assert.ok(exported.some((a) => a.optionId === 'image-inline' && a.note === 'inline ref'));
  assert.ok(exported.some((a) => a.optionId === 'image-full-spread' && a.note === 'spread ref'));
  assert.ok(exported.some((a) => a.optionId === customStorm.id && a.color === '#7d8fa6'));
  assert.ok(exported.some((a) => a.optionId === customTender.id && a.color === '#9f8b9e'));
  assert.ok(exported.some((a) => a.classId === 'highlight' && a.color === '#f0aac0'));
  assert.ok(exported.some((a) => a.classId === 'character' && a.markerOnly === true));
  assert.ok(exported.every((a) => a.textContext?.phrase && a.textContext?.target), 'all annotations should carry locator context');

  assert.ok(jsx.includes('trySet(style, { pointSize: 16, underline: true, underlineColor: color, underlineWeight: 8, underlineOffset: -3 })'));
  assert.ok(jsx.includes('INSERT IMG'));
  assert.ok(jsx.includes('INSERT FULL SPREAD'));
  assert.ok(jsx.includes('return "[" + sanitizeMarkerText(annotation.optionLabel || annotation.label || "CHARACTER") + "]"'));
  assert.ok(jsx.includes('return "E > " + emotionLabel + (characterLabel ? " > " + characterLabel : "")'));
  assert.ok(!jsx.includes('#f2b84b'), 'the old fake yellow/gold test color must not appear');
  assert.ok(!jsx.includes('Gold underline'), 'the old fake test label must not appear');
});
