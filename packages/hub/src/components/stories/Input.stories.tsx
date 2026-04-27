import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Input } from '../Input';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text…' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', placeholder: 'Ghost input…' },
};

export const WithValue: Story = {
  args: { defaultValue: 'Hello world' },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Read-only value' },
};

export const Password: Story = {
  args: { type: 'password', placeholder: 'Password…' },
};

export const Number: Story = {
  args: { type: 'number', placeholder: '0' },
};
