// scripts/coverage-eval.ts
//
// Read-only: reports the no-score (known=false) rate across all cached ratings.
//
// Usage:
//   NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/coverage-eval.ts

import { supabaseServer } from '../src/lib/supabase-server';

async function main() {
  const sb = supabaseServer();
  const { count: total } = await sb.from('ratings').select('*', { count: 'exact', head: true });
  const { count: known } = await sb.from('ratings').select('*', { count: 'exact', head: true }).eq('known', true);
  const { data: kf, error } = await sb
    .from('ratings')
    .select('slug, works!inner(title, creator, medium, year)')
    .eq('known', false);
  if (error) { console.error('query error', error); process.exit(1); }
  const rows = (kf ?? []) as unknown as { works: { title: string; creator: string; medium: string; year: number | null } }[];
  const pct = total ? ((rows.length / total) * 100).toFixed(1) : '0';
  console.log(`TOTAL: ${total} | known=true: ${known} | known=false: ${rows.length} | no-score rate: ${pct}%`);
  for (const r of rows) console.log(`  [${r.works.medium}] ${r.works.title} — ${r.works.creator} (${r.works.year ?? '?'})`);
}

main().then(() => process.exit(0));
