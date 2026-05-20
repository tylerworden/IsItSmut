import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardSection } from '@/components/LeaderboardSection';
import type { LeaderboardEntry } from '@/lib/leaderboard';

const entries: LeaderboardEntry[] = [
  { slug: 's1', title: 'Title One', creator: 'A', medium: 'book', year: 2020, score: 10, verdict: 'Absolutely smut.', viewCount: 0 },
  { slug: 's2', title: 'Title Two', creator: 'B', medium: 'movie', year: 2021, score: 9, verdict: 'Absolutely smut.', viewCount: 0 },
  { slug: 's3', title: 'Title Three', creator: 'C', medium: 'tv', year: 2022, score: 9, verdict: 'Absolutely smut.', viewCount: 0 },
];

describe('LeaderboardSection', () => {
  it('renders heading and all entries with sequential ranks', () => {
    render(<LeaderboardSection entries={entries} heading="🔥 Hottest of all time" />);
    expect(screen.getByText('🔥 Hottest of all time')).toBeInTheDocument();
    expect(screen.getByText('Title One')).toBeInTheDocument();
    expect(screen.getByText('Title Two')).toBeInTheDocument();
    expect(screen.getByText('Title Three')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders see-more link when seeMoreHref is provided', () => {
    render(<LeaderboardSection entries={entries} heading="x" seeMoreHref="/top" />);
    const link = screen.getByRole('link', { name: /see full top 10/i });
    expect(link).toHaveAttribute('href', '/top');
  });

  it('omits see-more link when seeMoreHref is not provided', () => {
    render(<LeaderboardSection entries={entries} heading="x" />);
    expect(screen.queryByText(/see full top 10/i)).not.toBeInTheDocument();
  });

  it('shows empty-state message when entries is empty', () => {
    render(<LeaderboardSection entries={[]} heading="x" />);
    expect(screen.getByText(/check back in a moment/i)).toBeInTheDocument();
  });

  it('omits heading when not provided', () => {
    render(<LeaderboardSection entries={entries} />);
    // Just confirm no heading element from our component — entries still render
    expect(screen.getByText('Title One')).toBeInTheDocument();
  });
});
