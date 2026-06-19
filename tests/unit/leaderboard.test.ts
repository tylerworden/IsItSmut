import { describe, it, expect, vi, beforeEach } from 'vitest';

const { supabaseMock, limitMock } = vi.hoisted(() => {
  const limit = vi.fn();
  return {
    limitMock: limit,
    supabaseMock: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
    },
  };
});

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => supabaseMock,
}));

import { getTopRatings, getRatingsByMedium, getTamestRatings } from '@/lib/leaderboard';

function row(opts: {
  slug: string;
  score: number;
  view_count?: number;
  title?: string;
  creator?: string;
  medium?: 'book' | 'movie' | 'tv';
  year?: number | null;
}) {
  return {
    slug: opts.slug,
    score: opts.score,
    view_count: opts.view_count ?? 0,
    works: {
      title: opts.title ?? opts.slug,
      creator: opts.creator ?? 'Author',
      medium: opts.medium ?? 'book',
      year: opts.year ?? 2020,
    },
  };
}

describe('getTopRatings', () => {
  beforeEach(() => { limitMock.mockReset(); });

  it('returns entries sorted by adjusted score descending', async () => {
    limitMock.mockResolvedValueOnce({
      data: [
        row({ slug: 'c', score: 10 }),
        row({ slug: 'a', score: 9 }),
        row({ slug: 'b', score: 8 }),
      ],
      error: null,
    });
    const result = await getTopRatings(10);
    expect(result.map((r) => r.slug)).toEqual(['c', 'a', 'b']);
    expect(result.map((r) => r.score)).toEqual([10, 9, 9]); // raw 10→10, raw 9→9, raw 8→9
  });

  it('breaks ties on adjusted score by view_count desc, then slug asc', async () => {
    // After adjustment, all three resolve to 9: raw 9→9, raw 8→9, raw 8→9
    limitMock.mockResolvedValueOnce({
      data: [
        row({ slug: 'm-zzz', score: 9, view_count: 10 }),
        row({ slug: 'a-aaa', score: 8, view_count: 50 }),
        row({ slug: 'a-bbb', score: 8, view_count: 50 }),
      ],
      error: null,
    });
    const result = await getTopRatings(10);
    // All adjusted to 9; tie broken first by view_count desc, then by slug asc
    expect(result.map((r) => r.slug)).toEqual(['a-aaa', 'a-bbb', 'm-zzz']);
  });

  it('returns [] when supabase returns an error', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const result = await getTopRatings(10);
    expect(result).toEqual([]);
  });

  it('returns [] when supabase returns null data', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await getTopRatings(10);
    expect(result).toEqual([]);
  });

  it('returns [] when getTopRatings throws (e.g., env var missing)', async () => {
    limitMock.mockRejectedValueOnce(new Error('connection refused'));
    const result = await getTopRatings(10);
    expect(result).toEqual([]);
  });
});

describe('getRatingsByMedium', () => {
  beforeEach(() => { limitMock.mockReset(); });
  it('filters by medium and returns adjusted entries (smuttiest first)', async () => {
    limitMock.mockResolvedValueOnce({
      data: [row({ slug: 'b1', score: 9, medium: 'book' }), row({ slug: 'b2', score: 8, medium: 'book' })],
      error: null,
    });
    const result = await getRatingsByMedium('book', 50);
    expect(supabaseMock.eq).toHaveBeenCalledWith('works.medium', 'book');
    expect(result.map((r) => r.score)).toEqual([9, 9]); // raw 9->9, raw 8->9
  });
});

describe('getTamestRatings', () => {
  beforeEach(() => { limitMock.mockReset(); });
  it('orders by adjusted score ascending', async () => {
    limitMock.mockResolvedValueOnce({
      data: [row({ slug: 'low', score: 1 }), row({ slug: 'mid', score: 5 }), row({ slug: 'hi', score: 9 })],
      error: null,
    });
    const result = await getTamestRatings(50);
    // Assert the DB sort direction too — the JS re-sort would otherwise mask a wrong DB order.
    expect(supabaseMock.order).toHaveBeenCalledWith('score', { ascending: true });
    expect(result.map((r) => r.slug)).toEqual(['low', 'mid', 'hi']); // adjusted 1,6,9
  });
});
