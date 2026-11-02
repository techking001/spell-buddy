import { getTourState, saveTourState } from './storage.js';
import { icon, ensureStyles } from './ui.js';
import * as speech from './pronunciation.js';

const VERSION = 2;
const MAX_AUTO_SHOWS = 2; // if it is ignored twice, stop showing it by itself
const RESUME_KEY = 'sb_tour_resume'; // remembers the step while moving to another page

// target: the data-tour name of the thing to highlight.
// page: the page that target lives on (leave out when it is on every page).
// Students choose their difficulty when they start an activity, so these steps say so.
const STEPS = [
  {
    icon: 'home',
    title: 'Welcome to Spell Buddy!',
    text: 'Here you listen to words and learn to spell them. Let’s take a quick look around.',
    target: 'brand',
  },
  {
    icon: 'home',
    title: 'The Home page',
    text: 'This is the Home page. Pick what you want to do today.',
    target: 'activities',
    page: 'index',
  },
  {
    icon: 'zap',
    title: 'Practice',
    text: 'Tap Start practising. Choose Easy, Medium, Hard or Mixed. Then listen to the word and type it.',
    target: 'start-practising',
    page: 'index',
  },
  {
    icon: 'book-open',
    title: 'Learn',
    text: 'See what a word means, how to say it in parts, and an example sentence.',
    target: 'tile-learn',
    page: 'index',
  },
  {
    icon: 'trophy',
    title: 'Spelling Bee',
    text: 'You get one try for each word, like a real contest. You choose the difficulty before you start.',
    target: 'tile-bee',
    page: 'index',
  },
  {
    icon: 'bot',
    title: 'Play the Computer',
    text: 'You and the computer spell the same words. First choose the word difficulty. Then choose how strong the computer is.',
    target: 'tile-computer',
    page: 'index',
  },
  {
    icon: 'rotate',
    title: 'Review Mistakes',
    text: 'Practise the words you got wrong, until you get them right.',
    target: 'tile-review',
    page: 'index',
  },
  {
    icon: 'bar-chart',
    title: 'Progress',
    text: 'See how many words you got right and how you are improving.',
    target: 'nav-progress',
    menu: true,
  },
  {
    icon: 'sliders',
    title: 'Settings',
    text: 'Choose a voice and how fast it speaks. Your choices save by themselves.',
    target: 'nav-settings',
    menu: true,
  },
];

let running = false;

// Moving to another page. Tests replace this so no real page load is needed.
let navigate = (url) => window.location.assign(url);
export function setNavigator(fn) {
  navigate = fn;
}

const currentPage = () => (location.pathname.split('/').pop() || 'index').replace('.html', '') || 'index';

function rememberStep(index) {
  try {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ index }));
    return true;
  } catch {
    return false; // private mode or blocked storage: the walkthrough then stays on this page
  }
}

// Shows the tour by itself the first time someone opens the home page.
export async function maybeStartTour() {
  try {
    if (currentPage() !== 'index') return;
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

// Carries on after the walkthrough moved to another page. Returns true when it did.
export async function resumeTour() {
  let raw = null;
  try {
    raw = sessionStorage.getItem(RESUME_KEY);
    sessionStorage.removeItem(RESUME_KEY); // read once, so a refresh never repeats it
  } catch {
    return false;
  }
  if (!raw) return false;
  try {
    const index = Number(JSON.parse(raw).index);
    if (!Number.isInteger(index) || index < 0 || index >= STEPS.length) return false;
    await startTour({ index });
    return true;
  } catch {
    return false;
  }
}

const findTarget = (name) => {
  try {
    return document.querySelector(`[data-tour="${name}"]`);
  } catch {
    return null;
  }
};
const setMenu = (open) => document.dispatchEvent(new CustomEvent('sb:menu', { detail: { open } }));

// Starts (or restarts) the walkthrough. Safe to call from anywhere.
export async function startTour({ index = 0 } = {}) {
  if (running) return;
  running = true;
  try {
    await ensureStyles();
    build(index);
  } catch (e) {
    running = false;
    console.warn('Spell Buddy: the walkthrough could not open.', e);
  }
}

function build(startIndex) {
  const previousFocus = document.activeElement;
  let index = startIndex;
  let highlighted = null;
  let narrating = false;

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

  const hint = document.createElement('p');
  hint.className = 'tour-hint';
  hint.hidden = true;

  // Reading aloud only starts when the student taps this.
  const listenRow = document.createElement('div');
  listenRow.className = 'tour-listen';
  const listen = document.createElement('button');
  listen.type = 'button';
  listen.className = 'btn small';
  listenRow.appendChild(listen);
  listenRow.hidden = !speech.isSpeechSupported();

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

  box.append(head, text, hint, listenRow, dots, count, actions);
  document.body.appendChild(box);

  function setListenLabel() {
    listen.textContent = '';
    const label = document.createElement('span');
    label.textContent = narrating ? 'Stop' : 'Listen';
    listen.append(icon('volume'), label);
    listen.setAttribute('aria-pressed', String(narrating));
  }

  function stopNarration() {
    if (narrating) speech.stopSpeaking();
    narrating = false;
    setListenLabel();
  }

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
    setListenLabel();

    clearHighlight();
    setMenu(!!step.menu); // on phones the menu opens so the link can be seen
    const target = findTarget(step.target);
    if (target) {
      hint.hidden = true;
      target.classList.add('tour-focus');
      highlighted = target;
      if (!step.menu && typeof target.scrollIntoView === 'function') {
        try {
          target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch {
          /* ignore */
        }
      }
    } else {
      // The thing is genuinely not here (for example storage is blocked so we could not move pages).
      hint.hidden = !step.page;
      hint.textContent = step.page ? 'You can see this on the Home page.' : '';
    }
  }

  // Moves to a step. If the step belongs on another page, go there and carry on from the same step.
  function goTo(i) {
    stopNarration();
    const step = STEPS[i];
    if (step.page && step.page !== currentPage() && rememberStep(i)) {
      closeDialog();
      navigate(`${step.page}.html`);
      return;
    }
    index = i;
    render();
  }

  function closeDialog() {
    stopNarration();
    document.removeEventListener('keydown', onKey);
    clearHighlight();
    setMenu(false);
    box.remove();
    running = false;
  }

  function finish(status) {
    closeDialog();
    try {
      sessionStorage.removeItem(RESUME_KEY);
    } catch {
      /* ignore */
    }
    saveTourState({ ...(getTourState() || {}), version: VERSION, status, finishedAt: new Date().toISOString() });
    try {
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    } catch {
      /* ignore */
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') finish('skipped');
  }

  listen.addEventListener('click', () => {
    if (narrating) return stopNarration();
    narrating = true;
    setListenLabel();
    const step = STEPS[index];
    const myStep = index;
    speech.speak(`${step.title}. ${step.text}`).then(() => {
      if (narrating && index === myStep) {
        narrating = false;
        setListenLabel();
      }
    });
  });
  skip.addEventListener('click', () => finish('skipped'));
  back.addEventListener('click', () => index > 0 && goTo(index - 1));
  next.addEventListener('click', () => (index >= STEPS.length - 1 ? finish('completed') : goTo(index + 1)));
  document.addEventListener('keydown', onKey);

  render();
  box.focus();
}
