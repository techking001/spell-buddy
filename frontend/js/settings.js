import { getSettings, saveSettings, resetSettings, DEFAULT_SETTINGS } from './storage.js';
import * as speech from './pronunciation.js';
import { icon } from './ui.js';

const $ = (id) => document.getElementById(id);

const clampRate = (n) => Math.min(1.2, Math.max(0.5, Number.isNaN(n) ? DEFAULT_SETTINGS.speechRate : n));

function clampInt(id, min, max, fallback) {
  const raw = $(id).value;
  const n = Number(raw);
  if (raw === '' || Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function readForm() {
  return {
    voiceName: $('voice').value,
    speechRate: clampRate(Number($('rate').value)),
    beeWordCount: clampInt('beeWordCount', 1, 30, DEFAULT_SETTINGS.beeWordCount),
    beeTimerSeconds: clampInt('beeTimerSeconds', 0, 300, DEFAULT_SETTINGS.beeTimerSeconds),
    beeMaxRepeats: clampInt('beeMaxRepeats', 0, 10, DEFAULT_SETTINGS.beeMaxRepeats),
    beeAllowMeaning: $('beeAllowMeaning').checked,
    beeAllowSentence: $('beeAllowSentence').checked,
    beeAllowOrigin: $('beeAllowOrigin').checked,
  };
}

function fillForm(s) {
  $('voice').value = s.voiceName;
  $('rate').value = s.speechRate;
  $('rateOut').textContent = `${Number(s.speechRate).toFixed(2)}×`;
  $('beeWordCount').value = s.beeWordCount;
  $('beeTimerSeconds').value = s.beeTimerSeconds;
  $('beeMaxRepeats').value = s.beeMaxRepeats;
  $('beeAllowMeaning').checked = !!s.beeAllowMeaning;
  $('beeAllowSentence').checked = !!s.beeAllowSentence;
  $('beeAllowOrigin').checked = !!s.beeAllowOrigin;
}

function flash(message, ok = true) {
  const el = $('flash');
  el.textContent = '';
  el.className = ok ? 'flash' : 'flash fail';
  if (!message) return;
  el.appendChild(icon(ok ? 'check-circle' : 'info'));
  const span = document.createElement('span');
  span.textContent = message;
  el.appendChild(span);
}

function fillVoices() {
  const select = $('voice');
  const wanted = select.value || getSettings().voiceName;
  select.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = 'Automatic';
  select.appendChild(auto);
  speech.listVoices().forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})`;
    select.appendChild(opt);
  });
  select.value = wanted;
}

if (!speech.isSpeechSupported()) {
  $('speechWarning').hidden = false;
  ['voice', 'rate', 'testBtn'].forEach((id) => ($(id).disabled = true));
}

speech.onVoicesReady(fillVoices);
fillForm(getSettings());

$('rate').addEventListener('input', () => {
  $('rateOut').textContent = `${clampRate(Number($('rate').value)).toFixed(2)}×`;
});

$('testBtn').addEventListener('click', () => {
  const s = readForm();
  speech.speak('Welcome to Spell Buddy. Can you spell the word: because?', s);
});

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const s = readForm();
  fillForm(s); // shows the values after limits were applied
  if (saveSettings(s)) flash('Saved');
  else flash('Could not save. Your browser may be blocking storage.', false);
});

$('resetBtn').addEventListener('click', () => {
  resetSettings();
  fillForm(DEFAULT_SETTINGS);
  flash('Reset to defaults');
});