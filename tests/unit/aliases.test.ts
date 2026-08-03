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

import { getCanonicalSlug } from '@/lib/aliases';

describe('getCanonicalSlug', () => {
  it('returns the canonical slug for a merged-away alias', async () => {
    await expect(getCanonicalSlug('blood-and-ash-armentrout-2020')).resolves.toBe(
      'from-blood-and-ash-armentrout-2020'
    );
  });

  it('returns null when the slug is not an alias', async () => {
    await expect(getCanonicalSlug('fourth-wing-yarros-2023')).resolves.toBeNull();
  });
});
