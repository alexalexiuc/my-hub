import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeGallery } from './ThemeGallery';

describe('ThemeGallery', () => {
  it('shows the current theme’s name and swatch', () => {
    render(<ThemeGallery value="violet-soft" onChange={vi.fn()} />);
    expect(screen.getByText('Violet Soft')).toBeTruthy();
  });

  it('steps forward and wraps around at the end of the list', () => {
    const onChange = vi.fn();
    // The last key in THEME_OPTIONS order is teal-deep (Slate sorts after Teal); stepping Next
    // from there must wrap back to the very first key rather than going out of bounds.
    render(<ThemeGallery value="slate-deep" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next theme' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange.mock.calls[0]?.[0]).toBe('graphite-signature');
  });

  it('steps backward from the first key to the last', () => {
    const onChange = vi.fn();
    render(<ThemeGallery value="graphite-signature" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous theme' }));
    expect(onChange).toHaveBeenCalledWith('slate-deep');
  });

  it('steps on ArrowRight/ArrowLeft dispatched on window, not just on a focused descendant', () => {
    // Regression test: the previous implementation attached onKeyDown to a plain, non-focusable
    // div, so pressing an arrow key did nothing unless the user had already tabbed to something
    // inside it. The fix listens on window instead — this simulates a keypress with no element
    // in the gallery focused at all, matching what a user sees on first load.
    const onChange = vi.fn();
    render(<ThemeGallery value="rose-classic" onChange={onChange} />);
    expect(document.activeElement === document.body || document.activeElement === null).toBe(true);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('rose-deep');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('rose-soft');
  });

  it('ignores arrow keys typed into a text field elsewhere on the page', () => {
    const onChange = vi.fn();
    render(
      <div>
        <input type="text" data-testid="unrelated-input" />
        <ThemeGallery value="rose-classic" onChange={onChange} />
      </div>,
    );
    const input = screen.getByTestId('unrelated-input');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('jumps straight to a theme clicked in the swatch grid', () => {
    const onChange = vi.fn();
    render(<ThemeGallery value="graphite-signature" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ocean Deep' }));
    expect(onChange).toHaveBeenCalledWith('ocean-deep');
  });

  it('marks the active swatch as pressed for assistive tech', () => {
    render(<ThemeGallery value="teal-classic" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Teal Classic' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Teal Soft' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('removes its window keydown listener on unmount', () => {
    const onChange = vi.fn();
    const { unmount } = render(<ThemeGallery value="rose-classic" onChange={onChange} />);
    unmount();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
