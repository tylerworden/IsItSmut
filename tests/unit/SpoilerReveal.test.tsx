import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { SpoilerReveal } from '@/components/SpoilerReveal';

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
});
