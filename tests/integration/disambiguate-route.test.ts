// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/disambiguate', () => ({
  runDisambiguate: vi.fn(async (_q: string) => ({
    candidates: [{
      slug: 'fourth-wing-yarros-2023',
      title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book',
    }],
  })),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkAndIncrement: vi.fn(async () => ({ allowed: true, count: 1 })),
}));

vi.mock('@/lib/hash', () => ({ hashIp: () => 'hash' }));

vi.mock('@/lib/captcha-cookie', async () => {
  const actual = await vi.importActual<typeof import('@/lib/captcha-cookie')>('@/lib/captcha-cookie');
  return { ...actual, verifyCookieValue: () => null };
});

import { POST } from '@/app/api/disambiguate/route';
import * as rl from '@/lib/rate-limit';

beforeEach(() => { vi.clearAllMocks(); process.env.RATE_LIMIT_SALT = 'salt'; });

describe('POST /api/disambiguate', () => {
  function makeReq(body: unknown, headers: Record<string, string> = {}) {
    return new Request('http://localhost/api/disambiguate', {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...headers },
    });
  }

  it('returns 200 with candidates under rate limit', async () => {
    const res = await POST(makeReq({ query: 'fourth wing' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toHaveLength(1);
  });

  it('returns 429 with needs_captcha when over limit', async () => {
    vi.mocked(rl.checkAndIncrement).mockResolvedValueOnce({ allowed: false, count: 21 });
    const res = await POST(makeReq({ query: 'x' }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.needs_captcha).toBe(true);
  });

  it('returns 400 on missing query', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });
});
