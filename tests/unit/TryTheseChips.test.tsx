import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TryTheseChips } from '@/components/TryTheseChips';

describe('TryTheseChips', () => {
  it('renders the provided chips and calls onPick with the title', async () => {
    const onPick = vi.fn();
    render(<TryTheseChips items={['Fourth Wing', 'It Ends With Us', 'Bridgerton']} onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Fourth Wing' }));
    expect(onPick).toHaveBeenCalledWith('Fourth Wing');
  });
});
