import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { JsonLd } from '@/components/JsonLd';

describe('JsonLd', () => {
  it('renders a ld+json script with the serialized data', () => {
    const { container } = render(<JsonLd data={{ '@type': 'Book', name: 'X' }} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(JSON.parse(script!.textContent!)).toEqual({ '@type': 'Book', name: 'X' });
  });
});
