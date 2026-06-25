import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  ANALYTICS_EVENTS: { noScoreShown: 'no_score_shown' },
}));

import { TrackOnMount } from '@/components/TrackOnMount';
import { track } from '@/lib/analytics';

beforeEach(() => vi.clearAllMocks());

describe('TrackOnMount', () => {
  it('fires the event once on mount with properties', () => {
    render(<TrackOnMount event="no_score_shown" properties={{ slug: 's', title: 'T', medium: 'book' }} />);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('no_score_shown', { slug: 's', title: 'T', medium: 'book' });
  });
});
