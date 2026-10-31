import { getTourState, saveTourState } from './storage.js';
import { icon, ensureStyles } from './ui.js';

const VERSION = 1;
const MAX_AUTO_SHOWS = 2; // if it is ignored twice, stop showing it by itself

// page: highlights that page's menu link. target: highlights something on the page (found by CSS selector).
// Either one can be missing from a page. The step then simply shows its text.
const STEPS = [
  {
    icon: 'home',
    title: 'Welcome to Spell Buddy!',
    text: 'Listen to a word, spell it, and watch your skills grow. This quick tour shows you around.',
    target: '#startBtn',
  },
  {
    icon: 'zap',
    title: 'Practice',
    text: 'Tap the speaker to hear a word, then type your spelling. Practice keeps going until you press End session.',
    page: 'practice',
  },
  {
    icon: 'book-open',
    title: 'Learn',
    text: 'See each word’s meaning, syllables and example sentence before you practise.',
    page: 'learn',
  },
  {
    icon: 'rotate',
    title: 'Review Mistakes',
    text: 'Missed a word? On the Home page, Review Mistakes brings those words back so you can get them right.',
    target: '#tileReview',
  },
  {
    icon: 'trophy',
    title: 'Spelling Bee',
    text: 'Play it like a real contest: one try for each word. You can change the rules in Settings.',
    page: 'bee',
  },
  {
    icon: 'bot',
    title: 'Play the Computer',
    text: 'On the Home page, choose Play the Computer. You both spell the same words, and the higher score wins!',
    target: '#tileComputer',
  },
  {
    icon: 'bar-chart',
    title: 'Progress',
    text: 'See how many words you have practised, your accuracy and your streak.',
    page: 'progress',
  },
  {
    icon: 'sliders',
    title: 'Settings',
    text: 'Choose a voice and speaking speed. Your choices save automatically.',
    page: 'settings',
  },
];

let running = false;

const isHomePage = () => {
  const last = (location.pathname.split('/').pop() || '').replace('.html', '');
  return last === '' || last === 'index';
};

// Shows the tour by itself the first time someone opens the home page.
export async function maybeStartTour() {
  try {
    if (!isHomePage()) return;
    const state = getTourState();
    if (state && (state.status === 'completed' || state.status === 'skipped')) return;
    const shown = (state && Number(state.autoShown)) || 0;
    if (shown >= MAX_AUTO_SHOWS) return;
    // If nothing can be remembered on this device, do not nag.
    if (!saveTourState({ ...(state || {}), version: VERSION, autoShown: shown + 1 })) return;
    await startTour();
  } catch (e) {
    console.warn('Spell Buddy: the walkthrough could not start.', e);
  }
}

function findTarget(step) {
  try {
    if (step.page) return document.querySelector(`#nav-menu a[href="${step.page}.html"]`);
    if (step.target) return document.querySelector(step.target);
  } catch {
    /* an element that cannot be found is simply not highlighted */
  }
  return null;
}

const setMenu = (open) => document.dispatchEvent(new CustomEvent('sb:menu', { detail: { open } }));

// Starts (or restarts) the walkthrough. Safe to call from anywhere.
export async function startTour() {
  if (running) return;
  running = true;
  try {
    await ensureStyles();
    build();
  } catch (e) {
    running = false;
    console.warn('Spell Buddy: the walkthrough could not open.', e);
  }
}

function build() {
  const previousFocus = document.activeElement;
  let index = 0;
  let highlighted = null;

  const box = document.createElement('div');
  box.className = 'tour';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'false'); // the page stays usable
  box.setAttribute('aria-labelledby', 'tour-title');
  box.setAttribute('aria-describedby', 'tour-text');
  box.tabIndex = -1;

  const head = document.createElement('div');
  head.className = 'tour-head';
  const ico = document.createElement('span');
  ico.className = 'tour-ico';
  const title = document.createElement('h2');
  title.id = 'tour-title';
  head.append(ico, title);

  const text = document.createElement('p');
  text.id = 'tour-text';
  text.className = 'tour-text';
  text.setAttribute('aria-live', 'polite');

  const dots = document.createElement('div');
  dots.className = 'tour-dots';
  dots.setAttribute('aria-hidden', 'true');
  const dotEls = STEPS.map(() => {
    const d = document.createElement('span');
    d.className = 'tour-dot';
    dots.appendChild(d);
    return d;
  });
  const count = document.createElement('p');
  count.className = 'tour-count';

  const actions = document.createElement('div');
  actions.className = 'tour-actions';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'btn small ghost';
  skip.textContent = 'Skip tour';
  const spacer = document.createElement('span');
  spacer.className = 'spacer';
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'btn small';
  back.textContent = 'Back';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn small primary';
  actions.append(skip, spacer, back, next);

  box.append(head, text, dots, count, actions);
  document.body.appendChild(box);

  function clearHighlight() {
    if (highlighted) highlighted.classList.remove('tour-focus');
    highlighted = null;
  }

  function render() {
    const step = STEPS[index];
    const last = index === STEPS.length - 1;

    ico.textContent = '';
    ico.appendChild(icon(step.icon));
    title.textContent = step.title;
    text.textContent = step.text;
    count.textContent = `Step ${index + 1} of ${STEPS.length}`;
    dotEls.forEach((d, i) => d.classList.toggle('on', i === index));

    back.hidden = index === 0;
    skip.hidden = last;
    next.textContent = '';
    const label = document.createElement('span');
    label.textContent = last ? 'Finish' : 'Next';
    next.append(label, icon(last ? 'check' : 'arrow-right'));

    clearHighlight();
    setMenu(!!step.page); // on phones the menu opens so the link can be seen
    const target = findTarget(step);
    if (target) {
      target.classList.add('tour-focus');
      highlighted = target;
      if (!step.page && typeof target.scrollIntoView === 'function') {
        try {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch {
          /* ignore */
        }
      }
    }
  }

  function close(status) {
    document.removeEventListener('keydown', onKey);
    clearHighlight();
    setMenu(false);
    box.remove();
    running = false;
    saveTourState({ ...(getTourState() || {}), version: VERSION, status, finishedAt: new Date().toISOString() });
    try {
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    } catch {
      /* ignore */
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') close('skipped');
  }

  skip.addEventListener('click', () => close('skipped'));
  back.addEventListener('click', () => {
    if (index > 0) {
      index -= 1;
      render();
    }
  });
  next.addEventListener('click', () => {
    if (index >= STEPS.length - 1) return close('completed');
    index += 1;
    render();
  });
  document.addEventListener('keydown', onKey);

  render();
  box.focus();
}