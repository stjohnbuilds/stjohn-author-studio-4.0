import assert from 'node:assert/strict';
import test from 'node:test';

import JSZip from 'jszip';

import { buildPrepHighlightedDocx, buildPrepHighlightedDocxBlob } from '../app/components/prepExport.js';

async function makeSourceDocxBase64(paragraphText, { includeExistingComment = false } = {}) {
  return makeSourceDocxBase64FromRuns([paragraphText], { includeExistingComment });
}

async function makeSourceDocxBase64FromRuns(paragraphRuns, { includeExistingComment = false } = {}) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  const existingCommentStart = includeExistingComment ? '<w:commentRangeStart w:id="0"/>' : '';
  const existingCommentEnd = includeExistingComment ? '<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>' : '';
  const runsXml = paragraphRuns.map((text) => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`).join('');
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>${existingCommentStart}${runsXml}${existingCommentEnd}</w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`);
  zip.folder('word').folder('_rels').file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${includeExistingComment ? '<Relationship Id="rIdExistingComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>' : ''}</Relationships>`);
  if (includeExistingComment) {
    zip.folder('word').file('comments.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="Editor"><w:p><w:r><w:t>Existing comment</w:t></w:r></w:p></w:comment></w:comments>`);
    const ct = await zip.file('[Content_Types].xml').async('string');
    zip.file('[Content_Types].xml', ct.replace(
      '</Types>',
      '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'
    ));
  }
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return buffer.toString('base64');
}

async function unzipBlob(blob) {
  const buffer = Buffer.from(await blob.arrayBuffer());
  return JSZip.loadAsync(buffer);
}

test('Prep Word export adds real Word comments for side voices and highlights assigned dialogue', async () => {
  const sourceText = '&quot;Hello there,&quot; Mara said. &quot;Bring the lantern,&quot; whispered the guard.';
  const project = {
    title: 'Prep Export Audit',
    fileName: 'prep-audit.docx',
    sourceDocxBase64: await makeSourceDocxBase64(sourceText),
    characters: [
      {
        id: 'char-mara',
        name: 'Mara',
        narratorName: 'Alyssa',
        colorHex: '#f0aac0',
        sideVoices: [
          {
            id: 'sv-guard',
            name: 'Guard',
            narratorName: 'Daryl',
            notes: 'Rough whisper',
            recurring: false,
          },
        ],
      },
    ],
    chapters: [
      {
        chapterNumber: 1,
        title: 'Chapter 1',
        sections: [
          {
            title: 'Chapter 1',
            html: '<p>"Hello there," Mara said. "Bring the lantern," whispered the guard.</p>',
            dialogueSpans: [
              { text: 'Hello there,', characterId: 'char-mara' },
              { text: 'Bring the lantern,', characterId: 'char-mara', sideVoiceId: 'sv-guard' },
            ],
          },
        ],
      },
    ],
  };

  const blob = await buildPrepHighlightedDocxBlob(project);
  const zip = await unzipBlob(blob);
  const documentXml = await zip.file('word/document.xml').async('string');
  const commentsXml = await zip.file('word/comments.xml').async('string');
  const contentTypesXml = await zip.file('[Content_Types].xml').async('string');
  const relsXml = await zip.file('word/_rels/document.xml.rels').async('string');

  assert.ok(documentXml.includes('Narrator breakdown'), 'export should prepend the narrator breakdown');
  assert.ok(documentXml.includes('w:fill="F0AAC0"'), 'main character dialogue should be highlighted');
  assert.ok(documentXml.includes('<w:commentRangeStart w:id="0"/>'), 'side voice dialogue should start a Word comment range');
  assert.ok(documentXml.includes('<w:commentRangeEnd w:id="0"/>'), 'side voice dialogue should end a Word comment range');
  assert.ok(documentXml.includes('<w:commentReference w:id="0"/>'), 'side voice dialogue should include a Word comment reference');
  assert.equal((documentXml.match(/<w:commentRangeStart/g) || []).length, 1, 'main character dialogue should not create comment noise');

  assert.ok(commentsXml.includes('<w:comment w:id="0"'), 'comments.xml should contain the side voice comment');
  assert.ok(commentsXml.includes('Character: Guard'));
  assert.ok(commentsXml.includes('Narrator: Daryl'));
  assert.ok(commentsXml.includes('Side voice of Mara'));
  assert.ok(commentsXml.includes('Notes: Rough whisper'));
  assert.ok(commentsXml.includes('[One time]'));

  assert.ok(contentTypesXml.includes('wordprocessingml.comments+xml'), 'content types must register word/comments.xml');
  assert.ok(relsXml.includes('relationships/comments'), 'document relationships must point to comments.xml');
});

test('Prep Word export preserves existing comments and only comments the assigned duplicate occurrence once', async () => {
  const sourceText = '&quot;Go,&quot; Mara said. &quot;Go,&quot; whispered the guard.';
  const project = {
    title: 'Prep Duplicate Comment Audit',
    fileName: 'prep-duplicate-audit.docx',
    sourceDocxBase64: await makeSourceDocxBase64(sourceText, { includeExistingComment: true }),
    characters: [
      {
        id: 'char-mara',
        name: 'Mara',
        narratorName: 'Alyssa',
        colorHex: '#f0aac0',
        sideVoices: [{ id: 'sv-guard', name: 'Guard', narratorName: 'Daryl', notes: '', recurring: true }],
      },
    ],
    chapters: [
      {
        chapterNumber: 1,
        title: 'Chapter 1',
        sections: [
          {
            title: 'Chapter 1',
            html: '<p>"Go," Mara said. "Go," whispered the guard.</p>',
            dialogueSpans: [
              { text: 'Go,', characterId: 'char-mara' },
              { text: 'Go,', characterId: 'char-mara', sideVoiceId: 'sv-guard' },
            ],
          },
        ],
      },
    ],
  };

  const blob = await buildPrepHighlightedDocxBlob(project);
  const zip = await unzipBlob(blob);
  const documentXml = await zip.file('word/document.xml').async('string');
  const commentsXml = await zip.file('word/comments.xml').async('string');

  assert.equal((commentsXml.match(/<w:comment\b/g) || []).length, 2, 'existing comment plus new side-voice comment should both remain');
  assert.ok(commentsXml.includes('Existing comment'));
  assert.ok(commentsXml.includes('Character: Guard'));
  assert.ok(documentXml.includes('<w:commentRangeStart w:id="0"/>'), 'existing comment id should remain');
  assert.ok(documentXml.includes('<w:commentRangeStart w:id="1"/>'), 'new side-voice comment should use the next id');
  assert.equal((documentXml.match(/<w:commentRangeStart\b/g) || []).length, 2, 'duplicate dialogue should not create extra side-voice comment anchors');
  assert.ok(
    documentXml.indexOf('<w:commentRangeStart w:id="1"/>') > documentXml.indexOf('Mara said'),
    'context check should attach the side-voice comment to the second duplicate quote, not the first'
  );
});

test('Prep Word export uses context when only the later duplicate is assigned', async () => {
  const sourceText = '&quot;Go,&quot; Mara said. &quot;Go,&quot; whispered the guard.';
  const project = {
    title: 'Prep Context Only Audit',
    fileName: 'prep-context-only-audit.docx',
    sourceDocxBase64: await makeSourceDocxBase64(sourceText),
    characters: [
      {
        id: 'char-mara',
        name: 'Mara',
        narratorName: 'Alyssa',
        colorHex: '#f0aac0',
        sideVoices: [{ id: 'sv-guard', name: 'Guard', narratorName: 'Daryl', notes: '', recurring: false }],
      },
    ],
    chapters: [
      {
        chapterNumber: 1,
        title: 'Chapter 1',
        sections: [
          {
            title: 'Chapter 1',
            html: '<p>"Go," Mara said. "Go," whispered the guard.</p>',
            dialogueSpans: [
              { text: 'Go,' },
              { text: 'Go,', characterId: 'char-mara', sideVoiceId: 'sv-guard' },
            ],
          },
        ],
      },
    ],
  };

  const blob = await buildPrepHighlightedDocxBlob(project);
  const zip = await unzipBlob(blob);
  const documentXml = await zip.file('word/document.xml').async('string');
  const commentsXml = await zip.file('word/comments.xml').async('string');

  assert.equal((documentXml.match(/<w:commentRangeStart\b/g) || []).length, 1, 'only the assigned duplicate should get a comment anchor');
  assert.equal((commentsXml.match(/<w:comment\b/g) || []).length, 1, 'only one new side-voice comment should be written');
  assert.ok(
    documentXml.indexOf('<w:commentRangeStart w:id="0"/>') > documentXml.indexOf('Mara said'),
    'context should skip the first duplicate and anchor the later assigned line'
  );
});

// Rule is: a line that Word has split across several runs is highlighted in
// full and carries a complete comment (start, end and reference). Before the
// highlighter matched whole paragraphs, such lines were skipped, and this
// test only checked that no half-attached comment was left behind. Skipping
// them is what left most of a real book unhighlighted, so the test now asks
// for the stronger result and still checks that no comment is left dangling.
test('Prep Word export highlights and fully comments a line that is split across Word runs', async () => {
  const project = {
    title: 'Prep Split Run Audit',
    fileName: 'prep-split-run-audit.docx',
    sourceDocxBase64: await makeSourceDocxBase64FromRuns([
      '&quot;Split ',
      'line,&quot; whispered the guard.',
    ]),
    characters: [
      {
        id: 'char-mara',
        name: 'Mara',
        narratorName: 'Alyssa',
        colorHex: '#f0aac0',
        sideVoices: [{ id: 'sv-guard', name: 'Guard', narratorName: 'Daryl', notes: '', recurring: false }],
      },
    ],
    chapters: [
      {
        chapterNumber: 1,
        title: 'Chapter 1',
        sections: [
          {
            title: 'Chapter 1',
            html: '<p>"Split line," whispered the guard.</p>',
            dialogueSpans: [
              { text: 'Split line,', characterId: 'char-mara', sideVoiceId: 'sv-guard' },
            ],
          },
        ],
      },
    ],
  };

  const blob = await buildPrepHighlightedDocxBlob(project);
  const zip = await unzipBlob(blob);
  const documentXml = await zip.file('word/document.xml').async('string');
  const commentsXml = await zip.file('word/comments.xml').async('string');

  const sideVoiceFill = (documentXml.match(/w:fill="([0-9A-F]{6})"\/><\/w:rPr><w:t xml:space="preserve">Split /) || [])[1];
  assert.ok(sideVoiceFill, 'the first half of the split line should be shaded');
  const manuscriptStretches = shadedTexts(documentXml, sideVoiceFill).filter((text) => /Split|line|whispered|guard/.test(text));
  assert.deepEqual(manuscriptStretches, ['Split line,'], 'both halves of the split line should be shaded as one stretch, and nothing after it');
  assert.equal((documentXml.match(/<w:commentRangeStart\b/g) || []).length, 1, 'the split line should get exactly one comment start');
  assert.equal((documentXml.match(/<w:commentRangeEnd\b/g) || []).length, 1, 'and exactly one comment end');
  assert.equal((documentXml.match(/<w:commentReference\b/g) || []).length, 1, 'and exactly one comment reference');
  const start = documentXml.indexOf('<w:commentRangeStart w:id="0"/>');
  const end = documentXml.indexOf('<w:commentRangeEnd w:id="0"/>');
  assert.ok(start !== -1 && start < documentXml.indexOf('Split '), 'the comment should start before the first half');
  assert.ok(end > documentXml.indexOf('line,'), 'the comment should end after the second half');
  assert.equal((commentsXml.match(/<w:comment\b/g) || []).length, 1, 'one comment written, and it is the anchored one');
  assert.ok(commentsXml.includes('Character: Guard'));
});

// ── Whole-paragraph matching ───────────────────────────────────────────────
// These cover what a real book contains and the single-paragraph fixtures
// above do not: page-break markers inside runs, italics inside a line, text
// that is already shaded, and short lines that repeat across chapters.

async function makeSourceDocxBase64FromBody(bodyXml) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`);
  zip.folder('word').folder('_rels').file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  return buffer.toString('base64');
}

// The text of every stretch shaded in one colour, in reading order. Shaded
// runs with nothing unshaded between them count as one stretch.
function shadedTexts(documentXml, fill) {
  const stretches = [];
  for (const paragraph of documentXml.matchAll(/<w:p(?=[\s>])[^>]*>([\s\S]*?)<\/w:p>/g)) {
    let open = false;
    for (const run of paragraph[1].matchAll(/<w:r(?=[\s>])[^>]*>([\s\S]*?)<\/w:r>/g)) {
      let text = '';
      for (const t of run[1].matchAll(/<w:t(?=[\s>])[^>]*>([^<]*)<\/w:t>/g)) text += t[1];
      if (!text) continue;
      if (run[1].includes(`w:fill="${fill}"`)) {
        if (open) stretches[stretches.length - 1] += text;
        else stretches.push(text);
        open = true;
      } else {
        open = false;
      }
    }
  }
  return stretches.map((s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
}

function plainProject(sourceDocxBase64, characters, spans) {
  return {
    title: 'Whole Paragraph Audit',
    fileName: 'whole-paragraph-audit.docx',
    sourceDocxBase64,
    characters,
    chapters: [{ chapterNumber: 1, title: 'Chapter 1', sections: [{ title: 'Chapter 1', html: '', dialogueSpans: spans }] }],
  };
}

const TEAL = { id: 'char-teal', name: 'Speaker One', narratorName: 'Narrator One', colorHex: '#11aa99', sideVoices: [] };
const PLUM = { id: 'char-plum', name: 'Speaker Two', narratorName: 'Narrator Two', colorHex: '#aa1199', sideVoices: [] };

test('Prep Word export highlights a line whose run starts with a page-break marker', async () => {
  const source = await makeSourceDocxBase64FromBody(
    '<w:p><w:r><w:lastRenderedPageBreak/><w:t xml:space="preserve">&quot;Over the page,&quot; she said.</w:t></w:r></w:p>'
  );
  const { blob, highlight } = await buildPrepHighlightedDocx(plainProject(source, [TEAL], [
    { text: 'Over the page,', characterId: 'char-teal' },
  ]));
  const documentXml = await (await unzipBlob(blob)).file('word/document.xml').async('string');

  assert.deepEqual(shadedTexts(documentXml, '11AA99'), ['Over the page,']);
  assert.equal((documentXml.match(/<w:lastRenderedPageBreak\/>/g) || []).length, 1, 'the page-break marker should be kept, once');
  assert.deepEqual({ wanted: highlight.wanted, highlighted: highlight.highlighted, missed: highlight.missed }, { wanted: 1, highlighted: 1, missed: [] });
});

test('Prep Word export highlights a line with italics in the middle and keeps the italics', async () => {
  const source = await makeSourceDocxBase64FromBody(
    '<w:p>'
    + '<w:r><w:t xml:space="preserve">&quot;I </w:t></w:r>'
    + '<w:r><w:rPr><w:i/></w:rPr><w:t>really</w:t></w:r>'
    + '<w:r><w:t xml:space="preserve"> mean it,&quot; he said.</w:t></w:r>'
    + '</w:p>'
  );
  const { blob } = await buildPrepHighlightedDocx(plainProject(source, [TEAL], [
    { text: 'I really mean it,', characterId: 'char-teal' },
  ]));
  const documentXml = await (await unzipBlob(blob)).file('word/document.xml').async('string');

  assert.deepEqual(shadedTexts(documentXml, '11AA99'), ['I really mean it,']);
  assert.match(documentXml, /<w:rPr><w:i\/><w:shd [^>]*w:fill="11AA99"\/><\/w:rPr><w:t xml:space="preserve">really<\/w:t>/, 'the italic word should stay italic and gain the shading');
  assert.ok(documentXml.includes('he said.'), 'text after the line should be untouched');
});

test('Prep Word export replaces existing shading instead of adding a second shading tag', async () => {
  const source = await makeSourceDocxBase64FromBody(
    '<w:p><w:r><w:rPr><w:shd w:val="clear" w:color="auto" w:fill="FFFF00"/><w:highlight w:val="yellow"/></w:rPr>'
    + '<w:t xml:space="preserve">&quot;Already coloured,&quot; she said.</w:t></w:r></w:p>'
  );
  const { blob } = await buildPrepHighlightedDocx(plainProject(source, [TEAL], [
    { text: 'Already coloured,', characterId: 'char-teal' },
  ]));
  const documentXml = await (await unzipBlob(blob)).file('word/document.xml').async('string');

  assert.deepEqual(shadedTexts(documentXml, '11AA99'), ['Already coloured,']);
  for (const properties of documentXml.matchAll(/<w:rPr>([\s\S]*?)<\/w:rPr>/g)) {
    assert.ok((properties[1].match(/<w:shd\b/g) || []).length <= 1, 'no run may carry two shading tags');
    if (properties[1].includes('11AA99')) assert.ok(!properties[1].includes('<w:highlight'), 'a marker-pen highlight would hide the character colour');
  }
  assert.deepEqual(shadedTexts(documentXml, 'FFFF00'), ['"', '" she said.'], 'text outside the line keeps its original shading');
});

test('Prep Word export never paints a short line onto a later repeat when its own place cannot be matched', async () => {
  // The first short line reads differently in the Word file than in the
  // project, so it cannot be placed. It must be reported as missed, and the
  // identical short line three paragraphs later must still get the colour
  // of the character it was actually given to.
  const source = await makeSourceDocxBase64FromBody(
    '<w:p><w:r><w:t xml:space="preserve">&quot;Yes!&quot; said the first.</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t xml:space="preserve">&quot;This long line sits between the two short ones,&quot; said the second.</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t xml:space="preserve">Nothing was said for a while.</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t xml:space="preserve">&quot;Yes.&quot; said the third.</w:t></w:r></w:p>'
    + '<w:p><w:r><w:t xml:space="preserve">&quot;And this long line comes after both of them,&quot; said the fourth.</w:t></w:r></w:p>'
  );
  const { blob, highlight } = await buildPrepHighlightedDocx(plainProject(source, [TEAL, PLUM], [
    { text: 'Yes.', characterId: 'char-teal' },
    { text: 'This long line sits between the two short ones,', characterId: 'char-teal' },
    { text: 'Yes.', characterId: 'char-plum' },
    { text: 'And this long line comes after both of them,', characterId: 'char-teal' },
  ]));
  const documentXml = await (await unzipBlob(blob)).file('word/document.xml').async('string');

  assert.deepEqual(shadedTexts(documentXml, '11AA99'), [
    'This long line sits between the two short ones,',
    'And this long line comes after both of them,',
  ], 'lines after a miss should still be highlighted, and the missed one should not borrow a later match');
  assert.deepEqual(shadedTexts(documentXml, 'AA1199'), ['Yes.'], 'the later short line keeps its own character colour');
  assert.ok(documentXml.indexOf('w:fill="AA1199"') > documentXml.indexOf('Nothing was said'), 'and it is the later one that is shaded');
  assert.deepEqual({ wanted: highlight.wanted, highlighted: highlight.highlighted, missed: highlight.missed }, { wanted: 4, highlighted: 3, missed: ['Yes.'] });
});

test('Prep Word export uses unassigned lines to keep its place among repeats', async () => {
  const source = await makeSourceDocxBase64FromBody(
    '<w:p><w:r><w:t xml:space="preserve">&quot;No.&quot; &quot;No.&quot; &quot;No.&quot;</w:t></w:r></w:p>'
  );
  const { blob } = await buildPrepHighlightedDocx(plainProject(source, [TEAL], [
    { text: 'No.' },
    { text: 'No.' },
    { text: 'No.', characterId: 'char-teal' },
  ]));
  const documentXml = await (await unzipBlob(blob)).file('word/document.xml').async('string');

  assert.deepEqual(shadedTexts(documentXml, '11AA99'), ['No.']);
  const shadedAt = documentXml.indexOf('w:fill="11AA99"');
  assert.equal((documentXml.slice(0, shadedAt).match(/No\./g) || []).length, 2, 'the first two repeats come before the shaded one');
});
