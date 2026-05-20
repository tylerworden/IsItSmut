# Site Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent top header with a clickable "Is It Smut?" wordmark linking to `/` on every page, plus a "Home" link as the first entry in the existing footer nav.

**Architecture:** New `SiteHeader` server component rendered in the root layout. Minor footer modification to prepend a Home link. Main content's top padding reduced from `pt-10` to `pt-6` to compensate for the new header.

**Tech Stack:** Next.js 15 App Router · Tailwind CSS · existing brand CSS tokens · Vitest + React Testing Library for component tests.

**Spec:** `docs/superpowers/specs/2026-05-19-site-navigation-design.md`

---

## File Structure

```
src/
├── app/
│   └── layout.tsx                # MODIFY — render SiteHeader, reduce main pt-10 → pt-6
├── components/
│   ├── SiteHeader.tsx            # NEW — top wordmark bar
│   └── Footer.tsx                # MODIFY — prepend Home link
tests/unit/
├── SiteHeader.test.tsx           # NEW — render test
└── Footer.test.tsx               # MODIFY — assert Home link
```

---

## Task 1: Create `SiteHeader` component (TDD)

**Files:**
- Create: `src/components/SiteHeader.tsx`
- Create: `tests/unit/SiteHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/SiteHeader.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteHeader } from '@/components/SiteHeader';

describe('SiteHeader', () => {
  it('renders the wordmark wrapped in a link to /', () => {
    render(<SiteHeader />);
    const link = screen.getByRole('link', { name: /Is It Smut\?/i });
    expect(link).toHaveAttribute('href', '/');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/SiteHeader.test.tsx`
Expected: FAIL with "Cannot find module '@/components/SiteHeader'".

- [ ] **Step 3: Implement**

```tsx
// src/components/SiteHeader.tsx
import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b border-[color:var(--color-border)]">
      <div className="mx-auto max-w-xl px-5 py-3">
        <Link
          href="/"
          className="text-lg font-bold text-[color:var(--color-brand)]"
        >
          Is It Smut?
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/SiteHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SiteHeader.tsx tests/unit/SiteHeader.test.tsx
git commit -m "feat(ui): SiteHeader with clickable wordmark linking to /"
```

---

## Task 2: Wire `SiteHeader` into the root layout

**Files:**
- Modify: `src/app/layout.tsx`

Current contents (for reference — replace verbatim):

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { Footer } from '@/components/Footer';
import { PostHogProvider } from '@/components/PostHogProvider';

export const metadata: Metadata = {
  title: 'IsItSmut — Find out before you start chapter one.',
  description: "Look up any book, movie, or TV show and see if it contains smut. 1–10 rating, short synopsis, and a (blurred) breakdown of what's in it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          <main className="mx-auto max-w-xl px-5 pt-10">{children}</main>
          <Footer />
        </PostHogProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 1: Replace the file**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/SiteHeader';
import { Footer } from '@/components/Footer';
import { PostHogProvider } from '@/components/PostHogProvider';

export const metadata: Metadata = {
  title: 'IsItSmut — Find out before you start chapter one.',
  description: "Look up any book, movie, or TV show and see if it contains smut. 1–10 rating, short synopsis, and a (blurred) breakdown of what's in it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider>
          <SiteHeader />
          <main className="mx-auto max-w-xl px-5 pt-6">{children}</main>
          <Footer />
        </PostHogProvider>
      </body>
    </html>
  );
}
```

Note the two changes:
1. New import + render of `<SiteHeader />` above `<main>`
2. `pt-10` → `pt-6` on `<main>` to compensate for header's vertical space

- [ ] **Step 2: Typecheck + run all tests**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck clean, all tests pass (no regressions).

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(layout): render SiteHeader above main, adjust top padding"
```

---

## Task 3: Add Home link to Footer

**Files:**
- Modify: `src/components/Footer.tsx`
- Modify: `tests/unit/Footer.test.tsx`

- [ ] **Step 1: Update the test FIRST**

Modify `tests/unit/Footer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Footer } from '@/components/Footer';

describe('Footer', () => {
  it('renders disclaimer and nav links', () => {
    render(<Footer />);
    expect(screen.getByText(/AI-generated ratings/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Home$/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Top 10/i })).toHaveAttribute('href', '/top');
    expect(screen.getByRole('link', { name: /About/i })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: /Terms/i })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: /Privacy/i })).toHaveAttribute('href', '/privacy');
  });
});
```

Note: the Home assertion uses `/^Home$/i` (exact match) to avoid matching "Homepage" or similar if any other link text contained "Home" — defensive against future link additions.

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm test tests/unit/Footer.test.tsx`
Expected: FAIL — no link with name "Home" exists yet.

- [ ] **Step 3: Update Footer**

Modify `src/components/Footer.tsx`. Change just the nav block — prepend the Home link as the first entry:

```tsx
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[color:var(--color-border)] px-6 py-8 text-center text-xs text-[color:var(--color-ink-quiet)]">
      <p className="mb-2">AI-generated ratings. Subjective and may be inaccurate.</p>
      <nav className="flex justify-center gap-4">
        <Link href="/" className="hover:text-[color:var(--color-brand)]">Home</Link>
        <Link href="/top" className="hover:text-[color:var(--color-brand)]">Top 10</Link>
        <Link href="/about" className="hover:text-[color:var(--color-brand)]">About</Link>
        <Link href="/terms" className="hover:text-[color:var(--color-brand)]">Terms</Link>
        <Link href="/privacy" className="hover:text-[color:var(--color-brand)]">Privacy</Link>
      </nav>
    </footer>
  );
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm test tests/unit/Footer.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Footer.tsx tests/unit/Footer.test.tsx
git commit -m "feat(footer): add Home link as first nav entry"
```

---

## Task 4: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Run typecheck, full test suite, lint, build**

Run: `pnpm typecheck && pnpm test && pnpm lint && pnpm build`
Expected: all clean. ~82 tests pass (80 prior + 1 new SiteHeader + 1 Footer Home assertion is added to an existing test, not new test).

- [ ] **Step 2: Push to origin/main**

Run: `git push origin main`
Expected: Vercel auto-deploys.

- [ ] **Step 3: Manual smoke (USER ACTION, after deploy)**

Visit https://isitsmut.com, then click around:
- Click the wordmark in the new header from homepage — should stay on homepage (refresh)
- Navigate to `/top` from footer, then click the header wordmark — should return to homepage
- Run a search → end up on `/r/[slug]` → click the header wordmark → return to homepage
- Verify the footer now has Home as the first link on every page

If anything looks off (spacing too tight under the header, wordmark too small/large, etc.), report back and we'll iterate.

---

## Done Criteria

- `SiteHeader` rendered on every page including `/`, `/r/[slug]`, `/top`, static pages
- Wordmark in header links to `/`
- Footer nav order: `Home · Top 10 · About · Terms · Privacy`
- All tests pass; typecheck + lint + build clean
- Pushed to main; Vercel deployed
