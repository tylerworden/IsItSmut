import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PrivacyPage from '@/app/privacy/page';

describe('PrivacyPage', () => {
  it('discloses the localStorage analytics identifier and interaction events', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/localStorage/i)).toBeInTheDocument();
    expect(screen.getByText(/Last updated: 2026-06-24/i)).toBeInTheDocument();
  });
});
