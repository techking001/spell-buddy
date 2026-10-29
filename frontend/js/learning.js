import { loadFreeWords } from './words.js';
import { checkAnswer } from './answer-checker.js';
import * as speech from './pronunciation.js';
import { setStatus } from './ui.js';

const $ = (id) => document.getElementById(id);
let words = [];
let visible = [];
let position = -1;
let level = 'all';

function showView(name) {
  ['loading', 'listView', 'cardView', 'error'].forEach((id) => {
    $(id).hidden = id !== name;
  });
}

function renderList() {
  visible = words.filter((w) => level === 'all' || w.difficulty === level);
  const list = $('wordList');
  list.innerHTML = '';
  visible.forEach((w, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'word-btn';
    btn.dataset.level = w.difficulty || '';
    btn.textContent = w.word;
    const small = document.createElement('small');
    small.textContent = w.difficulty || '';
    btn.appendChild(small);
    btn.addEventListener('click', () => openWord(i));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function setText(id, value, fallback) {
  const el = $(id);
  el.textContent = value || fallback;
  el.className = value ? '' : 'missing';
}

function renderSyllables(w) {
  const el = $('lSyllables');
  el.innerHTML = '';
  if (Array.isArray(w.syllables) && w.syllables.length) {
    el.className = '';
    w.syllables.forEach((s) => {
      const chip = document.createElement('span');
      chip.className = 'syl';
      chip.textContent = s;
      el.appendChild(chip);
    });
  } else {
    el.className = 'missing';
    el.textContent = 'Not available';
  }
}

function openWord(i) {
  const w = visible[i];
  if (!w) return;
  position = i;

  $('lWord').textContent = w.word;
  $('lPos').textContent = w.part_of_speech || '';
  $('lPos').hidden = !w.part_of_speech;
  $('lLevel').textContent = w.difficulty || '';
  $('lLevel').hidden = !w.difficulty;
  renderSyllables(w);
  setText('lDef', w.definition, 'Not available');
  setText('lExample', w.example_sentence, 'Not available');
  const origin = speech.hasVerifiedOrigin(w) ? w.etymology.summary : '';
  setText('lOrigin', origin, 'Origin not yet verified.');

  $('hearMeaning').hidden = !speech.phrases.meaning(w);
  $('hearSentence').hidden = !speech.phrases.sentence(w);
  $('hearOrigin').hidden = !origin;
  $('prevBtn').disabled = i <= 0;
  $('nextBtn').disabled = i >= visible.length - 1;

  $('tryInput').value = '';
  setStatus($('tryFeedback'), '');
  $('speechWarning').hidden = speech.isSpeechSupported();
  showView('cardView');
  window.scrollTo(0, 0);
}

function tryWord() {
  const w = visible[position];
  const typed = $('tryInput').value;
  if (!typed.trim()) return setStatus($('tryFeedback'), 'Type your spelling first.', 'warn');
  const { correct } = checkAnswer(typed, w.word);
  if (correct) setStatus($('tryFeedback'), 'Correct! Well done.', 'good');
  else setStatus($('tryFeedback'), `Good try! The correct spelling is “${w.word}”.`, 'bad');
}

document.querySelectorAll('input[name="level"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    level = radio.value;
    renderList();
  });
});

$('backBtn').addEventListener('click', () => {
  speech.stopSpeaking();
  showView('listView');
});
$('prevBtn').addEventListener('click', () => openWord(position - 1));
$('nextBtn').addEventListener('click', () => openWord(position + 1));
$('hearWord').addEventListener('click', () => speech.speak(speech.phrases.word(visible[position])));
$('hearMeaning').addEventListener('click', () => speech.speak(speech.phrases.meaning(visible[position])));
$('hearSentence').addEventListener('click', () => speech.speak(speech.phrases.sentence(visible[position])));
$('hearOrigin').addEventListener('click', () => speech.speak(speech.phrases.origin(visible[position])));
$('tryBtn').addEventListener('click', tryWord);
$('tryInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') tryWord();
});
window.addEventListener('beforeunload', () => speech.stopSpeaking());

(async function init() {
  try {
    words = await loadFreeWords();
    renderList();
    showView('listView');
  } catch (e) {
    $('errorMsg').textContent =
      e instanceof TypeError ? 'Could not load the words. Check your connection and refresh.' : e.message;
    showView('error');
  }
})();