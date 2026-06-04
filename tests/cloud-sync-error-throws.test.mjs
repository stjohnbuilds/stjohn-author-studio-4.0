// Regression tests for Block 1 (SAS-AUD-20260602-010 / -012).
// Cloud reads/writes must throw — with a specific error message —
// when any required secondary Supabase call fails. Previously the
// app silently rebuilt projects with empty arrays and stamped the
// Quill push success hash even on partial failure.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pullProofProjects,
} from '../packages/cloud-sync/proof-sync.js';
import {
  pullQuillProjects,
  pushQuillProject,
  clearQuillPushCache,
} from '../packages/cloud-sync/quill-sync.js';

// Minimal chainable Supabase mock. Per-table behaviour comes from
// `behaviour[tableName]`:
//   { data: <rows> }          → resolves with those rows, error: null
//   { error: { message } }    → resolves with the error
//   { upsertError: { ... } }  → only the upsert() rejects
function makeSupabase(behaviour) {
  return {
    from(table) {
      const b = behaviour[table] || {};
      const builder = {
        select() { return builder; },
        order() {
          if (b.error) return Promise.resolve({ data: null, error: b.error });
          return Promise.resolve({ data: b.data || [], error: null });
        },
        in() {
          if (b.error) return Promise.resolve({ data: null, error: b.error });
          return Promise.resolve({ data: b.data || [], error: null });
        },
        eq() { return builder; },
        not() {
          if (b.error) return Promise.resolve({ data: null, error: b.error });
          return Promise.resolve({ data: b.data || [], error: null });
        },
        delete() { return builder; },
        upsert() {
          if (b.upsertError) return Promise.resolve({ data: null, error: b.upsertError });
          return builder; // stay chainable: push uses .upsert(...).select('id').single()
        },
        single() {
          if (b.singleError) return Promise.resolve({ data: null, error: b.singleError });
          return Promise.resolve({ data: b.singleData || { id: 'cloudPid' }, error: null });
        },
      };
      return builder;
    },
  };
}

test('Proof pull throws when the transcriptions query fails', async () => {
  const sb = makeSupabase({
    script_sync_projects: { data: [{ id: 'p1', title: 'X', desktop_book: null, updated_at: '' }] },
    script_sync_section_transcriptions: { error: { message: 'simulated outage' } },
    script_sync_flags: { data: [] },
  });
  await assert.rejects(() => pullProofProjects(sb), /transcriptions/);
});

test('Proof pull throws when the flags query fails', async () => {
  const sb = makeSupabase({
    script_sync_projects: { data: [{ id: 'p1', title: 'X', desktop_book: null, updated_at: '' }] },
    script_sync_section_transcriptions: { data: [] },
    script_sync_flags: { error: { message: 'simulated outage' } },
  });
  await assert.rejects(() => pullProofProjects(sb), /flags/);
});

test('Proof pull happy path returns projects with empty secondaries', async () => {
  const sb = makeSupabase({
    script_sync_projects: { data: [{ id: 'p1', title: 'X', desktop_book: null, updated_at: '' }] },
    script_sync_section_transcriptions: { data: [] },
    script_sync_flags: { data: [] },
  });
  const result = await pullProofProjects(sb);
  assert.equal(result.length, 1);
  assert.equal(result[0].cloudId, 'p1');
});

test('Quill pull throws when the chapters query fails', async () => {
  const sb = makeSupabase({
    quill_projects: { data: [{ id: 'p1', title: 'Q', desktop_project: null, annotation_options: [], phone_settings: {}, updated_at: '' }] },
    quill_chapters: { error: { message: 'simulated outage' } },
    quill_annotations: { data: [] },
  });
  await assert.rejects(() => pullQuillProjects(sb), /Quill chapters/);
});

test('Quill pull throws when the annotations query fails', async () => {
  const sb = makeSupabase({
    quill_projects: { data: [{ id: 'p1', title: 'Q', desktop_project: null, annotation_options: [], phone_settings: {}, updated_at: '' }] },
    quill_chapters: { data: [] },
    quill_annotations: { error: { message: 'simulated outage' } },
  });
  await assert.rejects(() => pullQuillProjects(sb), /Quill annotations/);
});

test('Quill push throws on chapter-id lookup failure AND does not stamp success hash', async () => {
  clearQuillPushCache();
  // First push: chapter-id lookup fails → throw.
  const failingSb = makeSupabase({
    quill_projects: { singleData: { id: 'cloudPid' } },
    quill_chapters: { error: { message: 'simulated lookup outage' } },
    quill_annotations: { data: [] },
  });
  const project = { id: 'localId', cloudId: null, title: 'Q', chapters: [{ id: 'c1', title: 'C', textHtml: '', plainText: '' }], annotations: [] };
  await assert.rejects(() => pushQuillProject(failingSb, project, 'owner'), /Quill/);

  // Second push (clean cloud): must actually run, not skip via cached hash.
  const cleanSb = makeSupabase({
    quill_projects: { singleData: { id: 'cloudPid' } },
    quill_chapters: { data: [{ id: 'uuid-c1', local_id: 'c1' }] },
    quill_annotations: { data: [] },
  });
  project.cloudId = 'cloudPid';
  const result = await pushQuillProject(cleanSb, project, 'owner');
  assert.equal(result, 'cloudPid');
});
