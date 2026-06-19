import type { Metadata } from 'next';
import { BrowseList } from '@/components/BrowseList';
import { getTamestRatings } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'The Tamest, Cleanest Books, Movies & Shows — IsItSmut',
  description: 'Looking for something clean? The lowest-rated, least-spicy titles we have, ranked tamest first.',
  alternates: { canonical: '/tamest' },
};

export default async function TamestPage() {
  const entries = await getTamestRatings(100);
  return <BrowseList heading="The Tamest Picks" intro="The cleanest, least-spicy titles we've rated." entries={entries} />;
}
