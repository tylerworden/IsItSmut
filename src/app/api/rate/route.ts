import { NextResponse } from 'next/server';
import { getCanonicalSlug } from '@/lib/aliases';
import { getCachedRating, runRate } from '@/lib/rate';
import { checkAndIncrement } from '@/lib/rate-limit';
import { hashIp } from '@/lib/hash';
import { verifyCookieValue, CAPTCHA_COOKIE_NAME } from '@/lib/captcha-cookie';

export const runtime = 'nodejs';

const HOURLY_LIMIT = 20;

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '0.0.0.0';
}

function getCaptchaCookie(req: Request): string | null {
  const cookie = req.headers.get('cookie') ?? '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${CAPTCHA_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function POST(req: Request) {
  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt) return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });

  const body = await req.json().catch(() => null) as {
    slug?: string;
    candidate?: { title: string; creator: string; year: number | null; medium: 'book' | 'movie' | 'tv' };
  } | null;

  if (!body?.slug || !body?.candidate?.title) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  // A merged-away slug must not be resurrected via upsert — serve its canonical.
  const slug = (await getCanonicalSlug(body.slug)) ?? body.slug;

  // Cache-first: bypasses rate limit entirely.
  const cached = await getCachedRating(slug);
  if (cached) {
    return NextResponse.json({ rating: cached, cacheHit: true });
  }

  // Cache miss → enforce rate limit (with captcha bypass).
  const cookieValue = getCaptchaCookie(req);
  const bypassed = cookieValue ? verifyCookieValue(cookieValue, salt) != null : false;
  if (!bypassed) {
    const ipHash = hashIp(getClientIp(req), salt);
    const check = await checkAndIncrement({ ipHash, limit: HOURLY_LIMIT });
    if (!check.allowed) {
      return NextResponse.json({ needs_captcha: true }, { status: 429 });
    }
  }

  try {
    const result = await runRate({ slug, candidate: body.candidate });
    return NextResponse.json(result);
  } catch (err) {
    console.error('rate error', err);
    return NextResponse.json({ error: 'ai_failed' }, { status: 503 });
  }
}
