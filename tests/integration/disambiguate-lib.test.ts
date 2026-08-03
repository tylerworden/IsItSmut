// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDisambiguate } from '@/lib/disambiguate';

vi.mock('@/lib/claude', () => ({
  callDisambiguate: vi.fn(async (_q: string) => ({
    candidates: [{ title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' }],
  })),
}));

const { existingWorks } = vi.hoisted(() => ({
  existingWorks: [] as Array<{ slug: string; medium: string }>,
}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: () => ({
      select: () => ({
        like: async (_col: string, pattern: string) => ({
          data: existingWorks.filter((w) => w.slug.startsWith(pattern.slice(0, -1))),
          error: null,
        }),
        eq: (_col: string, slug: string) => ({
          maybeSingle: async () => ({
            data: existingWorks.find((w) => w.slug === slug) ?? null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe('runDisambiguate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existingWorks.length = 0;
  });

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

  it('reuses the existing slug when the same work already exists', async () => {
    existingWorks.push({ slug: 'fourth-wing-yarros-2023', medium: 'book' });
    const result = await runDisambiguate('fourth wing');
    expect(result.candidates[0].slug).toBe('fourth-wing-yarros-2023');
  });

  it('reuses the existing slug when only the year differs (AI year wobble)', async () => {
    existingWorks.push({ slug: 'fourth-wing-yarros-2022', medium: 'book' });
    const result = await runDisambiguate('fourth wing');
    expect(result.candidates[0].slug).toBe('fourth-wing-yarros-2022');
  });

  it('hash-suffixes when the same slug belongs to a different medium', async () => {
    existingWorks.push({ slug: 'fourth-wing-yarros-2023', medium: 'movie' });
    const result = await runDisambiguate('fourth wing');
    expect(result.candidates[0].slug).toMatch(/^fourth-wing-yarros-2023-[0-9a-f]{4}$/);
  });
});
