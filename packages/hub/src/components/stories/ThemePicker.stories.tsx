import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import type { ThemeKey } from '@my-hub/shared/constants';
import { FeatureTheme } from '../FeatureTheme';
import { ThemePicker } from '../ThemePicker';
import { ThemeProvider, useThemes } from '../ThemeProvider';

const meta: Meta<typeof ThemePicker> = {
  title: 'Components/ThemePicker',
  component: ThemePicker,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A single dropdown listing every theme by name, with the palette in effect shown as a ' +
          'swatch. The original hand-tuned palettes come first, then each accent colour’s three ' +
          'depths grouped together. Per-feature pickers also offer an inherit choice.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ThemePicker>;

function Standalone({ initial, inherit }: { initial: ThemeKey | null; inherit?: boolean }) {
  const [value, setValue] = useState<ThemeKey | null>(initial);
  return (
    <div className="max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <ThemePicker
        value={value}
        onChange={setValue}
        effectiveKey="finances-signature"
        inheritLabel={inherit ? 'Same as everything' : undefined}
        onInherit={inherit ? () => setValue(null) : undefined}
      />
      <p className="mt-4 font-mono text-xs text-[var(--muted)]">value: {value ?? 'null (inheriting)'}</p>
    </div>
  );
}

/** The global picker: no inherit option, since there is nothing broader to inherit from. */
export const Global: Story = {
  render: () => (
    <ThemeProvider initial={{}}>
      <FeatureTheme feature="finances" className="bg-[var(--bg)] p-4">
        <Standalone initial="violet-soft" />
      </FeatureTheme>
    </ThemeProvider>
  ),
};

/** A per-feature picker, which can fall back to the global choice. */
export const WithInherit: Story = {
  render: () => (
    <ThemeProvider initial={{}}>
      <FeatureTheme feature="travel" className="bg-[var(--bg)] p-4">
        <Standalone initial={null} inherit />
      </FeatureTheme>
    </ThemeProvider>
  ),
};

/** Wired to the live provider, so picking repaints the surrounding chrome immediately. */
function LivePreview() {
  const { themes, setTheme } = useThemes();
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <ThemePicker value={themes.global} onChange={key => setTheme('global', key)} />
      <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--card2)] p-4">
        <p className="text-lg font-semibold text-[var(--text)]">Live preview</p>
        <p className="text-xs text-[var(--muted)]">Secondary text picks up the accent hue.</p>
        <p className="text-[11px] text-[var(--subtle)]">Tertiary text stays legible at every preset.</p>
        <button className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)]">
          Primary action
        </button>
      </div>
    </div>
  );
}

export const LiveApplication: Story = {
  render: () => (
    <ThemeProvider initial={{}}>
      <FeatureTheme feature="finances" className="bg-[var(--bg)] p-4">
        <LivePreview />
      </FeatureTheme>
    </ThemeProvider>
  ),
};
