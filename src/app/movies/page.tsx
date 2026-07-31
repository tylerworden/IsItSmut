import type { Metadata } from 'next';
import { BrowseList } from '@/components/BrowseList';
import { AdSlot } from '@/components/AdSlot';
import { getRatingsByMedium } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'The Smuttiest Movies, Rated 1–10 — IsItSmut',
  description: 'Browse movies by smut rating: how explicit each film gets, ranked hottest first.',
  alternates: { canonical: '/movies' },
};

export default async function MoviesPage() {
  const entries = await getRatingsByMedium('movie', 100);
  return (
    <>
      <BrowseList heading="The Smuttiest Movies, Rated 1–10" intro="Every movie we've rated, hottest first." entries={entries} />
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HUB} className="mt-8" />
    </>
  );
}
