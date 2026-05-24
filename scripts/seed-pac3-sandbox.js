// NOTE: Claude Opus 4.6 (via GitHub Copilot) was here — 2026-03-26. Hi Marie!
const fs = require('fs');
const os = require('os');
const path = require('path');
const mammoth = require('mammoth');

const ROOT = path.resolve(__dirname, '..');
const BOOKS_PATH = path.join(ROOT, 'Save Data', 'books.json');
const SANDBOX_BOOK_ID = 'dev-sandbox-pac3';

function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {}
  }
  return null;
}

function desktopCandidates(fileName) {
  const home = os.homedir();
  return [
    path.join(home, 'Desktop', fileName),
    path.join(home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Desktop', fileName),
  ];
}

function readBooks() {
  try {
    if (!fs.existsSync(BOOKS_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBooks(books) {
  fs.mkdirSync(path.dirname(BOOKS_PATH), { recursive: true });
  fs.writeFileSync(BOOKS_PATH, JSON.stringify(books, null, 2), 'utf8');
}

async function main() {
  const audioPath = firstExistingPath(desktopCandidates('PAC3 Test.mp3'));
  const docxPath = firstExistingPath(desktopCandidates('PAC3 Test manuscript.docx'));

  if (!audioPath || !docxPath) {
    const missing = [];
    if (!audioPath) missing.push('PAC3 Test.mp3');
    if (!docxPath) missing.push('PAC3 Test manuscript.docx');
    throw new Error(
      `Missing sandbox file(s): ${missing.join(', ')}. Expected them on your Desktop or iCloud Desktop.`
    );
  }

  const result = await mammoth.convertToHtml({ path: docxPath });
  const html = String(result.value || '').trim();
  if (!html) {
    throw new Error('DOCX converted successfully but produced empty HTML.');
  }

  const sandboxBook = {
    id: SANDBOX_BOOK_ID,
    title: 'PAC3 Sandbox',
    fileName: path.basename(docxPath),
    chapterLevel: 1,
    narratorColors: [],
    manuscriptSource: {
      stored: false,
      fileName: path.basename(docxPath),
    },
    chapters: [
      {
        id: 'dev-sandbox-pac3-ch1',
        title: 'PAC3 Test Chapter',
        chapterNumber: 1,
        firstChapter: true,
        sections: [
          {
            id: 'dev-sandbox-pac3-sec1',
            title: 'PAC3 Test',
            html,
            audioFileName: path.basename(audioPath),
            audioPath,
            flags: [],
            completed: false,
            whisperTranscript: '',
            whisperWords: [],
            whisperAlignment: [],
            whisperMatchedCount: 0,
            whisperManuscriptWordCount: 0,
            whisperMatchQuality: 0,
          },
        ],
      },
    ],
  };

  const books = readBooks().filter(book => book?.id !== SANDBOX_BOOK_ID);
  writeBooks([sandboxBook, ...books]);

  console.log('PAC3 sandbox seeded successfully.');
  console.log(`DOCX:  ${docxPath}`);
  console.log(`Audio: ${audioPath}`);
  console.log(`Data:  ${BOOKS_PATH}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});