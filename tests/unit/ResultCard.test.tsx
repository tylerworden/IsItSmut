import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResultCard } from '@/components/ResultCard';

const work = {
  slug: 'fourth-wing-yarros-2023',
  medium: 'book' as const,
  title: 'Fourth Wing',
  creator: 'Rebecca Yarros',
  year: 2023,
};

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
    // verdict appears in the header and in the Q&A line — confirm at least one
    expect(screen.getAllByText(/yes, it's smut/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Fourth Wing')).toBeInTheDocument();
    expect(screen.getByText(/is fourth wing smut\?/i)).toBeInTheDocument();
    expect(screen.getByText(/war college/i)).toBeInTheDocument();
    expect(screen.getByText('Open door')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tap to reveal/i })).toBeInTheDocument();
  });
});

describe('ResultCard — unknown', () => {
  it('renders helpful message for known=false', () => {
    render(
      <ResultCard
        work={work}
        rating={{ slug: work.slug, known: false, model: 'm', rated_at: '0', view_count: 0 }}
        shareUrl="https://isitsmut.com/r/x"
      />
    );
    expect(screen.getByText(/don't have a reliable read/i)).toBeInTheDocument();
  });
});
