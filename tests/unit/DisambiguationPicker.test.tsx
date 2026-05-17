import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DisambiguationPicker } from '@/components/DisambiguationPicker';

const candidates = [
  { slug: 'it-king-1986', title: 'It', creator: 'Stephen King', year: 1986, medium: 'book' as const },
  { slug: 'it-muschietti-2017', title: 'It', creator: 'Andy Muschietti', year: 2017, medium: 'movie' as const },
];

describe('DisambiguationPicker', () => {
  it('renders each candidate with title, creator, year, medium', () => {
    render(<DisambiguationPicker candidates={candidates} onPick={() => {}} />);
    expect(screen.getByText('Stephen King')).toBeInTheDocument();
    expect(screen.getByText('Andy Muschietti')).toBeInTheDocument();
    expect(screen.getByText('1986')).toBeInTheDocument();
    expect(screen.getByText('2017')).toBeInTheDocument();
  });

  it('calls onPick with the candidate when clicked', async () => {
    const onPick = vi.fn();
    render(<DisambiguationPicker candidates={candidates} onPick={onPick} />);
    await userEvent.click(screen.getByText('1986'));
    expect(onPick).toHaveBeenCalledWith(candidates[0]);
  });
});
