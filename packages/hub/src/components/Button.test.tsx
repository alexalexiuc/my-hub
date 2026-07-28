import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders its children and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  describe('disabled', () => {
    it('shows a not-allowed cursor alongside the dimmed state', () => {
      render(<Button disabled>Add</Button>);
      const btn = screen.getByRole('button', { name: 'Add' });
      // Opacity alone reads as "dimmed"; without the cursor the button still invites a click.
      expect(btn.className).toContain('disabled:cursor-not-allowed');
      expect(btn.className).toContain('disabled:opacity-50');
    });

    it('does not fire onClick', () => {
      const onClick = vi.fn();
      render(
        <Button disabled onClick={onClick}>
          Add
        </Button>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
      expect(onClick).not.toHaveBeenCalled();
    });

    it('keeps the not-allowed cursor when a call site overrides the opacity', () => {
      // twMerge drops the base opacity in favour of the override — the cursor must survive it.
      render(
        <Button disabled className="disabled:opacity-30">
          Add
        </Button>,
      );
      const btn = screen.getByRole('button', { name: 'Add' });
      expect(btn.className).toContain('disabled:cursor-not-allowed');
      expect(btn.className).toContain('disabled:opacity-30');
      expect(btn.className).not.toContain('disabled:opacity-50');
    });
  });

  it('disables itself while loading', () => {
    render(<Button loading>Add</Button>);
    expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty('disabled', true);
  });
});
