import { callRate, CLAUDE_MODEL } from './claude';
import { supabaseServer } from './supabase-server';
import { adjustScore, verdictFromScore } from './verdict';
import type { Rating, Medium } from './types';

export type RunRateInput = {
  slug: string;
  candidate: { title: string; creator: string; year: number | null; medium: Medium };
};

export type RunRateResult = { rating: Rating; cacheHit: boolean };

export async function getCachedRating(slug: string): Promise<Rating | null> {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('ratings')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.error('getCachedRating query error', { slug, error });
    return null;
  }
  if (!data) return null;
  const row = data as Rating;
  if (row.known) {
    const adjusted = adjustScore(row.score);
    return { ...row, score: adjusted, verdict: verdictFromScore(adjusted) };
  }
  return row;
}

export async function runRate(input: RunRateInput): Promise<RunRateResult> {
  const cached = await getCachedRating(input.slug);
  if (cached) return { rating: cached, cacheHit: true };

  const raw = await callRate(input.candidate);
  const sb = supabaseServer();

  const workRow = {
    slug: input.slug,
    medium: input.candidate.medium,
    title: input.candidate.title,
    creator: input.candidate.creator,
    year: input.candidate.year,
  };
  const worksRes = await sb.from('works').upsert(workRow);
  if (worksRes.error) {
    console.error('works upsert failed', { slug: input.slug, error: worksRes.error });
    throw new Error(`works upsert failed: ${worksRes.error.message ?? 'unknown'} (code=${worksRes.error.code ?? 'unknown'})`);
  }

  const ratingRow: Record<string, unknown> = raw.known
    ? {
        slug: input.slug,
        known: true,
        score: raw.score,
        verdict: raw.verdict,
        synopsis: raw.synopsis,
        details: raw.details,
        tags: raw.tags,
        model: CLAUDE_MODEL,
      }
    : {
        slug: input.slug,
        known: false,
        model: CLAUDE_MODEL,
      };
  const ratingsRes = await sb.from('ratings').upsert(ratingRow);
  if (ratingsRes.error) {
    console.error('ratings upsert failed', { slug: input.slug, error: ratingsRes.error });
    throw new Error(`ratings upsert failed: ${ratingsRes.error.message ?? 'unknown'} (code=${ratingsRes.error.code ?? 'unknown'})`);
  }

  const now = new Date().toISOString();
  let rating: Rating;
  if (raw.known) {
    const adjusted = adjustScore(raw.score);
    rating = {
      slug: input.slug,
      known: true,
      score: adjusted,
      verdict: verdictFromScore(adjusted),
      synopsis: raw.synopsis,
      details: raw.details,
      tags: raw.tags,
      model: CLAUDE_MODEL,
      rated_at: now,
      view_count: 0,
    };
  } else {
    rating = {
      slug: input.slug,
      known: false,
      model: CLAUDE_MODEL,
      rated_at: now,
      view_count: 0,
    };
  }
  return { rating, cacheHit: false };
}

export async function bumpViewCount(slug: string): Promise<void> {
  const sb = supabaseServer();
  await sb.rpc('increment_view_count', { p_slug: slug });
}
