import type { MetadataRoute } from 'next';
import { supabaseServer } from './supabase-server';

// Static + hub routes. Keep in sync with the hub pages created in Group D.
export const STATIC_PATHS = ['/', '/top', '/books', '/movies', '/tv', '/tamest', '/about', '/privacy', '/terms'] as const;

export type RatedPage = { slug: string; rated_at: string };

export function buildSitemapEntries(rated: RatedPage[], baseUrl: string): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((p) => ({ url: `${baseUrl}${p}` }));
  const ratedEntries: MetadataRoute.Sitemap = rated.map((r) => ({
    url: `${baseUrl}/r/${r.slug}`,
    lastModified: new Date(r.rated_at),
  }));
  return [...staticEntries, ...ratedEntries];
}

export async function getRatedPages(): Promise<RatedPage[]> {
  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from('ratings')
      .select('slug, rated_at')
      .eq('known', true)
      .order('rated_at', { ascending: false });
    if (error || !data) return [];
    return data as RatedPage[];
  } catch {
    return [];
  }
}
