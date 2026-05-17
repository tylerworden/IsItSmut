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
