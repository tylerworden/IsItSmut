import { describe, it, expect } from 'vitest';
import { hashIp } from '@/lib/hash';

describe('hashIp', () => {
  it('produces a stable sha256 hex string', () => {
    expect(hashIp('1.2.3.4', 'salt')).toBe(hashIp('1.2.3.4', 'salt'));
    expect(hashIp('1.2.3.4', 'salt')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hash for different IP', () => {
    expect(hashIp('1.2.3.4', 'salt')).not.toBe(hashIp('5.6.7.8', 'salt'));
  });

  it('produces different hash when salt changes', () => {
    expect(hashIp('1.2.3.4', 'a')).not.toBe(hashIp('1.2.3.4', 'b'));
  });
});
