import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    children: 'Click me',
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Danger: Story = {
  args: { variant: 'danger' },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
};

export const Transparent: Story = {
  args: { variant: 'transparent' },
};

export const Small: Story = {
  args: { size: 'sm' },
};

export const ExtraSmall: Story = {
  args: { size: 'xs' },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};
