import { DIFFICULTIES, COMPUTER_LEVELS, DEFAULT_COMPUTER_LEVEL } from './config.js';
import { checkAnswer } from './answer-checker.js';
import { pointsFor, totalPoints } from './scoring.js';
import * as speech from './pronunciation.js';
import { getSettings, recordSession } from './storage.js';
import { loadFreeWords, shuffle } from './words.js';
import { decideComputerRound } from './computer.js';
import { icon, setButton, setStatus } from './ui.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const requested = params.get('difficulty');
const difficulty = DIFFICULTIES.includes(requested) ? requested : 'mixed';
const match = params.get('opponent') === 'computer';
const requestedLevel = params.get('computer');
const compLevel = Object.keys(COMPUTER_LEVELS).includes(requestedLevel) ? requestedLevel : DEFAULT_COMPUTER_LEVEL;
const settings = getSettings();

let words = [];
let index = 0;
let results = [];
let answered = false;
let timerId = null;
let timerStarted = false;
let timeLeft = 0;
let repeatsUsed = 0;
let computerRound = null;
let computerScore = 0;
let compTimer = null;
let waitingComputer = false;
let speakId = 0;

function show(name) {
  ['loading', 'ready', 'play', 'done', 'error'].forEach((id) => {
    $(id).hidden = id !== name;
  });
}

// Speaks text and pulses the speaker icon while it plays.
function speakNow(text) {
  const btn = $('hearBtn');
  const id = ++speakId;
  btn.classList.add('speaking');
  return speech.speak(text).then((ok) => {
    if (id === speakId) btn.classList.remove('speaking');
    return ok;
  });
}

function maskWord(text, word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), '_____');
}

function setAction(label, iconName) {
  setButton($('actionBtn'), iconName, label);
}

// ---------- rules ----------
function describeRules() {
  const rules = [];
  if (match) {
    rules.push(
      `You play against the computer (${COMPUTER_LEVELS[compLevel].label} level). It spells every word too, and the higher score wins.`
    );
  }
  rules.push('You get one try for each word. After you submit, you will see the correct spelling.');

  rules.push(
    settings.beeTimerSeconds
      ? `You have ${settings.beeTimerSeconds} seconds for each word. The clock starts after the word is spoken.`
      : 'There is no time limit.'
  );

  rules.push(
    settings.beeMaxRepeats
      ? `You can hear the word again up to ${settings.beeMaxRepeats} time${settings.beeMaxRepeats === 1 ? '' : 's'}.`
      : 'You can hear the word again as many times as you like.'
  );

  const helps = [];
  if (settings.beeAllowMeaning) helps.push('the meaning');
  if (settings.beeAllowSentence) helps.push('an example sentence');
  if (settings.beeAllowOrigin && words.some(speech.hasVerifiedOrigin)) helps.push('the word origin');
  rules.push(helps.length ? `You may ask for: ${helps.join(', ')}.` : 'No extra help is allowed.');

  rules.push('Each correct word scores 1 point.');
  return rules;
}

// ---------- timer ----------
function renderTimer() {
  const total = settings.beeTimerSeconds;
  $('timerText').textContent = `${timeLeft}s`;
  $('timerBar').style.width = `${Math.max(0, (timeLeft / total) * 100)}%`;
  $('timerBox').classList.toggle('low', timeLeft <= 5);
}

function startTimer() {
  if (!settings.beeTimerSeconds || timerStarted || answered) return;
  timerStarted = true;
  timeLeft = settings.beeTimerSeconds;
  $('timerBox').hidden = false;
  renderTimer();
  timerId = setInterval(() => {
    timeLeft -= 1;
    renderTimer();
    if (timeLeft <= 0) submit(true);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

// ---------- computer ----------
function updateScoreboard() {
  if (!match) return;
  $('scoreboard').textContent = `You ${totalPoints(results)} – ${computerScore} Computer`;
}

function setComp(text, iconName) {
  const el = $('compLine');
  el.textContent = '';
  el.hidden = false;
  el.appendChild(icon(iconName));
  const span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
}

function revealComputer() {
  if (!match) return;
  const myIndex = index;
  const round = computerRound;
  waitingComputer = true;
  setComp('The computer is thinking…', 'bot');
  $('actionBtn').disabled = true;

  compTimer = setTimeout(() => {
    if (index !== myIndex) return;
    computerScore += pointsFor(round.correct);
    setComp(`The computer spelled “${round.answer}”`, round.correct ? 'check-circle' : 'x-circle');
    waitingComputer = false;
    updateScoreboard();
    $('actionBtn').disabled = false;
  }, round.thinkMs);
}

// ---------- flow ----------
function updateRepeatButton() {
  const max = settings.beeMaxRepeats;
  if (!max) {
    setButton($('hearBtn'), 'volume', 'Hear the word again');
    $('hearBtn').disabled = false;
    return;
  }
  const left = Math.max(0, max - repeatsUsed);
  setButton($('hearBtn'), 'volume', `Hear the word again (${left} left)`);
  $('hearBtn').disabled = left <= 0;
}

function showWord() {
  const w = words[index];
  const myIndex = index;
  answered = false;
  timerStarted = false;
  repeatsUsed = 0;
  waitingComputer = false;
  clearTimeout(compTimer);
  stopTimer();
  $('timerBox').hidden = true;

  computerRound = match ? decideComputerRound(w, compLevel) : null; // decided now, never changed
  $('compLine').hidden = true;
  $('compLine').textContent = '';
  $('actionBtn').disabled = false;
  updateScoreboard();

  $('progress').textContent = `Word ${index + 1} of ${words.length}`;
  $('answer').value = '';
  $('answer').disabled = false;
  $('aidText').hidden = true;
  $('aidText').textContent = '';
  $('meaningBtn').disabled = false;
  $('sentenceBtn').disabled = false;
  $('originBtn').disabled = false;
  $('meaningBtn').hidden = !(settings.beeAllowMeaning && speech.phrases.meaning(w));
  $('sentenceBtn').hidden = !(settings.beeAllowSentence && speech.phrases.sentence(w));
  $('originBtn').hidden = !(settings.beeAllowOrigin && speech.phrases.origin(w));
  updateRepeatButton();
  setAction('Submit', 'check');
  setStatus($('feedback'), '');
  $('answer').focus();

  speakNow(speech.phrases.word(w)).then(() => {
    if (index === myIndex && !answered) startTimer();
  });
}

function aid(kind) {
  if (answered) return;
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

function submit(timedOut = false) {
  if (answered) {
    if (waitingComputer) return;
    return next();
  }
  const w = words[index];
  const typed = $('answer').value;
  if (timedOut !== true && !typed.trim()) return setStatus($('feedback'), 'Type your spelling first.', 'warn');

  stopTimer();
  speech.stopSpeaking();
  $('hearBtn').classList.remove('speaking');
  const { correct } = checkAnswer(typed, w.word);
  answered = true;
  results.push({ id: w.id, word: w.word, correct, answer: typed.trim(), points: pointsFor(correct) });

  $('answer').disabled = true;
  $('hearBtn').disabled = true;
  $('meaningBtn').disabled = true;
  $('sentenceBtn').disabled = true;
  $('originBtn').disabled = true;

  if (correct) setStatus($('feedback'), 'Correct! Well done.', 'good');
  else if (timedOut === true) setStatus($('feedback'), `Time's up! The correct spelling is “${w.word}”.`, 'bad', 'clock');
  else setStatus($('feedback'), `Good try! The correct spelling is “${w.word}”.`, 'bad');

  if (index === words.length - 1) setAction('See results', 'bar-chart');
  else setAction('Next word', 'arrow-right');
  revealComputer();
}

function next() {
  index += 1;
  if (index >= words.length) finish();
  else showWord();
}

function finish() {
  stopTimer();
  clearTimeout(compTimer);
  speech.stopSpeaking();
  recordSession({
    mode: match ? 'match' : 'bee',
    difficulty,
    date: new Date().toISOString(),
    results: results.map((r) => ({ id: r.id, correct: r.correct })),
  });

  const you = totalPoints(results);
  $('doneTitle').textContent = match ? 'Match complete' : 'Round complete';
  $('scoreText').textContent = `${you} / ${results.length}`;

  $('matchResult').hidden = !match;
  if (match) {
    const verdict =
      you > computerScore ? 'You win!' : you < computerScore ? 'The computer wins this time. Try again!' : "It's a draw!";
    $('matchResult').textContent = `${verdict} (You ${you} – ${computerScore} Computer)`;
  }

  const missed = results.filter((r) => !r.correct);
  $('missedBox').hidden = missed.length === 0;
  $('missedList').innerHTML = '';
  missed.forEach((r) => {
    const li = document.createElement('li');
    li.textContent = r.answer ? `${r.word} (you wrote “${r.answer}”)` : `${r.word} (no answer)`;
    $('missedList').appendChild(li);
  });
  $('playAgain').href = match
    ? `bee.html?opponent=computer&computer=${compLevel}&difficulty=${difficulty}`
    : `bee.html?difficulty=${difficulty}`;
  show('done');
}

async function init() {
  try {
    const all = await loadFreeWords();
    const pool = difficulty === 'mixed' ? all : all.filter((w) => w.difficulty === difficulty);
    if (!pool.length) throw new Error('No words found for this level.');
    words = shuffle(pool).slice(0, Math.min(settings.beeWordCount, pool.length));

    $('readyTitle').textContent = match ? 'Play the Computer' : 'Spelling Bee';
    document.title = `${match ? 'Vs Computer' : 'Spelling Bee'} · Spell Buddy`;
    $('scoreboard').hidden = !match;
    $('readyInfo').textContent = `${words.length} words · ${difficulty === 'mixed' ? 'mixed levels' : difficulty}`;
    $('rulesList').innerHTML = '';
    describeRules().forEach((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      $('rulesList').appendChild(li);
    });
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
$('hearBtn').addEventListener('click', () => {
  if (answered) return;
  const max = settings.beeMaxRepeats;
  if (max && repeatsUsed >= max) return;
  repeatsUsed += 1;
  updateRepeatButton();
  speakNow(speech.phrases.word(words[index]));
});
$('meaningBtn').addEventListener('click', () => aid('meaning'));
$('sentenceBtn').addEventListener('click', () => aid('sentence'));
$('originBtn').addEventListener('click', () => aid('origin'));
$('actionBtn').addEventListener('click', () => submit());
$('answer').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submit();
});
window.addEventListener('beforeunload', () => {
  stopTimer();
  clearTimeout(compTimer);
  speech.stopSpeaking();
});

init();