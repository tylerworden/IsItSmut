// scripts/merge-duplicates.ts
//
// Consolidates duplicate result pages. For each {dupe, canonical} pair:
// moves the rating over if the canonical lacks one, deletes the dupe's works
// row (FK cascades to its rating), and upserts an alias row so /r/<dupe>
// permanently redirects to /r/<canonical>.
//
// Usage (TLS-intercepting machine — pnpm dlx is blocked, use npx):
//   Scan only (default, no writes — reports candidate duplicate groups):
//     NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/merge-duplicates.ts
//   Apply the curated MERGES list:
//     NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/merge-duplicates.ts --merge
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Requires the aliases migration to be applied first.
// Idempotent: already-merged pairs are skipped. The dupe's view_count is
// discarded when the canonical already has a rating (negligible at our scale).
// NOTE: --scan groups year/hash twins only; title-variant dupes (e.g.
// blood-and-ash vs from-blood-and-ash) must be curated by hand from GSC.

import { supabaseServer } from '../src/lib/supabase-server';

// Curated from the 2026-08-02 GSC report; confirm with --scan before --merge.
const MERGES: Array<{ dupe: string; canonical: string }> = [
  // hash-suffix twins minted by the old raw-string identity comparison
  { dupe: 'fifty-shades-of-grey-james-2011-4f3e', canonical: 'fifty-shades-of-grey-james-2011' },
  // second twin surfaced by --scan during the 2026-08-02 rollout
  { dupe: 'fifty-shades-of-grey-james-2011-0d82', canonical: 'fifty-shades-of-grey-james-2011' },
  // AI year wobble; ACOSF's real publication year is 2021
  { dupe: 'a-court-of-silver-flames-maas-2020', canonical: 'a-court-of-silver-flames-maas-2021' },
  // AI title variant; the book is "From Blood and Ash"
  { dupe: 'blood-and-ash-armentrout-2020', canonical: 'from-blood-and-ash-armentrout-2020' },
];

// Trailing -year and/or -hash4 stripped so year/hash variants group together.
// (A trailing year also matches the hex pattern; both replaces together still
// strip at most the two trailing segments.)
function identityKey(slug: string): string {
  return slug.replace(/-[0-9a-f]{4}$/, '').replace(/-\d{4}$/, '');
}

async function scan(): Promise<void> {
  const sb = supabaseServer();
  const { data, error } = await sb.from('works').select('slug, medium, title');
  if (error) { console.error('failed to read works', error); process.exit(1); }
  const groups = new Map<string, Array<{ slug: string; title: string }>>();
  for (const row of (data ?? []) as Array<{ slug: string; medium: string; title: string }>) {
    const key = `${row.medium}:${identityKey(row.slug)}`;
    const arr = groups.get(key) ?? [];
    arr.push(row);
    groups.set(key, arr);
  }
  let found = 0;
  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    found++;
    console.log(`\n${key}`);
    for (const m of members) console.log(`  ${m.slug}  (${m.title})`);
  }
  console.log(
    found === 0
      ? '\nNo duplicate groups found.'
      : `\n${found} candidate group(s). Review, update MERGES if needed, then run with --merge.`
  );
}

async function merge(): Promise<void> {
  const sb = supabaseServer();
  let failed = 0;
  for (const { dupe, canonical } of MERGES) {
    console.log(`\n${dupe} → ${canonical}`);
    // A self-pair would delete the canonical work and write a redirect loop.
    if (dupe === canonical) { console.error('  ✗ dupe === canonical — skipping (fix MERGES)'); failed++; continue; }
    const { data: dupeWork, error: dupeWorkErr } = await sb.from('works').select('slug').eq('slug', dupe).maybeSingle();
    const { data: alias, error: aliasErr } = await sb.from('aliases').select('alias_slug').eq('alias_slug', dupe).maybeSingle();
    const { data: canonWork, error: canonWorkErr } = await sb.from('works').select('slug').eq('slug', canonical).maybeSingle();
    const { data: canonRating, error: canonRatingErr } = await sb.from('ratings').select('slug').eq('slug', canonical).maybeSingle();
    const { data: dupeRating, error: dupeRatingErr } = await sb.from('ratings').select('slug').eq('slug', dupe).maybeSingle();

    // Check all reads before proceeding with writes
    const readErrors = [dupeWorkErr, aliasErr, canonWorkErr, canonRatingErr, dupeRatingErr]
      .flatMap((e) => (e ? [e] : []));
    if (readErrors.length > 0) {
      console.error(`  ✗ read failed: ${readErrors.map((e) => `${e.code}: ${e.message}`).join('; ')}`);
      failed++;
      continue;
    }

    if (alias && !dupeWork) { console.log('  already merged — skipping'); continue; }
    if (!canonWork) { console.error('  ✗ canonical work missing — skipping (fix MERGES?)'); failed++; continue; }
    if (!canonRating && dupeRating) {
      const { error } = await sb.from('ratings').update({ slug: canonical }).eq('slug', dupe);
      if (error) { console.error('  ✗ rating move failed', error); failed++; continue; }
      console.log('  rating moved to canonical');
    }
    if (dupeWork) {
      const { error } = await sb.from('works').delete().eq('slug', dupe); // cascades to ratings
      if (error) { console.error('  ✗ works delete failed', error); failed++; continue; }
      console.log('  dupe work deleted');
    }
    const { error: aliasUpsertErr } = await sb.from('aliases').upsert({ alias_slug: dupe, canonical_slug: canonical });
    if (aliasUpsertErr) { console.error('  ✗ alias upsert failed', aliasUpsertErr); failed++; continue; }
    console.log('  ✓ alias written');
  }
  console.log(`\n=== merge complete — ${failed} of ${MERGES.length} pair(s) failed ===`);
  if (failed > 0) process.exit(1);
}

const mode = process.argv.includes('--merge') ? merge : scan;
mode()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
