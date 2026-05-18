import { ImageResponse } from 'next/og';
import { supabaseServer } from '@/lib/supabase-server';
import { getCachedRating } from '@/lib/rate';

export const runtime = 'nodejs';
export const alt = 'IsItSmut rating';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = supabaseServer();
  const [workRes, rating] = await Promise.all([
    sb.from('works').select('*').eq('slug', slug).maybeSingle(),
    getCachedRating(slug),
  ]);
  const work = workRes.data;

  const known = rating?.known === true;
  const score: string | number = known ? rating.score : '—';
  const verdict = known ? rating.verdict : 'No reliable read';
  const synopsis = known ? (rating.synopsis as string) : '';
  const title = work?.title ?? 'Unknown';
  const meta = work
    ? `${work.creator}${work.year ? ` · ${work.year}` : ''} · ${String(work.medium).toUpperCase()}`
    : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', background: '#fff5ee',
          display: 'flex', flexDirection: 'column', padding: 64,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700, color: '#d4506b' }}>IsItSmut.com</div>
        <div style={{ marginTop: 16, fontSize: 56, fontWeight: 800, color: '#2b1e22' }}>{title}</div>
        <div style={{ marginTop: 6, fontSize: 24, color: '#7a5a5a' }}>{meta}</div>

        <div
          style={{
            marginTop: 36, background: 'linear-gradient(135deg, #d4506b, #ff8fa3)',
            color: '#fff', borderRadius: 24, padding: '24px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 18, letterSpacing: 4, opacity: 0.9 }}>SMUT RATING</div>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 120, fontWeight: 900, lineHeight: 1 }}>
            <span>{score}</span>
            <span style={{ fontSize: 56, opacity: 0.8 }}>/10</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{verdict}</div>
        </div>

        {synopsis ? (
          <div style={{ marginTop: 24, fontSize: 22, color: '#4a3b3f', overflow: 'hidden', maxHeight: 64 }}>
            {synopsis}
          </div>
        ) : null}

        <div style={{ marginTop: 'auto', fontSize: 18, color: '#a87b85', fontStyle: 'italic' }}>
          Details hidden — tap to see what&apos;s in it
        </div>
      </div>
    ),
    { ...size }
  );
}
