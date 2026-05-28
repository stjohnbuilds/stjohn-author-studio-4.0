import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const outputDir = path.join(here, 'artifacts');

const { buildAnnotationsCsv, buildInDesignJsx } = await import(
  path.join(repoRoot, 'packages/quill-engine/exporters.js')
);
const { buildWordSpans, htmlToPlainText } = await import(
  path.join(repoRoot, 'packages/quill-engine/normalize.js')
);

const chapters = [
  {
    id: 'ch-1',
    chapterNumber: 1,
    title: 'Chapter 1: The Lantern Door',
    audioFileName: '01_lantern_door.mp3',
    paragraphs: [
      'Mara found the lantern door after the last bell, when the house had gone quiet and even the rain seemed to be listening. A silver thread caught in the hem of the night, bright enough to lead her across the landing without touching the floorboards.',
      'The door had not been there in the afternoon. It stood between the linen cupboard and the cracked mirror, narrow as a promise and warm around the brass keyhole. Mara swallowed the answer before it could burn, then placed one palm against the wood.',
      'On the other side, someone laughed once, softly. The sound was not kind, but it was not cruel either. It was the sound of a person who had been waiting a very long time and had almost forgotten how waiting ended.',
    ],
  },
  {
    id: 'ch-2',
    chapterNumber: 2,
    title: 'Chapter 2: Brass Wings',
    audioFileName: '02_brass_wings.mp3',
    paragraphs: [
      'Cassian drew the map in ash while the others argued over the safest road. He did not look up when the clockwork moth opened its brass wings on the table and scattered dust across the ink.',
      'Every wingbeat made the compass needle turn. North became west, west became down, and down became a staircase no one could see until the moth settled on Mara’s sleeve.',
      'The room held its breath. Cassian smiled without meaning to, and that was how Mara knew the map was telling the truth.',
    ],
  },
  {
    id: 'ch-3',
    chapterNumber: 3,
    title: 'Chapter 3: Below the Glass City',
    audioFileName: '03_glass_city.mp3',
    paragraphs: [
      'They reached the balcony just before dawn. Far beneath the rail, the city unfolded below them like a book of lanterns, every street turned gold by windows waking one by one.',
      'Mara wanted to hate its beauty. She wanted the city to look like the trap it was, all teeth and shadow, but the morning softened every edge until even the towers seemed sorry.',
      'Cassian handed her the moth and said nothing. Its tiny feet clicked against her glove, patient as a metronome.',
    ],
  },
  {
    id: 'ch-4',
    chapterNumber: 4,
    title: 'Chapter 4: The Margin Note',
    audioFileName: '04_margin_note.mp3',
    paragraphs: [
      'The old printer kept a blue pencil behind his ear and a knife under the counter. He read the letter twice before asking who had taught Mara to hide a warning in a wedding invitation.',
      'She told him no one had taught her. That was almost true. Grief had taught her the alphabet, fear had taught her speed, and love had taught her where to leave the door open.',
      'When the printer finally nodded, the moth clicked once and folded itself flat against the page.',
    ],
  },
];

function chapterHtml(chapter) {
  return [
    `<h1>${chapter.title}</h1>`,
    ...chapter.paragraphs.map((paragraph) => `<p>${paragraph}</p>`),
  ].join('\n');
}

function findWordRange(plainText, phrase) {
  const sourceSpans = buildWordSpans(plainText);
  const phraseWords = buildWordSpans(phrase).map((span) => span.word.toLowerCase());
  for (let start = 0; start <= sourceSpans.length - phraseWords.length; start += 1) {
    const matches = phraseWords.every((word, offset) => (
      sourceSpans[start + offset]?.word.toLowerCase() === word
    ));
    if (matches) {
      return {
        wordStart: start,
        wordEnd: start + phraseWords.length - 1,
        selectedText: phrase,
      };
    }
  }
  throw new Error(`Could not find phrase: ${phrase}`);
}

function annotation(chapter, phrase, values) {
  const plainText = chapter.plainText;
  const range = findWordRange(plainText, phrase);
  return {
    id: values.id,
    sectionId: chapter.id,
    sectionTitle: chapter.title,
    chapterNumber: chapter.chapterNumber,
    audioFileName: chapter.audioFileName,
    timestamp: values.timestamp,
    ...range,
    ...values,
  };
}

const projectChapters = chapters.map((chapter) => {
  const textHtml = chapterHtml(chapter);
  return {
    ...chapter,
    textHtml,
    plainText: htmlToPlainText(textHtml),
  };
});

const byId = Object.fromEntries(projectChapters.map((chapter) => [chapter.id, chapter]));

const project = {
  id: 'indesign-export-test-project',
  title: 'Quill & Ink InDesign Export Test',
  chapters: projectChapters,
  annotations: [
    annotation(byId['ch-1'], 'silver thread caught in the hem of the night', {
      id: 'ann-highlight-gold',
      classId: 'highlight',
      classLabel: 'Highlight',
      optionId: 'highlight-gold',
      optionLabel: 'Gold underline',
      label: 'Highlight / Gold underline',
      color: '#f2b84b',
      timestamp: 18.24,
      note: 'Test underline style',
    }),
    annotation(byId['ch-1'], 'Mara swallowed the answer before it could burn', {
      id: 'ann-character-mara',
      classId: 'character',
      classLabel: 'Character',
      optionId: 'character-mara',
      optionLabel: 'Mara',
      label: 'Character / Mara',
      color: '#b8d8b8',
      timestamp: 42.7,
      markerOnly: true,
      note: 'Character tag should insert [Mara]',
    }),
    annotation(byId['ch-1'], 'Mara swallowed the answer before it could burn', {
      id: 'ann-emotion-fear',
      classId: 'emotion',
      classLabel: 'Emotion',
      optionId: 'emotion-fear',
      optionLabel: 'Fear',
      label: 'Emotion / Fear',
      color: '#cb8aa0',
      timestamp: 42.7,
      note: 'Emotion should link to Mara when same range is tagged',
    }),
    annotation(byId['ch-2'], 'the clockwork moth opened its brass wings', {
      id: 'ann-small-image-moth',
      classId: 'image',
      classLabel: 'Image',
      optionId: 'image-spot',
      optionLabel: 'Spot illustration',
      label: 'Image / Spot illustration',
      color: '#d82828',
      timestamp: 28.12,
      note: 'Tiny brass moth in the margin',
    }),
    annotation(byId['ch-2'], 'Cassian drew the map in ash', {
      id: 'ann-character-cassian',
      classId: 'character',
      classLabel: 'Character',
      optionId: 'character-cassian',
      optionLabel: 'Cassian',
      label: 'Character / Cassian',
      color: '#b8d8b8',
      timestamp: 4.5,
      markerOnly: true,
      note: 'Character tag should insert [Cassian]',
    }),
    annotation(byId['ch-3'], 'the city unfolded below them like a book of lanterns', {
      id: 'ann-full-spread-city',
      classId: 'full-page-spread',
      classLabel: 'Image',
      optionId: 'image-full-spread',
      optionLabel: 'Full page spread',
      label: 'Image / Full page spread',
      color: '#d82828',
      timestamp: 11.33,
      note: 'Wide city lantern spread',
    }),
  ],
};

await fs.mkdir(outputDir, { recursive: true });

const projectPath = path.join(outputDir, 'stjohn-indesign-test-project.json');
const jsxPath = path.join(outputDir, 'stjohn-indesign-test-annotations.jsx');
const csvPath = path.join(outputDir, 'stjohn-indesign-test-annotations.csv');
const readmePath = path.join(outputDir, 'README.txt');
const docxPath = path.join(outputDir, 'stjohn-indesign-test-manuscript.docx');

await fs.writeFile(projectPath, `${JSON.stringify(project, null, 2)}\n`);
await fs.writeFile(jsxPath, buildInDesignJsx(project));
await fs.writeFile(csvPath, buildAnnotationsCsv(project));
await fs.writeFile(readmePath, [
  'StJohn InDesign export test pack',
  '',
  '1. Open InDesign and place stjohn-indesign-test-manuscript.docx.',
  '2. Run stjohn-indesign-test-annotations.jsx from InDesign.',
  '3. Expected result: highlighted text, character markers, emotion style, and image/full-spread markers.',
  '',
  'This JSX was generated by packages/quill-engine/exporters.js buildInDesignJsx().',
  'The CSV was generated by buildAnnotationsCsv().',
  '',
].join('\n'));

const python = '/Users/mariemackay/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const docxScript = path.join(here, 'build-manuscript-docx.py');
const result = spawnSync(python, [docxScript, projectPath, docxPath], {
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Wrote ${docxPath}`);
console.log(`Wrote ${jsxPath}`);
console.log(`Wrote ${csvPath}`);

