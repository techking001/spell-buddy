import { getProgress } from './storage.js';

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function validDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Words practised today, counted from the sessions saved on this device.
export function wordsToday(progress = getProgress()) {
  const today = dayKey(new Date());
  return progress.sessions.reduce((sum, s) => {
    const d = validDate(s.date);
    return d && dayKey(d) === today ? sum + (Number(s.total) || 0) : sum;
  }, 0);
}

// Days in a row with at least one session. Today may still be empty without breaking the streak.
export function streakDays(progress = getProgress()) {
  const days = new Set();
  progress.sessions.forEach((s) => {
    const d = validDate(s.date);
    if (d) days.add(dayKey(d));
  });
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function accuracyPercent(progress = getProgress()) {
  return progress.totalAnswered ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100) : null;
}