'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
    if (!key) return;
    if ((posthog as { __loaded?: boolean }).__loaded) return;
    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      autocapture: false,
      disable_session_recording: true,
      persistence: 'memory',
    });
  }, []);

  return <>{children}</>;
}
