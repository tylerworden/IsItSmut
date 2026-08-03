import { supabaseServer } from './supabase-server';

// Maps a merged-away slug to its canonical replacement.
// Rows are written by scripts/merge-duplicates.ts.
export async function getCanonicalSlug(aliasSlug: string): Promise<string | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('aliases')
    .select('canonical_slug')
    .eq('alias_slug', aliasSlug)
    .maybeSingle();
  // Degrade to "not an alias" on failure (e.g. migration not applied yet),
  // but leave a trace — a silent failure here looks like redirects vanishing.
  if (error) console.error('aliases lookup failed', error);
  return (data as { canonical_slug: string } | null)?.canonical_slug ?? null;
}
