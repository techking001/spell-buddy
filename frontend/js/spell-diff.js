// Compares what a pupil typed with the correct spelling and explains the difference.
// One shared engine for Practice, Spelling Bee and Learn. It has no screen code in it.
//
// Method: dynamic programming over the two spellings (edit distance with adjacent swaps),
// then every best alignment is walked back so repeated letters and ties are handled honestly.
// If the best alignments disagree about what went wrong, no explanation is invented.

const MAX_PATHS = 300; // safety limit; words here are short
const MAX_EXPLAINED_ERRORS = 3; // more than this: show both spellings and a general message

const norm = (s) => String(s ?? '').trim().toLowerCase();
const show = (ch) => (ch === ' ' ? '␣' : ch.toUpperCase());
const upper = (s) => Array.from(s).map(show).join('');

function distanceMatrix(a, c) {
  const n = a.length;
  const m = c.length;
  const D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) D[i][0] = i;
  for (let j = 0; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === c[j - 1] ? 0 : 1;
      let v = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === c[j - 2] && a[i - 2] === c[j - 1] && a[i - 1] !== a[i - 2]) {
        v = Math.min(v, D[i - 2][j - 2] + 1); // two neighbouring letters in the wrong order
      }
      D[i][j] = v;
    }
  }
  return D;
}

// Every best way to line the two spellings up. Order of preference: swap, match/wrong letter, missing, extra.
function bestAlignments(a, c, D) {
  const found = [];
  const steps = [];
  function walk(i, j) {
    if (found.length >= MAX_PATHS) return;
    if (i === 0 && j === 0) {
      found.push([...steps].reverse());
      return;
    }
    const d = D[i][j];
    if (i > 1 && j > 1 && a[i - 1] === c[j - 2] && a[i - 2] === c[j - 1] && a[i - 1] !== a[i - 2] && d === D[i - 2][j - 2] + 1) {
      steps.push({ kind: 'swap', ai: i - 2, cj: j - 2 });
      walk(i - 2, j - 2);
      steps.pop();
    }
    if (i > 0 && j > 0) {
      if (a[i - 1] === c[j - 1] && d === D[i - 1][j - 1]) {
        steps.push({ kind: 'match', ai: i - 1, cj: j - 1 });
        walk(i - 1, j - 1);
        steps.pop();
      } else if (a[i - 1] !== c[j - 1] && d === D[i - 1][j - 1] + 1) {
        steps.push({ kind: 'substitute', ai: i - 1, cj: j - 1 });
        walk(i - 1, j - 1);
        steps.pop();
      }
    }
    if (j > 0 && d === D[i][j - 1] + 1) {
      steps.push({ kind: 'missing', cj: j - 1 });
      walk(i, j - 1);
      steps.pop();
    }
    if (i > 0 && d === D[i - 1][j] + 1) {
      steps.push({ kind: 'extra', ai: i - 1 });
      walk(i - 1, j);
      steps.pop();
    }
  }
  walk(a.length, c.length);
  return found;
}

// A short description of what went wrong in one alignment, ignoring positions of repeated letters.
function signature(path, a, c) {
  return path
    .filter((s) => s.kind !== 'match')
    .map((s) => {
      if (s.kind === 'missing') return `missing:${c[s.cj]}`;
      if (s.kind === 'extra') return `extra:${a[s.ai]}`;
      if (s.kind === 'swap') return `swap:${c[s.cj]}${c[s.cj + 1]}`;
      return `wrong:${a[s.ai]}>${c[s.cj]}`;
    })
    .sort()
    .join('|');
}

const matchCount = (path) => path.filter((s) => s.kind === 'match').length;

function toColumns(path, a, c) {
  const cols = [];
  for (const s of path) {
    if (s.kind === 'match') cols.push({ kind: 'match', a: show(a[s.ai]), c: show(c[s.cj]) });
    else if (s.kind === 'substitute') cols.push({ kind: 'substitute', a: show(a[s.ai]), c: show(c[s.cj]) });
    else if (s.kind === 'missing') cols.push({ kind: 'missing', a: '', c: show(c[s.cj]) });
    else if (s.kind === 'extra') cols.push({ kind: 'extra', a: show(a[s.ai]), c: '' });
    else {
      cols.push({ kind: 'swap', a: show(a[s.ai]), c: show(c[s.cj]) });
      cols.push({ kind: 'swap', a: show(a[s.ai + 1]), c: show(c[s.cj + 1]) });
    }
  }
  return cols;
}

function toErrors(path, a, c) {
  const errors = [];
  for (const s of path) {
    if (s.kind === 'match') continue;
    if (s.kind === 'missing') {
      const letter = c[s.cj];
      errors.push({
        type: 'missing',
        letter: show(letter),
        after: s.cj > 0 ? show(c[s.cj - 1]) : null,
        atEnd: s.cj === c.length - 1,
        double: c[s.cj - 1] === letter || c[s.cj + 1] === letter,
      });
    } else if (s.kind === 'extra') {
      const letter = a[s.ai];
      errors.push({
        type: 'extra',
        letter: show(letter),
        after: s.ai > 0 ? show(a[s.ai - 1]) : null,
        double: a[s.ai - 1] === letter || a[s.ai + 1] === letter,
      });
    } else if (s.kind === 'substitute') {
      errors.push({ type: 'substitute', wrote: show(a[s.ai]), should: show(c[s.cj]), position: s.cj + 1 });
    } else {
      errors.push({
        type: 'swap',
        wrote: upper(a.slice(s.ai, s.ai + 2)),
        should: upper(c.slice(s.cj, s.cj + 2)),
      });
    }
  }
  return errors;
}

// One short sentence, in plain English.
export function describeError(e) {
  if (e.type === 'missing') {
    if (e.double) return `This word has a double letter: ${e.letter}${e.letter}. You wrote only one ${e.letter}.`;
    if (e.after) return `You missed the letter ${e.letter} after ${e.after}.`;
    return `You missed the letter ${e.letter} at the start.`;
  }
  if (e.type === 'extra') {
    if (e.double) return `You wrote ${e.letter} twice, but this word has only one ${e.letter} there.`;
    if (e.after) return `You added an extra ${e.letter} after ${e.after}.`;
    return `You added an extra ${e.letter} at the start.`;
  }
  if (e.type === 'substitute') return `You wrote ${e.wrote} instead of ${e.should} (letter ${e.position}).`;
  return `The letters ${e.wrote} are in the wrong order. They should be ${e.should}.`;
}

const GENERAL = 'Look at both spellings carefully. Find the letters that are different.';

// Returns a structured result that any screen can draw:
//  status: 'correct' | 'incorrect' | 'empty'
//  answer / correct: the two spellings in capitals
//  columns: aligned letters [{ kind, a, c }] (empty when we are not confident)
//  errors: what went wrong, in order
//  explanation: one short sentence;  details: one line per mistake when there are 2 or 3
//  confident: true when the explanation can be trusted
export function compareSpelling(typed, correctWord) {
  const a = norm(typed);
  const c = norm(correctWord);
  const base = { answer: upper(a), correct: upper(c), columns: [], errors: [], explanation: '', details: [], confident: false, distance: 0 };

  if (!a) return { ...base, status: 'empty', explanation: 'No answer was entered.' };
  if (a === c) return { ...base, status: 'correct', confident: true, explanation: 'Perfect spelling!' };

  const D = distanceMatrix(a, c);
  const distance = D[a.length][c.length];
  const paths = bestAlignments(a, c, D);
  const bestScore = Math.max(...paths.map(matchCount));
  const top = paths.filter((p) => matchCount(p) === bestScore);
  const agree = new Set(top.map((p) => signature(p, a, c))).size === 1;
  const primary = top[0];

  const tooDifferent = distance > MAX_EXPLAINED_ERRORS || distance > Math.ceil(c.length / 2);
  const result = { ...base, status: 'incorrect', distance };

  if (!agree || tooDifferent) {
    return { ...result, explanation: GENERAL }; // show both spellings, but do not guess
  }

  const errors = toErrors(primary, a, c);
  result.columns = toColumns(primary, a, c);
  result.errors = errors;
  result.confident = true;
  if (errors.length === 1) {
    result.explanation = describeError(errors[0]);
  } else {
    result.explanation = `You made ${errors.length} mistakes. Look at the marked letters.`;
    result.details = errors.map(describeError);
  }
  return result;
}
