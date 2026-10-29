import { SESSION_LENGTH, DIFFICULTIES } from './config.js';
import { checkAnswer } from './answer-checker.js';
import { pointsFor, totalPoints } from './scoring.js';
import * as speech from './pronunciation.js';
import { recordSession, getProgress } from './storage.js';
import { loadFreeWords, shuffle } from './words.js';
import { setStatus, setButton } from './ui.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'review' ? 'review' : 'quick';
const requested = params.get('difficulty');
const difficulty = DIFFICULTIES.includes(requested) ? requested : 'mixed';

let words = [];
let index = 0;
let results = [];
let answered = false;
let speakId = 0;

function show(name) {
  ['loading', 'ready', 'play', 'done', 'error'].forEach((id) => {
    $(id).hidden = id !== name;
  });
}

// Speaks text and shows a soft pulse on the speaker button while it plays.
function speakNow(text) {
  const btn = $('hearBtn');
  const id = ++speakId;
  btn.classList.add('speaking');
  return speech.speak(text).then((ok) => {
    if (id === speakId) btn.classList.remove('speaking');
    return ok;
  });
}

// Hides the answer when text has to be shown on screen (used only if speech is unavailable).
function maskWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), '_____');
}

function setAction(label, iconName) {
  setButton($('actionBtn'), iconName, label);
}

function showWord() {
  const w = words[index];
  answered = false;
  $('progress').textContent = `Word ${index + 1} of ${words.length}`;
  $('answer').value = '';
  $('answer').disabled = false;
  $('aidText').hidden = true;
  $('aidText').textContent = '';
  $('meaningBtn').hidden = !speech.phrases.meaning(w);
  $('sentenceBtn').hidden = !speech.phrases.sentence(w);
  $('originBtn').hidden = !speech.phrases.origin(w);
  setAction('Check answer', 'check');
  setStatus($('feedback'), '');
  $('answer').focus();
  speakNow(speech.phrases.word(w));
}

function aid(kind) {
  const w = words[index];
  const text = speech.phrases[kind](w);
  if (!text) return;
  if (speech.isSpeechSupported()) {
    speakNow(text);
  } else {
    $('aidText').hidden = false;
    $('aidText').textContent = maskWord(text, w.word);
  }
}

function submit() {
  if (answered) return next();
  const w = words[index];
  const typed = $('answer').value;
  if (!typed.trim()) return setStatus($('feedback'), 'Type your spelling first.', 'warn');

  const { correct } = checkAnswer(typed, w.word);
  answered = true;
  results.push({ id: w.id, word: w.word, correct, answer: typed.trim(), points: pointsFor(correct) });
  $('answer').disabled = true;

  if (correct) setStatus($('feedback'), 'Correct! Well done.', 'good');
  else setStatus($('feedback'), `Good try! The correct spelling is “${w.word}”.`, 'bad');

  if (index === words.length - 1) setAction('See results', 'bar-chart');
  else setAction('Next word', 'arrow-right');
}

function next() {
  index += 1;
  if (index >= words.length) finish();
  else showWord();
}

function finish() {
  speech.stopSpeaking();
  $('hearBtn').classList.remove('speaking');
  recordSession({
    mode,
    difficulty: mode === 'review' ? 'mixed' : difficulty,
    date: new Date().toISOString(),
    results: results.map((r) => ({ id: r.id, correct: r.correct })),
  });

  $('scoreText').textContent = `${totalPoints(results)} / ${results.length}`;
  const missed = results.filter((r) => !r.correct);
  $('missedBox').hidden = missed.length === 0;
  $('missedList').innerHTML = '';
  missed.forEach((r) => {
    const li = document.createElement('li');
    li.textContent = `${r.word} (you wrote “${r.answer}”)`;
    $('missedList').appendChild(li);
  });
  $('playAgain').href = mode === 'review' ? 'practice.html?mode=review' : `practice.html?difficulty=${difficulty}`;
  $('playAgain').textContent = mode === 'review' ? 'Review again' : 'Play again';
  show('done');
}

async function init() {
  try {
    const all = await loadFreeWords();
    let pool;

    if (mode === 'review') {
      const ids = Object.keys(getProgress().mistakes);
      pool = all.filter((w) => ids.includes(w.id));
      if (!pool.length) throw new Error('You have no missed words to review right now. Great job!');
    } else {
      pool = difficulty === 'mixed' ? all : all.filter((w) => w.difficulty === difficulty);
      if (!pool.length) throw new Error('No words found for this level.');
    }

    words = shuffle(pool).slice(0, SESSION_LENGTH);
    $('readyInfo').textContent =
      mode === 'review'
        ? `${words.length} word${words.length === 1 ? '' : 's'} to review`
        : `${words.length} words · ${difficulty === 'mixed' ? 'mixed levels' : difficulty}`;
    $('speechWarning').hidden = speech.isSpeechSupported();
    show('ready');
  } catch (e) {
    $('errorMsg').textContent =
      e instanceof TypeError ? 'Could not load the words. Check your connection and refresh.' : e.message;
    show('error');
  }
}

$('beginBtn').addEventListener('click', () => {
  show('play');
  showWord(); // runs inside the tap so phones allow the audio
});
$('hearBtn').addEventListener('click', () => speakNow(speech.phrases.word(words[index])));
$('meaningBtn').addEventListener('click', () => aid('meaning'));
$('sentenceBtn').addEventListener('click', () => aid('sentence'));
$('originBtn').addEventListener('click', () => aid('origin'));
$('actionBtn').addEventListener('click', submit);
$('answer').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submit();
});
window.addEventListener('beforeunload', () => speech.stopSpeaking());

init();