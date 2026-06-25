import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('posthog-js', () => ({ default: { __loaded: false, init: vi.fn(), capture: vi.fn() } }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
}));

import posthog from 'posthog-js';
import { PostHogProvider } from '@/components/PostHogProvider';

const ph = posthog as unknown as { init: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
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
});
