import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ColorPicker } from '../ColorPicker';

const meta: Meta<typeof ColorPicker> = {
  title: 'Components/ColorPicker',
  component: ColorPicker,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ColorPicker>;

export const Default: Story = {
  args: { defaultValue: '#6366f1' },
};

export const WithLabel: Story = {
  render: args => (
    <div className="flex items-center gap-2">
      <ColorPicker id="color" {...args} />
      <label htmlFor="color" className="text-sm text-zinc-300">
        Pick a colour
      </label>
    </div>
  ),
  args: { defaultValue: '#6366f1' },
};
