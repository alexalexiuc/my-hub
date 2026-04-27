import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Textarea } from '../Textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Components/Textarea',
  component: Textarea,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: { placeholder: 'Enter description…', rows: 4 },
};

export const WithValue: Story = {
  args: { defaultValue: 'Some pre-filled content here.', rows: 4 },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Read-only content.', rows: 4 },
};
