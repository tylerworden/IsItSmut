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
