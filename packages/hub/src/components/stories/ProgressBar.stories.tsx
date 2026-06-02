import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProgressBar } from '../ProgressBar';

const meta: Meta<typeof ProgressBar> = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
  args: { max: 100, height: 8 },
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Low: Story = { args: { value: 30 } };
export const Medium: Story = { args: { value: 60 } };
export const Amber: Story = { args: { value: 85 } };
export const Full: Story = { args: { value: 100 } };
export const Over: Story = { args: { value: 130 } };
export const CustomColor: Story = {
  args: { value: 55, color: 'var(--accent)', thresholds: false },
};
