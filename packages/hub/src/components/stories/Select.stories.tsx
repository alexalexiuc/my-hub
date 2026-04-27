import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Select } from '../Select';

const sampleOptions = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: { options: sampleOptions },
};

export const WithPlaceholder: Story = {
  args: {
    options: sampleOptions,
    children: <option value="">-- Choose one --</option>,
  },
};

export const Disabled: Story = {
  args: { options: sampleOptions, disabled: true, defaultValue: 'banana' },
};
