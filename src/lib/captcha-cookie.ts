import { createHmac, timingSafeEqual } from 'node:crypto';

export const CAPTCHA_COOKIE_NAME = 'iisc';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signCookieValue(payload: { exp: number }, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function verifyCookieValue(
  value: string,
  secret: string
): { exp: number } | null {
  const [body, sig] = value.split('.');
  if (!body || !sig) return null;
  const expected = sign(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
