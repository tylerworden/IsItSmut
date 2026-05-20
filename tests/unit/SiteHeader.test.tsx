import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteHeader } from '@/components/SiteHeader';

describe('SiteHeader', () => {
  it('renders the wordmark wrapped in a link to /', () => {
    render(<SiteHeader />);
    const link = screen.getByRole('link', { name: /Is It Smut\?/i });
    expect(link).toHaveAttribute('href', '/');
  });
});
