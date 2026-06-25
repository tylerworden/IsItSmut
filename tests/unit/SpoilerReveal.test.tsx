import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  ANALYTICS_EVENTS: { detailsRevealed: 'details_revealed' },
}));

import { SpoilerReveal } from '@/components/SpoilerReveal';
import { track } from '@/lib/analytics';

beforeEach(() => vi.clearAllMocks());

describe('SpoilerReveal', () => {
  it('renders blurred content with reveal button by default', () => {
    render(<SpoilerReveal>secret content here</SpoilerReveal>);
    expect(screen.getByRole('button', { name: /tap to reveal/i })).toBeInTheDocument();
    expect(screen.getByText('secret content here')).toHaveAttribute('aria-hidden', 'true');
  });

  it('reveals content when tapped', async () => {
    render(<SpoilerReveal>secret content here</SpoilerReveal>);
    await userEvent.click(screen.getByRole('button', { name: /tap to reveal/i }));
    expect(screen.queryByRole('button', { name: /tap to reveal/i })).not.toBeInTheDocument();
    expect(screen.getByText('secret content here')).not.toHaveAttribute('aria-hidden');
  });

  it('tracks details_revealed with context when tapped', async () => {
    render(<SpoilerReveal slug="fourth-wing-yarros-2023" medium="book" score={8}>secret</SpoilerReveal>);
    await userEvent.click(screen.getByRole('button', { name: /tap to reveal/i }));
    expect(track).toHaveBeenCalledWith('details_revealed', {
      slug: 'fourth-wing-yarros-2023', medium: 'book', score: 8,
    });
  });
});
