import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MobileSelectSheet } from '../MobileSelectSheet';
import type { DropdownOption } from '../searchableSelect.utils';

const options: DropdownOption[] = [
  { id: 'food', value: 'Food' },
  { id: 'transport', value: 'Transport' },
  { id: 'health', value: 'Health' },
  { id: 'entertainment', value: 'Entertainment' },
  { id: 'utilities', value: 'Utilities' },
];

const meta: Meta<typeof MobileSelectSheet> = {
  title: 'Components/MobileSelectSheet',
  component: MobileSelectSheet,
  tags: ['autodocs'],
  args: {
    options,
    onChange: () => undefined,
    onClose: () => undefined,
    title: 'Select category',
  },
};

export default meta;
type Story = StoryObj<typeof MobileSelectSheet>;

export const Default: Story = {};

export const WithSelectedValue: Story = {
  args: { value: 'food', clearable: true },
};

export const NonSearchable: Story = {
  args: { searchable: false },
};
