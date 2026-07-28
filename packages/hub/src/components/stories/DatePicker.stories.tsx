import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DatePicker } from '../DatePicker';

const meta: Meta<typeof DatePicker> = {
  title: 'Components/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  args: {
    month: '2026-06',
    onChange: () => undefined,
    currentMonth: '2026-06',
  },
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {};

export const PastMonth: Story = {
  args: { month: '2026-03' },
};

export const WithExtendedFilters: Story = {
  args: { extendedFilters: true, dateMode: 'month' },
};

export const RangeMode: Story = {
  args: {
    extendedFilters: true,
    dateMode: 'range',
    fromDate: '2026-03-01',
    toDate: '2026-03-31',
  },
};

export const AllTime: Story = {
  args: { extendedFilters: true, dateMode: 'all' },
};

export const WeekMode: Story = {
  args: { month: '2026-06-01', dateMode: 'week', currentMonth: undefined, minMonth: '2026-06-01' },
};
