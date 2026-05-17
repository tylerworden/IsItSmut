import Anthropic from '@anthropic-ai/sdk';
import type { Tool, Message } from '@anthropic-ai/sdk/resources/messages';
import { DISAMBIGUATE_SYSTEM_PROMPT, RATE_SYSTEM_PROMPT, buildRateUserMessage } from './prompts';

const MODEL = 'claude-haiku-4-5-20251001';

export const CLAUDE_MODEL = MODEL;

let _client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 0,
      fetch: (...args) => globalThis.fetch(...(args as Parameters<typeof fetch>)),
    });
  }
  return _client;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Anthropic.APIError && err.status != null && err.status >= 500) {
      await new Promise((r) => setTimeout(r, 500));
      return await fn();
    }
    throw err;
  }
}

const disambiguateTool: Tool = {
  name: 'submit_candidates',
  description: 'Submit 0–4 candidate matches for the user query.',
  input_schema: {
    type: 'object',
    properties: {
      candidates: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          required: ['title', 'creator', 'year', 'medium'],
          properties: {
            title: { type: 'string' },
            creator: { type: 'string' },
            year: { type: ['integer', 'null'] },
            medium: { type: 'string', enum: ['book', 'movie', 'tv'] },
          },
        },
      },
    },
    required: ['candidates'],
  },
};

const rateTool: Tool = {
  name: 'submit_rating',
  description: 'Submit the smut rating for the given work.',
  input_schema: {
    type: 'object',
    required: ['known'],
    properties: {
      known: { type: 'boolean' },
      score: { type: 'integer', minimum: 1, maximum: 10 },
      verdict: { type: 'string' },
      synopsis: { type: 'string' },
      details: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
    },
  },
};

export type DisambiguateRaw = {
  candidates: Array<{ title: string; creator: string; year: number | null; medium: 'book' | 'movie' | 'tv' }>;
};

export type RateRaw =
  | { known: false }
  | {
      known: true;
      score: number;
      verdict: string;
      synopsis: string;
      details: string;
      tags: string[];
    };

function extractTool<T>(message: Message, name: string): T {
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === name) return block.input as T;
  }
  throw new Error(`Expected tool_use block "${name}" in Claude response`);
}

export async function callDisambiguate(query: string): Promise<DisambiguateRaw> {
  const message = await withRetry(() => getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    temperature: 0,
    system: [{ type: 'text', text: DISAMBIGUATE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [disambiguateTool],
    tool_choice: { type: 'tool', name: 'submit_candidates' },
    messages: [{ role: 'user', content: query }],
  }));
  return extractTool<DisambiguateRaw>(message, 'submit_candidates');
}

export async function callRate(work: {
  title: string; creator: string; year: number | null; medium: string;
}): Promise<RateRaw> {
  const message = await withRetry(() => getClient().messages.create({
    model: MODEL,
    max_tokens: 512,
    temperature: 0,
    system: [{ type: 'text', text: RATE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [rateTool],
    tool_choice: { type: 'tool', name: 'submit_rating' },
    messages: [{ role: 'user', content: buildRateUserMessage(work) }],
  }));
  return extractTool<RateRaw>(message, 'submit_rating');
}
