import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config';

describe('next.config — PostHog reverse proxy', () => {
  it('rewrites /ingest to PostHog US hosts, assets rule first', async () => {
    const rewrites = await nextConfig.rewrites!();
    expect(rewrites).toEqual([
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
    ]);
  });

  it('skips trailing-slash redirects (PostHog needs the raw path)', () => {
    expect(nextConfig.skipTrailingSlashRedirect).toBe(true);
  });
});
