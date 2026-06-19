import type { Metadata } from 'next';
import { BrowseList } from '@/components/BrowseList';
import { getRatingsByMedium } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'The Smuttiest TV Shows, Rated 1–10 — IsItSmut',
  description: 'Browse TV shows by smut rating: how explicit each series gets, ranked hottest first.',
  alternates: { canonical: '/tv' },
};

export default async function TvPage() {
  const entries = await getRatingsByMedium('tv', 100);
  return <BrowseList heading="The Smuttiest TV Shows, Rated 1–10" intro="Every show we've rated, hottest first." entries={entries} />;
}
