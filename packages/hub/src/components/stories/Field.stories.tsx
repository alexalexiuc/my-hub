import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Field } from '../Field';
import { Input } from '../Input';
import { Select } from '../Select';

const meta: Meta<typeof Field> = {
  title: 'Components/Field',
  component: Field,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Field>;

export const WithInput: Story = {
  args: {
    label: 'Email address',
    children: <Input type="email" placeholder="you@example.com" />,
  },
};

export const WithSelect: Story = {
  args: {
    label: 'Category',
    children: (
      <Select
        options={[
          { value: 'a', label: 'Option A' },
          { value: 'b', label: 'Option B' },
        ]}
      />
    ),
  },
};
