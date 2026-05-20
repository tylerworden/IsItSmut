# Homepage Refresh + Leaderboard — Design Spec

**Date:** 2026-05-19
**Status:** Approved, ready for implementation planning
**Builds on:** `2026-05-17-isitsmut-design.md` (original MVP spec)

## Purpose

The launched MVP homepage feels too sparse — a wordmark, a search bar, and chips. It works, but it doesn't feel like a destination. This refresh adds visual weight to the homepage and introduces a Top 10 leaderboard that gives visitors a reason to scroll, return, and share.

## Scope

### In scope

- **Homepage redesign** — peach/blush gradient hero block, search and chips retained, new "🔥 Hottest of all time" preview section showing top 3 leaderboard entries with a link to the full page
- **New `/top` page** — full top 10, same ranked-row styling as the homepage preview
- **Leaderboard data layer** — server-rendered query returning the 10 highest-scored known ratings, joined with works for display metadata, sorted with the same score-adjustment that `getCachedRating` applies on read
- **Seeding script** — one-off Node script that runs 15 hand-picked titles through the existing `runRate` flow to populate the leaderboard at launch
- **Footer nav** — add a "Top 10" link alongside the existing about/terms/privacy

### Out of scope (deferred)

- Per-medium leaderboard pages (top 10 books, top 10 movies, top 10 TV) — combined list is sufficient for v1
- Trending / weekly / time-windowed leaderboards — all-time only
- "Recently rated" homepage section — keep the homepage focused on search + leaderboard for now
- Re-rating UI or admin tools for swapping leaderboard entries — once a title is in `ratings`, it's there; new high-scorers naturally displace lower ones
- Schema changes — no new tables, no new columns, no new indices (existing `ratings.score` + `ratings.view_count` are enough at this volume)

## Architecture

### Stack additions

None. Same Next.js 15 App Router, same Supabase, same brand tokens, same `nodejs` runtime convention.

### Pages

| Path | Status | Purpose |
|---|---|---|
| `/` | Modified | Adds gradient hero + leaderboard preview |
| `/top` | New | Full top 10 page |
| `/r/[slug]` | Unchanged | Result page |
| `/about`, `/terms`, `/privacy` | Unchanged | Static pages |

### New components

| File | Purpose |
|---|---|
| `src/components/Hero.tsx` | Peach→pink gradient block with wordmark + tagline. Server component (no interactivity). |
| `src/components/LeaderboardRow.tsx` | Single ranked row — number badge, title block, score pill, gradient row background. Wraps a Next `<Link>` to `/r/[slug]`. |
| `src/components/LeaderboardSection.tsx` | Section header + list of `LeaderboardRow`. Takes an array of entries and an optional "see more" link. Used on both the homepage (3 rows + link) and `/top` (10 rows, no link). |

### New lib module

`src/lib/leaderboard.ts`

```ts
export type LeaderboardEntry = {
  slug: string;
  title: string;
  creator: string;
  medium: 'book' | 'movie' | 'tv';
  year: number | null;
  score: number;        // ADJUSTED (post-adjustScore) score
  verdict: string;       // verdict derived from adjusted score
  viewCount: number;
};

export async function getTopRatings(limit: number): Promise<LeaderboardEntry[]>;
```

Query:
```sql
select w.slug, w.title, w.creator, w.medium, w.year, r.score, r.view_count
from ratings r
join works w on w.slug = r.slug
where r.known = true and r.score is not null
order by r.score desc, r.view_count desc, w.slug asc
limit $1
```

Then in Node: map each row through `adjustScore` → re-derive `verdict` via `verdictFromScore` → re-sort by adjusted score (descending), then by view count (descending), then slug (ascending) before returning. Adjustment is read-time, same pattern as `getCachedRating`. `adjustScore` never lowers a score and preserves relative ordering, so any row outside the raw top 10 is also outside the adjusted top 10 — no need to over-fetch.

### Caching

Both pages are rendered with Next's default static caching disabled (data freshness matters). Add `export const revalidate = 60;` on both `/` and `/top` page modules so the leaderboard query is hit at most once per minute per Vercel edge node. Acceptable staleness for a top 10 that changes slowly.

## Visual Design

### Hero block (new)

- Full-width peach→pink gradient (`linear-gradient(135deg, var(--color-brand), var(--color-brand-soft))`) inside a rounded container
- Padding: generous on mobile (~32px vertical)
- "Is It Smut?" wordmark in white, bold, ~36px on mobile / ~48px desktop
- Tagline beneath: "Find out before you start chapter one." in white at 70% opacity
- Sits at the top of the homepage above the search bar

### Leaderboard row

- Horizontal layout: number badge (left) · title/creator/medium stack (center, takes remaining width) · score pill (right)
- Row background: subtle gradient `linear-gradient(90deg, var(--color-accent), var(--color-surface-card))` — fades from pale pink on the left to white
- Number badge: 28×28 circle with the brand gradient, white bold number inside
- Title: 14px bold, brand-ink color
- Subtitle: 11px muted, format `Creator · YEAR · MEDIUM`
- Score pill: brand color background, white text, e.g., `9/10`
- Entire row is a `<Link>` to `/r/{slug}`, hover state lifts the gradient slightly
- Vertical gap: 8px between rows

### Section header

- "🔥 Hottest of all time" — emoji intentional, sets tone
- 12px uppercase tracked label in brand color
- Sits above the row list

### Homepage flow (top to bottom)

1. Hero block
2. Search bar
3. Try-these chips
4. Section header: 🔥 Hottest of all time
5. 3 leaderboard rows
6. "See full top 10 →" link (right-aligned, brand color, small)
7. (Existing footer from layout)

### `/top` page flow

1. Page header: "Top 10 Hottest" (28px brand color, centered)
2. Short subtitle: "The smuttiest books, movies, and shows we've rated." (small muted)
3. 10 leaderboard rows
4. (Existing footer from layout)

No hero block on `/top` — the page header is enough; we don't want the page to feel like another homepage.

## Seeding

### Strategy

A one-off Node script `scripts/seed-leaderboard.ts` that:
1. Loads the title list (hard-coded in the script)
2. For each title, calls `runDisambiguate(title)` to get Claude's canonical `{title, creator, year, medium}` + slug
3. Calls `runRate({ slug, candidate })` to fill the cache
4. Logs progress and final scores

Runs against production Supabase by loading `.env.local` populated with prod values. One-shot execution, no scheduling, no UI. Idempotent (cache hits skip Claude).

### Seed titles (15)

**Books (7):** Fifty Shades of Grey (E.L. James, 2011) · Haunting Adeline (H.D. Carlton, 2021) · A Court of Mist and Fury (Sarah J. Maas, 2016) · Icebreaker (Hannah Grace, 2022) · Fourth Wing (Rebecca Yarros, 2023) · Twisted Love (Ana Huang, 2021) · Outlander (Diana Gabaldon, 1991)

**Movies (4):** 365 Days (Barbara Białowąs, 2020) · Blue Is the Warmest Color (Abdellatif Kechiche, 2013) · Fifty Shades of Grey (Sam Taylor-Johnson, 2015) · 9½ Weeks (Adrian Lyne, 1986)

**TV (4):** Outlander (Ronald D. Moore, 2014) · Sex/Life (Stacy Rukeyser, 2021) · Bridgerton (Shonda Rhimes, 2020) · Euphoria (Sam Levinson, 2019)

Two "Outlander" entries (book + show) are intentional — they slugify to different slugs (`outlander-gabaldon-1991` vs `outlander-moore-2014`).

### Expected outcome

Of the 15 seeded titles, ≥10 expected to land at adjusted score 8+. Top 10 is fully populated at launch. Any leftover seeded titles scoring 6–7 still exist in the cache but don't appear on the leaderboard.

## Error Handling

- `getTopRatings` Supabase failure: log to console, return empty array. Homepage and `/top` render with the section visually present but containing the message "Loading the leaderboard… check back in a moment." (avoids the page erroring out entirely — leaderboard is a nice-to-have, not load-blocking).
- Slug links to a deleted/missing work: `/r/[slug]` already handles 404 via existing `notFound()` logic. No new handling needed.
- Seeding script failure mid-run: it's idempotent, just re-run. Each title's success/failure logged independently.

## Testing

### Unit

- `tests/unit/leaderboard.test.ts` — `getTopRatings` with a mocked Supabase client:
  - Returns entries sorted by adjusted score descending
  - Adjustment collapses ties: a raw 8 (→9) and a raw 9 (→9) tie at 9; test that the tiebreaker falls through to `view_count desc` then `slug asc`
  - Respects the limit
  - Filters out `known = false` rows
  - Maps each row through `adjustScore` + `verdictFromScore`

### Component

- `tests/unit/LeaderboardRow.test.tsx` — renders title, creator, score; href points to `/r/{slug}`
- `tests/unit/Hero.test.tsx` — renders wordmark and tagline

### Integration

- None new needed. The new pages are thin compositions of components + the lib query, all covered by their unit tests.

### Manual (post-deploy checklist)

- Seed script ran successfully — at least 10 titles show on `/top`
- Homepage shows 3 entries, gradient row backgrounds visible
- Tapping a row navigates to `/r/[slug]`
- "See full top 10" link goes to `/top`
- Mobile (Lighthouse): perf + a11y still > 90

## Open Items

None for this design. Implementation plan will resolve:
- Exact gradient stops + padding values (refinement during build, easy to tweak)
- Whether `Hero` re-uses the result-card's existing gradient classes or defines its own
- Test data for seeding the local Supabase if Tyler wants to dev-test before running against prod
