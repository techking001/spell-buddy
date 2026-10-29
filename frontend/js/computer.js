import { COMPUTER_LEVELS, DEFAULT_COMPUTER_LEVEL } from './config.js';

const VOWELS = ['a', 'e', 'i', 'o', 'u'];
const randInt = (n) => Math.floor(Math.random() * n);

function swapAdjacent(w) {
  const spots = [];
  for (let i = 0; i < w.length - 1; i++) if (w[i] !== w[i + 1]) spots.push(i);
  if (!spots.length) return w;
  const i = spots[randInt(spots.length)];
  return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
}

function dropLetter(w) {
  if (w.length < 4) return w;
  const i = 1 + randInt(w.length - 2);
  return w.slice(0, i) + w.slice(i + 1);
}

function doubleLetter(w) {
  const i = randInt(w.length);
  return w.slice(0, i + 1) + w[i] + w.slice(i + 1);
}

function swapVowel(w) {
  const spots = [];
  for (let i = 0; i < w.length; i++) if (VOWELS.includes(w[i])) spots.push(i);
  if (!spots.length) return w;
  const i = spots[randInt(spots.length)];
  const others = VOWELS.filter((v) => v !== w[i]);
  return w.slice(0, i) + others[randInt(others.length)] + w.slice(i + 1);
}

const STRATEGIES = [swapAdjacent, dropLetter, doubleLetter, swapVowel];

export function misspell(word) {
  const lower = word.toLowerCase();
  for (let tries = 0; tries < 12; tries++) {
    const candidate = STRATEGIES[randInt(STRATEGIES.length)](lower);
    if (candidate !== lower && candidate.length > 1) {
      return word[0] === word[0].toUpperCase() ? candidate[0].toUpperCase() + candidate.slice(1) : candidate;
    }
  }
  return word + 'e';
}

// Decided once per round. Nothing changes it afterwards.
export function decideComputerRound(word, level) {
  const cfg = COMPUTER_LEVELS[level] || COMPUTER_LEVELS[DEFAULT_COMPUTER_LEVEL];
  const chance = cfg.chance[word.difficulty] ?? 0.6;
  const correct = Math.random() < chance;
  const [minMs, maxMs] = cfg.thinkMs;
  return {
    correct,
    answer: correct ? word.word : misspell(word.word),
    thinkMs: minMs + Math.random() * (maxMs - minMs),
  };
}