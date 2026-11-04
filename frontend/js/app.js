import { renderNavigation } from './navigation.js';
import { watchProgressBar, ensureStyles, showToast } from './ui.js';
import { onSpeechNotice, isSpeechSupported, speak } from './pronunciation.js';
import { maybeStartTour, resumeTour } from './tour.js';
import { protectSpellingInputs } from './spelling-input.js';
import { mountKeyboards } from './keyboard.js';

// Each part is isolated, so one failing never stops the others.
function safely(label, fn) {
  try {
    const result = fn();
    if (result && typeof result.catch === 'function') result.catch((e) => console.warn(`Spell Buddy: ${label} failed.`, e));
  } catch (e) {
    console.warn(`Spell Buddy: ${label} failed.`, e);
  }
}

// "Listen" buttons read their instructions aloud when tapped (data-say holds the text).
function wireListenButtons() {
  document.querySelectorAll('[data-say]').forEach((btn) => {
    if (!isSpeechSupported()) {
      btn.hidden = true; // no voice on this device, so the button would do nothing
      return;
    }
    btn.addEventListener('click', () => speak(btn.dataset.say));
  });
}

safely('styles', ensureStyles);
safely('navigation', renderNavigation);
safely('progress bar', watchProgressBar);
safely('listen buttons', wireListenButtons);
safely('spelling boxes', protectSpellingInputs); // no autocorrect, spellcheck or suggestions hints on answer boxes
safely('keyboard', mountKeyboards); // the on-screen keyboard, on touch screens only (must run after the line above)
// Messages about voice problems (backup voice in use, voice could not play) appear on every page.
safely('voice messages', () => onSpeechNotice(({ message }) => showToast(message)));
safely('walkthrough', async () => {
  const resumed = await resumeTour(); // carry on if the tour moved to this page
  if (!resumed) await maybeStartTour(); // otherwise, first-time visitors see it on Home
});
