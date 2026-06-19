# IsItSmut.com — Coverage Design Spec (reduce "no score" results)

**Date:** 2026-06-18
**Status:** Approved, ready for implementation planning
**Domain:** isitsmut.com
**Relation to other work:** Second of three sequenced efforts — **SEO (done) → Coverage (this) → Ads**. This spec reduces the rate at which a search returns no usable rating. Ads/monetization is a separate later spec.

## Purpose

Too many searches return "We don't have a reliable read on this one yet" (`known:false`). A live diagnostic of the production `ratings` table (2026-06-18) found **23 of 108 ratings are `known:false` — a 21.3% no-score rate.** The goal is to make no-score *rare* while staying accuracy-first: never fabricate a rating for a title we can't identify, but stop failing on titles we *can* handle.

User's chosen direction (Approach 2): fix the model instructions to eliminate the cheap failures, add a stronger model as an automatic backup for genuine misses, and keep an honest "no score" only for titles that truly can't be identified after both models try.

## Background — what the 23 no-scores actually are

The misses fall into three groups, which is why instruction fixes do most of the work:

1. **Disambiguation errors (~half).** The search step (`callDisambiguate`, Haiku) invents wrong titles/authors, so the rating step correctly can't rate a thing that doesn't exist as described. Examples: *Normal People* stored as "by Lena Dunham (2020)" (actually Sally Rooney / dir. Lenny Abrahamson); junk from vague queries — "Rules for the Summer," "The Rules of Summer," "Summer Rules," "Stars in Our Eyes"; several with `<UNKNOWN>` creators.
2. **Over-conservative bailing on recognized titles (~7).** `RATE_SYSTEM_PROMPT` tells the model to return `known:false` when "not confident about its sexual content." It conflates *"I don't know this work"* with *"I'm unsure how spicy it is,"* so clean/non-fiction titles get no-score instead of a confident low number: *Deep Work* (Cal Newport), *The Book of Mormon*, *Hard Knocks* (HBO sports doc), *Swamp Story* (Dave Barry), *Camera Shy* (Elinor Lipman).
3. **Genuinely new/niche titles (~4).** Real long-tail misses Haiku lacks knowledge of: *Rites of the Starling* (2023), *Shield of Sparrows*, *Stars in Our Eyes* (2024).

**Important caching note:** `known:false` results are persisted in `ratings` (`runRate` upserts an unknown row) and served from cache thereafter. So the existing 23 will keep showing no-score *even after* the fixes, unless they are deleted and re-rated. This cleanup is part of the spec.

## Scope

### In scope
- Rewrite `DISAMBIGUATE_SYSTEM_PROMPT` and `RATE_SYSTEM_PROMPT` in `src/lib/prompts.ts`.
- Add two-tier model escalation in `src/lib/claude.ts`: Haiku 4.5 primary; on a miss, retry once with **Claude Sonnet 4.6** (`claude-sonnet-4-6`). Record the model that actually produced the result.
- Store the actual producing model in `ratings.model` (currently hardcoded to the Haiku constant in `runRate`).
- One-off **cleanup + re-rate** operator script: delete the existing `known:false` ratings (and their junk `works` rows), then re-run the recoverable titles through the improved flow.
- A **coverage-eval** operator script that runs a fixed title set through the flow and reports the no-score rate, for before/after measurement.

### Out of scope
- **Web-search / internet grounding** (Approach 3) — deferred; revisit only if the no-score rate is still too high after this.
- **Rating calibration of *known* scores** and the `adjustScore` +1 shim — unchanged. The 1–10 scale and its anchors in the rubric stay as-is; this effort only changes the *known-vs-unknown decision* and the "must score a recognized title" rule, not where scores land. (See `[[isitsmut-followups]]` #1 for calibration, a separate concern.)
- Ads / monetization (next spec).

### Success criteria
- No-score rate on the re-rated production set drops from **21.3%** to **under ~5%**.
- The named recognized offenders (*Normal People*, *Deep Work*, *The Book of Mormon*, *Hard Knocks*, *Swamp Story*, *Camera Shy*) return real scores after re-rating.
- The stronger backup model fires **only** on misses (verified by unit tests), so normal searches keep Haiku's speed/cost.
- All existing tests pass; new escalation tests pass.

## Design

### A. Prompt rewrites (`src/lib/prompts.ts`)

**`DISAMBIGUATE_SYSTEM_PROMPT`** — cut hallucinated matches:
- Return a candidate only when confident the work exists **with the correct creator**. If unsure of the creator, omit that candidate rather than guess a name.
- For vague, ambiguous, or gibberish queries, return an **empty** candidates array rather than low-confidence filler.
- Keep ranking by popularity and the 1–4 cap. Keep "never invent works."

**`RATE_SYSTEM_PROMPT`** — separate "don't recognize it" from "unsure how spicy":
- **If you recognize the work at all, you MUST return `known:true` with a score.** This includes non-fiction, religious texts, children's titles, documentaries, etc. — score them low (1–2, "Not smut"). Do not return `known:false` merely because there is little or no sexual content.
- Use `known:false` **only** when you do not recognize the work / cannot identify it well enough to say anything about it.
- When you recognize the work but are unsure of exact scene counts, **estimate conservatively** from what you know (genre, reputation, source material) rather than bailing.
- Keep the existing 1–10 scale, verdict mapping, `synopsis`/`details`/`tags` rules, and "never fabricate a work you don't recognize."

### B. Two-tier escalation (`src/lib/claude.ts`)

Add `const SONNET_MODEL = 'claude-sonnet-4-6';` alongside the existing Haiku `MODEL`. Parameterize the internal call helpers by model, and wrap each public function so it escalates on a miss:

- **`callDisambiguate(query)`**: call with Haiku. If `candidates.length === 0`, retry the same call with Sonnet and use that result. (No escalation when Haiku already returns ≥1 candidate.)
- **`callRate(work)`**: call with Haiku. If the result is `known:false`, retry with Sonnet and use that result. Return both the `RateRaw` **and the model id that produced the final result** so the caller can persist it.
- Keep the existing `withRetry` (single 5xx retry) wrapping each individual model call. `max_tokens`, `temperature: 0`, tool definitions, and `tool_choice` are unchanged.

**`src/lib/rate.ts`**: `runRate` stores `model:` = the model `callRate` reports (Haiku or Sonnet), instead of the hardcoded constant.

### C. Caching behavior (unchanged, now rarely hit)
A result that is still `known:false` after both models is a genuine miss — it is cached as today (avoids re-charging for repeated gibberish). The improvement is that far fewer queries reach that state.

### D. Cleanup + re-rate (one-off operator script, `scripts/`)
1. Delete every current `known:false` row from `ratings` **and** its corresponding `works` row (the hallucinated/junk entries must go so a fresh, corrected search can recreate them).
2. Re-run the **recoverable** titles (the recognizable ones from the diagnostic — e.g. *Normal People*, *Deep Work*, *Hard Knocks*, *Swamp Story*, *Camera Shy*, *Book of Mormon*, plus the newer romance titles) as queries through the improved `runDisambiguate` → `runRate`, recreating correct entries. Genuine gibberish (e.g. `<UNKNOWN>`-creator junk) is simply left deleted.
- Idempotent and read-safe to re-run; uses the same prod-credential pattern as `scripts/seed-popular.ts`.

### E. Coverage-eval (one-off operator script, `scripts/`)
Runs a fixed evaluation set (the 23 diagnostic titles + the ~50 seed titles) through `runDisambiguate` → `runRate` and prints the no-score count and rate plus the list of any remaining misses. Run before and after to quantify the improvement against the success criteria.

## Data flow

The `/api/disambiguate` and `/api/rate` request paths are unchanged except that a *miss* now triggers one additional model call (Haiku → Sonnet) before returning. Cache-first behavior, rate limiting, and captcha bypass are untouched. The `ratings.model` column now reflects whichever model produced the stored rating.

## Error handling

- Escalation is best-effort: if the **Sonnet** retry itself errors (after its own 5xx retry), fall back to the primary Haiku result rather than failing the request — for `callRate` that means returning Haiku's `known:false`; for `callDisambiguate`, Haiku's empty list. The user sees an honest "no score"/"no matches", never a 503 caused by the *backup* attempt.
- A primary (Haiku) hard failure behaves exactly as today.

## Testing

**Unit (Vitest, Anthropic mocked by model):**
- `callRate`: Haiku returns `known:true` → Sonnet **not** called; reported model = Haiku.
- `callRate`: Haiku `known:false` → Sonnet called; Sonnet `known:true` → that result used, reported model = Sonnet.
- `callRate`: Haiku `known:false`, Sonnet also `known:false` → `known:false`, reported model = Sonnet (final attempt).
- `callRate`: Haiku `known:false`, Sonnet throws → falls back to `known:false` without throwing; reported model = Haiku.
- `callDisambiguate`: Haiku returns ≥1 candidate → Sonnet not called; Haiku empty → Sonnet called and its candidates used; Sonnet throws → falls back to empty.
- `runRate`: persists the model id reported by `callRate`.

**Manual / measurement:**
- Run the coverage-eval script after deploy; confirm no-score rate < ~5% and the named offenders score.
- Spot-check a couple of re-rated result pages in production.

## Risks & notes
- **Latency/cost on misses:** misses now make two model calls and take a second or two longer. Bounded by the existing 20/hr/IP limiter; misses are rarer after the prompt fix, and Sonnet runs only on them.
- **Disambiguate isn't cached**, so repeated identical gibberish costs two calls each time — acceptable under the rate limiter; revisit if abuse appears.
- **Re-rate can't reconstruct original user queries** for junk entries; recoverable titles are re-run by name, genuine junk is left deleted.
- **Prompt-rewrite calibration risk:** the rewrite must not shift where *known* scores land. The scale anchors and `adjustScore` shim stay; watch that clean titles now score 1–2 (not that mid-band titles drift). The coverage-eval spot-check covers this.
- **Sonnet can still hallucinate** (less than Haiku); the accuracy-first prompt and the "correct creator or omit" rule mitigate it.
