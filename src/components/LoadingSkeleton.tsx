export function LoadingSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_6px_18px_rgba(212,80,107,0.10)]" aria-busy="true" aria-live="polite">
      <div className="-mx-5 -mt-5 mb-4 rounded-t-2xl bg-gradient-to-br from-[color:var(--color-brand)] to-[color:var(--color-brand-soft)] p-6 text-center text-white">
        <div className="text-[11px] uppercase tracking-widest opacity-90">Smut Rating</div>
        <div className="mt-1 text-4xl font-black opacity-50">…/10</div>
      </div>
      <div className="h-5 w-2/3 animate-pulse rounded bg-[color:var(--color-accent)]" />
      <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-[color:var(--color-accent)]" />
      <div className="mt-4 h-3 w-full animate-pulse rounded bg-[color:var(--color-accent)]" />
      <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-[color:var(--color-accent)]" />
      <p className="mt-4 text-center text-xs text-[color:var(--color-ink-quiet)]">Asking the AI…</p>
    </div>
  );
}
