// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: async () => ({
            data:
              table === 'aliases' && val === 'blood-and-ash-armentrout-2020'
                ? { canonical_slug: 'from-blood-and-ash-armentrout-2020' }
                : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/rate', () => ({
  getCachedRating: vi.fn(async () => null),
  runRate: vi.fn(),
  bumpViewCount: vi.fn(async () => {}),
}));

vi.mock('@/lib/related', () => ({ getRelatedTitles: vi.fn(async () => []) }));

import ResultPage, { generateMetadata } from '@/app/r/[slug]/page';

const params = (slug: string) => Promise.resolve({ slug });

describe('alias redirect', () => {
  it('generateMetadata permanently redirects an alias slug to its canonical', async () => {
    await expect(generateMetadata({ params: params('blood-and-ash-armentrout-2020') })).rejects.toMatchObject({
      digest: expect.stringContaining('/r/from-blood-and-ash-armentrout-2020'),
    });
  });

  it('the page component also redirects the alias slug', async () => {
    await expect(
      ResultPage({ params: params('blood-and-ash-armentrout-2020'), searchParams: Promise.resolve({}) })
    ).rejects.toMatchObject({
      digest: expect.stringContaining('/r/from-blood-and-ash-armentrout-2020'),
    });
  });

  it('a slug that is neither a work nor an alias still returns not-found metadata', async () => {
    const m = await generateMetadata({ params: params('does-not-exist-anywhere') });
    expect(m).toEqual({ title: 'Not found — IsItSmut', robots: { index: false, follow: true } });
  });
});
