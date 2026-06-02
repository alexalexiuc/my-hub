import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Modal } from '../Modal';

const meta: Meta<typeof Modal> = {
  title: 'Components/Modal',
  component: Modal,
  tags: ['autodocs'],
  args: {
    title: 'Edit settings',
    onClose: () => undefined,
    children: <p className="text-sm text-[var(--muted)]">Modal body content goes here.</p>,
  },
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Default: Story = {};

export const WithSubmit: Story = {
  args: {
    onSubmit: () => undefined,
    submitLabel: 'Save changes',
  },
};

export const SubmitLoading: Story = {
  args: {
    onSubmit: () => undefined,
    submitLoading: true,
  },
};

export const Narrow: Story = {
  args: { className: 'md:max-w-[360px]' },
};
