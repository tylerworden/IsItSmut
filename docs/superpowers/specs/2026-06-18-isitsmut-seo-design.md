# IsItSmut.com — SEO Design Spec

**Date:** 2026-06-18
**Status:** Approved, ready for implementation planning
**Domain:** isitsmut.com
**Relation to other work:** First of three sequenced specs — **SEO → Coverage → Ads**. This spec is SEO only. Reducing `known:false` results and ads/monetization are explicitly deferred to their own specs (see Out of Scope).

## Purpose

Make IsItSmut rank at the top of search engines whenever someone researches a title alongside "smut" / "spicy" / "spice rating" and similar intent. The product is uniquely positioned for the long-tail "is [title] smut" query — high intent, low competition. This spec builds the technical SEO foundations the site is currently missing, enriches result pages for relevance and click-through, adds a small set of head-term hub pages, and seeds an indexable corpus so Google has real pages to rank on day one.

This serves the broader goal of turning IsItSmut into a passive, SEO-driven property: traffic should arrive organically without active marketing.

## Background — current SEO baseline

What exists today:
- `public/robots.txt` allows all and references `https://isitsmut.com/sitemap.xml` — **but no sitemap exists** (that URL is a 404).
- Result pages (`/r/[slug]`) are server-rendered with a basic `generateMetadata` (title + description). Good `<title>` ("Is X smut?"), but no canonical, no OpenGraph/Twitter tags, no structured data.
- Root layout sets a generic title/description but **no `metadataBase`**, so OG/canonical URLs are not reliably absolute.
- The valuable "what's in it" details render in the HTML (CSS-blurred), so crawlers can see them, but content is thin (~60 words).
- Vercel currently treats **`www` as canonical**; the apex 307-redirects to it, splitting ranking signals (`NEXT_PUBLIC_SHARE_BASE_URL` is the apex).
- Pages are born only when a user searches a title. Google cannot index a page that does not yet exist.
- `scripts/seed-leaderboard.ts` exists: a one-off, idempotent script that runs queries through the real disambiguate + rate flow (15 erotic-leaning titles). Reusable pattern for seeding.

## Scope

### In scope
- **Technical foundations:** `metadataBase`, canonical tags, dynamic `sitemap.ts`, `noindex` for no-score pages.
- **Result-page on-page SEO:** richer metadata (title/description/OG/Twitter/canonical), a visible Q&A text block, JSON-LD structured data (`Book`/`Movie`/`TVSeries` + `Review`), and related-title internal links.
- **Hub/browse pages:** per-medium browse (`/books`, `/movies`, `/tv`, score-descending) and a `/tamest` list, reusing leaderboard infrastructure (`/top` already serves the overall smuttiest list).
- **Seed corpus:** generalize the seed script to ~100–300 curated popular titles across genres and media; run once against prod.
- **Rendering:** ISR (incremental static regeneration) on result and hub pages.
- **Canonical-domain fix:** code points canonical at the apex; the Vercel primary-domain flip is a documented manual step.

### Out of scope
- **Reducing `known:false` ("no score") results** via model grounding/escalation, and any large-scale generation beyond the seed → **Coverage spec** (next).
- **`ads.txt`, consent/CMP, ad slots, AdSense application** → **Ads spec** (after Coverage).
- Extensive programmatic/auto-generated category systems (tag pages, genre matrices). Kept out deliberately — thin auto-generated pages can hurt SEO. Revisit only if traffic justifies it.
- User accounts, re-rate/dispute, multi-language, public API (unchanged from v1 scope).

### Success criteria
- `/sitemap.xml` returns 200 and lists all `known:true` result pages plus static and hub pages, with accurate `lastModified`.
- Result pages emit a canonical tag (apex), OpenGraph + Twitter card, and valid `Book`/`Movie`/`TVSeries` + `Review` JSON-LD that passes Google's Rich Results / Schema.org validation.
- No-score (`known:false`) pages are `noindex`.
- Hub pages render real content with internal links into result pages and appear in the sitemap and footer nav.
- The seed run produces a corpus of ~100–300 indexable result pages in prod.
- Lighthouse SEO score ≈ 100 on a representative result page.

## Design

### A. Technical foundations

**A1. `metadataBase` + canonical (apex).**
Set `metadataBase: new URL('https://isitsmut.com')` in the root layout `metadata`. Add explicit `alternates: { canonical: ... }` to result pages, hub pages, and the homepage. All canonicals resolve to the **apex** domain.

**Manual step (documented, not code):** In Vercel → Domains, set `isitsmut.com` (apex) as the primary domain and make `www.isitsmut.com` redirect to it. Safe to flip now — the site is ~1 month old with negligible accrued backlink equity on `www`. No DNS change or redeploy required. Until this is flipped, the code canonical still tells Google the apex is preferred.

**A2. Dynamic `app/sitemap.ts`.**
Next.js `MetadataRoute.Sitemap`. Entries:
- Static pages: `/`, `/top`, `/about`, `/privacy`, `/terms`.
- Hub pages: `/books`, `/movies`, `/tv`, and the curated lists (see C).
- All `known:true` result pages: query the `ratings`×`works` join for slugs + `rated_at`; emit `/r/{slug}` with `lastModified` = `rated_at`.
- Exclude `known:false` slugs.
On query failure, return only the static + hub entries (never 500 the sitemap). At current scale a single sitemap is fine; a sitemap index is unnecessary until ~50k URLs.

**A3. `noindex` on no-score pages.**
In the result page `generateMetadata`, when there is no rating or `known:false`, return `robots: { index: false, follow: true }`. `not-found` and error states are likewise non-indexable.

### B. Result-page on-page SEO

**B1. Richer `generateMetadata`** (for `known:true`):
- Title: `Is "{title}" Smut? {verdict} ({score}/10) — IsItSmut`
- Description: spoiler-safe, built from the verdict + synopsis (e.g. `"{verdict} {title} by {creator} scores {score}/10 for sexual content. {synopsis}"`), truncated to ~155 chars. Does **not** include the blurred "what's in it" details — keeps it subway-safe.
- OpenGraph (`type: article`, title, description, `images` → existing `/r/[slug]/opengraph-image`) and Twitter (`summary_large_image`).
- Canonical → apex `/r/{slug}`.

**B2. Visible Q&A text block** on the result card (`known:true`):
A short, crawlable, spoiler-safe line near the top of the card body, e.g. *"Is {title} smut? {verdict} It scores {score}/10 for sexual content."* Reinforces query-intent matching in visible text. Subway-safe; no spoilers, no quoting of details.

**B3. JSON-LD structured data** (server-rendered `<script type="application/ld+json">`, only when `known:true`):
- The work as `Book` (with `author`), `Movie`, or `TVSeries` (with `director`/`creator`) per `medium`; include `name`, creator, and `datePublished`/`copyrightYear` from `year` when present.
- A nested/linked `Review` with `reviewRating` (`ratingValue` = score, `bestRating` = 10, `worstRating` = 1), `author` = an `Organization` named "IsItSmut", `reviewBody` = synopsis, `name` = the verdict.

**Honesty note (no over-promising):** Google restricted **FAQ rich results** to authoritative government/health sites in August 2023, so a `FAQPage` schema will **not** produce a rich snippet for this site. We therefore use entity (`Book`/`Movie`/`TVSeries`) + `Review` schema for entity understanding and rely on the title, description, and on-page content for relevance and click-through — not on a FAQ rich-result widget.

**B4. Internal linking.**
On each result page, render a small "Related" section: a few other `known:true` works sharing the same `medium` (and, where cheap, overlapping `tags`), each linking to its `/r/{slug}`, plus a link up to the relevant hub page (e.g. the medium browse page). Improves crawl depth and dwell time.

**B5. Minor fold-in.** The "Suggest a rating" link on no-score cards is still a `PLACEHOLDER` Google Form URL. Since those pages are now `noindex` it is low-stakes, but it will be fixed (real URL) or removed while editing `ResultCard`.

### C. Hub / browse pages

Reuse and extend the leaderboard data layer (`getTopRatings` in `src/lib/leaderboard.ts`), adding a medium filter and ascending/descending score order.

`/top` already exists and is ordered by score descending — i.e. it is the **overall smuttiest** list. To avoid duplicate same-ordering pages (a thin-content / canonical conflict), the new hubs do **not** repeat that ordering at the overall level. Instead:
- `/books`, `/movies`, `/tv` — per-medium browse, ordered by score descending. These naturally target the "smuttiest books / movies / shows" head terms.
- `/tamest` — the inverse of `/top`: lowest-scoring `known:true` titles overall (ascending), targeting "clean / non-spicy" intent.

`/top` is left as-is (overall smuttiest). Each hub page has a head-term-targeting `H1` (e.g. "The Smuttiest Books, Rated 1–10"), a short real intro paragraph, and a list of titles linking into result pages. Hubs are added to the footer nav and to the sitemap. Kept few and content-real — no thin auto-generated index sprawl.

### D. Seed corpus

Generalize `scripts/seed-leaderboard.ts` (or add `scripts/seed-popular.ts`) with a curated list of **~100–300 popular titles across genres and media** — not just erotic-leaning — drawn from broadly searched, well-known books/movies/TV. Run once against prod. The script remains idempotent (cache hits skip Claude) and reuses the existing disambiguate + rate flow, so ratings pass through the normal pipeline (including the `+1` `adjustScore` display shim). This populates the sitemap and hub pages immediately.

Titles where Claude returns `known:false` simply won't get indexable pages — that is acceptable here and is the concern of the Coverage spec.

### Cross-cutting

**Rendering / ISR.** Add `export const revalidate = 86400` (≈1 day) to the **hub pages** (and `/top`) so crawlers and users receive fast cached HTML; their underlying leaderboard data rarely changes. **Result pages stay dynamic SSR** and do *not* get ISR: the route `await`s `searchParams` (for rate-on-first-visit), which forces dynamic rendering in Next 15, so a `revalidate` export there would be a no-op. Dynamic SSR already returns fully-rendered, crawlable HTML, so this is purely a caching/cost optimization that only the param-free hub routes can actually benefit from. Restructuring the result route to be ISR-cacheable is out of scope (risky refactor, no SEO upside). The rate and disambiguate APIs are unaffected.

**Error handling.** Sitemap and hub queries degrade gracefully: sitemap falls back to static+hub entries; hubs render the existing empty-state on query failure. Structured data and the Q&A block are emitted only when `known:true`.

## Data flow

No change to the search → disambiguate → rate request path. New read-only Supabase queries are added for: the sitemap (slugs + `rated_at`), hub pages (filtered/ordered leaderboard reads), and related-titles links. Metadata, JSON-LD, and the Q&A block are computed server-side from the rating already fetched during result-page render — no extra rating fetch.

## Testing

**Unit (Vitest):**
- Sitemap entry builder: given rows → correct `/r/{slug}` URLs with `lastModified`; `known:false` excluded; static + hub entries always present.
- JSON-LD builder: correct `@type` per medium; `reviewRating` bounds (1–10); valid shape; nothing emitted when `known:false`.
- Metadata builder: known vs unknown → correct title/description/canonical and `noindex` toggling.
- Q&A text builder: spoiler-safe string, correct interpolation.
- Hub data layer: medium filter + score ordering correctness (extends existing leaderboard tests).

**Manual / integration:**
- `GET /sitemap.xml` returns 200; spot-check known slugs present and a known-unknown slug absent.
- Validate result-page JSON-LD with Google Rich Results Test / Schema.org validator.
- Confirm canonical (apex) and `noindex` on a no-score page in rendered HTML.
- Lighthouse SEO pass (target ≈100) on a representative result page.
- After the Vercel primary-domain flip: confirm apex serves 200 (no redirect) and `www` 301s to apex.

## Risks & notes

- **Seed cost & quality:** ~100–300 Claude calls (one-time, idempotent). Some obscure titles may come back `known:false` and won't get pages — acceptable; Coverage spec addresses coverage.
- **Domain flip is manual:** SEO benefit of a single canonical depends on the Vercel primary-domain change actually being made. Documented as a required follow-up step.
- **Thin-content guardrail:** hub pages must carry real intro copy and real lists; no auto-generated tag/genre sprawl, per Google's thin-content guidance.
- **FAQ rich results unavailable** to this site (see B3) — expectations set accordingly.
