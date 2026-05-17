// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { POST } from '@/app/api/captcha-verify/route';

const server = setupServer();
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  process.env.HCAPTCHA_SECRET_KEY = 'test-secret';
  process.env.RATE_LIMIT_SALT = 'test-salt';
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('POST /api/captcha-verify', () => {
  it('sets cookie on successful verification', async () => {
    server.use(http.post('https://api.hcaptcha.com/siteverify', () =>
      HttpResponse.json({ success: true })
    ));
    const req = new Request('http://localhost/api/captcha-verify', {
      method: 'POST',
      body: JSON.stringify({ token: 'ok-token' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('iisc=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('returns 403 when hCaptcha rejects', async () => {
    server.use(http.post('https://api.hcaptcha.com/siteverify', () =>
      HttpResponse.json({ success: false, 'error-codes': ['invalid-input-response'] })
    ));
    const req = new Request('http://localhost/api/captcha-verify', {
      method: 'POST',
      body: JSON.stringify({ token: 'bad' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
