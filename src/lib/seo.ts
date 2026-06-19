// src/lib/seo.ts
import type { Work, Rating } from './types';

// Apex is the canonical origin (see spec: Vercel primary-domain flip is a manual follow-up).
// Reuse the existing share-base env var so there is one source of truth.
export const SITE_URL = (process.env.NEXT_PUBLIC_SHARE_BASE_URL ?? 'https://isitsmut.com').replace(/\/$/, '');

type KnownRating = Extract<Rating, { known: true }>;

export function buildQuestionAnswer(work: Work, rating: KnownRating): string {
  return `Is ${work.title} smut? ${rating.verdict} It scores ${rating.score}/10 for sexual content.`;
}
