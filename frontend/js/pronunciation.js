import { getSettings } from './storage.js';

export const isSpeechSupported = () => 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export function listVoices() {
  if (!isSpeechSupported()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
}

// Voices load late in some browsers, so the callback may run more than once.
export function onVoicesReady(callback) {
  callback();
  if (isSpeechSupported()) window.speechSynthesis.addEventListener('voiceschanged', callback);
}

function pickVoice(name) {
  const voices = listVoices();
  if (name) {
    const chosen = voices.find((v) => v.name === name);
    if (chosen) return chosen;
  }
  return voices.find((v) => v.lang === 'en-US') || voices.find((v) => v.lang === 'en-GB') || voices[0] || null;
}

// Resolves true when speech finished, false when it could not run.
// `override` lets the Settings page test values that are not saved yet.
export function speak(text, override = {}) {
  return new Promise((resolve) => {
    if (!isSpeechSupported() || !text) return resolve(false);
    try {
      const { voiceName, speechRate } = { ...getSettings(), ...override };
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(voiceName);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'en-US';
      }
      utterance.rate = Number(speechRate) || 0.85;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      resolve(false);
    }
  });
}

export function stopSpeaking() {
  try {
    if (isSpeechSupported()) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export const hasVerifiedOrigin = (w) =>
  !!(w.etymology && w.etymology.summary && w.etymology.verification_status === 'verified');

// Each phrase returns '' when that information is missing for a word.
export const phrases = {
  word: (w) => w.word,
  meaning: (w) => (w.definition ? `${w.word}. ${w.part_of_speech ? w.part_of_speech + '. ' : ''}${w.definition}` : ''),
  sentence: (w) => (w.example_sentence ? `Used in a sentence: ${w.example_sentence}` : ''),
  origin: (w) => (hasVerifiedOrigin(w) ? `Origin: ${w.etymology.summary}` : ''),
};