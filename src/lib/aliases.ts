import { supabaseServer } from './supabase-server';

// Maps a merged-away slug to its canonical replacement.
// Rows are written by scripts/merge-duplicates.ts.
export async function getCanonicalSlug(aliasSlug: string): Promise<string | null> {
  const sb = supabaseServer();
  const { data } = await sb
    .from('aliases')
    .select('canonical_slug')
    .eq('alias_slug', aliasSlug)
    .maybeSingle();
  return (data as { canonical_slug: string } | null)?.canonical_slug ?? null;
}
