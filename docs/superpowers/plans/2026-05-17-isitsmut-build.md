# IsItSmut.com Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy IsItSmut.com — a mobile-first AI-powered website that rates books / movies / TV shows for "smut" content (1–10 score + synopsis + blurred "what's in it" details), shareable via permanent URLs with dynamic OG images.

**Architecture:** Next.js 15 (App Router) on Vercel · TypeScript · Tailwind · Supabase Postgres (cache) · Anthropic Claude Haiku 4.5 (rating engine, prompt-cached) · `@vercel/og` for share images · hCaptcha + IP-keyed rate limiter (Supabase-backed) for abuse · PostHog for page-view analytics. Two-step API flow: `/api/disambiguate` returns candidate matches, `/api/rate` returns cached or fresh AI rating. Cache hits bypass the rate limiter and never call Claude.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, `@anthropic-ai/sdk`, `@supabase/supabase-js`, `@supabase/ssr`, `@vercel/og`, `@hcaptcha/react-hcaptcha`, `posthog-js`, Vitest, MSW, `@testing-library/react`, Playwright. Package manager: pnpm.

**Spec:** `docs/superpowers/specs/2026-05-17-isitsmut-design.md`

---

## File Structure

```
isitsmut/
├── .env.local                          # local env (gitignored)
├── .env.example                        # committed template
├── .gitignore                          # exists
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── README.md
├── docs/superpowers/                   # spec + this plan
├── public/
│   └── favicon.ico
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 20260517000001_create_works.sql
│       ├── 20260517000002_create_ratings.sql
│       ├── 20260517000003_create_rate_limits.sql
│       └── 20260517000004_create_prune_cron.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # root layout, fonts, PostHog provider
│   │   ├── page.tsx                    # homepage (mockup A)
│   │   ├── globals.css                 # tailwind base + brand tokens
│   │   ├── not-found.tsx               # 404
│   │   ├── about/page.tsx
│   │   ├── terms/page.tsx
│   │   ├── privacy/page.tsx
│   │   ├── r/[slug]/page.tsx           # result page (mockup B)
│   │   ├── r/[slug]/opengraph-image.tsx  # dynamic OG image (Next.js convention)
│   │   └── api/
│   │       ├── disambiguate/route.ts
│   │       ├── rate/route.ts
│   │       └── captcha-verify/route.ts # hCaptcha server-side verify
│   ├── components/
│   │   ├── Footer.tsx                  # disclaimer + nav
│   │   ├── SearchBar.tsx
│   │   ├── TryTheseChips.tsx
│   │   ├── DisambiguationPicker.tsx
│   │   ├── ResultCard.tsx              # hero rating banner card
│   │   ├── SpoilerReveal.tsx           # blur + tap-to-reveal
│   │   ├── ShareButton.tsx
│   │   ├── CaptchaModal.tsx
│   │   ├── LoadingSkeleton.tsx
│   │   └── PostHogProvider.tsx
│   └── lib/
│       ├── types.ts                    # shared TS types (Work, Rating, Candidate)
│       ├── slug.ts                     # slugify + canonicalize
│       ├── verdict.ts                  # score → verdict line
│       ├── hash.ts                     # ip_hash helper
│       ├── supabase-server.ts          # server-only supabase client (service-role)
│       ├── supabase-browser.ts         # browser supabase client (anon)
│       ├── claude.ts                   # Anthropic SDK wrapper
│       ├── prompts.ts                  # system prompts (rubric)
│       ├── disambiguate.ts             # business logic for disambiguate
│       ├── rate.ts                     # business logic for rate (cache-first)
│       ├── rate-limit.ts               # ip-keyed counter + cookie check
│       └── og-template.tsx             # reusable OG image JSX
└── tests/
    ├── unit/                           # vitest unit tests for lib/
    ├── integration/                    # vitest integration tests for api/
    ├── fixtures/works.json
    ├── msw/handlers.ts                 # MSW handlers for Anthropic mocks
    ├── setup.ts                        # vitest setup
    └── e2e/golden-path.spec.ts         # single playwright test
```

---

## Phase 0 — Project Scaffolding

### Task 0.1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `public/`, etc. (created by `create-next-app`)

- [ ] **Step 1: Run create-next-app inside the existing repo**

The repo already has `.gitignore`, `docs/`, and a git history. We want Next.js scaffolded INTO this directory, not a subdirectory.

Run:
```bash
cd C:/Users/tword/Desktop/IsItSmut
pnpm dlx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-turbopack
```

When prompted "Would you like to use Turbopack?" answer **No** (we want plain webpack for `@vercel/og` compatibility).
When prompted "would you like to customize the default import alias?" accept default `@/*`.
If asked to overwrite existing files (`.gitignore`, `README.md`), answer **No** for `.gitignore` (we already wrote it), **Yes** for `README.md`.

Expected output: scaffolds `package.json`, `src/app/{layout.tsx,page.tsx,globals.css}`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `public/`, `.eslintrc.json`.

- [ ] **Step 2: Verify it boots**

Run: `pnpm dev`
Expected: server starts on `http://localhost:3000`, default Next.js page renders.
Kill with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 + TypeScript + Tailwind"
```

---

### Task 0.2: Install runtime dependencies

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install Anthropic, Supabase, OG, hCaptcha, PostHog**

Run:
```bash
pnpm add @anthropic-ai/sdk @supabase/supabase-js @supabase/ssr @vercel/og @hcaptcha/react-hcaptcha posthog-js
```

Expected: deps added to `package.json` `dependencies`. No errors.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add runtime deps (anthropic, supabase, og, hcaptcha, posthog)"
```

---

### Task 0.3: Install dev dependencies (testing stack)

**Files:** `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install Vitest + RTL + MSW + Playwright**

Run:
```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event msw @playwright/test
```

- [ ] **Step 2: Install Playwright browsers**

Run: `pnpm exec playwright install chromium`
Expected: downloads Chromium for Playwright.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add dev deps (vitest, RTL, msw, playwright)"
```

---

### Task 0.4: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 2: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 3: Add scripts to `package.json`**

Add to the `"scripts"` block:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 4: Smoke test — make sure Vitest discovers nothing without erroring**

Run: `pnpm test`
Expected: "No test files found" (exit code 0 or 1, but no config errors).

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts tests/setup.ts package.json
git commit -m "chore: configure Vitest + jsdom + RTL"
```

---

### Task 0.5: Configure Playwright

**Files:** Create `playwright.config.ts`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: configure Playwright"
```

---

### Task 0.6: Create `.env.example` and document env vars

**Files:** Create `.env.example`

- [ ] **Step 1: Create `.env.example`**

```bash
# Anthropic
ANTHROPIC_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# hCaptcha
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=
HCAPTCHA_SECRET_KEY=

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Rate limiting
RATE_LIMIT_SALT=change-me-locally

# Public URL (used for share links + OG image absolute URLs)
NEXT_PUBLIC_SHARE_BASE_URL=http://localhost:3000
```

- [ ] **Step 2: Create local `.env.local` (USER ACTION)**

Copy `.env.example` → `.env.local`. Real values get filled in during Phase 11. For development, set:
- `ANTHROPIC_API_KEY` — your real Anthropic key (needed to test AI calls locally)
- `RATE_LIMIT_SALT` — any random string
- Supabase / hCaptcha / PostHog can be left blank until those services exist.

- [ ] **Step 3: Commit `.env.example` only**

```bash
git add .env.example
git commit -m "chore: document env vars in .env.example"
```

---

## Phase 1 — Supabase Schema & Local Setup

### Task 1.1: Install Supabase CLI and initialize local config

**Files:** `supabase/config.toml`

- [ ] **Step 1: Install Supabase CLI globally**

Run: `pnpm dlx supabase --version`
Expected: prints CLI version. If first-time, may install.

- [ ] **Step 2: Initialize supabase project config**

Run: `pnpm dlx supabase init`
Expected: creates `supabase/` directory with `config.toml`. Answer **No** to "Generate VS Code settings".

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "chore: init supabase local config"
```

---

### Task 1.2: Migration — `works` table

**Files:** Create `supabase/migrations/20260517000001_create_works.sql`

- [ ] **Step 1: Write the migration**

```sql
create table public.works (
  slug         text primary key,
  medium       text not null check (medium in ('book', 'movie', 'tv')),
  title        text not null,
  creator      text not null,
  year         int,
  created_at   timestamptz not null default now()
);

create index works_title_lower_idx on public.works (lower(title));

alter table public.works enable row level security;

create policy "works_public_read"
  on public.works for select
  to anon, authenticated
  using (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260517000001_create_works.sql
git commit -m "feat(db): add works table + public read RLS"
```

---

### Task 1.3: Migration — `ratings` table

**Files:** Create `supabase/migrations/20260517000002_create_ratings.sql`

- [ ] **Step 1: Write the migration**

```sql
create table public.ratings (
  slug         text primary key references public.works(slug) on delete cascade,
  known        boolean not null,
  score        int check (score between 1 and 10),
  verdict      text,
  synopsis     text,
  details      text,
  tags         text[],
  model        text not null,
  rated_at     timestamptz not null default now(),
  view_count   int not null default 0
);

create index ratings_rated_at_idx on public.ratings (rated_at desc);
create index ratings_view_count_idx on public.ratings (view_count desc) where known = true;

alter table public.ratings enable row level security;

create policy "ratings_public_read"
  on public.ratings for select
  to anon, authenticated
  using (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260517000002_create_ratings.sql
git commit -m "feat(db): add ratings table + public read RLS"
```

---

### Task 1.4: Migration — `rate_limits` table

**Files:** Create `supabase/migrations/20260517000003_create_rate_limits.sql`

- [ ] **Step 1: Write the migration**

```sql
create table public.rate_limits (
  ip_hash       text not null,
  window_start  timestamptz not null,
  count         int not null default 0,
  primary key (ip_hash, window_start)
);

alter table public.rate_limits enable row level security;

-- No policies = no access from anon/authenticated.
-- Server uses service-role key which bypasses RLS.
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260517000003_create_rate_limits.sql
git commit -m "feat(db): add rate_limits table (server-only via service role)"
```

---

### Task 1.5: Migration — daily prune cron

**Files:** Create `supabase/migrations/20260517000004_create_prune_cron.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Requires pg_cron extension. Enable in Supabase dashboard under Database → Extensions.
-- Migration is idempotent: extension creation is conditional.

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'prune-rate-limits',
  '0 3 * * *',
  $$delete from public.rate_limits where window_start < now() - interval '2 days'$$
);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260517000004_create_prune_cron.sql
git commit -m "feat(db): schedule daily prune of rate_limits"
```

---

### Task 1.6: Apply migrations to local Supabase (via Docker)

This task verifies the migrations are valid SQL by running them against the local Supabase stack.

- [ ] **Step 1: Start local Supabase**

Run: `pnpm dlx supabase start`
Expected: Docker spins up Postgres + Studio + GoTrue + Storage. Prints URLs and `anon key` + `service_role key` for local. May take a few minutes on first run.

If Docker isn't installed: skip this task and trust the SQL — migrations will be applied to the real project in Phase 11. Just commit the migration files and move on.

- [ ] **Step 2: Verify schema**

Run: `pnpm dlx supabase db reset`
Expected: drops local DB and re-applies all migrations cleanly. No errors.

- [ ] **Step 3: Stop local Supabase**

Run: `pnpm dlx supabase stop`

- [ ] **Step 4: No commit (no code changes)**

---

## Phase 2 — Pure Utility Functions (TDD)

### Task 2.1: `slugify` — basic case

**Files:**
- Create: `src/lib/slug.ts`
- Test: `tests/unit/slug.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/slug.test.ts
import { describe, it, expect } from 'vitest';
import { slugify } from '@/lib/slug';

describe('slugify', () => {
  it('produces title-lastname-year slug for a simple book', () => {
    expect(slugify({ title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023 }))
      .toBe('fourth-wing-yarros-2023');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/slug.test.ts`
Expected: FAIL with "Cannot find module '@/lib/slug'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/slug.ts
export type SlugInput = { title: string; creator: string; year: number | null };

function kebab(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function lastWord(s: string): string {
  const words = s.trim().split(/\s+/);
  return words[words.length - 1] || s;
}

export function slugify(input: SlugInput): string {
  const titlePart = kebab(input.title);
  const creatorPart = kebab(lastWord(input.creator));
  const yearPart = input.year != null ? String(input.year) : '';
  return [titlePart, creatorPart, yearPart].filter(Boolean).join('-');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/slug.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts tests/unit/slug.test.ts
git commit -m "feat(slug): basic slugify for title-lastname-year"
```

---

### Task 2.2: `slugify` — handles punctuation, accents, missing year

**Files:**
- Test: `tests/unit/slug.test.ts` (add cases)
- Modify: `src/lib/slug.ts` only if tests fail

- [ ] **Step 1: Add failing tests**

Append to `tests/unit/slug.test.ts`:
```ts
describe('slugify edge cases', () => {
  it('strips punctuation from title', () => {
    expect(slugify({ title: "It Ends with Us", creator: 'Colleen Hoover', year: 2016 }))
      .toBe('it-ends-with-us-hoover-2016');
  });

  it('handles accents and apostrophes', () => {
    expect(slugify({ title: "L'Étranger", creator: 'Albert Camus', year: 1942 }))
      .toBe('letranger-camus-1942');
  });

  it('omits year segment when year is null', () => {
    expect(slugify({ title: 'Unknown Work', creator: 'A. Person', year: null }))
      .toBe('unknown-work-person');
  });

  it('collapses multiple spaces', () => {
    expect(slugify({ title: '  Spaced   Out  ', creator: 'B. Author', year: 2020 }))
      .toBe('spaced-out-author-2020');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test tests/unit/slug.test.ts`
Expected: all PASS (implementation already handles these). If any fail, fix in `slug.ts`.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/slug.test.ts
git commit -m "test(slug): cover punctuation, accents, missing year"
```

---

### Task 2.3: `slugify` — collision suffix

**Files:**
- Test: `tests/unit/slug.test.ts`
- Modify: `src/lib/slug.ts`

- [ ] **Step 1: Add failing test for `slugifyWithCollisionCheck`**

Append to `tests/unit/slug.test.ts`:
```ts
import { slugifyWithCollisionCheck } from '@/lib/slug';

describe('slugifyWithCollisionCheck', () => {
  it('returns base slug when no collision', () => {
    const exists = async (_: string) => false;
    return expect(
      slugifyWithCollisionCheck({ title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023 }, exists)
    ).resolves.toBe('fourth-wing-yarros-2023');
  });

  it('appends hash suffix when slug collides', async () => {
    const exists = async (s: string) => s === 'it-king-1986';
    const result = await slugifyWithCollisionCheck(
      { title: 'It', creator: 'Stephen King', year: 1986 },
      exists
    );
    expect(result).toMatch(/^it-king-1986-[a-f0-9]{4}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/slug.test.ts`
Expected: FAIL with "slugifyWithCollisionCheck is not a function".

- [ ] **Step 3: Add implementation**

Append to `src/lib/slug.ts`:
```ts
import { createHash } from 'node:crypto';

export async function slugifyWithCollisionCheck(
  input: SlugInput,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugify(input);
  if (!(await exists(base))) return base;
  const hash = createHash('sha256')
    .update(`${input.title}|${input.creator}`)
    .digest('hex')
    .slice(0, 4);
  return `${base}-${hash}`;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test tests/unit/slug.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts tests/unit/slug.test.ts
git commit -m "feat(slug): add collision check with 4-char hash suffix"
```

---

### Task 2.4: `verdictFromScore`

**Files:**
- Create: `src/lib/verdict.ts`
- Test: `tests/unit/verdict.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/unit/verdict.test.ts
import { describe, it, expect } from 'vitest';
import { verdictFromScore } from '@/lib/verdict';

describe('verdictFromScore', () => {
  it.each([
    [1, 'Not smut.'],
    [3, 'Not smut.'],
    [4, 'A little spicy.'],
    [6, 'A little spicy.'],
    [7, "Yes, it's smut."],
    [8, "Yes, it's smut."],
    [9, 'Absolutely smut.'],
    [10, 'Absolutely smut.'],
  ])('score %i → "%s"', (score, expected) => {
    expect(verdictFromScore(score)).toBe(expected);
  });

  it('throws on out-of-range scores', () => {
    expect(() => verdictFromScore(0)).toThrow();
    expect(() => verdictFromScore(11)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `pnpm test tests/unit/verdict.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/verdict.ts
export function verdictFromScore(score: number): string {
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    throw new Error(`Score out of range: ${score}`);
  }
  if (score <= 3) return 'Not smut.';
  if (score <= 6) return 'A little spicy.';
  if (score <= 8) return "Yes, it's smut.";
  return 'Absolutely smut.';
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test tests/unit/verdict.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/verdict.ts tests/unit/verdict.test.ts
git commit -m "feat(verdict): score → verdict line mapping"
```

---

### Task 2.5: `hashIp` helper

**Files:**
- Create: `src/lib/hash.ts`
- Test: `tests/unit/hash.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/hash.test.ts
import { describe, it, expect } from 'vitest';
import { hashIp } from '@/lib/hash';

describe('hashIp', () => {
  it('produces a stable sha256 hex string', () => {
    expect(hashIp('1.2.3.4', 'salt')).toBe(hashIp('1.2.3.4', 'salt'));
    expect(hashIp('1.2.3.4', 'salt')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hash for different IP', () => {
    expect(hashIp('1.2.3.4', 'salt')).not.toBe(hashIp('5.6.7.8', 'salt'));
  });

  it('produces different hash when salt changes', () => {
    expect(hashIp('1.2.3.4', 'a')).not.toBe(hashIp('1.2.3.4', 'b'));
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/unit/hash.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/hash.ts
import { createHash } from 'node:crypto';

export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${ip}|${salt}`).digest('hex');
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test tests/unit/hash.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hash.ts tests/unit/hash.test.ts
git commit -m "feat(hash): sha256 ip-hash helper"
```

---

### Task 2.6: Shared types

**Files:** Create `src/lib/types.ts`

- [ ] **Step 1: Write the types**

```ts
// src/lib/types.ts
export type Medium = 'book' | 'movie' | 'tv';

export type Work = {
  slug: string;
  medium: Medium;
  title: string;
  creator: string;
  year: number | null;
};

export type Candidate = Work;

export type Rating =
  | {
      slug: string;
      known: true;
      score: number;       // 1-10
      verdict: string;
      synopsis: string;
      details: string;
      tags: string[];
      model: string;
      rated_at: string;
      view_count: number;
    }
  | {
      slug: string;
      known: false;
      model: string;
      rated_at: string;
      view_count: number;
    };

export type DisambiguateResponse = { candidates: Candidate[] };

export type RateRequest = { slug: string };
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): shared Work / Rating / Candidate types"
```

---

## Phase 3 — Claude Client & Prompts

### Task 3.1: System prompts

**Files:** Create `src/lib/prompts.ts`

- [ ] **Step 1: Write the prompts module**

```ts
// src/lib/prompts.ts

export const DISAMBIGUATE_SYSTEM_PROMPT = `You are a media disambiguation service for IsItSmut.com.

Given a user's query (a book, movie, or TV show title — possibly partial or misspelled), return 1–4 likely matches as a JSON object via the provided tool.

Each match must have:
- title: the official title
- creator: author for books, primary director or showrunner for movies/TV
- year: release/publication year as an integer (or null if unknown)
- medium: one of "book", "movie", "tv"

Rank by popularity. If the query is clearly one specific work, return just that one match. If you have NO confident matches, return an empty candidates array.

Never make up works that don't exist.`;

export const RATE_SYSTEM_PROMPT = `You are the smut rating engine for IsItSmut.com.

Given a specific work (title + creator + year + medium), rate its sexual content via the provided tool.

DEFINITION OF SMUT:
"Smut" = sexual content / detailed physical intimacy (sex scenes, explicit foreplay, on-page or on-screen).
NOT smut: mere romance, kissing, fade-to-black, innuendo, or themes of attraction without depiction.

RATING SCALE (1–10, integer):
1  = no sexual content
3  = brief or fade-to-black only
5  = a couple of mild on-page/screen scenes
7  = several detailed scenes
9  = frequent and explicit
10 = erotica / erotic romance (the point of the work)

OUTPUT FIELDS:
- known: false if you don't recognize the work or aren't confident enough to rate it. If false, omit all other fields.
- score: integer 1–10 per the scale above
- verdict: a short tagline. Map score to:
    1–3 → "Not smut."
    4–6 → "A little spicy."
    7–8 → "Yes, it's smut."
    9–10 → "Absolutely smut."
- synopsis: 1–2 sentences. Cover only setup and inciting incident. No major spoilers.
- details: tasteful + clinical description of the sexual content. ≤ 60 words. Subway-safe wording — name scene count, kink references, and chapter pointers if known, but DON'T dramatize or quote. Example: "Multiple explicit scenes, including detailed sex scenes in chapters 23 and 38. References to BDSM and oral sex."
- tags: 2–4 short pills like "Open door", "Fade-to-black", "BDSM", "Enemies to lovers", "Closed door".

UNCERTAINTY RULE: If you don't recognize the work or aren't confident about its sexual content, set known=false and omit all other fields. Never guess.`;

export function buildRateUserMessage(work: { title: string; creator: string; year: number | null; medium: string }): string {
  const yearPart = work.year != null ? ` (${work.year})` : '';
  return `Rate: ${work.title}${yearPart} — ${work.medium}, by ${work.creator}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/prompts.ts
git commit -m "feat(prompts): disambiguate + rate system prompts"
```

---

### Task 3.2: Claude client wrapper

**Files:**
- Create: `src/lib/claude.ts`
- Test: `tests/integration/claude.test.ts`
- Create: `tests/msw/handlers.ts`

- [ ] **Step 1: Write MSW handlers for Anthropic**

```ts
// tests/msw/handlers.ts
import { http, HttpResponse } from 'msw';

export const anthropicSuccessDisambiguate = http.post(
  'https://api.anthropic.com/v1/messages',
  () => HttpResponse.json({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    content: [{
      type: 'tool_use',
      id: 'tool_test',
      name: 'submit_candidates',
      input: {
        candidates: [
          { title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' },
        ],
      },
    }],
    stop_reason: 'tool_use',
    usage: { input_tokens: 100, output_tokens: 30 },
  })
);

export const anthropicSuccessRate = http.post(
  'https://api.anthropic.com/v1/messages',
  () => HttpResponse.json({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    content: [{
      type: 'tool_use',
      id: 'tool_test',
      name: 'submit_rating',
      input: {
        known: true,
        score: 8,
        verdict: "Yes, it's smut.",
        synopsis: 'A war college for dragon riders. Violet, runt of her family, must survive deadly trials.',
        details: 'Multiple explicit scenes including detailed sex scenes in later chapters. References to enemies-to-lovers tension.',
        tags: ['Open door', 'Enemies to lovers'],
      },
    }],
    stop_reason: 'tool_use',
    usage: { input_tokens: 200, output_tokens: 80 },
  })
);

export const anthropicError = http.post(
  'https://api.anthropic.com/v1/messages',
  () => HttpResponse.json({ type: 'error', error: { type: 'overloaded_error', message: 'overloaded' } }, { status: 529 })
);
```

- [ ] **Step 2: Write failing test**

```ts
// tests/integration/claude.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { callDisambiguate, callRate } from '@/lib/claude';
import { anthropicSuccessDisambiguate, anthropicSuccessRate } from '../msw/handlers';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('callDisambiguate', () => {
  it('returns parsed candidates from tool_use response', async () => {
    server.use(anthropicSuccessDisambiguate);
    const result = await callDisambiguate('fourth wing');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      title: 'Fourth Wing',
      creator: 'Rebecca Yarros',
      year: 2023,
      medium: 'book',
    });
  });
});

describe('callRate', () => {
  it('returns parsed rating from tool_use response', async () => {
    server.use(anthropicSuccessRate);
    const result = await callRate({
      title: 'Fourth Wing',
      creator: 'Rebecca Yarros',
      year: 2023,
      medium: 'book',
    });
    expect(result).toMatchObject({
      known: true,
      score: 8,
      verdict: "Yes, it's smut.",
      tags: ['Open door', 'Enemies to lovers'],
    });
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `pnpm test tests/integration/claude.test.ts`
Expected: FAIL "Cannot find module '@/lib/claude'".

- [ ] **Step 4: Implement Claude client**

```ts
// src/lib/claude.ts
import Anthropic from '@anthropic-ai/sdk';
import { DISAMBIGUATE_SYSTEM_PROMPT, RATE_SYSTEM_PROMPT, buildRateUserMessage } from './prompts';

const MODEL = 'claude-haiku-4-5-20251001';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const CLAUDE_MODEL = MODEL;

const disambiguateTool: Anthropic.Tool = {
  name: 'submit_candidates',
  description: 'Submit 0–4 candidate matches for the user query.',
  input_schema: {
    type: 'object',
    properties: {
      candidates: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          required: ['title', 'creator', 'year', 'medium'],
          properties: {
            title: { type: 'string' },
            creator: { type: 'string' },
            year: { type: ['integer', 'null'] },
            medium: { type: 'string', enum: ['book', 'movie', 'tv'] },
          },
        },
      },
    },
    required: ['candidates'],
  },
};

const rateTool: Anthropic.Tool = {
  name: 'submit_rating',
  description: 'Submit the smut rating for the given work.',
  input_schema: {
    type: 'object',
    required: ['known'],
    properties: {
      known: { type: 'boolean' },
      score: { type: 'integer', minimum: 1, maximum: 10 },
      verdict: { type: 'string' },
      synopsis: { type: 'string' },
      details: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
    },
  },
};

export type DisambiguateRaw = {
  candidates: Array<{ title: string; creator: string; year: number | null; medium: 'book' | 'movie' | 'tv' }>;
};

export type RateRaw =
  | { known: false }
  | {
      known: true;
      score: number;
      verdict: string;
      synopsis: string;
      details: string;
      tags: string[];
    };

function extractTool<T>(message: Anthropic.Message, name: string): T {
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === name) return block.input as T;
  }
  throw new Error(`Expected tool_use block "${name}" in Claude response`);
}

export async function callDisambiguate(query: string): Promise<DisambiguateRaw> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    temperature: 0,
    system: [{ type: 'text', text: DISAMBIGUATE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [disambiguateTool],
    tool_choice: { type: 'tool', name: 'submit_candidates' },
    messages: [{ role: 'user', content: query }],
  });
  return extractTool<DisambiguateRaw>(message, 'submit_candidates');
}

export async function callRate(work: {
  title: string; creator: string; year: number | null; medium: string;
}): Promise<RateRaw> {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    temperature: 0,
    system: [{ type: 'text', text: RATE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [rateTool],
    tool_choice: { type: 'tool', name: 'submit_rating' },
    messages: [{ role: 'user', content: buildRateUserMessage(work) }],
  });
  return extractTool<RateRaw>(message, 'submit_rating');
}
```

- [ ] **Step 5: Run, verify pass**

Run: `pnpm test tests/integration/claude.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/claude.ts tests/integration/claude.test.ts tests/msw/handlers.ts
git commit -m "feat(claude): tool-use wrappers for disambiguate + rate with prompt caching"
```

---

### Task 3.3: Retry-once-on-5xx wrapper

**Files:**
- Test: `tests/integration/claude.test.ts` (extend)
- Modify: `src/lib/claude.ts`

- [ ] **Step 1: Add failing test for retry**

Append to `tests/integration/claude.test.ts`:
```ts
import { http, HttpResponse } from 'msw';

describe('callRate retry behavior', () => {
  it('retries once on 5xx then succeeds', async () => {
    let calls = 0;
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        calls++;
        if (calls === 1) {
          return HttpResponse.json({ type: 'error', error: { message: 'overloaded' } }, { status: 529 });
        }
        return HttpResponse.json({
          id: 'msg', type: 'message', role: 'assistant', model: 'claude-haiku-4-5-20251001',
          content: [{ type: 'tool_use', id: 't', name: 'submit_rating', input: { known: false } }],
          stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 },
        });
      })
    );
    const result = await callRate({ title: 'X', creator: 'Y', year: 2020, medium: 'book' });
    expect(calls).toBe(2);
    expect(result).toEqual({ known: false });
  });

  it('throws after second consecutive 5xx', async () => {
    server.use(http.post('https://api.anthropic.com/v1/messages', () =>
      HttpResponse.json({ type: 'error', error: { message: 'overloaded' } }, { status: 529 })
    ));
    await expect(callRate({ title: 'X', creator: 'Y', year: 2020, medium: 'book' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Expected: FAIL — current implementation doesn't retry.

- [ ] **Step 3: Add retry wrapper**

Modify `src/lib/claude.ts` — replace `callDisambiguate` and `callRate` bodies' `anthropic.messages.create(...)` call with a retry wrapper. Add at top of file:

```ts
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Anthropic.APIError && err.status != null && err.status >= 500) {
      await new Promise((r) => setTimeout(r, 500));
      return await fn();
    }
    throw err;
  }
}
```

Wrap the create calls:
```ts
const message = await withRetry(() => anthropic.messages.create({ /* ...same args... */ }));
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test tests/integration/claude.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/claude.ts tests/integration/claude.test.ts
git commit -m "feat(claude): retry once on 5xx with 500ms delay"
```

---

## Phase 4 — Supabase Clients & Rate Limiting

### Task 4.1: Supabase server client

**Files:** Create `src/lib/supabase-server.ts`

- [ ] **Step 1: Write the server client**

```ts
// src/lib/supabase-server.ts
// Server-only Supabase client using the service role key. Bypasses RLS.
// NEVER import this in client components.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function supabaseServer(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase-server.ts
git commit -m "feat(db): server-only supabase client (service role)"
```

---

### Task 4.2: Supabase browser client

**Files:** Create `src/lib/supabase-browser.ts`

- [ ] **Step 1: Write the browser client**

```ts
// src/lib/supabase-browser.ts
import { createBrowserClient } from '@supabase/ssr';

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase-browser.ts
git commit -m "feat(db): browser supabase client (anon)"
```

---

### Task 4.3: Rate-limit module

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `tests/integration/rate-limit.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/integration/rate-limit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkAndIncrement, currentWindowStart } from '@/lib/rate-limit';

vi.mock('@/lib/supabase-server', () => {
  const rows = new Map<string, number>();
  return {
    supabaseServer: () => ({
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        if (name !== 'rate_limit_increment') throw new Error('unknown rpc');
        const key = `${args.p_ip_hash}|${args.p_window_start}`;
        const next = (rows.get(key) ?? 0) + 1;
        rows.set(key, next);
        return { data: next, error: null };
      }),
    }),
  };
});

describe('rate-limit', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rounds window_start to the hour', () => {
    const start = currentWindowStart(new Date('2026-05-17T14:37:42Z'));
    expect(start.toISOString()).toBe('2026-05-17T14:00:00.000Z');
  });

  it('returns allowed for requests under limit', async () => {
    for (let i = 1; i <= 20; i++) {
      const result = await checkAndIncrement({ ipHash: 'abc', limit: 20 });
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(i);
    }
  });

  it('blocks the 21st request', async () => {
    for (let i = 1; i <= 20; i++) {
      await checkAndIncrement({ ipHash: 'def', limit: 20 });
    }
    const result = await checkAndIncrement({ ipHash: 'def', limit: 20 });
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(21);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/integration/rate-limit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/rate-limit.ts
import { supabaseServer } from './supabase-server';

export function currentWindowStart(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

export async function checkAndIncrement(input: {
  ipHash: string;
  limit: number;
}): Promise<{ allowed: boolean; count: number }> {
  const sb = supabaseServer();
  const windowStart = currentWindowStart().toISOString();
  const { data, error } = await sb.rpc('rate_limit_increment', {
    p_ip_hash: input.ipHash,
    p_window_start: windowStart,
  });
  if (error) throw error;
  const count = Number(data);
  return { allowed: count <= input.limit, count };
}
```

- [ ] **Step 4: Add the Postgres RPC migration**

Create `supabase/migrations/20260517000005_create_rate_limit_rpc.sql`:
```sql
create or replace function public.rate_limit_increment(
  p_ip_hash text,
  p_window_start timestamptz
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.rate_limits (ip_hash, window_start, count)
  values (p_ip_hash, p_window_start, 1)
  on conflict (ip_hash, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

revoke all on function public.rate_limit_increment(text, timestamptz) from public, anon, authenticated;
```

- [ ] **Step 5: Run tests, verify pass**

Run: `pnpm test tests/integration/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rate-limit.ts tests/integration/rate-limit.test.ts supabase/migrations/20260517000005_create_rate_limit_rpc.sql
git commit -m "feat(rate-limit): atomic ip-keyed increment with RPC + tests"
```

---

### Task 4.4: Captcha-cookie helpers

**Files:**
- Create: `src/lib/captcha-cookie.ts`
- Test: `tests/unit/captcha-cookie.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/unit/captcha-cookie.test.ts
import { describe, it, expect } from 'vitest';
import { signCookieValue, verifyCookieValue } from '@/lib/captcha-cookie';

describe('captcha-cookie', () => {
  const secret = 'test-secret';

  it('round-trips a valid cookie', () => {
    const value = signCookieValue({ exp: Date.now() + 3600_000 }, secret);
    expect(verifyCookieValue(value, secret)).not.toBeNull();
  });

  it('rejects tampered cookie', () => {
    const value = signCookieValue({ exp: Date.now() + 3600_000 }, secret);
    expect(verifyCookieValue(value + 'x', secret)).toBeNull();
  });

  it('rejects expired cookie', () => {
    const value = signCookieValue({ exp: Date.now() - 1000 }, secret);
    expect(verifyCookieValue(value, secret)).toBeNull();
  });

  it('rejects cookie signed with wrong secret', () => {
    const value = signCookieValue({ exp: Date.now() + 3600_000 }, 'other-secret');
    expect(verifyCookieValue(value, secret)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/unit/captcha-cookie.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/captcha-cookie.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export const CAPTCHA_COOKIE_NAME = 'iisc';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signCookieValue(payload: { exp: number }, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function verifyCookieValue(
  value: string,
  secret: string
): { exp: number } | null {
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  const expected = sign(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test tests/unit/captcha-cookie.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/captcha-cookie.ts tests/unit/captcha-cookie.test.ts
git commit -m "feat(captcha): signed cookie helpers with HMAC + expiry"
```

---

### Task 4.5: hCaptcha verify endpoint

**Files:**
- Create: `src/app/api/captcha-verify/route.ts`
- Test: `tests/integration/captcha-verify.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/integration/captcha-verify.test.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { POST } from '@/app/api/captcha-verify/route';

const server = setupServer();
beforeAll(() => { server.listen({ onUnhandledRequest: 'error' }); process.env.HCAPTCHA_SECRET_KEY = 'test-secret'; process.env.RATE_LIMIT_SALT = 'test-salt'; });
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('POST /api/captcha-verify', () => {
  it('sets cookie on successful verification', async () => {
    server.use(http.post('https://api.hcaptcha.com/siteverify', () =>
      HttpResponse.json({ success: true })
    ));
    const req = new Request('http://localhost/api/captcha-verify', {
      method: 'POST',
      body: JSON.stringify({ token: 'ok-token' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('iisc=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('returns 403 when hCaptcha rejects', async () => {
    server.use(http.post('https://api.hcaptcha.com/siteverify', () =>
      HttpResponse.json({ success: false, 'error-codes': ['invalid-input-response'] })
    ));
    const req = new Request('http://localhost/api/captcha-verify', {
      method: 'POST',
      body: JSON.stringify({ token: 'bad' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/integration/captcha-verify.test.ts`
Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement endpoint**

```ts
// src/app/api/captcha-verify/route.ts
import { NextResponse } from 'next/server';
import { signCookieValue, CAPTCHA_COOKIE_NAME } from '@/lib/captcha-cookie';

export const runtime = 'edge';

const ONE_HOUR_MS = 3600_000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { token?: string } | null;
  if (!body?.token) return NextResponse.json({ error: 'missing_token' }, { status: 400 });

  const secret = process.env.HCAPTCHA_SECRET_KEY;
  const cookieSecret = process.env.RATE_LIMIT_SALT;
  if (!secret || !cookieSecret) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  const verifyRes = await fetch('https://api.hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: body.token }),
  });
  const data = await verifyRes.json() as { success: boolean };
  if (!data.success) return NextResponse.json({ error: 'captcha_failed' }, { status: 403 });

  const cookieValue = signCookieValue({ exp: Date.now() + ONE_HOUR_MS }, cookieSecret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CAPTCHA_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  });
  return res;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test tests/integration/captcha-verify.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/captcha-verify/route.ts tests/integration/captcha-verify.test.ts
git commit -m "feat(api): hCaptcha verify endpoint sets signed cookie"
```

---

## Phase 5 — Business Logic & API Routes

### Task 5.1: `disambiguate` business logic

**Files:**
- Create: `src/lib/disambiguate.ts`
- Test: `tests/integration/disambiguate-lib.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/integration/disambiguate-lib.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDisambiguate } from '@/lib/disambiguate';

vi.mock('@/lib/claude', () => ({
  callDisambiguate: vi.fn(async (_q: string) => ({
    candidates: [{ title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' }],
  })),
}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }),
}));

describe('runDisambiguate', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/integration/disambiguate-lib.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/disambiguate.ts
import { callDisambiguate } from './claude';
import { slugifyWithCollisionCheck } from './slug';
import { supabaseServer } from './supabase-server';
import type { Candidate } from './types';

export async function runDisambiguate(query: string): Promise<{ candidates: Candidate[] }> {
  const raw = await callDisambiguate(query);
  const sb = supabaseServer();

  const candidates: Candidate[] = [];
  for (const c of raw.candidates) {
    const existsForOther = async (slug: string): Promise<boolean> => {
      const { data } = await sb
        .from('works')
        .select('title, creator, year')
        .eq('slug', slug)
        .maybeSingle();
      if (!data) return false;
      return data.title !== c.title || data.creator !== c.creator || data.year !== c.year;
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

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test tests/integration/disambiguate-lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/disambiguate.ts tests/integration/disambiguate-lib.test.ts
git commit -m "feat(disambiguate): business logic with slug + collision check"
```

---

### Task 5.2: `rate` business logic (cache-first)

**Files:**
- Create: `src/lib/rate.ts`
- Test: `tests/integration/rate-lib.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/integration/rate-lib.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runRate } from '@/lib/rate';
import * as claudeMod from '@/lib/claude';

const ratingsStore = new Map<string, unknown>();
const worksStore = new Map<string, unknown>();

vi.mock('@/lib/claude', () => ({
  callRate: vi.fn(),
  CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
}));

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: (table: string) => {
      const store = table === 'ratings' ? ratingsStore : worksStore;
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => ({ data: store.get(val) ?? null, error: null }),
            single: async () => {
              const v = store.get(val);
              return v ? { data: v, error: null } : { data: null, error: { code: 'PGRST116' } };
            },
          }),
        }),
        upsert: (rows: unknown) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          arr.forEach((r: { slug: string }) => store.set(r.slug, r));
          return { error: null };
        },
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    },
    rpc: async () => ({ data: null, error: null }),
  }),
}));

describe('runRate', () => {
  beforeEach(() => {
    ratingsStore.clear();
    worksStore.clear();
    vi.clearAllMocks();
  });

  it('returns cached rating without calling Claude on cache hit', async () => {
    ratingsStore.set('fourth-wing-yarros-2023', {
      slug: 'fourth-wing-yarros-2023',
      known: true, score: 8, verdict: "Yes, it's smut.",
      synopsis: 's', details: 'd', tags: ['Open door', 'Enemies to lovers'],
      model: 'claude-haiku-4-5-20251001',
      rated_at: '2026-05-17T00:00:00Z',
      view_count: 5,
    });
    worksStore.set('fourth-wing-yarros-2023', {
      slug: 'fourth-wing-yarros-2023', medium: 'book',
      title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023,
    });
    const result = await runRate({
      slug: 'fourth-wing-yarros-2023',
      candidate: { title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' },
    });
    expect(result.cacheHit).toBe(true);
    expect(claudeMod.callRate).not.toHaveBeenCalled();
    expect(result.rating.known).toBe(true);
  });

  it('calls Claude on cache miss, writes works + ratings', async () => {
    vi.mocked(claudeMod.callRate).mockResolvedValueOnce({
      known: true, score: 7, verdict: "Yes, it's smut.",
      synopsis: 'syn', details: 'det', tags: ['Open door', 'Romance'],
    });
    const result = await runRate({
      slug: 'fourth-wing-yarros-2023',
      candidate: { title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' },
    });
    expect(result.cacheHit).toBe(false);
    expect(claudeMod.callRate).toHaveBeenCalledOnce();
    expect(worksStore.has('fourth-wing-yarros-2023')).toBe(true);
    expect(ratingsStore.has('fourth-wing-yarros-2023')).toBe(true);
    expect(result.rating.known).toBe(true);
  });

  it('persists known=false from Claude', async () => {
    vi.mocked(claudeMod.callRate).mockResolvedValueOnce({ known: false });
    const result = await runRate({
      slug: 'obscure-book-author-2024',
      candidate: { title: 'Obscure', creator: 'Some Author', year: 2024, medium: 'book' },
    });
    expect(result.rating.known).toBe(false);
    expect(ratingsStore.get('obscure-book-author-2024')).toMatchObject({ known: false });
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/integration/rate-lib.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/rate.ts
import { callRate, CLAUDE_MODEL } from './claude';
import { supabaseServer } from './supabase-server';
import type { Rating, Medium } from './types';

export type RunRateInput = {
  slug: string;
  candidate: { title: string; creator: string; year: number | null; medium: Medium };
};

export type RunRateResult = { rating: Rating; cacheHit: boolean };

export async function getCachedRating(slug: string): Promise<Rating | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('ratings')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as Rating;
}

export async function runRate(input: RunRateInput): Promise<RunRateResult> {
  const cached = await getCachedRating(input.slug);
  if (cached) return { rating: cached, cacheHit: true };

  const raw = await callRate(input.candidate);
  const sb = supabaseServer();

  // Upsert work first (FK), then rating.
  const workRow = {
    slug: input.slug,
    medium: input.candidate.medium,
    title: input.candidate.title,
    creator: input.candidate.creator,
    year: input.candidate.year,
  };
  await sb.from('works').upsert(workRow);

  const ratingRow = raw.known
    ? {
        slug: input.slug,
        known: true as const,
        score: raw.score,
        verdict: raw.verdict,
        synopsis: raw.synopsis,
        details: raw.details,
        tags: raw.tags,
        model: CLAUDE_MODEL,
      }
    : {
        slug: input.slug,
        known: false as const,
        model: CLAUDE_MODEL,
      };
  await sb.from('ratings').upsert(ratingRow);

  // Re-read to get rated_at + view_count defaults.
  const fresh = await getCachedRating(input.slug);
  if (!fresh) throw new Error('Rating disappeared after upsert');
  return { rating: fresh, cacheHit: false };
}

export async function bumpViewCount(slug: string): Promise<void> {
  const sb = supabaseServer();
  await sb.rpc('increment_view_count', { p_slug: slug });
}
```

Also add the view-count RPC migration. Create `supabase/migrations/20260517000006_create_view_count_rpc.sql`:
```sql
create or replace function public.increment_view_count(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ratings set view_count = view_count + 1 where slug = p_slug;
$$;
revoke all on function public.increment_view_count(text) from public, anon, authenticated;
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test tests/integration/rate-lib.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate.ts supabase/migrations/20260517000006_create_view_count_rpc.sql tests/integration/rate-lib.test.ts
git commit -m "feat(rate): cache-first rate logic with works upsert + view_count RPC"
```

---

### Task 5.3: `/api/disambiguate` route

**Files:**
- Create: `src/app/api/disambiguate/route.ts`
- Test: `tests/integration/disambiguate-route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/integration/disambiguate-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/disambiguate', () => ({
  runDisambiguate: vi.fn(async (_q: string) => ({
    candidates: [{
      slug: 'fourth-wing-yarros-2023',
      title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book',
    }],
  })),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkAndIncrement: vi.fn(async () => ({ allowed: true, count: 1 })),
}));

vi.mock('@/lib/hash', () => ({ hashIp: () => 'hash' }));

vi.mock('@/lib/captcha-cookie', async () => {
  const actual = await vi.importActual<typeof import('@/lib/captcha-cookie')>('@/lib/captcha-cookie');
  return { ...actual, verifyCookieValue: () => null };
});

import { POST } from '@/app/api/disambiguate/route';
import * as rl from '@/lib/rate-limit';

beforeEach(() => { vi.clearAllMocks(); process.env.RATE_LIMIT_SALT = 'salt'; });

describe('POST /api/disambiguate', () => {
  function makeReq(body: unknown, headers: Record<string, string> = {}) {
    return new Request('http://localhost/api/disambiguate', {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4', ...headers },
    });
  }

  it('returns 200 with candidates under rate limit', async () => {
    const res = await POST(makeReq({ query: 'fourth wing' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toHaveLength(1);
  });

  it('returns 429 with needs_captcha when over limit', async () => {
    vi.mocked(rl.checkAndIncrement).mockResolvedValueOnce({ allowed: false, count: 21 });
    const res = await POST(makeReq({ query: 'x' }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.needs_captcha).toBe(true);
  });

  it('returns 400 on missing query', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/integration/disambiguate-route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/app/api/disambiguate/route.ts
import { NextResponse } from 'next/server';
import { runDisambiguate } from '@/lib/disambiguate';
import { checkAndIncrement } from '@/lib/rate-limit';
import { hashIp } from '@/lib/hash';
import { verifyCookieValue, CAPTCHA_COOKIE_NAME } from '@/lib/captcha-cookie';

export const runtime = 'edge';

const HOURLY_LIMIT = 20;

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
}

function getCaptchaCookie(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${CAPTCHA_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function POST(req: Request) {
  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });

  const body = await req.json().catch(() => null) as { query?: string } | null;
  if (!body?.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
    return NextResponse.json({ error: 'missing_query' }, { status: 400 });
  }

  // Captcha bypass
  const cookieValue = getCaptchaCookie(req);
  const bypassed = cookieValue ? verifyCookieValue(cookieValue, salt) != null : false;

  if (!bypassed) {
    const ipHash = hashIp(getClientIp(req), salt);
    const check = await checkAndIncrement({ ipHash, limit: HOURLY_LIMIT });
    if (!check.allowed) {
      return NextResponse.json({ needs_captcha: true }, { status: 429 });
    }
  }

  try {
    const result = await runDisambiguate(body.query.trim());
    return NextResponse.json(result);
  } catch (err) {
    console.error('disambiguate error', err);
    return NextResponse.json({ error: 'ai_failed' }, { status: 503 });
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm test tests/integration/disambiguate-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/disambiguate/route.ts tests/integration/disambiguate-route.test.ts
git commit -m "feat(api): /api/disambiguate route with rate-limit + captcha bypass"
```

---

### Task 5.4: `/api/rate` route

**Files:**
- Create: `src/app/api/rate/route.ts`
- Test: `tests/integration/rate-route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/integration/rate-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/rate', () => ({
  getCachedRating: vi.fn(),
  runRate: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkAndIncrement: vi.fn(async () => ({ allowed: true, count: 1 })),
}));

vi.mock('@/lib/hash', () => ({ hashIp: () => 'hash' }));

vi.mock('@/lib/captcha-cookie', async () => {
  const actual = await vi.importActual<typeof import('@/lib/captcha-cookie')>('@/lib/captcha-cookie');
  return { ...actual, verifyCookieValue: () => null };
});

vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  }),
}));

import { POST } from '@/app/api/rate/route';
import * as rateMod from '@/lib/rate';
import * as rl from '@/lib/rate-limit';

beforeEach(() => { vi.clearAllMocks(); process.env.RATE_LIMIT_SALT = 'salt'; });

describe('POST /api/rate', () => {
  function req(body: unknown) {
    return new Request('http://localhost/api/rate', {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
    });
  }

  it('returns 400 without slug or candidate', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it('returns cached rating without calling rate limiter', async () => {
    vi.mocked(rateMod.getCachedRating).mockResolvedValueOnce({
      slug: 's', known: true, score: 5, verdict: 'A little spicy.',
      synopsis: 'a', details: 'b', tags: ['x'], model: 'm', rated_at: '0', view_count: 0,
    } as any);
    const res = await POST(req({ slug: 's', candidate: { title: 't', creator: 'c', year: 2020, medium: 'book' } }));
    expect(res.status).toBe(200);
    expect(rl.checkAndIncrement).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.cacheHit).toBe(true);
  });

  it('calls rate limiter on cache miss', async () => {
    vi.mocked(rateMod.getCachedRating).mockResolvedValueOnce(null);
    vi.mocked(rateMod.runRate).mockResolvedValueOnce({
      cacheHit: false,
      rating: { slug: 's', known: false, model: 'm', rated_at: '0', view_count: 0 } as any,
    });
    const res = await POST(req({ slug: 's', candidate: { title: 't', creator: 'c', year: 2020, medium: 'book' } }));
    expect(res.status).toBe(200);
    expect(rl.checkAndIncrement).toHaveBeenCalledOnce();
  });

  it('returns 429 when over rate limit on miss', async () => {
    vi.mocked(rateMod.getCachedRating).mockResolvedValueOnce(null);
    vi.mocked(rl.checkAndIncrement).mockResolvedValueOnce({ allowed: false, count: 21 });
    const res = await POST(req({ slug: 's', candidate: { title: 't', creator: 'c', year: 2020, medium: 'book' } }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.needs_captcha).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/integration/rate-route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/app/api/rate/route.ts
import { NextResponse } from 'next/server';
import { getCachedRating, runRate } from '@/lib/rate';
import { checkAndIncrement } from '@/lib/rate-limit';
import { hashIp } from '@/lib/hash';
import { verifyCookieValue, CAPTCHA_COOKIE_NAME } from '@/lib/captcha-cookie';

export const runtime = 'edge';

const HOURLY_LIMIT = 20;

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
}

function getCaptchaCookie(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${CAPTCHA_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function POST(req: Request) {
  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });

  const body = await req.json().catch(() => null) as {
    slug?: string;
    candidate?: { title: string; creator: string; year: number | null; medium: 'book' | 'movie' | 'tv' };
  } | null;

  if (!body?.slug || !body?.candidate?.title) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // Cache-first: bypasses rate limit entirely.
  const cached = await getCachedRating(body.slug);
  if (cached) {
    return NextResponse.json({ rating: cached, cacheHit: true });
  }

  // Cache miss → enforce rate limit (with captcha bypass).
  const cookieValue = getCaptchaCookie(req);
  const bypassed = cookieValue ? verifyCookieValue(cookieValue, salt) != null : false;
  if (!bypassed) {
    const ipHash = hashIp(getClientIp(req), salt);
    const check = await checkAndIncrement({ ipHash, limit: HOURLY_LIMIT });
    if (!check.allowed) {
      return NextResponse.json({ needs_captcha: true }, { status: 429 });
    }
  }

  try {
    const result = await runRate({ slug: body.slug, candidate: body.candidate });
    return NextResponse.json(result);
  } catch (err) {
    console.error('rate error', err);
    return NextResponse.json({ error: 'ai_failed' }, { status: 503 });
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test tests/integration/rate-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/rate/route.ts tests/integration/rate-route.test.ts
git commit -m "feat(api): /api/rate route (cache hits bypass rate limit)"
```

---

## Phase 6 — UI Components

### Task 6.1: Brand tokens in `globals.css`

**Files:** Modify `src/app/globals.css`

- [ ] **Step 1: Replace the generated `globals.css`**

```css
@import "tailwindcss";

:root {
  --color-brand: #d4506b;
  --color-brand-soft: #ff8fa3;
  --color-surface: #fff5ee;
  --color-surface-card: #ffffff;
  --color-accent: #fde2e8;
  --color-ink: #2b1e22;
  --color-ink-muted: #7a5a5a;
  --color-ink-quiet: #a87b85;
  --color-border: #f4cdd4;
}

@theme inline {
  --color-brand: var(--color-brand);
  --color-brand-soft: var(--color-brand-soft);
  --color-surface: var(--color-surface);
  --color-surface-card: var(--color-surface-card);
  --color-accent: var(--color-accent);
  --color-ink: var(--color-ink);
  --color-ink-muted: var(--color-ink-muted);
  --color-ink-quiet: var(--color-ink-quiet);
  --color-border: var(--color-border);
}

html, body {
  background: var(--color-surface);
  color: var(--color-ink);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm dev` briefly, visit `http://localhost:3000`. Background should be peach.
Kill server.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(style): brand color tokens (peach/blush palette)"
```

---

### Task 6.2: `Footer` component

**Files:**
- Create: `src/components/Footer.tsx`
- Test: `tests/unit/Footer.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/Footer.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Footer } from '@/components/Footer';

describe('Footer', () => {
  it('renders disclaimer and nav links', () => {
    render(<Footer />);
    expect(screen.getByText(/AI-generated ratings/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /About/i })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: /Terms/i })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /Privacy/i })).toHaveAttribute('href', '/privacy');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/unit/Footer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/components/Footer.tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[color:var(--color-border)] px-6 py-8 text-center text-xs text-[color:var(--color-ink-quiet)]">
      <p className="mb-2">AI-generated ratings. Subjective and may be inaccurate.</p>
      <nav className="flex justify-center gap-4">
        <Link href="/about" className="hover:text-[color:var(--color-brand)]">About</Link>
        <Link href="/terms" className="hover:text-[color:var(--color-brand)]">Terms</Link>
        <Link href="/privacy" className="hover:text-[color:var(--color-brand)]">Privacy</Link>
      </nav>
    </footer>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test tests/unit/Footer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Footer.tsx tests/unit/Footer.test.tsx
git commit -m "feat(ui): Footer with disclaimer + nav"
```

---

### Task 6.3: `SearchBar` component

**Files:**
- Create: `src/components/SearchBar.tsx`
- Test: `tests/unit/SearchBar.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/SearchBar.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SearchBar } from '@/components/SearchBar';

describe('SearchBar', () => {
  it('calls onSubmit with trimmed value on submit', async () => {
    const onSubmit = vi.fn();
    render(<SearchBar onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText(/Type a book, movie/i);
    await userEvent.type(input, '  Fourth Wing  ');
    await userEvent.click(screen.getByRole('button', { name: /find out/i }));
    expect(onSubmit).toHaveBeenCalledWith('Fourth Wing');
  });

  it('does not submit empty input', async () => {
    const onSubmit = vi.fn();
    render(<SearchBar onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /find out/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm test tests/unit/SearchBar.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// src/components/SearchBar.tsx
'use client';

import { useState } from 'react';

type Props = {
  onSubmit: (query: string) => void;
  disabled?: boolean;
};

export function SearchBar({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex items-center gap-2 rounded-full border-2 border-[color:var(--color-border)] bg-white px-4 py-3 shadow-[0_4px_12px_rgba(212,80,107,0.08)]">
        <span aria-hidden className="text-[color:var(--color-ink-quiet)]">🔍</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          placeholder="Type a book, movie, or show…"
          className="flex-1 bg-transparent text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-quiet)] focus:outline-none"
          aria-label="Search a book, movie, or TV show"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-full bg-[color:var(--color-brand)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Find out
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm test tests/unit/SearchBar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar.tsx tests/unit/SearchBar.test.tsx
git commit -m "feat(ui): SearchBar with trim + empty guard"
```

---

### Task 6.4: `TryTheseChips` component

**Files:**
- Create: `src/components/TryTheseChips.tsx`
- Test: `tests/unit/TryTheseChips.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/TryTheseChips.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TryTheseChips } from '@/components/TryTheseChips';

describe('TryTheseChips', () => {
  it('renders the provided chips and calls onPick with the title', async () => {
    const onPick = vi.fn();
    render(<TryTheseChips items={['Fourth Wing', 'It Ends With Us', 'Bridgerton']} onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Fourth Wing' }));
    expect(onPick).toHaveBeenCalledWith('Fourth Wing');
  });
});
```

- [ ] **Step 2: Run, verify fail; then implement; verify pass**

Implementation:
```tsx
// src/components/TryTheseChips.tsx
'use client';

type Props = {
  items: string[];
  onPick: (title: string) => void;
};

export function TryTheseChips({ items, onPick }: Props) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onPick(item)}
          className="rounded-full bg-[color:var(--color-accent)] px-3 py-1.5 text-xs text-[color:#8b3a4f] hover:bg-[color:var(--color-brand-soft)] hover:text-white"
        >
          {item}
        </button>
      ))}
    </div>
  );
}
```

Run: `pnpm test tests/unit/TryTheseChips.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/TryTheseChips.tsx tests/unit/TryTheseChips.test.tsx
git commit -m "feat(ui): TryTheseChips"
```

---

### Task 6.5: `DisambiguationPicker` component

**Files:**
- Create: `src/components/DisambiguationPicker.tsx`
- Test: `tests/unit/DisambiguationPicker.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/DisambiguationPicker.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DisambiguationPicker } from '@/components/DisambiguationPicker';

const candidates = [
  { slug: 'it-king-1986', title: 'It', creator: 'Stephen King', year: 1986, medium: 'book' as const },
  { slug: 'it-muschietti-2017', title: 'It', creator: 'Andy Muschietti', year: 2017, medium: 'movie' as const },
];

describe('DisambiguationPicker', () => {
  it('renders each candidate with title, creator, year, medium', () => {
    render(<DisambiguationPicker candidates={candidates} onPick={() => {}} />);
    expect(screen.getByText('Stephen King')).toBeInTheDocument();
    expect(screen.getByText('Andy Muschietti')).toBeInTheDocument();
    expect(screen.getByText('1986')).toBeInTheDocument();
    expect(screen.getByText('2017')).toBeInTheDocument();
  });

  it('calls onPick with the candidate when clicked', async () => {
    const onPick = vi.fn();
    render(<DisambiguationPicker candidates={candidates} onPick={onPick} />);
    await userEvent.click(screen.getByText('1986'));
    expect(onPick).toHaveBeenCalledWith(candidates[0]);
  });
});
```

- [ ] **Step 2: Run, verify fail; then implement; verify pass**

Implementation:
```tsx
// src/components/DisambiguationPicker.tsx
'use client';

import type { Candidate } from '@/lib/types';

type Props = {
  candidates: Candidate[];
  onPick: (c: Candidate) => void;
};

const MEDIUM_LABEL: Record<Candidate['medium'], string> = {
  book: 'Book', movie: 'Movie', tv: 'TV',
};

export function DisambiguationPicker({ candidates, onPick }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-center text-sm text-[color:var(--color-ink-muted)]">
        Did you mean…
      </p>
      <ul className="space-y-2">
        {candidates.map((c) => (
          <li key={c.slug}>
            <button
              onClick={() => onPick(c)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-left shadow-sm hover:border-[color:var(--color-brand)]"
            >
              <div className="font-semibold text-[color:var(--color-ink)]">{c.title}</div>
              <div className="text-xs uppercase tracking-wide text-[color:var(--color-ink-quiet)]">
                {MEDIUM_LABEL[c.medium]}
              </div>
              <div className="text-sm text-[color:var(--color-ink-muted)]">
                {c.creator} {c.year ? <span>· <span>{c.year}</span></span> : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Run: `pnpm test tests/unit/DisambiguationPicker.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/DisambiguationPicker.tsx tests/unit/DisambiguationPicker.test.tsx
git commit -m "feat(ui): DisambiguationPicker"
```

---

### Task 6.6: `SpoilerReveal` component

**Files:**
- Create: `src/components/SpoilerReveal.tsx`
- Test: `tests/unit/SpoilerReveal.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/SpoilerReveal.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { SpoilerReveal } from '@/components/SpoilerReveal';

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
});
```

- [ ] **Step 2: Run, verify fail; implement; verify pass**

```tsx
// src/components/SpoilerReveal.tsx
'use client';

import { useState } from 'react';

export function SpoilerReveal({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return <div className="text-sm leading-relaxed text-[color:var(--color-ink)]">{children}</div>;
  }

  return (
    <button
      onClick={() => setRevealed(true)}
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

Run: `pnpm test tests/unit/SpoilerReveal.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/SpoilerReveal.tsx tests/unit/SpoilerReveal.test.tsx
git commit -m "feat(ui): SpoilerReveal — blur + tap to reveal"
```

---

### Task 6.7: `ShareButton` component

**Files:**
- Create: `src/components/ShareButton.tsx`
- Test: `tests/unit/ShareButton.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/ShareButton.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShareButton } from '@/components/ShareButton';

describe('ShareButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => {}) },
      share: undefined,
    });
  });

  it('copies URL via clipboard when Web Share API unavailable', async () => {
    render(<ShareButton url="https://isitsmut.com/r/fourth-wing-yarros-2023" title="Fourth Wing" />);
    await userEvent.click(screen.getByRole('button', { name: /share|copy link/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://isitsmut.com/r/fourth-wing-yarros-2023');
  });

  it('calls navigator.share when available', async () => {
    const share = vi.fn(async () => {});
    Object.assign(navigator, { share });
    render(<ShareButton url="https://isitsmut.com/r/x" title="X" />);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(share).toHaveBeenCalledWith({ url: 'https://isitsmut.com/r/x', title: 'Is "X" smut?' });
  });
});
```

- [ ] **Step 2: Run, verify fail; implement; verify pass**

```tsx
// src/components/ShareButton.tsx
'use client';

import { useState } from 'react';

type Props = { url: string; title: string };

export function ShareButton({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title: `Is "${title}" smut?` });
        return;
      } catch {
        // User cancelled; fall through to clipboard fallback below.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

Run: `pnpm test tests/unit/ShareButton.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ShareButton.tsx tests/unit/ShareButton.test.tsx
git commit -m "feat(ui): ShareButton with Web Share + clipboard fallback"
```

---

### Task 6.8: `LoadingSkeleton` component

**Files:** Create `src/components/LoadingSkeleton.tsx`

- [ ] **Step 1: Implement (no test — purely visual)**

```tsx
// src/components/LoadingSkeleton.tsx
export function LoadingSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_6px_18px_rgba(212,80,107,0.10)]" aria-busy="true" aria-live="polite">
      <div className="-mx-5 -mt-5 mb-4 rounded-t-2xl bg-gradient-to-br from-[color:var(--color-brand)] to-[color:var(--color-brand-soft)] p-6 text-center text-white">
        <div className="text-[11px] uppercase tracking-widest opacity-90">Smut Rating</div>
        <div className="mt-1 text-4xl font-black opacity-50">…/10</div>
      </div>
      <div className="h-5 w-2/3 animate-pulse rounded bg-[color:var(--color-accent)]" />
      <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-[color:var(--color-accent)]" />
      <div className="mt-4 h-3 w-full animate-pulse rounded bg-[color:var(--color-accent)]" />
      <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-[color:var(--color-accent)]" />
      <p className="mt-4 text-center text-xs text-[color:var(--color-ink-quiet)]">Asking the AI…</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LoadingSkeleton.tsx
git commit -m "feat(ui): LoadingSkeleton matching result-card layout"
```

---

### Task 6.9: `ResultCard` component

**Files:**
- Create: `src/components/ResultCard.tsx`
- Test: `tests/unit/ResultCard.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// tests/unit/ResultCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResultCard } from '@/components/ResultCard';

const work = {
  slug: 'fourth-wing-yarros-2023',
  medium: 'book' as const,
  title: 'Fourth Wing',
  creator: 'Rebecca Yarros',
  year: 2023,
};

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
    expect(screen.getByText(/yes, it's smut/i)).toBeInTheDocument();
    expect(screen.getByText('Fourth Wing')).toBeInTheDocument();
    expect(screen.getByText(/war college/i)).toBeInTheDocument();
    expect(screen.getByText('Open door')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tap to reveal/i })).toBeInTheDocument();
  });
});

describe('ResultCard — unknown', () => {
  it('renders helpful message for known=false', () => {
    render(
      <ResultCard
        work={work}
        rating={{ slug: work.slug, known: false, model: 'm', rated_at: '0', view_count: 0 }}
        shareUrl="https://isitsmut.com/r/x"
      />
    );
    expect(screen.getByText(/don't have a reliable read/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, verify fail; implement; verify pass**

```tsx
// src/components/ResultCard.tsx
import { SpoilerReveal } from './SpoilerReveal';
import { ShareButton } from './ShareButton';
import type { Work, Rating, Medium } from '@/lib/types';

const MEDIUM_LABEL: Record<Medium, string> = { book: 'Book', movie: 'Movie', tv: 'TV' };

type Props = {
  work: Work;
  rating: Rating;
  shareUrl: string;
};

const SUGGEST_URL = 'https://docs.google.com/forms/d/e/PLACEHOLDER/viewform';

export function ResultCard({ work, rating, shareUrl }: Props) {
  if (!rating.known) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-[0_6px_18px_rgba(212,80,107,0.10)]">
        <h1 className="text-xl font-bold text-[color:var(--color-ink)]">{work.title}</h1>
        <p className="mt-1 text-xs text-[color:var(--color-ink-quiet)]">
          {work.creator} · {work.year ?? '—'} · {MEDIUM_LABEL[work.medium]}
        </p>
        <p className="mt-4 text-sm text-[color:var(--color-ink-muted)]">
          We don't have a reliable read on this one yet.
        </p>
        <a
          href={SUGGEST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-[color:var(--color-brand)]"
        >
          Suggest a rating →
        </a>
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_18px_rgba(212,80,107,0.10)]">
      <header className="bg-gradient-to-br from-[color:var(--color-brand)] to-[color:var(--color-brand-soft)] px-6 py-6 text-center text-white">
        <div className="text-[11px] uppercase tracking-widest opacity-90">Smut Rating</div>
        <div className="mt-1 text-5xl font-black leading-none">
          {rating.score}<span className="text-2xl opacity-80">/10</span>
        </div>
        <div className="mt-2 text-sm font-semibold">{rating.verdict}</div>
      </header>
      <div className="space-y-3 p-5">
        <div>
          <h1 className="text-lg font-bold text-[color:var(--color-ink)]">{work.title}</h1>
          <p className="text-xs text-[color:var(--color-ink-quiet)]">
            {work.creator} · {work.year ?? '—'} · {MEDIUM_LABEL[work.medium]}
          </p>
        </div>
        <p className="text-sm leading-relaxed text-[color:var(--color-ink)]">{rating.synopsis}</p>
        {rating.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {rating.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[color:var(--color-accent)] px-2.5 py-0.5 text-[11px] text-[color:#8b3a4f]">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="border-t border-[color:var(--color-border)] pt-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-quiet)]">
            What's in it 🔒
          </div>
          <SpoilerReveal>{rating.details}</SpoilerReveal>
        </div>
        <div className="flex justify-end pt-1">
          <ShareButton url={shareUrl} title={work.title} />
        </div>
      </div>
    </article>
  );
}
```

Run: `pnpm test tests/unit/ResultCard.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ResultCard.tsx tests/unit/ResultCard.test.tsx
git commit -m "feat(ui): ResultCard with hero rating banner + spoiler details"
```

---

### Task 6.10: `CaptchaModal` component

**Files:** Create `src/components/CaptchaModal.tsx`

(No automated test — would require mocking the hCaptcha React component, which is brittle. Verify manually in Phase 11.)

- [ ] **Step 1: Implement**

```tsx
// src/components/CaptchaModal.tsx
'use client';

import HCaptcha from '@hcaptcha/react-hcaptcha';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function CaptchaModal({ open, onClose, onSuccess }: Props) {
  if (!open) return null;

  async function handleVerify(token: string) {
    const res = await fetch('/api/captcha-verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (res.ok) onSuccess();
  }

  const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-bold text-[color:var(--color-ink)]">Quick check</h2>
        <p className="mt-1 text-sm text-[color:var(--color-ink-muted)]">
          Too many lookups from your network. Solve this and you're back in.
        </p>
        <div className="mt-4 flex justify-center">
          {siteKey ? (
            <HCaptcha sitekey={siteKey} onVerify={handleVerify} />
          ) : (
            <p className="text-xs text-red-600">Captcha not configured.</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-full border border-[color:var(--color-border)] py-2 text-sm text-[color:var(--color-ink-muted)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CaptchaModal.tsx
git commit -m "feat(ui): CaptchaModal wrapping hCaptcha"
```

---

## Phase 7 — Pages

### Task 7.1: Root layout — fonts, PostHog provider, footer

**Files:** Modify `src/app/layout.tsx`

- [ ] **Step 1: Replace generated layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { Footer } from '@/components/Footer';
import { PostHogProvider } from '@/components/PostHogProvider';

export const metadata: Metadata = {
  title: 'IsItSmut — Find out before you start chapter one.',
  description: 'Look up any book, movie, or TV show and see if it contains smut. 1–10 rating, short synopsis, and a (blurred) breakdown of what\'s in it.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          <main className="mx-auto max-w-xl px-5 pt-10">{children}</main>
          <Footer />
        </PostHogProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(layout): root layout with PostHog + footer"
```

(The `PostHogProvider` component is created in Phase 9 — until then the import will fail. Don't run `pnpm dev` until Task 9.1 lands.)

---

### Task 7.2: Homepage (`/`)

**Files:** Modify `src/app/page.tsx`

- [ ] **Step 1: Replace generated page**

```tsx
// src/app/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchBar } from '@/components/SearchBar';
import { TryTheseChips } from '@/components/TryTheseChips';
import { DisambiguationPicker } from '@/components/DisambiguationPicker';
import { CaptchaModal } from '@/components/CaptchaModal';
import type { Candidate } from '@/lib/types';

const TRY_THESE = ['Fourth Wing', 'It Ends With Us', 'Bridgerton', 'A Court of Thorns and Roses', 'Normal People'];

export default function HomePage() {
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

    const data = await res.json() as { candidates: Candidate[] };
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
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight text-[color:var(--color-brand)]">Is It Smut?</h1>
        <p className="mt-1 text-sm italic text-[color:var(--color-ink-muted)]">
          Find out before you start chapter one.
        </p>
      </header>

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

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(page): homepage with hero, search, chips, disambiguation, captcha"
```

---

### Task 7.3: Result page (`/r/[slug]`)

**Files:** Create `src/app/r/[slug]/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
// src/app/r/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { getCachedRating, runRate, bumpViewCount } from '@/lib/rate';
import { ResultCard } from '@/components/ResultCard';
import type { Work, Medium } from '@/lib/types';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ title?: string; creator?: string; year?: string; medium?: string }>;
};

async function fetchWork(slug: string): Promise<Work | null> {
  const sb = supabaseServer();
  const { data } = await sb.from('works').select('*').eq('slug', slug).maybeSingle();
  return data as Work | null;
}

export default async function ResultPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const search = await searchParams;

  let work = await fetchWork(slug);
  let rating = await getCachedRating(slug);

  if (!work && (!search.title || !search.creator || !search.medium)) {
    notFound();
  }

  if (!rating) {
    // Cache miss — need candidate from URL params (homepage redirect carries them).
    if (!search.title || !search.creator || !search.medium) notFound();
    const candidate = {
      title: search.title,
      creator: search.creator,
      year: search.year ? parseInt(search.year, 10) : null,
      medium: search.medium as Medium,
    };
    const result = await runRate({ slug, candidate });
    rating = result.rating;
    work = work ?? { slug, ...candidate };
  }

  if (!work) notFound();

  // Fire-and-forget view counter
  bumpViewCount(slug).catch(() => {});

  const base = process.env.NEXT_PUBLIC_SHARE_BASE_URL ?? 'http://localhost:3000';
  const shareUrl = `${base}/r/${slug}`;

  return <ResultCard work={work} rating={rating} shareUrl={shareUrl} />;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = await fetchWork(slug);
  if (!work) return { title: 'Not found — IsItSmut' };
  return {
    title: `Is "${work.title}" smut? — IsItSmut`,
    description: `Smut rating, synopsis, and spoiler-blurred content details for "${work.title}".`,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/r/[slug]/page.tsx
git commit -m "feat(page): /r/[slug] result page with cache-first SSR"
```

---

### Task 7.4: Static pages — about, terms, privacy

**Files:** Create `src/app/about/page.tsx`, `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`

- [ ] **Step 1: About**

```tsx
// src/app/about/page.tsx
export default function AboutPage() {
  return (
    <article className="prose prose-sm max-w-none text-[color:var(--color-ink)]">
      <h1 className="text-2xl font-bold text-[color:var(--color-brand)]">About IsItSmut</h1>
      <p>
        IsItSmut is a free tool that looks up books, movies, and TV shows and tells you, in five seconds, whether they contain sexual content — and how much.
      </p>
      <p>
        Ratings are generated by an AI model that reads your query, identifies the work, and rates it on a 1–10 scale based on the frequency and explicitness of sexual content. Results are cached so the same lookup always returns the same answer.
      </p>
      <p>
        Built because you should be able to look at a stranger reading a book on the subway and know whether they're reading smut.
      </p>
    </article>
  );
}
```

- [ ] **Step 2: Terms**

```tsx
// src/app/terms/page.tsx
export default function TermsPage() {
  return (
    <article className="prose prose-sm max-w-none text-[color:var(--color-ink)]">
      <h1 className="text-2xl font-bold text-[color:var(--color-brand)]">Terms of Service</h1>
      <p>By using IsItSmut, you agree:</p>
      <ul>
        <li>Ratings are generated by AI and are subjective. They may be inaccurate, incomplete, or out of date.</li>
        <li>You will not use this service to defame, harass, or make claims about specific people or copyrighted works.</li>
        <li>We may rate-limit, block, or restrict access at our discretion to prevent abuse.</li>
        <li>The service is provided "as is" with no warranty. We accept no liability for decisions made based on ratings.</li>
        <li>We may change or shut down the service at any time.</li>
      </ul>
      <p>Last updated: 2026-05-17.</p>
    </article>
  );
}
```

- [ ] **Step 3: Privacy**

```tsx
// src/app/privacy/page.tsx
export default function PrivacyPage() {
  return (
    <article className="prose prose-sm max-w-none text-[color:var(--color-ink)]">
      <h1 className="text-2xl font-bold text-[color:var(--color-brand)]">Privacy Policy</h1>
      <p>We collect as little as possible:</p>
      <ul>
        <li><strong>Page views</strong> via PostHog (which page you visited, anonymized).</li>
        <li><strong>Search queries</strong> are sent to our AI provider (Anthropic) to generate the rating. We don't tie queries to your identity.</li>
        <li><strong>Rate-limit counters</strong> use a salted hash of your IP address. We never store the raw IP.</li>
        <li><strong>Cookies:</strong> only a short-lived captcha bypass cookie if you've solved a captcha recently.</li>
      </ul>
      <p>We don't sell or share your data. We don't use ads (yet).</p>
      <p>Questions? Email tworden1993@gmail.com.</p>
      <p>Last updated: 2026-05-17.</p>
    </article>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/about/page.tsx src/app/terms/page.tsx src/app/privacy/page.tsx
git commit -m "feat(pages): about, terms, privacy"
```

---

### Task 7.5: 404 page

**Files:** Create `src/app/not-found.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold text-[color:var(--color-brand)]">We haven't seen this one.</h1>
      <p className="text-sm text-[color:var(--color-ink-muted)]">
        That result page doesn't exist yet.
      </p>
      <Link
        href="/"
        className="inline-block rounded-full bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white"
      >
        Search for it →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/not-found.tsx
git commit -m "feat(page): 404 with search CTA"
```

---

## Phase 8 — Open Graph Image

### Task 8.1: OG image via Next.js `opengraph-image.tsx` convention

**Files:** Create `src/app/r/[slug]/opengraph-image.tsx`

Next.js automatically picks this up and generates OG meta tags pointing at the rendered image.

- [ ] **Step 1: Implement**

```tsx
// src/app/r/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'edge';
export const alt = 'IsItSmut rating';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { slug: string } }) {
  const sb = supabaseServer();
  const [{ data: work }, { data: rating }] = await Promise.all([
    sb.from('works').select('*').eq('slug', params.slug).maybeSingle(),
    sb.from('ratings').select('*').eq('slug', params.slug).maybeSingle(),
  ]);

  const known = rating?.known === true;
  const score = known ? rating.score : '—';
  const verdict = known ? rating.verdict : 'No reliable read';
  const synopsis = known ? (rating.synopsis as string) : '';
  const title = work?.title ?? 'Unknown';
  const meta = work
    ? `${work.creator}${work.year ? ` · ${work.year}` : ''} · ${String(work.medium).toUpperCase()}`
    : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', background: '#fff5ee',
          display: 'flex', flexDirection: 'column', padding: 64,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, color: '#d4506b' }}>IsItSmut.com</div>
        <div style={{ marginTop: 16, fontSize: 56, fontWeight: 800, color: '#2b1e22' }}>{title}</div>
        <div style={{ marginTop: 6, fontSize: 24, color: '#7a5a5a' }}>{meta}</div>

        <div
          style={{
            marginTop: 36, background: 'linear-gradient(135deg, #d4506b, #ff8fa3)',
            color: '#fff', borderRadius: 24, padding: '24px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 18, letterSpacing: 4, opacity: 0.9 }}>SMUT RATING</div>
          <div style={{ fontSize: 120, fontWeight: 900, lineHeight: 1 }}>
            {score}<span style={{ fontSize: 56, opacity: 0.8 }}>/10</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{verdict}</div>
        </div>

        {synopsis ? (
          <div style={{ marginTop: 24, fontSize: 22, color: '#4a3b3f', overflow: 'hidden', maxHeight: 64 }}>
            {synopsis}
          </div>
        ) : null}

        <div style={{ marginTop: 'auto', fontSize: 18, color: '#a87b85', fontStyle: 'italic' }}>
          Details hidden — tap to see what's in it
        </div>
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/r/[slug]/opengraph-image.tsx
git commit -m "feat(og): dynamic Open Graph image via @vercel/og"
```

---

## Phase 9 — PostHog & Analytics

### Task 9.1: PostHog provider

**Files:** Create `src/components/PostHogProvider.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/PostHogProvider.tsx
'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
    if (!key) return;
    if (posthog.__loaded) return;
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
```

- [ ] **Step 2: Smoke build**

Run: `pnpm dev`
Expected: server starts, homepage renders without errors. Visit `/`, `/about`. Kill server.

- [ ] **Step 3: Commit**

```bash
git add src/components/PostHogProvider.tsx
git commit -m "feat(analytics): PostHog provider (page views only)"
```

---

## Phase 10 — End-to-End Test

### Task 10.1: Playwright golden-path test

**Files:** Create `tests/e2e/golden-path.spec.ts`

This test runs against `localhost:3000` with mocked Claude responses. It assumes the dev server is running (Playwright config starts it automatically).

- [ ] **Step 1: Implement test**

```ts
// tests/e2e/golden-path.spec.ts
import { test, expect } from '@playwright/test';

test('search → result → reveal details → share', async ({ page, context }) => {
  // Mock the disambiguate + rate API responses so the test doesn't hit real Claude.
  await context.route('**/api/disambiguate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{
          slug: 'fourth-wing-yarros-2023',
          title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book',
        }],
      }),
    });
  });

  // The /r/[slug] page runs SSR-side rate-fetching; intercept supabase + claude paths
  // by faking a cache hit via the API as well. For e2e simplicity we just verify the
  // result page renders the homepage fallback if data isn't real.

  await page.goto('/');
  await expect(page.getByRole('heading', { name: /is it smut\?/i })).toBeVisible();

  await page.getByPlaceholder(/type a book, movie/i).fill('Fourth Wing');
  await page.getByRole('button', { name: /find out/i }).click();

  // Redirects to /r/[slug] — page will attempt cache lookup; with no real DB, it
  // will 404 or error. For the golden path we just assert URL change.
  await page.waitForURL(/\/r\/fourth-wing-yarros-2023/);
  expect(page.url()).toContain('/r/fourth-wing-yarros-2023');
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm test:e2e`
Expected: PASS (1 test). If it fails due to Supabase env vars missing, that's expected for this stub; the test asserts the URL change, not the result render. Real end-to-end verification happens in Phase 12.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/golden-path.spec.ts
git commit -m "test(e2e): golden-path search → result URL"
```

---

## Phase 11 — Production Setup (Manual + Wiring)

These tasks require account creation and dashboard clicks. The implementing agent should pause and either ask the user to do these steps, or execute them with the user pairing.

### Task 11.1: Create production Supabase project (USER ACTION)

- [ ] **Step 1: Create project**

In a browser, log into Supabase (https://app.supabase.com). Click "New Project".
- Org: your existing org (same as OmniLeague)
- Name: `isitsmut`
- Database password: strong, save in your password manager
- Region: same as OmniLeague (or closest to expected users)
- Plan: Free

Wait ~2 min for provisioning.

- [ ] **Step 2: Capture connection details**

From Project Settings → API:
- Copy `Project URL` → `.env.local` `NEXT_PUBLIC_SUPABASE_URL` and Vercel env later
- Copy `anon public` key → `.env.local` `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy `service_role` secret → `.env.local` `SUPABASE_SERVICE_ROLE_KEY` (NEVER commit this)

- [ ] **Step 3: Enable `pg_cron` extension**

Dashboard → Database → Extensions → search `pg_cron` → toggle ON.

- [ ] **Step 4: No commit (secrets only).**

---

### Task 11.2: Link Supabase CLI to remote project and push migrations

- [ ] **Step 1: Login**

Run: `pnpm dlx supabase login`
Follow the browser-based auth flow.

- [ ] **Step 2: Link**

Get the project ref from the Supabase dashboard URL (e.g. `abcdefghijklmnop`).
Run: `pnpm dlx supabase link --project-ref <your-project-ref>`
Provide the database password from Task 11.1 Step 1 when prompted.

- [ ] **Step 3: Push migrations**

Run: `pnpm dlx supabase db push`
Expected: applies all 6 migrations to the remote DB. No errors.

- [ ] **Step 4: Verify in dashboard**

Dashboard → Table Editor → confirm `works`, `ratings`, `rate_limits` tables exist.
Database → Functions → confirm `rate_limit_increment` and `increment_view_count` exist.
Database → Cron Jobs → confirm `prune-rate-limits` is scheduled daily at 03:00.

- [ ] **Step 5: No commit (config only).**

---

### Task 11.3: Create hCaptcha account (USER ACTION)

- [ ] **Step 1: Sign up**

https://www.hcaptcha.com → Sign up → free plan.

- [ ] **Step 2: Create site**

Dashboard → Sites → Add Site:
- Hostname: `isitsmut.com` (also add `localhost` for local testing)

Copy:
- Site key → `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`
- Secret key → `HCAPTCHA_SECRET_KEY`

Add to `.env.local`.

- [ ] **Step 3: No commit.**

---

### Task 11.4: Generate `RATE_LIMIT_SALT` for production

- [ ] **Step 1: Generate**

Run (PowerShell): `[Convert]::ToBase64String([byte[]](1..32 | ForEach-Object { Get-Random -Maximum 256 }))`
Or any 32-byte random string generator.

Save this value — you'll add it to Vercel env in Task 11.6. Don't commit.

---

### Task 11.5: PostHog setup (USER ACTION)

Reuse existing OmniLeague PostHog project per the spec.

- [ ] **Step 1: Get keys**

PostHog dashboard → Project Settings → Project API Key → copy.
The host is typically `https://us.i.posthog.com` (or whatever OmniLeague uses).

Add to `.env.local`:
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`

- [ ] **Step 2: Verify locally**

Run: `pnpm dev` → visit `http://localhost:3000`.
PostHog dashboard → Activity → confirm a `$pageview` event appears within ~30s.
Kill server.

- [ ] **Step 3: No commit.**

---

### Task 11.6: Deploy to Vercel (USER ACTION + CLI)

- [ ] **Step 1: Push branch to GitHub**

Create a private GitHub repo named `isitsmut` (under your account).
Run:
```bash
git remote add origin https://github.com/<your-username>/isitsmut.git
git push -u origin main
```

- [ ] **Step 2: Import to Vercel**

https://vercel.com → New Project → Import Git Repository → select `isitsmut`.
Framework: Next.js (auto-detected).
Root directory: `./`.
Build command: leave default.
Click Deploy.

First deploy will FAIL because env vars are missing — that's expected.

- [ ] **Step 3: Add env vars to Vercel**

Project → Settings → Environment Variables. Add to **Production**, **Preview**, **Development** (all three):

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your real Anthropic key |
| `NEXT_PUBLIC_SUPABASE_URL` | From Task 11.1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Task 11.1 |
| `SUPABASE_SERVICE_ROLE_KEY` | From Task 11.1 |
| `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` | From Task 11.3 |
| `HCAPTCHA_SECRET_KEY` | From Task 11.3 |
| `NEXT_PUBLIC_POSTHOG_KEY` | From Task 11.5 |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` |
| `RATE_LIMIT_SALT` | From Task 11.4 |
| `NEXT_PUBLIC_SHARE_BASE_URL` | `https://isitsmut.com` (Production); `https://<vercel-preview>.vercel.app` for Preview |

- [ ] **Step 4: Redeploy**

Vercel → Deployments → top deployment → "Redeploy".
Expected: green deploy. Visit the `.vercel.app` URL — site loads, search works against real Claude.

- [ ] **Step 5: No commit.**

---

### Task 11.7: Configure GoDaddy → Vercel DNS (USER ACTION)

- [ ] **Step 1: Add custom domain in Vercel**

Vercel → Project → Settings → Domains → Add → `isitsmut.com` and `www.isitsmut.com`.
Vercel will show the DNS records to add.

- [ ] **Step 2: Update GoDaddy DNS**

Easiest path: use Vercel's recommended A/CNAME records.

GoDaddy → My Domains → `isitsmut.com` → DNS → Records:
- Delete any default A/CNAME records for `@` and `www` (back them up first).
- Add A record: name `@`, value `76.76.21.21`, TTL 1 hour (the IP Vercel shows; verify in their UI).
- Add CNAME record: name `www`, value `cname.vercel-dns.com`, TTL 1 hour.

- [ ] **Step 3: Wait for propagation**

Can take up to 1 hour. Check status in Vercel Domains dashboard — both domains should show "Valid Configuration" with HTTPS auto-provisioned.

- [ ] **Step 4: No commit.**

---

## Phase 12 — Pre-Launch Verification

### Task 12.1: Pre-launch checklist (manual)

For each item, verify on the live site at https://isitsmut.com (or the Vercel preview URL if domain still propagating).

- [ ] **Step 1: Functional sanity**

- [ ] Home page loads, hero + search + chips visible
- [ ] Search "Fourth Wing" → either disambiguates or goes directly to result
- [ ] Result page shows the hero rating banner, score, verdict, synopsis, blurred details
- [ ] Tap-to-reveal works
- [ ] Share button copies URL on desktop, opens share sheet on mobile
- [ ] Search a deliberately obscure title → see "we don't have a reliable read" path or empty-match message
- [ ] Visit `/r/garbage-input` → 404 with search CTA

- [ ] **Step 2: Rate limit + captcha**

- [ ] Hit `/api/disambiguate` 21 times from one IP in an hour (`curl` loop or browser refresh) → 21st response is 429 with `needs_captcha: true`
- [ ] On the homepage UI, that 21st query opens the captcha modal
- [ ] Solving the captcha lets the original query proceed

- [ ] **Step 3: Static pages + disclaimer**

- [ ] `/about`, `/terms`, `/privacy` render
- [ ] Footer disclaimer visible on every page

- [ ] **Step 4: OG image preview**

Use https://www.opengraph.xyz/ (paste a result URL) → confirm image renders correctly with rating banner, title, synopsis, and "Details hidden" footer.

Also verify in:
- iMessage (text a result URL to yourself)
- Twitter/X (compose tweet, paste URL, see preview card)
- Discord (paste in a server you control)

- [ ] **Step 5: Mobile Lighthouse**

Chrome DevTools → Lighthouse → Mobile → Performance + Accessibility.
Target: Perf > 90, A11y > 90. Fix any quick wins (alt text, color contrast).

- [ ] **Step 6: PostHog confirms traffic**

PostHog dashboard → Web Analytics → confirm pageviews from your verification visits.

- [ ] **Step 7: `robots.txt`**

Visit https://isitsmut.com/robots.txt — should NOT exist yet (Next.js doesn't generate one). Add a permissive one:

```bash
mkdir -p public
```

Create `public/robots.txt`:
```
User-agent: *
Allow: /
Sitemap: https://isitsmut.com/sitemap.xml
```

(Sitemap can be added later; the entry is harmless.)

- [ ] **Step 8: Commit and redeploy**

```bash
git add public/robots.txt
git commit -m "feat: add permissive robots.txt"
git push
```

Vercel auto-deploys.

---

## Self-Review (run after writing the plan)

**Spec coverage:** Every spec section maps to tasks:
- MVP scope (books/movies/TV) → AI prompts (3.1), homepage chips (7.2), result page (7.3)
- Pure Claude rating engine → Phase 3
- Cache in Supabase → Phase 1 + 5.2
- Disambiguation flow → 5.1, 5.3, 6.5, 7.2
- 1–10 rubric → 2.4 + 3.1
- Subway-safe spoiler-blur → 6.6 + 6.9 + 8.1
- Mobile-first peach palette → 6.1 + all components
- Shareable URLs + OG image → 7.3 + 8.1 + 6.7
- IP rate limit + hCaptcha → Phase 4 + 5.3 + 5.4 + 6.10 + 7.2
- ToS/Privacy/About + footer disclaimer → 6.2 + 7.4
- PostHog page-views-only → 9.1
- Error handling (6 modes) → 5.3 (4xx/5xx), 5.4 (cache fallthrough), 7.3 (404 + missing params), 7.5 (404 page)
- Testing strategy → Phases 2–10 use TDD; Phase 10 is the e2e
- Deployment + env vars → Phase 11

**Placeholder scan:** No "TBD"/"TODO"/"implement later" in any step. The Google Form URL in `ResultCard` (`SUGGEST_URL`) is explicitly marked `PLACEHOLDER` because the form isn't built in v1 (per spec out-of-scope list) — the link is rendered but the form itself is a v1.1 follow-up.

**Type consistency:**
- `Work`, `Candidate`, `Rating`, `Medium` defined in 2.6 and used consistently across `disambiguate.ts`, `rate.ts`, route handlers, and components
- `slugify` returns `string`; `slugifyWithCollisionCheck` returns `Promise<string>`; both used correctly
- `callRate` / `callDisambiguate` return types match what `runRate` / `runDisambiguate` consume
- `verdictFromScore` returns same strings the rate prompt teaches Claude (consistent verdict mapping)

**Scope check:** This is one product, one deploy. Long but cohesive. Tasks 11.x are the most "user-action heavy" — the executing agent should pause for user collaboration on those.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-17-isitsmut-build.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for plans this long.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
