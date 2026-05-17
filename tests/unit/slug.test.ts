import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/slug';

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
