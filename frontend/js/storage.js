const KEYS = { progress: 'sb_progress', settings: 'sb_settings' };
export const DEFAULT_SETTINGS = {
  voiceName: '',
  speechRate: 0.85,
  beeWordCount: 10,
  beeTimerSeconds: 30, // 0 = no timer
  beeMaxRepeats: 0, // 0 = unlimited
  beeAllowMeaning: true,
  beeAllowSentence: true,
  beeAllowOrigin: true,
};
const MAX_SESSIONS_KEPT = 50;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function getSettings() {
  const saved = read(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...(isPlainObject(saved) ? saved : {}) };
}

export function saveSettings(settings) {
  return write(KEYS.settings, settings);
}

export function resetSettings() {
  try {
    localStorage.removeItem(KEYS.settings);
  } catch {
    /* ignore */
  }
}

function emptyProgress() {
  return { sessions: [], mistakes: {}, totalCorrect: 0, totalAnswered: 0 };
}

export function getProgress() {
  const saved = read(KEYS.progress, null);
  if (!isPlainObject(saved) || !Array.isArray(saved.sessions) || !isPlainObject(saved.mistakes)) {
    return emptyProgress();
  }
  return { ...emptyProgress(), ...saved };
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEYS.progress);
  } catch {
    /* ignore */
  }
}

// session = { mode, difficulty, date, results: [{ id, correct }] }
export function recordSession(session) {
  const progress = getProgress();
  let correct = 0;

  session.results.forEach((r) => {
    progress.totalAnswered += 1;
    if (r.correct) {
      progress.totalCorrect += 1;
      correct += 1;
      delete progress.mistakes[r.id]; // answered correctly, so it leaves the mistakes list
    } else {
      progress.mistakes[r.id] = (progress.mistakes[r.id] || 0) + 1;
    }
  });

  progress.sessions.push({
    mode: session.mode,
    difficulty: session.difficulty,
    date: session.date,
    correct,
    total: session.results.length,
  });
  progress.sessions = progress.sessions.slice(-MAX_SESSIONS_KEPT);

  return write(KEYS.progress, progress);
}