import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../Button';
import { PageHeader } from '../PageHeader';

const meta: Meta<typeof PageHeader> = {
  title: 'Components/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const TitleOnly: Story = {
  args: { title: 'My Travels' },
};

export const WithBackLink: Story = {
  args: {
    title: 'Trip details',
    backHref: '#',
    backLabel: 'Back to trips',
  },
};

export const WithActions: Story = {
  args: {
    title: 'API Clients',
    actions: <Button size="sm">Add client</Button>,
  },
};

export const WithBackAndActions: Story = {
  args: {
    title: 'Edit flight',
    backHref: '#',
    backLabel: 'Back to trip',
    actions: (
      <>
        <Button variant="secondary" size="sm">
          Cancel
        </Button>
        <Button size="sm">Save</Button>
      </>
    ),
  },
};
