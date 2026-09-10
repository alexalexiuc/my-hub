import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CopyButton } from '../CopyButton';

const meta: Meta<typeof CopyButton> = {
  title: 'Components/CopyButton',
  component: CopyButton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CopyButton>;

export const Default: Story = {
  args: { value: 'abc-123-xyz' },
};

export const CustomLabel: Story = {
  args: { value: 'abc-123-xyz', label: 'Copy ID' },
};
