// src/lib/seo.ts
import type { Work, Rating } from './types';

// Apex is the canonical origin (see spec: Vercel primary-domain flip is a manual follow-up).
// Reuse the existing share-base env var so there is one source of truth.
export const SITE_URL = (process.env.NEXT_PUBLIC_SHARE_BASE_URL ?? 'https://isitsmut.com').replace(/\/$/, '');

type KnownRating = Extract<Rating, { known: true }>;

export function buildQuestionAnswer(work: Work, rating: KnownRating): string {
  return `Is ${work.title} smut? ${rating.verdict} It scores ${rating.score}/10 for sexual content.`;
}

import type { Medium } from './types';

const WORK_TYPE: Record<Medium, string> = { book: 'Book', movie: 'Movie', tv: 'TVSeries' };
// schema.org property naming differs per type for the primary creator.
const CREATOR_PROP: Record<Medium, string> = { book: 'author', movie: 'director', tv: 'creator' };

export function buildJsonLd(work: Work, rating: KnownRating): Record<string, unknown> {
  const person = { '@type': 'Person', name: work.creator };
  return {
    '@context': 'https://schema.org',
    '@type': WORK_TYPE[work.medium],
    name: work.title,
    [CREATOR_PROP[work.medium]]: person,
    ...(work.year != null ? { datePublished: String(work.year) } : {}),
    review: {
      '@type': 'Review',
      name: rating.verdict,
      reviewBody: rating.synopsis,
      reviewRating: { '@type': 'Rating', ratingValue: rating.score, bestRating: 10, worstRating: 1 },
      author: { '@type': 'Organization', name: 'IsItSmut' },
    },
  };
}
