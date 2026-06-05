// CSV flag importer — position-based.
// Column names are ignored entirely. A row is a data row when it has
// a non-empty chapter in slot 0 AND a clock-style timestamp in slot 3.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFlagCsv,
  parseTimestampToSeconds,
  parseCsvLine,
} from '../app/lib/csvFlagImport.js';

const APP_EXPORT_CSV = [
  '"Chapter","Audio File","Page","Timestamp","Narrator/Engineer","Type","Misread Quote","Should Say"',
  '"Crescent-Chapter One","02_ANCY_Chapter.wav","7","01:37","Mark (Phantom)","Misread","Karma didn\'t have a hope","find SB found"',
  '"Crescent-Chapter Two","03_KARM_Chapter.wav","18","04:09","Mark (Phantom)","Misread","Some manuscript line","we didn\'t know SB"',
].join('\n');

const ENGINEER_TEMPLATE_CSV = [
  ',,,,,MANUSCRIPT LINK (Please use page number from bottom right of this manuscript page),,,',
  'Project:,,,,,Anarchy,,,',
  'Author:,,,,,Olivia Lewin and Marie Mackay,,,',
  ',,,,,,,,',
  'Chapter,File name,Page,Timestamp,Narrator/Engineer,Type,Note,Should Say:',
  ',,,,,,,,',
  'Chapter 2,02_ANCY_Chapter.wav,7,01:37,Mark (Phantom),Misread,,find SB found',
  'Chapter 2,02_ANCY_Chapter.wav,7,02:59,Reuben (Engineer),Unclear,the word \'instability\' drops off at the end,Karma didn\'t have a hope',
  'Chapter 4,04_ANCY_Chapter.wav,#,,Mark (Phantom),Misread,,No timestamp here',
  '18,DONE,#,,,,,,',
  '19,DONE,,,,,,,',
  'Chapter 6,06_ANCY_Chapter.wav,37,04:08,Reuben (Engineer),Edit,a description,a manuscript line',
].join('\n');

// Marie's "even if a column were named grgefkjuhfndjkhnf" test.
const GARBAGE_HEADERS_CSV = [
  'grgefkjuhfndjkhnf,xyzpdq,nan,blah,foo,bar,baz,qux',
  'Chapter 2,02_ANCY_Chapter.wav,7,01:37,Mark,Misread,observation,quote text',
].join('\n');

test('parseCsvLine handles quoted cells with embedded commas + escaped quotes', () => {
  const cells = parseCsvLine('"a,b","c""d","e"');
  assert.deepEqual(cells, ['a,b', 'c"d', 'e']);
});

test('parseTimestampToSeconds — MM:SS', () => {
  assert.equal(parseTimestampToSeconds('01:37'), 97);
  assert.equal(parseTimestampToSeconds('8:24'), 504);
});

test('parseTimestampToSeconds — H:MM:SS', () => {
  assert.equal(parseTimestampToSeconds('1:02:30'), 3750);
});

test('parseTimestampToSeconds — empty / junk → 0', () => {
  assert.equal(parseTimestampToSeconds(''), 0);
  assert.equal(parseTimestampToSeconds('abc'), 0);
  assert.equal(parseTimestampToSeconds('DONE'), 0);
  assert.equal(parseTimestampToSeconds('#'), 0);
});

test('parseFlagCsv reads the app export format positionally', () => {
  const { rows } = parseFlagCsv(APP_EXPORT_CSV);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].chapterTitle, 'Crescent-Chapter One');
  assert.equal(rows[0].ts, 97);
  assert.equal(rows[0].page, '7');
  assert.equal(rows[0].colSeven, 'Karma didn\'t have a hope');
  assert.equal(rows[0].colEight, 'find SB found');
});

test('parseFlagCsv reads engineer-template format positionally + skips junk', () => {
  const { rows, skippedNoTimestamp } = parseFlagCsv(ENGINEER_TEMPLATE_CSV);
  assert.equal(rows.length, 3, '3 valid data rows (the timestamped ones)');
  // Header row "Chapter, File name, ..." has no timestamp → not counted as skip
  // Row "Chapter 4 / no timestamp" → counted as skip
  // Rows "18 DONE" + "19 DONE" → counted as skip (start with a digit)
  assert.ok(skippedNoTimestamp >= 1, 'at least the Chapter 4 row is reported as skipped');
});

test('parseFlagCsv ignores header names entirely — gibberish headers still work', () => {
  const { rows } = parseFlagCsv(GARBAGE_HEADERS_CSV);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].chapterTitle, 'Chapter 2');
  assert.equal(rows[0].ts, 97);
  assert.equal(rows[0].colSeven, 'observation');
  assert.equal(rows[0].colEight, 'quote text');
});

test('parseFlagCsv merges multi-line quoted cells into a single row', () => {
  const csv = [
    'Chapter,Audio,Page,Timestamp,Narrator,Type,Seven,Eight',
    '"Chapter 29","29.wav","209","01:19","Mark","Misread","a cocky smirk curling *on* his lips. SB',
    ' a cocky smirk curling his lips.","also Eight"',
    'Chapter 30,30.wav,213,02:15,Mark,Pronunciation,col7,col8',
  ].join('\n');
  const { rows } = parseFlagCsv(csv);
  assert.equal(rows.length, 2, 'two rows after the embedded newline is merged');
  assert.ok(rows[0].colSeven.includes('curling his lips.'), 'multi-line cell joined');
});

test('parseFlagCsv skips rows that look like data candidates but have no timestamp', () => {
  const csv = [
    'Chapter,File name,Page,Timestamp,Nar,Type,Seven,Eight',
    'Chapter 1,1.wav,1,00:30,N,T,a,b',
    'Chapter 2,2.wav,#,,N,T,a,b',
    '18,DONE,#,,,,,,',
  ].join('\n');
  const { rows, skippedNoTimestamp } = parseFlagCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(skippedNoTimestamp, 2);
});

test('parseFlagCsv ignores Project/Author/MANUSCRIPT-LINK type pre-rows by chapter mismatch', () => {
  const { rows } = parseFlagCsv(ENGINEER_TEMPLATE_CSV);
  const titles = rows.map((r) => r.chapterTitle);
  assert.ok(!titles.some((t) => /project|author|manuscript link/i.test(t)));
});
