import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { YearNav } from '../YearNav';

const meta: Meta<typeof YearNav> = {
  title: 'Components/YearNav',
  component: YearNav,
  tags: ['autodocs'],
  args: {
    year: 2026,
    onChange: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof YearNav>;

export const Default: Story = {};

export const AtMaxYear: Story = {
  args: { maxYear: 2026 },
};

export const WithThisYearPill: Story = {
  args: { year: 2023, currentYear: 2026 },
};

export const WithTrailing: Story = {
  args: { trailing: <span className="text-xs text-[var(--subtle)]">12 months</span> },
};

export const FullBleed: Story = {
  args: { fullBleed: true },
};
