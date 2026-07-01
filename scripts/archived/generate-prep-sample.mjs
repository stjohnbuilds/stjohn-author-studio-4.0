// Generate a sample Prep Word export via the SAME function the app
// calls (buildPrepHighlightedDocxBlob), and write it where Marie can
// open it in Word. The output is byte-for-byte identical to what
// clicking Export inside Prep Manuscript produces.
//
// Run: node scripts/generate-prep-sample.mjs

import fs from 'fs';
import os from 'os';
import path from 'path';
import JSZip from 'jszip';
import { buildPrepHighlightedDocxBlob } from '../app/components/prepExport.js';

async function makeSourceDocxBase64(paragraphs) {
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
  const paragraphXml = paragraphs.map(
    (text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
  ).join('');
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphXml}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`);
  // NOTE: use the open-close form Word actually writes — the export
  // looks for the literal </Relationships> tag to splice the comments
  // relationship in. A self-closing <Relationships/> would skip that
  // splice and Word would drop comments. (Real Word docs always use
  // open-close, so Marie's normal manuscripts are fine.)
  zip.folder('word').folder('_rels').file('document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
  return (await zip.generateAsync({ type: 'nodebuffer' })).toString('base64');
}

const paragraphs = [
  '&quot;Hello there,&quot; Mara said. &quot;Bring the lantern,&quot; whispered the guard.',
  '&quot;I think we should go,&quot; said Mara softly.',
  'Cassian crossed the moonlit hall. &quot;She lied,&quot; he said. The crown glittered anyway.',
  '&quot;Wait,&quot; called the messenger from the door. &quot;The king wants you.&quot;',
];

const project = {
  title: 'Sample Manuscript',
  fileName: 'Sample-Manuscript.docx',
  sourceDocxBase64: await makeSourceDocxBase64(paragraphs),
  characters: [
    {
      id: 'char-mara',
      name: 'Mara',
      narratorName: 'Alyssa',
      colorHex: '#f0aac0',
      sideVoices: [
        { id: 'sv-guard', name: 'Guard', narratorName: 'Daryl', notes: 'Rough whisper, one-time', recurring: false },
        { id: 'sv-messenger', name: 'Messenger', narratorName: 'Daryl', notes: 'Slightly out of breath', recurring: false },
      ],
    },
    {
      id: 'char-cassian',
      name: 'Cassian',
      narratorName: 'Tom',
      colorHex: '#7d8fa6',
      sideVoices: [],
    },
  ],
  chapters: [
    {
      chapterNumber: 1,
      title: 'Chapter 1 — The Door',
      sections: [
        {
          title: 'Chapter 1 — The Door',
          html: paragraphs.map((p) => `<p>${p.replace(/&quot;/g, '"')}</p>`).join(''),
          dialogueSpans: [
            { text: 'Hello there,', characterId: 'char-mara' },
            { text: 'Bring the lantern,', characterId: 'char-mara', sideVoiceId: 'sv-guard' },
            { text: 'I think we should go,', characterId: 'char-mara' },
            { text: 'She lied,', characterId: 'char-cassian' },
            { text: 'Wait,', characterId: 'char-mara', sideVoiceId: 'sv-messenger' },
            { text: 'The king wants you.', characterId: 'char-mara', sideVoiceId: 'sv-messenger' },
          ],
        },
      ],
    },
  ],
};

const blob = await buildPrepHighlightedDocxBlob(project);
const buffer = Buffer.from(await blob.arrayBuffer());

const targetDir = path.join(os.homedir(), 'Downloads');
fs.mkdirSync(targetDir, { recursive: true });
const targetPath = path.join(targetDir, 'Prep-Export-Sample.docx');
fs.writeFileSync(targetPath, buffer);

console.log(`Wrote ${buffer.length} bytes`);
console.log(`Path: ${targetPath}`);
console.log('');
console.log('Open it in Word to see exactly what the app produces.');
console.log('Expected: highlighted dialogue for Mara (pink) and Cassian (blue),');
console.log('plus Word comments on the Guard and Messenger side-voice lines.');
