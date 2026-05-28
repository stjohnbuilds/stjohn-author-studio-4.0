function tokenTimeMs(token, key) {
  const value = Number(token?.offsets?.[key]);
  return Number.isFinite(value) ? value / 1000 : null;
}

function parseWhisperJsonWords(data) {
  const words = [];
  const segments = Array.isArray(data?.transcription)
    ? data.transcription
    : (Array.isArray(data?.segments) ? data.segments : []);

  for (const seg of segments) {
    for (const token of (seg.tokens || [])) {
      const text = String(token?.text || '').trim();
      if (!text || text.startsWith('[') || text.startsWith('<')) continue;
      const cleaned = text.replace(/[^a-zA-Z0-9']/g, '').toLowerCase();
      if (!cleaned) continue;
      const from = tokenTimeMs(token, 'from');
      const to = tokenTimeMs(token, 'to');
      words.push({
        word: cleaned,
        start: from ?? to ?? 0,
        end: to ?? from ?? 0,
      });
    }
  }

  return words;
}

module.exports = { parseWhisperJsonWords };
