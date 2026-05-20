import { Hero } from '@/components/Hero';
import { SearchExperience } from '@/components/SearchExperience';
import { LeaderboardSection } from '@/components/LeaderboardSection';
import { getTopRatings } from '@/lib/leaderboard';

export const runtime = 'nodejs';
export const revalidate = 60;

export default async function HomePage() {
  const top = await getTopRatings(3);

  return (
    <div className="space-y-8">
      <Hero />
      <SearchExperience />
      <LeaderboardSection
        entries={top}
        heading="🔥 Hottest of all time"
        seeMoreHref="/top"
      />
    </div>
  );
}
