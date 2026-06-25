import { SpoilerReveal } from './SpoilerReveal';
import { ShareButton } from './ShareButton';
import { TrackOnMount } from './TrackOnMount';
import { buildQuestionAnswer } from '@/lib/seo';
import type { Work, Rating, Medium } from '@/lib/types';

const MEDIUM_LABEL: Record<Medium, string> = { book: 'Book', movie: 'Movie', tv: 'TV' };

type Props = {
  work: Work;
  rating: Rating;
  shareUrl: string;
};

const SUGGEST_URL = 'mailto:tworden1993@gmail.com?subject=IsItSmut%20rating%20suggestion';

export function ResultCard({ work, rating, shareUrl }: Props) {
  if (!rating.known) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-[0_6px_18px_rgba(212,80,107,0.10)]">
        <TrackOnMount
          event="no_score_shown"
          properties={{ slug: work.slug, title: work.title, medium: work.medium }}
        />
        <h1 className="text-xl font-bold text-[color:var(--color-ink)]">{work.title}</h1>
        <p className="mt-1 text-xs text-[color:var(--color-ink-quiet)]">
          {work.creator} · {work.year ?? '—'} · {MEDIUM_LABEL[work.medium]}
        </p>
        <p className="mt-4 text-sm text-[color:var(--color-ink-muted)]">
          We don&apos;t have a reliable read on this one yet.
        </p>
        <a
          href={SUGGEST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-[color:var(--color-brand)]"
        >
          Suggest a rating →
        </a>
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-[0_6px_18px_rgba(212,80,107,0.10)]">
      <header className="bg-gradient-to-br from-[color:var(--color-brand)] to-[color:var(--color-brand-soft)] px-6 py-6 text-center text-white">
        <div className="text-[11px] uppercase tracking-widest opacity-90">Smut Rating</div>
        <div className="mt-1 text-5xl font-black leading-none">
          {rating.score}<span className="text-2xl opacity-80">/10</span>
        </div>
        <div className="mt-2 text-sm font-semibold">{rating.verdict}</div>
      </header>
      <div className="space-y-3 p-5">
        <div>
          <h1 className="text-lg font-bold text-[color:var(--color-ink)]">{work.title}</h1>
          <p className="text-xs text-[color:var(--color-ink-quiet)]">
            {work.creator} · {work.year ?? '—'} · {MEDIUM_LABEL[work.medium]}
          </p>
        </div>
        <p className="text-sm font-semibold text-[color:var(--color-ink)]">
          {buildQuestionAnswer(work, rating)}
        </p>
        <p className="text-sm leading-relaxed text-[color:var(--color-ink)]">{rating.synopsis}</p>
        {rating.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {rating.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[color:var(--color-accent)] px-2.5 py-0.5 text-[11px] text-[color:#8b3a4f]">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="border-t border-[color:var(--color-border)] pt-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-ink-quiet)]">
            What&apos;s in it 🔒
          </div>
          <SpoilerReveal slug={work.slug} medium={work.medium} score={rating.score}>
            {rating.details}
          </SpoilerReveal>
        </div>
        <div className="flex justify-end pt-1">
          <ShareButton url={shareUrl} title={work.title} slug={work.slug} />
        </div>
      </div>
    </article>
  );
}
