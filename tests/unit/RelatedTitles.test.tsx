// tests/unit/RelatedTitles.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RelatedTitles } from '@/components/RelatedTitles';
import type { LeaderboardEntry } from '@/lib/leaderboard';

const entries: LeaderboardEntry[] = [
  { slug: 'a', title: 'Alpha', creator: 'Auth', medium: 'book', year: 2020, score: 9, verdict: 'Absolutely smut.', viewCount: 0 },
];

describe('RelatedTitles', () => {
  it('renders links to related result pages with a hub link', () => {
    render(<RelatedTitles entries={entries} medium="book" />);
    expect(screen.getByText('Alpha').closest('a')).toHaveAttribute('href', '/r/a');
    expect(screen.getByRole('link', { name: /more books/i })).toHaveAttribute('href', '/books');
  });

  it('renders nothing when there are no related entries', () => {
    const { container } = render(<RelatedTitles entries={[]} medium="book" />);
    expect(container).toBeEmptyDOMElement();
  });
});
