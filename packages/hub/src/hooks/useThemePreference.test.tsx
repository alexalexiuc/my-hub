import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useThemes } from '@/components/ThemeProvider';
import { useThemePreference } from './useThemePreference';

function makeFetch(status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: { get: () => null },
    text: () => Promise.resolve('{}'),
    json: () => Promise.resolve({}),
  });
}

function Probe() {
  const { persist, savingScope } = useThemePreference();
  const { themes } = useThemes();
  return (
    <div>
      <span data-testid="saving">{savingScope ?? 'idle'}</span>
      <span data-testid="global">{themes.global}</span>
      <button onClick={() => persist('global', 'ocean-deep')}>persist global</button>
      <button onClick={() => persist('travel', null)}>clear travel</button>
    </div>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('useThemePreference', () => {
  it('applies the choice to the live provider synchronously, before the request resolves', () => {
    global.fetch = makeFetch();
    render(
      <ThemeProvider initial={{}}>
        <Probe />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByText('persist global'));
    // No `await` here on purpose: the repaint must already have happened by the time this line
    // runs, which is the whole point of calling setTheme before the PUT is awaited.
    expect(screen.getByTestId('global').textContent).toBe('ocean-deep');
  });

  it('sends the scope and theme key, with null clearing an override', async () => {
    global.fetch = makeFetch();
    render(
      <ThemeProvider initial={{}}>
        <Probe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText('clear travel'));
    await flush();

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/user/theme-preferences');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({ scope: 'travel', themeKey: null });
  });

  it('tracks which scope is currently saving, and clears it once the request settles', async () => {
    global.fetch = makeFetch();
    render(
      <ThemeProvider initial={{}}>
        <Probe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByText('persist global'));
    await flush();

    expect(screen.getByTestId('saving').textContent).toBe('idle');
  });
});
