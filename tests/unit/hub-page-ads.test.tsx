import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReactElement } from 'react';

vi.mock('@/lib/leaderboard', () => ({
  getRatingsByMedium: async () => [],
  getTamestRatings: async () => [],
  getTopRatings: async () => [],
}));

import BooksPage from '@/app/books/page';
import MoviesPage from '@/app/movies/page';
import TvPage from '@/app/tv/page';
import TamestPage from '@/app/tamest/page';
import TopPage from '@/app/top/page';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_SLOT_HUB', '2222222222');
});
afterEach(() => vi.unstubAllEnvs());

const pages: Array<[string, () => Promise<ReactElement>]> = [
  ['books', BooksPage],
  ['movies', MoviesPage],
  ['tv', TvPage],
  ['tamest', TamestPage],
  ['top', TopPage],
];

describe.each(pages)('%s hub page', (_name, Page) => {
  it('renders exactly one hub ad slot', async () => {
    const { container } = render(await Page());
    const units = container.querySelectorAll('ins.adsbygoogle');
    expect(units).toHaveLength(1);
    expect(units[0].getAttribute('data-ad-slot')).toBe('2222222222');
  });
});
