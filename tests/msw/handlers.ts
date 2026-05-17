import { http, HttpResponse } from 'msw';

export const anthropicSuccessDisambiguate = http.post(
  'https://api.anthropic.com/v1/messages',
  () => HttpResponse.json({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    content: [{
      type: 'tool_use',
      id: 'tool_test',
      name: 'submit_candidates',
      input: {
        candidates: [
          { title: 'Fourth Wing', creator: 'Rebecca Yarros', year: 2023, medium: 'book' },
        ],
      },
    }],
    stop_reason: 'tool_use',
    usage: { input_tokens: 100, output_tokens: 30 },
  })
);

export const anthropicSuccessRate = http.post(
  'https://api.anthropic.com/v1/messages',
  () => HttpResponse.json({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    content: [{
      type: 'tool_use',
      id: 'tool_test',
      name: 'submit_rating',
      input: {
        known: true,
        score: 8,
        verdict: "Yes, it's smut.",
        synopsis: 'A war college for dragon riders. Violet, runt of her family, must survive deadly trials.',
        details: 'Multiple explicit scenes including detailed sex scenes in later chapters. References to enemies-to-lovers tension.',
        tags: ['Open door', 'Enemies to lovers'],
      },
    }],
    stop_reason: 'tool_use',
    usage: { input_tokens: 200, output_tokens: 80 },
  })
);

export const anthropicError = http.post(
  'https://api.anthropic.com/v1/messages',
  () => HttpResponse.json({ type: 'error', error: { type: 'overloaded_error', message: 'overloaded' } }, { status: 529 })
);
