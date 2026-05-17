export function verdictFromScore(score: number): string {
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    throw new Error(`Score out of range: ${score}`);
  }
  if (score <= 3) return 'Not smut.';
  if (score <= 6) return 'A little spicy.';
  if (score <= 8) return "Yes, it's smut.";
  return 'Absolutely smut.';
}
