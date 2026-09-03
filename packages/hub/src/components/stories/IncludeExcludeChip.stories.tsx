import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { IncludeExcludeChip } from '../IncludeExcludeChip';

const meta: Meta<typeof IncludeExcludeChip> = {
  title: 'Components/IncludeExcludeChip',
  component: IncludeExcludeChip,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof IncludeExcludeChip>;

export const Included: Story = {
  args: { included: true, onToggle: () => {} },
};

export const Excluded: Story = {
  args: { included: false, onToggle: () => {} },
};
