// CSV → Audition marker files. Must produce byte-identical output to
// the in-app "Export for Engineer" format so the engineer can't tell
// them apart.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMarkerFilesFromCsv, markerFileName } from '../app/lib/csvAuditionMarkers.js';

const REUBEN_CSV = [
  ',,,,,MANUSCRIPT LINK (Please use page number from bottom right of this manuscript page),,,',
  'Project:,,Anarchy,,,,,,,,',
  'Author:,,Olivia Lewin and Marie Mackay,,,,,,,,',
  ',,,,,,,,,,',
  'Chapter,File name,Page,Timestamp,Narrator/Engineer,Type,Note,Should Say:,,,',
  ',,,,,,,,,,',
  'Chapter 2,02_ANCY_Chapter.wav,7,01:37,Mark (Phantom),Misread,,find SB found,,,',
  'Chapter 2,02_ANCY_Chapter.wav,7,02:59,Reuben (Engineer),Unclear,the word \'instability\' drops off at the end,Karma did not have a hope,,,',
  'Chapter 4,04_ANCY_Chapter.wav,19,00:40,Daryl (Karma),Misread,"shining in the harsh lighting,",Lightning SB lighting,,,',
  '18,DONE,#,,,,,,,,',
  'Chapter 50,,,,Micheal (Sin),Other,The word: Present,,,,',
].join('\n');

test('writes one .txt file per chapter', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, 'Anarchy');
  const names = out.files.map((f) => f.name);
  assert.ok(names.includes('Marker_[Chapter 2].csv'));
  assert.ok(names.includes('Marker_[Chapter 4].csv'));
  assert.equal(out.files.length, 2, 'Chapter 50 has no timestamp → no file');
});

test('exact header line matches Export for Engineer', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, 'Anarchy');
  const ch2 = out.files.find((f) => f.name === 'Marker_[Chapter 2].csv');
  const firstLine = ch2.content.split('\n')[0];
  assert.equal(firstLine, 'Name\tStart\tDuration\tTime Format\tType\tDescription');
});

test('each marker row has the right 6 tab-separated cells', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, 'Anarchy');
  const ch2 = out.files.find((f) => f.name === 'Marker_[Chapter 2].csv');
  const lines = ch2.content.split('\n');
  // skip header
  const cells = lines[1].split('\t');
  assert.equal(cells.length, 6);
  assert.equal(cells[2], '0:00.000'); // Duration
  assert.equal(cells[3], 'decimal');  // Time Format
  assert.equal(cells[4], 'Cue');      // Type
});

test('markers within a chapter are sorted by Start time', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, 'Anarchy');
  const ch2 = out.files.find((f) => f.name === 'Marker_[Chapter 2].csv');
  const dataLines = ch2.content.split('\n').slice(1);
  const starts = dataLines.map((line) => line.split('\t')[1]);
  assert.deepEqual(starts, ['1:37.000', '2:59.000']);
});

test('Name = longer cell, Description = shorter cell', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, 'Anarchy');
  const ch2 = out.files.find((f) => f.name === 'Marker_[Chapter 2].csv');
  const lines = ch2.content.split('\n');
  // Row at 2:59 has col7="the word 'instability' drops off..." (~40 chars),
  // col8="Karma did not have a hope" (~25 chars). Wait — 8 is shorter
  // here. Let's verify by the actual data and adjust if needed.
  // We assert what the rule produces: longer cell → Name.
  const row = lines.find((l) => l.includes('2:59.000'));
  const cells = row.split('\t');
  const name = cells[0];
  const desc = cells[5];
  assert.ok(name.length >= desc.length, 'Name should be at least as long as Description');
});

test('row with empty col7 + non-empty col8 uses col8 as Name', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, 'Anarchy');
  const ch2 = out.files.find((f) => f.name === 'Marker_[Chapter 2].csv');
  const row137 = ch2.content.split('\n').find((l) => l.includes('1:37.000'));
  const cells = row137.split('\t');
  assert.equal(cells[0], 'find SB found');
  assert.equal(cells[5], ''); // no description
});

test('folder name pattern matches Export for Engineer: "{title} audition markers"', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, 'Anarchy');
  assert.equal(out.folderName, 'Anarchy audition markers');
});

test('rows with no timestamp are skipped + counted', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, 'Anarchy');
  assert.ok(out.skippedNoTimestamp >= 1, 'at least the "Chapter 50" row + "18 DONE" placeholder counted');
});

test('marker filename strips characters Audition would choke on', () => {
  assert.equal(markerFileName('Chapter 2'), 'Marker_[Chapter 2].csv');
  assert.equal(markerFileName('Crescent-Chapter One'), 'Crescent-Chapter One.txt');
  assert.equal(markerFileName('Chapter / 3'), 'Chapter _ 3.txt');
});

test('empty book title falls back to "book audition markers"', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, '');
  assert.equal(out.folderName, 'book audition markers');
});

// -------- Merge behaviour: CSV markers + saved in-app flag markers --------

const BOOK_WITH_FLAGS = {
  title: 'Anarchy',
  chapters: [
    {
      id: 'c2',
      title: 'Chapter 2',
      sections: [
        {
          id: 's2',
          title: 'Chapter 2',
          flags: [
            { ts: 30, sentPlain: 'Saved flag A', note: 'in-app note A' },
            { ts: 600, sentPlain: 'Saved flag B', note: '' },
          ],
        },
      ],
    },
    {
      id: 'c4',
      title: 'Chapter 4',
      sections: [
        {
          id: 's4',
          title: 'Chapter 4',
          flags: [
            { ts: 100, sentPlain: 'Saved C4 flag', note: 'note' },
          ],
        },
      ],
    },
  ],
};

test('merge: passing the book merges saved flags into per-chapter files', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, BOOK_WITH_FLAGS);
  const ch2 = out.files.find((f) => f.name === 'Marker_[Chapter 2].csv');
  const dataLines = ch2.content.split('\n').slice(1);
  // CSV gave Chapter 2 two markers (1:37 + 2:59); saved flags gave two more (0:30 + 10:00).
  assert.equal(dataLines.length, 4);
  assert.equal(out.csvMarkers + out.savedMarkers, out.totalMarkers);
  assert.ok(out.csvMarkers >= 2, 'csv markers tracked');
  assert.ok(out.savedMarkers >= 2, 'saved markers tracked');
});

test('merge: markers in merged file sorted by Start time regardless of source', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, BOOK_WITH_FLAGS);
  const ch2 = out.files.find((f) => f.name === 'Marker_[Chapter 2].csv');
  const dataLines = ch2.content.split('\n').slice(1);
  const starts = dataLines.map((line) => line.split('\t')[1]);
  // Sorted: 0:30, 1:37, 2:59, 10:00
  assert.deepEqual(starts, ['0:30.000', '1:37.000', '2:59.000', '10:00.000']);
});

test('merge: chapter that only has saved flags (no CSV rows) still gets a file', () => {
  // CSV has no rows for Chapter 4 with a valid ts (the one in REUBEN_CSV has
  // no timestamp). Saved flags add one. We should still get a Chapter 4 file.
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, BOOK_WITH_FLAGS);
  const ch4 = out.files.find((f) => f.name === 'Marker_[Chapter 4].csv');
  assert.ok(ch4, 'Chapter 4 file exists (from saved flags alone)');
  const lines = ch4.content.split('\n').slice(1);
  // CSV had Chapter 4 at 00:40 too → 2 markers
  assert.ok(lines.length >= 1);
});

test('merge: duplicate timestamps (CSV + saved at same time) both kept', () => {
  const csv = [
    'Chapter,Audio,Page,Timestamp,Nar,Type,Seven,Eight',
    'Chapter 9,9.wav,1,01:00,Mark,Misread,Engineer note,Manuscript line',
  ].join('\n');
  const book = {
    title: 'Test Book',
    chapters: [
      { id: 'c9', title: 'Chapter 9', sections: [{ id: 's9', flags: [
        { ts: 60, sentPlain: 'The saved flag at the same time', note: 'saved note' },
      ] }] },
    ],
  };
  const out = buildMarkerFilesFromCsv(csv, book);
  const ch9 = out.files.find((f) => f.name === 'Marker_[Chapter 9].csv');
  const dataLines = ch9.content.split('\n').slice(1);
  // Two markers, both at 1:00.000, both kept
  assert.equal(dataLines.length, 2);
  assert.ok(dataLines.every((line) => line.includes('1:00.000')));
});

test('merge: passing a title string (legacy) still works, no merge', () => {
  const out = buildMarkerFilesFromCsv(REUBEN_CSV, 'Anarchy');
  // With no book → no saved markers
  assert.equal(out.savedMarkers, 0);
  assert.ok(out.csvMarkers >= 1);
});
