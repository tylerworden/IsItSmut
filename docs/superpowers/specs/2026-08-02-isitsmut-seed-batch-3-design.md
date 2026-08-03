# Seed Batch 3: 300-Title Broad-Mix Catalog Expansion — Design

**Date:** 2026-08-02
**Status:** Approved by Tyler (conversation, 2026-08-02)

## Goal

Triple the site's rated catalog (~150 → ~450 result pages) with a broad-mix
seed batch, widening the SEO net beyond the romance/romantasy core that
batches 1–2 deliberately targeted. More known-title pages = more indexable
"Is X smut?" answers = more passive search traffic for the new full-tease
SERP snippets to convert.

## Title Mix (approved)

300 titles total:

| Slice | Count | Rationale |
|---|---|---|
| General bestsellers & book-club staples | ~120 | Mostly score 1–3; "is it smut? No" answers real searches from hesitant readers and gift-buyers |
| YA | ~80 | The parent-checking-a-book use case; YA romantasy plus canonical staples |
| Romance long-tail | ~60 | Next tier down from batches 1–2 (deeper author catalogs, BookTok mid-tier) |
| Movies/TV | ~40 | Buzzy screen titles with "how spicy is it" search traffic |

Overlap with the existing ~150 pages is harmless (cache hits are free and the
2026-08-02 disambiguate fix reuses existing slugs), but the list must be
checked against the `SEED` arrays in `seed-popular.ts` and `seed-popular-2.ts`
(both in-repo) so the 300 slots buy maximum new coverage.

## Sourcing

Two passes:

1. **Knowledge pass (~250–270 titles):** curated from established lists the
   model knows reliably through Jan 2026 — NYT bestsellers, Goodreads Choice
   winners/nominees, BookTok canon, classic YA staples, prestige/buzzy
   adaptations.
2. **Freshness pass (~30–50 titles):** web searches for 2026 bestseller and
   new-release lists (NYT, Amazon charts, Goodreads new releases) to cover
   Feb–Aug 2026 releases the model's training data misses. New releases are
   disproportionately valuable search targets.

**Failure mode is self-correcting:** a title Claude doesn't recognize returns
`known:false`, renders as a noindex no-score page, and costs one cheap API
round-trip. No bad data enters the index.

## Script Design

`scripts/seed-popular-3.ts` — same pattern as `seed-popular-2.ts` (hardcoded
`SEED: Array<{ query, expect }>` run sequentially through the real
`runDisambiguate` → `runRate` flow), with one addition: a `[n/300]` progress
counter in the per-title log line, since this run is 3× longer.

- Idempotent: cache hits skip Claude; safe to re-run after a crash.
- No changes to prior seed scripts, app code, or schema.
- Runs with the standard TLS-workaround operator command
  (`NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes
  tsx@latest --env-file=.env.local scripts/seed-popular-3.ts`).
- Script-only change: lands directly on `main` (no app deploy impact),
  matching how `seed-popular-2.ts` was committed.

## Cost & Runtime

~300 × 2 Haiku calls (plus occasional Sonnet escalations) ≈ **$5–10** in API
spend; a few hours wall-clock, run in the background.

## Verification

1. Final tally from the script (ok / unknown / skipped / failed) — expect
   unknowns only for very recent releases.
2. `merge-duplicates.ts` scan returns "No duplicate groups found."
3. Spot-check 2–3 newly seeded pages live (tease title + Q&A line render).
4. Optional: `coverage-eval.ts` for the updated no-score rate.

## Out of Scope

- Refactoring the three seed scripts into a shared runner (revisit if a
  batch 4 happens).
- Trope/tag browse pages and other "bulk up" roadmap items — separate
  efforts.
- Any change to rating prompts, calibration, or the +1 shim.
