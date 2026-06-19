// tests/unit/seo.test.ts
import { describe, it, expect } from 'vitest';
import { SITE_URL, buildQuestionAnswer, buildJsonLd, resultMetadata } from '@/lib/seo';
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

describe('buildJsonLd', () => {
  it('emits a Book with a nested Review for a known book', () => {
    const ld = buildJsonLd(work, known) as Record<string, unknown>;
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Book');
    expect(ld.name).toBe('Fourth Wing');
    expect(ld.author).toEqual({ '@type': 'Person', name: 'Rebecca Yarros' });
    expect(ld.datePublished).toBe('2023');
    const review = ld.review as Record<string, unknown>;
    expect(review['@type']).toBe('Review');
    expect(review.reviewRating).toEqual({
      '@type': 'Rating', ratingValue: 8, bestRating: 10, worstRating: 1,
    });
    expect((review.author as Record<string, unknown>).name).toBe('IsItSmut');
  });

  it('uses Movie/director and TVSeries/creator types', () => {
    const movie = buildJsonLd({ ...work, medium: 'movie' }, known) as Record<string, unknown>;
    expect(movie['@type']).toBe('Movie');
    expect(movie.director).toEqual({ '@type': 'Person', name: 'Rebecca Yarros' });
    const tv = buildJsonLd({ ...work, medium: 'tv' }, known) as Record<string, unknown>;
    expect(tv['@type']).toBe('TVSeries');
    expect(tv.creator).toEqual({ '@type': 'Person', name: 'Rebecca Yarros' });
  });

  it('omits datePublished when year is null', () => {
    const ld = buildJsonLd({ ...work, year: null }, known) as Record<string, unknown>;
    expect(ld.datePublished).toBeUndefined();
  });
});

describe('resultMetadata', () => {
  it('builds indexable metadata for a known rating', () => {
    const m = resultMetadata(work, known);
    expect(m.title).toBe('Is "Fourth Wing" Smut? Yes, it\'s smut. (8/10) — IsItSmut');
    expect(m.alternates?.canonical).toBe('/r/fourth-wing-yarros-2023');
    // robots undefined/index:true => indexable
    expect(m.robots).toBeUndefined();
    expect(m.openGraph?.title).toBe('Is "Fourth Wing" Smut? Yes, it\'s smut. (8/10) — IsItSmut');
    expect((m.twitter as { card?: string })?.card).toBe('summary_large_image');
    expect(typeof m.description).toBe('string');
    expect((m.description as string).length).toBeLessThanOrEqual(160);
  });

  it('noindexes an unknown rating but keeps a canonical', () => {
    const m = resultMetadata(work, { slug: work.slug, known: false, model: 'm', rated_at: '0', view_count: 0 });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.alternates?.canonical).toBe('/r/fourth-wing-yarros-2023');
    expect(m.title).toBe('Fourth Wing — IsItSmut');
  });
});
