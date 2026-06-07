// ONE place for the 7 character-row colours used across the app.
//
// Used by:
//   • Proof's "+ Add character" button (SessionsView.addEditNarrator)
//   • Prep's "+ Add character" inline editor (PrepManuscriptMode)
//   • Initial manuscript Setup wizard (ManuscriptSetup)
//
// Pink first so a single-character book always opens pink. The colour
// order is deliberately calm — pastels in roughly hue order so a five-
// or six-character book reads as one palette, not as confetti.
export const CHARACTER_PALETTE = [
  '#f8bbd0', // pink
  '#c8e6c9', // mint
  '#bbdefb', // blue
  '#e1bee7', // lavender
  '#ffcdd2', // rose
  '#ffe0b2', // peach
  '#fff9c4', // yellow
];

// Pick the first palette colour that isn't already taken. If every
// palette colour is in use, cycle from the start by index. Caller
// passes the array of hexes already used by existing characters.
export function nextPaletteColor(usedHexes = []) {
  const used = new Set(usedHexes.map((h) => String(h || '').toLowerCase()));
  const fresh = CHARACTER_PALETTE.find((c) => !used.has(c.toLowerCase()));
  if (fresh) return fresh;
  return CHARACTER_PALETTE[(usedHexes.length || 0) % CHARACTER_PALETTE.length];
}
