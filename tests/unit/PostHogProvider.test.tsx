import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mutable vars so individual tests can vary pathname / search params
let mockPathname = '/';
let mockSearchParams = new URLSearchParams('');

vi.mock('posthog-js', () => ({ default: { __loaded: false, init: vi.fn(), capture: vi.fn() } }));
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

import posthog from 'posthog-js';
import { PostHogProvider } from '@/components/PostHogProvider';

const ph = posthog as unknown as { init: ReturnType<typeof vi.fn>; capture: ReturnType<typeof vi.fn>; __loaded: boolean };

beforeEach(() => {
  vi.clearAllMocks();
  // Reset navigation defaults
  mockPathname = '/';
  mockSearchParams = new URLSearchParams('');
  // Reset __loaded so the init guard behaves correctly for existing tests
  ph.__loaded = false;
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test';
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
});

describe('PostHogProvider', () => {
  it('initializes PostHog with persistent, privacy-lean options', () => {
    render(<PostHogProvider><div>child</div></PostHogProvider>);
    expect(ph.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: '/ingest',
        ui_host: 'https://us.posthog.com',
        persistence: 'localStorage',
        person_profiles: 'identified_only',
        autocapture: false,
        disable_session_recording: true,
        capture_pageview: false,
      }),
    );
  });

  it('renders its children', () => {
    const { getByText } = render(<PostHogProvider><div>child</div></PostHogProvider>);
    expect(getByText('child')).toBeInTheDocument();
  });

  it('captures $pageview with $current_url (pathname + query) when PostHog is loaded', () => {
    mockPathname = '/books';
    mockSearchParams = new URLSearchParams('q=fourth+wing');
    ph.__loaded = true;

    render(<PostHogProvider><div>child</div></PostHogProvider>);

    expect(ph.capture).toHaveBeenCalledWith('$pageview', {
      $current_url: '/books?q=fourth+wing',
    });
  });

  it('does NOT capture $pageview when PostHog is not yet loaded', () => {
    mockPathname = '/books';
    mockSearchParams = new URLSearchParams('q=fourth+wing');
    // ph.__loaded is already false from beforeEach

    render(<PostHogProvider><div>child</div></PostHogProvider>);

    expect(ph.capture).not.toHaveBeenCalled();
  });
});
