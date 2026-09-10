import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('exposes its state as a switch role and fires onChange with the flipped value', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reflects a checked state via aria-checked', () => {
    render(<Toggle checked={true} onChange={vi.fn()} />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  describe('disabled', () => {
    it('does not fire onChange', () => {
      const onChange = vi.fn();
      render(<Toggle checked={false} onChange={onChange} disabled />);
      fireEvent.click(screen.getByRole('switch'));
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
