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

export async function getTopRatings(limit: number): Promise<LeaderboardEntry[]> {
  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from('ratings')
      .select('slug, score, view_count, works!inner(title, creator, medium, year)')
      .eq('known', true)
      .not('score', 'is', null)
      .order('score', { ascending: false })
      .order('view_count', { ascending: false })
      .order('slug', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('leaderboard query error:', error);
      return [];
    }
    if (!data) return [];

    const rows = data as unknown as Row[];
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
        if (a.score !== b.score) return b.score - a.score;
        if (a.viewCount !== b.viewCount) return b.viewCount - a.viewCount;
        return a.slug.localeCompare(b.slug);
      });
  } catch (err) {
    console.error('leaderboard exception:', err);
    return [];
  }
}
