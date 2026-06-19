import type { Metadata } from 'next';
import { BrowseList } from '@/components/BrowseList';
import { getRatingsByMedium } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 86400;

export const metadata: Metadata = {
  title: 'The Smuttiest Books, Rated 1–10 — IsItSmut',
  description: 'Browse books by smut rating: which novels are spicy, which are clean, and exactly how explicit each one gets.',
  alternates: { canonical: '/books' },
};

export default async function BooksPage() {
  const entries = await getRatingsByMedium('book', 100);
  return <BrowseList heading="The Smuttiest Books, Rated 1–10" intro="Every book we've rated, hottest first." entries={entries} />;
}
