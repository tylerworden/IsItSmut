// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';

process.env.ANTHROPIC_API_KEY ??= 'test-key';

import { callDisambiguate, callRate } from '@/lib/claude';
import { anthropicSuccessDisambiguate, anthropicSuccessRate } from '../msw/handlers';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('callDisambiguate', () => {
  it('returns parsed candidates from tool_use response', async () => {
    server.use(anthropicSuccessDisambiguate);
    const result = await callDisambiguate('fourth wing');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      title: 'Fourth Wing',
      creator: 'Rebecca Yarros',
      year: 2023,
      medium: 'book',
    });
  });
});

describe('callRate', () => {
  it('returns parsed rating from tool_use response', async () => {
    server.use(anthropicSuccessRate);
    const result = await callRate({
      title: 'Fourth Wing',
      creator: 'Rebecca Yarros',
      year: 2023,
      medium: 'book',
    });
    expect(result).toMatchObject({
      known: true,
      score: 8,
      verdict: "Yes, it's smut.",
      tags: ['Open door', 'Enemies to lovers'],
    });
  });
});

import { http, HttpResponse } from 'msw';

describe('callRate retry behavior', () => {
  it('retries once on 5xx then succeeds', async () => {
    let calls = 0;
    server.use(
      http.post('https://api.anthropic.com/v1/messages', () => {
        calls++;
        if (calls === 1) {
          return HttpResponse.json({ type: 'error', error: { message: 'overloaded' } }, { status: 529 });
        }
        return HttpResponse.json({
          id: 'msg', type: 'message', role: 'assistant', model: 'claude-haiku-4-5-20251001',
          content: [{ type: 'tool_use', id: 't', name: 'submit_rating', input: { known: false } }],
          stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 },
        });
      })
    );
    const result = await callRate({ title: 'X', creator: 'Y', year: 2020, medium: 'book' });
    expect(calls).toBe(2);
    expect(result).toEqual({ known: false });
  });

  it('throws after second consecutive 5xx', async () => {
    server.use(http.post('https://api.anthropic.com/v1/messages', () =>
      HttpResponse.json({ type: 'error', error: { message: 'overloaded' } }, { status: 529 })
    ));
    await expect(callRate({ title: 'X', creator: 'Y', year: 2020, medium: 'book' })).rejects.toThrow();
  });
});
