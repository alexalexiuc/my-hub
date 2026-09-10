import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { THEME_HUES, THEME_MOODS, type ThemeKey } from '@my-hub/shared/constants';
import { FeatureTheme } from '../FeatureTheme';
import { ThemeProvider, type ThemeOverrides } from '../ThemeProvider';

/** A compact but realistic slice of app chrome, painted entirely from the 32 theme tokens. */
function Sample({ title }: { title: string }) {
  return (
    <div className="min-h-[220px] bg-[var(--bg)] p-4">
      <div className="mb-3 flex items-center gap-2 border-b border-[var(--border)] pb-2">
        <span className="text-[13px] font-semibold text-[var(--accent)]">Hub</span>
        <span className="text-[var(--border)]">/</span>
        <span className="text-[15px] font-semibold text-[var(--text)]">{title}</span>
      </div>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="text-lg font-semibold text-[var(--text)]">£2,480.15</p>
        <p className="text-xs text-[var(--muted)]">Across 62 transactions</p>
        <p className="text-[11px] text-[var(--subtle)]">Updated 4 minutes ago</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--card3)]">
          <div className="h-full w-2/3 bg-[var(--accent)]" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--on-accent)]">
          Save
        </button>
        <button className="rounded-lg border border-[var(--border)] bg-[var(--card2)] px-3 py-1.5 text-xs text-[var(--muted)]">
          Cancel
        </button>
        <span className="text-xs text-[var(--green)]">+£120</span>
        <span className="text-xs text-[var(--red)]">−£48</span>
        <span className="text-xs text-[var(--amber)]">pending</span>
      </div>
    </div>
  );
}

const meta: Meta<typeof FeatureTheme> = {
  title: 'Components/FeatureTheme',
  component: FeatureTheme,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Wraps a feature subtree in the user’s resolved theme class plus a stable `data-feature` ' +
          'attribute. The class always ends in `-theme` so `usePortalTheme` can copy it onto portaled modals.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FeatureTheme>;

function Themed({ overrides, feature }: { overrides: ThemeOverrides; feature: 'travel' | 'finances' | 'calories' }) {
  return (
    <ThemeProvider initial={overrides}>
      <FeatureTheme feature={feature}>
        <Sample title={feature} />
      </FeatureTheme>
    </ThemeProvider>
  );
}

/** Nothing stored: each feature keeps the signature palette it ships with today. */
export const SignatureDefaults: Story = {
  render: () => (
    <div className="grid gap-3 md:grid-cols-3">
      <Themed overrides={{}} feature="travel" />
      <Themed overrides={{}} feature="finances" />
      <Themed overrides={{}} feature="calories" />
    </div>
  ),
};

/** A global choice cascades to every feature that has no override of its own. */
export const GlobalCascade: Story = {
  render: () => (
    <div className="grid gap-3 md:grid-cols-3">
      <Themed overrides={{ global: 'ocean-deep' }} feature="travel" />
      <Themed overrides={{ global: 'ocean-deep' }} feature="finances" />
      <Themed overrides={{ global: 'ocean-deep' }} feature="calories" />
    </div>
  ),
};

/** A per-feature override wins over the global choice. */
export const FeatureOverride: Story = {
  render: () => (
    <div className="grid gap-3 md:grid-cols-3">
      <Themed overrides={{ global: 'ocean-deep', travel: 'lime-classic' }} feature="travel" />
      <Themed overrides={{ global: 'ocean-deep' }} feature="finances" />
      <Themed overrides={{ global: 'ocean-deep', calories: 'rose-soft' }} feature="calories" />
    </div>
  ),
};

/** Every generated palette, so the whole set can be eyeballed for harmony and legibility at once. */
export const AllPalettes: Story = {
  render: () => (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
      {THEME_HUES.flatMap(hue =>
        THEME_MOODS.map(mood => {
          const key = `${hue.key}-${mood.key}` as ThemeKey;
          return (
            <ThemeProvider key={key} initial={{ global: key }}>
              <FeatureTheme feature="finances">
                <Sample title={key} />
              </FeatureTheme>
            </ThemeProvider>
          );
        }),
      )}
    </div>
  ),
};
