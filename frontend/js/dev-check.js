import { loadFreeWords } from './words.js';

const $ = (id) => document.getElementById(id);
const REQUIRED = ['id', 'word', 'difficulty', 'definition', 'part_of_speech', 'example_sentence'];
const LEVELS = ['easy', 'medium', 'hard'];
let fails = 0;
let warns = 0;

function add(status, label, detail = '') {
  if (status === 'fail') fails += 1;
  if (status === 'warn') warns += 1;
  const li = document.createElement('li');
  li.className = status;
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  li.textContent = `${icon} ${label}${detail ? ' — ' + detail : ''}`;
  $('results').appendChild(li);
}

const list = (items, max = 8) => (items.length > max ? `${items.slice(0, max).join(', ')} …(+${items.length - max})` : items.join(', '));
const isVerified = (w) => !!(w.etymology && w.etymology.summary && w.etymology.verification_status === 'verified');
const hasDraft = (w) => !!(w.etymology && w.etymology.summary && w.etymology.verification_status !== 'verified');

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  values.forEach((v) => (seen.has(v) ? dupes.add(v) : seen.add(v)));
  return [...dupes];
}

function runChecks(words) {
  add(words.length === 30 ? 'pass' : 'fail', 'Exactly 30 words', `found ${words.length}`);

  const dupIds = duplicates(words.map((w) => w.id));
  add(dupIds.length ? 'fail' : 'pass', 'Every id is unique', list(dupIds));

  const dupWords = duplicates(words.map((w) => w.word.toLowerCase()));
  add(dupWords.length ? 'fail' : 'pass', 'Every word appears once', list(dupWords));

  const badLevel = words.filter((w) => !LEVELS.includes(w.difficulty)).map((w) => w.word);
  add(badLevel.length ? 'fail' : 'pass', 'Every difficulty is easy, medium or hard', list(badLevel));
  const counts = LEVELS.map((l) => `${l} ${words.filter((w) => w.difficulty === l).length}`).join(' · ');
  add('pass', 'Words per level', counts);

  const missing = words
    .filter((w) => REQUIRED.some((f) => typeof w[f] !== 'string' || !w[f].trim()))
    .map((w) => w.word);
  add(missing.length ? 'fail' : 'pass', 'Required fields filled in', list(missing));

  const badSyl = words
    .filter((w) => !Array.isArray(w.syllables) || !w.syllables.length || w.syllables.join('').toLowerCase() !== w.word.toLowerCase())
    .map((w) => w.word);
  add(badSyl.length ? 'fail' : 'pass', 'Syllables join back into the word', list(badSyl));

  const noWordInSentence = words
    .filter((w) => !String(w.example_sentence).toLowerCase().includes(w.word.toLowerCase()))
    .map((w) => w.word);
  add(noWordInSentence.length ? 'warn' : 'pass', 'Each example sentence uses its word', list(noWordInSentence));

  const notFree = words.filter((w) => w.word_bank !== 'free').map((w) => w.word);
  add(notFree.length ? 'fail' : 'pass', 'Every word is marked as free', list(notFree));

  const verified = words.filter(isVerified).length;
  const drafts = words.filter(hasDraft).length;
  const none = words.length - verified - drafts;
  add(
    verified === words.length ? 'pass' : 'warn',
    `Origins verified: ${verified} of ${words.length}`,
    `${drafts} draft${drafts === 1 ? '' : 's'} waiting for your approval, ${none} with no origin`
  );
}

function cell(tr, text) {
  const td = document.createElement('td');
  td.textContent = text;
  tr.appendChild(td);
}

function renderTable(words) {
  words.forEach((w) => {
    const tr = document.createElement('tr');
    cell(tr, w.word);
    cell(tr, w.difficulty);
    cell(tr, Array.isArray(w.syllables) ? w.syllables.join(' · ') : '');
    cell(tr, w.part_of_speech || '');
    cell(tr, w.definition || '');
    cell(tr, w.example_sentence || '');
    cell(tr, isVerified(w) ? `✅ ${w.etymology.summary}` : hasDraft(w) ? `(draft) ${w.etymology.summary}` : 'no origin');
    $('rows').appendChild(tr);
  });
}

(async function init() {
  try {
    const words = await loadFreeWords();
    runChecks(words);
    renderTable(words);
    $('summary').textContent = fails
      ? `${fails} check${fails === 1 ? '' : 's'} failed. Fix them in data/free-words.json.`
      : warns
        ? `No failures. ${warns} warning${warns === 1 ? '' : 's'} left to review.`
        : 'All checks passed.';
    $('summary').className = `feedback ${fails ? 'bad' : warns ? 'warn' : 'good'}`;
  } catch (e) {
    $('summary').textContent = e.message;
    $('summary').className = 'feedback bad';
  }
})();