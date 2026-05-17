// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDisambiguate } from '@/lib/disambiguate';

vi.mock('@/lib/claude', () => ({
  callDisambiguate: vi.fn(async (_q: string) => ({
    candidates: [{ title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' }],
  })),
}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }),
}));

describe('runDisambiguate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('attaches a slug to each candidate', async () => {
    const result = await runDisambiguate('fourth wing');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].slug).toBe('fourth-wing-yarros-2023');
  });

  it('returns empty candidates when Claude returns none', async () => {
    const claude = await import('@/lib/claude');
    vi.mocked(claude.callDisambiguate).mockResolvedValueOnce({ candidates: [] });
    const result = await runDisambiguate('asdkjhasdkjhaskdjh');
    expect(result.candidates).toEqual([]);
  });
});
