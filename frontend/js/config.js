export const DAILY_GOAL_WORDS = 10;
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'];

// Chance that the computer spells a word correctly, by computer level and by word difficulty.
// thinkMs = how long it "thinks" before showing its answer (min, max in milliseconds).
export const COMPUTER_LEVELS = {
  easy: { label: 'Easy', chance: { easy: 0.75, medium: 0.5, hard: 0.25 }, thinkMs: [1500, 3000] },
  medium: { label: 'Medium', chance: { easy: 0.92, medium: 0.7, hard: 0.5 }, thinkMs: [1500, 3000] },
  hard: { label: 'Hard', chance: { easy: 0.98, medium: 0.9, hard: 0.75 }, thinkMs: [1500, 3000] },
};
export const DEFAULT_COMPUTER_LEVEL = 'medium';