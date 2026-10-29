import { getProgress } from './storage.js';
import { DAILY_GOAL_WORDS } from './config.js';
import { wordsToday, streakDays, accuracyPercent } from './stats.js';

const $ = (id) => document.getElementById(id);
const state = {
  level: document.querySelector('input[name="level"]:checked')?.value || 'mixed',
  computer: document.querySelector('input[name="computer"]:checked')?.value || 'medium',
};

function updateLinks() {
  const l = state.level;
  $('startBtn').href = `practice.html?difficulty=${l}`;
  $('tilePractice').href = `practice.html?difficulty=${l}`;
  $('tileBee').href = `bee.html?difficulty=${l}`;
  $('tileComputer').href = `bee.html?opponent=computer&computer=${state.computer}&difficulty=${l}`;
}

function renderStats() {
  const p = getProgress();

  const today = wordsToday(p);
  const pct = Math.min(100, Math.round((today / DAILY_GOAL_WORDS) * 100));
  $('goalFill').style.width = `${pct}%`;
  $('goalPct').textContent = `${pct}%`;
  $('goalTrack').setAttribute('aria-valuenow', String(pct));
  $('goalText').textContent =
    today >= DAILY_GOAL_WORDS
      ? `Goal reached! ${today} words practised today.`
      : today === 0
        ? `Practise ${DAILY_GOAL_WORDS} words today to reach your goal.`
        : `${today} of ${DAILY_GOAL_WORDS} words practised`;

  $('sAnswered').textContent = p.totalAnswered;
  const acc = accuracyPercent(p);
  $('sAccuracy').textContent = acc === null ? '—' : `${acc}%`;
  $('sStreak').textContent = streakDays(p);
  const missed = Object.keys(p.mistakes).length;
  $('sReview').textContent = missed;
  $('reviewBadge').hidden = missed === 0;
  $('reviewBadge').textContent = missed;
}

document.querySelectorAll('input[name="level"]').forEach((r) =>
  r.addEventListener('change', () => {
    state.level = r.value;
    updateLinks();
  })
);
document.querySelectorAll('input[name="computer"]').forEach((r) =>
  r.addEventListener('change', () => {
    state.computer = r.value;
    updateLinks();
  })
);

updateLinks();
renderStats();