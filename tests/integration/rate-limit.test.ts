import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndIncrement, currentWindowStart } from '@/lib/rate-limit';

vi.mock('@/lib/supabase-server', () => {
  const rows = new Map<string, number>();
  return {
    supabaseServer: () => ({
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        if (name !== 'rate_limit_increment') throw new Error('unknown rpc');
        const key = `${args.p_ip_hash}|${args.p_window_start}`;
        const next = (rows.get(key) ?? 0) + 1;
        rows.set(key, next);
        return { data: next, error: null };
      }),
    }),
  };
});

describe('rate-limit', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rounds window_start to the hour', () => {
    const start = currentWindowStart(new Date('2026-05-17T14:37:42Z'));
    expect(start.toISOString()).toBe('2026-05-17T14:00:00.000Z');
  });

  it('returns allowed for requests under limit', async () => {
    for (let i = 1; i <= 20; i++) {
      const result = await checkAndIncrement({ ipHash: 'abc', limit: 20 });
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(i);
    }
  });

  it('blocks the 21st request', async () => {
    for (let i = 1; i <= 20; i++) {
      await checkAndIncrement({ ipHash: 'def', limit: 20 });
    }
    const result = await checkAndIncrement({ ipHash: 'def', limit: 20 });
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(21);
  });
});
