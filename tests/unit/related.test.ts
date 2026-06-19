// tests/unit/related.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { supabaseMock, limitMock } = vi.hoisted(() => {
  const limit = vi.fn();
  return {
    limitMock: limit,
    supabaseMock: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
    },
  };
});
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: () => supabaseMock }));

import { getRelatedTitles } from '@/lib/related';

function row(slug: string, score = 8) {
  return { slug, score, view_count: 0, works: { title: slug, creator: 'A', medium: 'book', year: 2020 } };
}

describe('getRelatedTitles', () => {
  beforeEach(() => { limitMock.mockReset(); });

  it('excludes the current slug and filters by medium', async () => {
    limitMock.mockResolvedValueOnce({ data: [row('other')], error: null });
    const result = await getRelatedTitles('current', 'book', 4);
    expect(supabaseMock.eq).toHaveBeenCalledWith('works.medium', 'book');
    expect(supabaseMock.neq).toHaveBeenCalledWith('slug', 'current');
    expect(result.map((r) => r.slug)).toEqual(['other']);
  });

  it('returns [] on error', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    expect(await getRelatedTitles('s', 'book', 4)).toEqual([]);
  });
});
