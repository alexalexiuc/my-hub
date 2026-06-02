import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MultiSelect } from '../MultiSelect';

const options = [
  { id: 'food', value: 'Food' },
  { id: 'transport', value: 'Transport' },
  { id: 'health', value: 'Health' },
  { id: 'entertainment', value: 'Entertainment' },
  { id: 'utilities', value: 'Utilities' },
];

const meta: Meta<typeof MultiSelect> = {
  title: 'Components/MultiSelect',
  component: MultiSelect,
  tags: ['autodocs'],
  args: {
    options,
    value: [],
    onChange: () => undefined,
    placeholder: 'Add categories…',
  },
};

export default meta;
type Story = StoryObj<typeof MultiSelect>;

export const Empty: Story = {};

export const WithSelected: Story = {
  args: { value: ['food', 'health'] },
};

export const AllSelected: Story = {
  args: { value: ['food', 'transport', 'health', 'entertainment', 'utilities'] },
};
