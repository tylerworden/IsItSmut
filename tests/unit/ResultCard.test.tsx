import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  ANALYTICS_EVENTS: {
    detailsRevealed: 'details_revealed',
    shareClicked: 'share_clicked',
  },
}));

import { ResultCard } from '@/components/ResultCard';
import { track } from '@/lib/analytics';

const work = {
  slug: 'fourth-wing-yarros-2023',
  medium: 'book' as const,
  title: 'Fourth Wing',
  creator: 'Rebecca Yarros',
  year: 2023,
};

beforeEach(() => vi.clearAllMocks());

describe('ResultCard — known', () => {
  it('renders score, verdict, synopsis, tags, blurred details', () => {
    render(
      <ResultCard
        work={work}
        rating={{
          slug: work.slug, known: true, score: 8, verdict: "Yes, it's smut.",
          synopsis: 'War college for dragon riders.', details: 'Multiple scenes.',
          tags: ['Open door', 'Enemies to lovers'],
          model: 'm', rated_at: '0', view_count: 0,
        }}
        shareUrl="https://isitsmut.com/r/fourth-wing-yarros-2023"
      />
    );
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getAllByText(/yes, it's smut/i)).toHaveLength(2);
    expect(screen.getByText('Fourth Wing')).toBeInTheDocument();
    expect(screen.getByText(/is fourth wing smut\?/i)).toBeInTheDocument();
    expect(screen.getByText(/war college/i)).toBeInTheDocument();
    expect(screen.getByText('Open door')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tap to reveal/i })).toBeInTheDocument();
  });
});

describe('ResultCard — unknown', () => {
  it('renders helpful message and fires no_score_shown', () => {
    render(
      <ResultCard
        work={work}
        rating={{ slug: work.slug, known: false, model: 'm', rated_at: '0', view_count: 0 }}
        shareUrl="https://isitsmut.com/r/x"
      />
    );
    expect(screen.getByText(/don't have a reliable read/i)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('no_score_shown', {
      slug: 'fourth-wing-yarros-2023', title: 'Fourth Wing', medium: 'book',
    });
  });
});
