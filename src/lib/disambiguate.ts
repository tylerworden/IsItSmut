import { callDisambiguate } from './claude';
import { slugify, slugifyWithCollisionCheck } from './slug';
import { supabaseServer } from './supabase-server';
import type { Candidate, Medium } from './types';

type CandidateInput = { title: string; creator: string; year: number | null; medium: Medium };

// A stored work is "the same work" as a candidate when the title+creator slug
// parts and the medium match. Year and creator-formatting wobble from the AI
// is tolerated so we reuse the existing page instead of minting a duplicate
// (the fifty-shades-…-4f3e / ACOSF-2020-vs-2021 classes from the GSC report).
async function findExistingWorkSlug(c: CandidateInput): Promise<string | null> {
  const sb = supabaseServer();
  const prefix = slugify({ title: c.title, creator: c.creator, year: null });
  const { data } = await sb.from('works').select('slug, medium').like('slug', `${prefix}%`);
  // prefix is kebab-case [a-z0-9-], so it is regex-safe without escaping.
  const sameWork = new RegExp(`^${prefix}(-\\d{4})?(-[0-9a-f]{4})?$`);
  const match = ((data ?? []) as Array<{ slug: string; medium: string }>).find(
    (w) => w.medium === c.medium && sameWork.test(w.slug)
  );
  return match?.slug ?? null;
}

export async function runDisambiguate(query: string): Promise<{ candidates: Candidate[] }> {
  const raw = await callDisambiguate(query);
  const sb = supabaseServer();

  const candidates: Candidate[] = [];
  for (const c of raw.candidates) {
    const existing = await findExistingWorkSlug(c);
    if (existing) {
      candidates.push({ ...c, slug: existing });
      continue;
    }
    // Same slug + same medium was handled above, so a collision here means a
    // genuinely different work (different medium) happens to share the slug.
    const existsForOther = async (slug: string): Promise<boolean> => {
      const { data } = await sb.from('works').select('medium').eq('slug', slug).maybeSingle();
      if (!data) return false;
      return (data as { medium: string }).medium !== c.medium;
    };
    const slug = await slugifyWithCollisionCheck(
      { title: c.title, creator: c.creator, year: c.year },
      existsForOther
    );
    candidates.push({ slug, ...c });
  }
  return { candidates };
}
