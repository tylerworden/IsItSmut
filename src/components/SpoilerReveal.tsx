'use client';

import { useState } from 'react';

export function SpoilerReveal({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return <div className="text-sm leading-relaxed text-[color:var(--color-ink)]">{children}</div>;
  }

  return (
    <button
      onClick={() => setRevealed(true)}
      className="relative block w-full overflow-hidden rounded-xl bg-[color:var(--color-accent)] p-3 text-left"
    >
      <div aria-hidden="true" className="text-sm leading-relaxed text-transparent" style={{ textShadow: '0 0 8px rgba(139,58,79,0.6)' }}>
        {children}
      </div>
      <div className="mt-2 text-center text-xs font-semibold text-[color:var(--color-brand)]">
        👁 Tap to reveal
      </div>
    </button>
  );
}
