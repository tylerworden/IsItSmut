// tests/unit/prompts.test.ts
import { describe, it, expect } from 'vitest';
import { DISAMBIGUATE_SYSTEM_PROMPT, RATE_SYSTEM_PROMPT, buildRateUserMessage } from '@/lib/prompts';

describe('DISAMBIGUATE_SYSTEM_PROMPT', () => {
  it('instructs returning an empty array over guessing, and not guessing creators', () => {
    expect(DISAMBIGUATE_SYSTEM_PROMPT).toContain('empty candidates array');
    expect(DISAMBIGUATE_SYSTEM_PROMPT).toMatch(/wrong creator is worse than no match/i);
  });
});

describe('RATE_SYSTEM_PROMPT', () => {
  it('requires scoring recognized works and reserves known:false for unrecognized ones', () => {
    expect(RATE_SYSTEM_PROMPT).toMatch(/if you recognize the work[^.]*you must return known:true/i);
    expect(RATE_SYSTEM_PROMPT).toMatch(/known:false only when/i);
  });
  it('still defines the 1–10 scale and verdict mapping', () => {
    expect(RATE_SYSTEM_PROMPT).toContain('RATING SCALE (1–10, integer)');
    expect(RATE_SYSTEM_PROMPT).toContain("7–8 → \"Yes, it's smut.\"");
  });
});

describe('buildRateUserMessage', () => {
  it('formats the work line with year', () => {
    expect(buildRateUserMessage({ title: 'X', creator: 'Y', year: 2020, medium: 'book' }))
      .toBe('Rate: X (2020) — book, by Y');
  });
});
