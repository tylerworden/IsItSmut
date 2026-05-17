// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runRate } from '@/lib/rate';
import * as claudeMod from '@/lib/claude';

const ratingsStore = new Map<string, unknown>();
const worksStore = new Map<string, unknown>();

vi.mock('@/lib/claude', () => ({
  callRate: vi.fn(),
  CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: (table: string) => {
      const store = table === 'ratings' ? ratingsStore : worksStore;
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => ({ data: store.get(val) ?? null, error: null }),
            single: async () => {
              const v = store.get(val);
              return v ? { data: v, error: null } : { data: null, error: { code: 'PGRST116' } };
            },
          }),
        }),
        upsert: (rows: unknown) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          arr.forEach((r: { slug: string }) => store.set(r.slug, r));
          return { error: null };
        },
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    },
    rpc: async () => ({ data: null, error: null }),
  }),
}));

describe('runRate', () => {
  beforeEach(() => {
    ratingsStore.clear();
    worksStore.clear();
    vi.clearAllMocks();
  });

  it('returns cached rating without calling Claude on cache hit', async () => {
    ratingsStore.set('fourth-wing-yarros-2023', {
      slug: 'fourth-wing-yarros-2023',
      known: true, score: 8, verdict: "Yes, it's smut.",
      synopsis: 's', details: 'd', tags: ['Open door', 'Enemies to lovers'],
      model: 'claude-haiku-4-5-20251001',
      rated_at: '2026-05-17T00:00:00Z',
      view_count: 5,
    });
    worksStore.set('fourth-wing-yarros-2023', {
      slug: 'fourth-wing-yarros-2023', medium: 'book',
      title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023,
    });
    const result = await runRate({
      slug: 'fourth-wing-yarros-2023',
      candidate: { title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' },
    });
    expect(result.cacheHit).toBe(true);
    expect(claudeMod.callRate).not.toHaveBeenCalled();
    expect(result.rating.known).toBe(true);
  });

  it('calls Claude on cache miss, writes works + ratings', async () => {
    vi.mocked(claudeMod.callRate).mockResolvedValueOnce({
      known: true, score: 7, verdict: "Yes, it's smut.",
      synopsis: 'syn', details: 'det', tags: ['Open door', 'Romance'],
    });
    const result = await runRate({
      slug: 'fourth-wing-yarros-2023',
      candidate: { title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' },
    });
    expect(result.cacheHit).toBe(false);
    expect(claudeMod.callRate).toHaveBeenCalledOnce();
    expect(worksStore.has('fourth-wing-yarros-2023')).toBe(true);
    expect(ratingsStore.has('fourth-wing-yarros-2023')).toBe(true);
    expect(result.rating.known).toBe(true);
  });

  it('persists known=false from Claude', async () => {
    vi.mocked(claudeMod.callRate).mockResolvedValueOnce({ known: false });
    const result = await runRate({
      slug: 'obscure-book-author-2024',
      candidate: { title: 'Obscure', creator: 'Some Author', year: 2024, medium: 'book' },
    });
    expect(result.rating.known).toBe(false);
    expect(ratingsStore.get('obscure-book-author-2024')).toMatchObject({ known: false });
  });
});
