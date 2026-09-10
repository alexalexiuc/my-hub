import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeSwatch } from './ThemeSwatch';

describe('ThemeSwatch', () => {
  it('renders a chip coloured from the theme’s registered swatch', () => {
    const { container } = render(<ThemeSwatch themeKey="violet-soft" />);
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.style.backgroundColor).not.toBe('');
    expect(chip.style.boxShadow).toContain('inset');
  });

  it('falls back to a default swatch for an unrecognised key rather than rendering blank', () => {
    const { container } = render(<ThemeSwatch themeKey={'not-a-real-key' as never} />);
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.style.backgroundColor).not.toBe('');
  });

  it('scales the ring width with size so small swatches stay legible', () => {
    const { container: sm } = render(<ThemeSwatch themeKey="ocean-deep" size="sm" />);
    const { container: lg } = render(<ThemeSwatch themeKey="ocean-deep" size="lg" />);
    const smChip = sm.firstElementChild as HTMLElement;
    const lgChip = lg.firstElementChild as HTMLElement;
    expect(smChip.style.boxShadow).toContain('2px');
    expect(lgChip.style.boxShadow).toContain('4px');
  });

  it('is decorative and hidden from assistive tech', () => {
    const { container } = render(<ThemeSwatch themeKey="teal-classic" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
});
