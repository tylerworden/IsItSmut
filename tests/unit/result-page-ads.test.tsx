import { render } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { slug: 'test-book-2020', medium: 'book', title: 'Test Book', creator: 'A. Author', year: 2020 },
          }),
        }),
      }),
    }),
  }),
}));

const ratingHolder: { rating: Record<string, unknown> } = { rating: {} };
vi.mock('@/lib/rate', () => ({
  getCachedRating: async () => ratingHolder.rating,
  runRate: vi.fn(),
  bumpViewCount: async () => {},
}));

vi.mock('@/lib/related', () => ({ getRelatedTitles: async () => [] }));
vi.mock('@/components/ResultCard', () => ({ ResultCard: () => <div data-testid="result-card" /> }));
vi.mock('@/components/RelatedTitles', () => ({ RelatedTitles: () => <div data-testid="related" /> }));
vi.mock('@/components/JsonLd', () => ({ JsonLd: () => null }));

import ResultPage from '@/app/r/[slug]/page';

const baseRating = {
  slug: 'test-book-2020',
  score: 7,
  verdict: 'Steamy',
  synopsis: 's',
  details: 'd',
  tags: [],
  model: 'test-model',
  rated_at: '2026-01-01',
  view_count: 1,
};

const props = {
  params: Promise.resolve({ slug: 'test-book-2020' }),
  searchParams: Promise.resolve({}),
};

afterEach(() => vi.unstubAllEnvs());

describe('result page ad slot', () => {
  it('renders the ad below the card when the rating is known and ads are configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_SLOT_RESULT', '1111111111');
    ratingHolder.rating = { ...baseRating, known: true };
    const { container } = render(await ResultPage(props));
    const ins = container.querySelector('ins.adsbygoogle');
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute('data-ad-slot')).toBe('1111111111');
  });

  it('renders no ad on a no-score (known:false) page even when ads are configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_SLOT_RESULT', '1111111111');
    ratingHolder.rating = { ...baseRating, known: false };
    const { container } = render(await ResultPage(props));
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
  });

  it('renders no ad when env vars are unset', async () => {
    ratingHolder.rating = { ...baseRating, known: true };
    const { container } = render(await ResultPage(props));
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
  });
});
