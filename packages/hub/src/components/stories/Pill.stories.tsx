import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Pill } from '../Pill';

const meta: Meta<typeof Pill> = {
  title: 'Components/Pill',
  component: Pill,
  tags: ['autodocs'],
  args: {
    label: 'Groceries',
    color: '#0f766e',
  },
};

export default meta;
type Story = StoryObj<typeof Pill>;

export const Default: Story = {};

export const WithIcon: Story = {
  args: {
    icon: '🛒',
  },
};

export const Clickable: Story = {
  args: {
    icon: '🏷',
    label: 'Filter by tag',
    color: '#2563eb',
    onClick: () => undefined,
  },
};

export const DisabledClickable: Story = {
  args: {
    icon: '🔒',
    label: 'Locked',
    color: '#9333ea',
    onClick: () => undefined,
    disabled: true,
  },
};
