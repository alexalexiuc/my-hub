import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeatureTheme } from './FeatureTheme';
import { ThemeProvider } from './ThemeProvider';

function renderThemed(feature: 'travel' | 'finances' | 'calories', overrides = {}) {
  const { container } = render(
    <ThemeProvider initial={overrides}>
      <FeatureTheme feature={feature} className="flex h-screen">
        <span>content</span>
      </FeatureTheme>
    </ThemeProvider>,
  );
  return container.firstElementChild as HTMLElement;
}

describe('FeatureTheme', () => {
  it('applies the feature’s signature theme class by default', () => {
    expect(renderThemed('travel').className).toContain('travel-theme');
  });

  it('applies a feature override in preference to global', () => {
    const el = renderThemed('finances', { global: 'ocean-deep', finances: 'rose-soft' });
    expect(el.className).toContain('rose-soft-theme');
    expect(el.className).not.toContain('ocean-deep-theme');
  });

  it('inherits the global theme when the feature has no override', () => {
    expect(renderThemed('calories', { global: 'ocean-deep' }).className).toContain('ocean-deep-theme');
  });

  it('carries a stable data-feature attribute regardless of the active theme', () => {
    // globals.css keys its iOS input-zoom rule off this attribute precisely because the theme
    // class is no longer fixed per feature.
    expect(renderThemed('finances', { finances: 'lime-deep' }).dataset.feature).toBe('finances');
  });

  it('merges the caller’s className alongside the theme class', () => {
    const cls = renderThemed('travel').className;
    expect(cls).toContain('flex');
    expect(cls).toContain('h-screen');
  });

  it('always emits a class ending in -theme so usePortalTheme can re-apply it to portals', () => {
    const cls = renderThemed('travel', { global: 'fuchsia-classic' }).className;
    expect(cls.split(/\s+/).some(c => /-theme$/.test(c))).toBe(true);
  });
});
