import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { themeClassName, THEME_HUES, THEME_MOODS, type ThemeKey } from '@my-hub/shared/constants';
import { ThemeSamplePreview } from '../ThemeSamplePreview';

const meta: Meta<typeof ThemeSamplePreview> = {
  title: 'Components/ThemeSamplePreview',
  component: ThemeSamplePreview,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The live-preview panel used by the Appearance gallery page: real, already-themed ' +
          'components — not a mockup — so a theme can be judged by how it actually renders.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ThemeSamplePreview>;

function Themed({ themeKey, children }: { themeKey: ThemeKey; children: React.ReactNode }) {
  return (
    <div className={`${themeClassName(themeKey)} rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5`}>
      {children}
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <Themed themeKey="finances-signature">
      <ThemeSamplePreview />
    </Themed>
  ),
};

/** The same fixed content under every generated palette, to eyeball harmony and legibility at once. */
export const AllPalettes: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
      {THEME_HUES.flatMap(hue =>
        THEME_MOODS.map(mood => {
          const key = `${hue.key}-${mood.key}` as ThemeKey;
          return (
            <Themed key={key} themeKey={key}>
              <ThemeSamplePreview />
            </Themed>
          );
        }),
      )}
    </div>
  ),
};
