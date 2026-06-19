import { supabaseServer } from './supabase-server';
import { adjustScore, verdictFromScore } from './verdict';
import type { LeaderboardEntry } from './leaderboard';
import type { Medium } from './types';

type Row = {
  slug: string;
  score: number;
  view_count: number;
  works: { title: string; creator: string; medium: Medium; year: number | null };
};

export async function getRelatedTitles(slug: string, medium: Medium, limit: number): Promise<LeaderboardEntry[]> {
  try {
    const sb = supabaseServer();
    const { data, error } = await sb
      .from('ratings')
      .select('slug, score, view_count, works!inner(title, creator, medium, year)')
      .eq('known', true)
      .not('score', 'is', null)
      .eq('works.medium', medium)
      .neq('slug', slug)
      .order('view_count', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as unknown as Row[]).map((r): LeaderboardEntry => {
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
    });
  } catch {
    return [];
  }
}
