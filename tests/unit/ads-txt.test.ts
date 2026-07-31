import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

describe('ads.txt', () => {
  it('authorizes Google as a direct seller under our publisher id', () => {
    const content = readFileSync(path.resolve(__dirname, '../../public/ads.txt'), 'utf8');
    expect(content.trim()).toBe('google.com, pub-3955040205852001, DIRECT, f08c47fec0942fa0');
  });
});
