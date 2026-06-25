'use client';

import { useState } from 'react';
import { track, ANALYTICS_EVENTS } from '@/lib/analytics';

type Props = { url: string; title: string; slug?: string };

export function ShareButton({ url, title, slug }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title: `Is "${title}" smut?` });
        track(ANALYTICS_EVENTS.shareClicked, { slug, method: 'native' });
        return;
      } catch {
        // User cancelled; fall through to clipboard fallback below.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    track(ANALYTICS_EVENTS.shareClicked, { slug, method: 'clipboard' });
  }

  return (
    <button
      onClick={handleClick}
      className="rounded-full bg-[color:var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[color:#8b3a4f] hover:bg-[color:var(--color-brand-soft)] hover:text-white"
    >
      {copied ? '✓ Copied!' : 'Share'}
    </button>
  );
}
