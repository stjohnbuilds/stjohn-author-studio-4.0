// Quill cloud sync — desktop ↔ Supabase ↔ phone.
//
// Tables: quill_projects, quill_chapters, quill_annotations.
// Schema lives in the 2.0 archive's supabase migration.
//
// Desktop is the source of truth. Phone reads chapters + writes
// annotations. To keep things simple, we full-replace chapters and
// annotations on every desktop save (delete missing, upsert present).
// That makes "I removed a chapter" or "I deleted an annotation" actually
// propagate to Supabase instead of just lingering.
//
// Audio guard: stripAudioPaths runs on every project blob before it
// goes up. Only the bare file *name* may travel (for phone-side
// matching). No paths, no blobs, no base64.

import { stripAudioPaths } from './audio-guard.js';

export async function pushQuillProject(supabase, project, ownerId) {
  if (!supabase) throw new Error('Supabase client missing.');
  if (!ownerId) throw new Error('Sign in first.');
  if (!project?.id) throw new Error('Project id missing.');

  const clean = stripAudioPaths(project);

  // 1) Upsert the project row.
  const { data: projectRow, error: projectErr } = await supabase
    .from('quill_projects')
    .upsert({
      id: clean.cloudId || undefined,
      owner_id: ownerId,
      title: clean.title || 'Untitled',
      ready: true,
      desktop_project: clean,
      project_hash: hashString(JSON.stringify(clean)),
      annotation_options: clean.annotationOptions || [],
      phone_settings: clean.phoneSettings || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select('id')
    .single();
  if (projectErr) throw projectErr;
  const cloudProjectId = projectRow.id;

  // 2) Upsert chapters (replace strategy).
  const chapterRows = (clean.chapters || []).map((ch, idx) => ({
    project_id: cloudProjectId,
    owner_id: ownerId,
    local_id: ch.id,
    title: ch.title || `Chapter ${idx + 1}`,
    position: idx,
    plain_text: ch.plainText || '',
    text_html: ch.textHtml || '',
    word_count: (ch.plainText || '').split(/\s+/).filter(Boolean).length,
    alignment: ch.alignment || [],
    audio_file_name: ch.audioFileName || '',
    content_hash: hashString(ch.textHtml || ''),
    updated_at: new Date().toISOString(),
  }));
  if (chapterRows.length) {
    const { error } = await supabase
      .from('quill_chapters')
      .upsert(chapterRows, { onConflict: 'project_id,local_id' });
    if (error) throw error;
  }
  // Drop chapters that were removed locally.
  const keepLocalIds = chapterRows.map((c) => c.local_id);
  if (keepLocalIds.length) {
    await supabase
      .from('quill_chapters')
      .delete()
      .eq('project_id', cloudProjectId)
      .not('local_id', 'in', `(${keepLocalIds.map((id) => `"${id}"`).join(',')})`);
  } else {
    await supabase.from('quill_chapters').delete().eq('project_id', cloudProjectId);
  }

  // 3) Get the chapter id map (local_id -> uuid) for annotation FK.
  const { data: chapterIdRows } = await supabase
    .from('quill_chapters')
    .select('id, local_id')
    .eq('project_id', cloudProjectId);
  const chapterIdByLocal = new Map((chapterIdRows || []).map((r) => [r.local_id, r.id]));

  // 4) Upsert annotations.
  const annotationRows = (clean.annotations || []).map((a) => ({
    project_id: cloudProjectId,
    owner_id: ownerId,
    chapter_id: chapterIdByLocal.get(a.sectionId) || null,
    local_id: a.id,
    class_id: a.classId || '',
    class_label: a.classLabel || '',
    option_id: a.optionId || '',
    option_label: a.optionLabel || '',
    label: a.label || '',
    color: a.color || '#c66f8d',
    word_start: Number(a.wordStart || 0),
    word_end: Number(a.wordEnd ?? a.wordStart ?? 0),
    selected_text: a.selectedText || '',
    timestamp: Number.isFinite(a.timestamp) ? a.timestamp : null,
    note: a.note || '',
    content_hash: hashString(JSON.stringify({ s: a.selectedText, w: a.wordStart, c: a.classId, o: a.optionId, n: a.note })),
    updated_at: new Date().toISOString(),
  }));
  if (annotationRows.length) {
    const { error } = await supabase
      .from('quill_annotations')
      .upsert(annotationRows, { onConflict: 'project_id,local_id' });
    if (error) throw error;
  }
  const keepAnnIds = annotationRows.map((a) => a.local_id);
  if (keepAnnIds.length) {
    await supabase
      .from('quill_annotations')
      .delete()
      .eq('project_id', cloudProjectId)
      .not('local_id', 'in', `(${keepAnnIds.map((id) => `"${id}"`).join(',')})`);
  } else {
    await supabase.from('quill_annotations').delete().eq('project_id', cloudProjectId);
  }

  return cloudProjectId;
}

export async function pullQuillProjects(supabase) {
  if (!supabase) return [];

  const { data: projects, error } = await supabase
    .from('quill_projects')
    .select('id, title, ready, desktop_project, annotation_options, phone_settings, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  if (!projects?.length) return [];

  const projectIds = projects.map((p) => p.id);
  const { data: chapters } = await supabase
    .from('quill_chapters')
    .select('id, project_id, local_id, title, position, plain_text, text_html, audio_file_name')
    .in('project_id', projectIds);
  const { data: annotations } = await supabase
    .from('quill_annotations')
    .select('*')
    .in('project_id', projectIds);

  const chaptersByProject = new Map();
  for (const ch of chapters || []) {
    const list = chaptersByProject.get(ch.project_id) || [];
    list.push(ch);
    chaptersByProject.set(ch.project_id, list);
  }
  const annotationsByProject = new Map();
  for (const ann of annotations || []) {
    const list = annotationsByProject.get(ann.project_id) || [];
    list.push(ann);
    annotationsByProject.set(ann.project_id, list);
  }

  return projects.map((p) => {
    const projectChapters = (chaptersByProject.get(p.id) || [])
      .sort((a, b) => a.position - b.position)
      .map((ch) => ({
        id: ch.local_id,
        cloudId: ch.id,
        chapterNumber: ch.position + 1,
        title: ch.title,
        plainText: ch.plain_text,
        textHtml: ch.text_html,
        audioFileName: ch.audio_file_name || '',
      }));
    // Map cloud chapter UUID back to local id for annotations.
    const localIdByCloud = new Map(projectChapters.map((c) => [c.cloudId, c.id]));
    const projectAnnotations = (annotationsByProject.get(p.id) || []).map((ann) => ({
      id: ann.local_id,
      classId: ann.class_id,
      classLabel: ann.class_label,
      optionId: ann.option_id,
      optionLabel: ann.option_label,
      label: ann.label,
      color: ann.color,
      sectionId: localIdByCloud.get(ann.chapter_id) || '',
      chapterNumber: null,
      wordStart: ann.word_start,
      wordEnd: ann.word_end,
      selectedText: ann.selected_text,
      timestamp: ann.timestamp,
      note: ann.note,
      createdAt: ann.created_at,
      updatedAt: ann.updated_at,
    }));

    // Prefer the desktop_project blob (it's the full local state), but
    // fall back to the row-level fields if the blob is empty.
    const desktop = (p.desktop_project && typeof p.desktop_project === 'object') ? p.desktop_project : null;
    return {
      id: desktop?.id || p.id,
      cloudId: p.id,
      title: p.title || desktop?.title || 'Untitled',
      fileName: desktop?.fileName || '',
      importedAt: desktop?.importedAt || p.updated_at,
      updatedAt: p.updated_at,
      chapters: projectChapters.length ? projectChapters : (desktop?.chapters || []),
      annotations: projectAnnotations.length ? projectAnnotations : (desktop?.annotations || []),
      annotationOptions: p.annotation_options || desktop?.annotationOptions || [],
      phoneSettings: p.phone_settings || {},
    };
  });
}

export async function deleteQuillProject(supabase, cloudProjectId) {
  if (!supabase || !cloudProjectId) return;
  // Chapters + annotations cascade via FK on delete.
  await supabase.from('quill_projects').delete().eq('id', cloudProjectId);
}

// Tiny stable hash for content_hash / project_hash columns. Not
// cryptographic — just enough to short-circuit no-op writes if we want
// to add that optimization later.
function hashString(input) {
  const str = String(input || '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
