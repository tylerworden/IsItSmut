'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle?: object[];
  }
}

type Props = { slot: string | undefined; className?: string };

/**
 * One AdSense responsive display unit. Renders nothing unless both the
 * publisher id (NEXT_PUBLIC_ADSENSE_CLIENT) and the slot id are set, so
 * local dev, previews, and tests stay ad-free. The reserved min-height
 * keeps ad load from shifting the layout.
 */
export function AdSlot({ slot, className }: Props) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const enabled = Boolean(client && slot);
  const pushed = useRef(false);

  useEffect(() => {
    if (!enabled || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // Ad blocker or double-fill — never break the page over an ad.
    }
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className={className ? `min-h-[280px] ${className}` : 'min-h-[280px]'}>
      <p className="mb-1 text-center text-[10px] uppercase tracking-widest text-[color:var(--color-ink-muted)]">
        Advertisement
      </p>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
