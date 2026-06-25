import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  ANALYTICS_EVENTS: { shareClicked: 'share_clicked' },
}));

import { ShareButton } from '@/components/ShareButton';
import { track } from '@/lib/analytics';

describe('ShareButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => {}) },
      share: undefined,
    });
  });

  it('copies URL via clipboard when Web Share API unavailable', async () => {
    render(<ShareButton url="https://isitsmut.com/r/fourth-wing-yarros-2023" title="Fourth Wing" slug="fourth-wing-yarros-2023" />);
    await userEvent.click(screen.getByRole('button', { name: /share|copy link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://isitsmut.com/r/fourth-wing-yarros-2023');
  });

  it('tracks share_clicked with method=clipboard on the fallback path', async () => {
    render(<ShareButton url="https://isitsmut.com/r/x" title="X" slug="x" />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(track).toHaveBeenCalledWith('share_clicked', { slug: 'x', method: 'clipboard' });
  });

  it('tracks share_clicked with method=native when Web Share succeeds', async () => {
    const share = vi.fn(async () => {});
    Object.assign(navigator, { share });
    render(<ShareButton url="https://isitsmut.com/r/x" title="X" slug="x" />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(share).toHaveBeenCalledWith({ url: 'https://isitsmut.com/r/x', title: 'Is "X" smut?' });
    expect(track).toHaveBeenCalledWith('share_clicked', { slug: 'x', method: 'native' });
  });

  it('does NOT copy or track when the native share is cancelled', async () => {
    // Simulate user cancelling the OS share sheet
    Object.assign(navigator, {
      share: vi.fn(async () => { throw new Error('cancel'); }),
    });
    render(<ShareButton url="https://isitsmut.com/r/x" title="X" slug="x" />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });
});
