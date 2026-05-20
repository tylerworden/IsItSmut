import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import type { LeaderboardEntry } from '@/lib/leaderboard';

const sample: LeaderboardEntry = {
  slug: 'fourth-wing-yarros-2023',
  title: 'Fourth Wing',
  creator: 'Rebecca Yarros',
  medium: 'book',
  year: 2023,
  score: 9,
  verdict: 'Absolutely smut.',
  viewCount: 42,
};

describe('LeaderboardRow', () => {
  it('renders rank, title, creator/year/medium, and score', () => {
    render(<LeaderboardRow rank={1} entry={sample} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Fourth Wing')).toBeInTheDocument();
    expect(screen.getByText(/Rebecca Yarros/)).toBeInTheDocument();
    expect(screen.getByText(/2023/)).toBeInTheDocument();
    expect(screen.getByText(/Book/i)).toBeInTheDocument();
    expect(screen.getByText('9/10')).toBeInTheDocument();
  });

  it('wraps the row in a link to /r/{slug}', () => {
    render(<LeaderboardRow rank={1} entry={sample} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/r/fourth-wing-yarros-2023');
  });

  it('handles missing year gracefully', () => {
    render(<LeaderboardRow rank={2} entry={{ ...sample, year: null }} />);
    // No year segment, but creator and medium still render
    expect(screen.getByText(/Rebecca Yarros/)).toBeInTheDocument();
    expect(screen.getByText(/Book/i)).toBeInTheDocument();
  });
});
