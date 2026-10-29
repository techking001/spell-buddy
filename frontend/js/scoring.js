export const POINTS_PER_CORRECT = 1;

export function pointsFor(correct) {
  return correct ? POINTS_PER_CORRECT : 0;
}

export function totalPoints(results) {
  return results.reduce((sum, r) => sum + r.points, 0);
}