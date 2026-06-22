import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Collapsible } from '../Collapsible';

const meta: Meta<typeof Collapsible> = {
  title: 'Components/Collapsible',
  component: Collapsible,
  tags: ['autodocs'],
  args: {
    label: 'Section title',
    children: <p className="text-sm text-[var(--text)]">Collapsible content goes here.</p>,
  },
};

export default meta;
type Story = StoryObj<typeof Collapsible>;

export const Box: Story = {
  args: { variant: 'box' },
};

export const BoxCollapsed: Story = {
  name: 'Box / Collapsed',
  args: { variant: 'box', defaultOpen: false },
};

export const Text: Story = {
  args: { variant: 'text' },
};

export const TextCollapsed: Story = {
  name: 'Text / Collapsed',
  args: { variant: 'text', defaultOpen: false },
};

export const WithLeadingAndActions: Story = {
  name: 'Text / Leading + Actions',
  args: {
    variant: 'text',
    leading: <div className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[var(--accent)]" />,
    actions: <span className="text-[11px] font-semibold text-[var(--muted)]">$120 / $300</span>,
  },
};

export const NoIcon: Story = {
  name: 'Text / No icon',
  args: { variant: 'text', showIcon: false },
};
