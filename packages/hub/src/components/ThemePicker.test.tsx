import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { THEME_KEYS } from '@my-hub/shared/constants';
import { ThemePicker } from './ThemePicker';

const select = () => screen.getByRole('combobox', { name: 'Theme' }) as HTMLSelectElement;

describe('ThemePicker', () => {
  it('lists every theme exactly once', () => {
    render(<ThemePicker value="violet-soft" onChange={vi.fn()} />);
    const values = Array.from(select().options).map(o => o.value);
    expect(values).toHaveLength(THEME_KEYS.length);
    expect([...values].sort()).toEqual([...THEME_KEYS].sort());
  });

  it('names themes in plain language rather than by key', () => {
    render(<ThemePicker value="violet-soft" onChange={vi.fn()} />);
    const labels = Array.from(select().options).map(o => o.text);
    expect(labels).toContain('Violet Soft');
    expect(labels).toContain('Ocean Deep');
    expect(labels).toContain('Travel Emerald');
  });

  it('reflects the current selection', () => {
    render(<ThemePicker value="lime-deep" onChange={vi.fn()} />);
    expect(select().value).toBe('lime-deep');
  });

  it('reports the chosen theme key', () => {
    const onChange = vi.fn();
    render(<ThemePicker value="violet-soft" onChange={onChange} />);
    fireEvent.change(select(), { target: { value: 'ocean-deep' } });
    expect(onChange).toHaveBeenCalledWith('ocean-deep');
  });

  it('offers an inherit choice only when the scope can inherit', () => {
    const { rerender } = render(<ThemePicker value={null} onChange={vi.fn()} />);
    expect(Array.from(select().options).some(o => /same as everything/i.test(o.text))).toBe(false);

    rerender(<ThemePicker value={null} onChange={vi.fn()} inheritLabel="Same as everything" onInherit={vi.fn()} />);
    expect(select().value).toBe('__inherit__');
  });

  it('routes the inherit choice to onInherit, not onChange', () => {
    const onChange = vi.fn();
    const onInherit = vi.fn();
    render(
      <ThemePicker value="rose-soft" onChange={onChange} inheritLabel="Same as everything" onInherit={onInherit} />,
    );
    fireEvent.change(select(), { target: { value: '__inherit__' } });
    expect(onInherit).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('groups options so a colour’s depths sit together', () => {
    render(<ThemePicker value="violet-soft" onChange={vi.fn()} />);
    const groups = Array.from(select().querySelectorAll('optgroup')).map(g => g.getAttribute('label'));
    expect(groups[0]).toBe('Original');
    expect(groups).toContain('Violet');
  });

  it('can be disabled while a save is in flight', () => {
    render(<ThemePicker value="teal-classic" onChange={vi.fn()} disabled />);
    expect(select().disabled).toBe(true);
  });
});
