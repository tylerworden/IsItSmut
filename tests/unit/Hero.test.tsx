import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from '@/components/Hero';

describe('Hero', () => {
  it('renders the wordmark and tagline', () => {
    render(<Hero />);
    expect(screen.getByText('Is It Smut?')).toBeInTheDocument();
    expect(screen.getByText(/before you start chapter one/i)).toBeInTheDocument();
  });
});
