'use client';

import { useEffect } from 'react';
import { track, type AnalyticsEvent } from '@/lib/analytics';

type Props = {
  event: AnalyticsEvent;
  properties?: Record<string, unknown>;
};

/** Fires a single analytics event when it mounts. Renders nothing. */
export function TrackOnMount({ event, properties }: Props) {
  useEffect(() => {
    track(event, properties);
    // Fire once on mount; props are stable per render of the result page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
