'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchBar } from '@/components/SearchBar';
import { TryTheseChips } from '@/components/TryTheseChips';
import { DisambiguationPicker } from '@/components/DisambiguationPicker';
import { CaptchaModal } from '@/components/CaptchaModal';
import type { Candidate } from '@/lib/types';
import { track, ANALYTICS_EVENTS } from '@/lib/analytics';

const TRY_THESE = ['Fourth Wing', 'It Ends With Us', 'Bridgerton', 'A Court of Thorns and Roses', 'Normal People'];

export function SearchExperience() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);

  async function handleSearch(query: string) {
    track(ANALYTICS_EVENTS.searchSubmitted, { query });
    setLoading(true);
    setError(null);
    setCandidates(null);
    setPendingQuery(query);

    const res = await fetch('/api/disambiguate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (res.status === 429) {
      const body = await res.json();
      if (body.needs_captcha) {
        setLoading(false);
        setCaptchaOpen(true);
        return;
      }
    }

    if (!res.ok) {
      setLoading(false);
      setError('Something went wrong. Try again?');
      return;
    }

    const data = (await res.json()) as { candidates: Candidate[] };
    setLoading(false);

    if (data.candidates.length === 0) {
      setError(`No confident match for "${query}". Try adding the author or year.`);
      return;
    }

    if (data.candidates.length === 1) {
      const c = data.candidates[0];
      const params = new URLSearchParams({
        title: c.title, creator: c.creator, medium: c.medium,
        ...(c.year != null ? { year: String(c.year) } : {}),
      });
      router.push(`/r/${c.slug}?${params.toString()}`);
      return;
    }

    setCandidates(data.candidates);
  }

  function handlePick(c: Candidate) {
    const params = new URLSearchParams({
      title: c.title, creator: c.creator, medium: c.medium,
      ...(c.year != null ? { year: String(c.year) } : {}),
    });
    router.push(`/r/${c.slug}?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <SearchBar onSubmit={handleSearch} disabled={loading} />

      {!candidates && !error && !loading && (
        <TryTheseChips items={TRY_THESE} onPick={handleSearch} />
      )}

      {loading && (
        <p className="text-center text-sm text-[color:var(--color-ink-muted)]">Thinking…</p>
      )}

      {error && (
        <p className="text-center text-sm text-[color:var(--color-ink-muted)]">{error}</p>
      )}

      {candidates && candidates.length > 1 && (
        <DisambiguationPicker candidates={candidates} onPick={handlePick} />
      )}

      <CaptchaModal
        open={captchaOpen}
        onClose={() => setCaptchaOpen(false)}
        onSuccess={() => {
          setCaptchaOpen(false);
          if (pendingQuery) handleSearch(pendingQuery);
        }}
      />
    </div>
  );
}
