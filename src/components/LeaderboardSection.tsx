import Link from 'next/link';
import { LeaderboardRow } from './LeaderboardRow';
import type { LeaderboardEntry } from '@/lib/leaderboard';

type Props = {
  entries: LeaderboardEntry[];
  heading?: string;
  seeMoreHref?: string;
};

export function LeaderboardSection({ entries, heading, seeMoreHref }: Props) {
  return (
    <section className="space-y-2">
      {heading && (
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand)]">
          {heading}
        </h2>
      )}
      {entries.length === 0 ? (
        <p className="text-center text-sm text-[color:var(--color-ink-muted)]">
          Loading the leaderboard… check back in a moment.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <LeaderboardRow key={entry.slug} rank={i + 1} entry={entry} />
          ))}
        </div>
      )}
      {seeMoreHref && entries.length > 0 && (
        <div className="pt-1 text-right">
          <Link
            href={seeMoreHref}
            className="text-xs font-bold text-[color:var(--color-brand)] hover:underline"
          >
            See full top 10 →
          </Link>
        </div>
      )}
    </section>
  );
}
