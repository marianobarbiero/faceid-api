/** Converts a cosine distance score to a 0–100 similarity percentage. */
export function scorePercent(score: number, threshold: number): number {
  return Math.max(0, Math.round((1 - score / threshold) * 100));
}
