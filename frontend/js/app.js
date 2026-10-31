import { renderNavigation } from './navigation.js';
import { watchProgressBar, ensureStyles, showToast } from './ui.js';
import { onSpeechNotice } from './pronunciation.js';
import { maybeStartTour } from './tour.js';

// Each part is isolated, so one failing never stops the others.
function safely(label, fn) {
  try {
    const result = fn();
    if (result && typeof result.catch === 'function') result.catch((e) => console.warn(`Spell Buddy: ${label} failed.`, e));
  } catch (e) {
    console.warn(`Spell Buddy: ${label} failed.`, e);
  }
}

safely('styles', ensureStyles);
safely('navigation', renderNavigation);
safely('progress bar', watchProgressBar);
// Messages about voice problems (backup voice in use, voice could not play) appear on every page.
safely('voice messages', () => onSpeechNotice(({ message }) => showToast(message)));
safely('walkthrough', maybeStartTour);