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

function applyAnswer(progress, { id, correct }) {
  progress.totalAnswered += 1;
  if (correct) {
    progress.totalCorrect += 1;
    delete progress.mistakes[id]; // answered correctly, so it leaves the mistakes list
  } else {
    progress.mistakes[id] = (progress.mistakes[id] || 0) + 1;
  }
}

function pushSession(progress, { mode, difficulty, date, correct, total }) {
  progress.sessions.push({ mode, difficulty, date, correct, total });
  progress.sessions = progress.sessions.slice(-MAX_SESSIONS_KEPT);
}

// Used by Spelling Bee: records a finished round in one go.
// session = { mode, difficulty, date, results: [{ id, correct }] }
export function recordSession(session) {
  const progress = getProgress();
  let correct = 0;
  session.results.forEach((r) => {
    applyAnswer(progress, r);
    if (r.correct) correct += 1;
  });
  pushSession(progress, { ...session, correct, total: session.results.length });
  return write(KEYS.progress, progress);
}

// Used by continuous Practice: saves each answer straight away,
// so nothing is lost if the pupil leaves the page at any moment.
export function recordAnswer(result) {
  const progress = getProgress();
  applyAnswer(progress, result);
  return write(KEYS.progress, progress);
}

// Adds one line to "Recent sessions" when a Practice session ends.
export function recordSessionEntry(entry) {
  const progress = getProgress();
  pushSession(progress, entry);
  return write(KEYS.progress, progress);
}