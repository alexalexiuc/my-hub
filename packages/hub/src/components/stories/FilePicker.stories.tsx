import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FilePicker } from '../FilePicker';

const meta: Meta<typeof FilePicker> = {
  title: 'Components/FilePicker',
  component: FilePicker,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FilePicker>;

export const Default: Story = {};

export const AcceptImages: Story = {
  args: { accept: 'image/*' },
};

export const Multiple: Story = {
  args: { multiple: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};
