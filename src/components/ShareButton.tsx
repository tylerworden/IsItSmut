'use client';

import { useState } from 'react';

type Props = { url: string; title: string };

export function ShareButton({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title: `Is "${title}" smut?` });
        return;
      } catch {
        // User cancelled; fall through to clipboard fallback below.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
