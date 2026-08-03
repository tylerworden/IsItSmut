# SERP CTR Rework + Duplicate-Slug Cleanup — Design

**Date:** 2026-08-02
**Status:** Approved by Tyler (full-tease option chosen explicitly)

## Problem

GSC data (Jun 18 – Jul 31, 2026): 991 impressions, 10 clicks (~1% CTR) at an
average position of ~8. Pages rank on page 1 for their target queries but earn
almost no clicks because the title tag and meta description give away the
verdict AND the score (e.g. `Is "Red Rising" Smut? Not smut. (2/10)`), so the
searcher never needs to visit. Red Rising: 120 impressions, 0 clicks.

Secondary issues visible in the same report:

- Duplicate result pages split impressions: `fifty-shades-of-grey-james-2011`
  vs `...-2011-4f3e`, `a-court-of-silver-flames-maas-2020` vs `...-2021`,
  `blood-and-ash-armentrout-2020` vs `from-blood-and-ash-armentrout-2020`.
- "Spice level" query phrasings rank poorly (positions 49–97) while "smut"
  phrasings rank 5–10; the word "spice" barely appears on the site.

## Goals / success criteria

1. CTR on high-impression result pages moves from ~0% toward 2–4% in GSC over
   the following weeks.
2. Duplicate URLs 301 to a single canonical page; impressions consolidate.
3. New duplicates stop being minted.
4. Pages become eligible for "spice level" query phrasings.

Non-goals: rating calibration, disambiguation creator accuracy (the
`normal-people-dunham-2020` class), OG image fixes, hub-page changes,
AI-generated per-page descriptions (rejected: adds cost/latency to every new
rating for marginal gain over templates — measure templates first).

## Workstream A — SERP snippet rework (full tease)

All in `src/lib/seo.ts` (+ `ResultCard` copy). The on-page experience keeps
answering instantly; only what Google displays changes.

1. **Title tag** (known ratings):
   `Is {title} Smut? Spice Level & Scene Guide — IsItSmut`
   No verdict, no score, no quotes around the title. "Spice Level" appears in
   every title (targets the spice-level query space).
2. **Meta description** — tease template, no verdict/score, clamped to 155:
   `Wondering if {title} by {creator} is smut? Get the verdict, the 1–10
   spice level, what's actually in it, and who it's OK for — spoiler-free.`
3. **OG/Twitter metadata keeps the current answer-first format** (verdict +
   score in title, current description). Social shares want the answer
   visible; Google ignores OG tags. `resultMetadata` therefore builds two
   title/description pairs: tease for `title`/`description`, answer-first for
   `openGraph` and `twitter`.
4. **On-page Q&A line** (`buildQuestionAnswer`, rendered in `ResultCard`)
   stays instant-answer but adopts spice vocabulary:
   `Is {title} smut? {verdict} Spice level: {score}/10 for sexual content.`
5. **JSON-LD unchanged** — review stars in the SERP are extra real estate;
   net positive for CTR even though they reveal the rating.
6. Unknown-rating (`known:false`) metadata branch unchanged (noindex).

## Workstream B — Duplicate cleanup + redirects

### Root cause

`runDisambiguate` (`src/lib/disambiguate.ts`) decides "different work" by
comparing stored `title`/`creator`/`year` to the candidate's as **raw
strings**. Cosmetic AI variance ("E L James" vs "E. L. James") → hash-suffix
dupe. Year variance (ACOSF 2020 vs 2021) → different base slug → dupe page.
Title variance ("Blood and Ash" vs "From Blood and Ash") → dupe page (not
fully preventable; cleaned up via aliases).

### Changes

1. **`aliases` table** (new migration, pattern-matched to existing ones):
   `alias_slug text primary key`, `canonical_slug text not null`,
   `created_at timestamptz default now()`. RLS/grants pattern-matched to the
   `works` table so alias lookups work through the same `supabaseServer()`
   read path the page already uses.
2. **Redirect path**: shared helper used by `/r/[slug]`'s `generateMetadata`
   and page component — when the slug has no `works` row, look up `aliases`;
   on hit, `permanentRedirect('/r/{canonical}')` (Next 308; Google treats as
   301). No alias chains: merge script always writes aliases pointing at the
   final canonical.
3. **Prevention** in the disambiguate/slug flow:
   - Same base slug + same `medium` → same work: reuse the existing slug
     (no hash suffix). `runRate`'s upsert may normalize title/creator text;
     harmless. Hash suffix remains only for same-slug different-medium.
   - Year wobble: before minting a new slug, look up existing works whose
     slug matches `^{titlePart}-{creatorPart}(-\d{4})?(-[0-9a-f]{4})?$` with
     the same medium; if found, reuse that work's slug instead of creating a
     year-variant twin. (Same title + same creator + same medium ≈ same work;
     false-merge risk accepted as negligible.)
4. **Merge script** `scripts/merge-duplicates.ts` (operator script, run with
   the npx TLS-bypass command like the seed scripts):
   - `--scan` (default): report candidate dupe groups (works sharing
     slug-minus-year/hash identity, plus hash-suffixed slugs) — no writes.
   - `--merge`: apply a curated in-script merge list. Per pair: verify
     canonical work exists; if canonical lacks a rating and the dupe has one,
     re-point the rating to the canonical slug; delete dupe's rating + work
     rows; upsert alias row. Idempotent (skip already-merged pairs).
   - Initial curated list (verify against live DB during `--scan` first):
     - `fifty-shades-of-grey-james-2011-4f3e` → `fifty-shades-of-grey-james-2011`
     - `a-court-of-silver-flames-maas-2020` → `a-court-of-silver-flames-maas-2021` (real pub year)
     - `blood-and-ash-armentrout-2020` → `from-blood-and-ash-armentrout-2020` (correct title)
5. **Sitemap** needs no change: merged dupes' `works` rows are deleted, so
   they drop out automatically; aliases are never listed.

## Testing

- Unit: new `resultMetadata` expectations (tease title/description; OG keeps
  answer-first), `buildQuestionAnswer` new copy, slug/disambiguate reuse
  logic (same-slug-same-medium, year-wobble reuse, different-medium still
  hash-suffixes).
- Integration: alias lookup → `permanentRedirect` (Supabase mocked, matching
  existing test patterns).
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` all green before PR.
- Operator script exercised via `--scan` against prod before `--merge`.

## Rollout

1. One PR; confirm with Tyler before merge (production deploy).
2. Apply the `aliases` migration to prod Supabase.
3. Run `merge-duplicates.ts --scan`, review, then `--merge`.
4. Verify live: dupe URLs 308 to canonicals; new titles/descriptions render;
   Q&A line shows spice-level copy.
5. Watch GSC CTR on Red Rising / The Housemaid over subsequent weeks.
