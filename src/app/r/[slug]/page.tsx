import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase-server';
import { getCachedRating, runRate, bumpViewCount } from '@/lib/rate';
import { ResultCard } from '@/components/ResultCard';
import { JsonLd } from '@/components/JsonLd';
import { resultMetadata, buildJsonLd } from '@/lib/seo';
import { RelatedTitles } from '@/components/RelatedTitles';
import { getRelatedTitles } from '@/lib/related';
import type { Work, Medium } from '@/lib/types';

export const runtime = 'nodejs';

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ title?: string; creator?: string; year?: string; medium?: string }>;
};

async function fetchWork(slug: string): Promise<Work | null> {
  const sb = supabaseServer();
  const { data } = await sb.from('works').select('*').eq('slug', slug).maybeSingle();
  return data as Work | null;
}

export default async function ResultPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const search = await searchParams;

  let work = await fetchWork(slug);
  let rating = await getCachedRating(slug);

  if (!work && (!search.title || !search.creator || !search.medium)) {
    notFound();
  }

  if (!rating) {
    if (!search.title || !search.creator || !search.medium) notFound();
    const candidate = {
      title: search.title,
      creator: search.creator,
      year: search.year ? parseInt(search.year, 10) : null,
      medium: search.medium as Medium,
    };
    const result = await runRate({ slug, candidate });
    rating = result.rating;
    work = work ?? { slug, ...candidate };
  }

  if (!work) notFound();

  bumpViewCount(slug).catch(() => {});

  const base = process.env.NEXT_PUBLIC_SHARE_BASE_URL ?? 'http://localhost:3000';
  const shareUrl = `${base}/r/${slug}`;

  const related = rating.known ? await getRelatedTitles(slug, work.medium, 4) : [];

  return (
    <>
      {rating.known && <JsonLd data={buildJsonLd(work, rating)} />}
      <ResultCard work={work} rating={rating} shareUrl={shareUrl} />
      {rating.known && <RelatedTitles entries={related} medium={work.medium} />}
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const work = await fetchWork(slug);
  if (!work) {
    return { title: 'Not found — IsItSmut', robots: { index: false, follow: true } };
  }
  const rating = await getCachedRating(slug);
  // No cached rating yet (page reached via search params): treat as unknown for indexing.
  return resultMetadata(work, rating ?? { slug, known: false, model: '', rated_at: '', view_count: 0 });
}
