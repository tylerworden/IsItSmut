import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Footer } from '@/components/Footer';

describe('Footer', () => {
  it('renders disclaimer and nav links', () => {
    render(<Footer />);
    expect(screen.getByText(/AI-generated ratings/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /About/i })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: /Terms/i })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /Privacy/i })).toHaveAttribute('href', '/privacy');
  });
});
