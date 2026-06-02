import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Card } from '../Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  args: { children: 'Card content goes here.' },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {};

export const Compact: Story = {
  args: { children: 'Compact card — bordered at all breakpoints.', compact: true },
};

export const Clickable: Story = {
  args: { children: 'Click me.', onClick: () => undefined },
};
