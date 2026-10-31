import { getSettings, saveSettingsPatch, previewSettings, resetSettings, DEFAULT_SETTINGS } from './storage.js';
import * as speech from './pronunciation.js';
import { icon } from './ui.js';
import { createAutosaver } from './autosave.js';
import { startTour } from './tour.js';

const $ = (id) => document.getElementById(id);

const clampRate = (n) => Math.min(1.2, Math.max(0.5, Number.isNaN(n) ? DEFAULT_SETTINGS.speechRate : n));
const NUMBER_FIELDS = { beeWordCount: [1, 30], beeTimerSeconds: [0, 300], beeMaxRepeats: [0, 10] };
const CHECK_FIELDS = ['beeAllowMeaning', 'beeAllowSentence', 'beeAllowOrigin'];

// ---------- save status ("Saving…", "Saved", or a problem) ----------
let hideTimer = null;

function renderStatus(state, label) {
  const bar = $('saveBar');
  const status = $('saveStatus');
  clearTimeout(hideTimer);
  bar.className = `save-bar ${state}`;
  $('retrySave').hidden = state !== 'error';
  status.textContent = '';
  if (state === 'idle') return;

  const text = {
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Couldn’t save this on your device. It works for now, but may be lost when you close the page.',
  }[state];
  const iconName = state === 'saved' ? 'check-circle' : state === 'error' ? 'info' : 'clock';
  const span = document.createElement('span');
  span.textContent = label || text;
  status.append(icon(iconName), span);
  if (state === 'saved') hideTimer = setTimeout(() => renderStatus('idle'), 2500);
}

const saver = createAutosaver({
  save: saveSettingsPatch,
  preview: previewSettings, // changes apply straight away, even before they are written
  onState: (state) => renderStatus(state),
  delay: 400,
});

// ---------- the form ----------
function readVoiceAndSpeed() {
  return { voiceName: $('voice').value, speechRate: clampRate(Number($('rate').value)) };
}

function fillForm(s) {
  $('rate').value = s.speechRate;
  $('rateOut').textContent = `${Number(s.speechRate).toFixed(2)}×`;
  Object.keys(NUMBER_FIELDS).forEach((id) => ($(id).value = s[id]));
  CHECK_FIELDS.forEach((id) => ($(id).checked = !!s[id]));
}

// Fills the voice list. This never saves anything, so a saved voice that is
// missing for now is kept, not replaced.
function fillVoices() {
  const select = $('voice');
  const saved = getSettings().voiceName;
  const voices = speech.listVoices();
  select.innerHTML = '';

  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = 'Automatic';
  select.appendChild(auto);
  voices.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})${v.localService ? '' : ' · needs internet'}`;
    select.appendChild(opt);
  });

  const missing = saved && !voices.some((v) => v.name === saved);
  if (missing) {
    const opt = document.createElement('option');
    opt.value = saved;
    opt.textContent = `${saved} (not available right now)`;
    select.appendChild(opt);
  }
  select.value = saved;

  let hint = '';
  if (missing) hint = `Your saved voice “${saved}” isn’t available right now. A backup voice is used, and your choice stays saved.`;
  else if (!voices.length) hint = 'No voices found yet. They may still be loading, or this device may not have any.';
  else if (voices.some((v) => !v.localService)) hint = 'Voices marked “needs internet” may stop working when your connection is poor.';
  $('voiceHint').textContent = hint;
  $('voiceHint').hidden = !hint;
}

if (!speech.isSpeechSupported()) {
  $('speechWarning').hidden = false;
  ['voice', 'rate', 'testBtn'].forEach((id) => ($(id).disabled = true));
}

speech.onVoicesReady(fillVoices);
fillForm(getSettings());

// ---------- every change saves by itself ----------
$('form').addEventListener('submit', (e) => e.preventDefault()); // pressing Enter must not reload the page

$('voice').addEventListener('change', () => saver.save({ voiceName: $('voice').value }, { immediate: true }));

$('rate').addEventListener('input', () => {
  const rate = clampRate(Number($('rate').value));
  $('rateOut').textContent = `${rate.toFixed(2)}×`;
  saver.save({ speechRate: rate }); // waits for a pause, so dragging the slider is one save
});

Object.entries(NUMBER_FIELDS).forEach(([id, [min, max]]) => {
  $(id).addEventListener('change', () => {
    const raw = $(id).value;
    const n = Number(raw);
    const value = raw === '' || Number.isNaN(n) ? DEFAULT_SETTINGS[id] : Math.min(max, Math.max(min, Math.round(n)));
    $(id).value = value; // shows the value after limits were applied
    saver.save({ [id]: value }, { immediate: true });
  });
});

CHECK_FIELDS.forEach((id) => {
  $(id).addEventListener('change', () => saver.save({ [id]: $(id).checked }, { immediate: true }));
});

$('retrySave').addEventListener('click', () => saver.retry());

// Nothing waiting to be saved is lost when the page is closed or hidden.
window.addEventListener('pagehide', () => saver.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saver.flush();
});

// ---------- buttons ----------
$('testBtn').addEventListener('click', () => {
  speech.speak('Welcome to Spell Buddy. Can you spell the word: because?', readVoiceAndSpeed());
});

$('resetBtn').addEventListener('click', () => {
  saver.clear();
  const ok = resetSettings();
  fillForm(DEFAULT_SETTINGS);
  fillVoices();
  renderStatus(ok ? 'saved' : 'error', ok ? 'Reset to defaults' : '');
});

$('tourBtn').addEventListener('click', () => startTour());