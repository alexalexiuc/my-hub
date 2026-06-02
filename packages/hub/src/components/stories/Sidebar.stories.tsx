import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../Button';
import { Sidebar } from '../Sidebar';

const items = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/finances', exact: true },
  { id: 'budget', label: 'Budget', icon: '💰', path: '/finances/budget' },
  { id: 'cashflow', label: 'Cash Flow', icon: '💸', path: '/finances/cashflow' },
  { id: 'settings', label: 'Settings', icon: '⚙️', path: '/finances/settings', dividerBefore: true },
];

const meta: Meta<typeof Sidebar> = {
  title: 'Components/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  args: { items },
};

export default meta;
type Story = StoryObj<typeof Sidebar>;

export const Default: Story = {};

export const WithHeader: Story = {
  args: { header: <span className="text-sm font-bold text-[var(--text)]">My Budget</span> },
};

export const WithAction: Story = {
  args: {
    action: (
      <Button variant="accent" size="sm" className="w-full">
        + New budget
      </Button>
    ),
  },
};
