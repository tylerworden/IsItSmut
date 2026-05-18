export function verdictFromScore(score: number): string {
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    throw new Error(`Score out of range: ${score}`);
  }
  if (score <= 3) return 'Not smut.';
  if (score <= 6) return 'A little spicy.';
  if (score <= 8) return "Yes, it's smut.";
  return 'Absolutely smut.';
}

// Compensates for the Haiku 4.5 rubric undershooting the mid band.
// Endpoints (1, 2, 9, 10) stay anchored; scores in [3, 8] bump up by 1.
export function adjustScore(raw: number): number {
  if (raw >= 3 && raw <= 8) return raw + 1;
  return raw;
}
