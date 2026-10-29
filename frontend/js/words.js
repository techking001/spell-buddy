let cache = null;

export async function loadFreeWords() {
  if (cache) return cache;
  const res = await fetch('data/free-words.json');
  if (!res.ok) throw new Error('Could not load the word list. Please refresh the page.');
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('The word list is not in the expected format.');
  cache = data.filter((w) => w && w.id && w.word);
  return cache;
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}