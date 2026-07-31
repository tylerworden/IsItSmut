import { render } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { AdSlot } from '@/components/AdSlot';

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as { adsbygoogle?: unknown }).adsbygoogle;
});

describe('AdSlot', () => {
  it('renders nothing when the publisher id env var is unset', () => {
    const { container } = render(<AdSlot slot="1234567890" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the slot id is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    const { container } = render(<AdSlot slot={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a responsive ad unit with reserved height and pushes to adsbygoogle', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    const { container } = render(<AdSlot slot="1234567890" />);
    const ins = container.querySelector('ins.adsbygoogle');
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute('data-ad-client')).toBe('ca-pub-3955040205852001');
    expect(ins?.getAttribute('data-ad-slot')).toBe('1234567890');
    expect(ins?.getAttribute('data-ad-format')).toBe('auto');
    expect(ins?.getAttribute('data-full-width-responsive')).toBe('true');
    expect(container.firstElementChild?.className).toContain('min-h-[280px]');
    expect((window as { adsbygoogle?: unknown[] }).adsbygoogle).toHaveLength(1);
  });

  it('labels the unit "Advertisement"', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    const { getByText } = render(<AdSlot slot="1234567890" />);
    expect(getByText(/advertisement/i)).toBeInTheDocument();
  });

  it('survives an adsbygoogle push that throws (ad blocker)', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    (window as unknown as { adsbygoogle: { push: () => void } }).adsbygoogle = {
      push: () => {
        throw new Error('blocked');
      },
    };
    expect(() => render(<AdSlot slot="1234567890" />)).not.toThrow();
  });
});
