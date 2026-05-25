// Proof Listen cloud sync — desktop ↔ Supabase ↔ phone.
//
// Tables: script_sync_projects, script_sync_section_transcriptions,
// script_sync_flags. Schema lives in the 2.0 Supabase project
// (evcusovtjfypfyfvnooy). Mirrors quill-sync.js shape so every mode
// reads the same.
//
// Strategy: desktop is the source of truth. Each push upserts the
// project row (full book JSON in `desktop_book`), then replaces
// transcriptions and flags for that project (delete-then-insert) so
// "I removed a flag" or "I re-transcribed" actually propagate.
//
// Audio guard: stripAudioPaths runs on every book before it goes up.
// Audio file *names* travel for phone-side matching. Audio paths,
// blobs, base64, or buffers never reach Supabase.

import { stripAudioPaths } from './audio-guard.js';

export async function pushProofProject(supabase, book, ownerId) {
  if (!supabase) throw new Error('Supabase client missing.');
  if (!ownerId) throw new Error('Sign in first.');
  if (!book?.id) throw new Error('Book id missing.');

  const clean = stripAudioPaths(book);
  const sectionRefs = collectSections(clean);

  // 1) Upsert the project row.
  const { data: projectRow, error: projectErr } = await supabase
    .from('script_sync_projects')
    .upsert({
      id: clean.cloudId || undefined,
      owner_id: ownerId,
      title: clean.title || 'Untitled audiobook',
      ready: true,
      desktop_book: clean,
      desktop_book_hash: hashString(JSON.stringify(clean)),
      section_count: sectionRefs.length,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('id')
    .single();
  if (projectErr) throw projectErr;
  const cloudProjectId = projectRow.id;

  // 2) Replace transcriptions for this project.
  const { error: tDelErr } = await supabase
    .from('script_sync_section_transcriptions')
    .delete()
    .eq('project_id', cloudProjectId);
  if (tDelErr) throw tDelErr;

  const transcriptionRows = sectionRefs
    .filter(({ section }) => (
      (section.whisperWords && section.whisperWords.length) ||
      (section.whisperAlignment && section.whisperAlignment.length)
    ))
    .map(({ section, chapter, chapterIndex, sectionIndex }) => ({
      project_id: cloudProjectId,
      owner_id: ownerId,
      section_id: String(section.id || ''),
      chapter_id: String(chapter.id || ''),
      chapter_index: chapterIndex,
      section_index: sectionIndex,
      audio_file_name: section.audioFileName || '',
      transcription: {
        words: section.whisperWords || [],
        alignment: section.whisperAlignment || [],
        audioKey: section.whisperAudioKey || '',
        textHash: section.whisperTextHash || '',
      },
      transcription_hash: hashString(JSON.stringify({
        a: section.whisperAlignment || [],
        k: section.whisperAudioKey || '',
        h: section.whisperTextHash || '',
      })),
      updated_at: new Date().toISOString(),
    }));

  if (transcriptionRows.length) {
    const { error } = await supabase
      .from('script_sync_section_transcriptions')
      .insert(transcriptionRows);
    if (error) throw error;
  }

  // 3) Replace flags for this project.
  const { error: fDelErr } = await supabase
    .from('script_sync_flags')
    .delete()
    .eq('project_id', cloudProjectId);
  if (fDelErr) throw fDelErr;

  const flagRows = [];
  for (const { section } of sectionRefs) {
    (section.flags || []).forEach((fl, idx) => {
      const localId = fl.id || `${section.id || 'section'}:${fl.ts ?? idx}`;
      flagRows.push({
        project_id: cloudProjectId,
        owner_id: ownerId,
        section_id: String(section.id || ''),
        local_id: String(localId),
        flag: {
          ts: fl.ts ?? null,
          page: fl.page ?? '',
          narrator: fl.narrator ?? '',
          type: fl.type ?? '',
          sentPlain: fl.sentPlain ?? '',
          note: fl.note ?? '',
          ...fl,
        },
        flag_hash: hashString(JSON.stringify(fl)),
        updated_at: new Date().toISOString(),
      });
    });
  }

  if (flagRows.length) {
    const { error } = await supabase
      .from('script_sync_flags')
      .insert(flagRows);
    if (error) throw error;
  }

  return cloudProjectId;
}

export async function pullProofProjects(supabase) {
  if (!supabase) return [];

  const { data: projects, error } = await supabase
    .from('script_sync_projects')
    .select('id, title, ready, desktop_book, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  if (!projects?.length) return [];

  const projectIds = projects.map((p) => p.id);
  const { data: transcriptions } = await supabase
    .from('script_sync_section_transcriptions')
    .select('project_id, section_id, transcription, audio_file_name')
    .in('project_id', projectIds);
  const { data: flags } = await supabase
    .from('script_sync_flags')
    .select('project_id, section_id, local_id, flag')
    .in('project_id', projectIds);

  const transByProjectSection = new Map();
  for (const t of transcriptions || []) {
    const key = `${t.project_id}::${t.section_id}`;
    transByProjectSection.set(key, t);
  }
  const flagsByProjectSection = new Map();
  for (const f of flags || []) {
    const key = `${f.project_id}::${f.section_id}`;
    const list = flagsByProjectSection.get(key) || [];
    list.push(f);
    flagsByProjectSection.set(key, list);
  }

  return projects.map((p) => {
    const desktop = (p.desktop_book && typeof p.desktop_book === 'object') ? p.desktop_book : null;
    const baseBook = desktop || { id: p.id, title: p.title || 'Untitled audiobook', chapters: [] };
    return {
      ...baseBook,
      id: baseBook.id || p.id,
      cloudId: p.id,
      title: baseBook.title || p.title || 'Untitled audiobook',
      updatedAt: p.updated_at,
      chapters: (baseBook.chapters || []).map((chapter) => ({
        ...chapter,
        sections: (chapter.sections || []).map((section) => {
          const key = `${p.id}::${String(section.id || '')}`;
          const trans = transByProjectSection.get(key);
          const sectionFlags = flagsByProjectSection.get(key) || [];
          const merged = { ...section };
          if (trans?.transcription) {
            merged.whisperWords = trans.transcription.words || section.whisperWords || [];
            merged.whisperAlignment = trans.transcription.alignment || section.whisperAlignment || [];
            merged.whisperAudioKey = trans.transcription.audioKey || section.whisperAudioKey || '';
            merged.whisperTextHash = trans.transcription.textHash || section.whisperTextHash || '';
          }
          if (sectionFlags.length) {
            merged.flags = sectionFlags.map((f) => ({
              ...(f.flag || {}),
              cloudLocalId: f.local_id,
            }));
          }
          return merged;
        }),
      })),
    };
  });
}

export async function deleteProofProject(supabase, cloudProjectId) {
  if (!supabase || !cloudProjectId) return;
  // Transcriptions + flags cascade via FK on delete.
  await supabase.from('script_sync_projects').delete().eq('id', cloudProjectId);
}

function collectSections(book) {
  const out = [];
  (book.chapters || []).forEach((chapter, chapterIndex) => {
    (chapter.sections || []).forEach((section, sectionIndex) => {
      out.push({ section, chapter, chapterIndex, sectionIndex });
    });
  });
  return out;
}

// Tiny stable hash for *_hash columns. Not cryptographic — just enough
// to short-circuit no-op writes if we add that optimization later.
function hashString(input) {
  const str = String(input || '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
