// Decides whether a single block-level element (a heading or a plain
// paragraph) acts as a "POV character marker" — the scene boundary
// that switches subsequent narration to a different character in the
// Audiobook Breakdown and Prep Breakdown popups.
//
// Two markers in widespread use across Marie's manuscripts:
//
//   1. Heading-style marker (older Word habit) — character name sits
//      inside <h1>…<h6>, sometimes joined to a date or label:
//        <h2>Phantom — Day One</h2>
//      A fuzzy substring match is used so the joined-label form still
//      attributes to "Phantom".
//
//   2. Plain-paragraph marker (Vellum export) — character name is a
//      standalone <p> (or <div>) above the prose:
//        <p>Vex</p>
//        <p>I broke a dozen laws…</p>
//      Strict equality is used so a body paragraph that happens to
//      mention the name ("Vex looked at me") is NOT mistaken for a
//      scene break.
//
// Pure logic — no DOM access. Both Proof's tallyCharacterWordCountsDom
// (SessionsView.js) and Prep's analyzePrepChapterByCharacter
// (PrepManuscriptMode.js) call this so a heading + plain-paragraph
// blind-spot fix happens in ONE place.

export function normCharName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Returns true if the two names match by fuzzy bidirectional substring.
// Mirrors SessionsView's `nameMatches` / Prep's `_prepNameMatches` so
// joined headings like "Phantom — Day One" still resolve to "Phantom".
export function fuzzyNameMatches(a, b) {
  const na = normCharName(a);
  const nb = normCharName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// Classifies a single block element by tag + visible text.
//
//   tagName  — uppercase tag (e.g. "H2", "P", "DIV").
//   text     — element.textContent already trimmed.
//   mapping  — [{ name }, …] of mapped character names.
//
// Returns either:
//   { isHeading: true,  char: "Phantom" | null }   when tag is H1–H6
//     (always include in the marker list, even when char is null, so
//     the walker can keep its "no-character heading doesn't reset the
//     active character" behaviour).
//   { isHeading: false, char: "Vex" }              when tag is P or
//     DIV AND the entire trimmed text is EXACTLY a mapped character's
//     name (after normalisation).
//   null                                           in every other case
//     — the element is NOT a marker and should be skipped.
export function classifyCharacterMarker(tagName, text, mapping) {
  if (!text) return null;
  const tag = String(tagName || '').toUpperCase();
  const list = (mapping || []).filter((m) => (m?.name || '').trim());
  if (!list.length) return null;
  if (/^H[1-6]$/.test(tag)) {
    const matched = list.find((m) => fuzzyNameMatches(text, m.name));
    return { isHeading: true, char: matched ? matched.name : null };
  }
  if (tag === 'P' || tag === 'DIV') {
    const nt = normCharName(text);
    if (!nt) return null;
    const matched = list.find((m) => normCharName(m.name) === nt);
    if (matched) return { isHeading: false, char: matched.name };
  }
  return null;
}
