import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Sparkline } from '../Sparkline';

const meta: Meta<typeof Sparkline> = {
  title: 'Components/Sparkline',
  component: Sparkline,
  tags: ['autodocs'],
  args: { color: '#7c3aed', width: 120, height: 36 },
};

export default meta;
type Story = StoryObj<typeof Sparkline>;

export const Default: Story = {
  args: { data: [10, 40, 20, 80, 50, 90, 30, 60, 45, 70] },
};

export const Flat: Story = {
  args: { data: [50, 50, 50, 50, 50] },
};

export const Minimal: Story = {
  args: { data: [10, 90] },
};

export const InsufficientData: Story = {
  args: { data: [42] },
};
