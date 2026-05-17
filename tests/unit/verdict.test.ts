import { describe, it, expect } from 'vitest';
import { verdictFromScore } from '@/lib/verdict';

describe('verdictFromScore', () => {
  it.each([
    [1, 'Not smut.'],
    [3, 'Not smut.'],
    [4, 'A little spicy.'],
    [6, 'A little spicy.'],
    [7, "Yes, it's smut."],
    [8, "Yes, it's smut."],
    [9, 'Absolutely smut.'],
    [10, 'Absolutely smut.'],
  ])('score %i → "%s"', (score, expected) => {
    expect(verdictFromScore(score)).toBe(expected);
  });

  it('throws on out-of-range scores', () => {
    expect(() => verdictFromScore(0)).toThrow();
    expect(() => verdictFromScore(11)).toThrow();
  });
});
