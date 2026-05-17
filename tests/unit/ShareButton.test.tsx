import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShareButton } from '@/components/ShareButton';

describe('ShareButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => {}) },
      share: undefined,
    });
  });

  it('copies URL via clipboard when Web Share API unavailable', async () => {
    render(<ShareButton url="https://isitsmut.com/r/fourth-wing-yarros-2023" title="Fourth Wing" />);
    await userEvent.click(screen.getByRole('button', { name: /share|copy link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://isitsmut.com/r/fourth-wing-yarros-2023');
  });

  it('calls navigator.share when available', async () => {
    const share = vi.fn(async () => {});
    Object.assign(navigator, { share });
    render(<ShareButton url="https://isitsmut.com/r/x" title="X" />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(share).toHaveBeenCalledWith({ url: 'https://isitsmut.com/r/x', title: 'Is "X" smut?' });
  });
});
