import { LeaderboardRow } from './LeaderboardRow';
import type { LeaderboardEntry } from '@/lib/leaderboard';

type Props = { heading: string; intro: string; entries: LeaderboardEntry[] };

export function BrowseList({ heading, intro, entries }: Props) {
  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-black tracking-tight text-[color:var(--color-brand)]">{heading}</h1>
        <p className="mt-2 text-sm text-[color:var(--color-ink-muted)]">{intro}</p>
      </header>
      {entries.length === 0 ? (
        <p className="text-center text-sm text-[color:var(--color-ink-muted)]">Nothing here yet — check back soon.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <LeaderboardRow key={entry.slug} rank={i + 1} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
