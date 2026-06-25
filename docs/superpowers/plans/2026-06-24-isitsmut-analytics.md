# IsItSmut Analytics Instrumentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make IsItSmut traffic measurable — give PostHog a persistent anonymous visitor ID, fix page-view capture on client-side navigations, and record four product events (search, reveal, share, no-score).

**Architecture:** A single client helper `src/lib/analytics.ts` wraps `posthog-js` (`track(event, props)` that no-ops unless PostHog is loaded). `PostHogProvider` switches to `localStorage` persistence, sends ingestion through a first-party `/ingest` reverse proxy (ad-blocker resistance), and adds a route-change `$pageview` tracker. Four UI components call `track(...)` at their interaction points; the one server-rendered case (no-score result) uses a small `<TrackOnMount>` client component. Privacy policy is updated to disclose the change. No consent banner (deferred to the later Ads effort).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `posthog-js` ^1.373, Vitest + Testing Library (jsdom), `@` alias → `src`.

## Global Constraints

- PostHog `init` options (exact): `api_host: '/ingest'`, `ui_host: 'https://us.posthog.com'`, `persistence: 'localStorage'`, `person_profiles: 'identified_only'`, `autocapture: false`, `disable_session_recording: true`, `capture_pageview: false` (paired with the manual `<PostHogPageView>` tracker — both-on double-counts, both-off zero-counts).
- Reverse proxy in `next.config.ts`: `/ingest/static/:path*` → `https://us-assets.i.posthog.com/static/:path*` (listed FIRST), `/ingest/:path*` → `https://us.i.posthog.com/:path*`, plus `skipTrailingSlashRedirect: true`. US region (project is US today). This is the only piece adopted from the PostHog Wizard; its other defaults (cookie persistence, autocapture) are deliberately NOT used.
- Event names are an external contract — use these exact strings: `search_submitted`, `details_revealed`, `share_clicked`, `no_score_shown`.
- `track()` must silently no-op when PostHog is not loaded (SSR, tests, missing key, ad-blocked). Capture calls are never awaited and never throw into a user interaction.
- **`ResultCard.tsx` is a server component — it must NOT import `@/lib/analytics`** (that module imports `posthog-js`). It renders the client `<TrackOnMount>` and passes the event as a string literal.
- No consent banner / CMP in this plan.
- Privacy page: keep the line "We don't use ads (yet)."; set "Last updated: 2026-06-24."
- Tests live in `tests/unit/`. Verify with `pnpm test`, `pnpm typecheck`, `pnpm lint`. (The machine's TLS quirk does not affect tests — Anthropic/Supabase are mocked.)
- Do NOT push, open a PR, or merge. Merging to `main` auto-deploys production and is gated on Tyler's explicit approval.

---

## File Structure

**Create:**
- `src/lib/analytics.ts` — `ANALYTICS_EVENTS` constants, `AnalyticsEvent` type, `track()`.
- `src/components/TrackOnMount.tsx` — client component; fires one event on mount.
- `tests/unit/analytics.test.ts`
- `tests/unit/TrackOnMount.test.tsx`
- `tests/unit/PostHogProvider.test.tsx`
- `tests/unit/SearchExperience.test.tsx`

**Modify:**
- `next.config.ts` — `/ingest` reverse-proxy rewrites (+ test `tests/unit/next-config.test.ts`).
- `src/components/PostHogProvider.tsx` — persistence/profiles + `api_host: '/ingest'` + `<PostHogPageView>` route tracker.
- `src/components/SpoilerReveal.tsx` — accept `slug/medium/score`, fire `details_revealed`.
- `src/components/ShareButton.tsx` — accept `slug`, fire `share_clicked` with `method`.
- `src/components/SearchExperience.tsx` — fire `search_submitted` in `handleSearch`.
- `src/components/ResultCard.tsx` — thread props into `SpoilerReveal`/`ShareButton`, render `<TrackOnMount>` in the no-score branch.
- `src/app/privacy/page.tsx` — disclosure copy + date.
- `tests/unit/SpoilerReveal.test.tsx`, `tests/unit/ShareButton.test.tsx`, `tests/unit/ResultCard.test.tsx` — add event assertions.

---

## Task 1: Analytics helper

**Files:**
- Create: `src/lib/analytics.ts`
- Test: `tests/unit/analytics.test.ts`

**Interfaces:**
- Produces:
  - `ANALYTICS_EVENTS = { searchSubmitted: 'search_submitted', detailsRevealed: 'details_revealed', shareClicked: 'share_clicked', noScoreShown: 'no_score_shown' }` (`as const`)
  - `type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]`
  - `track(event: AnalyticsEvent, properties?: Record<string, unknown>): void`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/analytics.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/analytics.test.ts`
Expected: FAIL — `Cannot find module '@/lib/analytics'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/analytics.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/analytics.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics.ts tests/unit/analytics.test.ts
git commit -m "feat(analytics): add guarded track() helper + event constants"
```

---

## Task 2: TrackOnMount component

**Files:**
- Create: `src/components/TrackOnMount.tsx`
- Test: `tests/unit/TrackOnMount.test.tsx`

**Interfaces:**
- Consumes: `track`, `AnalyticsEvent` from `@/lib/analytics` (Task 1).
- Produces: `<TrackOnMount event={AnalyticsEvent} properties?={Record<string, unknown>} />` — renders nothing, fires `track(event, properties)` once on mount.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/TrackOnMount.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  ANALYTICS_EVENTS: { noScoreShown: 'no_score_shown' },
}));

import { TrackOnMount } from '@/components/TrackOnMount';
import { track } from '@/lib/analytics';

beforeEach(() => vi.clearAllMocks());

describe('TrackOnMount', () => {
  it('fires the event once on mount with properties', () => {
    render(<TrackOnMount event="no_score_shown" properties={{ slug: 's', title: 'T', medium: 'book' }} />);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('no_score_shown', { slug: 's', title: 'T', medium: 'book' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/TrackOnMount.test.tsx`
Expected: FAIL — `Cannot find module '@/components/TrackOnMount'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/TrackOnMount.tsx`:

```tsx
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/TrackOnMount.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/TrackOnMount.tsx tests/unit/TrackOnMount.test.tsx
git commit -m "feat(analytics): add TrackOnMount client component"
```

---

## Task 3: PostHogProvider — persistence + SPA page-view tracker

**Files:**
- Modify: `src/components/PostHogProvider.tsx`
- Test: `tests/unit/PostHogProvider.test.tsx`

**Interfaces:**
- Produces: `PostHogProvider` initializes PostHog with the Global-Constraints options and renders a `<PostHogPageView>` that captures `$pageview` on pathname/searchParams change.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/PostHogProvider.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/PostHogProvider.test.tsx`
Expected: FAIL — init asserted with `capture_pageview: false`/`persistence: 'localStorage'`, but current code uses `capture_pageview: true` and `persistence: 'memory'`.

- [ ] **Step 3: Write minimal implementation**

Replace the entire contents of `src/components/PostHogProvider.tsx`:

```tsx
'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!(posthog as { __loaded?: boolean }).__loaded) return;
    let url = pathname;
    const qs = searchParams.toString();
    if (qs) url = `${url}?${qs}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;
    if ((posthog as { __loaded?: boolean }).__loaded) return;
    posthog.init(key, {
      api_host: '/ingest',
      ui_host: 'https://us.posthog.com',
      capture_pageview: false,
      autocapture: false,
      disable_session_recording: true,
      persistence: 'localStorage',
      person_profiles: 'identified_only',
    });
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/PostHogProvider.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/PostHogProvider.tsx tests/unit/PostHogProvider.test.tsx
git commit -m "feat(analytics): persistent visitor id + SPA pageview capture"
```

---

## Task 3b: PostHog reverse proxy (`next.config.ts`)

**Files:**
- Modify: `next.config.ts`
- Test: `tests/unit/next-config.test.ts`

**Interfaces:**
- Produces: `next.config` default export with an async `rewrites()` returning the two `/ingest/*` → PostHog mappings (assets rule first) and `skipTrailingSlashRedirect: true`. Pairs with `api_host: '/ingest'` from Task 3.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/next-config.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/next-config.test.ts`
Expected: FAIL — current `next.config.ts` has no `rewrites` (calling `nextConfig.rewrites!()` throws) and `skipTrailingSlashRedirect` is undefined.

- [ ] **Step 3: Write minimal implementation**

Replace the contents of `next.config.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/next-config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add next.config.ts tests/unit/next-config.test.ts
git commit -m "feat(analytics): reverse-proxy PostHog via /ingest (ad-blocker resistance)"
```

---

## Task 4: SpoilerReveal — `details_revealed`

**Files:**
- Modify: `src/components/SpoilerReveal.tsx`
- Test: `tests/unit/SpoilerReveal.test.tsx`

**Interfaces:**
- Consumes: `track`, `ANALYTICS_EVENTS` from `@/lib/analytics`.
- Produces: `SpoilerReveal` accepts new optional props `slug?: string; medium?: string; score?: number`; on reveal it fires `track('details_revealed', { slug, medium, score })`.

- [ ] **Step 1: Write the failing test**

Replace the contents of `tests/unit/SpoilerReveal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  ANALYTICS_EVENTS: { detailsRevealed: 'details_revealed' },
}));

import { SpoilerReveal } from '@/components/SpoilerReveal';
import { track } from '@/lib/analytics';

beforeEach(() => vi.clearAllMocks());

describe('SpoilerReveal', () => {
  it('renders blurred content with reveal button by default', () => {
    render(<SpoilerReveal>secret content here</SpoilerReveal>);
    expect(screen.getByRole('button', { name: /tap to reveal/i })).toBeInTheDocument();
    expect(screen.getByText('secret content here')).toHaveAttribute('aria-hidden', 'true');
  });

  it('reveals content when tapped', async () => {
    render(<SpoilerReveal>secret content here</SpoilerReveal>);
    await userEvent.click(screen.getByRole('button', { name: /tap to reveal/i }));
    expect(screen.queryByRole('button', { name: /tap to reveal/i })).not.toBeInTheDocument();
    expect(screen.getByText('secret content here')).not.toHaveAttribute('aria-hidden');
  });

  it('tracks details_revealed with context when tapped', async () => {
    render(<SpoilerReveal slug="fourth-wing-yarros-2023" medium="book" score={8}>secret</SpoilerReveal>);
    await userEvent.click(screen.getByRole('button', { name: /tap to reveal/i }));
    expect(track).toHaveBeenCalledWith('details_revealed', {
      slug: 'fourth-wing-yarros-2023', medium: 'book', score: 8,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/SpoilerReveal.test.tsx`
Expected: FAIL — `track` not called (component doesn't import analytics yet).

- [ ] **Step 3: Write minimal implementation**

Replace the contents of `src/components/SpoilerReveal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { track, ANALYTICS_EVENTS } from '@/lib/analytics';

type Props = {
  children: React.ReactNode;
  slug?: string;
  medium?: string;
  score?: number;
};

export function SpoilerReveal({ children, slug, medium, score }: Props) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return <div className="text-sm leading-relaxed text-[color:var(--color-ink)]">{children}</div>;
  }

  function handleReveal() {
    setRevealed(true);
    track(ANALYTICS_EVENTS.detailsRevealed, { slug, medium, score });
  }

  return (
    <button
      onClick={handleReveal}
      className="relative block w-full overflow-hidden rounded-xl bg-[color:var(--color-accent)] p-3 text-left"
    >
      <div aria-hidden="true" className="text-sm leading-relaxed text-transparent" style={{ textShadow: '0 0 8px rgba(139,58,79,0.6)' }}>
        {children}
      </div>
      <div className="mt-2 text-center text-xs font-semibold text-[color:var(--color-brand)]">
        👁 Tap to reveal
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/SpoilerReveal.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/SpoilerReveal.tsx tests/unit/SpoilerReveal.test.tsx
git commit -m "feat(analytics): track details_revealed on spoiler reveal"
```

---

## Task 5: ShareButton — `share_clicked`

**Files:**
- Modify: `src/components/ShareButton.tsx`
- Test: `tests/unit/ShareButton.test.tsx`

**Interfaces:**
- Consumes: `track`, `ANALYTICS_EVENTS` from `@/lib/analytics`.
- Produces: `ShareButton` accepts new optional prop `slug?: string`; fires `track('share_clicked', { slug, method })` where `method` is `'native'` (Web Share succeeded) or `'clipboard'` (fallback path).

- [ ] **Step 1: Write the failing test**

Replace the contents of `tests/unit/ShareButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  ANALYTICS_EVENTS: { shareClicked: 'share_clicked' },
}));

import { ShareButton } from '@/components/ShareButton';
import { track } from '@/lib/analytics';

describe('ShareButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => {}) },
      share: undefined,
    });
  });

  it('copies URL via clipboard when Web Share API unavailable', async () => {
    render(<ShareButton url="https://isitsmut.com/r/fourth-wing-yarros-2023" title="Fourth Wing" slug="fourth-wing-yarros-2023" />);
    await userEvent.click(screen.getByRole('button', { name: /share|copy link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://isitsmut.com/r/fourth-wing-yarros-2023');
  });

  it('tracks share_clicked with method=clipboard on the fallback path', async () => {
    render(<ShareButton url="https://isitsmut.com/r/x" title="X" slug="x" />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(track).toHaveBeenCalledWith('share_clicked', { slug: 'x', method: 'clipboard' });
  });

  it('tracks share_clicked with method=native when Web Share succeeds', async () => {
    const share = vi.fn(async () => {});
    Object.assign(navigator, { share });
    render(<ShareButton url="https://isitsmut.com/r/x" title="X" slug="x" />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(share).toHaveBeenCalledWith({ url: 'https://isitsmut.com/r/x', title: 'Is "X" smut?' });
    expect(track).toHaveBeenCalledWith('share_clicked', { slug: 'x', method: 'native' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/ShareButton.test.tsx`
Expected: FAIL — `track` not called.

- [ ] **Step 3: Write minimal implementation**

Replace the contents of `src/components/ShareButton.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { track, ANALYTICS_EVENTS } from '@/lib/analytics';

type Props = { url: string; title: string; slug?: string };

export function ShareButton({ url, title, slug }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title: `Is "${title}" smut?` });
        track(ANALYTICS_EVENTS.shareClicked, { slug, method: 'native' });
        return;
      } catch {
        // User cancelled; fall through to clipboard fallback below.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    track(ANALYTICS_EVENTS.shareClicked, { slug, method: 'clipboard' });
  }

  return (
    <button
      onClick={handleClick}
      className="rounded-full bg-[color:var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[color:#8b3a4f] hover:bg-[color:var(--color-brand-soft)] hover:text-white"
    >
      {copied ? '✓ Copied!' : 'Share'}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/ShareButton.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ShareButton.tsx tests/unit/ShareButton.test.tsx
git commit -m "feat(analytics): track share_clicked with share method"
```

---

## Task 6: SearchExperience — `search_submitted`

**Files:**
- Modify: `src/components/SearchExperience.tsx`
- Test: `tests/unit/SearchExperience.test.tsx`

**Interfaces:**
- Consumes: `track`, `ANALYTICS_EVENTS` from `@/lib/analytics`.
- Produces: `handleSearch` fires `track('search_submitted', { query })` at its start (covers both typed search and "Try these" chips, which both call `handleSearch`).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/SearchExperience.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  ANALYTICS_EVENTS: { searchSubmitted: 'search_submitted' },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { SearchExperience } from '@/components/SearchExperience';
import { track } from '@/lib/analytics';

beforeEach(() => {
  vi.clearAllMocks();
  // Resolve disambiguate to zero candidates so the handler short-circuits
  // to an error message and never navigates.
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [] }),
  })));
});
afterEach(() => vi.unstubAllGlobals());

describe('SearchExperience', () => {
  it('tracks search_submitted with the typed query on submit', async () => {
    render(<SearchExperience />);
    await userEvent.type(screen.getByRole('textbox', { name: /search/i }), 'Fourth Wing');
    await userEvent.click(screen.getByRole('button', { name: /find out/i }));
    expect(track).toHaveBeenCalledWith('search_submitted', { query: 'Fourth Wing' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/SearchExperience.test.tsx`
Expected: FAIL — `track` not called.

- [ ] **Step 3: Write minimal implementation**

In `src/components/SearchExperience.tsx`, add the import near the top (after the existing imports):

```tsx
import { track, ANALYTICS_EVENTS } from '@/lib/analytics';
```

Then add the track call as the FIRST line inside `handleSearch`, before `setLoading(true)`:

```tsx
  async function handleSearch(query: string) {
    track(ANALYTICS_EVENTS.searchSubmitted, { query });
    setLoading(true);
    setError(null);
    setCandidates(null);
    setPendingQuery(query);
    // ...rest unchanged
```

(Leave the remainder of `handleSearch`, `handlePick`, and the JSX exactly as-is.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/SearchExperience.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchExperience.tsx tests/unit/SearchExperience.test.tsx
git commit -m "feat(analytics): track search_submitted (typed + chips)"
```

---

## Task 7: ResultCard — thread props + no-score tracker

**Files:**
- Modify: `src/components/ResultCard.tsx`
- Test: `tests/unit/ResultCard.test.tsx`

**Interfaces:**
- Consumes: `<TrackOnMount>` (Task 2); `SpoilerReveal` props `slug/medium/score` (Task 4); `ShareButton` prop `slug` (Task 5).
- Note: `ResultCard` is a **server component** and must not import `@/lib/analytics`. It passes the event to `<TrackOnMount>` as the string literal `"no_score_shown"` (type-checked against `AnalyticsEvent` by the prop).

- [ ] **Step 1: Write the failing test**

Replace the contents of `tests/unit/ResultCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  ANALYTICS_EVENTS: {
    detailsRevealed: 'details_revealed',
    shareClicked: 'share_clicked',
  },
}));

import { ResultCard } from '@/components/ResultCard';
import { track } from '@/lib/analytics';

const work = {
  slug: 'fourth-wing-yarros-2023',
  medium: 'book' as const,
  title: 'Fourth Wing',
  creator: 'Rebecca Yarros',
  year: 2023,
};

beforeEach(() => vi.clearAllMocks());

describe('ResultCard — known', () => {
  it('renders score, verdict, synopsis, tags, blurred details', () => {
    render(
      <ResultCard
        work={work}
        rating={{
          slug: work.slug, known: true, score: 8, verdict: "Yes, it's smut.",
          synopsis: 'War college for dragon riders.', details: 'Multiple scenes.',
          tags: ['Open door', 'Enemies to lovers'],
          model: 'm', rated_at: '0', view_count: 0,
        }}
        shareUrl="https://isitsmut.com/r/fourth-wing-yarros-2023"
      />
    );
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getAllByText(/yes, it's smut/i)).toHaveLength(2);
    expect(screen.getByText('Fourth Wing')).toBeInTheDocument();
    expect(screen.getByText(/is fourth wing smut\?/i)).toBeInTheDocument();
    expect(screen.getByText(/war college/i)).toBeInTheDocument();
    expect(screen.getByText('Open door')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tap to reveal/i })).toBeInTheDocument();
  });
});

describe('ResultCard — unknown', () => {
  it('renders helpful message and fires no_score_shown', () => {
    render(
      <ResultCard
        work={work}
        rating={{ slug: work.slug, known: false, model: 'm', rated_at: '0', view_count: 0 }}
        shareUrl="https://isitsmut.com/r/x"
      />
    );
    expect(screen.getByText(/don't have a reliable read/i)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('no_score_shown', {
      slug: 'fourth-wing-yarros-2023', title: 'Fourth Wing', medium: 'book',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/ResultCard.test.tsx`
Expected: FAIL — `no_score_shown` not fired (TrackOnMount not yet rendered).

- [ ] **Step 3: Write minimal implementation**

In `src/components/ResultCard.tsx`:

(a) Add the import after the existing `ShareButton` import (line 2):

```tsx
import { TrackOnMount } from './TrackOnMount';
```

(b) In the `if (!rating.known)` branch, add `<TrackOnMount>` as the first child inside the wrapping `<div>` (just before the `<h1>`):

```tsx
  if (!rating.known) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-[0_6px_18px_rgba(212,80,107,0.10)]">
        <TrackOnMount
          event="no_score_shown"
          properties={{ slug: work.slug, title: work.title, medium: work.medium }}
        />
        <h1 className="text-xl font-bold text-[color:var(--color-ink)]">{work.title}</h1>
        {/* ...rest of the unknown branch unchanged... */}
```

(c) Pass context props to `SpoilerReveal` (currently `<SpoilerReveal>{rating.details}</SpoilerReveal>`):

```tsx
          <SpoilerReveal slug={work.slug} medium={work.medium} score={rating.score}>
            {rating.details}
          </SpoilerReveal>
```

(d) Pass `slug` to `ShareButton` (currently `<ShareButton url={shareUrl} title={work.title} />`):

```tsx
          <ShareButton url={shareUrl} title={work.title} slug={work.slug} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/ResultCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ResultCard.tsx tests/unit/ResultCard.test.tsx
git commit -m "feat(analytics): wire result-card events (reveal/share context + no-score)"
```

---

## Task 8: Privacy policy disclosure

**Files:**
- Modify: `src/app/privacy/page.tsx`
- Test: `tests/unit/privacy.test.tsx` (create)

**Interfaces:** none (copy change).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/privacy.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PrivacyPage from '@/app/privacy/page';

describe('PrivacyPage', () => {
  it('discloses the localStorage analytics identifier and interaction events', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/localStorage/i)).toBeInTheDocument();
    expect(screen.getByText(/Last updated: 2026-06-24/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/privacy.test.tsx`
Expected: FAIL — text "localStorage" / new date not present.

- [ ] **Step 3: Write minimal implementation**

Replace the contents of `src/app/privacy/page.tsx`:

```tsx
export default function PrivacyPage() {
  return (
    <article className="prose prose-sm max-w-none text-[color:var(--color-ink)]">
      <h1 className="text-2xl font-bold text-[color:var(--color-brand)]">Privacy Policy</h1>
      <p>We collect as little as possible:</p>
      <ul>
        <li>
          <strong>Page views &amp; basic usage</strong> via PostHog. We store a random, anonymous ID
          in your browser&apos;s localStorage (not a cookie) so we can tell whether you&apos;re a
          returning visitor. We also log a few anonymous actions — the titles you search, when you
          reveal a &quot;what&apos;s in it&quot; section, and when you tap Share. None of this is tied
          to your identity.
        </li>
        <li><strong>Search queries</strong> are sent to our AI provider (Anthropic) to generate the rating. We don&apos;t tie queries to your identity.</li>
        <li><strong>Rate-limit counters</strong> use a salted hash of your IP address. We never store the raw IP.</li>
        <li><strong>Cookies:</strong> only a short-lived captcha bypass cookie if you&apos;ve solved a captcha recently.</li>
      </ul>
      <p>We don&apos;t sell or share your data. We don&apos;t use ads (yet).</p>
      <p>Questions? Email tworden1993@gmail.com.</p>
      <p>Last updated: 2026-06-24.</p>
    </article>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/privacy.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/app/privacy/page.tsx tests/unit/privacy.test.tsx
git commit -m "docs(privacy): disclose localStorage analytics id + interaction events"
```

---

## Task 9: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: PASS — all prior tests (113) plus the new ones green. If any pre-existing test fails, fix it before continuing.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (Watch for: `SpoilerReveal`/`ShareButton` prop types, `AnalyticsEvent` literal in `ResultCard`.)

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors. (The `eslint-disable-next-line react-hooks/exhaustive-deps` in `TrackOnMount` is intentional.)

- [ ] **Step 4: Commit any fixes (if Steps 1–3 required changes)**

```bash
git add -A
git commit -m "fix(analytics): resolve typecheck/lint findings"
```

- [ ] **Step 5: STOP — hand back to Tyler**

Do NOT push, open a PR, or merge. Report that the branch `analytics-instrumentation` is ready and summarize the change. Merging to `main` deploys production and requires Tyler's go-ahead.

**Post-merge live verification (run on the Vercel deploy, not the local build — TLS quirk):**
- Open DevTools → Network; confirm analytics requests go to `isitsmut.com/ingest/...` (HTTP 200), not directly to `i.posthog.com` — this confirms the reverse proxy is live.
- Load the site, open DevTools → Application → Local Storage; confirm a PostHog key is present and **stable across a hard reload** (this is the DAU fix).
- Search a title → land on `/r/[slug]`; in PostHog Activity, confirm a `$pageview` for the result URL appears (the SPA-capture fix).
- Trigger each event and confirm arrival in PostHog with properties: `search_submitted` (with `query`), `details_revealed`, `share_clicked` (`method`), and an obscure title for `no_score_shown`.
- Confirm the unique-visitor count in PostHog (filter `$host=isitsmut.com`) now looks sane vs. raw pageviews.

---

## Self-Review

**Spec coverage:**
- Persistent localStorage ID + `person_profiles` → Task 3. ✓
- SPA `$pageview` capture → Task 3. ✓
- `/ingest` reverse proxy (ad-blocker resistance) + `api_host` → Task 3b (+ Task 3 init). ✓
- `analytics.ts` helper (guarded) → Task 1. ✓
- `search_submitted` → Task 6; `details_revealed` → Task 4; `share_clicked` → Task 5; `no_score_shown` → Task 2 (component) + Task 7 (wiring). ✓
- Privacy disclosure + date + keep "no ads (yet)" → Task 8. ✓
- Tests: helper, provider config, per-component events → Tasks 1–8. ✓
- Out of scope (no banner, no server-side capture, no 0-candidate event, view_count/AI untouched) → respected; no tasks add them. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `ANALYTICS_EVENTS` keys (`searchSubmitted`/`detailsRevealed`/`shareClicked`/`noScoreShown`) and string values are identical across Tasks 1, 4, 5, 6, 7. `track(event, properties?)` signature consistent. `SpoilerReveal` props (`slug/medium/score`) match between Task 4 impl and Task 7 caller. `ShareButton` `slug` prop matches Task 5 ↔ Task 7. `TrackOnMount` `event`/`properties` match Task 2 ↔ Task 7. ✓
```
