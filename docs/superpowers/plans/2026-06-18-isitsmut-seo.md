# IsItSmut SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make IsItSmut rank for "is [title] smut" queries by adding the missing technical SEO foundations (sitemap, canonical/metadataBase, structured data, noindex on no-score pages), enriching result pages, adding lightweight hub pages, and seeding an indexable corpus.

**Architecture:** Pure, unit-testable helpers in `src/lib` (SEO metadata, JSON-LD, sitemap entries, Q&A text, related-titles + medium/order leaderboard queries) consumed by thin server components and App Router metadata/route files. Follows the existing pattern: business logic in `src/lib`, presentation in `src/components`, Supabase mocked in unit tests via `vi.mock('@/lib/supabase-server')`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind, Supabase (`@supabase/supabase-js`, service-role server client), Vitest + Testing Library. Spec: `docs/superpowers/specs/2026-06-18-isitsmut-seo-design.md`.

**Conventions (read before starting):**
- Tests live in `tests/unit/**` and `tests/integration/**` (see `vitest.config.ts`). Run a single file with `pnpm test -- tests/unit/<file>` (alias for `vitest run`).
- Supabase server client is mocked with `vi.hoisted` + `vi.mock('@/lib/supabase-server', () => ({ supabaseServer: () => supabaseMock }))`. See `tests/unit/leaderboard.test.ts` for the canonical pattern.
- Path alias `@/` → `src/`.
- The display score is already adjusted by `adjustScore` inside the leaderboard/rate read paths — SEO helpers receive the **already-adjusted** `Rating`/`LeaderboardEntry` and must not re-adjust.
- Commit after every task. Conventional-commit style (`feat:`, `refactor:`, `test:`, `chore:`), matching git history.

---

## Group A — SEO library (`src/lib/seo.ts`)

### Task 1: `SITE_URL` + `buildQuestionAnswer`

**Files:**
- Create: `src/lib/seo.ts`
- Test: `tests/unit/seo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/seo.test.ts
import { describe, it, expect } from 'vitest';
import { SITE_URL, buildQuestionAnswer } from '@/lib/seo';
import type { Work, Rating } from '@/lib/types';

const work: Work = {
  slug: 'fourth-wing-yarros-2023',
  medium: 'book',
  title: 'Fourth Wing',
  creator: 'Rebecca Yarros',
  year: 2023,
};

const known: Extract<Rating, { known: true }> = {
  slug: work.slug, known: true, score: 8, verdict: "Yes, it's smut.",
  synopsis: 'War college for dragon riders.', details: 'Multiple scenes.',
  tags: ['Open door'], model: 'm', rated_at: '2026-01-01T00:00:00.000Z', view_count: 0,
};

describe('SITE_URL', () => {
  it('is the apex https origin with no trailing slash', () => {
    expect(SITE_URL).toBe('https://isitsmut.com');
  });
});

describe('buildQuestionAnswer', () => {
  it('produces a spoiler-safe Q&A line for a known rating', () => {
    expect(buildQuestionAnswer(work, known)).toBe(
      'Is Fourth Wing smut? Yes, it\'s smut. It scores 8/10 for sexual content.'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/seo.test.ts`
Expected: FAIL — `Cannot find module '@/lib/seo'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/seo.ts
import type { Work, Rating } from './types';

// Apex is the canonical origin (see spec: Vercel primary-domain flip is a manual follow-up).
// Reuse the existing share-base env var so there is one source of truth.
export const SITE_URL = (process.env.NEXT_PUBLIC_SHARE_BASE_URL ?? 'https://isitsmut.com').replace(/\/$/, '');

type KnownRating = Extract<Rating, { known: true }>;

export function buildQuestionAnswer(work: Work, rating: KnownRating): string {
  return `Is ${work.title} smut? ${rating.verdict} It scores ${rating.score}/10 for sexual content.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/seo.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo.ts tests/unit/seo.test.ts
git commit -m "feat(seo): SITE_URL constant and buildQuestionAnswer helper"
```

---

### Task 2: `buildJsonLd`

**Files:**
- Modify: `src/lib/seo.ts`
- Test: `tests/unit/seo.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/unit/seo.test.ts`)

```ts
import { buildJsonLd } from '@/lib/seo';

describe('buildJsonLd', () => {
  it('emits a Book with a nested Review for a known book', () => {
    const ld = buildJsonLd(work, known) as Record<string, unknown>;
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Book');
    expect(ld.name).toBe('Fourth Wing');
    expect(ld.author).toEqual({ '@type': 'Person', name: 'Rebecca Yarros' });
    expect(ld.datePublished).toBe('2023');
    const review = ld.review as Record<string, unknown>;
    expect(review['@type']).toBe('Review');
    expect(review.reviewRating).toEqual({
      '@type': 'Rating', ratingValue: 8, bestRating: 10, worstRating: 1,
    });
    expect((review.author as Record<string, unknown>).name).toBe('IsItSmut');
  });

  it('uses Movie/director and TVSeries/creator types', () => {
    const movie = buildJsonLd({ ...work, medium: 'movie' }, known) as Record<string, unknown>;
    expect(movie['@type']).toBe('Movie');
    expect(movie.director).toEqual({ '@type': 'Person', name: 'Rebecca Yarros' });
    const tv = buildJsonLd({ ...work, medium: 'tv' }, known) as Record<string, unknown>;
    expect(tv['@type']).toBe('TVSeries');
    expect(tv.creator).toEqual({ '@type': 'Person', name: 'Rebecca Yarros' });
  });

  it('omits datePublished when year is null', () => {
    const ld = buildJsonLd({ ...work, year: null }, known) as Record<string, unknown>;
    expect(ld.datePublished).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/seo.test.ts`
Expected: FAIL — `buildJsonLd is not a function`.

- [ ] **Step 3: Write minimal implementation** (append to `src/lib/seo.ts`)

```ts
import type { Medium } from './types';

const WORK_TYPE: Record<Medium, string> = { book: 'Book', movie: 'Movie', tv: 'TVSeries' };
// schema.org property naming differs per type for the primary creator.
const CREATOR_PROP: Record<Medium, string> = { book: 'author', movie: 'director', tv: 'creator' };

export function buildJsonLd(work: Work, rating: KnownRating): Record<string, unknown> {
  const person = { '@type': 'Person', name: work.creator };
  return {
    '@context': 'https://schema.org',
    '@type': WORK_TYPE[work.medium],
    name: work.title,
    [CREATOR_PROP[work.medium]]: person,
    ...(work.year != null ? { datePublished: String(work.year) } : {}),
    review: {
      '@type': 'Review',
      name: rating.verdict,
      reviewBody: rating.synopsis,
      reviewRating: { '@type': 'Rating', ratingValue: rating.score, bestRating: 10, worstRating: 1 },
      author: { '@type': 'Organization', name: 'IsItSmut' },
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/seo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo.ts tests/unit/seo.test.ts
git commit -m "feat(seo): buildJsonLd (Book/Movie/TVSeries + nested Review)"
```

---

### Task 3: `resultMetadata`

**Files:**
- Modify: `src/lib/seo.ts`
- Test: `tests/unit/seo.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```ts
import { resultMetadata } from '@/lib/seo';

describe('resultMetadata', () => {
  it('builds indexable metadata for a known rating', () => {
    const m = resultMetadata(work, known);
    expect(m.title).toBe('Is "Fourth Wing" Smut? Yes, it\'s smut. (8/10) — IsItSmut');
    expect(m.alternates?.canonical).toBe('/r/fourth-wing-yarros-2023');
    // robots undefined/index:true => indexable
    expect(m.robots).toBeUndefined();
    expect(m.openGraph?.title).toBe('Is "Fourth Wing" Smut? Yes, it\'s smut. (8/10) — IsItSmut');
    expect(m.twitter?.card).toBe('summary_large_image');
    expect(typeof m.description).toBe('string');
    expect((m.description as string).length).toBeLessThanOrEqual(160);
  });

  it('noindexes an unknown rating but keeps a canonical', () => {
    const m = resultMetadata(work, { slug: work.slug, known: false, model: 'm', rated_at: '0', view_count: 0 });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.alternates?.canonical).toBe('/r/fourth-wing-yarros-2023');
    expect(m.title).toBe('Fourth Wing — IsItSmut');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/seo.test.ts`
Expected: FAIL — `resultMetadata is not a function`.

- [ ] **Step 3: Write minimal implementation** (append to `src/lib/seo.ts`)

```ts
import type { Metadata } from 'next';

function clamp(s: string, max = 155): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

export function resultMetadata(work: Work, rating: Rating): Metadata {
  const canonical = `/r/${work.slug}`;
  if (!rating.known) {
    return {
      title: `${work.title} — IsItSmut`,
      description: `We don't have a smut rating for ${work.title} yet.`,
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }
  const title = `Is "${work.title}" Smut? ${rating.verdict} (${rating.score}/10) — IsItSmut`;
  const description = clamp(
    `${rating.verdict} ${work.title} by ${work.creator} scores ${rating.score}/10 for sexual content. ${rating.synopsis}`
  );
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'article', url: canonical },
    twitter: { card: 'summary_large_image', title, description },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/seo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo.ts tests/unit/seo.test.ts
git commit -m "feat(seo): resultMetadata builder (title/desc/canonical/og/twitter/noindex)"
```

---

## Group B — Result-page wiring

### Task 4: `metadataBase` + default OpenGraph in root layout

**Files:**
- Modify: `src/app/layout.tsx:7-10`
- Test: `tests/integration/layout-metadata.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/layout-metadata.test.ts
import { describe, it, expect } from 'vitest';
import { metadata } from '@/app/layout';

describe('root layout metadata', () => {
  it('sets metadataBase to the apex origin', () => {
    expect(metadata.metadataBase?.toString()).toBe('https://isitsmut.com/');
  });
  it('declares a default openGraph site name and locale', () => {
    expect(metadata.openGraph?.siteName).toBe('IsItSmut');
    expect(metadata.openGraph?.type).toBe('website');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/integration/layout-metadata.test.ts`
Expected: FAIL — `metadataBase` undefined.

- [ ] **Step 3: Write minimal implementation** — replace the `metadata` export in `src/app/layout.tsx`

```ts
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'IsItSmut — Find out before you start chapter one.',
  description: "Look up any book, movie, or TV show and see if it contains smut. 1–10 rating, short synopsis, and a (blurred) breakdown of what's in it.",
  openGraph: {
    siteName: 'IsItSmut',
    type: 'website',
  },
};
```

(Keep the existing `import` lines; add the `SITE_URL` import at the top with the others.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/integration/layout-metadata.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx tests/integration/layout-metadata.test.ts
git commit -m "feat(seo): metadataBase (apex) + default OpenGraph in root layout"
```

---

### Task 5: Wire `resultMetadata` into the result page

**Files:**
- Modify: `src/app/r/[slug]/page.tsx:54-62` (the `generateMetadata` function)

**Note:** No new unit test — page-level `generateMetadata` reads from Supabase and is covered by the `resultMetadata` unit tests (Task 3) plus the manual verification in Task 14. This step is wiring only.

- [ ] **Step 1: Replace `generateMetadata`** in `src/app/r/[slug]/page.tsx`

```ts
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = await fetchWork(slug);
  if (!work) {
    return { title: 'Not found — IsItSmut', robots: { index: false, follow: true } };
  }
  const rating = await getCachedRating(slug);
  // No cached rating yet (page reached via search params): treat as unknown for indexing.
  return resultMetadata(work, rating ?? { slug, known: false, model: '', rated_at: '', view_count: 0 });
}
```

Add the import at the top of the file:

```ts
import { resultMetadata } from '@/lib/seo';
```

(`getCachedRating` is already imported.)

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/app/r/[slug]/page.tsx
git commit -m "feat(seo): rich result-page metadata via resultMetadata + noindex unknowns"
```

---

### Task 6: `JsonLd` component, Q&A block, fix Suggest-a-rating link

**Files:**
- Create: `src/components/JsonLd.tsx`
- Test: `tests/unit/JsonLd.test.tsx`
- Modify: `src/components/ResultCard.tsx`
- Modify: `tests/unit/ResultCard.test.tsx`
- Modify: `src/app/r/[slug]/page.tsx` (render `<JsonLd>`)

- [ ] **Step 1: Write the failing test for `JsonLd`**

```tsx
// tests/unit/JsonLd.test.tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { JsonLd } from '@/components/JsonLd';

describe('JsonLd', () => {
  it('renders a ld+json script with the serialized data', () => {
    const { container } = render(<JsonLd data={{ '@type': 'Book', name: 'X' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent!)).toEqual({ '@type': 'Book', name: 'X' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/JsonLd.test.tsx`
Expected: FAIL — `Cannot find module '@/components/JsonLd'`.

- [ ] **Step 3: Implement `JsonLd`**

```tsx
// src/components/JsonLd.tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/JsonLd.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the Q&A line + fix the placeholder link in `ResultCard`**

In `src/components/ResultCard.tsx`:

1. Add the import at the top:

```ts
import { buildQuestionAnswer } from '@/lib/seo';
```

2. Replace the placeholder constant:

```ts
const SUGGEST_URL = 'mailto:tworden1993@gmail.com?subject=IsItSmut%20rating%20suggestion';
```

3. In the `known` branch, insert the Q&A paragraph immediately after the title/creator `<div>` (before the `synopsis` `<p>` at line 54):

```tsx
<p className="text-sm font-semibold text-[color:var(--color-ink)]">
  {buildQuestionAnswer(work, rating)}
</p>
```

- [ ] **Step 6: Update the `ResultCard` test** — add an assertion in the "known" test (after the existing `getByText(/war college/i)` line):

```ts
expect(screen.getByText(/is fourth wing smut\?/i)).toBeInTheDocument();
```

- [ ] **Step 7: Render `<JsonLd>` in the result page**

In `src/app/r/[slug]/page.tsx`, add imports:

```ts
import { JsonLd } from '@/components/JsonLd';
import { buildJsonLd } from '@/lib/seo';
```

Replace the final `return` (line 51) with:

```tsx
  return (
    <>
      {rating.known && <JsonLd data={buildJsonLd(work, rating)} />}
      <ResultCard work={work} rating={rating} shareUrl={shareUrl} />
    </>
  );
```

- [ ] **Step 8: Run the affected tests + typecheck**

Run: `pnpm test -- tests/unit/JsonLd.test.tsx tests/unit/ResultCard.test.tsx && pnpm typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/JsonLd.tsx tests/unit/JsonLd.test.tsx src/components/ResultCard.tsx tests/unit/ResultCard.test.tsx src/app/r/[slug]/page.tsx
git commit -m "feat(seo): JSON-LD on result pages, visible Q&A line, fix suggest link"
```

---

## Group C — Sitemap

### Task 7: Sitemap data + pure entry builder

**Files:**
- Create: `src/lib/sitemap.ts`
- Test: `tests/unit/sitemap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/sitemap.test.ts
import { describe, it, expect } from 'vitest';
import { buildSitemapEntries, STATIC_PATHS } from '@/lib/sitemap';

describe('buildSitemapEntries', () => {
  it('includes every static path plus one entry per rated page', () => {
    const entries = buildSitemapEntries(
      [{ slug: 'a-book', rated_at: '2026-01-02T00:00:00.000Z' }],
      'https://isitsmut.com'
    );
    const urls = entries.map((e) => e.url);
    for (const p of STATIC_PATHS) expect(urls).toContain(`https://isitsmut.com${p}`);
    expect(urls).toContain('https://isitsmut.com/r/a-book');
    const ratedEntry = entries.find((e) => e.url.endsWith('/r/a-book'))!;
    expect(ratedEntry.lastModified).toEqual(new Date('2026-01-02T00:00:00.000Z'));
  });

  it('returns only static paths when there are no rated pages', () => {
    const entries = buildSitemapEntries([], 'https://isitsmut.com');
    expect(entries).toHaveLength(STATIC_PATHS.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/sitemap.test.ts`
Expected: FAIL — `Cannot find module '@/lib/sitemap'`.

- [ ] **Step 3: Implement `src/lib/sitemap.ts`**

```ts
import type { MetadataRoute } from 'next';
import { supabaseServer } from './supabase-server';

// Static + hub routes. Keep in sync with the hub pages created in Group D.
export const STATIC_PATHS = ['/', '/top', '/books', '/movies', '/tv', '/tamest', '/about', '/privacy', '/terms'] as const;

export type RatedPage = { slug: string; rated_at: string };

export function buildSitemapEntries(rated: RatedPage[], baseUrl: string): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({ url: `${baseUrl}${p}` }));
  const ratedEntries: MetadataRoute.Sitemap = rated.map((r) => ({
    url: `${baseUrl}/r/${r.slug}`,
    lastModified: new Date(r.rated_at),
  }));
  return [...staticEntries, ...ratedEntries];
}

export async function getRatedPages(): Promise<RatedPage[]> {
  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from('ratings')
      .select('slug, rated_at')
      .eq('known', true)
      .order('rated_at', { ascending: false });
    if (error || !data) return [];
    return data as RatedPage[];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/sitemap.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sitemap.ts tests/unit/sitemap.test.ts
git commit -m "feat(seo): sitemap entry builder + rated-pages query"
```

---

### Task 8: `app/sitemap.ts` route

**Files:**
- Create: `src/app/sitemap.ts`

**Note:** Wiring only — the builder and query are unit-tested in Task 7; the live route is verified manually in Task 14.

- [ ] **Step 1: Implement the route**

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { buildSitemapEntries, getRatedPages } from '@/lib/sitemap';
import { SITE_URL } from '@/lib/seo';

export const runtime = 'nodejs';
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rated = await getRatedPages();
  return buildSitemapEntries(rated, SITE_URL);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): dynamic /sitemap.xml from rated pages + static routes"
```

---

## Group D — Leaderboard refactor + hub pages

### Task 9: Generalize the leaderboard query (medium filter + order)

**Files:**
- Modify: `src/lib/leaderboard.ts`
- Modify: `tests/unit/leaderboard.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `tests/unit/leaderboard.test.ts`

```ts
import { getRatingsByMedium, getTamestRatings } from '@/lib/leaderboard';

describe('getRatingsByMedium', () => {
  beforeEach(() => { limitMock.mockReset(); });
  it('filters by medium and returns adjusted entries (smuttiest first)', async () => {
    limitMock.mockResolvedValueOnce({
      data: [row({ slug: 'b1', score: 9, medium: 'book' }), row({ slug: 'b2', score: 8, medium: 'book' })],
      error: null,
    });
    const result = await getRatingsByMedium('book', 50);
    expect(supabaseMock.eq).toHaveBeenCalledWith('works.medium', 'book');
    expect(result.map((r) => r.score)).toEqual([9, 9]); // raw 9->9, raw 8->9
  });
});

describe('getTamestRatings', () => {
  beforeEach(() => { limitMock.mockReset(); });
  it('orders by adjusted score ascending', async () => {
    limitMock.mockResolvedValueOnce({
      data: [row({ slug: 'low', score: 1 }), row({ slug: 'mid', score: 5 }), row({ slug: 'hi', score: 9 })],
      error: null,
    });
    const result = await getTamestRatings(50);
    expect(result.map((r) => r.slug)).toEqual(['low', 'mid', 'hi']); // adjusted 1,6,9
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/leaderboard.test.ts`
Expected: FAIL — `getRatingsByMedium`/`getTamestRatings` are not exported.

- [ ] **Step 3: Refactor `src/lib/leaderboard.ts`**

Replace the body of `getTopRatings` with a shared private query and add the two new exports. Keep the existing `LeaderboardEntry`, `Row` types and imports at the top unchanged.

```ts
type Order = 'smuttiest' | 'tamest';

async function queryRatings(opts: { medium?: Medium; order: Order; limit: number }): Promise<LeaderboardEntry[]> {
  try {
    const sb = supabaseServer();
    let q = sb
      .from('ratings')
      .select('slug, score, view_count, works!inner(title, creator, medium, year)')
      .eq('known', true)
      .not('score', 'is', null);

    if (opts.medium) q = q.eq('works.medium', opts.medium);

    const ascending = opts.order === 'tamest';
    const { data, error } = await q
      .order('score', { ascending })
      .order('view_count', { ascending: false })
      .order('slug', { ascending: true })
      .limit(opts.limit);

    if (error) {
      console.error('leaderboard query error:', error);
      return [];
    }
    if (!data) return [];

    const rows = data as unknown as Row[];
    const dir = opts.order === 'tamest' ? 1 : -1;
    return rows
      .map((r): LeaderboardEntry => {
        const adjusted = adjustScore(r.score);
        return {
          slug: r.slug,
          title: r.works.title,
          creator: r.works.creator,
          medium: r.works.medium,
          year: r.works.year,
          score: adjusted,
          verdict: verdictFromScore(adjusted),
          viewCount: r.view_count,
        };
      })
      .sort((a, b) => {
        if (a.score !== b.score) return (a.score - b.score) * dir;
        if (a.viewCount !== b.viewCount) return b.viewCount - a.viewCount;
        return a.slug.localeCompare(b.slug);
      });
  } catch (err) {
    console.error('leaderboard exception:', err);
    return [];
  }
}

export async function getTopRatings(limit: number): Promise<LeaderboardEntry[]> {
  return queryRatings({ order: 'smuttiest', limit });
}

export async function getRatingsByMedium(medium: Medium, limit: number): Promise<LeaderboardEntry[]> {
  return queryRatings({ medium, order: 'smuttiest', limit });
}

export async function getTamestRatings(limit: number): Promise<LeaderboardEntry[]> {
  return queryRatings({ order: 'tamest', limit });
}
```

- [ ] **Step 4: Run the full leaderboard test (old + new must pass)**

Run: `pnpm test -- tests/unit/leaderboard.test.ts`
Expected: PASS — including the original `getTopRatings` tests (query shape for the no-medium, descending case is unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard.ts tests/unit/leaderboard.test.ts
git commit -m "refactor(leaderboard): shared query with medium filter + order (smuttiest/tamest)"
```

---

### Task 10: Hub pages (`/books`, `/movies`, `/tv`, `/tamest`)

**Files:**
- Create: `src/components/BrowseList.tsx`
- Test: `tests/unit/BrowseList.test.tsx`
- Create: `src/app/books/page.tsx`, `src/app/movies/page.tsx`, `src/app/tv/page.tsx`, `src/app/tamest/page.tsx`

- [ ] **Step 1: Write the failing test for `BrowseList`**

```tsx
// tests/unit/BrowseList.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowseList } from '@/components/BrowseList';
import type { LeaderboardEntry } from '@/lib/leaderboard';

const entries: LeaderboardEntry[] = [
  { slug: 'a', title: 'Alpha', creator: 'Auth', medium: 'book', year: 2020, score: 9, verdict: 'Absolutely smut.', viewCount: 0 },
];

describe('BrowseList', () => {
  it('renders the heading, intro, and a row linking to the result page', () => {
    render(<BrowseList heading="The Smuttiest Books" intro="Ranked 1–10." entries={entries} />);
    expect(screen.getByRole('heading', { level: 1, name: /smuttiest books/i })).toBeInTheDocument();
    expect(screen.getByText(/ranked 1–10/i)).toBeInTheDocument();
    expect(screen.getByText('Alpha').closest('a')).toHaveAttribute('href', '/r/a');
  });

  it('shows an empty-state message when there are no entries', () => {
    render(<BrowseList heading="The Smuttiest Movies" intro="x" entries={[]} />);
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/BrowseList.test.tsx`
Expected: FAIL — `Cannot find module '@/components/BrowseList'`.

- [ ] **Step 3: Implement `BrowseList`** (reuses `LeaderboardRow`)

```tsx
// src/components/BrowseList.tsx
import { LeaderboardRow } from './LeaderboardRow';
import type { LeaderboardEntry } from '@/lib/leaderboard';

type Props = { heading: string; intro: string; entries: LeaderboardEntry[] };

export function BrowseList({ heading, intro, entries }: Props) {
  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-[color:var(--color-brand)]">{heading}</h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">{intro}</p>
      </header>
      {entries.length === 0 ? (
        <p className="text-center text-sm text-[color:var(--color-ink-muted)]">Nothing here yet — check back soon.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <LeaderboardRow key={entry.slug} rank={i + 1} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/BrowseList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Create the four hub pages**

```tsx
// src/app/books/page.tsx
import type { Metadata } from 'next';
import { BrowseList } from '@/components/BrowseList';
import { getRatingsByMedium } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'The Smuttiest Books, Rated 1–10 — IsItSmut',
  description: 'Browse books by smut rating: which novels are spicy, which are clean, and exactly how explicit each one gets.',
  alternates: { canonical: '/books' },
};

export default async function BooksPage() {
  const entries = await getRatingsByMedium('book', 100);
  return <BrowseList heading="The Smuttiest Books, Rated 1–10" intro="Every book we've rated, hottest first." entries={entries} />;
}
```

```tsx
// src/app/movies/page.tsx
import type { Metadata } from 'next';
import { BrowseList } from '@/components/BrowseList';
import { getRatingsByMedium } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'The Smuttiest Movies, Rated 1–10 — IsItSmut',
  description: 'Browse movies by smut rating: how explicit each film gets, ranked hottest first.',
  alternates: { canonical: '/movies' },
};

export default async function MoviesPage() {
  const entries = await getRatingsByMedium('movie', 100);
  return <BrowseList heading="The Smuttiest Movies, Rated 1–10" intro="Every movie we've rated, hottest first." entries={entries} />;
}
```

```tsx
// src/app/tv/page.tsx
import type { Metadata } from 'next';
import { BrowseList } from '@/components/BrowseList';
import { getRatingsByMedium } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'The Smuttiest TV Shows, Rated 1–10 — IsItSmut',
  description: 'Browse TV shows by smut rating: how explicit each series gets, ranked hottest first.',
  alternates: { canonical: '/tv' },
};

export default async function TvPage() {
  const entries = await getRatingsByMedium('tv', 100);
  return <BrowseList heading="The Smuttiest TV Shows, Rated 1–10" intro="Every show we've rated, hottest first." entries={entries} />;
}
```

```tsx
// src/app/tamest/page.tsx
import type { Metadata } from 'next';
import { BrowseList } from '@/components/BrowseList';
import { getTamestRatings } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'The Tamest, Cleanest Books, Movies & Shows — IsItSmut',
  description: 'Looking for something clean? The lowest-rated, least-spicy titles we have, ranked tamest first.',
  alternates: { canonical: '/tamest' },
};

export default async function TamestPage() {
  const entries = await getTamestRatings(100);
  return <BrowseList heading="The Tamest Picks" intro="The cleanest, least-spicy titles we've rated." entries={entries} />;
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/BrowseList.tsx tests/unit/BrowseList.test.tsx src/app/books src/app/movies src/app/tv src/app/tamest
git commit -m "feat(seo): hub pages — /books /movies /tv (smuttiest) and /tamest"
```

---

### Task 11: Add hub links to the footer nav

**Files:**
- Modify: `src/components/Footer.tsx:7-13`
- Modify: `tests/unit/Footer.test.tsx`

- [ ] **Step 1: Write the failing test** — add to `tests/unit/Footer.test.tsx` (inside the existing `describe`)

```ts
it('links to the browse hub pages', () => {
  render(<Footer />);
  expect(screen.getByRole('link', { name: 'Books' })).toHaveAttribute('href', '/books');
  expect(screen.getByRole('link', { name: 'Movies' })).toHaveAttribute('href', '/movies');
  expect(screen.getByRole('link', { name: 'TV' })).toHaveAttribute('href', '/tv');
});
```

If `Footer.test.tsx` does not already import `render`/`screen`/`Footer`, mirror the imports used by the existing tests in that file.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/Footer.test.tsx`
Expected: FAIL — no "Books" link.

- [ ] **Step 3: Add the links** — replace the `<nav>` in `src/components/Footer.tsx`

```tsx
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link href="/" className="hover:text-[color:var(--color-brand)]">Home</Link>
        <Link href="/top" className="hover:text-[color:var(--color-brand)]">Top 10</Link>
        <Link href="/books" className="hover:text-[color:var(--color-brand)]">Books</Link>
        <Link href="/movies" className="hover:text-[color:var(--color-brand)]">Movies</Link>
        <Link href="/tv" className="hover:text-[color:var(--color-brand)]">TV</Link>
        <Link href="/about" className="hover:text-[color:var(--color-brand)]">About</Link>
        <Link href="/terms" className="hover:text-[color:var(--color-brand)]">Terms</Link>
        <Link href="/privacy" className="hover:text-[color:var(--color-brand)]">Privacy</Link>
      </nav>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/Footer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Footer.tsx tests/unit/Footer.test.tsx
git commit -m "feat(seo): footer nav links to browse hubs"
```

---

## Group E — Related titles (internal linking)

### Task 12: `getRelatedTitles` + `RelatedTitles` component on result pages

**Files:**
- Create: `src/lib/related.ts`
- Test: `tests/unit/related.test.ts`
- Create: `src/components/RelatedTitles.tsx`
- Test: `tests/unit/RelatedTitles.test.tsx`
- Modify: `src/app/r/[slug]/page.tsx`

- [ ] **Step 1: Write the failing test for `getRelatedTitles`**

```ts
// tests/unit/related.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { supabaseMock, limitMock } = vi.hoisted(() => {
  const limit = vi.fn();
  return {
    limitMock: limit,
    supabaseMock: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
    },
  };
});
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: () => supabaseMock }));

import { getRelatedTitles } from '@/lib/related';

function row(slug: string, score = 8) {
  return { slug, score, view_count: 0, works: { title: slug, creator: 'A', medium: 'book', year: 2020 } };
}

describe('getRelatedTitles', () => {
  beforeEach(() => { limitMock.mockReset(); });

  it('excludes the current slug and filters by medium', async () => {
    limitMock.mockResolvedValueOnce({ data: [row('other')], error: null });
    const result = await getRelatedTitles('current', 'book', 4);
    expect(supabaseMock.eq).toHaveBeenCalledWith('works.medium', 'book');
    expect(supabaseMock.neq).toHaveBeenCalledWith('slug', 'current');
    expect(result.map((r) => r.slug)).toEqual(['other']);
  });

  it('returns [] on error', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: { message: 'x' } });
    expect(await getRelatedTitles('s', 'book', 4)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/related.test.ts`
Expected: FAIL — `Cannot find module '@/lib/related'`.

- [ ] **Step 3: Implement `src/lib/related.ts`**

```ts
import { supabaseServer } from './supabase-server';
import { adjustScore, verdictFromScore } from './verdict';
import type { LeaderboardEntry } from './leaderboard';
import type { Medium } from './types';

type Row = {
  slug: string;
  score: number;
  view_count: number;
  works: { title: string; creator: string; medium: Medium; year: number | null };
};

export async function getRelatedTitles(slug: string, medium: Medium, limit: number): Promise<LeaderboardEntry[]> {
  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from('ratings')
      .select('slug, score, view_count, works!inner(title, creator, medium, year)')
      .eq('known', true)
      .not('score', 'is', null)
      .eq('works.medium', medium)
      .neq('slug', slug)
      .order('view_count', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as unknown as Row[]).map((r): LeaderboardEntry => {
      const adjusted = adjustScore(r.score);
      return {
        slug: r.slug,
        title: r.works.title,
        creator: r.works.creator,
        medium: r.works.medium,
        year: r.works.year,
        score: adjusted,
        verdict: verdictFromScore(adjusted),
        viewCount: r.view_count,
      };
    });
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/related.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for `RelatedTitles`**

```tsx
// tests/unit/RelatedTitles.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RelatedTitles } from '@/components/RelatedTitles';
import type { LeaderboardEntry } from '@/lib/leaderboard';

const entries: LeaderboardEntry[] = [
  { slug: 'a', title: 'Alpha', creator: 'Auth', medium: 'book', year: 2020, score: 9, verdict: 'Absolutely smut.', viewCount: 0 },
];

describe('RelatedTitles', () => {
  it('renders links to related result pages with a hub link', () => {
    render(<RelatedTitles entries={entries} medium="book" />);
    expect(screen.getByText('Alpha').closest('a')).toHaveAttribute('href', '/r/a');
    expect(screen.getByRole('link', { name: /more books/i })).toHaveAttribute('href', '/books');
  });

  it('renders nothing when there are no related entries', () => {
    const { container } = render(<RelatedTitles entries={[]} medium="book" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm test -- tests/unit/RelatedTitles.test.tsx`
Expected: FAIL — `Cannot find module '@/components/RelatedTitles'`.

- [ ] **Step 7: Implement `src/components/RelatedTitles.tsx`**

```tsx
// src/components/RelatedTitles.tsx
import Link from 'next/link';
import type { LeaderboardEntry } from '@/lib/leaderboard';
import type { Medium } from '@/lib/types';

const HUB_PATH: Record<Medium, string> = { book: '/books', movie: '/movies', tv: '/tv' };
const HUB_LABEL: Record<Medium, string> = { book: 'More books', movie: 'More movies', tv: 'More TV' };

export function RelatedTitles({ entries, medium }: { entries: LeaderboardEntry[]; medium: Medium }) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-8 space-y-2">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand)]">
        More like this
      </h2>
      <div className="space-y-2">
        {entries.map((entry) => (
          <Link
            key={entry.slug}
            href={`/r/${entry.slug}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--color-surface-card)] px-3 py-2 text-sm hover:bg-[color:var(--color-accent)]"
          >
            <span className="truncate font-semibold text-[color:var(--color-ink)]">{entry.title}</span>
            <span className="shrink-0 rounded-full bg-[color:var(--color-brand)] px-2 py-0.5 text-[11px] font-bold text-white">
              {entry.score}/10
            </span>
          </Link>
        ))}
      </div>
      <div className="pt-1 text-right">
        <Link href={HUB_PATH[medium]} className="text-xs font-bold text-[color:var(--color-brand)] hover:underline">
          {HUB_LABEL[medium]} →
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm test -- tests/unit/RelatedTitles.test.tsx`
Expected: PASS.

- [ ] **Step 9: Render related titles in the result page**

In `src/app/r/[slug]/page.tsx`, add imports:

```ts
import { RelatedTitles } from '@/components/RelatedTitles';
import { getRelatedTitles } from '@/lib/related';
```

Then, just before the final `return`, fetch related entries (only when the rating is known):

```ts
  const related = rating.known ? await getRelatedTitles(slug, work.medium, 4) : [];
```

And update the returned JSX to include it after `<ResultCard>`:

```tsx
  return (
    <>
      {rating.known && <JsonLd data={buildJsonLd(work, rating)} />}
      <ResultCard work={work} rating={rating} shareUrl={shareUrl} />
      {rating.known && <RelatedTitles entries={related} medium={work.medium} />}
    </>
  );
```

- [ ] **Step 10: Run affected tests + typecheck**

Run: `pnpm test -- tests/unit/related.test.ts tests/unit/RelatedTitles.test.tsx && pnpm typecheck`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/lib/related.ts tests/unit/related.test.ts src/components/RelatedTitles.tsx tests/unit/RelatedTitles.test.tsx src/app/r/[slug]/page.tsx
git commit -m "feat(seo): related-titles internal links on result pages"
```

---

## Group F — Seed corpus

### Task 13: `scripts/seed-popular.ts`

**Files:**
- Create: `scripts/seed-popular.ts`

**Note:** One-off operational script (no unit test), modeled exactly on `scripts/seed-leaderboard.ts`. It is idempotent — cache hits skip Claude. The title list below is a real, runnable starting corpus spanning genres and media; extend it toward the ~100–300 target in the spec by appending more `{ query, expect }` rows (same format). Titles Claude returns `known:false` for simply won't produce pages (handled later by the Coverage spec).

- [ ] **Step 1: Create the script**

```ts
// scripts/seed-popular.ts
//
// Seeds prod (or local) Supabase with a broad corpus of popular titles across
// genres and media, so the sitemap and hub pages have indexable content on day
// one. Runs each query through the real disambiguate + rate flow. Idempotent —
// cache hits skip Claude.
//
// Usage (loads env from .env.local — populate with PROD creds before running):
//   pnpm dlx tsx --env-file=.env.local scripts/seed-popular.ts
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ANTHROPIC_API_KEY, RATE_LIMIT_SALT.

import { runDisambiguate } from '../src/lib/disambiguate';
import { runRate } from '../src/lib/rate';
import type { Medium } from '../src/lib/types';

type SeedItem = { query: string; expect: Medium };

const SEED: SeedItem[] = [
  // Romance / romantasy (high-volume "is it smut" searches)
  { query: 'It Ends with Us by Colleen Hoover', expect: 'book' },
  { query: 'Verity by Colleen Hoover', expect: 'book' },
  { query: 'Ugly Love by Colleen Hoover', expect: 'book' },
  { query: 'A Court of Thorns and Roses by Sarah J. Maas', expect: 'book' },
  { query: 'A Court of Mist and Fury by Sarah J. Maas', expect: 'book' },
  { query: 'Iron Flame by Rebecca Yarros', expect: 'book' },
  { query: 'Fourth Wing by Rebecca Yarros', expect: 'book' },
  { query: 'The Love Hypothesis by Ali Hazelwood', expect: 'book' },
  { query: 'Beach Read by Emily Henry', expect: 'book' },
  { query: 'People We Meet on Vacation by Emily Henry', expect: 'book' },
  { query: 'Book Lovers by Emily Henry', expect: 'book' },
  { query: 'Icebreaker by Hannah Grace', expect: 'book' },
  { query: 'Twisted Love by Ana Huang', expect: 'book' },
  { query: 'Haunting Adeline by H.D. Carlton', expect: 'book' },
  { query: 'Fifty Shades of Grey by E.L. James', expect: 'book' },
  { query: 'The Spanish Love Deception by Elena Armas', expect: 'book' },
  { query: 'Punk 57 by Penelope Douglas', expect: 'book' },
  { query: 'Credence by Penelope Douglas', expect: 'book' },
  { query: 'The Seven Husbands of Evelyn Hugo by Taylor Jenkins Reid', expect: 'book' },
  { query: 'Outlander by Diana Gabaldon', expect: 'book' },
  // Classics / literary (often searched to check spice level)
  { query: 'Pride and Prejudice by Jane Austen', expect: 'book' },
  { query: 'Lady Chatterley\'s Lover by D.H. Lawrence', expect: 'book' },
  { query: 'Lolita by Vladimir Nabokov', expect: 'book' },
  { query: 'The Great Gatsby by F. Scott Fitzgerald', expect: 'book' },
  { query: 'Wuthering Heights by Emily Bronte', expect: 'book' },
  { query: 'Normal People by Sally Rooney', expect: 'book' },
  { query: 'Call Me by Your Name by Andre Aciman', expect: 'book' },
  // YA / fantasy (commonly checked by parents)
  { query: 'The Hunger Games by Suzanne Collins', expect: 'book' },
  { query: 'Twilight by Stephenie Meyer', expect: 'book' },
  { query: 'Throne of Glass by Sarah J. Maas', expect: 'book' },
  { query: 'Six of Crows by Leigh Bardugo', expect: 'book' },
  { query: 'The Cruel Prince by Holly Black', expect: 'book' },
  // Movies
  { query: 'Fifty Shades of Grey 2015 film', expect: 'movie' },
  { query: '365 Days 2020 film', expect: 'movie' },
  { query: 'Blue Is the Warmest Color 2013 film', expect: 'movie' },
  { query: '9 1/2 Weeks 1986 film', expect: 'movie' },
  { query: 'Basic Instinct 1992 film', expect: 'movie' },
  { query: 'Call Me by Your Name 2017 film', expect: 'movie' },
  { query: 'Titanic 1997 film', expect: 'movie' },
  { query: 'The Notebook 2004 film', expect: 'movie' },
  { query: 'Black Swan 2010 film', expect: 'movie' },
  { query: 'Eyes Wide Shut 1999 film', expect: 'movie' },
  // TV
  { query: 'Bridgerton Netflix series', expect: 'tv' },
  { query: 'Outlander Starz TV series', expect: 'tv' },
  { query: 'Sex/Life Netflix series', expect: 'tv' },
  { query: 'Euphoria HBO series', expect: 'tv' },
  { query: 'Game of Thrones HBO series', expect: 'tv' },
  { query: 'Normal People BBC Hulu series', expect: 'tv' },
  { query: 'Sex Education Netflix series', expect: 'tv' },
  { query: 'Gossip Girl 2007 series', expect: 'tv' },
  { query: 'You Netflix series', expect: 'tv' },
  { query: 'The Idol HBO series', expect: 'tv' },
];

async function seed() {
  let ok = 0, unknown = 0, skipped = 0, failed = 0;
  for (const { query, expect } of SEED) {
    console.log(`\n→ ${query}  (expecting ${expect})`);
    try {
      const { candidates } = await runDisambiguate(query);
      if (candidates.length === 0) {
        console.log('  ✗ No candidates returned by Claude');
        skipped++;
        continue;
      }
      const match = candidates.find((c) => c.medium === expect) ?? candidates[0];
      if (match.medium !== expect) {
        console.log(`  ⚠ Best match is ${match.medium}, expected ${expect}. Proceeding with ${match.title}.`);
      }
      console.log(`  matched: ${match.title} (${match.creator}, ${match.year}, ${match.medium}) → ${match.slug}`);
      const result = await runRate({ slug: match.slug, candidate: match });
      if (result.rating.known) {
        console.log(`  ✓ ${result.rating.score}/10 — ${result.rating.verdict}${result.cacheHit ? ' (cached)' : ''}`);
        ok++;
      } else {
        console.log('  ⚠ Claude returned known=false');
        unknown++;
      }
    } catch (err) {
      console.error('  ✗ Error:', err instanceof Error ? err.message : err);
      failed++;
    }
  }
  console.log(`\n=== Done — ok: ${ok}, unknown: ${unknown}, skipped: ${skipped}, failed: ${failed} ===`);
}

seed().then(() => process.exit(0));
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-popular.ts
git commit -m "feat(seo): seed-popular script — broad popular-titles corpus"
```

- [ ] **Step 4: Run against prod (manual, operator step — do NOT run in CI)**

Ensure `.env.local` holds PROD credentials, then:

```bash
pnpm dlx tsx --env-file=.env.local scripts/seed-popular.ts
```

Expected: a per-title log and a final summary. Re-running is safe (cached titles skip Claude). Note in the summary how many returned `known=false` — that list is input for the Coverage spec.

---

## Group G — Full verification

### Task 14: Whole-suite verification + manual SEO checks

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit/integration suite**

Run: `pnpm test`
Expected: all tests pass (existing + new).

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: build succeeds; `/sitemap.xml`, `/books`, `/movies`, `/tv`, `/tamest` appear in the route output.

- [ ] **Step 4: Manual checks against a local `pnpm start` (or preview deploy)**

- [ ] `curl -s http://localhost:3000/sitemap.xml` returns 200 XML containing `/r/<a-known-slug>` and the hub paths; a known `known:false` slug is **absent**.
- [ ] View source of a known result page: confirm `<link rel="canonical" href="https://isitsmut.com/r/...">`, the `<script type="application/ld+json">` block, OpenGraph/Twitter tags, and the visible "Is X smut?" line.
- [ ] View source of an unknown result page: confirm `<meta name="robots" content="noindex, follow">`.
- [ ] Paste the result-page JSON-LD into Google's Rich Results Test / Schema.org validator — no errors.
- [ ] Lighthouse SEO audit on a result page ≈ 100.

- [ ] **Step 5: Operator follow-up (document in PR description, not a code step)**

- [ ] In Vercel → Domains, set `isitsmut.com` (apex) as primary and `www.isitsmut.com` as a redirect. Then confirm apex serves 200 and `www` 301s to apex.
- [ ] In Google Search Console, submit `https://isitsmut.com/sitemap.xml`.

- [ ] **Step 6: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore(seo): verification fixes"
```

---

## Spec coverage map

| Spec section | Task(s) |
|---|---|
| A1 metadataBase + canonical | 3 (canonical), 4 (metadataBase), 5, 10 (hub canonicals) |
| A1 Vercel domain flip (manual) | 14 Step 5 |
| A2 dynamic sitemap | 7, 8 |
| A3 noindex no-score pages | 3, 5 |
| B1 richer metadata | 3, 5 |
| B2 visible Q&A block | 1, 6 |
| B3 JSON-LD (Book/Movie/TVSeries + Review) | 2, 6 |
| B4 internal linking (related) | 12 |
| B5 fix Suggest-a-rating placeholder | 6 |
| C hub/browse pages | 9, 10, 11 |
| D seed corpus | 13 |
| ISR (hubs only; result pages stay dynamic SSR — see spec) | 8, 10 |
| Error handling (graceful degradation) | 7 (sitemap), 9 (leaderboard), 12 (related) |
| Testing | every task + 14 |
