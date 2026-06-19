// tests/unit/sitemap.test.ts
import { describe, it, expect } from 'vitest';
import { buildSitemapEntries, STATIC_PATHS } from '@/lib/sitemap';

describe('buildSitemapEntries', () => {
  it('includes every static path plus one entry per rated page', () => {
    const entries = buildSitemapEntries(
      [{ slug: 'a-book', rated_at: '2026-01-02T00:00:00.000Z' }],
      'https://isitsmut.com'
    );
    const urls = entries.map((e) => e.url);
    for (const p of STATIC_PATHS) expect(urls).toContain(`https://isitsmut.com${p}`);
    expect(urls).toContain('https://isitsmut.com/r/a-book');
    const ratedEntry = entries.find((e) => e.url.endsWith('/r/a-book'))!;
    expect(ratedEntry.lastModified).toEqual(new Date('2026-01-02T00:00:00.000Z'));
  });

  it('returns only static paths when there are no rated pages', () => {
    const entries = buildSitemapEntries([], 'https://isitsmut.com');
    expect(entries).toHaveLength(STATIC_PATHS.length);
  });
});
