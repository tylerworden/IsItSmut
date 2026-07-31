import { render } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('next/script', () => ({
  default: (props: Record<string, unknown>) => (
    <script data-testid="adsense-script" data-src={String(props.src)} data-strategy={String(props.strategy)} />
  ),
}));

import { AdSenseLoader } from '@/components/AdSenseLoader';

afterEach(() => vi.unstubAllEnvs());

describe('AdSenseLoader', () => {
  it('renders nothing when NEXT_PUBLIC_ADSENSE_CLIENT is unset', () => {
    const { container } = render(<AdSenseLoader />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the AdSense library script tagged with our publisher id', () => {
    vi.stubEnv('NEXT_PUBLIC_ADSENSE_CLIENT', 'ca-pub-3955040205852001');
    const { getByTestId } = render(<AdSenseLoader />);
    const script = getByTestId('adsense-script');
    expect(script.getAttribute('data-src')).toBe(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3955040205852001'
    );
    expect(script.getAttribute('data-strategy')).toBe('afterInteractive');
  });
});
