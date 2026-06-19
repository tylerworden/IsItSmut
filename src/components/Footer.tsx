import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[color:var(--color-border)] px-6 py-8 text-center text-xs text-[color:var(--color-ink-quiet)]">
      <p className="mb-2">AI-generated ratings. Subjective and may be inaccurate.</p>
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        <Link href="/" className="hover:text-[color:var(--color-brand)]">Home</Link>
        <Link href="/top" className="hover:text-[color:var(--color-brand)]">Top 10</Link>
        <Link href="/books" className="hover:text-[color:var(--color-brand)]">Books</Link>
        <Link href="/movies" className="hover:text-[color:var(--color-brand)]">Movies</Link>
        <Link href="/tv" className="hover:text-[color:var(--color-brand)]">TV</Link>
        <Link href="/about" className="hover:text-[color:var(--color-brand)]">About</Link>
        <Link href="/terms" className="hover:text-[color:var(--color-brand)]">Terms</Link>
        <Link href="/privacy" className="hover:text-[color:var(--color-brand)]">Privacy</Link>
      </nav>
    </footer>
  );
}
