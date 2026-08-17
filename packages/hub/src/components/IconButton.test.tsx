import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from './IconButton';

const icon = <svg data-testid="icon" />;

describe('IconButton', () => {
  it('exposes its label to assistive tech and fires onClick', () => {
    const onClick = vi.fn();
    render(<IconButton label="Remove this meal" icon={icon} onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove this meal' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  describe('disabled', () => {
    it('shows a not-allowed cursor alongside the dimmed state', () => {
      render(<IconButton label="Remove this meal" icon={icon} disabled />);
      const btn = screen.getByRole('button', { name: 'Remove this meal' });
      expect(btn.className).toContain('disabled:cursor-not-allowed');
      expect(btn.className).toContain('disabled:opacity-50');
    });

    it('does not fire onClick', () => {
      const onClick = vi.fn();
      render(<IconButton label="Remove this meal" icon={icon} onClick={onClick} disabled />);
      fireEvent.click(screen.getByRole('button', { name: 'Remove this meal' }));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  it('disables itself and swaps the icon for a spinner while loading', () => {
    render(<IconButton label="Remove this meal" icon={icon} loading />);
    expect(screen.getByRole('button', { name: 'Remove this meal' })).toHaveProperty('disabled', true);
    expect(screen.queryByTestId('icon')).toBeNull();
  });
});
