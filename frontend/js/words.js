let cache = null;

// Keeps entries exactly as supplied. Skips entries without an id or a word,
// and skips repeated ids (the first one wins).
export function normalizeWords(data) {
  if (!Array.isArray(data)) throw new Error('The word list is not in the expected format.');
  const seen = new Set();
  const out = [];
  data.forEach((w) => {
    if (!w || typeof w !== 'object') return;
    const id = String(w.id ?? '').trim();
    const word = String(w.word ?? '').trim();
    if (!id || !word) return;
    if (seen.has(id)) {
      console.warn(`Spell Buddy: duplicate word id "${id}" was skipped.`);
      return;
    }
    seen.add(id);
    out.push(w);
  });
  return out;
}

export async function loadFreeWords() {
  if (cache) return cache;
  const res = await fetch('data/free-words.json');
  if (!res.ok) throw new Error('Could not load the word list. Please refresh the page.');
  cache = normalizeWords(await res.json());
  return cache;
}

// 'mixed' (or anything that is not a level name) returns every word.
export function wordsForDifficulty(words, difficulty) {
  return difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard'
    ? words.filter((w) => w.difficulty === difficulty)
    : [...words];
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}