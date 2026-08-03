# SERP CTR Rework + Duplicate-Slug Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop giving away the verdict in Google's snippet (full-tease titles/descriptions + spice vocabulary) and consolidate duplicate result pages via an alias/redirect table, per `docs/superpowers/specs/2026-08-02-isitsmut-serp-ctr-design.md`.

**Architecture:** Workstream A is a pure template change in `src/lib/seo.ts` (SERP metadata teases; OG/Twitter keep answer-first; on-page Q&A line adopts "spice level" wording). Workstream B adds an `aliases` table, a lookup helper + `permanentRedirect` wiring in `/r/[slug]`, normalized-identity reuse in `runDisambiguate` so dupes stop being minted, and a one-time operator merge script.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase Postgres, Vitest (+ MSW; Supabase mocked via `vi.mock('@/lib/supabase-server')`).

## Global Constraints

- Package manager: `pnpm` (`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`), run from `C:\Users\tword\desktop\isitsmut`.
- TLS-intercepting machine: `pnpm build` logs `UNABLE_TO_VERIFY_LEAF_SIGNATURE` cert errors while prerendering — the build still SUCCEEDS; that is normal. `pnpm dlx` is blocked. Operator scripts run via `NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/<file>.ts`.
- All work on branch `serp-ctr-and-dupes` off `main`. Do NOT merge the PR or touch prod (migration/merge script) without Tyler's explicit go-ahead.
- Copy strings are exact: titles/descriptions below use the em dash `—`, en dash in `1–10`, and curly apostrophes exactly as written. Do not "fix" them to ASCII.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: SERP tease metadata + spice-vocabulary Q&A line

**Files:**
- Modify: `src/lib/seo.ts:11-13` (`buildQuestionAnswer`), `src/lib/seo.ts:41-62` (`resultMetadata`)
- Test: `tests/unit/seo.test.ts`

**Interfaces:**
- Consumes: existing `Work`, `Rating` types from `src/lib/types.ts`; `clamp` already in `seo.ts`.
- Produces: same signatures as today — `buildQuestionAnswer(work, rating): string`, `resultMetadata(work, rating): Metadata`. Only the strings change; no caller changes anywhere.

- [ ] **Step 0: Create the branch**

```bash
git checkout -b serp-ctr-and-dupes
```

- [ ] **Step 1: Update the tests to the new copy (failing first)**

In `tests/unit/seo.test.ts`, replace the `buildQuestionAnswer` describe block (lines 26–32) with:

```ts
describe('buildQuestionAnswer', () => {
  it('answers instantly with spice-level vocabulary', () => {
    expect(buildQuestionAnswer(work, known)).toBe(
      'Is Fourth Wing smut? Yes, it\'s smut. Spice level: 8/10 for sexual content.'
    );
  });
});
```

Replace the first `it` in the `resultMetadata` describe block (lines 66–76) with:

```ts
  it('teases the SERP snippet but keeps answer-first social cards', () => {
    const m = resultMetadata(work, known);
    // SERP: no verdict, no score — the click is the only way to get the answer.
    expect(m.title).toBe('Is Fourth Wing Smut? Spice Level & Scene Guide — IsItSmut');
    expect(m.description).toContain('spice level');
    expect(m.description).not.toContain('8/10');
    expect(m.description).not.toContain("Yes, it's smut.");
    expect((m.description as string).length).toBeLessThanOrEqual(160);
    // Social cards keep the verdict+score — there, the answer IS the content.
    expect(m.openGraph?.title).toBe('Is "Fourth Wing" Smut? Yes, it\'s smut. (8/10) — IsItSmut');
    expect((m.openGraph as { description?: string })?.description).toContain('8/10');
    expect((m.twitter as { title?: string })?.title).toBe('Is "Fourth Wing" Smut? Yes, it\'s smut. (8/10) — IsItSmut');
    expect((m.twitter as { card?: string })?.card).toBe('summary_large_image');
    expect(m.alternates?.canonical).toBe('/r/fourth-wing-yarros-2023');
    expect(m.robots).toBeUndefined();
  });
```

Leave the `noindexes an unknown rating` test untouched.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/unit/seo.test.ts`
Expected: FAIL — old strings (`It scores 8/10`, `Is "Fourth Wing" Smut? … (8/10)` as `m.title`) don't match.

- [ ] **Step 3: Implement the new copy in `src/lib/seo.ts`**

Replace `buildQuestionAnswer` (lines 11–13) with:

```ts
export function buildQuestionAnswer(work: Work, rating: KnownRating): string {
  return `Is ${work.title} smut? ${rating.verdict} Spice level: ${rating.score}/10 for sexual content.`;
}
```

Replace the known-rating tail of `resultMetadata` (lines 51–61) with:

```ts
  // SERP snippet: full tease — no verdict/score, so the click is the only way
  // to get the answer. Social cards below stay answer-first on purpose:
  // Google ignores OG tags, and a share card wants the verdict visible.
  const title = `Is ${work.title} Smut? Spice Level & Scene Guide — IsItSmut`;
  const description = clamp(
    `Wondering if ${work.title} by ${work.creator} is smut? Get the verdict, the 1–10 spice level, what's actually in it, and who it's OK for — spoiler-free.`
  );
  const socialTitle = `Is "${work.title}" Smut? ${rating.verdict} (${rating.score}/10) — IsItSmut`;
  const socialDescription = clamp(
    `${rating.verdict} ${work.title} by ${work.creator} scores ${rating.score}/10 for sexual content. ${rating.synopsis}`
  );
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: socialTitle, description: socialDescription, type: 'article', url: canonical },
    twitter: { card: 'summary_large_image', title: socialTitle, description: socialDescription },
  };
```

The `known:false` branch and everything else in the file stay unchanged. `ResultCard` renders `buildQuestionAnswer` directly, so no component change.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/unit/seo.test.ts`
Expected: PASS (all seo tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo.ts tests/unit/seo.test.ts
git commit -m "feat(seo): full-tease SERP snippets, answer-first social cards, spice-level copy"
```

---

### Task 2: `aliases` migration + lookup helper

**Files:**
- Create: `supabase/migrations/20260802000001_create_aliases.sql`
- Create: `src/lib/aliases.ts`
- Test: `tests/unit/aliases.test.ts`

**Interfaces:**
- Consumes: `supabaseServer()` from `src/lib/supabase-server.ts`.
- Produces: `getCanonicalSlug(aliasSlug: string): Promise<string | null>` — Task 3 imports it from `@/lib/aliases`; Task 5's script writes rows the helper reads (`aliases.alias_slug` → `aliases.canonical_slug`).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260802000001_create_aliases.sql`:

```sql
create table public.aliases (
  alias_slug     text primary key,
  canonical_slug text not null,
  created_at     timestamptz not null default now()
);

comment on table public.aliases is
  'Slug redirects for merged duplicate works: /r/<alias_slug> 308s to /r/<canonical_slug>.';

-- No FK to works(slug): operator scripts delete/re-create works rows, and a
-- dangling alias just falls through to the normal 404 path.

alter table public.aliases enable row level security;

create policy "aliases_public_read"
  on public.aliases for select
  to anon, authenticated
  using (true);
```

(Applied to prod during rollout, NOT during this task. Local build never talks to the DB successfully anyway — TLS quirk.)

- [ ] **Step 2: Write the failing test**

Create `tests/unit/aliases.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: async () => ({
            data:
              table === 'aliases' && val === 'blood-and-ash-armentrout-2020'
                ? { canonical_slug: 'from-blood-and-ash-armentrout-2020' }
                : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

import { getCanonicalSlug } from '@/lib/aliases';

describe('getCanonicalSlug', () => {
  it('returns the canonical slug for a merged-away alias', async () => {
    await expect(getCanonicalSlug('blood-and-ash-armentrout-2020')).resolves.toBe(
      'from-blood-and-ash-armentrout-2020'
    );
  });

  it('returns null when the slug is not an alias', async () => {
    await expect(getCanonicalSlug('fourth-wing-yarros-2023')).resolves.toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test -- tests/unit/aliases.test.ts`
Expected: FAIL — `Cannot find module '@/lib/aliases'`.

- [ ] **Step 4: Implement the helper**

Create `src/lib/aliases.ts`:

```ts
import { supabaseServer } from './supabase-server';

// Maps a merged-away slug to its canonical replacement.
// Rows are written by scripts/merge-duplicates.ts.
export async function getCanonicalSlug(aliasSlug: string): Promise<string | null> {
  const sb = supabaseServer();
  const { data } = await sb
    .from('aliases')
    .select('canonical_slug')
    .eq('alias_slug', aliasSlug)
    .maybeSingle();
  return (data as { canonical_slug: string } | null)?.canonical_slug ?? null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- tests/unit/aliases.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260802000001_create_aliases.sql src/lib/aliases.ts tests/unit/aliases.test.ts
git commit -m "feat(aliases): aliases table migration and getCanonicalSlug helper"
```

---

### Task 3: Permanent redirect for alias slugs in `/r/[slug]`

**Files:**
- Modify: `src/app/r/[slug]/page.tsx` (imports at lines 1–10; `ResultPage` after line 29; `generateMetadata` lines 68–77)
- Test: `tests/integration/alias-redirect.test.ts`

**Interfaces:**
- Consumes: `getCanonicalSlug(aliasSlug: string): Promise<string | null>` from `@/lib/aliases` (Task 2); `permanentRedirect` from `next/navigation`.
- Produces: `/r/<alias>` responds 308 → `/r/<canonical>` for both metadata generation and page render. No new exports.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/alias-redirect.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: async () => ({
            data:
              table === 'aliases' && val === 'blood-and-ash-armentrout-2020'
                ? { canonical_slug: 'from-blood-and-ash-armentrout-2020' }
                : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/rate', () => ({
  getCachedRating: vi.fn(async () => null),
  runRate: vi.fn(),
  bumpViewCount: vi.fn(async () => {}),
}));

vi.mock('@/lib/related', () => ({ getRelatedTitles: vi.fn(async () => []) }));

import ResultPage, { generateMetadata } from '@/app/r/[slug]/page';

const params = (slug: string) => Promise.resolve({ slug });

describe('alias redirect', () => {
  it('generateMetadata permanently redirects an alias slug to its canonical', async () => {
    await expect(generateMetadata({ params: params('blood-and-ash-armentrout-2020') })).rejects.toMatchObject({
      digest: expect.stringContaining('/r/from-blood-and-ash-armentrout-2020'),
    });
  });

  it('the page component also redirects the alias slug', async () => {
    await expect(
      ResultPage({ params: params('blood-and-ash-armentrout-2020'), searchParams: Promise.resolve({}) })
    ).rejects.toMatchObject({
      digest: expect.stringContaining('/r/from-blood-and-ash-armentrout-2020'),
    });
  });

  it('a slug that is neither a work nor an alias still returns not-found metadata', async () => {
    const m = await generateMetadata({ params: params('does-not-exist-anywhere') });
    expect(m).toEqual({ title: 'Not found — IsItSmut', robots: { index: false, follow: true } });
  });
});
```

If importing the page module fails in the node environment because a client component in its import tree touches browser globals, stub the components too (add alongside the other mocks — adjust to whichever import actually fails):

```ts
vi.mock('@/components/ResultCard', () => ({ ResultCard: () => null }));
vi.mock('@/components/RelatedTitles', () => ({ RelatedTitles: () => null }));
vi.mock('@/components/AdSlot', () => ({ AdSlot: () => null }));
vi.mock('@/components/JsonLd', () => ({ JsonLd: () => null }));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/integration/alias-redirect.test.ts`
Expected: FAIL — the two redirect tests reject nothing (`generateMetadata` resolves to not-found metadata; `ResultPage` throws `NEXT_HTTP_ERROR_FALLBACK;404` from `notFound()` whose digest does not contain the canonical path).

- [ ] **Step 3: Wire the redirect into the page**

In `src/app/r/[slug]/page.tsx`:

Change line 1 and add the aliases import after the seo import (line 6):

```ts
import { notFound, permanentRedirect } from 'next/navigation';
```
```ts
import { getCanonicalSlug } from '@/lib/aliases';
```

In `ResultPage`, immediately after `let work = await fetchWork(slug);` (line 29), insert:

```ts
  if (!work) {
    const canonical = await getCanonicalSlug(slug);
    if (canonical) permanentRedirect(`/r/${canonical}`);
  }
```

In `generateMetadata`, replace the `if (!work) { ... }` block (lines 71–73) with:

```ts
  if (!work) {
    const canonical = await getCanonicalSlug(slug);
    if (canonical) permanentRedirect(`/r/${canonical}`);
    return { title: 'Not found — IsItSmut', robots: { index: false, follow: true } };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/integration/alias-redirect.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/r/[slug]/page.tsx tests/integration/alias-redirect.test.ts
git commit -m "feat(aliases): 308 alias slugs to their canonical result page"
```

---

### Task 4: Stop minting duplicate slugs in disambiguation

**Files:**
- Modify: `src/lib/disambiguate.ts` (full rewrite below)
- Test: `tests/integration/disambiguate-lib.test.ts` (full rewrite below)

**Interfaces:**
- Consumes: `slugify`, `slugifyWithCollisionCheck` from `./slug` (unchanged); `callDisambiguate` from `./claude`; `supabaseServer()`.
- Produces: `runDisambiguate(query: string): Promise<{ candidates: Candidate[] }>` — signature unchanged; callers (`/api/disambiguate`, `scripts/*`) need no changes. New behavior: candidates reuse an existing work's slug when title+creator slug parts and medium match (year/formatting wobble tolerated); hash suffix only for same-slug different-medium.

- [ ] **Step 1: Rewrite the test file (failing first)**

Replace `tests/integration/disambiguate-lib.test.ts` entirely with:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDisambiguate } from '@/lib/disambiguate';

vi.mock('@/lib/claude', () => ({
  callDisambiguate: vi.fn(async (_q: string) => ({
    candidates: [{ title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' }],
  })),
}));

const { existingWorks } = vi.hoisted(() => ({
  existingWorks: [] as Array<{ slug: string; medium: string }>,
}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: () => ({
      select: () => ({
        like: async (_col: string, pattern: string) => ({
          data: existingWorks.filter((w) => w.slug.startsWith(pattern.slice(0, -1))),
          error: null,
        }),
        eq: (_col: string, slug: string) => ({
          maybeSingle: async () => ({
            data: existingWorks.find((w) => w.slug === slug) ?? null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe('runDisambiguate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existingWorks.length = 0;
  });

  it('attaches a slug to each candidate', async () => {
    const result = await runDisambiguate('fourth wing');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].slug).toBe('fourth-wing-yarros-2023');
  });

  it('returns empty candidates when Claude returns none', async () => {
    const claude = await import('@/lib/claude');
    vi.mocked(claude.callDisambiguate).mockResolvedValueOnce({ candidates: [] });
    const result = await runDisambiguate('asdkjhasdkjhaskdjh');
    expect(result.candidates).toEqual([]);
  });

  it('reuses the existing slug when the same work already exists', async () => {
    existingWorks.push({ slug: 'fourth-wing-yarros-2023', medium: 'book' });
    const result = await runDisambiguate('fourth wing');
    expect(result.candidates[0].slug).toBe('fourth-wing-yarros-2023');
  });

  it('reuses the existing slug when only the year differs (AI year wobble)', async () => {
    existingWorks.push({ slug: 'fourth-wing-yarros-2022', medium: 'book' });
    const result = await runDisambiguate('fourth wing');
    expect(result.candidates[0].slug).toBe('fourth-wing-yarros-2022');
  });

  it('hash-suffixes when the same slug belongs to a different medium', async () => {
    existingWorks.push({ slug: 'fourth-wing-yarros-2023', medium: 'movie' });
    const result = await runDisambiguate('fourth wing');
    expect(result.candidates[0].slug).toMatch(/^fourth-wing-yarros-2023-[0-9a-f]{4}$/);
  });
});
```

- [ ] **Step 2: Run test to verify the new cases fail**

Run: `pnpm test -- tests/integration/disambiguate-lib.test.ts`
Expected: FAIL — "reuses … year differs" gets `fourth-wing-yarros-2023` (a fresh dupe) instead of reusing `-2022`; "reuses the existing slug" gets a hash suffix (old code treats any select shape difference as a different work; the new mock returns only `slug, medium` so `title !== c.title` is true).

- [ ] **Step 3: Rewrite `src/lib/disambiguate.ts`**

Replace the file entirely with:

```ts
import { callDisambiguate } from './claude';
import { slugify, slugifyWithCollisionCheck } from './slug';
import { supabaseServer } from './supabase-server';
import type { Candidate, Medium } from './types';

type CandidateInput = { title: string; creator: string; year: number | null; medium: Medium };

// A stored work is "the same work" as a candidate when the title+creator slug
// parts and the medium match. Year and creator-formatting wobble from the AI
// is tolerated so we reuse the existing page instead of minting a duplicate
// (the fifty-shades-…-4f3e / ACOSF-2020-vs-2021 classes from the GSC report).
async function findExistingWorkSlug(c: CandidateInput): Promise<string | null> {
  const sb = supabaseServer();
  const prefix = slugify({ title: c.title, creator: c.creator, year: null });
  const { data } = await sb.from('works').select('slug, medium').like('slug', `${prefix}%`);
  // prefix is kebab-case [a-z0-9-], so it is regex-safe without escaping.
  const sameWork = new RegExp(`^${prefix}(-\\d{4})?(-[0-9a-f]{4})?$`);
  const match = ((data ?? []) as Array<{ slug: string; medium: string }>).find(
    (w) => w.medium === c.medium && sameWork.test(w.slug)
  );
  return match?.slug ?? null;
}

export async function runDisambiguate(query: string): Promise<{ candidates: Candidate[] }> {
  const raw = await callDisambiguate(query);
  const sb = supabaseServer();

  const candidates: Candidate[] = [];
  for (const c of raw.candidates) {
    const existing = await findExistingWorkSlug(c);
    if (existing) {
      candidates.push({ ...c, slug: existing });
      continue;
    }
    // Same slug + same medium was handled above, so a collision here means a
    // genuinely different work (different medium) happens to share the slug.
    const existsForOther = async (slug: string): Promise<boolean> => {
      const { data } = await sb.from('works').select('medium').eq('slug', slug).maybeSingle();
      if (!data) return false;
      return (data as { medium: string }).medium !== c.medium;
    };
    const slug = await slugifyWithCollisionCheck(
      { title: c.title, creator: c.creator, year: c.year },
      existsForOther
    );
    candidates.push({ slug, ...c });
  }
  return { candidates };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/integration/disambiguate-lib.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full suite (disambiguate is on the hot path)**

Run: `pnpm test`
Expected: PASS. If `disambiguate-route.test.ts` fails on the new `.like` call, its supabase mock needs the same `like` branch added as in Step 1's mock (same shape: `like: async () => ({ data: [], error: null })`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/disambiguate.ts tests/integration/disambiguate-lib.test.ts
git commit -m "fix(disambiguate): reuse existing work slug on normalized identity match"
```

---

### Task 5: `merge-duplicates` operator script

**Files:**
- Create: `scripts/merge-duplicates.ts`

**Interfaces:**
- Consumes: `supabaseServer()` (same import pattern as `scripts/cleanup-rerate.ts`); prod tables `works`, `ratings` (FK: `ratings.slug references works(slug) on delete cascade`), `aliases` (Task 2's migration must be applied to prod before `--merge` runs).
- Produces: alias rows that Task 3's redirect consumes. No exports (top-level script; do NOT import it from tests — it executes on import, matching the existing scripts pattern, which is why this task has no unit tests; `--scan` is the safety net).

- [ ] **Step 1: Write the script**

Create `scripts/merge-duplicates.ts`:

```ts
// scripts/merge-duplicates.ts
//
// Consolidates duplicate result pages. For each {dupe, canonical} pair:
// moves the rating over if the canonical lacks one, deletes the dupe's works
// row (FK cascades to its rating), and upserts an alias row so /r/<dupe>
// permanently redirects to /r/<canonical>.
//
// Usage (TLS-intercepting machine — pnpm dlx is blocked, use npx):
//   Scan only (default, no writes — reports candidate duplicate groups):
//     NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/merge-duplicates.ts
//   Apply the curated MERGES list:
//     NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/merge-duplicates.ts --merge
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Requires the aliases migration to be applied first.
// Idempotent: already-merged pairs are skipped. The dupe's view_count is
// discarded when the canonical already has a rating (negligible at our scale).
// NOTE: --scan groups year/hash twins only; title-variant dupes (e.g.
// blood-and-ash vs from-blood-and-ash) must be curated by hand from GSC.

import { supabaseServer } from '../src/lib/supabase-server';

// Curated from the 2026-08-02 GSC report; confirm with --scan before --merge.
const MERGES: Array<{ dupe: string; canonical: string }> = [
  // hash-suffix twin minted by the old raw-string identity comparison
  { dupe: 'fifty-shades-of-grey-james-2011-4f3e', canonical: 'fifty-shades-of-grey-james-2011' },
  // AI year wobble; ACOSF's real publication year is 2021
  { dupe: 'a-court-of-silver-flames-maas-2020', canonical: 'a-court-of-silver-flames-maas-2021' },
  // AI title variant; the book is "From Blood and Ash"
  { dupe: 'blood-and-ash-armentrout-2020', canonical: 'from-blood-and-ash-armentrout-2020' },
];

// Trailing -year and/or -hash4 stripped so year/hash variants group together.
// (A trailing year also matches the hex pattern; both replaces together still
// strip at most the two trailing segments.)
function identityKey(slug: string): string {
  return slug.replace(/-[0-9a-f]{4}$/, '').replace(/-\d{4}$/, '');
}

async function scan(): Promise<void> {
  const sb = supabaseServer();
  const { data, error } = await sb.from('works').select('slug, medium, title');
  if (error) { console.error('failed to read works', error); process.exit(1); }
  const groups = new Map<string, Array<{ slug: string; title: string }>>();
  for (const row of (data ?? []) as Array<{ slug: string; medium: string; title: string }>) {
    const key = `${row.medium}:${identityKey(row.slug)}`;
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }
  let found = 0;
  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    found++;
    console.log(`\n${key}`);
    for (const m of members) console.log(`  ${m.slug}  (${m.title})`);
  }
  console.log(
    found === 0
      ? '\nNo duplicate groups found.'
      : `\n${found} candidate group(s). Review, update MERGES if needed, then run with --merge.`
  );
}

async function merge(): Promise<void> {
  const sb = supabaseServer();
  for (const { dupe, canonical } of MERGES) {
    console.log(`\n${dupe} → ${canonical}`);
    const { data: dupeWork } = await sb.from('works').select('slug').eq('slug', dupe).maybeSingle();
    const { data: alias } = await sb.from('aliases').select('alias_slug').eq('alias_slug', dupe).maybeSingle();
    if (alias && !dupeWork) { console.log('  already merged — skipping'); continue; }
    const { data: canonWork } = await sb.from('works').select('slug').eq('slug', canonical).maybeSingle();
    if (!canonWork) { console.error('  ✗ canonical work missing — skipping (fix MERGES?)'); continue; }
    const { data: canonRating } = await sb.from('ratings').select('slug').eq('slug', canonical).maybeSingle();
    const { data: dupeRating } = await sb.from('ratings').select('slug').eq('slug', dupe).maybeSingle();
    if (!canonRating && dupeRating) {
      const { error } = await sb.from('ratings').update({ slug: canonical }).eq('slug', dupe);
      if (error) { console.error('  ✗ rating move failed', error); continue; }
      console.log('  rating moved to canonical');
    }
    if (dupeWork) {
      const { error } = await sb.from('works').delete().eq('slug', dupe); // cascades to ratings
      if (error) { console.error('  ✗ works delete failed', error); continue; }
      console.log('  dupe work deleted');
    }
    const { error: aliasErr } = await sb.from('aliases').upsert({ alias_slug: dupe, canonical_slug: canonical });
    if (aliasErr) { console.error('  ✗ alias upsert failed', aliasErr); continue; }
    console.log('  ✓ alias written');
  }
  console.log('\n=== merge complete ===');
}

const mode = process.argv.includes('--merge') ? merge : scan;
mode().then(() => process.exit(0));
```

- [ ] **Step 2: Verify it typechecks (scripts are covered by tsc)**

Run: `pnpm typecheck`
Expected: PASS. (Do NOT run the script against prod in this task.)

- [ ] **Step 3: Commit**

```bash
git add scripts/merge-duplicates.ts
git commit -m "feat(scripts): merge-duplicates operator script (scan + curated merge)"
```

---

### Task 6: Full validation + PR

**Files:**
- No new files; runs checks and opens the PR.

- [ ] **Step 1: Run the full verification suite**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Expected: all PASS. (`pnpm build` will log `UNABLE_TO_VERIFY_LEAF_SIGNATURE` noise from prerender DB calls — that is the known TLS quirk, not a failure; only a non-zero exit code is a failure.)

- [ ] **Step 2: Push and open the PR (do NOT merge)**

```bash
git push -u origin serp-ctr-and-dupes
gh pr create --title "SERP CTR: full-tease snippets + duplicate-slug consolidation" --body "$(cat <<'EOF'
## Summary
- Full-tease SERP title/description (verdict+score removed from Google snippet; OG/Twitter cards stay answer-first); on-page Q&A line now uses spice-level vocabulary
- New aliases table + 308 redirect so merged duplicate slugs consolidate onto one canonical page
- Disambiguation reuses an existing work on normalized identity match (kills the hash-suffix and year-wobble dupe classes)
- merge-duplicates operator script (scan + curated merge)

Spec: docs/superpowers/specs/2026-08-02-isitsmut-serp-ctr-design.md

## Post-merge rollout (operator steps, in order)
1. Apply supabase/migrations/20260802000001_create_aliases.sql to prod
2. merge-duplicates.ts --scan → review → --merge
3. Verify: alias URLs 308; new titles live

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Report back to Tyler for merge approval** (production deploy on merge — hard gate).

---

## Rollout (after Tyler approves merge — operator steps, in order)

1. **Merge:** `gh pr merge --squash --delete-branch` → Vercel auto-deploys main.
2. **Apply the aliases migration to prod** (before running the merge script). Options, in preference order:
   a. Supabase MCP (authenticate, then apply migration / execute SQL).
   b. `npx supabase db push` (CLI is linked; may hit the TLS interception — if it does, fall back).
   c. Paste the SQL into the Supabase dashboard SQL editor (needs Tyler's browser session).
3. **Scan:** `NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/merge-duplicates.ts` — confirm the three curated pairs exist as expected; add any new year/hash twins the scan surfaces (title-variant dupes are hand-curated only).
4. **Merge dupes:** same command with `--merge`.
5. **Verify live:**
   - `curl -I --ssl-no-revoke https://isitsmut.com/r/blood-and-ash-armentrout-2020` → 308 with `location: /r/from-blood-and-ash-armentrout-2020`
   - `curl -s --ssl-no-revoke https://isitsmut.com/r/red-rising-brown-2014 | findstr "<title>"` → tease title, no verdict/score
   - Spot-check the page renders the new Q&A line ("Spice level: …/10").
6. **GSC (optional, speeds recrawl):** request indexing for the top pages (Red Rising, The Housemaid) in the GSC UI.
7. **Watch:** GSC CTR on the high-impression pages over the following weeks (success: 0% → 2–4%).
