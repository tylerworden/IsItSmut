import { NextResponse } from 'next/server';
import { signCookieValue, CAPTCHA_COOKIE_NAME } from '@/lib/captcha-cookie';

export const runtime = 'edge';

const ONE_HOUR_MS = 3600_000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { token?: string } | null;
  if (!body?.token) return NextResponse.json({ error: 'missing_token' }, { status: 400 });

  const secret = process.env.HCAPTCHA_SECRET_KEY;
  const cookieSecret = process.env.RATE_LIMIT_SALT;
  if (!secret || !cookieSecret) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  const verifyRes = await fetch('https://api.hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: body.token }),
  });
  const data = await verifyRes.json() as { success: boolean };
  if (!data.success) return NextResponse.json({ error: 'captcha_failed' }, { status: 403 });

  const cookieValue = signCookieValue({ exp: Date.now() + ONE_HOUR_MS }, cookieSecret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CAPTCHA_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  });
  return res;
}
