import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SearchBar } from '@/components/SearchBar';

describe('SearchBar', () => {
  it('calls onSubmit with trimmed value on submit', async () => {
    const onSubmit = vi.fn();
    render(<SearchBar onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText(/Type a book, movie/i);
    await userEvent.type(input, '  Fourth Wing  ');
    await userEvent.click(screen.getByRole('button', { name: /find out/i }));
    expect(onSubmit).toHaveBeenCalledWith('Fourth Wing');
  });

  it('does not submit empty input', async () => {
    const onSubmit = vi.fn();
    render(<SearchBar onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /find out/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
