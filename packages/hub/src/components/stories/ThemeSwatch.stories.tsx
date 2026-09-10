import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ThemeSwatch } from '../ThemeSwatch';

const meta: Meta<typeof ThemeSwatch> = {
  title: 'Components/ThemeSwatch',
  component: ThemeSwatch,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A round chip showing a theme’s background ringed by its accent colour.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ThemeSwatch>;

export const Default: Story = {
  args: { themeKey: 'violet-soft' },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-3">
      <ThemeSwatch themeKey="ocean-deep" size="sm" />
      <ThemeSwatch themeKey="ocean-deep" size="md" />
      <ThemeSwatch themeKey="ocean-deep" size="lg" />
    </div>
  ),
};

export const AcrossHues: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['emerald-classic', 'amber-classic', 'rose-classic', 'ocean-classic', 'violet-classic'] as const).map(key => (
        <ThemeSwatch key={key} themeKey={key} />
      ))}
    </div>
  ),
};
