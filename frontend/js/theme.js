
import { getSettings } from './storage.js';

const THEME_KEY = 'theme';

let mediaQuery = null;
let listening = false;

function getSelectedTheme() {
  const settings = getSettings();
  return ['system', 'light', 'dark'].includes(settings[THEME_KEY])
    ? settings[THEME_KEY]
    : 'system';
}

function applyResolvedTheme(choice) {
  const root = document.documentElement;

  const resolvedTheme = choice === 'system'
    ? (mediaQuery?.matches ? 'dark' : 'light')
    : choice;

  root.dataset.theme = resolvedTheme;
  root.dataset.themeChoice = choice;

  root.style.colorScheme = resolvedTheme;
}

export function applyTheme(choice = getSelectedTheme()) {
  if (!mediaQuery) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  }

  applyResolvedTheme(choice);

  if (!listening) {
    mediaQuery.addEventListener('change', () => {
      const currentChoice = getSelectedTheme();

      if (currentChoice === 'system') {
        applyResolvedTheme('system');
      }
    });

    listening = true;
  }
}
