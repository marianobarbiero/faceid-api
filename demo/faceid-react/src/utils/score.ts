/** Converts the API similarity score (1 - distance) to a 0–100 percentage for display. */
export function scorePercent(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score * 100)));
}
