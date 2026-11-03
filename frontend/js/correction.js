// The only feedback shown after a wrong answer: what the pupil wrote, and the correct spelling.
// Used by Practice, Spelling Bee / Play the Computer and Learn.
function item(className, label, value) {
  const box = document.createElement('div');
  box.className = `fix-item ${className}`;
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  if (value) {
    dd.textContent = value;
  } else {
    dd.textContent = 'No answer'; // the pupil submitted nothing (for example the Bee timer ran out)
    dd.className = 'fix-empty';
  }
  box.append(dt, dd);
  return box;
}

// host: the element to fill. answer: exactly what was typed. correct: the right spelling.
export function renderCorrection(host, answer, correct, { focus = true } = {}) {
  host.textContent = '';
  host.hidden = false;

  const list = document.createElement('dl');
  list.className = 'fix';
  list.append(item('fix-answer', 'Your Answer', answer), item('fix-correct', 'Correct Spelling', correct));
  host.appendChild(list);

  if (focus) {
    try {
      host.focus({ preventScroll: false }); // the answer box is locked, so move focus to the feedback
    } catch {
      /* ignore */
    }
  }
}

export function clearCorrection(host) {
  host.textContent = '';
  host.hidden = true;
}
