import { icon } from './ui.js';

// Draws the spelling correction for a wrong answer. Used by Practice, Spelling Bee and Learn.
// The letters are drawn in blocks of at most BLOCK letters, so long words wrap onto a second
// block instead of running off a narrow phone screen.
const BLOCK = 7;

const MARKS = {
  missing: { badge: '+', legend: 'missing letter (add it)' },
  extra: { badge: '−', legend: 'extra letter (take it out)' },
  substitute: { badge: '≠', legend: 'wrong letter' },
  swap: { badge: '⇄', legend: 'letters in the wrong order' },
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function cell(kind, letter, side) {
  const c = el('span', `lt lt-${kind}`);
  c.dataset.kind = kind;
  c.dataset.side = side;
  if (letter) {
    c.appendChild(el('span', 'ch', letter));
  } else {
    c.classList.add('lt-gap'); // an empty slot where a letter is missing or should be removed
  }
  if (kind !== 'match') {
    const mark = el('span', 'mk', MARKS[kind].badge); // a symbol as well as a colour, so colour is never the only clue
    mark.setAttribute('aria-hidden', 'true');
    c.appendChild(mark);
  }
  return c;
}

function row(cols, side) {
  const r = el('div', `fix-row fix-${side}`);
  r.style.setProperty('--cols', String(cols.length));
  cols.forEach((c) => r.appendChild(cell(c.kind, side === 'answer' ? c.a : c.c, side)));
  return r;
}

function plainRow(text, side) {
  const letters = Array.from(text);
  const r = el('div', `fix-row fix-${side}`);
  r.style.setProperty('--cols', String(Math.max(letters.length, 1)));
  letters.forEach((l) => r.appendChild(cell('match', l, side)));
  return r;
}

function chunks(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// host: the element to fill. result: the object from compareSpelling().
// options: { title, onHear, onSpell, focus }
// Returns { actions } so a page can add its own button (for example "Practise it again").
export function renderCorrection(host, result, options = {}) {
  const { title, onHear, onSpell, focus = true } = options;
  host.textContent = '';
  host.hidden = false;

  const box = el('div', 'fix');
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', 'Spelling correction');

  const heading = el('h3', 'fix-title');
  const badge = el('span', 'fb-ico');
  badge.appendChild(icon(result.status === 'empty' ? 'clock' : 'lightbulb'));
  heading.append(badge, el('span', undefined, title || (result.status === 'empty' ? 'No answer' : 'Not quite right')));
  box.appendChild(heading);

  // Short explanation first: the least reading needed.
  if (result.status === 'incorrect') box.appendChild(el('p', 'fix-explain', result.explanation));
  if (result.details && result.details.length) {
    const ul = el('ul', 'fix-details');
    result.details.forEach((d) => ul.appendChild(el('li', undefined, d)));
    box.appendChild(ul);
  }

  // Screen readers get the two spellings letter by letter. The coloured grid is for eyes only.
  const spoken = (t) => Array.from(t).join(' ');
  const sr = el('p', 'sr-only');
  sr.textContent =
    result.status === 'empty'
      ? `The correct spelling is ${spoken(result.correct)}.`
      : `Your answer: ${spoken(result.answer)}. Correct spelling: ${spoken(result.correct)}.`;
  box.appendChild(sr);

  const grid = el('div', 'fix-grid');
  grid.setAttribute('aria-hidden', 'true');
  const aligned = result.columns && result.columns.length;

  if (aligned) {
    chunks(result.columns, BLOCK).forEach((cols) => {
      const b = el('div', 'fix-block');
      b.append(el('p', 'fix-label', 'Your answer'), row(cols, 'answer'), el('p', 'fix-label', 'Correct spelling'), row(cols, 'correct'));
      grid.appendChild(b);
    });
  } else {
    if (result.status !== 'empty') {
      chunks(Array.from(result.answer), BLOCK).forEach((part, i) => {
        const b = el('div', 'fix-block');
        if (i === 0) b.appendChild(el('p', 'fix-label', 'Your answer'));
        b.appendChild(plainRow(part.join(''), 'answer'));
        grid.appendChild(b);
      });
    }
    chunks(Array.from(result.correct), BLOCK).forEach((part, i) => {
      const b = el('div', 'fix-block');
      if (i === 0) b.appendChild(el('p', 'fix-label', 'Correct spelling'));
      b.appendChild(plainRow(part.join(''), 'correct'));
      grid.appendChild(b);
    });
  }
  box.appendChild(grid);

  // The legend only lists the symbols that actually appear.
  const used = [...new Set((result.columns || []).map((c) => c.kind).filter((k) => k !== 'match'))];
  if (used.length) {
    const legend = el('p', 'fix-legend');
    used.forEach((k) => {
      const item = el('span', 'lg');
      const mk = el('span', 'mk', MARKS[k].badge);
      mk.setAttribute('aria-hidden', 'true');
      item.append(mk, document.createTextNode(` ${MARKS[k].legend}`));
      legend.appendChild(item);
    });
    box.appendChild(legend);
  }

  const actions = el('div', 'fix-actions');
  if (onHear) {
    const b = el('button', 'btn small');
    b.type = 'button';
    b.append(icon('volume'), el('span', undefined, 'Hear the word'));
    b.addEventListener('click', onHear);
    actions.appendChild(b);
  }
  if (onSpell) {
    const b = el('button', 'btn small');
    b.type = 'button';
    b.append(icon('type'), el('span', undefined, 'Hear it spelt out'));
    b.addEventListener('click', onSpell);
    actions.appendChild(b);
  }
  box.appendChild(actions);

  host.appendChild(box);
  if (focus) {
    try {
      host.focus({ preventScroll: false });
    } catch {
      /* ignore */
    }
  }
  return { actions };
}

export function clearCorrection(host) {
  host.textContent = '';
  host.hidden = true;
}
