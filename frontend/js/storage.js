const KEYS = { progress: 'sb_progress', settings: 'sb_settings', tour: 'sb_tour' };
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

// ---------- settings ----------
// Values that are not safely on disk yet (a change that is waiting to be saved, or a save that failed).
// They still apply straight away, so a change takes effect without waiting for the save.
let unsavedSettings = null;

export function getSettings() {
  const saved = read(KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...(isPlainObject(saved) ? saved : {}), ...(unsavedSettings || {}) };
}

// Applies a change immediately (in memory) without writing it yet.
export function previewSettings(patch) {
  unsavedSettings = { ...(unsavedSettings || {}), ...patch };
}

// Saves a change on top of the current settings, then reads it back to make sure it really stuck.
// Returns true only when the change is safely stored.
export function saveSettingsPatch(patch) {
  const next = { ...getSettings(), ...patch };
  if (!write(KEYS.settings, next)) {
    unsavedSettings = next; // keep applying it for this visit, but report the failure
    return false;
  }
  const back = read(KEYS.settings, null);
  const stuck = isPlainObject(back) && Object.keys(patch).every((k) => back[k] === patch[k]);
  if (stuck) unsavedSettings = null;
  else unsavedSettings = next;
  return stuck;
}

export function saveSettings(settings) {
  return saveSettingsPatch(settings);
}

export function resetSettings() {
  try {
    localStorage.removeItem(KEYS.settings);
    unsavedSettings = null;
    return true;
  } catch {
    unsavedSettings = { ...DEFAULT_SETTINGS };
    return false;
  }
}

// ---------- first-time walkthrough ----------
export function getTourState() {
  const s = read(KEYS.tour, null);
  return isPlainObject(s) ? s : null;
}

export function saveTourState(state) {
  return write(KEYS.tour, state);
}

// ---------- progress ----------
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

// Used by continuous Practice: saves each answer straight away.
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