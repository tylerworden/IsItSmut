import { describe, it, expect } from 'vitest';
import { signCookieValue, verifyCookieValue } from '@/lib/captcha-cookie';

describe('captcha-cookie', () => {
  const secret = 'test-secret';

  it('round-trips a valid cookie', () => {
    const value = signCookieValue({ exp: Date.now() + 3600_000 }, secret);
    expect(verifyCookieValue(value, secret)).not.toBeNull();
  });

  it('rejects tampered cookie', () => {
    const value = signCookieValue({ exp: Date.now() + 3600_000 }, secret);
    expect(verifyCookieValue(value + 'x', secret)).toBeNull();
  });

  it('rejects expired cookie', () => {
    const value = signCookieValue({ exp: Date.now() - 1000 }, secret);
    expect(verifyCookieValue(value, secret)).toBeNull();
  });

  it('rejects cookie signed with wrong secret', () => {
    const value = signCookieValue({ exp: Date.now() + 3600_000 }, 'other-secret');
    expect(verifyCookieValue(value, secret)).toBeNull();
  });
});
