# IsItSmut Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the "no score" (`known:false`) rate from 21% toward <5% by (a) rewriting the disambiguation + rating prompts and (b) escalating misses from Haiku to Sonnet — without ever fabricating a rating, and re-rating the existing bad entries so the fixes reach them.

**Architecture:** Keep Haiku 4.5 as the fast primary model. Add a thin escalation layer in `src/lib/claude.ts`: on a miss (empty candidates / `known:false`), retry the same call once with Claude Sonnet 4.6. `callRate` now returns which model produced the result so `runRate` can persist it. Prompts move the known-vs-unknown decision and "score recognized works" rule. Two one-off operator scripts clean up + re-rate the existing misses and measure the rate.

**Tech Stack:** Next.js 15, TypeScript, `@anthropic-ai/sdk`, Supabase, Vitest. Anthropic calls are tested via **MSW** (HTTP mocking), not `vi.mock` — handlers branch on the request body's `model`. Spec: `docs/superpowers/specs/2026-06-18-isitsmut-coverage-design.md`.

**Conventions (read before starting):**
- Branch `coverage` (already created). Baseline green: 102 tests (confirm with `pnpm test` before starting).
- `pnpm test` (all), `pnpm test -- tests/integration/claude.test.ts` (one file), `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Model ids: Haiku = `claude-haiku-4-5-20251001` (existing `MODEL`/`CLAUDE_MODEL`), Sonnet = `claude-sonnet-4-6`.
- Operator scripts run via the TLS-workaround command (this machine intercepts TLS; `pnpm dlx` is blocked): `NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/<file>.ts`.
- Commit after each task with conventional-commit messages.

---

## Task 1: Rewrite both prompts

**Files:**
- Modify: `src/lib/prompts.ts` (replace `DISAMBIGUATE_SYSTEM_PROMPT` and `RATE_SYSTEM_PROMPT`; leave `buildRateUserMessage` unchanged)
- Test: `tests/unit/prompts.test.ts` (new — intent guards)

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/prompts.test.ts
import { describe, it, expect } from 'vitest';
import { DISAMBIGUATE_SYSTEM_PROMPT, RATE_SYSTEM_PROMPT, buildRateUserMessage } from '@/lib/prompts';

describe('DISAMBIGUATE_SYSTEM_PROMPT', () => {
  it('instructs returning an empty array over guessing, and not guessing creators', () => {
    expect(DISAMBIGUATE_SYSTEM_PROMPT).toContain('empty candidates array');
    expect(DISAMBIGUATE_SYSTEM_PROMPT).toMatch(/wrong creator is worse than no match/i);
  });
});

describe('RATE_SYSTEM_PROMPT', () => {
  it('requires scoring recognized works and reserves known:false for unrecognized ones', () => {
    expect(RATE_SYSTEM_PROMPT).toMatch(/if you recognize the work[^.]*you must return known:true/i);
    expect(RATE_SYSTEM_PROMPT).toMatch(/known:false only when/i);
  });
  it('still defines the 1–10 scale and verdict mapping', () => {
    expect(RATE_SYSTEM_PROMPT).toContain('RATING SCALE (1–10, integer)');
    expect(RATE_SYSTEM_PROMPT).toContain("7–8 → \"Yes, it's smut.\"");
  });
});

describe('buildRateUserMessage', () => {
  it('formats the work line with year', () => {
    expect(buildRateUserMessage({ title: 'X', creator: 'Y', year: 2020, medium: 'book' }))
      .toBe('Rate: X (2020) — book, by Y');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/prompts.test.ts`
Expected: FAIL — the new phrases aren't in the current prompts (the buildRateUserMessage case passes).

- [ ] **Step 3: Replace the two prompt constants in `src/lib/prompts.ts`**

```ts
export const DISAMBIGUATE_SYSTEM_PROMPT = `You are a media disambiguation service for IsItSmut.com.

Given a user's query (a book, movie, or TV show title — possibly partial or misspelled), return 0–4 likely matches as a JSON object via the provided tool.

Each match must have:
- title: the official title
- creator: author for books, primary director or showrunner for movies/TV
- year: release/publication year as an integer (or null if genuinely unknown)
- medium: one of "book", "movie", "tv"

ACCURACY RULES (critical):
- Only return a work you are confident actually exists WITH THE CREATOR YOU NAME. If you are unsure who the creator is, do NOT guess a name — omit that work. A wrong creator is worse than no match.
- Never invent titles. If the query is vague, ambiguous, or you have no confident match, return an empty candidates array rather than filler guesses.
- Prefer fewer, correct matches over more, uncertain ones.

Rank by popularity. If the query clearly identifies one specific work, return just that one.`;

export const RATE_SYSTEM_PROMPT = `You are the smut rating engine for IsItSmut.com.

Given a specific work (title + creator + year + medium), rate its sexual content via the provided tool.

DEFINITION OF SMUT:
"Smut" = sexual content / detailed physical intimacy (sex scenes, explicit foreplay, on-page or on-screen).
NOT smut: mere romance, kissing, fade-to-black, innuendo, or themes of attraction without depiction.

RATING SCALE (1–10, integer):
1  = no sexual content
3  = brief or fade-to-black only
5  = a couple of mild on-page/screen scenes
7  = several detailed scenes
9  = frequent and explicit
10 = erotica / erotic romance (the point of the work)

WHEN TO RATE vs. RETURN known:false:
- If you recognize the work at all, you MUST return known:true with a score — including non-fiction, reference, religious, children's, or documentary works. These simply score low (usually 1–2, "Not smut"). Recognizing a work but judging it has little or no sexual content is a known:true score of 1–2, NOT a known:false.
- Set known:false ONLY when you genuinely do not recognize the work, or cannot identify it well enough to say anything about its content. When known:false, omit all other fields.
- If you recognize the work but are unsure of the exact amount of sexual content, estimate conservatively from what you do know (genre, reputation, source material, comparable works) and still return a score. Do not bail just because you are unsure of precise scene counts.
- Never fabricate details about a work you do not recognize — that is what known:false is for.

OUTPUT FIELDS (when known:true):
- score: integer 1–10 per the scale above
- verdict: a short tagline. Map score to:
    1–3 → "Not smut."
    4–6 → "A little spicy."
    7–8 → "Yes, it's smut."
    9–10 → "Absolutely smut."
- synopsis: 1–2 sentences. Cover only setup and inciting incident. No major spoilers.
- details: tasteful + clinical description of the sexual content. ≤ 60 words. Subway-safe wording — name scene count, kink references, and chapter pointers if known, but DON'T dramatize or quote. For works with no sexual content, say so plainly (e.g., "No sexual content."). Example: "Multiple explicit scenes, including detailed sex scenes in chapters 23 and 38. References to BDSM and oral sex."
- tags: 2–4 short pills like "Open door", "Fade-to-black", "BDSM", "Enemies to lovers", "Closed door". For clean works, use tags like "Non-fiction", "Closed door", or "Clean".`;
```

Leave `buildRateUserMessage` exactly as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/prompts.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts.ts tests/unit/prompts.test.ts
git commit -m "feat(coverage): rewrite prompts — score recognized works, stop creator guessing"
```

---

## Task 2: Two-tier escalation in `claude.ts`

**Files:**
- Modify: `src/lib/claude.ts`
- Modify: `tests/integration/claude.test.ts`

- [ ] **Step 1: Write the failing tests** — replace the body of `tests/integration/claude.test.ts` with this (keeps the original two success tests, updates `callRate` to read `.raw`, fixes the retry test to use a `known:true` success so escalation doesn't fire, and adds escalation tests):

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- tests/integration/claude.test.ts`
Expected: FAIL — `result.raw`/`result.model` undefined and no escalation yet.

- [ ] **Step 3: Refactor `src/lib/claude.ts`** — add the Sonnet constant, extract model-parameterized helpers, and add escalation. Replace the existing `callDisambiguate` and `callRate` (lines 97–123) with the code below; add `SONNET_MODEL` near the top `MODEL` declaration.

Add beside `const MODEL = 'claude-haiku-4-5-20251001';`:

```ts
const SONNET_MODEL = 'claude-sonnet-4-6';
```

Replace the two exported functions at the bottom of the file with:

```ts
async function disambiguateWith(query: string, model: string): Promise<DisambiguateRaw> {
  const message = await withRetry(() => getClient().messages.create({
    model,
    max_tokens: 512,
    temperature: 0,
    system: [{ type: 'text', text: DISAMBIGUATE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [disambiguateTool],
    tool_choice: { type: 'tool', name: 'submit_candidates' },
    messages: [{ role: 'user', content: query }],
  }));
  return extractTool<DisambiguateRaw>(message, 'submit_candidates');
}

export async function callDisambiguate(query: string): Promise<DisambiguateRaw> {
  const primary = await disambiguateWith(query, MODEL);
  if (primary.candidates.length > 0) return primary;
  // Escalate misses to the stronger model; fall back to the empty primary on error.
  try {
    return await disambiguateWith(query, SONNET_MODEL);
  } catch (err) {
    console.error('disambiguate escalation failed', err);
    return primary;
  }
}

async function rateWith(work: {
  title: string; creator: string; year: number | null; medium: string;
}, model: string): Promise<RateRaw> {
  const message = await withRetry(() => getClient().messages.create({
    model,
    max_tokens: 512,
    temperature: 0,
    system: [{ type: 'text', text: RATE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    tools: [rateTool],
    tool_choice: { type: 'tool', name: 'submit_rating' },
    messages: [{ role: 'user', content: buildRateUserMessage(work) }],
  }));
  return extractTool<RateRaw>(message, 'submit_rating');
}

export type RateResult = { raw: RateRaw; model: string };

export async function callRate(work: {
  title: string; creator: string; year: number | null; medium: string;
}): Promise<RateResult> {
  const primary = await rateWith(work, MODEL);
  if (primary.known) return { raw: primary, model: MODEL };
  // Escalate misses to the stronger model; fall back to the primary miss on error.
  try {
    const escalated = await rateWith(work, SONNET_MODEL);
    return { raw: escalated, model: SONNET_MODEL };
  } catch (err) {
    console.error('rate escalation failed', err);
    return { raw: primary, model: MODEL };
  }
}
```

(`CLAUDE_MODEL` export stays as-is.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/integration/claude.test.ts && pnpm typecheck`
Expected: PASS (all claude tests green; typecheck clean).

- [ ] **Step 5: Commit**

```bash
git add src/lib/claude.ts tests/integration/claude.test.ts
git commit -m "feat(coverage): escalate misses Haiku->Sonnet; callRate reports producing model"
```

---

## Task 3: Persist the producing model in `rate.ts`

**Files:**
- Modify: `src/lib/rate.ts`
- Modify: `tests/integration/rate-lib.test.ts`

- [ ] **Step 1: Update the rate-lib test** to the new `callRate` shape and add an escalation-model assertion. In `tests/integration/rate-lib.test.ts`:

Change the mock factory (remove the now-unused `CLAUDE_MODEL`):

```ts
vi.mock('@/lib/claude', () => ({
  callRate: vi.fn(),
}));
```

Update the cache-miss test's mock return value (was a bare `RateRaw`):

```ts
    vi.mocked(claudeMod.callRate).mockResolvedValueOnce({
      raw: { known: true, score: 7, verdict: "Yes, it's smut.", synopsis: 'syn', details: 'det', tags: ['Open door', 'Romance'] },
      model: 'claude-haiku-4-5-20251001',
    });
```

Update the `known=false` test's mock return value:

```ts
    vi.mocked(claudeMod.callRate).mockResolvedValueOnce({ raw: { known: false }, model: 'claude-haiku-4-5-20251001' });
```

Add a new test (after the `known=false` test, inside the `describe`):

```ts
  it('persists the model reported by callRate (e.g. Sonnet escalation)', async () => {
    vi.mocked(claudeMod.callRate).mockResolvedValueOnce({
      raw: { known: true, score: 5, verdict: 'A little spicy.', synopsis: 's', details: 'd', tags: ['x', 'y'] },
      model: 'claude-sonnet-4-6',
    });
    const result = await runRate({
      slug: 'normal-people-rooney-2020',
      candidate: { title: 'Normal People', creator: 'Sally Rooney', year: 2020, medium: 'tv' },
    });
    expect(result.rating.model).toBe('claude-sonnet-4-6');
    expect((ratingsStore.get('normal-people-rooney-2020') as { model: string }).model).toBe('claude-sonnet-4-6');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/integration/rate-lib.test.ts`
Expected: FAIL — `runRate` still treats `callRate`'s result as a bare `RateRaw` (`raw`/`model` undefined), so writes break.

- [ ] **Step 3: Update `src/lib/rate.ts`**

Change the import (drop `CLAUDE_MODEL`):

```ts
import { callRate } from './claude';
```

Replace `const raw = await callRate(input.candidate);` with:

```ts
  const { raw, model } = await callRate(input.candidate);
```

Then replace the three `model: CLAUDE_MODEL` occurrences (in `ratingRow` and in both branches of the in-memory `rating`) with `model,` (shorthand for the destructured `model`). The `ratingRow` known branch becomes:

```ts
  const ratingRow: Record<string, unknown> = raw.known
    ? {
        slug: input.slug,
        known: true,
        score: raw.score,
        verdict: raw.verdict,
        synopsis: raw.synopsis,
        details: raw.details,
        tags: raw.tags,
        model,
      }
    : {
        slug: input.slug,
        known: false,
        model,
      };
```

And in the in-memory `rating` construction, both the `raw.known` branch and the `else` branch use `model,` instead of `model: CLAUDE_MODEL`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- tests/integration/rate-lib.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate.ts tests/integration/rate-lib.test.ts
git commit -m "feat(coverage): persist the actual producing model on each rating"
```

---

## Task 4: Cleanup + re-rate operator script

**Files:**
- Create: `scripts/cleanup-rerate.ts`

**Note:** One-off operational script, no unit test. Run by the operator AFTER deploy. Mirrors `scripts/seed-popular.ts` for the re-rate loop. It (1) deletes every current `known:false` rating and its `works` row, then (2) re-runs a curated list of the recoverable titles through the improved flow. Logs the model used per title so we can confirm Sonnet escalation is engaging.

- [ ] **Step 1: Create the script**

```ts
// scripts/cleanup-rerate.ts
//
// One-off: removes stale no-score (known=false) entries so the improved prompts +
// Sonnet escalation can re-rate them, then re-runs the recoverable titles.
//
// Usage (TLS-intercepting machine — pnpm dlx is blocked, use npx):
//   NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/cleanup-rerate.ts
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, RATE_LIMIT_SALT.

import { supabaseServer } from '../src/lib/supabase-server';
import { runDisambiguate } from '../src/lib/disambiguate';
import { runRate } from '../src/lib/rate';

// Recoverable titles from the 2026-06-18 diagnostic (recognizable works that
// should now rate). Genuine gibberish is intentionally NOT re-run.
const RERATE: string[] = [
  'Normal People TV series Sally Rooney',
  'Deep Work by Cal Newport',
  'The Book of Mormon',
  'Hard Knocks HBO sports documentary series',
  'Swamp Story by Dave Barry',
  'Camera Shy by Elinor Lipman',
  'Stars in Our Eyes by Daisy Goodwin',
  'Rites of the Starling by Devney Perry',
  'Shield of Sparrows by Carrie Summers',
  'Broken Country by Clare Morrall',
];

async function main() {
  const sb = supabaseServer();

  // 1. Delete stale no-score entries and their works rows.
  const { data: stale, error } = await sb.from('ratings').select('slug').eq('known', false);
  if (error) { console.error('failed to read known=false rows', error); process.exit(1); }
  const slugs = (stale ?? []).map((r) => (r as { slug: string }).slug);
  console.log(`Deleting ${slugs.length} known=false entries (ratings + works)...`);
  if (slugs.length > 0) {
    const delR = await sb.from('ratings').delete().in('slug', slugs);
    if (delR.error) console.error('ratings delete error', delR.error);
    const delW = await sb.from('works').delete().in('slug', slugs);
    if (delW.error) console.error('works delete error', delW.error);
  }

  // 2. Re-run recoverable titles through the improved flow.
  let ok = 0, unknown = 0, failed = 0;
  for (const query of RERATE) {
    console.log(`\n→ ${query}`);
    try {
      const { candidates } = await runDisambiguate(query);
      if (candidates.length === 0) { console.log('  ✗ no candidates'); unknown++; continue; }
      const match = candidates[0];
      console.log(`  matched: ${match.title} (${match.creator}, ${match.year}, ${match.medium}) → ${match.slug}`);
      const result = await runRate({ slug: match.slug, candidate: match });
      if (result.rating.known) {
        console.log(`  ✓ ${result.rating.score}/10 — ${result.rating.verdict}  [model: ${result.rating.model}]${result.cacheHit ? ' (cached)' : ''}`);
        ok++;
      } else {
        console.log(`  ⚠ still known=false  [model: ${result.rating.model}]`);
        unknown++;
      }
    } catch (err) {
      console.error('  ✗ error:', err instanceof Error ? err.message : err);
      failed++;
    }
  }
  console.log(`\n=== Done — re-rated ok: ${ok}, still unknown: ${unknown}, failed: ${failed} ===`);
  console.log('If escalation is working, at least some lines should show [model: claude-sonnet-4-6].');
}

main().then(() => process.exit(0));
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/cleanup-rerate.ts
git commit -m "feat(coverage): cleanup-rerate script — purge + re-rate stale no-scores"
```

(Do NOT run it here — it is an operator step performed after deploy, see Task 6.)

---

## Task 5: Coverage-eval (read-only measurement) script

**Files:**
- Create: `scripts/coverage-eval.ts`

**Note:** Read-only diagnostic, no unit test. Reports the current no-score rate and lists remaining misses. Run before/after to quantify the improvement.

- [ ] **Step 1: Create the script**

```ts
// scripts/coverage-eval.ts
//
// Read-only: reports the no-score (known=false) rate across all cached ratings.
//
// Usage:
//   NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/coverage-eval.ts

import { supabaseServer } from '../src/lib/supabase-server';

async function main() {
  const sb = supabaseServer();
  const { count: total } = await sb.from('ratings').select('*', { count: 'exact', head: true });
  const { count: known } = await sb.from('ratings').select('*', { count: 'exact', head: true }).eq('known', true);
  const { data: kf, error } = await sb
    .from('ratings')
    .select('slug, works!inner(title, creator, medium, year)')
    .eq('known', false);
  if (error) { console.error('query error', error); process.exit(1); }
  const rows = (kf ?? []) as unknown as { works: { title: string; creator: string; medium: string; year: number | null } }[];
  const pct = total ? ((rows.length / total) * 100).toFixed(1) : '0';
  console.log(`TOTAL: ${total} | known=true: ${known} | known=false: ${rows.length} | no-score rate: ${pct}%`);
  for (const r of rows) console.log(`  [${r.works.medium}] ${r.works.title} — ${r.works.creator} (${r.works.year ?? '?'})`);
}

main().then(() => process.exit(0));
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/coverage-eval.ts
git commit -m "feat(coverage): coverage-eval script — report no-score rate"
```

---

## Task 6: Verification + operator runbook

**Files:** none (verification only).

- [ ] **Step 1: Full suite + gates**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: all tests pass (102 existing + new prompts/claude/rate tests); typecheck/lint clean; build succeeds (the build's guarded Supabase calls may log local TLS errors and degrade gracefully — expected, not a failure).

- [ ] **Step 2: Confirm the Sonnet model id resolves (operator, after merge/deploy)**

The escalation only fires on misses; if `claude-sonnet-4-6` were wrong, escalation calls would error, be caught, and silently fall back to Haiku misses. The `cleanup-rerate` run (next step) logs the model per title — **confirm at least some lines show `[model: claude-sonnet-4-6]`**. If every line is Haiku and titles remain `known=false`, the Sonnet model id is wrong — stop and fix it before concluding.

- [ ] **Step 3: Operator runbook (after this branch is merged + deployed)**

- [ ] Re-rate the stale misses: `NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/cleanup-rerate.ts` — watch for `[model: claude-sonnet-4-6]` lines and real scores on *Normal People*, *Deep Work*, *Hard Knocks*, etc.
- [ ] Measure: `NODE_TLS_REJECT_UNAUTHORIZED=0 npm_config_strict_ssl=false npx --yes tsx@latest --env-file=.env.local scripts/coverage-eval.ts` — confirm the no-score rate dropped from 21.3% toward <5%.
- [ ] Spot-check one re-rated result page in production (e.g. the new *Normal People* slug) shows a real score.

- [ ] **Step 4: Final commit (only if verification required fixes)**

```bash
git add -A
git commit -m "chore(coverage): verification fixes"
```

---

## Spec coverage map

| Spec section | Task(s) |
|---|---|
| A. Prompt rewrites (disambiguate + rate) | 1 |
| B. Two-tier escalation (Haiku→Sonnet) | 2 |
| B. Persist actual producing model | 3 |
| C. Caching unchanged for genuine misses | 2 (escalation only fires on miss; `known:false` still cached via existing `runRate`) |
| D. Cleanup + re-rate stale misses | 4 |
| E. Coverage-eval measurement | 5 |
| Error handling (escalation falls back, never 503 from backup) | 2 (try/catch in `callDisambiguate`/`callRate`) |
| Success criteria (<5%, named offenders score) | 6 (operator runbook) |
| Sonnet model-id confirmation | 6 (Step 2) |
| Testing | 1, 2, 3 + 6 |
