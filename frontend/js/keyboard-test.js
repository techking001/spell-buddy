// A small test page: which input settings really hide keyboard word suggestions on a real phone?
const BASE = { type: 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false' };

const VARIANTS = [
  { id: 'A', title: 'A. What the app uses today', note: 'Normal keyboard, with the four standard settings.', set: {} },
  { id: 'B', title: 'B. Same, plus an “email-style” keyboard hint', note: 'Normal letters. An @ key may appear. This is the optional switch in Settings.', set: { inputmode: 'email' } },
  { id: 'C', title: 'C. Email field type', note: 'An email box. Letters work as normal.', set: { type: 'email' } },
  { id: 'D', title: 'D. Web address field type', note: 'A web address box. A .com key may appear.', set: { type: 'url' } },
  { id: 'E', title: 'E. Search field type', note: 'A search box.', set: { type: 'search' } },
  { id: 'F', title: 'F. Password field type (a control, not for the app)', note: 'Letters are hidden as dots. Only here to show whether suggestions can be turned off on this keyboard at all.', set: { type: 'password' } },
];

const ANSWERS = [
  ['none', 'No word suggestions'],
  ['shown', 'Suggestions still shown'],
  ['unsure', 'Not sure'],
];

const host = document.getElementById('variants');

VARIANTS.forEach((v) => {
  const card = document.createElement('section');
  card.className = 'card';

  const h = document.createElement('h2');
  h.textContent = v.title;
  const note = document.createElement('p');
  note.className = 'muted';
  note.textContent = v.note;

  const label = document.createElement('label');
  label.className = 'field';
  label.htmlFor = `kb-${v.id}`;
  label.textContent = 'Type “vege” here';
  const input = document.createElement('input');
  input.id = `kb-${v.id}`;
  input.className = 'answer';
  Object.entries({ ...BASE, ...v.set }).forEach(([k, val]) => input.setAttribute(k, val));

  const group = document.createElement('fieldset');
  group.className = 'opts';
  const legend = document.createElement('legend');
  legend.textContent = 'What did you see?';
  group.appendChild(legend);
  ANSWERS.forEach(([value, text]) => {
    const row = document.createElement('label');
    row.className = 'check-row';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `res-${v.id}`;
    radio.value = value;
    row.append(radio, document.createTextNode(` ${text}`));
    group.appendChild(row);
  });

  card.append(h, note, label, input, group);
  host.appendChild(card);
});

document.getElementById('reportBtn').addEventListener('click', () => {
  const lines = ['Spell Buddy keyboard test', `Device and browser: ${navigator.userAgent}`, `Screen: ${window.screen.width}x${window.screen.height}`, ''];
  VARIANTS.forEach((v) => {
    const chosen = document.querySelector(`input[name="res-${v.id}"]:checked`);
    const text = chosen ? ANSWERS.find((a) => a[0] === chosen.value)[1] : 'Not answered';
    lines.push(`${v.title}: ${text}`);
  });
  lines.push('', 'Keyboard used (for example Gboard / Samsung / SwiftKey / iPhone): ');
  const box = document.getElementById('report');
  box.value = lines.join('\n');
  box.focus();
  box.select();
});
