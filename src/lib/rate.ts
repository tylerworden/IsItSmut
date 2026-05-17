import { callRate, CLAUDE_MODEL } from './claude';
import { supabaseServer } from './supabase-server';
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
  if (error || !data) return null;
  return data as Rating;
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
  await sb.from('works').upsert(workRow);

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
  await sb.from('ratings').upsert(ratingRow);

  const fresh = await getCachedRating(input.slug);
  if (!fresh) throw new Error('Rating disappeared after upsert');
  return { rating: fresh, cacheHit: false };
}

export async function bumpViewCount(slug: string): Promise<void> {
  const sb = supabaseServer();
  await sb.rpc('increment_view_count', { p_slug: slug });
}
