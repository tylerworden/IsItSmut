'use client';

import Link from 'next/link';

export default function ResultError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold text-[color:var(--color-brand)]">
        We hit a snag rating this one.
      </h1>
      <p className="text-sm text-[color:var(--color-ink-muted)]">
        Something went wrong on our end. Give it another shot, or try a different title.
      </p>
      <div className="flex justify-center gap-2 pt-1">
        <button
          onClick={reset}
          className="rounded-full bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-[color:var(--color-border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--color-ink)]"
        >
          Back to search
        </Link>
      </div>
      {error.digest && (
        <p className="pt-4 text-[10px] text-[color:var(--color-ink-quiet)]">
          Ref: {error.digest}
        </p>
      )}
    </div>
  );
}
