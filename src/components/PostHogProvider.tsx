'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

function PostHogPageView({ ready }: { ready: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Wait until posthog.init has completed. The provider's init effect runs
    // AFTER this child effect on first mount, so without this gate the very
    // first pageview of a session would be dropped. `ready` flips true via the
    // init `loaded` callback, which re-runs this effect and fires the initial
    // pageview.
    if (!ready) return;
    let url = pathname;
    const qs = searchParams.toString();
    if (qs) url = `${url}?${qs}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [ready, pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    if ((posthog as { __loaded?: boolean }).__loaded) {
      setReady(true);
      return;
    }
    posthog.init(key, {
      api_host: '/ingest',
      ui_host: 'https://us.posthog.com',
      capture_pageview: false,
      autocapture: false,
      disable_session_recording: true,
      persistence: 'localStorage',
      person_profiles: 'identified_only',
      loaded: () => setReady(true),
    });
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView ready={ready} />
      </Suspense>
      {children}
    </>
  );
}
