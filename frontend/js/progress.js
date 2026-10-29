import { getProgress, clearProgress } from './storage.js';
import { loadFreeWords } from './words.js';
import { streakDays, accuracyPercent } from './stats.js';

const $ = (id) => document.getElementById(id);
const MODE_LABELS = { quick: 'Quick Practice', review: 'Review', bee: 'Spelling Bee', match: 'Vs Computer' };

let wordsById = {};
let wordsFailed = false;

function row(left, right) {
  const li = document.createElement('li');
  const a = document.createElement('span');
  const b = document.createElement('span');
  a.textContent = left;
  b.textContent = right;
  li.append(a, b);
  return li;
}

function shortDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function renderChart(sessions) {
  const host = $('recentChart');
  host.innerHTML = '';
  const last = sessions.slice(-10);
  host.hidden = last.length === 0;
  $('chartEmpty').hidden = last.length > 0;

  last.forEach((s) => {
    const total = Number(s.total) || 0;
    const pct = total ? Math.round(((Number(s.correct) || 0) / total) * 100) : 0;
    const col = document.createElement('div');
    col.className = 'col';
    col.setAttribute('role', 'img');
    col.setAttribute('aria-label', `${shortDate(s.date)} ${MODE_LABELS[s.mode] || 'Practice'}: ${s.correct} of ${s.total}, ${pct} percent`);

    const val = document.createElement('span');
    val.className = 'col-val';
    val.textContent = `${pct}%`;
    const wrap = document.createElement('div');
    wrap.className = 'col-wrap';
    const bar = document.createElement('div');
    bar.className = 'col-bar';
    bar.style.height = `${Math.max(pct, 4)}%`;
    wrap.appendChild(bar);
    const lab = document.createElement('span');
    lab.className = 'col-label';
    lab.textContent = shortDate(s.date);

    col.append(val, wrap, lab);
    host.appendChild(col);
  });
}

function renderModes(sessions) {
  const host = $('modeBars');
  host.innerHTML = '';
  const totals = {};
  sessions.forEach((s) => {
    const key = MODE_LABELS[s.mode] ? s.mode : 'quick';
    const t = (totals[key] = totals[key] || { correct: 0, total: 0 });
    t.correct += Number(s.correct) || 0;
    t.total += Number(s.total) || 0;
  });
  const keys = Object.keys(totals).filter((k) => totals[k].total > 0);
  $('modeEmpty').hidden = keys.length > 0;

  keys.forEach((k) => {
    const pct = Math.round((totals[k].correct / totals[k].total) * 100);
    const wrap = document.createElement('div');
    wrap.className = 'hbar-row';
    const top = document.createElement('div');
    top.className = 'hbar-top';
    const name = document.createElement('span');
    name.textContent = MODE_LABELS[k];
    const value = document.createElement('span');
    value.textContent = `${pct}%`;
    top.append(name, value);
    const track = document.createElement('div');
    track.className = 'bar purple';
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', `${MODE_LABELS[k]} accuracy ${pct} percent`);
    const fill = document.createElement('span');
    fill.className = 'bar-fill';
    fill.style.width = `${pct}%`;
    track.appendChild(fill);
    wrap.append(top, track);
    host.appendChild(wrap);
  });
}

function render() {
  const p = getProgress();
  $('statAnswered').textContent = p.totalAnswered;
  $('statCorrect').textContent = p.totalCorrect;
  const acc = accuracyPercent(p);
  $('statAccuracy').textContent = acc === null ? '—' : `${acc}%`;
  $('statStreak').textContent = streakDays(p);

  renderChart(p.sessions);
  renderModes(p.sessions);

  const recent = $('recentList');
  recent.innerHTML = '';
  p.sessions
    .slice(-10)
    .reverse()
    .forEach((s) => {
      const label = `${shortDate(s.date)} · ${MODE_LABELS[s.mode] || 'Practice'} · ${s.difficulty || 'mixed'}`;
      recent.appendChild(row(label, `${s.correct} / ${s.total}`));
    });
  $('recentEmpty').hidden = p.sessions.length > 0;

  const mistakes = $('mistakeList');
  mistakes.innerHTML = '';
  let shown = 0;
  Object.entries(p.mistakes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, count]) => {
      const w = wordsById[id];
      if (!w) return;
      shown += 1;
      mistakes.appendChild(row(w.word, `missed ${count}×`));
    });
  $('mistakeEmpty').hidden = shown > 0;
  $('mistakeEmpty').textContent = wordsFailed
    ? 'Could not load word names. Refresh the page.'
    : 'No missed words right now. Keep practising!';
  $('reviewBtn').hidden = shown === 0;
}

$('resetBtn').addEventListener('click', () => {
  if (confirm('Erase all saved scores and missed words on this device?')) {
    clearProgress();
    render();
  }
});

(async function init() {
  try {
    const words = await loadFreeWords();
    wordsById = Object.fromEntries(words.map((w) => [w.id, w]));
  } catch {
    wordsFailed = true;
  }
  render();
})();