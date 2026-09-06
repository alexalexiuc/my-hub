import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemePicker } from './ThemePicker';

describe('ThemePicker', () => {
  it('selects the hue at the current mood', () => {
    const onChange = vi.fn();
    render(<ThemePicker value="rose-deep" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ocean' }));
    expect(onChange).toHaveBeenCalledWith('ocean-deep');
  });

  it('defaults to the classic mood when nothing is selected yet', () => {
    const onChange = vi.fn();
    render(<ThemePicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Teal' }));
    expect(onChange).toHaveBeenCalledWith('teal-classic');
  });

  it('keeps the hue when changing mood', () => {
    const onChange = vi.fn();
    render(<ThemePicker value="ocean-soft" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deep' }));
    expect(onChange).toHaveBeenCalledWith('ocean-deep');
  });

  it('disables the mood row until a hue is chosen, since mood alone means nothing', () => {
    render(<ThemePicker value={null} onChange={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Soft' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('marks the active hue and mood as pressed', () => {
    render(<ThemePicker value="lime-deep" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Lime' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Deep' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Soft' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('offers the signature presets and reports them verbatim', () => {
    const onChange = vi.fn();
    render(<ThemePicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Finances Violet/ }));
    expect(onChange).toHaveBeenCalledWith('finances-signature');
  });

  it('shows an inherit chip only when the scope can inherit, and reports it separately', () => {
    const onInherit = vi.fn();
    const { rerender } = render(<ThemePicker value={null} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Same as everything' })).toBeNull();

    rerender(<ThemePicker value={null} onChange={vi.fn()} inheritLabel="Same as everything" onInherit={onInherit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Same as everything' }));
    expect(onInherit).toHaveBeenCalledOnce();
  });

  it('treats a signature selection as having no hue, so the mood row stays inert', () => {
    render(<ThemePicker value="travel-signature" onChange={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Classic' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
