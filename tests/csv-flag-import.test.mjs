// CSV flag importer — Check Errors popup.
// Verifies that the parser handles BOTH the app's own export AND
// Marie's engineer-template spreadsheet (different labels for the
// same columns) and skips the project / author / link header rows.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFlagCsv,
  parseTimestampToSeconds,
  parseCsvLine,
} from '../app/lib/csvFlagImport.js';

const APP_EXPORT_CSV = [
  '"Chapter","Audio File","Page","Timestamp","Narrator/Engineer","Type","Misread Quote","Should Say"',
  '"Crescent-Chapter One","02_ANCY_Chapter.wav","7","01:37","Mark (Phantom)","Misread","find SB found","find SB found"',
  '"Crescent-Chapter One","02_ANCY_Chapter.wav","7","02:59","Reuben (Engineer)","Unclear","Karma didn\'t have","Karma didn\'t have"',
  '"Crescent-Chapter Two","03_KARM_Chapter.wav","18","04:09","Mark (Phantom)","Misread","we didn\'t know SB","we didn\'t know SB"',
].join('\n');

const ENGINEER_TEMPLATE_CSV = [
  ',,,,,MANUSCRIPT LINK (Please use page number from bottom right of this manuscript page),,,',
  'Project:,,,,,Anarchy,,,',
  'Author:,,,,,Olivia Lewin and Marie Mackay,,,',
  ',,,,,,,,',
  'Chapter,File name,Page,Timestamp,Narrator/Engineer,Type,Note,Should Say:',
  'Chapter 2,02_ANCY_Chapter.wav,7,01:37,Mark (Phantom),Misread,find SB found,find SB found',
  'Chapter 2,02_ANCY_Chapter.wav,7,02:59,Reuben (Engineer),Unclear,Karma didn\'t have,Karma did not have',
  'Chapter 2,02_ANCY_Chapter.wav,8,04:09,Mark (Phantom),Misread,we didn\'t know SB,we did not know SB',
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
});

test('parseFlagCsv reads the app export format as-is', () => {
  const { rows, headerLine, error } = parseFlagCsv(APP_EXPORT_CSV);
  assert.equal(error, undefined, 'no error');
  assert.equal(headerLine, 0, 'header is line 0 — no pre-rows to skip');
  assert.equal(rows.length, 3);
  assert.equal(rows[0].chapterTitle, 'Crescent-Chapter One');
  assert.equal(rows[0].page, '7');
  assert.equal(rows[0].ts, 97);
  assert.equal(rows[0].narrator, 'Mark (Phantom)');
  assert.equal(rows[0].type, 'Misread');
  assert.equal(rows[0].quote, 'find SB found');
  assert.equal(rows[0].should, 'find SB found');
  assert.equal(rows[0].audioFileHint, '02_ANCY_Chapter.wav');
});

test('parseFlagCsv skips engineer-template pre-header rows (Project/Author/blank)', () => {
  const { rows, headerLine, error } = parseFlagCsv(ENGINEER_TEMPLATE_CSV);
  assert.equal(error, undefined);
  assert.equal(headerLine, 4, 'header is line 4 — 4 pre-rows skipped');
  assert.equal(rows.length, 3);
});

test('parseFlagCsv understands "Note" as the quote column and "File name" as audio', () => {
  const { rows } = parseFlagCsv(ENGINEER_TEMPLATE_CSV);
  assert.equal(rows[0].quote, 'find SB found',  'Note column → quote');
  assert.equal(rows[0].audioFileHint, '02_ANCY_Chapter.wav', 'File name column → audioFileHint');
  assert.equal(rows[0].should, 'find SB found', 'Should Say: column → should');
});

test('parseFlagCsv returns error when no header row is present', () => {
  const junk = 'just some\nrandom\nlines, with, commas\n';
  const result = parseFlagCsv(junk);
  assert.ok(result.error, 'returns an error message');
  assert.equal(result.rows.length, 0);
});

test('parseFlagCsv skips blank data rows and rows with no chapter', () => {
  const csv = [
    'Chapter,Page,Timestamp',
    'Chapter 1,1,00:01',
    '',
    ',5,00:30',
    'Chapter 2,2,00:02',
  ].join('\n');
  const { rows } = parseFlagCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].chapterTitle, 'Chapter 1');
  assert.equal(rows[1].chapterTitle, 'Chapter 2');
});

test('parseFlagCsv: case-insensitive header matching', () => {
  const csv = 'CHAPTER,TIMESTAMP,PAGE\nFoo,00:30,3\n';
  const { rows } = parseFlagCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ts, 30);
  assert.equal(rows[0].page, '3');
});
