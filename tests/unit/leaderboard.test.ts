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

import { getTopRatings } from '@/lib/leaderboard';

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
});
