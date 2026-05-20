// TEMPORARY DEBUG ENDPOINT — remove after diagnosing the
// "Rating disappeared after upsert" bug. Returns no secrets,
// only key/url prefixes and row counts.

import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const TEST_SLUG = 'the-signal-and-the-noise-why-so-many-predictions-failbut-some-dont-silver-2012';

export async function GET() {
  const sb = supabaseServer();

  const keyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const urlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  const test1 = await sb.from('ratings').select('*').eq('slug', TEST_SLUG).maybeSingle();
  const test2 = await sb.from('ratings').select('slug, known, score').eq('slug', TEST_SLUG);
  const test3 = await sb.from('ratings').select('*', { count: 'exact', head: true });
  const test4 = await sb.from('ratings').select('slug').like('slug', 'the-signal%');
  const test5 = await sb.from('ratings').select('slug, score').eq('known', true).not('score', 'is', null).order('score', { ascending: false }).limit(3);

  // test6 reproduces the suspected bug: read-then-write-then-read-same-url
  // within a single request. If dedup is happening, t6_after returns null
  // even though the row exists.
  const dedupSlug = `debug-dedup-test-${Date.now()}`;
  const t6_before = await sb.from('ratings').select('*').eq('slug', dedupSlug).maybeSingle();
  await sb.from('works').upsert({
    slug: dedupSlug, medium: 'book', title: 'debug', creator: 'debug', year: 2026,
  });
  await sb.from('ratings').upsert({
    slug: dedupSlug, known: false, model: 'debug',
  });
  const t6_after = await sb.from('ratings').select('*').eq('slug', dedupSlug).maybeSingle();
  // Cleanup
  await sb.from('ratings').delete().eq('slug', dedupSlug);
  await sb.from('works').delete().eq('slug', dedupSlug);

  return NextResponse.json({
    env: {
      url_prefix: urlRaw.substring(0, 30) + '...',
      key_prefix: keyRaw.substring(0, 15) + '...',
      key_length: keyRaw.length,
    },
    test1_eq_maybeSingle: {
      found: test1.data != null,
      data_slug: test1.data?.slug ?? null,
      error: test1.error,
    },
    test2_eq_array: {
      count: test2.data?.length ?? 0,
      first_slug: test2.data?.[0]?.slug ?? null,
      error: test2.error,
    },
    test3_total_count: {
      count: test3.count,
      error: test3.error,
    },
    test4_like_prefix: {
      slugs: test4.data?.map((r) => r.slug) ?? [],
      error: test4.error,
    },
    test5_leaderboard_top3: {
      slugs: test5.data?.map((r) => ({ slug: r.slug, score: r.score })) ?? [],
      error: test5.error,
    },
    test6_dedup_proof: {
      t6_before_found: t6_before.data != null,
      t6_after_found: t6_after.data != null,
      // If t6_after_found is FALSE, dedup is the bug.
      // If t6_after_found is TRUE, something else is going on.
    },
  });
}
