import { getSettings } from './storage.js';

const START_TIMEOUT_MS = 4000; // a voice that has not started by now is treated as failed (poor connection)
const END_BASE_MS = 3000; // extra time allowed on top of the estimated speaking time
const VOICES_WAIT_MS = 1500; // how long to wait for the voice list on a fresh page
const FAIL_COOLDOWN_MS = 30000; // a failing voice is skipped this long, then tried again
const NOTICE_GAP_MS = 20000; // the same message is not repeated more often than this
const MAX_ATTEMPTS = 2; // the chosen/best voice, then one backup. Never more.

export const isSpeechSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

const normLang = (l) => String(l || '').toLowerCase().replace('_', '-'); // Android reports "en_US"
const isEnglish = (v) => normLang(v.lang).startsWith('en');

// ---------- the list of voices ----------
let allVoices = [];
let gaveUp = false; // the wait for voices timed out once, so do not make every request wait again
let hooked = null;
const voiceListeners = new Set();
const readyWaiters = new Set();
const failures = new Map(); // voice name -> time of its last failure

function refreshVoices() {
  if (!isSpeechSupported()) {
    allVoices = [];
    return allVoices;
  }
  try {
    allVoices = Array.from(window.speechSynthesis.getVoices() || []);
  } catch {
    allVoices = [];
  }
  return allVoices;
}

function onVoicesChanged() {
  refreshVoices();
  failures.clear(); // a changed voice list is a fresh start: the saved voice gets another chance
  [...readyWaiters].forEach((fn) => fn());
  [...voiceListeners].forEach((fn) => {
    try {
      fn();
    } catch {
      /* a broken listener must not stop the others */
    }
  });
}

// Voices often arrive after the page has loaded, so listen for "voiceschanged".
function hook() {
  if (!isSpeechSupported()) return;
  const synth = window.speechSynthesis;
  if (hooked === synth) return;
  hooked = synth;
  try {
    synth.addEventListener('voiceschanged', onVoicesChanged);
  } catch {
    /* older browsers: the timeout below covers them */
  }
  refreshVoices();
}
hook();

function whenVoicesReady() {
  hook();
  refreshVoices();
  if (allVoices.length || gaveUp) return Promise.resolve();
  return new Promise((resolve) => {
    let timer;
    const done = () => {
      clearTimeout(timer);
      readyWaiters.delete(check);
      resolve();
    };
    const check = () => {
      if (allVoices.length) done();
    };
    timer = setTimeout(() => {
      gaveUp = true;
      done();
    }, VOICES_WAIT_MS);
    readyWaiters.add(check);
  });
}

export function listVoices() {
  hook();
  refreshVoices();
  return allVoices.filter(isEnglish);
}

export function findVoice(name) {
  if (!name) return null;
  return listVoices().find((v) => v.name === name) || null;
}

// Calls back now and every time the list of voices changes. Returns a function that stops listening.
export function onVoicesReady(callback) {
  hook();
  callback();
  voiceListeners.add(callback);
  return () => voiceListeners.delete(callback);
}

// ---------- messages for the pupil ----------
const noticeHandlers = new Set();
const lastNoticeAt = new Map();

function notify(type, message) {
  const now = Date.now();
  if (now - (lastNoticeAt.get(type) || 0) < NOTICE_GAP_MS) return;
  lastNoticeAt.set(type, now);
  noticeHandlers.forEach((h) => {
    try {
      h({ type, message });
    } catch {
      /* ignore */
    }
  });
}

export function onSpeechNotice(handler) {
  noticeHandlers.add(handler);
  return () => noticeHandlers.delete(handler);
}

function notifyFallback(voice, chosen, why) {
  const name = voice ? `“${voice.name}”` : 'your device’s default voice';
  if (!chosen) return notify('fallback', `The first voice didn’t play, so ${name} is being used for now.`);
  if (why === 'missing') {
    return notify('fallback', `Your chosen voice isn’t available right now, so ${name} is being used for now.`);
  }
  return notify('fallback', `Your chosen voice didn’t play, so ${name} is being used for now.`);
}

// ---------- choosing a voice ----------
const recentlyFailed = (v) => {
  const t = failures.get(v.name);
  return !!t && Date.now() - t < FAIL_COOLDOWN_MS;
};

// The order to try: the saved voice, then voices stored on the device (they work offline),
// then voices that need the internet, then the browser's own default (null).
// The saved preference itself is never changed here.
function buildCandidates(preferredName) {
  const english = allVoices.filter(isEnglish);
  const pref = preferredName ? english.find((v) => v.name === preferredName) || null : null;
  const lang = pref ? normLang(pref.lang) : 'en-us';
  const rank = (v) => {
    const l = normLang(v.lang);
    return l === lang ? 0 : l === 'en-us' ? 1 : l === 'en-gb' ? 2 : 3;
  };
  const ordered = (list) => [...list].sort((a, b) => rank(a) - rank(b));

  const list = [];
  const add = (v) => {
    if (v && !list.includes(v)) list.push(v);
  };
  if (pref && !recentlyFailed(pref)) add(pref);
  ordered(english.filter((v) => v.localService && !recentlyFailed(v))).forEach(add);
  ordered(english.filter((v) => !v.localService && !recentlyFailed(v))).forEach(add);
  list.push(null);
  return { list, pref };
}

// ---------- speaking ----------
let seq = 0;
let active = null;

const clampRate = (r) => {
  const n = Number(r);
  return Number.isFinite(n) ? Math.min(1.5, Math.max(0.3, n)) : 0.85;
};

function safeCancel() {
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

function clearTimers(req) {
  clearTimeout(req.startTimer);
  clearTimeout(req.endTimer);
  clearTimeout(req.delayTimer);
}

function finish(req, ok) {
  if (req.done) return;
  req.done = true;
  clearTimers(req);
  if (active === req) active = null;
  req.resolve(ok);
}

function handleError(req, code) {
  if (req.done) return;
  clearTimers(req);

  // Cancelled on purpose (a newer request or Stop): not a failure, so no backup voice and no message.
  if (code === 'interrupted' || code === 'canceled') return finish(req, false);

  // The browser needs a tap before it will speak: tell the pupil, do not retry.
  if (code === 'not-allowed') {
    notify('blocked', 'Tap the speaker button to hear the word.');
    return finish(req, false);
  }

  const bad = req.list[req.attempt];
  if (bad) failures.set(bad.name, Date.now());

  const next = req.attempt + 1;
  const retryable = code !== 'invalid-argument' && code !== 'text-too-long';
  if (retryable && next < MAX_ATTEMPTS && next < req.list.length) {
    safeCancel();
    notifyFallback(req.list[next], !!req.settings.voiceName, 'failed');
    return tryAttempt(req, next, true);
  }

  safeCancel();
  notify(
    'failed',
    allVoices.length
      ? 'The voice couldn’t play. Check your internet connection, or choose another voice in Settings.'
      : 'No voice was found on this device. Try another browser, or add a voice in your device settings.'
  );
  finish(req, false);
}

function tryAttempt(req, index, delayStart) {
  const voice = req.list[index] || null;
  const rate = clampRate(req.settings.speechRate);
  const u = new window.SpeechSynthesisUtterance(req.text);
  req.utter = u;
  req.attempt = index;
  req.started = false;

  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = 'en-US';
  }
  u.rate = rate;
  u.pitch = 1;
  u.volume = 1;

  const stale = () => req.done || req.utter !== u;

  u.onstart = () => {
    if (stale()) return;
    req.started = true;
    clearTimeout(req.startTimer);
    // Some browsers never send "end". If it is silent for long enough, treat the word as finished.
    const allowed = END_BASE_MS + (req.text.length * 120) / rate;
    req.endTimer = setTimeout(() => {
      if (stale()) return;
      safeCancel();
      finish(req, true);
    }, allowed);
  };
  u.onend = () => {
    if (stale()) return;
    finish(req, true);
  };
  u.onerror = (e) => {
    if (stale()) return;
    handleError(req, e && e.error);
  };

  const start = () => {
    if (stale()) return;
    try {
      const synth = window.speechSynthesis;
      if (synth.paused) synth.resume();
      synth.speak(u);
    } catch {
      return handleError(req, 'synthesis-failed');
    }
    req.startTimer = setTimeout(() => {
      if (stale() || req.started) return;
      handleError(req, 'start-timeout');
    }, START_TIMEOUT_MS);
  };

  // After a cancel some browsers drop an utterance that is queued in the same instant.
  if (delayStart) req.delayTimer = setTimeout(start, 60);
  else start();
}

function begin(req, delayStart) {
  refreshVoices();
  const { list, pref } = buildCandidates(req.settings.voiceName);
  req.list = list;
  const chosen = !!req.settings.voiceName;
  if (chosen && list[0] !== pref) notifyFallback(list[0], true, pref ? 'failed' : 'missing');
  tryAttempt(req, 0, delayStart);
}

// Speaks one piece of text. Resolves true when it played, false when it could not (or was replaced).
// Only one request is ever active: a new request replaces the old one.
export function speak(text, override = {}) {
  if (!isSpeechSupported() || !text) return Promise.resolve(false);
  hook();
  const synth = window.speechSynthesis;
  const settings = { ...getSettings(), ...override };
  const wasBusy = !!active || !!synth.speaking || !!synth.pending;
  if (active) finish(active, false);
  if (wasBusy) safeCancel();

  return new Promise((resolve) => {
    const req = { text: String(text), settings, resolve, done: false, list: [], attempt: 0, started: false, utter: null };
    active = req;
    const go = () => {
      if (!req.done) begin(req, wasBusy);
    };
    refreshVoices();
    // When voices are already known, start in the same tick so phones accept it as part of the tap.
    if (allVoices.length || gaveUp) go();
    else whenVoicesReady().then(go);
  });
}

export function stopSpeaking() {
  if (active) finish(active, false);
  if (isSpeechSupported()) safeCancel();
}

// ---------- word information ----------
export const hasVerifiedOrigin = (w) =>
  !!(w.etymology && String(w.etymology.summary || '').trim() && w.etymology.verification_status === 'verified');

// Each phrase returns '' when that information is missing for a word.
export const phrases = {
  word: (w) => w.word,
  meaning: (w) => (w.definition ? `${w.word}. ${w.part_of_speech ? w.part_of_speech + '. ' : ''}${w.definition}` : ''),
  sentence: (w) => (w.example_sentence ? `Used in a sentence: ${w.example_sentence}` : ''),
  origin: (w) => (hasVerifiedOrigin(w) ? `Origin: ${w.etymology.summary}` : ''),
};