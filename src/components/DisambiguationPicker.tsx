'use client';

import type { Candidate } from '@/lib/types';

type Props = {
  candidates: Candidate[];
  onPick: (c: Candidate) => void;
};

const MEDIUM_LABEL: Record<Candidate['medium'], string> = {
  book: 'Book', movie: 'Movie', tv: 'TV',
};

export function DisambiguationPicker({ candidates, onPick }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-center text-sm text-[color:var(--color-ink-muted)]">
        Did you mean…
      </p>
      <ul className="space-y-2">
        {candidates.map((c) => (
          <li key={c.slug}>
            <button
              onClick={() => onPick(c)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-left shadow-sm hover:border-[color:var(--color-brand)]"
            >
              <div className="font-semibold text-[color:var(--color-ink)]">{c.title}</div>
              <div className="text-xs uppercase tracking-wide text-[color:var(--color-ink-quiet)]">
                {MEDIUM_LABEL[c.medium]}
              </div>
              <div className="text-sm text-[color:var(--color-ink-muted)]">
                {c.creator} {c.year ? <span>· <span>{c.year}</span></span> : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
