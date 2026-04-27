import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../Button';
import { SectionCard } from '../SectionCard';

const meta: Meta<typeof SectionCard> = {
  title: 'Components/SectionCard',
  component: SectionCard,
  tags: ['autodocs'],
  decorators: [
    Story => (
      <div className="p-6 max-w-xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SectionCard>;

export const Default: Story = {
  args: {
    children: <p className="text-sm text-zinc-400">Card body content goes here.</p>,
  },
};

export const WithTitle: Story = {
  args: {
    title: 'Personal details',
    children: <p className="text-sm text-zinc-400">Card body content goes here.</p>,
  },
};

export const WithTitleAndAction: Story = {
  args: {
    title: 'API Clients',
    action: <Button size="sm">Add</Button>,
    children: <p className="text-sm text-zinc-400">No clients yet.</p>,
  },
};

export const WithoutTitle: Story = {
  args: {
    children: <p className="text-sm text-zinc-400">A card without a title — useful for wrapping arbitrary content.</p>,
  },
};
