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
