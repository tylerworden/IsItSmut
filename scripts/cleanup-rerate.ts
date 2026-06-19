// scripts/cleanup-rerate.ts
//
// One-off: removes stale no-score (known=false) entries so the improved prompts +
// Sonnet escalation can re-rate them, then re-runs the recoverable titles.
//
// Usage (TLS-intercepting machine — pnpm dlx is blocked, use npx):
//   NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/cleanup-rerate.ts
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, RATE_LIMIT_SALT.

import { supabaseServer } from '../src/lib/supabase-server';
import { runDisambiguate } from '../src/lib/disambiguate';
import { runRate } from '../src/lib/rate';

// Recoverable titles from the 2026-06-18 diagnostic (recognizable works that
// should now rate). Genuine gibberish is intentionally NOT re-run.
const RERATE: string[] = [
  'Normal People TV series Sally Rooney',
  'Deep Work by Cal Newport',
  'The Book of Mormon',
  'Hard Knocks HBO sports documentary series',
  'Swamp Story by Dave Barry',
  'Camera Shy by Elinor Lipman',
  'Stars in Our Eyes by Daisy Goodwin',
  'Rites of the Starling by Devney Perry',
  'Shield of Sparrows by Carrie Summers',
  'Broken Country by Clare Morrall',
];

async function main() {
  const sb = supabaseServer();

  // 1. Delete stale no-score entries and their works rows.
  const { data: stale, error } = await sb.from('ratings').select('slug').eq('known', false);
  if (error) { console.error('failed to read known=false rows', error); process.exit(1); }
  const slugs = (stale ?? []).map((r) => (r as { slug: string }).slug);
  console.log(`Deleting ${slugs.length} known=false entries (ratings + works)...`);
  if (slugs.length > 0) {
    const delR = await sb.from('ratings').delete().in('slug', slugs);
    if (delR.error) console.error('ratings delete error', delR.error);
    const delW = await sb.from('works').delete().in('slug', slugs);
    if (delW.error) console.error('works delete error', delW.error);
  }

  // 2. Re-run recoverable titles through the improved flow.
  let ok = 0, unknown = 0, failed = 0;
  for (const query of RERATE) {
    console.log(`\n→ ${query}`);
    try {
      const { candidates } = await runDisambiguate(query);
      if (candidates.length === 0) { console.log('  ✗ no candidates'); unknown++; continue; }
      const match = candidates[0];
      console.log(`  matched: ${match.title} (${match.creator}, ${match.year}, ${match.medium}) → ${match.slug}`);
      const result = await runRate({ slug: match.slug, candidate: match });
      if (result.rating.known) {
        console.log(`  ✓ ${result.rating.score}/10 — ${result.rating.verdict}  [model: ${result.rating.model}]${result.cacheHit ? ' (cached)' : ''}`);
        ok++;
      } else {
        console.log(`  ⚠ still known=false  [model: ${result.rating.model}]`);
        unknown++;
      }
    } catch (err) {
      console.error('  ✗ error:', err instanceof Error ? err.message : err);
      failed++;
    }
  }
  console.log(`\n=== Done — re-rated ok: ${ok}, still unknown: ${unknown}, failed: ${failed} ===`);
  console.log('If escalation is working, at least some lines should show [model: claude-sonnet-4-6].');
}

main().then(() => process.exit(0));
