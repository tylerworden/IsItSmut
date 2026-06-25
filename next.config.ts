import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reverse-proxy PostHog through our own domain so ad-blockers (which block
  // PostHog's hostnames) don't drop analytics — keeps visitor counts accurate.
  // The /static rule MUST come before the catch-all so the JS bundle resolves.
  async rewrites() {
    return [
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
    ];
  },
  // PostHog appends trailing slashes to some endpoints; don't redirect them away.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
