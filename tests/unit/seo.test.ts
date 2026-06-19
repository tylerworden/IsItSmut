// tests/unit/seo.test.ts
import { describe, it, expect } from 'vitest';
import { SITE_URL, buildQuestionAnswer } from '@/lib/seo';
import type { Work, Rating } from '@/lib/types';

const work: Work = {
  slug: 'fourth-wing-yarros-2023',
  medium: 'book',
  title: 'Fourth Wing',
  creator: 'Rebecca Yarros',
  year: 2023,
};

const known: Extract<Rating, { known: true }> = {
  slug: work.slug, known: true, score: 8, verdict: "Yes, it's smut.",
  synopsis: 'War college for dragon riders.', details: 'Multiple scenes.',
  tags: ['Open door'], model: 'm', rated_at: '2026-01-01T00:00:00.000Z', view_count: 0,
};

describe('SITE_URL', () => {
  it('is the apex https origin with no trailing slash', () => {
    expect(SITE_URL).toBe('https://isitsmut.com');
  });
});

describe('buildQuestionAnswer', () => {
  it('produces a spoiler-safe Q&A line for a known rating', () => {
    expect(buildQuestionAnswer(work, known)).toBe(
      'Is Fourth Wing smut? Yes, it\'s smut. It scores 8/10 for sexual content.'
    );
  });
});
