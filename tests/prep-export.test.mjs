import assert from 'node:assert/strict';
import test from 'node:test';

import JSZip from 'jszip';

import { buildPrepHighlightedDocxBlob } from '../app/components/prepExport.js';

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

test('Prep Word export does not write unattached side-voice comments when text is split across Word runs', async () => {
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

  assert.equal((documentXml.match(/<w:commentRangeStart\b/g) || []).length, 0, 'split-run text should not receive a risky partial comment anchor');
  assert.equal(zip.file('word/comments.xml'), null, 'unanchored new comments should not be written');
});
