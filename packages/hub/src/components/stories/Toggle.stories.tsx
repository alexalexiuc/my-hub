import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Toggle } from '../Toggle';

const meta: Meta<typeof Toggle> = {
  title: 'Components/Toggle',
  component: Toggle,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Toggle>;

export const Off: Story = {
  args: { checked: false, onChange: () => {} },
};

export const On: Story = {
  args: { checked: true, onChange: () => {} },
};

export const Disabled: Story = {
  args: { checked: false, disabled: true, onChange: () => {} },
};

export const Interactive: Story = {
  render: function InteractiveToggle() {
    const [checked, setChecked] = useState(false);
    return <Toggle checked={checked} onChange={setChecked} />;
  },
};
