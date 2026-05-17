import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/slug';

describe('slugify', () => {
  it('produces title-lastname-year slug for a simple book', () => {
    expect(slugify({ title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023 }))
      .toBe('fourth-wing-yarros-2023');
  });
});
