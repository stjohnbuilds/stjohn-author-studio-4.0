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
import { slimProjectForCloud } from './cloud-slim.js';

// Same hash-gate pattern as proof-sync: skip no-op pushes when nothing
// meaningful has changed since the last upload.
const lastPushHashByCloudId = new Map();

export function clearQuillPushCache() {
  lastPushHashByCloudId.clear();
}

export async function pushQuillProject(supabase, project, ownerId) {
  if (!supabase) throw new Error('Supabase client missing.');
  if (!ownerId) throw new Error('Sign in first.');
  if (!project?.id) throw new Error('Project id missing.');

  const clean = stripAudioPaths(project);
  // Strip annotations + chapter alignment from desktop_project — both
  // are stored in dedicated tables.
  const slimProject = slimProjectForCloud(clean);
  const projectHash = hashString(JSON.stringify(slimProject));
  const annotationsHash = hashString(JSON.stringify(
    (clean.annotations || []).map((a) => ({ i: a.id, c: a.classId, o: a.optionId, w: a.wordStart, e: a.wordEnd, n: a.note, t: a.timestamp }))
  ));
  const chaptersHash = hashString(JSON.stringify(
    (clean.chapters || []).map((ch, idx) => ({
      i: ch.id,
      p: idx,
      t: ch.title,
      h: hashString(ch.textHtml || ''),
      a: hashString(JSON.stringify(getChapterAlignment(ch))),
      n: ch.audioFileName || '',
    }))
  ));
  const compositeHash = `${projectHash}|${annotationsHash}|${chaptersHash}`;
  if (clean.cloudId && lastPushHashByCloudId.get(clean.cloudId) === compositeHash) {
    return clean.cloudId; // nothing changed
  }

  // 1) Upsert the project row.
  const { data: projectRow, error: projectErr } = await supabase
    .from('quill_projects')
    .upsert({
      id: clean.cloudId || undefined,
      owner_id: ownerId,
      title: clean.title || 'Untitled',
      ready: true,
      desktop_project: slimProject,
      project_hash: projectHash,
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
    alignment: getChapterAlignment(ch),
    audio_file_name: ch.audioFileName || '',
    content_hash: hashString(JSON.stringify({
      html: ch.textHtml || '',
      alignment: getChapterAlignment(ch),
      audioFileName: ch.audioFileName || '',
    })),
    updated_at: new Date().toISOString(),
  }));
  if (chapterRows.length) {
    const { error } = await supabase
      .from('quill_chapters')
      .upsert(chapterRows, { onConflict: 'project_id,local_id' });
    if (error) throw error;
  }
  // Drop chapters that were removed locally. Errors here used to be
  // ignored, so a failed prune left orphan rows AND the success hash
  // (set at the bottom) would still be stored as if the push worked.
  const keepLocalIds = chapterRows.map((c) => c.local_id);
  if (keepLocalIds.length) {
    const { error: pruneChaptersError } = await supabase
      .from('quill_chapters')
      .delete()
      .eq('project_id', cloudProjectId)
      .not('local_id', 'in', toPostgrestInList(keepLocalIds));
    if (pruneChaptersError) {
      throw new Error(`couldn't remove old Quill chapters in cloud (${pruneChaptersError.message})`);
    }
  } else {
    const { error: pruneChaptersError } = await supabase
      .from('quill_chapters')
      .delete()
      .eq('project_id', cloudProjectId);
    if (pruneChaptersError) {
      throw new Error(`couldn't remove old Quill chapters in cloud (${pruneChaptersError.message})`);
    }
  }

  // 3) Get the chapter id map (local_id -> uuid) for annotation FK. If
  // this lookup silently failed, every annotation below fell back to
  // chapter_id: null, corrupting the cloud copy.
  const { data: chapterIdRows, error: chapterLookupError } = await supabase
    .from('quill_chapters')
    .select('id, local_id')
    .eq('project_id', cloudProjectId);
  if (chapterLookupError) {
    throw new Error(`Quill save incomplete: couldn't read chapter ids (${chapterLookupError.message})`);
  }
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
    const { error: pruneAnnotationsError } = await supabase
      .from('quill_annotations')
      .delete()
      .eq('project_id', cloudProjectId)
      .not('local_id', 'in', toPostgrestInList(keepAnnIds));
    if (pruneAnnotationsError) {
      throw new Error(`Quill save incomplete: couldn't remove old annotations (${pruneAnnotationsError.message})`);
    }
  } else {
    const { error: pruneAnnotationsError } = await supabase
      .from('quill_annotations')
      .delete()
      .eq('project_id', cloudProjectId);
    if (pruneAnnotationsError) {
      throw new Error(`Quill save incomplete: couldn't remove old annotations (${pruneAnnotationsError.message})`);
    }
  }

  // Only stamp the success hash after every required write succeeded.
  // This is the skip gate for future pushes, so a partial failure here
  // must NOT remember itself as done.
  lastPushHashByCloudId.set(cloudProjectId, compositeHash);
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
  // Empty data is fine; an error is not — silently swallowing here used
  // to rebuild projects with blank chapters/annotations and look "synced."
  const { data: chapters, error: chaptersError } = await supabase
    .from('quill_chapters')
    .select('id, project_id, local_id, title, position, plain_text, text_html, alignment, audio_file_name, content_hash')
    .in('project_id', projectIds);
  if (chaptersError) {
    throw new Error(`Quill sync incomplete: couldn't read chapters (${chaptersError.message})`);
  }
  const { data: annotations, error: annotationsError } = await supabase
    .from('quill_annotations')
    .select('id, project_id, chapter_id, local_id, class_id, class_label, option_id, option_label, label, color, word_start, word_end, selected_text, timestamp, note, content_hash, created_at, updated_at')
    .in('project_id', projectIds);
  if (annotationsError) {
    throw new Error(`Quill sync incomplete: couldn't read annotations (${annotationsError.message})`);
  }

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
    // The quill_chapters table doesn't have a `completed` column, but
    // each chapter's `completed` flag IS in the desktop_project blob
    // (slimProjectForCloud preserves it). Merge it back so the chapter
    // tick syncs phone ↔ desktop without needing a schema migration.
    const desktopBlob = (p.desktop_project && typeof p.desktop_project === 'object') ? p.desktop_project : null;
    // Marie 2026-05-26 — merge BACK the per-chapter transcription
    // metadata that lives in the desktop_project blob. The dedicated
    // quill_chapters table only stores alignment + audio_file_name
    // (+ position, title, html). The other transcription metadata
    // (whisperAudioKey, whisperTextHash, transcribedAt, whisperWords,
    // whisperTranscript, whisperMatchQuality) lives in the blob.
    // Without this merge, `isChapterTranscriptionCurrent` in
    // SessionsView rejects the chapter on first render after sign-in
    // (because the keys are missing) and the ✓ Synced tick disappears.
    // Bug Marie reported: "transcription tick gone after logout/login."
    const blobChaptersById = new Map();
    const completedById = new Map();
    for (const dch of (desktopBlob?.chapters || [])) {
      if (!dch?.id) continue;
      blobChaptersById.set(dch.id, dch);
      if (typeof dch.completed === 'boolean') {
        completedById.set(dch.id, dch.completed);
      }
    }
    const projectChapters = (chaptersByProject.get(p.id) || [])
      .sort((a, b) => a.position - b.position)
      .map((ch) => {
        const alignment = Array.isArray(ch.alignment) ? ch.alignment : [];
        const blobCh = blobChaptersById.get(ch.local_id) || {};
        return {
          id: ch.local_id,
          cloudId: ch.id,
          chapterNumber: ch.position + 1,
          title: ch.title,
          plainText: ch.plain_text,
          textHtml: ch.text_html,
          alignment,
          whisperAlignment: alignment,
          audioFileName: ch.audio_file_name || '',
          contentHash: ch.content_hash || '',
          completed: completedById.has(ch.local_id) ? completedById.get(ch.local_id) : false,
          // Transcription metadata round-tripped via the blob — required
          // for the tick check on sign-in.
          whisperAudioKey: blobCh.whisperAudioKey || '',
          whisperTextHash: blobCh.whisperTextHash || '',
          transcribedAt: blobCh.transcribedAt || null,
          whisperSourceUpdatedAt: blobCh.whisperSourceUpdatedAt || null,
          whisperWords: Array.isArray(blobCh.whisperWords) ? blobCh.whisperWords : [],
          whisperTranscript: blobCh.whisperTranscript || '',
          whisperMatchedCount: typeof blobCh.whisperMatchedCount === 'number' ? blobCh.whisperMatchedCount : null,
          whisperManuscriptWordCount: typeof blobCh.whisperManuscriptWordCount === 'number' ? blobCh.whisperManuscriptWordCount : null,
          whisperMatchQuality: blobCh.whisperMatchQuality ?? null,
        };
      });
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
      contentHash: ann.content_hash || '',
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

function getChapterAlignment(chapter) {
  if (Array.isArray(chapter?.alignment)) return chapter.alignment;
  if (Array.isArray(chapter?.whisperAlignment)) return chapter.whisperAlignment;
  return [];
}

function toPostgrestInList(ids = []) {
  return `(${ids.map((id) => `"${String(id).replace(/"/g, '\\"')}"`).join(',')})`;
}
