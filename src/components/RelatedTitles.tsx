// src/components/RelatedTitles.tsx
import Link from 'next/link';
import type { LeaderboardEntry } from '@/lib/leaderboard';
import type { Medium } from '@/lib/types';

const HUB_PATH: Record<Medium, string> = { book: '/books', movie: '/movies', tv: '/tv' };
const HUB_LABEL: Record<Medium, string> = { book: 'More books', movie: 'More movies', tv: 'More TV' };

export function RelatedTitles({ entries, medium }: { entries: LeaderboardEntry[]; medium: Medium }) {
  if (entries.length === 0) return null;
  return (
    <section className="mt-8 space-y-2">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--color-brand)]">
        More like this
      </h2>
      <div className="space-y-2">
        {entries.map((entry) => (
          <Link
            key={entry.slug}
            href={`/r/${entry.slug}`}
            className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--color-surface-card)] px-3 py-2 text-sm hover:bg-[color:var(--color-accent)]"
          >
            <span className="truncate font-semibold text-[color:var(--color-ink)]">{entry.title}</span>
            <span className="shrink-0 rounded-full bg-[color:var(--color-brand)] px-2 py-0.5 text-[11px] font-bold text-white">
              {entry.score}/10
            </span>
          </Link>
        ))}
      </div>
      <div className="pt-1 text-right">
        <Link href={HUB_PATH[medium]} className="text-xs font-bold text-[color:var(--color-brand)] hover:underline">
          {HUB_LABEL[medium]} →
        </Link>
      </div>
    </section>
  );
}
