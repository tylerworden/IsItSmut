import { callDisambiguate } from './claude';
import { slugifyWithCollisionCheck } from './slug';
import { supabaseServer } from './supabase-server';
import type { Candidate } from './types';

export async function runDisambiguate(query: string): Promise<{ candidates: Candidate[] }> {
  const raw = await callDisambiguate(query);
  const sb = supabaseServer();

  const candidates: Candidate[] = [];
  for (const c of raw.candidates) {
    const existsForOther = async (slug: string): Promise<boolean> => {
      const { data } = await sb
        .from('works')
        .select('title, creator, year')
        .eq('slug', slug)
        .maybeSingle();
      if (!data) return false;
      return data.title !== c.title || data.creator !== c.creator || data.year !== c.year;
    };
    const slug = await slugifyWithCollisionCheck(
      { title: c.title, creator: c.creator, year: c.year },
      existsForOther
    );
    candidates.push({ slug, ...c });
  }
  return { candidates };
}
