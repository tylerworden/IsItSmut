import { NextResponse } from 'next/server';
import { runDisambiguate } from '@/lib/disambiguate';
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

  const body = await req.json().catch(() => null) as { query?: string } | null;
  if (!body?.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
    return NextResponse.json({ error: 'missing_query' }, { status: 400 });
  }

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
    const result = await runDisambiguate(body.query.trim());
    return NextResponse.json(result);
  } catch (err) {
    console.error('disambiguate error', err);
    return NextResponse.json({ error: 'ai_failed' }, { status: 503 });
  }
}
