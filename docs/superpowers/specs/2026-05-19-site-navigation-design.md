# Site Navigation — Design Spec

**Date:** 2026-05-19
**Status:** Approved, ready for implementation planning
**Builds on:** `2026-05-17-isitsmut-design.md` and `2026-05-19-homepage-refresh-leaderboard-design.md`

## Purpose

Every page on IsItSmut currently lacks a top-level navigation affordance back to the homepage. From `/r/[slug]`, `/top`, or the static pages, the only way back is the browser's back button. This is unfamiliar and frustrating for users coming in via a shared link who want to do their own search.

## Scope

### In scope

- A new persistent **site header** at the top of every page containing a clickable wordmark that links to `/`
- An additional **"Home" link** in the existing footer nav (first position)

### Out of scope

- Sticky-on-scroll behavior (mobile real estate concern; non-sticky is fine for this content density)
- A full nav menu (Search / Top 10 / About / etc. all in the header) — Top 10 stays in the footer; search is on the homepage
- Mobile hamburger menu (no menu to hide)
- Breadcrumbs on `/r/[slug]` (overkill for a flat URL structure)
- Logo image / icon — wordmark text only

## Architecture

### Header component

`src/components/SiteHeader.tsx` — small server component, rendered above `<main>` in `src/app/layout.tsx`.

- Thin bar (~48px tall) with a bottom border (`border-b border-[color:var(--color-border)]`)
- Constrained to `max-w-xl` (matches the body) and aligned via `mx-auto`
- Padding: `px-5 py-3`
- Contains a single `<Link href="/">` wrapping the wordmark "Is It Smut?" in brand color, modest weight (font-bold, not the homepage's `font-black`), small enough not to compete with the Hero on the homepage

### Footer change

Add `<Link href="/">Home</Link>` as the first nav link in `src/components/Footer.tsx`. Final order: `Home · Top 10 · About · Terms · Privacy`.

### Layout placement

```
<html>
  <body>
    <PostHogProvider>
      <SiteHeader />          ← NEW
      <main>{children}</main>
      <Footer />
    </PostHogProvider>
  </body>
</html>
```

The header and footer both inherit width constraints from their own internal `max-w-xl`. The existing `<main className="mx-auto max-w-xl px-5 pt-10">` adjusts: `pt-10` becomes unnecessary because the header now provides top spacing; reduce to `pt-6` for breathing room below the header bar.

## Visual Design

- Header background: same `var(--color-surface)` as the page body (no separate fill), so it visually integrates rather than feeling like a navbar
- Bottom border: `var(--color-border)` (the existing pink-tinted divider)
- Wordmark style: `text-lg font-bold text-[color:var(--color-brand)]` (smaller than the Hero's `text-4xl font-black`)
- Hover state: inherits Tailwind defaults; underline on hover would be excessive for a logo

## Testing

- `tests/unit/SiteHeader.test.tsx` — render test: wordmark text present; `<a href="/">` present
- Extend `tests/unit/Footer.test.tsx` — assert the new `Home` link exists and points to `/` (consistent with the Top 10 assertion already added)

## Error Handling

None applicable — pure static UI.

## Open Items

None.
