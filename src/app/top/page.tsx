import type { Metadata } from 'next';
import { LeaderboardSection } from '@/components/LeaderboardSection';
import { AdSlot } from '@/components/AdSlot';
import { getTopRatings } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Top 10 Hottest — IsItSmut',
  description: "The smuttiest books, movies, and shows we've rated.",
};

export default async function TopPage() {
  const top = await getTopRatings(10);

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-[color:var(--color-brand)]">
          Top 10 Hottest
        </h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">
          The smuttiest books, movies, and shows we&apos;ve rated.
        </p>
      </header>
      <LeaderboardSection entries={top} />
      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HUB} className="mt-8" />
    </div>
  );
}
