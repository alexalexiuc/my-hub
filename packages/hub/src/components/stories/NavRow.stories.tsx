import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NavRow } from '../NavRow';

const meta: Meta<typeof NavRow> = {
  title: 'Components/NavRow',
  component: NavRow,
  tags: ['autodocs'],
  args: {
    prevLabel: 'Previous',
    nextLabel: 'Next',
    onPrev: () => undefined,
    onNext: () => undefined,
    label: <h2 className="flex-1 text-center text-[22px] font-bold text-[var(--text)] md:flex-none md:w-44">Item</h2>,
  },
};

export default meta;
type Story = StoryObj<typeof NavRow>;

export const Default: Story = {};

export const WithDisabledPrev: Story = {
  args: { prevDisabled: true },
};

export const WithTrailing: Story = {
  args: { trailing: <span className="text-xs text-[var(--subtle)]">1 / 3</span> },
};

export const NoArrows: Story = {
  args: { onPrev: undefined, onNext: undefined },
};

export const FullBleed: Story = {
  args: { fullBleed: true },
};
