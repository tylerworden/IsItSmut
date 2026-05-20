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
