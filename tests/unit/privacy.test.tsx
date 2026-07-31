import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PrivacyPage from '@/app/privacy/page';

describe('PrivacyPage', () => {
  it('discloses the localStorage analytics identifier and interaction events', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/localStorage/i)).toBeInTheDocument();
  });

  it('discloses Google AdSense advertising with consent controls', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Google AdSense/i)).toBeInTheDocument();
    expect(screen.getByText(/consent banner/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /adssettings\.google\.com/i })).toHaveAttribute(
      'href',
      'https://adssettings.google.com'
    );
    expect(screen.getByText(/Last updated: 2026-07-30/i)).toBeInTheDocument();
  });

  it('no longer claims the site is ad-free', () => {
    render(<PrivacyPage />);
    expect(screen.queryByText(/don't use ads/i)).toBeNull();
  });
});
