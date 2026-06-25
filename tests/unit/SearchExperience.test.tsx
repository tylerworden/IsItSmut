import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  ANALYTICS_EVENTS: { searchSubmitted: 'search_submitted' },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { SearchExperience } from '@/components/SearchExperience';
import { track } from '@/lib/analytics';

beforeEach(() => {
  vi.clearAllMocks();
  // Resolve disambiguate to zero candidates so the handler short-circuits
  // to an error message and never navigates.
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [] }),
  })));
});
afterEach(() => vi.unstubAllGlobals());

describe('SearchExperience', () => {
  it('tracks search_submitted with the typed query on submit', async () => {
    render(<SearchExperience />);
    await userEvent.type(screen.getByRole('textbox', { name: /search/i }), 'Fourth Wing');
    await userEvent.click(screen.getByRole('button', { name: /find out/i }));
    expect(track).toHaveBeenCalledWith('search_submitted', { query: 'Fourth Wing' });
  });
});
