# Homepage Refresh + Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a peach/blush gradient hero block and a top-3 leaderboard preview to the homepage, create a dedicated `/top` page showing the full top 10, and seed the leaderboard with 15 well-known erotic-leaning titles via a one-off script.

**Architecture:** Server-component homepage + `/top` page that fetch from a new `getTopRatings(limit)` data function. Existing client-side search experience is extracted into its own component so the homepage can be server-rendered. Three new UI components: `Hero`, `LeaderboardRow`, `LeaderboardSection`. Score adjustment applied at read time (consistent with existing `getCachedRating`). One-off `scripts/seed-leaderboard.ts` runs 15 titles through the existing `runDisambiguate` + `runRate` flow.

**Tech Stack:** Next.js 15 App Router (server components, `revalidate`) · Supabase PostgREST embedded select for ratings↔works join · Vitest + React Testing Library · Existing Anthropic SDK + Supabase clients · `tsx` (via `pnpm dlx`) for running the TS seed script.

**Spec:** `docs/superpowers/specs/2026-05-19-homepage-refresh-leaderboard-design.md`

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                          # MODIFY — becomes server component, composes Hero + SearchExperience + LeaderboardSection
│   └── top/
│       └── page.tsx                      # NEW — full top 10 page
├── components/
│   ├── Hero.tsx                          # NEW — gradient hero block (server component)
│   ├── LeaderboardRow.tsx                # NEW — single ranked row (server component)
│   ├── LeaderboardSection.tsx            # NEW — heading + list of rows (server component)
│   ├── SearchExperience.tsx              # NEW — extracted client search/disambiguation logic from old page.tsx
│   └── Footer.tsx                        # MODIFY — add /top link
├── lib/
│   └── leaderboard.ts                    # NEW — getTopRatings(limit) query function
scripts/
└── seed-leaderboard.ts                   # NEW — one-off seed script (TS, run via tsx)
tests/unit/
├── leaderboard.test.ts                   # NEW
├── Hero.test.tsx                         # NEW
├── LeaderboardRow.test.tsx               # NEW
└── LeaderboardSection.test.tsx           # NEW
```

---

## Phase 1 — Leaderboard Data Layer (TDD)

### Task 1.1: Types + minimal `getTopRatings` returning sorted entries

**Files:**
- Create: `src/lib/leaderboard.ts`
- Create: `tests/unit/leaderboard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/leaderboard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { supabaseMock, limitMock } = vi.hoisted(() => {
  const limit = vi.fn();
  return {
    limitMock: limit,
    supabaseMock: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit,
    },
  };
});

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => supabaseMock,
}));

import { getTopRatings } from '@/lib/leaderboard';

function row(opts: {
  slug: string;
  score: number;
  view_count?: number;
  title?: string;
  creator?: string;
  medium?: 'book' | 'movie' | 'tv';
  year?: number | null;
}) {
  return {
    slug: opts.slug,
    score: opts.score,
    view_count: opts.view_count ?? 0,
    works: {
      title: opts.title ?? opts.slug,
      creator: opts.creator ?? 'Author',
      medium: opts.medium ?? 'book',
      year: opts.year ?? 2020,
    },
  };
}

describe('getTopRatings', () => {
  beforeEach(() => { limitMock.mockReset(); });

  it('returns entries sorted by adjusted score descending', async () => {
    limitMock.mockResolvedValueOnce({
      data: [
        row({ slug: 'c', score: 10 }),
        row({ slug: 'a', score: 9 }),
        row({ slug: 'b', score: 8 }),
      ],
      error: null,
    });
    const result = await getTopRatings(10);
    expect(result.map((r) => r.slug)).toEqual(['c', 'a', 'b']);
    expect(result.map((r) => r.score)).toEqual([10, 9, 9]); // raw 10→10, raw 9→9, raw 8→9
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/leaderboard.test.ts`
Expected: FAIL with "Cannot find module '@/lib/leaderboard'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/leaderboard.ts
import { supabaseServer } from './supabase-server';
import { adjustScore, verdictFromScore } from './verdict';
import type { Medium } from './types';

export type LeaderboardEntry = {
  slug: string;
  title: string;
  creator: string;
  medium: Medium;
  year: number | null;
  score: number;     // adjusted (post-adjustScore)
  verdict: string;
  viewCount: number;
};

type Row = {
  slug: string;
  score: number;
  view_count: number;
  works: {
    title: string;
    creator: string;
    medium: Medium;
    year: number | null;
  };
};

export async function getTopRatings(limit: number): Promise<LeaderboardEntry[]> {
  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from('ratings')
      .select('slug, score, view_count, works!inner(title, creator, medium, year)')
      .eq('known', true)
      .not('score', 'is', null)
      .order('score', { ascending: false })
      .order('view_count', { ascending: false })
      .order('slug', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('leaderboard query error:', error);
      return [];
    }
    if (!data) return [];

    const rows = data as unknown as Row[];
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
        if (a.score !== b.score) return b.score - a.score;
        if (a.viewCount !== b.viewCount) return b.viewCount - a.viewCount;
        return a.slug.localeCompare(b.slug);
      });
  } catch (err) {
    console.error('leaderboard exception:', err);
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/leaderboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leaderboard.ts tests/unit/leaderboard.test.ts
git commit -m "feat(leaderboard): getTopRatings sorted by adjusted score"
```

---

### Task 1.2: Tiebreaker — view count then slug

**Files:**
- Test: `tests/unit/leaderboard.test.ts` (add a case)

- [ ] **Step 1: Add the failing test**

Append inside the `describe('getTopRatings', ...)` block in `tests/unit/leaderboard.test.ts`:

```ts
  it('breaks ties on adjusted score by view_count desc, then slug asc', async () => {
    // After adjustment, all three resolve to 9: raw 9→9, raw 8→9, raw 8→9
    limitMock.mockResolvedValueOnce({
      data: [
        row({ slug: 'm-zzz', score: 9, view_count: 10 }),
        row({ slug: 'a-aaa', score: 8, view_count: 50 }),
        row({ slug: 'a-bbb', score: 8, view_count: 50 }),
      ],
      error: null,
    });
    const result = await getTopRatings(10);
    // All adjusted to 9; tie broken first by view_count desc, then by slug asc
    expect(result.map((r) => r.slug)).toEqual(['a-aaa', 'a-bbb', 'm-zzz']);
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test tests/unit/leaderboard.test.ts`
Expected: PASS (the existing implementation already handles this). If it fails, the sort comparator in `leaderboard.ts` is broken — fix it.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/leaderboard.test.ts
git commit -m "test(leaderboard): cover tiebreaker on view_count then slug"
```

---

### Task 1.3: Empty data + error fallback

**Files:**
- Test: `tests/unit/leaderboard.test.ts` (add cases)

- [ ] **Step 1: Add the failing tests**

Append inside the `describe('getTopRatings', ...)` block:

```ts
  it('returns [] when supabase returns an error', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const result = await getTopRatings(10);
    expect(result).toEqual([]);
  });

  it('returns [] when supabase returns null data', async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: null });
    const result = await getTopRatings(10);
    expect(result).toEqual([]);
  });

  it('returns [] when getTopRatings throws (e.g., env var missing)', async () => {
    limitMock.mockRejectedValueOnce(new Error('connection refused'));
    const result = await getTopRatings(10);
    expect(result).toEqual([]);
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm test tests/unit/leaderboard.test.ts`
Expected: all PASS. The error / exception paths are already handled by the try/catch in `leaderboard.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/leaderboard.test.ts
git commit -m "test(leaderboard): cover empty + error fallbacks"
```

---

## Phase 2 — UI Components (TDD where it adds value)

### Task 2.1: `Hero` component

**Files:**
- Create: `src/components/Hero.tsx`
- Create: `tests/unit/Hero.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/Hero.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from '@/components/Hero';

describe('Hero', () => {
  it('renders the wordmark and tagline', () => {
    render(<Hero />);
    expect(screen.getByText('Is It Smut?')).toBeInTheDocument();
    expect(screen.getByText(/before you start chapter one/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/Hero.test.tsx`
Expected: FAIL with "Cannot find module '@/components/Hero'".

- [ ] **Step 3: Implement**

```tsx
// src/components/Hero.tsx
export function Hero() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[color:var(--color-brand)] to-[color:var(--color-brand-soft)] px-6 py-8 text-center text-white shadow-[0_6px_18px_rgba(212,80,107,0.18)]">
      <h1 className="text-4xl font-black tracking-tight">Is It Smut?</h1>
      <p className="mt-2 text-sm font-medium italic text-white/85">
        Find out before you start chapter one.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test tests/unit/Hero.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Hero.tsx tests/unit/Hero.test.tsx
git commit -m "feat(ui): Hero gradient block with wordmark + tagline"
```

---

### Task 2.2: `LeaderboardRow` component

**Files:**
- Create: `src/components/LeaderboardRow.tsx`
- Create: `tests/unit/LeaderboardRow.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/LeaderboardRow.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import type { LeaderboardEntry } from '@/lib/leaderboard';

const sample: LeaderboardEntry = {
  slug: 'fourth-wing-yarros-2023',
  title: 'Fourth Wing',
  creator: 'Rebecca Yarros',
  medium: 'book',
  year: 2023,
  score: 9,
  verdict: 'Absolutely smut.',
  viewCount: 42,
};

describe('LeaderboardRow', () => {
  it('renders rank, title, creator/year/medium, and score', () => {
    render(<LeaderboardRow rank={1} entry={sample} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Fourth Wing')).toBeInTheDocument();
    expect(screen.getByText(/Rebecca Yarros/)).toBeInTheDocument();
    expect(screen.getByText(/2023/)).toBeInTheDocument();
    expect(screen.getByText(/Book/i)).toBeInTheDocument();
    expect(screen.getByText('9/10')).toBeInTheDocument();
  });

  it('wraps the row in a link to /r/{slug}', () => {
    render(<LeaderboardRow rank={1} entry={sample} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/r/fourth-wing-yarros-2023');
  });

  it('handles missing year gracefully', () => {
    render(<LeaderboardRow rank={2} entry={{ ...sample, year: null }} />);
    // No year segment, but creator and medium still render
    expect(screen.getByText(/Rebecca Yarros/)).toBeInTheDocument();
    expect(screen.getByText(/Book/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/LeaderboardRow.test.tsx`
Expected: FAIL with "Cannot find module '@/components/LeaderboardRow'".

- [ ] **Step 3: Implement**

```tsx
// src/components/LeaderboardRow.tsx
import Link from 'next/link';
import type { LeaderboardEntry } from '@/lib/leaderboard';
import type { Medium } from '@/lib/types';

const MEDIUM_LABEL: Record<Medium, string> = { book: 'Book', movie: 'Movie', tv: 'TV' };

type Props = {
  rank: number;
  entry: LeaderboardEntry;
};

export function LeaderboardRow({ rank, entry }: Props) {
  const meta = [entry.creator, entry.year, MEDIUM_LABEL[entry.medium]]
    .filter((v) => v != null && v !== '')
    .join(' · ');
  return (
    <Link
      href={`/r/${entry.slug}`}
      className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[color:var(--color-accent)] to-[color:var(--color-surface-card)] px-3 py-2.5 transition hover:from-[color:var(--color-accent)] hover:to-[color:var(--color-accent)]"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--color-brand)] to-[color:var(--color-brand-soft)] text-xs font-extrabold text-white">
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-[color:var(--color-ink)]">{entry.title}</div>
        <div className="truncate text-[11px] text-[color:var(--color-ink-quiet)]">{meta}</div>
      </div>
      <div className="shrink-0 rounded-full bg-[color:var(--color-brand)] px-2.5 py-1 text-[11px] font-bold text-white">
        {entry.score}/10
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test tests/unit/LeaderboardRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LeaderboardRow.tsx tests/unit/LeaderboardRow.test.tsx
git commit -m "feat(ui): LeaderboardRow with gradient bg + score pill"
```

---

### Task 2.3: `LeaderboardSection` component

**Files:**
- Create: `src/components/LeaderboardSection.tsx`
- Create: `tests/unit/LeaderboardSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/LeaderboardSection.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LeaderboardSection } from '@/components/LeaderboardSection';
import type { LeaderboardEntry } from '@/lib/leaderboard';

const entries: LeaderboardEntry[] = [
  { slug: 's1', title: 'Title One', creator: 'A', medium: 'book', year: 2020, score: 10, verdict: 'Absolutely smut.', viewCount: 0 },
  { slug: 's2', title: 'Title Two', creator: 'B', medium: 'movie', year: 2021, score: 9, verdict: 'Absolutely smut.', viewCount: 0 },
  { slug: 's3', title: 'Title Three', creator: 'C', medium: 'tv', year: 2022, score: 9, verdict: 'Absolutely smut.', viewCount: 0 },
];

describe('LeaderboardSection', () => {
  it('renders heading and all entries with sequential ranks', () => {
    render(<LeaderboardSection entries={entries} heading="🔥 Hottest of all time" />);
    expect(screen.getByText('🔥 Hottest of all time')).toBeInTheDocument();
    expect(screen.getByText('Title One')).toBeInTheDocument();
    expect(screen.getByText('Title Two')).toBeInTheDocument();
    expect(screen.getByText('Title Three')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders see-more link when seeMoreHref is provided', () => {
    render(<LeaderboardSection entries={entries} heading="x" seeMoreHref="/top" />);
    const link = screen.getByRole('link', { name: /see full top 10/i });
    expect(link).toHaveAttribute('href', '/top');
  });

  it('omits see-more link when seeMoreHref is not provided', () => {
    render(<LeaderboardSection entries={entries} heading="x" />);
    expect(screen.queryByText(/see full top 10/i)).not.toBeInTheDocument();
  });

  it('shows empty-state message when entries is empty', () => {
    render(<LeaderboardSection entries={[]} heading="x" />);
    expect(screen.getByText(/check back in a moment/i)).toBeInTheDocument();
  });

  it('omits heading when not provided', () => {
    render(<LeaderboardSection entries={entries} />);
    // Just confirm no heading element from our component — entries still render
    expect(screen.getByText('Title One')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/LeaderboardSection.test.tsx`
Expected: FAIL with "Cannot find module '@/components/LeaderboardSection'".

- [ ] **Step 3: Implement**

```tsx
// src/components/LeaderboardSection.tsx
import Link from 'next/link';
import { LeaderboardRow } from './LeaderboardRow';
import type { LeaderboardEntry } from '@/lib/leaderboard';

type Props = {
  entries: LeaderboardEntry[];
  heading?: string;
  seeMoreHref?: string;
};

export function LeaderboardSection({ entries, heading, seeMoreHref }: Props) {
  return (
    <section className="space-y-2">
      {heading && (
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand)]">
          {heading}
        </h2>
      )}
      {entries.length === 0 ? (
        <p className="text-center text-sm text-[color:var(--color-ink-muted)]">
          Loading the leaderboard… check back in a moment.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <LeaderboardRow key={entry.slug} rank={i + 1} entry={entry} />
          ))}
        </div>
      )}
      {seeMoreHref && entries.length > 0 && (
        <div className="pt-1 text-right">
          <Link
            href={seeMoreHref}
            className="text-xs font-bold text-[color:var(--color-brand)] hover:underline"
          >
            See full top 10 →
          </Link>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test tests/unit/LeaderboardSection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/LeaderboardSection.tsx tests/unit/LeaderboardSection.test.tsx
git commit -m "feat(ui): LeaderboardSection with heading + see-more link + empty state"
```

---

## Phase 3 — Extract `SearchExperience`

### Task 3.1: Extract client logic from `page.tsx` into `SearchExperience.tsx`

The current `src/app/page.tsx` is a client component with all search logic. To server-render the leaderboard, the homepage must become a server component. We extract the search/disambiguation state into its own client component.

**Files:**
- Create: `src/components/SearchExperience.tsx`
- (Modify `page.tsx` in Phase 4)

- [ ] **Step 1: Create `SearchExperience.tsx` with the existing logic**

```tsx
// src/components/SearchExperience.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchBar } from '@/components/SearchBar';
import { TryTheseChips } from '@/components/TryTheseChips';
import { DisambiguationPicker } from '@/components/DisambiguationPicker';
import { CaptchaModal } from '@/components/CaptchaModal';
import type { Candidate } from '@/lib/types';

const TRY_THESE = ['Fourth Wing', 'It Ends With Us', 'Bridgerton', 'A Court of Thorns and Roses', 'Normal People'];

export function SearchExperience() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  async function handleSearch(query: string) {
    setLoading(true);
    setError(null);
    setCandidates(null);
    setPendingQuery(query);

    const res = await fetch('/api/disambiguate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (res.status === 429) {
      const body = await res.json();
      if (body.needs_captcha) {
        setLoading(false);
        setCaptchaOpen(true);
        return;
      }
    }

    if (!res.ok) {
      setLoading(false);
      setError('Something went wrong. Try again?');
      return;
    }

    const data = (await res.json()) as { candidates: Candidate[] };
    setLoading(false);

    if (data.candidates.length === 0) {
      setError(`No confident match for "${query}". Try adding the author or year.`);
      return;
    }

    if (data.candidates.length === 1) {
      const c = data.candidates[0];
      const params = new URLSearchParams({
        title: c.title, creator: c.creator, medium: c.medium,
        ...(c.year != null ? { year: String(c.year) } : {}),
      });
      router.push(`/r/${c.slug}?${params.toString()}`);
      return;
    }

    setCandidates(data.candidates);
  }

  function handlePick(c: Candidate) {
    const params = new URLSearchParams({
      title: c.title, creator: c.creator, medium: c.medium,
      ...(c.year != null ? { year: String(c.year) } : {}),
    });
    router.push(`/r/${c.slug}?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <SearchBar onSubmit={handleSearch} disabled={loading} />

      {!candidates && !error && !loading && (
        <TryTheseChips items={TRY_THESE} onPick={handleSearch} />
      )}

      {loading && (
        <p className="text-center text-sm text-[color:var(--color-ink-muted)]">Thinking…</p>
      )}

      {error && (
        <p className="text-center text-sm text-[color:var(--color-ink-muted)]">{error}</p>
      )}

      {candidates && candidates.length > 1 && (
        <DisambiguationPicker candidates={candidates} onPick={handlePick} />
      )}

      <CaptchaModal
        open={captchaOpen}
        onClose={() => setCaptchaOpen(false)}
        onSuccess={() => {
          setCaptchaOpen(false);
          if (pendingQuery) handleSearch(pendingQuery);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck (no behavioral test — page.tsx still imports old logic; pure refactor)**

Run: `pnpm typecheck`
Expected: pass. (The new component is unused so far, but should compile.)

- [ ] **Step 3: Commit**

```bash
git add src/components/SearchExperience.tsx
git commit -m "feat(ui): extract SearchExperience client component"
```

---

## Phase 4 — Wire Up Homepage + New `/top` Page

### Task 4.1: Convert `page.tsx` to a server component with Hero + SearchExperience + LeaderboardSection

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
// src/app/page.tsx
import { Hero } from '@/components/Hero';
import { SearchExperience } from '@/components/SearchExperience';
import { LeaderboardSection } from '@/components/LeaderboardSection';
import { getTopRatings } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 60;

export default async function HomePage() {
  const top = await getTopRatings(3);

  return (
    <div className="space-y-8">
      <Hero />
      <SearchExperience />
      <LeaderboardSection
        entries={top}
        heading="🔥 Hottest of all time"
        seeMoreHref="/top"
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: pass.

- [ ] **Step 3: Run all tests to confirm nothing regressed**

Run: `pnpm test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(page): server-render homepage with Hero + leaderboard preview"
```

---

### Task 4.2: Create `/top` page

**Files:**
- Create: `src/app/top/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// src/app/top/page.tsx
import type { Metadata } from 'next';
import { LeaderboardSection } from '@/components/LeaderboardSection';
import { getTopRatings } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Top 10 Hottest — IsItSmut',
  description: "The smuttiest books, movies, and shows we've rated.",
};

export default async function TopPage() {
  const top = await getTopRatings(10);

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-[color:var(--color-brand)]">
          Top 10 Hottest
        </h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
          The smuttiest books, movies, and shows we&apos;ve rated.
        </p>
      </header>
      <LeaderboardSection entries={top} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/top/page.tsx
git commit -m "feat(page): /top — full top 10 leaderboard"
```

---

### Task 4.3: Add `/top` link to Footer

**Files:**
- Modify: `src/components/Footer.tsx`

- [ ] **Step 1: Add the link**

Current file (`src/components/Footer.tsx`):
```tsx
<nav className="flex justify-center gap-4">
  <Link href="/about" className="hover:text-[color:var(--color-brand)]">About</Link>
  <Link href="/terms" className="hover:text-[color:var(--color-brand)]">Terms</Link>
  <Link href="/privacy" className="hover:text-[color:var(--color-brand)]">Privacy</Link>
</nav>
```

Add a new link FIRST in the nav (most prominent position):
```tsx
<nav className="flex justify-center gap-4">
  <Link href="/top" className="hover:text-[color:var(--color-brand)]">Top 10</Link>
  <Link href="/about" className="hover:text-[color:var(--color-brand)]">About</Link>
  <Link href="/terms" className="hover:text-[color:var(--color-brand)]">Terms</Link>
  <Link href="/privacy" className="hover:text-[color:var(--color-brand)]">Privacy</Link>
</nav>
```

- [ ] **Step 2: Run Footer tests**

Run: `pnpm test tests/unit/Footer.test.tsx`
Expected: existing tests still pass. (Existing Footer test checks for About/Terms/Privacy and may not assert on Top 10 — that's fine, we're not asserting "only these links".)

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.tsx
git commit -m "feat(footer): add Top 10 nav link"
```

---

## Phase 5 — Seeding Script

### Task 5.1: Create `scripts/seed-leaderboard.ts`

**Files:**
- Create: `scripts/seed-leaderboard.ts`

- [ ] **Step 1: Write the script**

```ts
// scripts/seed-leaderboard.ts
//
// Seeds the prod (or local) Supabase with 15 well-known erotic-leaning titles
// by running each through the existing disambiguate + rate flow. Idempotent —
// cache hits skip Claude.
//
// Usage (loads env from .env.local — populate it with PROD creds before running):
//   pnpm dlx tsx --env-file=.env.local scripts/seed-leaderboard.ts
//
// Required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ANTHROPIC_API_KEY, RATE_LIMIT_SALT.

import { runDisambiguate } from '../src/lib/disambiguate';
import { runRate } from '../src/lib/rate';
import type { Medium } from '../src/lib/types';

type SeedItem = { query: string; expect: Medium };

const SEED: SeedItem[] = [
  // Books
  { query: 'Fifty Shades of Grey by E.L. James', expect: 'book' },
  { query: 'Haunting Adeline by H.D. Carlton', expect: 'book' },
  { query: 'A Court of Mist and Fury by Sarah J. Maas', expect: 'book' },
  { query: 'Icebreaker by Hannah Grace', expect: 'book' },
  { query: 'Fourth Wing by Rebecca Yarros', expect: 'book' },
  { query: 'Twisted Love by Ana Huang', expect: 'book' },
  { query: 'Outlander novel by Diana Gabaldon 1991', expect: 'book' },
  // Movies
  { query: '365 Days 2020 film', expect: 'movie' },
  { query: 'Blue Is the Warmest Color 2013 film', expect: 'movie' },
  { query: 'Fifty Shades of Grey 2015 film', expect: 'movie' },
  { query: '9 1/2 Weeks 1986 film', expect: 'movie' },
  // TV
  { query: 'Outlander Starz TV series', expect: 'tv' },
  { query: 'Sex/Life Netflix series', expect: 'tv' },
  { query: 'Bridgerton Netflix series', expect: 'tv' },
  { query: 'Euphoria HBO series', expect: 'tv' },
];

async function seed() {
  let ok = 0;
  let unknown = 0;
  let skipped = 0;
  let failed = 0;

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
      console.error(`  ✗ Error:`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`\n=== Done — ok: ${ok}, unknown: ${unknown}, skipped: ${skipped}, failed: ${failed} ===`);
}

seed().then(() => process.exit(0));
```

- [ ] **Step 2: Verify it typechecks (without running)**

Run: `pnpm typecheck`
Expected: pass. The script imports from `../src/lib/...` — `tsx` will resolve TS paths correctly at runtime.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-leaderboard.ts
git commit -m "feat(seed): one-off leaderboard seeding script"
```

---

## Phase 6 — Verification + Deploy

### Task 6.1: Full test sweep + build

**Files:** none (verification only)

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 2: Run all unit + integration tests**

Run: `pnpm test`
Expected: all PASS (including the new leaderboard, Hero, LeaderboardRow, LeaderboardSection tests).

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Run production build**

Run: `pnpm build`
Expected: build completes without errors. Check the build output for the new `/top` route.

- [ ] **Step 5: No commit (verification only)**

---

### Task 6.2: Manual local smoke test (USER ACTION — requires populated DB)

This step requires either (a) `.env.local` pointing at a Supabase instance with at least a few `ratings` rows, or (b) running the seed script first.

- [ ] **Step 1: Run dev server**

Run: `pnpm dev`
Open: `http://localhost:3000`

- [ ] **Step 2: Verify homepage**

- Gradient hero block visible at the top
- Search bar works (type "Fourth Wing", hit submit, ends up at `/r/...`)
- "🔥 Hottest of all time" section visible with up to 3 rows (empty-state message if DB is empty)
- "See full top 10 →" link visible if there are entries

- [ ] **Step 3: Verify /top**

Navigate to `http://localhost:3000/top`.
- "Top 10 Hottest" header
- Up to 10 ranked rows
- Tapping a row navigates to its `/r/[slug]`
- Footer link "Top 10" present

- [ ] **Step 4: Stop dev server**

Ctrl+C.

- [ ] **Step 5: No commit (verification only)**

---

### Task 6.3: Push to deploy (USER ACTION)

- [ ] **Step 1: Push to main**

Run: `git push origin main`
Vercel auto-deploys.

- [ ] **Step 2: Run seed script against prod (USER ACTION)**

Once Vercel has deployed and the prod env vars are confirmed (see the bug-fix conversation), populate prod Supabase by:

1. Temporarily edit `.env.local` so it contains your PROD Supabase URL, PROD service-role key, PROD Anthropic key, and PROD RATE_LIMIT_SALT. (Keep a copy of the original values somewhere so you can restore them.)

2. Run:

```
pnpm dlx tsx --env-file=.env.local scripts/seed-leaderboard.ts
```

3. Restore the original `.env.local` so you don't accidentally write to prod from local dev.

Expected: 15 titles processed, ≥10 land at known=true with score 8+ after the `adjustScore` bump.

- [ ] **Step 3: Verify prod**

Visit `https://isitsmut.com` and `https://isitsmut.com/top`. Confirm the leaderboard is populated and tapping rows navigates correctly.

- [ ] **Step 4: No commit (deploy-only)**

---

## Done Criteria

- All new tests pass
- `pnpm typecheck && pnpm lint && pnpm build` clean
- Homepage renders Hero + Search + leaderboard preview
- `/top` page renders full top 10
- Footer has "Top 10" nav link
- Seed script ran successfully against prod, ≥10 entries appear on `/top`
