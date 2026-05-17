import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold text-[color:var(--color-brand)]">We haven&apos;t seen this one.</h1>
      <p className="text-sm text-[color:var(--color-ink-muted)]">
        That result page doesn&apos;t exist yet.
      </p>
      <Link
        href="/"
        className="inline-block rounded-full bg-[color:var(--color-brand)] px-4 py-2 text-sm font-semibold text-white"
      >
        Search for it →
      </Link>
    </div>
  );
}
