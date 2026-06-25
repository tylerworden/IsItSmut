import posthog from 'posthog-js';

export const ANALYTICS_EVENTS = {
  searchSubmitted: 'search_submitted',
  detailsRevealed: 'details_revealed',
  shareClicked: 'share_clicked',
  noScoreShown: 'no_score_shown',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * Fire a PostHog event. No-ops unless PostHog has finished init
 * (SSR, tests, missing key, and ad-blocked clients all safely skip).
 */
export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  if ((posthog as { __loaded?: boolean }).__loaded) {
    posthog.capture(event, properties);
  }
}
