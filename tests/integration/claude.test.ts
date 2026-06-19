// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

process.env.ANTHROPIC_API_KEY ??= 'test-key';

import { callDisambiguate, callRate } from '@/lib/claude';
import { anthropicSuccessDisambiguate, anthropicSuccessRate } from '../msw/handlers';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const HAIKU = 'claude-haiku-4-5-20251001';
const SONNET = 'claude-sonnet-4-6';

// Build a tool_use response envelope for the given tool + input.
function toolUse(name: string, input: unknown, model = HAIKU) {
  return HttpResponse.json({
    id: 'msg', type: 'message', role: 'assistant', model,
    content: [{ type: 'tool_use', id: 't', name, input }],
    stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 },
  });
}

describe('callDisambiguate', () => {
  it('returns parsed candidates from tool_use response', async () => {
    server.use(anthropicSuccessDisambiguate);
    const result = await callDisambiguate('fourth wing');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' });
  });

  it('escalates to Sonnet when Haiku returns no candidates', async () => {
    const models: string[] = [];
    server.use(http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
      const body = (await request.json()) as { model: string };
      models.push(body.model);
      if (body.model === HAIKU) return toolUse('submit_candidates', { candidates: [] });
      return toolUse('submit_candidates', { candidates: [{ title: 'Real Book', creator: 'Real Author', year: 2020, medium: 'book' }] }, SONNET);
    }));
    const result = await callDisambiguate('something obscure');
    expect(models).toEqual([HAIKU, SONNET]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].title).toBe('Real Book');
  });

  it('does NOT escalate when Haiku already returns candidates', async () => {
    const models: string[] = [];
    server.use(http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
      const body = (await request.json()) as { model: string };
      models.push(body.model);
      return toolUse('submit_candidates', { candidates: [{ title: 'A', creator: 'B', year: 2020, medium: 'book' }] });
    }));
    await callDisambiguate('fourth wing');
    expect(models).toEqual([HAIKU]);
  });

  it('falls back to Haiku empty list when Sonnet escalation errors', async () => {
    server.use(http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
      const body = (await request.json()) as { model: string };
      if (body.model === HAIKU) return toolUse('submit_candidates', { candidates: [] });
      return HttpResponse.json({ type: 'error', error: { message: 'boom' } }, { status: 529 });
    }));
    const result = await callDisambiguate('x');
    expect(result.candidates).toEqual([]);
  });
});

describe('callRate', () => {
  it('returns parsed rating (in .raw) and the producing model', async () => {
    server.use(anthropicSuccessRate);
    const result = await callRate({ title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' });
    expect(result.raw).toMatchObject({ known: true, score: 8, verdict: "Yes, it's smut." });
    expect(result.model).toBe(HAIKU);
  });

  it('escalates to Sonnet on known:false and reports the Sonnet model', async () => {
    const models: string[] = [];
    server.use(http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
      const body = (await request.json()) as { model: string };
      models.push(body.model);
      if (body.model === HAIKU) return toolUse('submit_rating', { known: false });
      return toolUse('submit_rating', { known: true, score: 5, verdict: 'A little spicy.', synopsis: 's', details: 'd', tags: ['x', 'y'] }, SONNET);
    }));
    const result = await callRate({ title: 'Normal People', creator: 'Sally Rooney', year: 2020, medium: 'tv' });
    expect(models).toEqual([HAIKU, SONNET]);
    expect(result.raw).toMatchObject({ known: true, score: 5 });
    expect(result.model).toBe(SONNET);
  });

  it('reports Sonnet model when both models return known:false', async () => {
    server.use(http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
      const body = (await request.json()) as { model: string };
      return toolUse('submit_rating', { known: false }, body.model);
    }));
    const result = await callRate({ title: 'Z', creator: 'Q', year: 2024, medium: 'book' });
    expect(result.raw).toEqual({ known: false });
    expect(result.model).toBe(SONNET);
  });

  it('falls back to Haiku known:false when Sonnet escalation errors', async () => {
    server.use(http.post('https://api.anthropic.com/v1/messages', async ({ request }) => {
      const body = (await request.json()) as { model: string };
      if (body.model === HAIKU) return toolUse('submit_rating', { known: false });
      return HttpResponse.json({ type: 'error', error: { message: 'boom' } }, { status: 529 });
    }));
    const result = await callRate({ title: 'Z', creator: 'Q', year: 2024, medium: 'book' });
    expect(result.raw).toEqual({ known: false });
    expect(result.model).toBe(HAIKU);
  });
});

describe('callRate retry behavior', () => {
  it('retries once on 5xx then succeeds (no escalation on known:true)', async () => {
    let calls = 0;
    server.use(http.post('https://api.anthropic.com/v1/messages', () => {
      calls++;
      if (calls === 1) return HttpResponse.json({ type: 'error', error: { message: 'overloaded' } }, { status: 529 });
      return toolUse('submit_rating', { known: true, score: 8, verdict: "Yes, it's smut.", synopsis: 's', details: 'd', tags: ['a', 'b'] });
    }));
    const result = await callRate({ title: 'X', creator: 'Y', year: 2020, medium: 'book' });
    expect(calls).toBe(2);
    expect(result.raw).toMatchObject({ known: true, score: 8 });
    expect(result.model).toBe(HAIKU);
  });

  it('throws after second consecutive 5xx on the primary model', async () => {
    server.use(http.post('https://api.anthropic.com/v1/messages', () =>
      HttpResponse.json({ type: 'error', error: { message: 'overloaded' } }, { status: 529 })
    ));
    await expect(callRate({ title: 'X', creator: 'Y', year: 2020, medium: 'book' })).rejects.toThrow();
  });
});
