import { DIFFICULTIES } from './config.js';
import { checkAnswer } from './answer-checker.js';
import { renderCorrection, clearCorrection } from './correction.js';
import * as speech from './pronunciation.js';
import { recordAnswer, recordSessionEntry, getProgress } from './storage.js';
import { loadFreeWords, wordsForDifficulty } from './words.js';
import { createCycler } from './cycle.js';
import { setStatus, setButton } from './ui.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'review' ? 'review' : 'quick';
const requested = params.get('difficulty');
let difficulty = DIFFICULTIES.includes(requested) ? requested : 'mixed'; // Mixed unless the link says otherwise

// Quick practice never ends by itself. Review stops after every missed word has been shown once.
const continuous = mode === 'quick';

let allWords = [];
let reviewPool = [];
let cycler = null;
let current = null;
let answered = false;
let speakId = 0;
let saved = false;
const session = { attempts: 0, correct: 0, missed: new Map() };

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

const setAction = (label, iconName) => setButton($('actionBtn'), iconName, label);
const accuracy = () => (session.attempts ? Math.round((session.correct / session.attempts) * 100) : null);

// ---------- setup screen ----------
function syncUrl() {
  try {
    const u = new URL(location.href);
    u.searchParams.set('difficulty', difficulty);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch {
    /* the link is only for sharing, so a failure here is harmless */
  }
}

function updateSetup() {
  const count = wordsForDifficulty(allWords, difficulty).length;
  $('readyInfo').textContent =
    count === 0 ? 'There are no words at this level yet.' : `${count} word${count === 1 ? '' : 's'}. Practice keeps going until you press End session.`;
  $('beginBtn').disabled = count === 0;
}

function setupLevels() {
  document.querySelectorAll('input[name="level"]').forEach((radio) => {
    const count = wordsForDifficulty(allWords, radio.value).length;
    radio.closest('.opt').querySelector('.opt-count').textContent = `${count} words`;
    radio.disabled = count === 0;
    radio.checked = radio.value === difficulty;
    radio.addEventListener('change', () => {
      difficulty = radio.value; // the real word pool is built from this when Start is pressed
      syncUrl();
      updateSetup();
    });
  });
  syncUrl();
  updateSetup();
}

// ---------- playing ----------
function updateLive() {
  const parts = [];
  if (continuous) parts.push(`Round ${cycler.cycle}`);
  if (session.attempts) parts.push(`${session.attempts} answered`, `${session.correct} correct (${accuracy()}%)`);
  $('liveStats').textContent = parts.join(' · ');
}

function resetFeedback() {
  setStatus($('feedback'), '');
  clearCorrection($('correction'));
}

function showWord() {
  const w = cycler.next();
  if (!w) return showSummary();

  current = w;
  answered = false;
  $('progress').textContent = `Word ${cycler.position} of ${cycler.size}`;
  $('answer').value = '';
  $('answer').disabled = false;
  $('aidText').hidden = true;
  $('aidText').textContent = '';
  $('meaningBtn').hidden = !speech.phrases.meaning(w);
  $('sentenceBtn').hidden = !speech.phrases.sentence(w);
  $('originBtn').hidden = !speech.phrases.origin(w); // only when a verified origin exists
  setAction('Check answer', 'check');
  resetFeedback();
  updateLive();
  $('answer').focus();
  speakNow(speech.phrases.word(w));
}

function aid(kind) {
  if (!current) return;
  const text = speech.phrases[kind](current);
  if (!text) return;
  if (speech.isSpeechSupported()) {
    speakNow(text);
  } else {
    $('aidText').hidden = false;
    $('aidText').textContent = maskWord(text, current.word);
  }
}

function recordResult(w, correct) {
  session.attempts += 1;
  if (correct) {
    session.correct += 1;
  } else {
    const entry = session.missed.get(w.id) || { word: w.word, count: 0 };
    entry.count += 1;
    session.missed.set(w.id, entry);
  }
  recordAnswer({ id: w.id, correct }); // saved immediately. Only the real answer is ever recorded.
}

const hearCurrent = () => current && speakNow(speech.phrases.word(current));

function submit() {
  if (!current) return;
  if (answered) return showWord();

  const typed = $('answer').value;
  if (!typed.trim()) return setStatus($('feedback'), 'Type your spelling first.', 'warn');

  const { correct } = checkAnswer(typed, current.word);
  answered = true;
  recordResult(current, correct);
  $('answer').disabled = true;

  if (correct) {
    setStatus($('feedback'), 'Correct! Well done.', 'good');
  } else {
    setStatus($('feedback'), '');
    renderCorrection($('correction'), typed.trim(), current.word); // only: Your Answer / Correct Spelling
  }

  if (!continuous && cycler.remaining === 0) setAction('See results', 'bar-chart');
  else setAction('Next word', 'arrow-right');
  updateLive();
}

// Adds one line to "Recent sessions". Runs once, whichever way the pupil leaves.
function saveSessionOnce() {
  if (saved || session.attempts === 0) return;
  saved = true;
  recordSessionEntry({
    mode,
    difficulty: mode === 'review' ? 'mixed' : difficulty,
    date: new Date().toISOString(),
    correct: session.correct,
    total: session.attempts,
  });
}

function showSummary() {
  speech.stopSpeaking();
  $('hearBtn').classList.remove('speaking');
  saveSessionOnce();

  const { attempts, correct } = session;
  $('sumAttempts').textContent = attempts;
  $('sumCorrect').textContent = correct;
  $('sumIncorrect').textContent = attempts - correct;
  $('sumAccuracy').textContent = attempts ? `${accuracy()}%` : '—';
  $('summaryMsg').textContent = attempts
    ? 'Great effort! Every word you practise makes you stronger.'
    : 'You have not answered any words yet. Come back any time!';

  const rounds = continuous && cycler ? Math.floor(attempts / cycler.size) : 0;
  $('sumRounds').hidden = rounds === 0;
  $('sumRounds').textContent = `You went through the whole word list ${rounds} time${rounds === 1 ? '' : 's'}.`;

  const missed = [...session.missed.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  $('missedBox').hidden = missed.length === 0;
  $('missedList').innerHTML = '';
  missed.forEach((m) => {
    const li = document.createElement('li');
    li.textContent = m.count > 1 ? `${m.word} (missed ${m.count} times)` : m.word;
    $('missedList').appendChild(li);
  });

  $('playAgain').href = mode === 'review' ? 'practice.html?mode=review' : `practice.html?difficulty=${difficulty}`;
  $('playAgain').textContent = mode === 'review' ? 'Review again' : 'Practise again';
  show('done');
}

async function init() {
  try {
    allWords = await loadFreeWords();

    if (mode === 'review') {
      // Review always uses the words this pupil missed. The difficulty chooser is not shown.
      const ids = new Set(Object.keys(getProgress().mistakes));
      reviewPool = allWords.filter((w) => ids.has(w.id));
      if (!reviewPool.length) throw new Error('You have no missed words to review right now. Great job!');
      $('levelBox').hidden = true;
      $('reviewNote').hidden = false;
      $('readyInfo').textContent = `${reviewPool.length} word${reviewPool.length === 1 ? '' : 's'} to review`;
      $('listenSetup').dataset.say = "Let's practise the words you missed. Press Start practice.";
    } else {
      setupLevels();
    }

    $('speechWarning').hidden = speech.isSpeechSupported();
    show('ready');
  } catch (e) {
    $('errorMsg').textContent =
      e instanceof TypeError ? 'Could not load the words. Check your connection and refresh.' : e.message;
    show('error');
  }
}

$('beginBtn').addEventListener('click', () => {
  const pool = mode === 'review' ? reviewPool : wordsForDifficulty(allWords, difficulty);
  if (!pool.length) return;
  cycler = createCycler(pool, { loop: continuous });
  show('play');
  showWord(); // runs inside the tap so phones allow the audio
});
$('endBtn').addEventListener('click', showSummary);
$('hearBtn').addEventListener('click', hearCurrent);
$('meaningBtn').addEventListener('click', () => aid('meaning'));
$('sentenceBtn').addEventListener('click', () => aid('sentence'));
$('originBtn').addEventListener('click', () => aid('origin'));
$('actionBtn').addEventListener('click', submit);
$('answer').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submit();
});
// Leaving by any route (menu link, back button, closing the tab) still saves the session line.
window.addEventListener('pagehide', () => {
  saveSessionOnce();
  speech.stopSpeaking();
});

init();
