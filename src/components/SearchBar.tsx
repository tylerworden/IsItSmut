'use client';

import { useState } from 'react';

type Props = {
  onSubmit: (query: string) => void;
  disabled?: boolean;
};

export function SearchBar({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex items-center gap-2 rounded-full border-2 border-[color:var(--color-border)] bg-white px-4 py-3 shadow-[0_4px_12px_rgba(212,80,107,0.08)]">
        <span aria-hidden className="text-[color:var(--color-ink-quiet)]">🔍</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          placeholder="Type a book, movie, or show…"
          className="flex-1 bg-transparent text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-quiet)] focus:outline-none"
          aria-label="Search a book, movie, or TV show"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-full bg-[color:var(--color-brand)] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Find out
        </button>
      </div>
    </form>
  );
}
