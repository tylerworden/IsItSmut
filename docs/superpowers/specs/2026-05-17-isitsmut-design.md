# IsItSmut.com — Design Spec

**Date:** 2026-05-17
**Status:** Approved, ready for implementation planning
**Domain:** isitsmut.com (registered via GoDaddy)

## Purpose

A fast, mobile-first website where someone can type the name of a book, movie, or TV show and immediately learn whether it contains "smut" — sexual scenes or detailed physical intimacy. The canonical use case: spotting a stranger reading a book on the subway and wanting to know in five seconds whether they're reading smut.

Each result returns:
1. A **1–10 Smut Rating** (blended frequency + explicitness)
2. A **verdict line** ("Yes, it's smut.", "A little spicy.", etc.)
3. A **short synopsis** (1–2 sentences, no spoilers past inciting incident)
4. **What's in it** — tasteful, clinical description of the sexual content, hidden behind a spoiler-blur

## Scope

### In scope (v1)
- Text search for **books, movies, and TV shows**
- AI-generated ratings via Anthropic Claude (Haiku 4.5)
- Cached results in Supabase Postgres (same title → same rating, forever, until manually invalidated)
- Disambiguation flow when a query matches multiple works
- Permanent shareable URLs (`/r/[slug]`) with dynamic Open Graph images
- Spoiler-blur on the "what's in it" section, tap to reveal
- IP-based rate limiting with hCaptcha fallback for abuse protection
- Anonymous use (no accounts)
- Mobile-first responsive design (looks good on desktop too)
- Playful + winky visual brand (peach/blush palette, rounded type)
- ToS, Privacy, About static pages with footer disclaimer on every page
- PostHog page-view analytics

### Out of scope (deferred to v1.1+)
- User accounts / saved history
- Leaderboard UI (schema supports it; no page yet)
- Photo upload / OCR ("scan a book cover")
- Ads / monetization
- Re-rate / dispute button
- Suggest-a-rating backend (link points to a Google Form)
- Trending strip on homepage
- Multi-language support
- Public API
- Email signup / newsletter

## Architecture

### Stack
- **Framework:** Next.js 15 (App Router) on Vercel
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase Postgres (new project, separate from OmniLeague)
- **AI:** Anthropic Claude API (`claude-haiku-4-5`)
- **Anti-abuse:** hCaptcha + IP-keyed rate limiter (Supabase-backed)
- **Analytics:** PostHog (reuse OmniLeague project, new IsItSmut filter)
- **OG images:** `@vercel/og` (edge runtime)
- **Testing:** Vitest + MSW + Playwright

### Pages
| Path | Purpose |
|---|---|
| `/` | Homepage — hero, tagline, search bar, "try these" chips |
| `/r/[slug]` | Permanent result page. Server-rendered card. Bumps `view_count`. |
| `/about`, `/terms`, `/privacy` | Static legal/info pages |

### API routes (Vercel edge functions)
| Path | Method | Body | Returns |
|---|---|---|---|
| `/api/disambiguate` | POST | `{ query: string }` | `{ candidates: Candidate[] }` (0–4 items) |
| `/api/rate` | POST | `{ slug: string }` | `Rating` (cached or fresh from Claude) |
| `/api/og/[slug]` | GET | — | PNG (dynamic OG image) |

### Data flow (golden path)
1. User types title on `/` → submits → `POST /api/disambiguate`
2. If exactly 1 candidate: client redirects to `/r/[slug]`
3. If 2–4 candidates: client renders a picker; on click → redirect to `/r/[slug]`
4. `/r/[slug]` server-component fetches via `/api/rate`:
   - Cache hit → render instantly
   - Cache miss → call Claude with skeleton loading state, store result, render
5. View counter incremented fire-and-forget after render
6. User can tap to reveal blurred details, or tap Share → URL copied (Web Share API on mobile, clipboard fallback on desktop)

## AI Prompt Design

Both calls use Anthropic prompt caching on the system prompt so the rubric is paid for once per cache window. Both use tool-use schemas to force valid JSON.

### Disambiguate call
- **Model:** `claude-haiku-4-5`
- **Temperature:** `0`
- **System prompt (cached):** "You are a media disambiguation service. Given a user's query (which may be partial or misspelled), return 1–4 likely matches as JSON. Each match has `title`, `creator` (author for books, director/showrunner for movies/tv), `year`, `medium` (`book`/`movie`/`tv`). Rank by popularity. If the query is clearly one specific work, return just that one. If you have no confident matches, return an empty array."
- **User message:** the raw query
- **Server post-processing:** canonicalize each candidate into a slug via `slugify(title, creator, year)`

### Rate call
- **Model:** `claude-haiku-4-5`
- **Temperature:** `0`
- **System prompt (cached):** Spells out the full rubric:
  - **Definition of smut:** Sexual content / detailed physical intimacy (sex scenes, explicit foreplay). NOT mere romance, kissing, fade-to-black, or innuendo.
  - **1–10 scale:**
    - `1` = no sexual content
    - `3` = brief / fade-to-black only
    - `5` = a couple of mild on-page scenes
    - `7` = several detailed scenes
    - `9` = frequent and explicit
    - `10` = erotica / erotic romance
  - **Verdict line:**
    - `1–3` → "Not smut."
    - `4–6` → "A little spicy."
    - `7–8` → "Yes, it's smut."
    - `9–10` → "Absolutely smut."
  - **Synopsis:** 1–2 sentences, no spoilers past inciting incident
  - **Details:** tasteful + clinical, ≤ 60 words, subway-safe wording, name scene count + kink references + chapter pointers when known
  - **Tags:** 2–4 short pills like `"Open door"`, `"Fade-to-black"`, `"BDSM"`, `"Enemies to lovers"`
  - **Uncertainty rule:** If you don't recognize the work or aren't confident, return `{ "known": false }` instead of guessing
- **User message:** `{title, creator, year, medium}` (canonical, not the raw query)
- **Response schema (tool-use):** `{ known: bool, score?: int(1-10), verdict?: string, synopsis?: string, details?: string, tags?: string[] }`

### Cost estimate (Haiku 4.5)
- Cached system prompt (~600 tokens): ~$0.00006/call once warm
- Output (~150 tokens): ~$0.00075/rating
- **~$0.001 per uncached rating, $0 per cache hit**
- 10,000 first-time lookups ≈ $10

## Database Schema (Supabase Postgres)

### `works`
Canonical catalog. One row per disambiguated work.
```sql
slug         text primary key,        -- "fourth-wing-yarros-2023"
medium       text not null,           -- 'book' | 'movie' | 'tv'
title        text not null,
creator      text not null,           -- author / director / showrunner
year         int,
created_at   timestamptz default now()
```

### `ratings`
Cached AI output. 1:1 with `works`.
```sql
slug         text primary key references works(slug) on delete cascade,
known        bool not null,            -- false = "we don't have a reliable read"
score        int,                      -- 1-10, null if known=false
verdict      text,
synopsis     text,
details      text,                     -- the blurred "what's in it"
tags         text[],
model        text not null,            -- "claude-haiku-4-5" — enables invalidation
rated_at     timestamptz default now(),
view_count   int default 0             -- bumped on /r/[slug] view
```

### `rate_limits`
IP-keyed counter, no raw IPs stored.
```sql
ip_hash       text not null,           -- sha256(ip + RATE_LIMIT_SALT)
window_start  timestamptz not null,    -- rounded to the hour
count         int default 0,
primary key (ip_hash, window_start)
```
Pruned by daily Supabase cron: `delete from rate_limits where window_start < now() - interval '2 days'`.

### Indices
- `works (lower(title))` — fast title search
- `ratings (rated_at desc)` — for future "recently rated" feed
- `ratings (view_count desc) where known = true` — for future leaderboard

### RLS policies
- `works`, `ratings`: public read; no client writes (writes use service-role key from server only)
- `rate_limits`: server-only, no client access

## URL Structure & Sharing

### Slug canonicalization
`kebab(title) + "-" + kebab(last-word-of-creator) + "-" + year`

Examples:
- `Fourth Wing` by Rebecca Yarros (2023) → `fourth-wing-yarros-2023`
- `It` by Stephen King (1986) → `it-king-1986`

Rules:
- Strip punctuation, transliterate accents to ASCII, lowercase, collapse whitespace to `-`
- If the resulting slug already exists for a *different* `{title, creator, year}` (collision), append `-` + first 4 chars of `sha256(title + creator)`
- Canonicalized once during `disambiguate`, written into `works` on first ratings call

### Open Graph images
- `/api/og/[slug]` renders a PNG via `@vercel/og` (edge runtime)
- Image contents (in order, top to bottom):
  1. `IsItSmut.com` wordmark (small, top-left)
  2. Title + `creator · year · medium` (small)
  3. Full-width gradient rating banner with `SMUT RATING`, big `8/10`, verdict line
  4. One-line synopsis (single line, ellipsis if too long)
  5. Footer: "*Details hidden — tap to see what's in it*"
- **The `details` field is NEVER rendered in the OG image** (keeps unfurls subway-safe in group chats)
- Cached at Vercel's edge for 1 year; bust via `?v=` query param when re-rating

### Sharing UX
- Share button on `/r/[slug]` uses Web Share API on mobile (`navigator.share`), clipboard copy fallback on desktop
- Shared URL: `https://isitsmut.com/r/[slug]`

## Rate Limiting & Abuse Protection

Edge middleware on `/api/disambiguate` and `/api/rate`:

1. Compute `ip_hash = sha256(ip + RATE_LIMIT_SALT)` (salt rotated daily via cron)
2. Upsert `rate_limits` for `(ip_hash, current-hour-window)`, increment `count`
3. If `count > 20` → return `429 { needs_captcha: true }`
4. Client shows inline hCaptcha modal → on success, sets a 1-hour signed cookie `captcha_ok=true`
5. Middleware checks cookie before counter; valid cookie bypasses the limit

**Important — `/api/rate` cache hits do NOT decrement the counter.** The middleware checks the Supabase `ratings` cache first; if hit, returns the cached row immediately without touching `rate_limits` or Claude. Popular queries (the bulk of traffic) cost nothing and never trigger a captcha.

**`/api/disambiguate` is not cached in v1** — every disambiguation call hits Claude and counts against the rate limit. (Disambiguation results are cheap and small; caching them would add another table and complicate slug stability for marginal benefit. Revisit in v1.1 if logs show high duplicate-query volume.)

## Error Handling

Six failure modes, all explicit:

| # | Scenario | Behavior |
|---|---|---|
| 1 | Disambiguate returns empty | UI: "We couldn't find a confident match for **'xyz'**. Try adding the author or year." No DB write, no retry. |
| 2 | Claude returns `known: false` | Write `ratings` row with `known=false` (don't re-call on repeat). UI: "We don't have a reliable read on this one yet. Suggest a rating →" (link to Google Form). |
| 3 | Claude API failure (timeout / 5xx / Anthropic rate limit) | Retry once after 500ms. On second failure: return `503`. UI shows inline error + refresh button. **Don't cache failures.** |
| 4 | Supabase failure | `disambiguate` / `rate`: still return Claude's answer if cache-write fails (degraded but functional). `/r/[slug]` page: fall back to client-side `/api/rate`. View-counter: silent failure. All logged to PostHog as `error_event`. |
| 5 | Rate-limit hit (429) | Inline hCaptcha modal, not full-page. On success: 1-hour cookie, retry the original request transparently. |
| 6 | Invalid slug in URL (`/r/garbage`) | Server-component checks `works`; if no row → 404 with "We haven't seen this one. Search for it →" linking back to `/`. |

### Logging
- All API errors → PostHog as `error_event` with `{ route, code, slug?, query? }` (no IPs; query truncated)
- Vercel function logs as fallback for stack traces

### Deliberately NOT doing
- No exponential-backoff queues
- No background re-rating jobs
- No user-facing error codes (friendly copy only)

## Testing Strategy

### Stack
- **Vitest** for unit + integration tests
- **MSW** to mock Anthropic API in tests (no real $ in CI)
- **Playwright** for one end-to-end happy-path test

### Unit tests (pure functions)
- `slugify(title, creator, year)` — punctuation, accents, collisions, missing creator/year, very long titles
- `verdictFromScore(score)` — every boundary (1, 3, 4, 6, 7, 8, 9, 10)
- `canonicalKey(work)` — deterministic; case/whitespace-insensitive
- Prompt builder — produces expected user message given `{title, creator, year, medium}`

### Integration tests (API routes with mocked Claude + test Supabase)
- `/api/disambiguate`: returns ≤4 candidates with slugs; empty array when no matches; rate-limit counter increments
- `/api/rate`:
  - Cache hit returns instantly without calling Claude (assert MSW handler not invoked)
  - Cache miss calls Claude, writes both `works` and `ratings`, returns the rating
  - `known:false` from Claude is persisted
  - Claude 5xx triggers one retry then 503
  - Supabase write failure still returns the answer
- Rate-limit middleware: 21st request returns 429 + `needs_captcha`; valid captcha cookie bypasses counter; cache hits don't decrement

### E2E test (Playwright — single golden path)
Visit `/` → type "Fourth Wing" → submit → land on `/r/fourth-wing-yarros-2023` → assert score visible, verdict visible, details blurred, "Tap to reveal" present → click reveal → details visible → click share → clipboard contains the URL.

### Test data
- `fixtures/works.json` — 5 known canonical works covering each medium and each score-band (1, 5, 8, 10)
- Separate `isitsmut_test` Supabase project (free tier)

### CI
- GitHub Actions on every push: `pnpm typecheck && pnpm test && pnpm test:e2e`
- Vercel Git integration: preview deploy per PR, prod deploy on `main`

### Deliberately NOT tested
- Quality of Claude's ratings (evaluated manually)
- OG image pixel rendering (verified manually post-deploy in iMessage / Twitter / Discord)
- Visual regression
- Load testing

## Deployment

### Environment variables (Vercel project env, per environment)
```
ANTHROPIC_API_KEY                   server only
SUPABASE_URL                        public
SUPABASE_ANON_KEY                   public (RLS protects it)
SUPABASE_SERVICE_ROLE_KEY           server only (bypasses RLS for writes)
HCAPTCHA_SITE_KEY                   public
HCAPTCHA_SECRET_KEY                 server only
POSTHOG_KEY                         public
POSTHOG_HOST                        public
RATE_LIMIT_SALT                     server only (rotated daily via cron)
SHARE_BASE_URL                      "https://isitsmut.com"
```
Local dev uses `.env.local` (gitignored).

### Domain
GoDaddy → Vercel via nameservers or A/CNAME (exact steps in the implementation plan).

### Edge vs serverless
- Edge runtime: `/api/disambiguate`, `/api/rate`, `/api/og/[slug]`
- Standard server runtime: page routes (need richer Node APIs)

### Supabase
- **New** Supabase project (separate from OmniLeague)
- Migrations in `supabase/migrations/` (versioned SQL), applied via Supabase CLI
- Daily cron job (Supabase scheduled function) to prune old `rate_limits` rows and rotate `RATE_LIMIT_SALT`

### PostHog
- Reuse existing OmniLeague PostHog project
- New filter/feature flag for "IsItSmut" traffic
- Page-view autocapture only (no session recordings, no full event tracking)

### Pre-launch checklist
1. Domain → Vercel verified, HTTPS working
2. `/terms`, `/privacy`, `/about` pages live
3. Footer disclaimer on every page ("AI-generated ratings. Subjective and may be inaccurate.")
4. hCaptcha sandbox tested + production keys configured
5. OG image manually verified in iMessage, Twitter/X, Discord
6. Mobile Lighthouse pass (perf + a11y > 90)
7. Try-these chips populated with 5 real, well-known titles spanning the score spectrum
8. `robots.txt` allows crawling

## Visual Design Decisions

### Brand
- **Personality:** Playful + winky
- **Palette:** Peach/blush/cream (primary `#d4506b`, surface `#fff5ee`, accent `#fde2e8`)
- **Typography:** System UI sans, rounded weights, bold display sizes for the wordmark
- **Tone:** Warm, light humor in copy, doesn't take itself seriously

### Homepage (mockup A)
- Hero: large "Is It Smut?" wordmark, tagline ("Find out before you start chapter one.")
- Prominent rounded search bar (placeholder: "Type a book, movie, or show…")
- "Try these" chips below the search: 5 well-known titles spanning the score spectrum
- Subtle footer disclaimer

### Result card (mockup B — Hero rating banner)
- Top of card: full-width gradient banner with `SMUT RATING`, big `8/10`, verdict line ("Yes — it's smut")
- Below banner: title, `creator · year · medium`
- 1–2 sentence synopsis
- `What's in it 🔒` section — blurred until tap, "Tap to reveal" affordance
- Tag pills below details (small chips like "Open door", "Enemies to lovers")
- Share button (icon + label)
- Footer disclaimer

## Open Items (handled in implementation plan, not here)
- Exact Vercel + GoDaddy DNS steps
- Choice between Supabase scheduled functions vs Vercel cron for daily prune
- Exact `@vercel/og` template HTML for share images
- Loading skeleton design for `/r/[slug]` cache-miss state
