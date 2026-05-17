import { describe, it, expect } from 'vitest';
import { slugify, slugifyWithCollisionCheck } from '@/lib/slug';

describe('slugify', () => {
  it('produces title-lastname-year slug for a simple book', () => {
    expect(slugify({ title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023 }))
      .toBe('fourth-wing-yarros-2023');
  });
});

describe('slugify edge cases', () => {
  it('strips punctuation from title', () => {
    expect(slugify({ title: "It Ends with Us", creator: 'Colleen Hoover', year: 2016 }))
      .toBe('it-ends-with-us-hoover-2016');
  });

  it('handles accents and apostrophes', () => {
    expect(slugify({ title: "L'Étranger", creator: 'Albert Camus', year: 1942 }))
      .toBe('letranger-camus-1942');
  });

  it('omits year segment when year is null', () => {
    expect(slugify({ title: 'Unknown Work', creator: 'A. Person', year: null }))
      .toBe('unknown-work-person');
  });

  it('collapses multiple spaces', () => {
    expect(slugify({ title: '  Spaced   Out  ', creator: 'B. Author', year: 2020 }))
      .toBe('spaced-out-author-2020');
  });
});

describe('slugifyWithCollisionCheck', () => {
  it('returns base slug when no collision', async () => {
    const exists = async (_s: string) => false;
    await expect(
      slugifyWithCollisionCheck({ title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023 }, exists)
    ).resolves.toBe('fourth-wing-yarros-2023');
  });

  it('appends hash suffix when slug collides', async () => {
    const exists = async (s: string) => s === 'it-king-1986';
    const result = await slugifyWithCollisionCheck(
      { title: 'It', creator: 'Stephen King', year: 1986 },
      exists
    );
    expect(result).toMatch(/^it-king-1986-[a-f0-9]{4}$/);
  });
});
