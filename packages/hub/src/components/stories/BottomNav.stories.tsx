import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BottomNav } from '../BottomNav';

const leftItems = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/', exact: true },
  { id: 'budget', icon: '💰', label: 'Budget', path: '/finances/budget' },
];

const rightItems = [
  { id: 'settings', icon: '⚙️', label: 'Settings', path: '/settings' },
  { id: 'profile', icon: '👤', label: 'Profile', path: '/profile' },
];

const meta: Meta<typeof BottomNav> = {
  title: 'Components/BottomNav',
  component: BottomNav,
  tags: ['autodocs'],
  args: { leftItems, rightItems },
};

export default meta;
type Story = StoryObj<typeof BottomNav>;

export const Default: Story = {};

export const WithFab: Story = {
  args: {
    rightItems: [],
    fab: { label: 'Add', onClick: () => undefined },
  },
};

export const WithMoreItems: Story = {
  args: {
    moreItems: [
      { id: 'reports', icon: '📊', label: 'Reports', path: '/reports' },
      { id: 'goals', icon: '🎯', label: 'Goals', path: '/goals' },
    ],
  },
};
