// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/rate', () => ({
  getCachedRating: vi.fn(),
  runRate: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkAndIncrement: vi.fn(async () => ({ allowed: true, count: 1 })),
}));

vi.mock('@/lib/hash', () => ({ hashIp: () => 'hash' }));

vi.mock('@/lib/captcha-cookie', async () => {
  const actual = await vi.importActual<typeof import('@/lib/captcha-cookie')>('@/lib/captcha-cookie');
  return { ...actual, verifyCookieValue: () => null };
});

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }),
}));

import { POST } from '@/app/api/rate/route';
import * as rateMod from '@/lib/rate';
import * as rl from '@/lib/rate-limit';

beforeEach(() => { vi.clearAllMocks(); process.env.RATE_LIMIT_SALT = 'salt'; });

describe('POST /api/rate', () => {
  function req(body: unknown) {
    return new Request('http://localhost/api/rate', {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    });
  }

  it('returns 400 without slug or candidate', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('returns cached rating without calling rate limiter', async () => {
    vi.mocked(rateMod.getCachedRating).mockResolvedValueOnce({
      slug: 's', known: true, score: 5, verdict: 'A little spicy.',
      synopsis: 'a', details: 'b', tags: ['x'], model: 'm', rated_at: '0', view_count: 0,
    } as never);
    const res = await POST(req({ slug: 's', candidate: { title: 't', creator: 'c', year: 2020, medium: 'book' } }));
    expect(res.status).toBe(200);
    expect(rl.checkAndIncrement).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.cacheHit).toBe(true);
  });

  it('calls rate limiter on cache miss', async () => {
    vi.mocked(rateMod.getCachedRating).mockResolvedValueOnce(null);
    vi.mocked(rateMod.runRate).mockResolvedValueOnce({
      cacheHit: false,
      rating: { slug: 's', known: false, model: 'm', rated_at: '0', view_count: 0 } as never,
    });
    const res = await POST(req({ slug: 's', candidate: { title: 't', creator: 'c', year: 2020, medium: 'book' } }));
    expect(res.status).toBe(200);
    expect(rl.checkAndIncrement).toHaveBeenCalledOnce();
  });

  it('returns 429 when over rate limit on miss', async () => {
    vi.mocked(rateMod.getCachedRating).mockResolvedValueOnce(null);
    vi.mocked(rl.checkAndIncrement).mockResolvedValueOnce({ allowed: false, count: 21 });
    const res = await POST(req({ slug: 's', candidate: { title: 't', creator: 'c', year: 2020, medium: 'book' } }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.needs_captcha).toBe(true);
  });
});
