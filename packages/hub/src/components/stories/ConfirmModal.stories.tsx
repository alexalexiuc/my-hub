import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ConfirmModal } from '../ConfirmModal';

const meta: Meta<typeof ConfirmModal> = {
  title: 'Components/ConfirmModal',
  component: ConfirmModal,
  tags: ['autodocs'],
  args: {
    title: 'Delete item',
    message: 'Are you sure you want to delete this item? This action cannot be undone.',
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof ConfirmModal>;

export const Danger: Story = {};

export const Primary: Story = {
  args: { confirmLabel: 'Continue', confirmVariant: 'primary' },
};

export const Loading: Story = {
  args: { loading: true },
};
