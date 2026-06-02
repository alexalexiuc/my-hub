import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SearchableSelect } from '../SearchableSelect';

const options = [
  { id: 'apple', value: 'Apple' },
  { id: 'banana', value: 'Banana' },
  { id: 'cherry', value: 'Cherry' },
  { id: 'date', value: 'Date' },
  { id: 'elderberry', value: 'Elderberry' },
];

const meta: Meta<typeof SearchableSelect> = {
  title: 'Components/SearchableSelect',
  component: SearchableSelect,
  tags: ['autodocs'],
  args: {
    options,
    onChange: () => undefined,
    placeholder: 'Search fruits…',
  },
};

export default meta;
type Story = StoryObj<typeof SearchableSelect>;

export const Default: Story = {};

export const WithSelectedValue: Story = {
  args: { value: 'banana' },
};

export const NonSearchable: Story = {
  args: { searchable: false, placeholder: 'Select a fruit' },
};

export const Clearable: Story = {
  args: { value: 'cherry', clearable: true },
};

export const FuzzySearch: Story = {
  args: { fuse: true },
};
