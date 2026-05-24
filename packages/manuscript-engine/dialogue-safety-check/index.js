import { detectDialogueSpansInHtml } from '../dialogue-detection/index.js';

function cleanString(value = '', fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function issueBlocksAssignment(issue = {}) {
  return issue.blocking !== false && issue.severity !== 'info';
}

function issueId(sectionId, index) {
  return `${sectionId || 'section'}-dialogue-issue-${index + 1}`;
}

function spanId(sectionId, index) {
  return `${sectionId || 'section'}-dialogue-${index + 1}`;
}

export function analyzeDialogueSafetyForSection(section = {}, options = {}) {
  const html = section.html || section.textHtml || section.plainText || '';
  const result = detectDialogueSpansInHtml(html, options);
  const sectionWordStart = Number(section.wordStart || 0);
  const sectionId = cleanString(section.id, 'section');
  const chapterId = cleanString(section.chapterId, `chapter-${Number(section.chapterIndex || 0) + 1}`);
  const chapterTitle = cleanString(section.chapterTitle);
  const sectionTitle = cleanString(section.title);

  const dialogueSpans = result.dialogueSpans.map((span, index) => ({
    id: spanId(sectionId, index),
    chapterId,
    sectionId,
    chapterTitle,
    sectionTitle,
    wordStartIndex: sectionWordStart + span.wordStartIndex,
    wordEndIndex: sectionWordStart + span.wordEndIndex,
    sectionWordStartIndex: span.wordStartIndex,
    sectionWordEndIndex: span.wordEndIndex,
    text: span.text,
    afterText: cleanString(span.afterText),
    speakerHint: cleanString(span.speakerHint),
    startsWithFirstPerson: Boolean(span.startsWithFirstPerson),
    assignmentId: '',
    safetyIssueIds: []
  }));

  const issues = result.issues.map((issue, index) => ({
    id: issueId(sectionId, index),
    type: issue.type,
    status: 'open',
    chapterId,
    sectionId,
    dialogueSpanId: '',
    wordStartIndex: sectionWordStart + Number(issue.wordStartIndex || 0),
    wordEndIndex: sectionWordStart + Number(issue.wordEndIndex || issue.wordStartIndex || 0),
    sectionWordStartIndex: Number(issue.wordStartIndex || 0),
    sectionWordEndIndex: Number(issue.wordEndIndex || issue.wordStartIndex || 0),
    severity: cleanString(issue.severity, 'warning'),
    blocking: issueBlocksAssignment(issue),
    message: cleanString(issue.message, 'Review dialogue marks.')
  }));

  return {
    sectionId,
    chapterId,
    totalQuoteMarks: result.totalQuoteMarks,
    quoteMarksEven: result.quoteMarksEven,
    dialogueSpans,
    issues
  };
}

export function buildDialogueSafetyReport(sections = [], options = {}) {
  const sectionReports = sections.map((section) => analyzeDialogueSafetyForSection(section, options));
  const totalQuoteMarks = sectionReports.reduce((total, report) => total + report.totalQuoteMarks, 0);
  const dialogueSpans = sectionReports.flatMap((report) => report.dialogueSpans);
  const issues = sectionReports.flatMap((report) => report.issues);
  const openBlockingIssueCount = issues.filter((issue) => issue.status === 'open' && issue.blocking !== false).length;

  return {
    checked: true,
    checkedAt: options.checkedAt || new Date().toISOString(),
    totalQuoteMarks,
    quoteMarksEven: totalQuoteMarks % 2 === 0,
    totalDialogueCount: dialogueSpans.length,
    dialogueSpans,
    issues,
    openBlockingIssueCount,
    canStartAssignment: openBlockingIssueCount === 0
  };
}
