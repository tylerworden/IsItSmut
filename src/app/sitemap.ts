// src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { buildSitemapEntries, getRatedPages } from '@/lib/sitemap';
import { SITE_URL } from '@/lib/seo';

export const runtime = 'nodejs';
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rated = await getRatedPages();
  return buildSitemapEntries(rated, SITE_URL);
}
