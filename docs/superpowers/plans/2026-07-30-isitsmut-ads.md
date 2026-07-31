# IsItSmut Ads (AdSense) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Google AdSense on isitsmut.com — light manual ad slots (result pages + hub pages), `ads.txt`, consent-ready loader script, privacy-policy update — all gated on env vars so previews/local/tests stay ad-free.

**Architecture:** A self-gating `AdSlot` client component renders one responsive AdSense unit only when `NEXT_PUBLIC_ADSENSE_CLIENT` **and** its slot id are set; otherwise it renders `null`. A tiny `AdSenseLoader` server component conditionally injects the AdSense library script (which also serves Google's consent banner) into the root layout. Server pages pass slot ids from env unconditionally — the component self-gates, so call sites stay dumb.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Vitest + Testing Library (jsdom). Spec: `docs/superpowers/specs/2026-07-30-isitsmut-ads-design.md`.

## Global Constraints

- Package manager is **pnpm**; run from `C:\Users\tword\Desktop\isitsmut`. Work happens on the existing `feat/ads` branch.
- Publisher ID (exact, everywhere): `ca-pub-3955040205852001`. In `ads.txt` it appears WITHOUT the `ca-` prefix: `pub-3955040205852001`.
- Env vars (never set in test/preview): `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT_RESULT`, `NEXT_PUBLIC_ADSENSE_SLOT_HUB`. Slot IDs do not exist yet (AdSense account still provisioning) — code must behave correctly with them unset.
- No ads on: homepage, `/about`, `/privacy`, `/terms`, and `known:false` result pages.
- With all three env vars unset, rendered output of every page must be unchanged from today.
- TLS quirk on this machine: `pnpm build` logs `UNABLE_TO_VERIFY_LEAF_SIGNATURE` while prerendering hub/sitemap pages — **expected noise; the build still succeeds.** Judge the build by its exit status.
- Never run `pnpm dlx`. All verification via: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `AdSlot` component

**Files:**
- Create: `src/components/AdSlot.tsx`
- Test: `tests/unit/AdSlot.test.tsx`

**Interfaces:**
- Consumes: nothing (reads `process.env.NEXT_PUBLIC_ADSENSE_CLIENT` at render time — do NOT capture it at module level, tests stub it per-test).
- Produces: `AdSlot({ slot, className }: { slot: string | undefined; className?: string })` — named export, client component. Later tasks rely on exactly this signature.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/AdSlot.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AdSlot } from '@/components/AdSlot';

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as { adsbygoogle?: unknown }).adsbygoogle;
});

describe('AdSlot', () => {
  it('renders nothing when the publisher id env var is unset', () => {
    const { container } = render(<AdSlot slot="1234567890" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the slot id is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    const { container } = render(<AdSlot slot={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a responsive ad unit with reserved height and pushes to adsbygoogle', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    const { container } = render(<AdSlot slot="1234567890" />);
    const ins = container.querySelector('ins.adsbygoogle');
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute('data-ad-client')).toBe('ca-pub-3955040205852001');
    expect(ins?.getAttribute('data-ad-slot')).toBe('1234567890');
    expect(ins?.getAttribute('data-ad-format')).toBe('auto');
    expect(ins?.getAttribute('data-full-width-responsive')).toBe('true');
    expect(container.firstElementChild?.className).toContain('min-h-[280px]');
    expect((window as { adsbygoogle?: unknown[] }).adsbygoogle).toHaveLength(1);
  });

  it('labels the unit "Advertisement"', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    const { getByText } = render(<AdSlot slot="1234567890" />);
    expect(getByText(/advertisement/i)).toBeInTheDocument();
  });

  it('survives an adsbygoogle push that throws (ad blocker)', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    (window as unknown as { adsbygoogle: { push: () => void } }).adsbygoogle = {
      push: () => {
        throw new Error('blocked');
      },
    };
    expect(() => render(<AdSlot slot="1234567890" />)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/AdSlot.test.tsx`
Expected: FAIL — cannot resolve `@/components/AdSlot`.

- [ ] **Step 3: Write the implementation**

Create `src/components/AdSlot.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle?: object[];
  }
}

type Props = { slot: string | undefined; className?: string };

/**
 * One AdSense responsive display unit. Renders nothing unless both the
 * publisher id (NEXT_PUBLIC_ADSENSE_CLIENT) and the slot id are set, so
 * local dev, previews, and tests stay ad-free. The reserved min-height
 * keeps ad load from shifting the layout.
 */
export function AdSlot({ slot, className }: Props) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const enabled = Boolean(client && slot);
  const pushed = useRef(false);

  useEffect(() => {
    if (!enabled || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // Ad blocker or double-fill — never break the page over an ad.
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className={className ? `min-h-[280px] ${className}` : 'min-h-[280px]'}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-[color:var(--color-ink-muted)]">
        Advertisement
      </p>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/AdSlot.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AdSlot.tsx tests/unit/AdSlot.test.tsx
git commit -m "feat(ads): AdSlot component, env-gated with reserved height

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `AdSenseLoader` + root layout wiring

**Files:**
- Create: `src/components/AdSenseLoader.tsx`
- Modify: `src/app/layout.tsx`
- Test: `tests/unit/AdSenseLoader.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `AdSenseLoader()` — named export, no props, server-compatible component rendering `next/script` or `null`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/AdSenseLoader.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('next/script', () => ({
  default: (props: Record<string, unknown>) => (
    <script data-testid="adsense-script" data-src={String(props.src)} data-strategy={String(props.strategy)} />
  ),
}));

import { AdSenseLoader } from '@/components/AdSenseLoader';

afterEach(() => vi.unstubAllEnvs());

describe('AdSenseLoader', () => {
  it('renders nothing when NEXT_PUBLIC_ADSENSE_CLIENT is unset', () => {
    const { container } = render(<AdSenseLoader />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the AdSense library script tagged with our publisher id', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    const { getByTestId } = render(<AdSenseLoader />);
    const script = getByTestId('adsense-script');
    expect(script.getAttribute('data-src')).toBe(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3955040205852001'
    );
    expect(script.getAttribute('data-strategy')).toBe('afterInteractive');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/AdSenseLoader.test.tsx`
Expected: FAIL — cannot resolve `@/components/AdSenseLoader`.

- [ ] **Step 3: Write the implementation**

Create `src/components/AdSenseLoader.tsx`:

```tsx
import Script from 'next/script';

/**
 * Loads the AdSense library once per page when the publisher id is set.
 * The same script serves Google's GDPR/US-states consent message
 * (configured in AdSense -> Privacy & messaging) before showing ads.
 */
export function AdSenseLoader() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) return null;
  return (
    <Script
      id="adsense-loader"
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/AdSenseLoader.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire into the root layout**

In `src/app/layout.tsx`, add the import and render `<AdSenseLoader />` inside `<body>`. The full modified file:

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/components/Footer';
import { PostHogProvider } from '@/components/PostHogProvider';
import { AdSenseLoader } from '@/components/AdSenseLoader';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'IsItSmut — Find out before you start chapter one.',
  description: "Look up any book, movie, or TV show and see if it contains smut. 1–10 rating, short synopsis, and a (blurred) breakdown of what's in it.",
  openGraph: {
    siteName: 'IsItSmut',
    type: 'website',
  },
  verification: {
    google: 'Fa1-HAQl-Kz_Opn76fyEUSkjx_ElShvctcmOOMX5Mlk',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdSenseLoader />
        <PostHogProvider>
          <SiteHeader />
          <main className="mx-auto max-w-xl px-5 pt-6">{children}</main>
          <Footer />
        </PostHogProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Run the full suite + typecheck**

Run: `pnpm test` then `pnpm typecheck`
Expected: all tests PASS (existing suite untouched — env vars are unset under test), typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/AdSenseLoader.tsx tests/unit/AdSenseLoader.test.tsx src/app/layout.tsx
git commit -m "feat(ads): AdSense loader script in root layout, env-gated

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Ad slot on result pages (known ratings only)

**Files:**
- Modify: `src/app/r/[slug]/page.tsx`
- Test: `tests/unit/result-page-ads.test.tsx`

**Interfaces:**
- Consumes: `AdSlot` from Task 1 (`<AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESULT} className="mt-6" />`).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/result-page-ads.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { slug: 'test-book-2020', medium: 'book', title: 'Test Book', creator: 'A. Author', year: 2020 },
          }),
        }),
      }),
    }),
  }),
}));

const ratingHolder: { rating: Record<string, unknown> } = { rating: {} };
vi.mock('@/lib/rate', () => ({
  getCachedRating: async () => ratingHolder.rating,
  runRate: vi.fn(),
  bumpViewCount: async () => {},
}));

vi.mock('@/lib/related', () => ({ getRelatedTitles: async () => [] }));
vi.mock('@/components/ResultCard', () => ({ ResultCard: () => <div data-testid="result-card" /> }));
vi.mock('@/components/RelatedTitles', () => ({ RelatedTitles: () => <div data-testid="related" /> }));
vi.mock('@/components/JsonLd', () => ({ JsonLd: () => null }));

import ResultPage from '@/app/r/[slug]/page';

const baseRating = {
  slug: 'test-book-2020',
  score: 7,
  verdict: 'Steamy',
  synopsis: 's',
  details: 'd',
  tags: [],
  model: 'test-model',
  rated_at: '2026-01-01',
  view_count: 1,
};

const props = {
  params: Promise.resolve({ slug: 'test-book-2020' }),
  searchParams: Promise.resolve({}),
};

afterEach(() => vi.unstubAllEnvs());

describe('result page ad slot', () => {
  it('renders the ad below the card when the rating is known and ads are configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_SLOT_RESULT', '1111111111');
    ratingHolder.rating = { ...baseRating, known: true };
    const { container } = render(await ResultPage(props));
    const ins = container.querySelector('ins.adsbygoogle');
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute('data-ad-slot')).toBe('1111111111');
  });

  it('renders no ad on a no-score (known:false) page even when ads are configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_SLOT_RESULT', '1111111111');
    ratingHolder.rating = { ...baseRating, known: false };
    const { container } = render(await ResultPage(props));
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
  });

  it('renders no ad when env vars are unset', async () => {
    ratingHolder.rating = { ...baseRating, known: true };
    const { container } = render(await ResultPage(props));
    expect(container.querySelector('ins.adsbygoogle')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/result-page-ads.test.tsx`
Expected: the first test FAILS (no `ins.adsbygoogle` found); the other two pass trivially.

- [ ] **Step 3: Add the slot to the page**

In `src/app/r/[slug]/page.tsx`:

Add to the imports:

```tsx
import { AdSlot } from '@/components/AdSlot';
```

Change the return statement (currently `ResultCard` then `RelatedTitles`) to:

```tsx
  return (
    <>
      {rating.known && <JsonLd data={buildJsonLd(work, rating)} />}
      <ResultCard work={work} rating={rating} shareUrl={shareUrl} />
      {rating.known && <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESULT} className="mt-6" />}
      {rating.known && <RelatedTitles entries={related} medium={work.medium} />}
    </>
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/result-page-ads.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/r/[slug]/page.tsx tests/unit/result-page-ads.test.tsx
git commit -m "feat(ads): ad slot on result pages, known ratings only

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Ad slot on the five hub pages

**Files:**
- Modify: `src/app/books/page.tsx`, `src/app/movies/page.tsx`, `src/app/tv/page.tsx`, `src/app/tamest/page.tsx`, `src/app/top/page.tsx`
- Test: `tests/unit/hub-page-ads.test.tsx`

**Interfaces:**
- Consumes: `AdSlot` from Task 1 (`<AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HUB} className="mt-8" />`).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/hub-page-ads.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ReactElement } from 'react';

vi.mock('@/lib/leaderboard', () => ({
  getRatingsByMedium: async () => [],
  getTamestRatings: async () => [],
  getTopRatings: async () => [],
}));

import BooksPage from '@/app/books/page';
import MoviesPage from '@/app/movies/page';
import TvPage from '@/app/tv/page';
import TamestPage from '@/app/tamest/page';
import TopPage from '@/app/top/page';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
  vi.stubEnv('NEXT_PUBLIC_ADSENSE_SLOT_HUB', '2222222222');
});
afterEach(() => vi.unstubAllEnvs());

const pages: Array<[string, () => Promise<ReactElement>]> = [
  ['books', BooksPage],
  ['movies', MoviesPage],
  ['tv', TvPage],
  ['tamest', TamestPage],
  ['top', TopPage],
];

describe.each(pages)('%s hub page', (_name, Page) => {
  it('renders exactly one hub ad slot', async () => {
    const { container } = render(await Page());
    const units = container.querySelectorAll('ins.adsbygoogle');
    expect(units).toHaveLength(1);
    expect(units[0].getAttribute('data-ad-slot')).toBe('2222222222');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/hub-page-ads.test.tsx`
Expected: FAIL — 0 ad units found on each of the 5 pages.

- [ ] **Step 3: Add the slot to each page**

Same mechanical edit in all five files — add the import, and append the `AdSlot` after the page's main content. Do NOT change any existing headings, intros, metadata, `revalidate`, or data calls.

`src/app/books/page.tsx` — add import `import { AdSlot } from '@/components/AdSlot';` and change the component body to:

```tsx
export default async function BooksPage() {
  const entries = await getRatingsByMedium('book', 100);
  return (
    <>
      <BrowseList heading="The Smuttiest Books, Rated 1–10" intro="Every book we've rated, hottest first." entries={entries} />
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HUB} className="mt-8" />
    </>
  );
}
```

`src/app/movies/page.tsx` — add the same import and change the component body to:

```tsx
export default async function MoviesPage() {
  const entries = await getRatingsByMedium('movie', 100);
  return (
    <>
      <BrowseList heading="The Smuttiest Movies, Rated 1–10" intro="Every movie we've rated, hottest first." entries={entries} />
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HUB} className="mt-8" />
    </>
  );
}
```

`src/app/tv/page.tsx` — add the same import and change the component body to:

```tsx
export default async function TvPage() {
  const entries = await getRatingsByMedium('tv', 100);
  return (
    <>
      <BrowseList heading="The Smuttiest TV Shows, Rated 1–10" intro="Every show we've rated, hottest first." entries={entries} />
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HUB} className="mt-8" />
    </>
  );
}
```

`src/app/tamest/page.tsx` — same pattern:

```tsx
export default async function TamestPage() {
  const entries = await getTamestRatings(100);
  return (
    <>
      <BrowseList heading="The Tamest Picks" intro="The cleanest, least-spicy titles we've rated." entries={entries} />
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HUB} className="mt-8" />
    </>
  );
}
```

`src/app/top/page.tsx` — append inside the existing `space-y-6` div, after `<LeaderboardSection entries={top} />`:

```tsx
      <LeaderboardSection entries={top} />
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HUB} className="mt-8" />
    </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/hub-page-ads.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/books/page.tsx src/app/movies/page.tsx src/app/tv/page.tsx src/app/tamest/page.tsx src/app/top/page.tsx tests/unit/hub-page-ads.test.tsx
git commit -m "feat(ads): hub-page ad slot on books/movies/tv/tamest/top

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `ads.txt`

**Files:**
- Create: `public/ads.txt`
- Test: `tests/unit/ads-txt.test.ts`

**Interfaces:** none.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ads-txt.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

describe('ads.txt', () => {
  it('authorizes Google as a direct seller under our publisher id', () => {
    const content = readFileSync(path.resolve(__dirname, '../../public/ads.txt'), 'utf8');
    expect(content.trim()).toBe('google.com, pub-3955040205852001, DIRECT, f08c47fec0942fa0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/ads-txt.test.ts`
Expected: FAIL — ENOENT, `public/ads.txt` does not exist.

- [ ] **Step 3: Create the file**

Create `public/ads.txt` containing exactly one line:

```
google.com, pub-3955040205852001, DIRECT, f08c47fec0942fa0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/ads-txt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/ads.txt tests/unit/ads-txt.test.ts
git commit -m "feat(ads): ads.txt authorizing Google

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Privacy policy update

**Files:**
- Modify: `src/app/privacy/page.tsx`
- Modify: `tests/unit/privacy.test.tsx`

**Interfaces:** none.

- [ ] **Step 1: Update the failing test first**

Replace the whole of `tests/unit/privacy.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PrivacyPage from '@/app/privacy/page';

describe('PrivacyPage', () => {
  it('discloses the localStorage analytics identifier and interaction events', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/localStorage/i)).toBeInTheDocument();
  });

  it('discloses Google AdSense advertising with consent controls', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Google AdSense/i)).toBeInTheDocument();
    expect(screen.getByText(/consent banner/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /adssettings\.google\.com/i })).toHaveAttribute(
      'href',
      'https://adssettings.google.com'
    );
    expect(screen.getByText(/Last updated: 2026-07-30/i)).toBeInTheDocument();
  });

  it('no longer claims the site is ad-free', () => {
    render(<PrivacyPage />);
    expect(screen.queryByText(/don't use ads/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/privacy.test.tsx`
Expected: FAIL — no AdSense text, old date, old "don't use ads (yet)" line present.

- [ ] **Step 3: Update the page**

In `src/app/privacy/page.tsx`, insert a new `<li>` after the existing **Cookies** `<li>` (keep all four existing list items unchanged):

```tsx
        <li>
          <strong>Advertising:</strong> we show ads via Google AdSense. Google and its partners
          use cookies and similar technologies to serve and measure ads and — where you consent —
          to personalize them. Visitors in the EEA, UK, and certain US states see a consent banner
          with their choices first. You can manage ad personalization at{' '}
          <a href="https://adssettings.google.com">adssettings.google.com</a> and read how Google
          uses data at{' '}
          <a href="https://policies.google.com/technologies/partner-sites">
            policies.google.com/technologies/partner-sites
          </a>
          .
        </li>
```

Replace the line `<p>We don&apos;t sell or share your data. We don&apos;t use ads (yet).</p>` with:

```tsx
      <p>Aside from the advertising partners described above, we don&apos;t sell or share your data.</p>
```

Replace `<p>Last updated: 2026-06-24.</p>` with:

```tsx
      <p>Last updated: 2026-07-30.</p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/privacy.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/privacy/page.tsx tests/unit/privacy.test.tsx
git commit -m "docs(privacy): disclose AdSense advertising and consent controls

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Full verification + PR

**Files:** none new.

- [ ] **Step 1: Run the complete verification suite**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all tests pass (~128 existing + 14 new), typecheck and lint clean, build exits 0 (ignore `UNABLE_TO_VERIFY_LEAF_SIGNATURE` noise during prerender — known TLS quirk on this machine).

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin feat/ads
gh pr create --title "Ads: AdSense integration (light manual slots, env-gated)" --body "Implements docs/superpowers/specs/2026-07-30-isitsmut-ads-design.md

- AdSlot component (env-gated, reserved height, no CLS) + AdSense loader in layout
- Slots: result pages (known ratings only, below card) + 5 hub pages
- ads.txt (pub-3955040205852001), privacy policy update
- Zero rendered change anywhere until Vercel env vars are set

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: STOP — operator gate (Tyler), before merge**

1. Tyler sets the Vercel env var: Vercel dashboard → is-it-smut project → Settings → Environment Variables → Add: name `NEXT_PUBLIC_ADSENSE_CLIENT`, value `ca-pub-3955040205852001`, environment **Production only**. (Slot vars come later when the AdSense Ads section unlocks.)
2. Tyler confirms merge (production deploy). Merge: `gh pr merge --squash --delete-branch`.

- [ ] **Step 4: Post-deploy verification (assistant)**

- `curl --ssl-no-revoke https://isitsmut.com/ads.txt` → the exact Google line.
- View-source of `https://isitsmut.com` → contains `adsbygoogle.js?client=ca-pub-3955040205852001`.
- View-source of a result page (e.g. `https://isitsmut.com/r/fourth-wing-yarros-2023`) → loader present; no visible layout break (slot renders nothing while slot env vars are unset).

- [ ] **Step 5: Operator handoff (Tyler, async)**

1. In AdSense → finish "Tell us about you" (payee name/address) if not done.
2. In AdSense → connect/verify the site if prompted (the code is now live, so any option works — ads.txt or the code snippet are both already on the site) → click **Request review**.
3. When the account unlocks the **Ads** section: create 2 responsive display units (`result-page`, `hub-page`), send both slot IDs to the assistant → assistant has Tyler add `NEXT_PUBLIC_ADSENSE_SLOT_RESULT` / `NEXT_PUBLIC_ADSENSE_SLOT_HUB` in Vercel (Production) and redeploy. Keep **Auto ads OFF** for isitsmut.com (we use manual slots only).
4. In AdSense → **Privacy & messaging**: publish the GDPR message and the US-states message (defaults fine).
5. Wait for Google's review email (days–weeks). After approval, check AdSense **Policy center** for any per-page restrictions on high-score pages (expected possibility; revenue-only impact).
