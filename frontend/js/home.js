import { getProgress } from './storage.js';
import { DAILY_GOAL_WORDS } from './config.js';
import { wordsToday, streakDays, accuracyPercent } from './stats.js';

const $ = (id) => document.getElementById(id);

// The home page only shows progress. Choosing a difficulty now happens on each activity's own setup screen.
function renderStats() {
  const p = getProgress();

  const today = wordsToday(p);
  const pct = Math.min(100, Math.round((today / DAILY_GOAL_WORDS) * 100));
  $('goalFill').style.width = `${pct}%`;
  $('goalTrack').setAttribute('aria-valuenow', String(pct));
  $('goalText').textContent =
    today >= DAILY_GOAL_WORDS
      ? `Goal reached! ${today} words practised today.`
      : today === 0
        ? `Practise ${DAILY_GOAL_WORDS} words today to reach your goal.`
        : `${today} of ${DAILY_GOAL_WORDS} words practised today`;

  $('sAnswered').textContent = p.totalAnswered;
  const acc = accuracyPercent(p);
  $('sAccuracy').textContent = acc === null ? '—' : `${acc}%`;
  $('sStreak').textContent = streakDays(p);

  const missed = Object.keys(p.mistakes).length;
  $('reviewBadge').hidden = missed === 0;
  $('reviewBadge').textContent = missed;
  $('reviewBadge').setAttribute('aria-label', `${missed} words to review`);
}

renderStats();
