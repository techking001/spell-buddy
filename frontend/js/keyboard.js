import { icon } from './ui.js';

// One on-screen keyboard shared by Practice, Spelling Bee / Play the Computer and Learn.
// It exists so a phone's own predictive keyboard (which can suggest the correct spelling) is never used.
//
// How a page uses it: add an element like
//   <div id="kbHost" class="kb" data-keyboard-input="answer" data-keyboard-action="actionBtn" hidden></div>
// next to the answer box. data-keyboard-input is the id of the answer input; data-keyboard-action is the id
// of the page's own Check / Next button. The Enter key simply presses that button, so every mode keeps its
// own rules (scoring, locking, computer turns) without any extra code here.
//
// It only appears on touch screens (the main pointer is "coarse"). On a desktop the normal keyboard is used.
// For testing on a computer, add ?kb=on to the page link (or ?kb=off to force the normal keyboard).
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const MAX_LENGTH = 30;

export function keyboardWanted() {
  try {
    const forced = new URLSearchParams(location.search).get('kb');
    if (forced === 'on') return true;
    if (forced === 'off') return false;
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  } catch {
    return false;
  }
}

function makeKey(content, className, onPress, ariaLabel) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `kb-key ${className}`.trim();
  if (typeof content === 'string') b.textContent = content;
  else b.appendChild(content);
  if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
  b.addEventListener('click', onPress);
  b.addEventListener('mousedown', (e) => e.preventDefault()); // do not steal focus from the answer box
  // A visible "pressed" look on touch screens (the :hover state is not used).
  const down = () => b.classList.add('down');
  const up = () => b.classList.remove('down');
  b.addEventListener('pointerdown', down);
  ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach((t) => b.addEventListener(t, up));
  return b;
}

function mountOne(host) {
  const input = document.getElementById(host.dataset.keyboardInput);
  const action = document.getElementById(host.dataset.keyboardAction);
  if (!input || host.dataset.kbMounted) return;
  host.dataset.kbMounted = '1';

  // Stop the phone's own keyboard from opening. The letters come from the keys below instead.
  const before = { readOnly: input.readOnly, inputmode: input.getAttribute('inputmode') };
  input.readOnly = true;
  input.setAttribute('inputmode', 'none');
  if (!input.getAttribute('aria-label')) input.setAttribute('aria-label', 'Your spelling');

  const setValue = (v) => {
    input.value = v;
    input.scrollLeft = input.scrollWidth; // keep the newest letters in view
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const add = (ch) => {
    if (!input.disabled && input.value.length < MAX_LENGTH) setValue(input.value + ch);
  };
  const back = () => {
    if (!input.disabled) setValue(input.value.slice(0, -1));
  };
  const clear = () => {
    if (!input.disabled) setValue('');
  };

  const rows = document.createElement('div');
  rows.className = 'kb-rows';
  const letterKeys = [];

  ROWS.forEach((letters, i) => {
    const row = document.createElement('div');
    row.className = 'kb-row';
    if (i === 1) row.appendChild(Object.assign(document.createElement('span'), { className: 'kb-gap' }));
    if (i === 2) row.appendChild(makeKey('Clear', 'kb-wide kb-func', clear, 'Clear the answer'));
    for (const ch of letters) {
      const k = makeKey(ch.toUpperCase(), '', () => add(ch));
      letterKeys.push(k);
      row.appendChild(k);
    }
    if (i === 1) row.appendChild(Object.assign(document.createElement('span'), { className: 'kb-gap' }));
    if (i === 2) row.appendChild(makeKey(icon('arrow-left'), 'kb-wide kb-func kb-back', back, 'Backspace'));
    rows.appendChild(row);
  });

  // Enter = the page's own Check / Next button, with the same words and the same on/off state.
  const enter = makeKey('', 'kb-enter', () => {
    if (action && !action.disabled) action.click();
  });

  host.textContent = '';
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', 'Spelling keyboard');
  host.append(rows, enter);
  host.hidden = false;

  const syncEnter = () => {
    enter.textContent = ((action && action.textContent) || 'Check').trim();
    enter.disabled = !action || action.disabled;
  };
  // While the answer is locked (after answering) only the big Enter key is needed, so the letters fold away.
  const syncLocked = () => {
    const locked = input.disabled;
    host.classList.toggle('kb-locked', locked);
    host.querySelectorAll('.kb-rows .kb-key').forEach((k) => (k.disabled = locked));
  };
  syncEnter();
  syncLocked();

  const watchers = [];
  if (action) {
    const w = new MutationObserver(syncEnter);
    w.observe(action, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
    watchers.push(w);
  }
  const wi = new MutationObserver(syncLocked);
  wi.observe(input, { attributes: true, attributeFilter: ['disabled'] });
  watchers.push(wi);

  // A connected physical keyboard still works on a phone or tablet. (Enter is already handled by each page.)
  const onKeydown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[a-z]$/i.test(e.key)) {
      e.preventDefault();
      add(e.key.toLowerCase());
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      back();
    }
  };
  input.addEventListener('keydown', onKeydown);

  host._kbCleanup = () => {
    watchers.forEach((w) => w.disconnect());
    input.removeEventListener('keydown', onKeydown);
    input.readOnly = before.readOnly;
    if (before.inputmode === null) input.removeAttribute('inputmode');
    else input.setAttribute('inputmode', before.inputmode);
  };
}

function unmountOne(host) {
  if (!host.dataset.kbMounted) return;
  if (host._kbCleanup) host._kbCleanup();
  delete host.dataset.kbMounted;
  host.textContent = '';
  host.hidden = true;
}

// Called once from app.js. Pages that have no keyboard host are not affected.
export function mountKeyboards() {
  const hosts = [...document.querySelectorAll('[data-keyboard-input]')];
  if (!hosts.length) return;
  const apply = () => {
    const on = keyboardWanted();
    hosts.forEach((h) => (on ? mountOne(h) : unmountOne(h)));
    document.body.classList.toggle('kb-active', on);
  };
  apply();
  const mq = window.matchMedia && window.matchMedia('(pointer: coarse)');
  if (mq && mq.addEventListener) mq.addEventListener('change', apply);
}
