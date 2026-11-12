// Prep dialogue assignment merger for Block 5. When Fix is clicked
// on a warning, Prep
// reruns dialogue detection. We need to carry character / side-voice
// assignments from the old span list onto the new span list — but
// keying by text alone collapsed every duplicate onto the first
// occurrence's assignment.
//
// Bucket old spans by text in their original order, then for each
// new span pop the next unused old span of the same text. First→
// first, second→second, third→third. Extra new spans get no prior
// assignment (null); extra old spans are dropped. (Sandbox-verified
// with 9 scenarios during fix, then folded into the test suite.)

export function mergeDialogueAssignmentsByOccurrence(oldSpans, newSpans) {
  const oldByText = new Map();
  (oldSpans || []).forEach((sp) => {
    if (!oldByText.has(sp.text)) oldByText.set(sp.text, []);
    oldByText.get(sp.text).push(sp);
  });
  return (newSpans || []).map((sp) => {
    const bucket = oldByText.get(sp.text);
    const prior = bucket && bucket.length ? bucket.shift() : null;
    return prior
      ? { ...sp, characterId: prior.characterId || null, sideVoiceId: prior.sideVoiceId || null }
      : sp;
  });
}

// For "Replace manuscript": which old chapter's assigned lines belong to each
// new chapter. Returns Map(new chapter id -> old chapter's dialogue lines).
export function pairPriorChapterSpans(oldChapters = [], newChapters = []) {
  const titleKey = (ch) => String(ch?.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const spansOf = (ch) => (ch?.sections || []).flatMap((sec) => sec.dialogueSpans || []);
  const pairs = new Map();
  const used = new Set();
  newChapters.forEach((ch) => {
    const key = titleKey(ch);
    if (!key) return;
    const match = oldChapters.find((old) => !used.has(old) && titleKey(old) === key);
    if (!match) return;
    used.add(match);
    pairs.set(ch.id, spansOf(match));
  });
  if (oldChapters.length === newChapters.length) {
    newChapters.forEach((ch, i) => {
      if (pairs.has(ch.id) || used.has(oldChapters[i])) return;
      used.add(oldChapters[i]);
      pairs.set(ch.id, spansOf(oldChapters[i]));
    });
  }
  return pairs;
}
