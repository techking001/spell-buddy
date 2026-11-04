import { getSettings } from './storage.js';

// Every box where a pupil types a spelling must not help them.
// Use the class "answer" on any such input and this file protects it.
//
// Honest limit: these are hints to the browser and the keyboard. iPhone Safari follows them.
// Several Android keyboards (Gboard, Samsung, SwiftKey) can ignore them, which is why there is
// also an optional "Hide word suggestions" switch in Settings (see hideKeyboardSuggestions).
const ATTRS = {
  type: 'text', // a normal text box, so the normal keyboard is used
  autocomplete: 'off',
  autocorrect: 'off',
  autocapitalize: 'off',
  spellcheck: 'false',
  'aria-autocomplete': 'none',
  // Password managers and writing assistants (for example Grammarly) should leave this box alone too.
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-form-type': 'other',
  'data-gramm': 'false',
  'data-gramm_editor': 'false',
  'data-enable-grammarly': 'false',
};

export function protectSpellingInput(input, { hideSuggestions = false } = {}) {
  Object.entries(ATTRS).forEach(([name, value]) => input.setAttribute(name, value));
  input.spellcheck = false;
  // The optional switch asks Android keyboards for their "email" layout, which most of them
  // show without word suggestions. The letters stay the same; an @ key may appear.
  if (hideSuggestions) input.setAttribute('inputmode', 'email');
  else input.removeAttribute('inputmode');
}

export function protectSpellingInputs(root = document) {
  const hideSuggestions = !!getSettings().hideKeyboardSuggestions;
  root.querySelectorAll('input.answer').forEach((input) => protectSpellingInput(input, { hideSuggestions }));
}
