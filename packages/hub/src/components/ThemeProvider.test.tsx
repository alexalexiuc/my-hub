import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME_BY_SCOPE } from '@my-hub/shared/constants';
import { ThemeProvider, useThemes, resolveThemeOverrides } from './ThemeProvider';

function Probe() {
  const { themes, setTheme } = useThemes();
  return (
    <div>
      <span data-testid="global">{themes.global}</span>
      <span data-testid="travel">{themes.travel}</span>
      <span data-testid="finances">{themes.finances}</span>
      <button onClick={() => setTheme('global', 'ocean-deep')}>set global</button>
      <button onClick={() => setTheme('travel', 'rose-soft')}>set travel</button>
      <button onClick={() => setTheme('travel', null)}>clear travel</button>
    </div>
  );
}

const shown = (id: string) => screen.getByTestId(id).textContent;

describe('resolveThemeOverrides', () => {
  it('falls back to each scope’s own default when nothing is stored', () => {
    expect(resolveThemeOverrides({})).toEqual(DEFAULT_THEME_BY_SCOPE);
  });

  it('cascades a global override to features that have none', () => {
    const resolved = resolveThemeOverrides({ global: 'ocean-deep' });
    expect(resolved.global).toBe('ocean-deep');
    expect(resolved.travel).toBe('ocean-deep');
    expect(resolved.calories).toBe('ocean-deep');
  });

  it('lets a feature override win over global', () => {
    const resolved = resolveThemeOverrides({ global: 'ocean-deep', travel: 'rose-soft' });
    expect(resolved.travel).toBe('rose-soft');
    expect(resolved.finances).toBe('ocean-deep');
  });
});

describe('ThemeProvider', () => {
  it('seeds from the server-provided overrides', () => {
    render(
      <ThemeProvider initial={{ finances: 'violet-soft' }}>
        <Probe />
      </ThemeProvider>,
    );
    expect(shown('finances')).toBe('violet-soft');
    expect(shown('travel')).toBe(DEFAULT_THEME_BY_SCOPE.travel);
  });

  it('re-derives inherited scopes when the global theme changes', () => {
    render(
      <ThemeProvider initial={{}}>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('set global'));

    // The whole point of storing raw overrides rather than the resolved map: a feature the user
    // never explicitly set must follow the new global instead of staying on its own default.
    expect(shown('global')).toBe('ocean-deep');
    expect(shown('travel')).toBe('ocean-deep');
  });

  it('keeps an explicit feature override pinned when global changes, and restores inheritance on clear', () => {
    render(
      <ThemeProvider initial={{}}>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('set travel'));
    fireEvent.click(screen.getByText('set global'));
    expect(shown('travel')).toBe('rose-soft');

    fireEvent.click(screen.getByText('clear travel'));
    expect(shown('travel')).toBe('ocean-deep');
  });

  it('throws when useThemes is called outside a provider', () => {
    // React logs the failed render; silence it for this expected throw.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/must be used within a ThemeProvider/);
    spy.mockRestore();
  });
});
