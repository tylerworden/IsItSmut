# IsItSmut.com — Ads Design Spec (AdSense monetization)

**Date:** 2026-07-30
**Status:** Approved design, ready for implementation planning
**Domain:** isitsmut.com
**Relation to other work:** Third of three sequenced efforts — **SEO (done) → Coverage (done) → Ads (this)**. Analytics instrumentation (PR #3) was the prerequisite: traffic is now measurable. Affiliate "buy this book" links are explicitly a **separate later effort**.

## Purpose

Turn IsItSmut into a passive, ad-supported property. Display ads via **Google AdSense** (premium networks like Mediavine/Raptive require ~50k+ sessions/month; not there yet). Chosen ad load (Tyler, 2026-07-30): **light, manual slots** — protect the "clean answer in 5 seconds" UX and SEO growth over squeezing early revenue.

**Chosen approach:** Google AdSense with **manual ad units** (not Auto Ads) + Google's built-in certified CMP (**Privacy & messaging** in the AdSense dashboard) for GDPR/CCPA consent. No third-party CMP vendor.

## Current state (2026-07-30)

- No ads, no `ads.txt` (only `robots.txt` in `public/`), no consent banner.
- `src/app/privacy/page.tsx` still says "We don't use ads (yet)." (last updated 2026-06-24).
- Layout (`src/app/layout.tsx`): single column, `max-w-xl`, `SiteHeader` / `main` / `Footer` inside `PostHogProvider`.
- Pages: home, `/r/[slug]` (dynamic SSR result pages, ~150 rated), hubs `/books /movies /tv /tamest /top` (ISR 1d), `/about /privacy /terms`.
- PostHog analytics: anonymous localStorage id, no cookies, `/ingest` proxy — live and out of scope here.

## Sequencing (approval is the long pole)

1. **Tyler (operator, first, ~10 min):** create the AdSense account at adsense.google.com with the Google account, add site `isitsmut.com`. This immediately yields the **publisher ID** — **DONE 2026-07-30: `ca-pub-3955040205852001`**. The two **display ad units** (`result-page`, `hub-page` → slot IDs) cannot be created yet — the new account's dashboard hasn't unlocked the Ads section. **Slot IDs arrive later**; the build ships with slot env vars unset (slots render nothing) and they're added post-unlock as a 2-minute follow-up. The loader script + `ads.txt` alone are sufficient for Google's site review.
2. **Build (assistant):** everything in Scope below, behind env-var gating; PR; Tyler confirms; merge → prod deploy.
3. **Tyler (operator):** in AdSense → Sites, request review of isitsmut.com (the ad code must already be live on the site — it is after step 2). Also configure **Privacy & messaging**: enable the GDPR (EEA/UK) message and the US states message, choosing Google's standard styling.
4. **Wait for Google review** (days to weeks, async). Slots render as blank/collapsed space until approval; on approval ads appear with no further deploy.
5. Later milestones (no action until they happen): at $10 earnings Google mails a **PIN postcard** for address verification; at $100 they pay out (bank details needed then).

## Scope

### In scope
- **`AdSlot` client component** (`src/components/AdSlot.tsx`): renders an `<ins class="adsbygoogle">` responsive display unit and pushes to `window.adsbygoogle` on mount. Renders **nothing at all** when `NEXT_PUBLIC_ADSENSE_CLIENT` or its slot ID env var is unset (previews/local stay ad-free). Wrapper `div` has a **reserved `min-height`** (~280px mobile-safe) plus a small "Advertisement" label, so ad load causes zero layout shift.
- **AdSense loader script** in `src/app/layout.tsx` via `next/script` (`strategy="afterInteractive"`, `crossOrigin="anonymous"`), gated on the same env var. This one script also serves Google's consent banner once Privacy & messaging is configured — no separate CMP code.
- **Placements (light):**
  - Result pages `/r/[slug]`: one slot, below the rating card, above related titles — **only when the rating is `known:true`** (no-score pages are noindex/thin; no ads there).
  - Hub pages `/books /movies /tv /tamest /top`: one slot after the list.
  - **No ads** on the homepage, `/about`, `/privacy`, `/terms`.
- **`public/ads.txt`:** `google.com, pub-3955040205852001, DIRECT, f08c47fec0942fa0`.
- **Privacy policy update** (`src/app/privacy/page.tsx`): remove "no ads (yet)"; disclose Google AdSense as an advertising partner, that Google and its partners use cookies/identifiers to serve (and, with consent, personalize) ads, link to Google's ad-settings page (`https://adssettings.google.com`) and `https://policies.google.com/technologies/partner-sites`, and note that EEA/UK/US-state visitors get a consent banner with opt-out. Bump the "Last updated" date.
- **Env vars (Vercel Production only, not Preview):** `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_ADSENSE_SLOT_RESULT`, `NEXT_PUBLIC_ADSENSE_SLOT_HUB`.

### Out of scope
- Affiliate links (Amazon Associates / Bookshop.org) — next effort.
- Google **Auto Ads**, sticky anchors, interstitials — rejected for UX.
- PostHog consent changes — it stays anonymous/localStorage, disclosed as-is.
- Any rating/prompt/calibration changes.
- Third-party CMP vendors.

### Success criteria
- AdSense application **submitted** with all site-side pieces live (the assistant's definition of done — approval itself is Google's timeline).
- On approval: real ads render on result + hub pages in production; homepage and legal pages stay ad-free.
- With env vars unset (previews, local, tests): zero ad markup, zero script tags — pages byte-identical to today.
- No layout shift from ad slots (reserved space verified).
- Privacy policy accurately describes the ad stack; consent banner serves in regulated regions (verifiable in the AdSense Privacy & messaging dashboard).
- All existing tests (~128) plus new `AdSlot` gating tests green; typecheck/lint/build clean.

## Design details

### A. `AdSlot` component
Client component, props: `slot` (the AdSense slot ID string) and optional `className`. Reads `NEXT_PUBLIC_ADSENSE_CLIENT` at module level. Returns `null` unless both client and slot are non-empty. Otherwise renders:

```
<div className="min-h-[280px] ...">   ← reserved space, tiny "Advertisement" caption
  <ins className="adsbygoogle" style="display:block"
       data-ad-client={client} data-ad-slot={slot}
       data-ad-format="auto" data-full-width-responsive="true" />
</div>
```

`useEffect` on mount: `(window.adsbygoogle = window.adsbygoogle || []).push({})`, wrapped in try/catch (throws are non-fatal — e.g. ad blockers, double-push in dev StrictMode; guard against double-push on the same `<ins>`).

Server pages (`/r/[slug]` is SSR, hubs are ISR) simply render `<AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESULT ?? ''} />` — the component self-gates, so call sites stay unconditional and dumb.

### B. Loader script (`layout.tsx`)
```
{ADSENSE_CLIENT && (
  <Script id="adsense" strategy="afterInteractive" crossOrigin="anonymous"
    src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`} />
)}
```
Consent flow: with Privacy & messaging configured in the dashboard, this script detects regulated regions, shows Google's consent dialog before any personalized ad request, and serves non-personalized (or no) ads on decline. Zero additional code; the CMP is Google-certified, satisfying Google's own EEA requirement.

### C. Error / degradation behavior
- **Env vars unset** → no script, no slots, no visual trace (this is also the rollback lever: unset vars in Vercel and redeploy to kill ads instantly).
- **Ad blocker present** → the `push` throws or the `<ins>` stays unfilled; the reserved space shows the quiet "Advertisement" caption over empty background. Acceptable; no retry logic.
- **Pre-approval period** → same as ad blocker case: reserved space, no fill.
- **Script fails to load** → slots stay empty; page functionality unaffected (script is afterInteractive and independent of app code).

## Testing

**Unit (Vitest):**
- `AdSlot` with client+slot env set → renders `ins.adsbygoogle` with correct `data-ad-client`/`data-ad-slot`, wrapper has reserved min-height, and mounts push to `window.adsbygoogle`.
- `AdSlot` with client unset → renders `null`. With slot unset → `null`.
- Result page composition: `known:false` rating → no `AdSlot` in tree; `known:true` → slot present (respecting existing page-test patterns with mocked Supabase).
- Layout: no AdSense script tag when env unset.
- Existing suite stays green (env vars are unset under test by default, so all current snapshots/behavior are untouched).

**Manual / post-deploy:**
- Prod: view-source confirms script + `ads.txt` reachable at `https://isitsmut.com/ads.txt`; slots reserve space on a result page and a hub page; homepage unchanged.
- After approval: ads actually fill; check AdSense dashboard "Policy center" for any per-page restrictions.
- (Real ad fill cannot be tested on localhost or previews — AdSense only serves on the approved domain.)

## Risks & notes

- **Adult-content policy (the big one).** AdSense prohibits sexually explicit content and *restricts* ad serving on pages "about" sexual topics even when non-explicit. IsItSmut describes smut levels; it isn't smut — but some high-score pages' details text may get **per-page ad restrictions** automatically (visible in Policy center; revenue impact only on those pages), and the initial **application may be rejected** for adult content. Mitigation if rejected: suppress `AdSlot` on high-score (9–10) result pages and/or tone down details phrasing, then reapply — rejection is not account-threatening and reapplying is normal and free.
- **Review outcome is not in our control**; "sufficient unique content" is also judged. ~150 substantive rated pages + hubs is a plausible pass, not a guaranteed one.
- **Revenue expectations:** at current early-SEO traffic, expect **single-digit dollars/month** initially. The bet is passive growth with the SEO curve, not immediate income. First payout at $100 may take a while.
- **CLS discipline:** the reserved min-height trades a block of blank space (pre-approval / ad-blocked) for zero layout shift. Chosen deliberately; revisit height once real fill rates are visible.
- **`ads.txt` depends on the publisher ID**, so implementation cannot start until Tyler completes operator step 1. The build is otherwise independent of Google's approval timeline.
- **Vercel Preview deploys** intentionally get no env vars → previews never show ads or load Google scripts.
