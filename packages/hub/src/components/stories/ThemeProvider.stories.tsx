import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { THEME_HUES, THEME_MOODS, THEME_SCOPES, type ThemeKey } from '@my-hub/shared/constants';
import { FeatureTheme } from '../FeatureTheme';
import { ThemeProvider, useThemes, type ThemeOverrides } from '../ThemeProvider';

const meta: Meta<typeof ThemeProvider> = {
  title: 'Components/ThemeProvider',
  component: ThemeProvider,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Holds the user’s raw stored theme overrides and derives the resolved theme for every scope ' +
          '(feature override → global override → that feature’s own default). Storing raw overrides ' +
          'rather than the resolved map is what lets a change to the global theme flow through to ' +
          'features the user never explicitly set.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ThemeProvider>;

/** Live view of the resolution rule: change global and watch which scopes follow. */
function ResolutionDemo() {
  const { themes, setTheme } = useThemes();
  const [pinnedTravel, setPinnedTravel] = useState(false);

  return (
    <div className="space-y-3 bg-[var(--bg)] p-4 text-[var(--text)]">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-[var(--muted)]">Global</label>
        <select
          className="rounded border border-[var(--border)] bg-[var(--card2)] px-2 py-1 text-xs text-[var(--text)]"
          value={themes.global}
          onChange={e => setTheme('global', e.target.value as ThemeKey)}
        >
          {THEME_HUES.flatMap(h => THEME_MOODS.map(m => `${h.key}-${m.key}`)).map(k => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button
          className="rounded border border-[var(--border)] bg-[var(--card2)] px-2 py-1 text-xs text-[var(--muted)]"
          onClick={() => {
            setTheme('travel', pinnedTravel ? null : 'lime-classic');
            setPinnedTravel(p => !p);
          }}
        >
          {pinnedTravel ? 'Clear travel override' : 'Pin travel to lime-classic'}
        </button>
      </div>

      <table className="text-xs">
        <tbody>
          {THEME_SCOPES.map(({ key, label }) => (
            <tr key={key}>
              <td className="pr-4 text-[var(--muted)]">{label}</td>
              <td className="font-mono text-[var(--accent)]">{themes[key]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const ResolutionRule: Story = {
  render: () => (
    <ThemeProvider initial={{}}>
      <FeatureTheme feature="finances">
        <ResolutionDemo />
      </FeatureTheme>
    </ThemeProvider>
  ),
};

/** Seeded from the server exactly as the root layout does it. */
export const SeededFromServer: Story = {
  render: () => {
    const overrides: ThemeOverrides = { global: 'ocean-deep', calories: 'rose-soft' };
    return (
      <ThemeProvider initial={overrides}>
        <FeatureTheme feature="calories">
          <ResolutionDemo />
        </FeatureTheme>
      </ThemeProvider>
    );
  },
};
