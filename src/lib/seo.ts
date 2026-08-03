// src/lib/seo.ts
import type { Work, Rating, Medium } from './types';
import type { Metadata } from 'next';

// Apex is the canonical origin (see spec: Vercel primary-domain flip is a manual follow-up).
// Reuse the existing share-base env var so there is one source of truth.
export const SITE_URL = (process.env.NEXT_PUBLIC_SHARE_BASE_URL ?? 'https://isitsmut.com').replace(/\/$/, '');

type KnownRating = Extract<Rating, { known: true }>;

export function buildQuestionAnswer(work: Work, rating: KnownRating): string {
  return `Is ${work.title} smut? ${rating.verdict} Spice level: ${rating.score}/10 for sexual content.`;
}

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

function clamp(s: string, max = 155): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

export function resultMetadata(work: Work, rating: Rating): Metadata {
  const canonical = `/r/${work.slug}`;
  if (!rating.known) {
    return {
      title: `${work.title} — IsItSmut`,
      description: `We don't have a smut rating for ${work.title} yet.`,
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }
  // SERP snippet: full tease — no verdict/score, so the click is the only way
  // to get the answer. Social cards below stay answer-first on purpose:
  // Google ignores OG tags, and a share card wants the verdict visible.
  const title = `Is ${work.title} Smut? Spice Level & Scene Guide — IsItSmut`;
  const description = clamp(
    `Wondering if ${work.title} by ${work.creator} is smut? Get the verdict, the 1–10 spice level, what's actually in it, and who it's OK for — spoiler-free.`
  );
  const socialTitle = `Is "${work.title}" Smut? ${rating.verdict} (${rating.score}/10) — IsItSmut`;
  const socialDescription = clamp(
    `${rating.verdict} ${work.title} by ${work.creator} scores ${rating.score}/10 for sexual content. ${rating.synopsis}`
  );
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title: socialTitle, description: socialDescription, type: 'article', url: canonical },
    twitter: { card: 'summary_large_image', title: socialTitle, description: socialDescription },
  };
}
