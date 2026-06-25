# IsItSmut.com — Analytics Instrumentation Design Spec (measurable traffic)

**Date:** 2026-06-24
**Status:** Approved, ready for implementation planning
**Domain:** isitsmut.com
**Relation to other work:** Prerequisite groundwork for **Ads** (the third sequenced effort, after SEO and Coverage, both done & live). Ad networks and the go/no-go on monetization are traffic-gated, but the site currently cannot report reliable usage numbers. This spec makes traffic measurable. The consent banner / CMP that ads require is **deliberately deferred to the Ads spec** (see Scope).

## Purpose

There is currently no reliable answer to "how many people use IsItSmut per day." Two reasons, both fixed here:

1. **PostHog can't count unique visitors.** `PostHogProvider.tsx` initializes with `persistence: 'memory'`, so the anonymous visitor ID lives only in tab memory and resets on every hard reload or new tab. Page-view *totals* are trustworthy; unique-visitor / DAU numbers are badly over-counted (one person looks like many).
2. **Result-page views are likely under-counted.** Searches reach `/r/[slug]` via client-side navigation (`router.push` in `SearchExperience`). PostHog's default `capture_pageview: true` does not reliably fire a `$pageview` on App Router in-app navigations, so the main path to result pages — through search — can be missed entirely.

On top of fixing those, the site captures **no interaction events**, so there's no funnel telling us whether visitors actually use the product (search → reveal → share) — the exact signal needed to judge the Ads question.

User's chosen direction (2026-06-24): switch to a persistent **localStorage** identifier (no cookie, no banner), disclose it in the privacy policy, fix SPA page-view capture, and add four custom events. The blocking consent banner is left for the Ads effort, where ad networks contractually require it.

## Background — what exists today

- **PostHog** (`src/components/PostHogProvider.tsx`): client-only, mounted at the root in `layout.tsx`. Config: `capture_pageview: true`, `autocapture: false`, `disable_session_recording: true`, `persistence: 'memory'`. Page-views only; no custom events anywhere in the codebase.
- **`ratings.view_count`** (Supabase): a per-title cumulative counter bumped on every `/r/[slug]` view via the `increment_view_count` RPC. All-time total per title — no time bucketing, no visitor identity. Useful for "most-viewed titles all-time"; useless for "users today." **Untouched by this spec.**
- **Rate-limit counters**: salted hash of IP, ephemeral, abuse-only. Not analytics. Untouched.
- **Cookies today:** only the short-lived captcha-bypass cookie (functional). No analytics cookie, no consent UI.

## Scope

### In scope
- **`PostHogProvider.tsx`**: `persistence: 'memory'` → `'localStorage'`; add `person_profiles: 'identified_only'`; keep `autocapture: false` and `disable_session_recording: true`. Add an App-Router page-view tracker so `$pageview` fires on every route change (fixes the SPA under-count).
- **New `src/lib/analytics.ts`**: a thin client helper `track(event, properties?)` guarded on PostHog being loaded, plus named event-name constants. Single point of contact with `posthog-js`.
- **New `<TrackOnMount>`** client component: fires a given event once on mount (for the server-rendered no-score branch).
- **Four custom events**, each fired at its real chokepoint (see Design C).
- **`src/app/privacy/page.tsx`**: disclose the persistent anonymous localStorage identifier (explicitly *not* a cookie) and the anonymous interaction events, including that the searched title text is captured. Bump "Last updated" to 2026-06-24.
- **Tests**: helper unit tests, provider-config test, and component/mount tests asserting events fire.

### Out of scope
- **Consent banner / CMP** — deferred to the **Ads** spec, where ad networks require it. The localStorage analytics identifier is disclosed in the privacy policy but not gated behind a banner (user's explicit decision).
- **Server-side event capture** (e.g. emitting `no_score_shown` from the rate route via the PostHog API). Client-side capture only; revisit if ad-blocking materially distorts the numbers.
- **The "0 candidates from disambiguate" miss** as its own event. `no_score_shown` covers the `known:false` *result page* only. The disambiguate-level "no confident match" path can be added later as a distinct event if the full miss funnel is wanted.
- **Reading PostHog numbers programmatically.** Numbers are viewed in the PostHog dashboard (filter `$host=isitsmut.com`). A PostHog *personal API key* (separate from the public ingest key in `.env.local`) could later let the assistant pull them; not part of this work.
- **`ratings.view_count`, rate-limiting, captcha, the `adjustScore` shim, the AI flow** — all untouched.

### Success criteria
- PostHog reports a **stable anonymous visitor ID across reloads** (unique-visitor / DAU counts become meaningful), verified by config + a live check on the deploy.
- A `$pageview` is recorded on **client-side navigations** to `/r/[slug]`, not just hard loads.
- The four events fire from real user interactions and arrive in PostHog with their properties.
- The privacy policy accurately reflects what is now stored and captured.
- All existing tests pass; new tests pass.

## Design

### A. Persistent, countable visitors (`src/components/PostHogProvider.tsx`)
- `persistence: 'localStorage'` — stable anonymous distinct_id across reloads/tabs, so PostHog dedupes returning visitors. Chosen over the `'localStorage+cookie'` default specifically to avoid writing a cookie, keeping the "we don't set analytics cookies" story honest and supporting the no-banner decision.
- `person_profiles: 'identified_only'` — anonymous events still carry the persistent distinct_id (so DAU/unique-visitor counts work), but no person-profile rows are created for anonymous users (cost-friendly, and we have no logins anyway).
- Keep `autocapture: false`, `disable_session_recording: true`, `capture_pageview` (see B).

### B. SPA page-view capture (`PostHogProvider.tsx`)
Add a `<PostHogPageView>` client component that reads `usePathname()` + `useSearchParams()` and calls `posthog.capture('$pageview')` on change. It is wrapped in `<Suspense>` (App Router requires `useSearchParams` consumers to be suspense-bounded) and rendered inside the provider. Set `capture_pageview: false` in `posthog.init` so the initial load isn't double-counted, since `<PostHogPageView>` fires on first mount too. Result-page URLs already carry `title`/`creator` in search params; capturing them in the `$pageview` is fine (they're already public in the URL).

### C. Custom events
A single helper keeps the vendor in one place:

```
// src/lib/analytics.ts (client)
export const ANALYTICS_EVENTS = {
  searchSubmitted: 'search_submitted',
  detailsRevealed: 'details_revealed',
  shareClicked: 'share_clicked',
  noScoreShown: 'no_score_shown',
} as const;

export function track(event, properties?) {
  // no-op unless posthog is loaded (SSR, tests, missing key all safely skip)
  if (posthog?.__loaded) posthog.capture(event, properties);
}
```

| Event | Fired in | Trigger | Properties |
|---|---|---|---|
| `search_submitted` | `SearchExperience.handleSearch` | top of the function (covers both typed searches and "Try these" chips, which call `handleSearch`) | `{ query }` |
| `details_revealed` | `SpoilerReveal` | existing `onClick` that reveals the blurred details | `{ slug, medium, score }` |
| `share_clicked` | `ShareButton.handleClick` | on click; `method` reflects which path ran | `{ slug, method: 'native' \| 'clipboard' }` |
| `no_score_shown` | `<TrackOnMount>` placed in `ResultCard`'s `!rating.known` branch | once on mount | `{ slug, title, medium }` |

Prop threading: `SpoilerReveal` and `ShareButton` currently receive only what they render; `ResultCard` (which has `work` + `rating` in scope) passes `slug`/`medium`/`score` (and `slug` to `ShareButton`) as new props so the events carry context. `<TrackOnMount>` is a small client component (`useEffect(() => track(event, props), [])`) used for the server-rendered no-score branch.

### D. Privacy policy (`src/app/privacy/page.tsx`)
Update the page-views bullet to state that PostHog stores a **persistent anonymous identifier in your browser's localStorage (not a cookie)** to count returning visitors, and that we record **anonymous interaction events** (searches — including the title you looked up — reveals, and shares) not tied to your identity. Keep "We don't use ads (yet)." Bump "Last updated" to 2026-06-24.

## Data flow
No server/API path changes. All capture is client-side via `posthog-js`. Page views fire from `<PostHogPageView>` on route change; the four events fire from their components/mount. PostHog continues to ingest to `NEXT_PUBLIC_POSTHOG_HOST`. Supabase `view_count` bumping is unchanged and independent.

## Error handling
- `track()` and `<PostHogPageView>` are **best-effort**: if PostHog isn't loaded (missing key, blocked, SSR, tests) they no-op silently. Analytics must never throw into a user interaction — capture calls are not awaited and are guarded.
- No new failure modes reach the user; search, reveal, and share behave exactly as today even if capture is suppressed.

## Testing
**Unit (Vitest):**
- `analytics.track`: no-ops when posthog isn't loaded (no key / `__loaded` falsy); calls `posthog.capture` with the event name + properties when loaded. (`posthog-js` mocked.)
- `PostHogProvider`: `posthog.init` is called with `persistence: 'localStorage'`, `autocapture: false`, `capture_pageview: false`. (`posthog-js` mocked.)

**Component (Vitest + Testing Library, `track` helper mocked):**
- `SpoilerReveal`: clicking to reveal calls `track('details_revealed', { slug, medium, score })`; still reveals the content.
- `ShareButton`: clicking calls `track('share_clicked', …)` with the right `method`; existing copy/native behavior unchanged.
- `SearchExperience`: submitting a search calls `track('search_submitted', { query })`.
- `TrackOnMount`: calls `track` once on mount with the given event + props.

**Manual / live (on the Vercel deploy, per the TLS env note — local build can't verify live):**
- Reload the site; confirm the PostHog distinct_id is stable across reloads (DAU now dedupes).
- Navigate from search to a result page; confirm a `$pageview` is recorded for `/r/[slug]`.
- Trigger each event; confirm arrival in PostHog with properties.

## Risks & notes
- **Ad-blockers** drop client-side PostHog for some visitors, so numbers are a floor, not exact — acceptable for trend/decision purposes. Server-side capture (out of scope) would mitigate if it ever matters.
- **Search-term capture** stores the looked-up title in analytics (previously the title only went to Anthropic). This is disclosed in the privacy update and is anonymous; it's also valuable SEO/seed signal (what people actually search). Flagged so the privacy change isn't overlooked.
- **No consent banner** is a deliberate, user-approved trade-off for a small US-leaning site using first-party localStorage analytics. The moment ads go live, the Ads spec must add a CMP — at which point analytics may need to gate on consent.
- **`person_profiles: 'identified_only'`** assumes anonymous events still dedupe by distinct_id for unique-visitor counts (they do in PostHog). Confirmed by the live distinct_id check above.
- **Existing `capture_pageview: true` → `false`** is intentional and paired with `<PostHogPageView>`; missing this pairing would either double-count (both on) or zero-count (both off) initial loads. Covered by the provider test.
