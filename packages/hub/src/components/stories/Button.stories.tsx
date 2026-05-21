import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from '../Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    children: 'Click me',
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Danger: Story = {
  args: { variant: 'danger' },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
};

export const Transparent: Story = {
  args: { variant: 'transparent' },
};

export const Accent: Story = {
  args: { variant: 'accent' },
};

export const Neutral: Story = {
  args: { variant: 'neutral' },
};

export const FinPill: Story = {
  args: { variant: 'fin-pill', children: 'Today' },
};

export const Small: Story = {
  args: { size: 'sm' },
};

export const ExtraSmall: Story = {
  args: { size: 'xs' },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const ActivePrimary: Story = {
  name: 'Active / Primary',
  render: args => (
    <div className="flex gap-3">
      <Button {...args} active={false}>
        Inactive
      </Button>
      <Button {...args} active={true}>
        Active
      </Button>
    </div>
  ),
  args: { variant: 'primary' },
};

export const ActiveGhost: Story = {
  name: 'Active / Ghost',
  render: args => (
    <div className="flex gap-3">
      <Button {...args} active={false}>
        Inactive
      </Button>
      <Button {...args} active={true}>
        Active
      </Button>
    </div>
  ),
  args: { variant: 'ghost' },
};

export const ActiveFinPill: Story = {
  name: 'Active / FinPill',
  render: args => (
    <div className="flex gap-3">
      <Button {...args} active={false}>
        Today
      </Button>
      <Button {...args} active={true}>
        Today
      </Button>
    </div>
  ),
  args: { variant: 'fin-pill' },
};
