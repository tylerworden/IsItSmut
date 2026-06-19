import { describe, it, expect } from 'vitest';
import { metadata } from '@/app/layout';

describe('root layout metadata', () => {
  it('sets metadataBase to the apex origin', () => {
    expect(metadata.metadataBase?.toString()).toBe('https://isitsmut.com/');
  });
  it('declares a default openGraph site name and locale', () => {
    expect(metadata.openGraph?.siteName).toBe('IsItSmut');
    expect(metadata.openGraph?.type).toBe('website');
  });
});
