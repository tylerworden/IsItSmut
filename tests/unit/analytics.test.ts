import { describe, it, expect, vi, beforeEach } from 'vitest';
import posthog from 'posthog-js';
import { track } from '@/lib/analytics';

vi.mock('posthog-js', () => ({ default: { __loaded: false, capture: vi.fn() } }));

const ph = posthog as unknown as { __loaded: boolean; capture: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  ph.__loaded = false;
});

describe('track', () => {
  it('does nothing when posthog is not loaded', () => {
    track('search_submitted', { query: 'x' });
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it('captures the event with properties when loaded', () => {
    ph.__loaded = true;
    track('search_submitted', { query: 'Fourth Wing' });
    expect(ph.capture).toHaveBeenCalledWith('search_submitted', { query: 'Fourth Wing' });
  });
});
