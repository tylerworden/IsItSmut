import Link from 'next/link';
import type { LeaderboardEntry } from '@/lib/leaderboard';
import type { Medium } from '@/lib/types';

const MEDIUM_LABEL: Record<Medium, string> = { book: 'Book', movie: 'Movie', tv: 'TV' };

type Props = {
  rank: number;
  entry: LeaderboardEntry;
};

export function LeaderboardRow({ rank, entry }: Props) {
  const meta = [entry.creator, entry.year, MEDIUM_LABEL[entry.medium]]
    .filter((v) => v != null && v !== '')
    .join(' · ');
  return (
    <Link
      href={`/r/${entry.slug}`}
      className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-[color:var(--color-accent)] to-[color:var(--color-surface-card)] px-3 py-2.5 transition hover:from-[color:var(--color-accent)] hover:to-[color:var(--color-accent)]"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--color-brand)] to-[color:var(--color-brand-soft)] text-xs font-extrabold text-white">
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-[color:var(--color-ink)]">{entry.title}</div>
        <div className="truncate text-[11px] text-[color:var(--color-ink-quiet)]">{meta}</div>
      </div>
      <div className="shrink-0 rounded-full bg-[color:var(--color-brand)] px-2.5 py-1 text-[11px] font-bold text-white">
        {entry.score}/10
      </div>
    </Link>
  );
}
