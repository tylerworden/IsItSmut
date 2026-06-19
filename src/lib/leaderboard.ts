import { supabaseServer } from './supabase-server';
import { adjustScore, verdictFromScore } from './verdict';
import type { Medium } from './types';

export type LeaderboardEntry = {
  slug: string;
  title: string;
  creator: string;
  medium: Medium;
  year: number | null;
  score: number;     // adjusted (post-adjustScore)
  verdict: string;
  viewCount: number;
};

type Row = {
  slug: string;
  score: number;
  view_count: number;
  works: {
    title: string;
    creator: string;
    medium: Medium;
    year: number | null;
  };
};

type Order = 'smuttiest' | 'tamest';

async function queryRatings(opts: { medium?: Medium; order: Order; limit: number }): Promise<LeaderboardEntry[]> {
  try {
    const sb = supabaseServer();
    let q = sb
      .from('ratings')
      .select('slug, score, view_count, works!inner(title, creator, medium, year)')
      .eq('known', true)
      .not('score', 'is', null);

    if (opts.medium) q = q.eq('works.medium', opts.medium);

    const ascending = opts.order === 'tamest';
    const { data, error } = await q
      .order('score', { ascending })
      .order('view_count', { ascending: false })
      .order('slug', { ascending: true })
      .limit(opts.limit);

    if (error) {
      console.error('leaderboard query error:', error);
      return [];
    }
    if (!data) return [];

    const rows = data as unknown as Row[];
    const dir = opts.order === 'tamest' ? 1 : -1;
    return rows
      .map((r): LeaderboardEntry => {
        const adjusted = adjustScore(r.score);
        return {
          slug: r.slug,
          title: r.works.title,
          creator: r.works.creator,
          medium: r.works.medium,
          year: r.works.year,
          score: adjusted,
          verdict: verdictFromScore(adjusted),
          viewCount: r.view_count,
        };
      })
      .sort((a, b) => {
        if (a.score !== b.score) return (a.score - b.score) * dir;
        if (a.viewCount !== b.viewCount) return b.viewCount - a.viewCount;
        return a.slug.localeCompare(b.slug);
      });
  } catch (err) {
    console.error('leaderboard exception:', err);
    return [];
  }
}

export async function getTopRatings(limit: number): Promise<LeaderboardEntry[]> {
  return queryRatings({ order: 'smuttiest', limit });
}

export async function getRatingsByMedium(medium: Medium, limit: number): Promise<LeaderboardEntry[]> {
  return queryRatings({ medium, order: 'smuttiest', limit });
}

export async function getTamestRatings(limit: number): Promise<LeaderboardEntry[]> {
  return queryRatings({ order: 'tamest', limit });
}
