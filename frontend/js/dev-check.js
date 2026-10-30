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
const status = (w) => (w.etymology && w.etymology.verification_status) || 'missing';
const summary = (w) => String((w.etymology && w.etymology.summary) || '').trim();
const isVerified = (w) => status(w) === 'verified' && !!summary(w);

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  values.forEach((v) => (seen.has(v) ? dupes.add(v) : seen.add(v)));
  return [...dupes];
}

function runChecks(words) {
  add(words.length > 0 ? 'pass' : 'fail', 'Word bank loaded', `${words.length} words`);

  const counts = LEVELS.map((l) => `${l} ${words.filter((w) => w.difficulty === l).length}`).join(' · ');
  add('pass', 'Words per level', counts);

  const dupIds = duplicates(words.map((w) => String(w.id)));
  add(dupIds.length ? 'fail' : 'pass', 'Every id is unique', list(dupIds));

  const dupWords = duplicates(words.map((w) => String(w.word).toLowerCase()));
  add(dupWords.length ? 'fail' : 'pass', 'Every word appears once', list(dupWords));

  const badLevel = words.filter((w) => !LEVELS.includes(w.difficulty)).map((w) => w.word);
  add(badLevel.length ? 'fail' : 'pass', 'Every difficulty is easy, medium or hard', list(badLevel));

  const missing = words
    .filter((w) => REQUIRED.some((f) => typeof w[f] !== 'string' || !w[f].trim()))
    .map((w) => w.word || w.id);
  add(missing.length ? 'fail' : 'pass', 'Required fields filled in', list(missing));

  const badSyl = words
    .filter((w) => !Array.isArray(w.syllables) || !w.syllables.length || w.syllables.join('').toLowerCase() !== String(w.word).toLowerCase())
    .map((w) => w.word);
  add(badSyl.length ? 'warn' : 'pass', 'Syllables join back into the word', list(badSyl));

  const noWordInSentence = words
    .filter((w) => !String(w.example_sentence).toLowerCase().includes(String(w.word).toLowerCase()))
    .map((w) => w.word);
  add(noWordInSentence.length ? 'warn' : 'pass', 'Each example sentence uses its word', list(noWordInSentence));

  const verified = words.filter(isVerified).length;
  const notSupplied = words.filter((w) => status(w) === 'not_supplied').length;
  const pending = words.filter((w) => status(w) === 'pending').length;
  add('pass', `Origins shown to pupils: ${verified} of ${words.length}`, `${notSupplied} not supplied (nothing is displayed), ${pending} pending`);

  const verifiedEmpty = words.filter((w) => status(w) === 'verified' && !summary(w)).map((w) => w.word);
  add(verifiedEmpty.length ? 'fail' : 'pass', 'No word is marked verified with an empty origin', list(verifiedEmpty));

  const leaking = words.filter((w) => status(w) !== 'verified' && summary(w) && status(w) !== 'pending').map((w) => w.word);
  add(leaking.length ? 'warn' : 'pass', 'Origin text only on verified or pending-draft entries', list(leaking));
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
    cell(tr, isVerified(w) ? `✅ ${summary(w)}` : status(w) === 'pending' && summary(w) ? `(draft) ${summary(w)}` : 'not supplied');
    $('rows').appendChild(tr);
  });
}

(async function init() {
  try {
    // Reads the file directly, so duplicate or broken entries are reported instead of hidden.
    const res = await fetch('data/free-words.json');
    if (!res.ok) throw new Error('Could not load data/free-words.json.');
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('data/free-words.json is not a list of words.');
    const words = data.filter((w) => w && typeof w === 'object');
    if (words.length !== data.length) add('fail', 'Every entry is an object', `${data.length - words.length} invalid entries`);
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