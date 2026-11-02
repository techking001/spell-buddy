import { compareSpelling } from './spell-diff.js';

export function normalizeAnswer(text) {
  return String(text ?? '').trim().toLowerCase();
}

// Same shape as before ({ correct, expected }), plus the full comparison for the correction screen.
export function checkAnswer(typed, word) {
  const comparison = compareSpelling(typed, word);
  return { correct: comparison.status === 'correct', expected: word, comparison };
}
