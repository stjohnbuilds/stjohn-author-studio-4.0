// Prep dialogue assignment merger for Block 5 (audit fix
// SAS-AUD-20260602-005). When Marie clicks Fix on a warning, Prep
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
