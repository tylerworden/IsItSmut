// scripts/seed-popular-2.ts
//
// Second seed batch (2026-06-24): 100 additional popular titles, weighted toward
// romance / romantasy / spicy books (the core "is it smut" search intent), plus
// broader adult fiction and buzzy adaptations. Avoids the ~50 already seeded by
// seed-popular.ts. Runs each query through the real disambiguate + rate flow.
// Idempotent — cache hits skip Claude.
//
// Usage on this Windows box (TLS interception — pnpm dlx is blocked, use npm's npx):
//   NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes \
//     tsx@latest --env-file=.env.local scripts/seed-popular-2.ts
//
// Required env (.env.local must hold PROD creds): NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, RATE_LIMIT_SALT.

import { runDisambiguate } from '../src/lib/disambiguate';
import { runRate } from '../src/lib/rate';
import type { Medium } from '../src/lib/types';

type SeedItem = { query: string; expect: Medium };

const SEED: SeedItem[] = [
  // --- Romantasy & fantasy romance ---
  { query: 'Onyx Storm by Rebecca Yarros', expect: 'book' },
  { query: 'A Court of Wings and Ruin by Sarah J. Maas', expect: 'book' },
  { query: 'A Court of Silver Flames by Sarah J. Maas', expect: 'book' },
  { query: 'House of Earth and Blood by Sarah J. Maas', expect: 'book' },
  { query: 'House of Sky and Breath by Sarah J. Maas', expect: 'book' },
  { query: 'From Blood and Ash by Jennifer L. Armentrout', expect: 'book' },
  { query: 'A Kingdom of Flesh and Fire by Jennifer L. Armentrout', expect: 'book' },
  { query: 'Powerless by Lauren Roberts', expect: 'book' },
  { query: 'Reckless by Lauren Roberts', expect: 'book' },
  { query: 'Fearless by Lauren Roberts', expect: 'book' },
  { query: 'The Serpent and the Wings of Night by Carissa Broadbent', expect: 'book' },
  { query: 'A Touch of Darkness by Scarlett St. Clair', expect: 'book' },
  { query: 'Neon Gods by Katee Robert', expect: 'book' },
  { query: 'Crave by Tracy Wolff', expect: 'book' },
  { query: 'Caraval by Stephanie Garber', expect: 'book' },
  { query: 'Once Upon a Broken Heart by Stephanie Garber', expect: 'book' },
  { query: 'Kingdom of the Wicked by Kerri Maniscalco', expect: 'book' },
  { query: 'One Dark Window by Rachel Gillig', expect: 'book' },
  { query: 'The Knight and the Moth by Rachel Gillig', expect: 'book' },
  { query: 'Shadow and Bone by Leigh Bardugo', expect: 'book' },
  { query: 'For the Wolf by Hannah Whitten', expect: 'book' },
  { query: 'The Atlas Six by Olivie Blake', expect: 'book' },
  { query: 'A Fate Inked in Blood by Danielle L. Jensen', expect: 'book' },
  { query: 'Alchemised by SenLinYu', expect: 'book' },
  { query: 'Zodiac Academy: The Awakening by Caroline Peckham', expect: 'book' },

  // --- Contemporary romance & rom-com ---
  { query: 'Happy Place by Emily Henry', expect: 'book' },
  { query: 'Funny Story by Emily Henry', expect: 'book' },
  { query: 'Great Big Beautiful Life by Emily Henry', expect: 'book' },
  { query: 'Love on the Brain by Ali Hazelwood', expect: 'book' },
  { query: 'Love, Theoretically by Ali Hazelwood', expect: 'book' },
  { query: 'Not in Love by Ali Hazelwood', expect: 'book' },
  { query: 'Deep End by Ali Hazelwood', expect: 'book' },
  { query: 'Check & Mate by Ali Hazelwood', expect: 'book' },
  { query: 'Things We Never Got Over by Lucy Score', expect: 'book' },
  { query: 'Things We Hide from the Light by Lucy Score', expect: 'book' },
  { query: 'It Happened One Summer by Tessa Bailey', expect: 'book' },
  { query: 'Part of Your World by Abby Jimenez', expect: 'book' },
  { query: 'Yours Truly by Abby Jimenez', expect: 'book' },
  { query: 'Say You\'ll Remember Me by Abby Jimenez', expect: 'book' },
  { query: 'Every Summer After by Carley Fortune', expect: 'book' },
  { query: 'One Golden Summer by Carley Fortune', expect: 'book' },
  { query: 'The Cheat Sheet by Sarah Adams', expect: 'book' },
  { query: 'Done and Dusted by Lyla Sage', expect: 'book' },
  { query: 'Flawless by Elsie Silver', expect: 'book' },
  { query: 'Heartless by Elsie Silver', expect: 'book' },
  { query: 'Wildfire by Hannah Grace', expect: 'book' },
  { query: 'The Deal by Elle Kennedy', expect: 'book' },
  { query: 'The Hating Game by Sally Thorne', expect: 'book' },
  { query: 'Red, White & Royal Blue by Casey McQuiston', expect: 'book' },

  // --- Colleen Hoover & Ana Huang (more of their catalogs) ---
  { query: 'It Starts with Us by Colleen Hoover', expect: 'book' },
  { query: 'November 9 by Colleen Hoover', expect: 'book' },
  { query: 'Reminders of Him by Colleen Hoover', expect: 'book' },
  { query: 'Confess by Colleen Hoover', expect: 'book' },
  { query: 'Too Late by Colleen Hoover', expect: 'book' },
  { query: 'Twisted Games by Ana Huang', expect: 'book' },
  { query: 'Twisted Hate by Ana Huang', expect: 'book' },
  { query: 'Twisted Lies by Ana Huang', expect: 'book' },
  { query: 'King of Wrath by Ana Huang', expect: 'book' },
  { query: 'King of Pride by Ana Huang', expect: 'book' },
  { query: 'King of Greed by Ana Huang', expect: 'book' },

  // --- Dark / extra-spicy romance ---
  { query: 'Corrupt by Penelope Douglas', expect: 'book' },
  { query: 'Birthday Girl by Penelope Douglas', expect: 'book' },
  { query: 'Priest by Sierra Simone', expect: 'book' },
  { query: 'Bound by Honor by Cora Reilly', expect: 'book' },
  { query: 'The Sweetest Oblivion by Danielle Lori', expect: 'book' },
  { query: 'Gothikana by RuNyx', expect: 'book' },
  { query: 'Den of Vipers by K.A. Knight', expect: 'book' },
  { query: 'Butcher & Blackbird by Brynne Weaver', expect: 'book' },
  { query: 'Lights Out by Navessa Allen', expect: 'book' },
  { query: 'Hooked by Emily McIntire', expect: 'book' },

  // --- Broader popular fiction & book-club ---
  { query: 'The Song of Achilles by Madeline Miller', expect: 'book' },
  { query: 'Daisy Jones & the Six by Taylor Jenkins Reid', expect: 'book' },
  { query: 'Malibu Rising by Taylor Jenkins Reid', expect: 'book' },
  { query: 'The Housemaid by Freida McFadden', expect: 'book' },
  { query: 'Yellowface by R.F. Kuang', expect: 'book' },
  { query: 'Tomorrow, and Tomorrow, and Tomorrow by Gabrielle Zevin', expect: 'book' },
  { query: 'Lessons in Chemistry by Bonnie Garmus', expect: 'book' },
  { query: 'The Midnight Library by Matt Haig', expect: 'book' },
  { query: 'The Women by Kristin Hannah', expect: 'book' },
  { query: 'A Little Life by Hanya Yanagihara', expect: 'book' },
  { query: 'Conversations with Friends by Sally Rooney', expect: 'book' },
  { query: 'Sunrise on the Reaping by Suzanne Collins', expect: 'book' },

  // --- Movies ---
  { query: 'Fifty Shades Darker 2017 film', expect: 'movie' },
  { query: 'After 2019 film', expect: 'movie' },
  { query: 'The Idea of You 2024 film', expect: 'movie' },
  { query: 'Anyone But You 2023 film', expect: 'movie' },
  { query: 'Saltburn 2023 film', expect: 'movie' },
  { query: 'Babygirl 2024 film', expect: 'movie' },
  { query: 'Challengers 2024 film', expect: 'movie' },
  { query: 'It Ends with Us 2024 film', expect: 'movie' },
  { query: 'Poor Things 2023 film', expect: 'movie' },

  // --- TV ---
  { query: 'Queen Charlotte A Bridgerton Story Netflix series', expect: 'tv' },
  { query: 'Tell Me Lies Hulu series', expect: 'tv' },
  { query: 'Daisy Jones & the Six Prime Video series', expect: 'tv' },
  { query: 'Interview with the Vampire AMC series', expect: 'tv' },
  { query: 'The White Lotus HBO series', expect: 'tv' },
  { query: 'Fellow Travelers Showtime series', expect: 'tv' },
  { query: 'Sex and the City HBO series', expect: 'tv' },
  { query: 'Virgin River Netflix series', expect: 'tv' },
  { query: 'Masters of Sex Showtime series', expect: 'tv' },
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
