export function normalizeAnswer(text) {
  return String(text ?? '').trim().toLowerCase();
}

export function checkAnswer(typed, word) {
  return { correct: normalizeAnswer(typed) === normalizeAnswer(word), expected: word };
}