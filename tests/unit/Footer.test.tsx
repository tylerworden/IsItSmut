import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Footer } from '@/components/Footer';

describe('Footer', () => {
  it('renders disclaimer and nav links', () => {
    render(<Footer />);
    expect(screen.getByText(/AI-generated ratings/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Home$/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Top 10/i })).toHaveAttribute('href', '/top');
    expect(screen.getByRole('link', { name: /About/i })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: /Terms/i })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /Privacy/i })).toHaveAttribute('href', '/privacy');
  });

  it('links to the browse hub pages', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: 'Books' })).toHaveAttribute('href', '/books');
    expect(screen.getByRole('link', { name: 'Movies' })).toHaveAttribute('href', '/movies');
    expect(screen.getByRole('link', { name: 'TV' })).toHaveAttribute('href', '/tv');
  });
});
