import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowseList } from '@/components/BrowseList';
import type { LeaderboardEntry } from '@/lib/leaderboard';

const entries: LeaderboardEntry[] = [
  { slug: 'a', title: 'Alpha', creator: 'Auth', medium: 'book', year: 2020, score: 9, verdict: 'Absolutely smut.', viewCount: 0 },
];

describe('BrowseList', () => {
  it('renders the heading, intro, and a row linking to the result page', () => {
    render(<BrowseList heading="The Smuttiest Books" intro="Ranked 1–10." entries={entries} />);
    expect(screen.getByRole('heading', { level: 1, name: /smuttiest books/i })).toBeInTheDocument();
    expect(screen.getByText(/ranked 1–10/i)).toBeInTheDocument();
    expect(screen.getByText('Alpha').closest('a')).toHaveAttribute('href', '/r/a');
  });

  it('shows an empty-state message when there are no entries', () => {
    render(<BrowseList heading="The Smuttiest Movies" intro="x" entries={[]} />);
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });
});
